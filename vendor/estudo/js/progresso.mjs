'use strict';

/**
 * PROGRESSO.JS — Substitui js/idb.js do projeto "estudos" original. Mesma API pública (mesmos
 * nomes de função, mesmas assinaturas async) que estudo.js/inicio.mjs/cadernos.mjs/niveis.mjs já
 * esperam. O progresso (aulas concluídas, favoritos, cadernos de erro, insígnias) fica salvo num
 * arquivo "progresso.json" dentro de uma pasta escolhida pela aluna (File System Access API,
 * Chrome/Edge) — igual ao Construtor de Aulas salva os cursos numa pasta conectada (ver
 * js/pasta.js do Construtor). Sem pasta conectada, nada é salvo entre sessões: um export novo
 * (ou uma pasta nunca conectada) sempre começa do zero, sem aula marcada como concluída/favorita
 * por engano só porque foi aberta no mesmo caminho de um teste anterior.
 */

const IDB_NOME_PROGRESSO = 'estudo-progresso-fs';
const IDB_STORE_PROGRESSO = 'handles';
const IDB_CHAVE_PROGRESSO = 'pastaProgresso';
const NOME_ARQUIVO_PROGRESSO = 'progresso.json';

let _pastaProgressoHandle = null;
let _progressoCache = {};
let _inicializacaoPromise = null;

function abrirIdbProgresso() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NOME_PROGRESSO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE_PROGRESSO);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function salvarHandleProgresso(handle) {
  const db = await abrirIdbProgresso();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PROGRESSO, 'readwrite');
    tx.objectStore(IDB_STORE_PROGRESSO).put(handle, IDB_CHAVE_PROGRESSO);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function lerHandleProgresso() {
  const db = await abrirIdbProgresso();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PROGRESSO, 'readonly');
    const req = tx.objectStore(IDB_STORE_PROGRESSO).get(IDB_CHAVE_PROGRESSO);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Atualiza o selo no cabeçalho da tela inicial (#pastaProgressoBadge) — só existe em index.html,
 * por isso sempre confere se o elemento está na página antes de mexer nele. */
function atualizarBadgePastaProgresso() {
  const badge = document.getElementById('pastaProgressoBadge');
  if (!badge) return;
  const texto = document.getElementById('pastaProgressoBadgeTexto');
  if (_pastaProgressoHandle) {
    badge.classList.add('conectado');
    texto.textContent = _pastaProgressoHandle.name;
    badge.title = `Progresso salvo em "${_pastaProgressoHandle.name}" — clique pra trocar de pasta`;
  } else {
    badge.classList.remove('conectado');
    texto.textContent = 'Conectar pasta';
    badge.title = 'Conecte uma pasta pra salvar seu progresso entre sessões';
  }
}

/** Escreve o progresso atual em "progresso.json" dentro da pasta conectada — sem pasta conectada,
 * não faz nada (o progresso fica só na memória, dura até fechar a aba). */
async function escreverArquivoProgresso() {
  if (!_pastaProgressoHandle) return;
  try {
    const permissao = await _pastaProgressoHandle.queryPermission({ mode: 'readwrite' });
    if (permissao !== 'granted') return;
    const arquivoHandle = await _pastaProgressoHandle.getFileHandle(NOME_ARQUIVO_PROGRESSO, { create: true });
    const writable = await arquivoHandle.createWritable();
    await writable.write(JSON.stringify(_progressoCache, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('Não deu pra salvar o progresso na pasta conectada:', e);
  }
}

/** Lê "progresso.json" da pasta conectada, se existir — ou null se a pasta é nova (ainda sem
 * nada salvo) ou não deu pra ler. */
async function lerArquivoProgressoDaPasta() {
  if (!_pastaProgressoHandle) return null;
  try {
    const arquivoHandle = await _pastaProgressoHandle.getFileHandle(NOME_ARQUIVO_PROGRESSO, { create: false });
    const arquivo = await arquivoHandle.getFile();
    return JSON.parse(await arquivo.text());
  } catch (e) {
    return null;
  }
}

/** Abre o seletor de pasta do sistema operacional — chamado pelo clique no selo do cabeçalho.
 * Precisa de gesto do usuário (clique), por isso não roda sozinho ao carregar a página. */
async function conectarPastaProgresso() {
  if (!('showDirectoryPicker' in window)) {
    window.alert('Seu navegador não permite conectar a uma pasta. Use o Chrome ou o Edge.');
    return;
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker();
  } catch (e) {
    return; // cancelou o seletor
  }
  const permissao = await handle.requestPermission({ mode: 'readwrite' });
  if (permissao !== 'granted') return;

  _pastaProgressoHandle = handle;
  try {
    await salvarHandleProgresso(handle);
  } catch (e) {
    console.warn('Não deu pra lembrar dessa pasta pra próxima vez:', e);
  }
  _progressoCache = (await lerArquivoProgressoDaPasta()) || {};
  await escreverArquivoProgresso(); // garante que o arquivo já existe/está atualizado
  atualizarBadgePastaProgresso();

  // Se a tela inicial já estiver montada, recarrega com o progresso dessa pasta.
  if (typeof carregarProgresso === 'function') {
    await carregarProgresso();
    if (typeof renderAulas === 'function') renderAulas();
    if (typeof atualizarSeletoresDeNivel === 'function') atualizarSeletoresDeNivel();
  }
}

/** Tenta reconectar sozinho na pasta lembrada (sem pedir de novo, contanto que a permissão ainda
 * esteja concedida) — roda uma única vez por carregamento de página, mesmo se chamada várias
 * vezes (várias telas podem precisar do progresso ao mesmo tempo). */
function garantirInicializado() {
  if (!_inicializacaoPromise) _inicializacaoPromise = inicializarInterno();
  return _inicializacaoPromise;
}

async function inicializarInterno() {
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await lerHandleProgresso();
      if (handle) {
        const permissao = await handle.queryPermission({ mode: 'readwrite' });
        if (permissao === 'granted') {
          _pastaProgressoHandle = handle;
          _progressoCache = (await lerArquivoProgressoDaPasta()) || {};
        }
      }
    } catch (e) {
      // segue sem pasta conectada
    }
  }
  atualizarBadgePastaProgresso();
}

function lerArquivoProgressoSync() {
  return _progressoCache;
}

async function lerArquivoProgresso() {
  await garantirInicializado();
  return _progressoCache;
}

async function gravarArquivoProgresso(mudancas) {
  await garantirInicializado();
  _progressoCache = { ..._progressoCache, ...mudancas, savedAt: new Date().toISOString() };
  await escreverArquivoProgresso();
  return true;
}

// ── CADERNO DE ERROS (persistido junto com o progresso) ──────
async function getErrorNotebook() {
  const dados = await lerArquivoProgresso();
  return dados?.errosNotebook || {};
}

async function addErro(aulaId, qIdx) {
  const notebook = await getErrorNotebook();
  const key = String(aulaId);
  const set = new Set(notebook[key] || []);
  set.add(qIdx);
  notebook[key] = Array.from(set).sort((a, b) => a - b);

  const recentes = await getErrosRecentes();
  const jaExiste = recentes.findIndex(r => r.aulaId === key && r.chave === qIdx);
  if (jaExiste !== -1) recentes.splice(jaExiste, 1);
  recentes.push({ aulaId: key, chave: qIdx, quando: new Date().toISOString() });

  await gravarArquivoProgresso({ errosNotebook: notebook, errosRecentes: recentes });
  return notebook;
}

async function getErrosRecentes() {
  const dados = await lerArquivoProgresso();
  return dados?.errosRecentes || [];
}

// ── CARTÕES MARCADOS PARA REVISÃO ─────────────────────────────
async function getCartoesMarcados() {
  const dados = await lerArquivoProgresso();
  return dados?.cartoesMarcados || {};
}

async function alternarCartaoMarcado(aulaId, chave) {
  const marcados = await getCartoesMarcados();
  const key = String(aulaId);
  const set = new Set(marcados[key] || []);
  const marcando = !set.has(chave);
  if (marcando) set.add(chave); else set.delete(chave);
  marcados[key] = Array.from(set);
  const salvou = await gravarArquivoProgresso({ cartoesMarcados: marcados });
  return { marcando, salvou };
}

// ── INSÍGNIAS ──────────────────────────────────────────────────
async function getInsignias() {
  const dados = await lerArquivoProgresso();
  return dados?.insignias || [];
}

async function conquistarInsignia(insigniaId) {
  const atuais = await getInsignias();
  if (atuais.includes(insigniaId)) return { nova: false, insignias: atuais };
  const insignias = [...atuais, insigniaId];
  await gravarArquivoProgresso({ insignias });
  return { nova: true, insignias };
}

// ── SEMENTE DO SIMULADO ────────────────────────────────────────
async function getSimuladoSeed() {
  const dados = await lerArquivoProgresso();
  return dados?.simuladoSeed ?? null;
}
async function definirSimuladoSeed(seed) { await gravarArquivoProgresso({ simuladoSeed: seed }); }
async function limparSimuladoSeed() { await gravarArquivoProgresso({ simuladoSeed: null }); }

// ── TRILHAS ESCOLHIDAS ─────────────────────────────────────────
// Um array, não um id só — a aluna pode escolher mais de uma trilha ao mesmo tempo (ver
// vendor/estudo/js/niveis.mjs), cada uma progredindo de forma independente.
async function getTrilhasEscolhidas() {
  const dados = await lerArquivoProgresso();
  return Array.isArray(dados?.trilhasEscolhidas) ? dados.trilhasEscolhidas : [];
}
async function alternarTrilhaEscolhida(trilhaId) {
  const atuais = await getTrilhasEscolhidas();
  const escolhendo = !atuais.includes(trilhaId);
  const trilhasEscolhidas = escolhendo ? [...atuais, trilhaId] : atuais.filter(id => id !== trilhaId);
  const salvou = await gravarArquivoProgresso({ trilhasEscolhidas });
  return { escolhendo, salvou };
}
