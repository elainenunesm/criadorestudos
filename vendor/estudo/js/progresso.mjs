'use strict';

/**
 * PROGRESSO.JS — Substitui js/idb.js do projeto "estudos" original. Mesma API pública (mesmos
 * nomes de função, mesmas assinaturas async) que estudo.js/inicio.mjs/cadernos.mjs/niveis.mjs já
 * esperam.
 *
 * Duas camadas de persistência:
 *  1. localStorage — sempre disponível, sem precisar configurar nada; é a base de toda aluna.
 *     Sem isso, cada tela (index.html/estudo.html) é um carregamento de página separado, e o
 *     progresso ficaria só na memória daquela página — perderia tudo ao trocar de aula (foi
 *     exatamente esse bug: completar a aula 1, ir pra aula 2, e a 1 "esquecer" que foi concluída).
 *  2. Pasta conectada (File System Access API, Chrome/Edge) — opcional, por cima da localStorage:
 *     um arquivo "progresso.json" de verdade no computador da aluna, pra ter uma cópia fora do
 *     navegador (não se perde limpando o cache, dá pra levar pra outro navegador). Se conectada,
 *     os dados de lá têm prioridade sobre a localStorage ao carregar a página.
 */

const LOCALSTORAGE_CHAVE_PROGRESSO = 'estudo-progresso';
const IDB_NOME_PROGRESSO = 'estudo-progresso-fs';
const IDB_STORE_PROGRESSO = 'handles';
const IDB_CHAVE_PROGRESSO = 'pastaProgresso';
const NOME_ARQUIVO_PROGRESSO = 'progresso.json';

let _pastaProgressoHandle = null;
let _progressoCache = {};
let _inicializacaoPromise = null;

function lerProgressoLocalStorage() {
  try {
    const bruto = localStorage.getItem(LOCALSTORAGE_CHAVE_PROGRESSO);
    return bruto ? JSON.parse(bruto) : {};
  } catch (e) {
    return {};
  }
}

function escreverProgressoLocalStorage(dados) {
  try {
    localStorage.setItem(LOCALSTORAGE_CHAVE_PROGRESSO, JSON.stringify(dados));
    return true;
  } catch (e) {
    console.warn('Não deu pra salvar o progresso no navegador:', e);
    return false;
  }
}

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
    badge.title = 'Seu progresso já salva sozinho neste navegador — conecte uma pasta se quiser uma cópia extra, fora do navegador';
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
  _progressoCache = lerProgressoLocalStorage(); // base — sempre disponível, mesmo sem pasta
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await lerHandleProgresso();
      if (handle) {
        const permissao = await handle.queryPermission({ mode: 'readwrite' });
        if (permissao === 'granted') {
          _pastaProgressoHandle = handle;
          const dadosPasta = await lerArquivoProgressoDaPasta();
          if (dadosPasta) _progressoCache = dadosPasta; // pasta manda, se já tiver algo salvo nela
        }
      }
    } catch (e) {
      // segue só com a localStorage
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

/** Grava na localStorage sempre (base) e, se tiver pasta conectada, também lá (cópia extra). O
 * retorno reflete se a localStorage salvou de verdade — quem chama usa isso pra avisar a aluna
 * só num caso raro de falha real (ex: modo privado com storage bloqueada), não pela ausência de
 * pasta, que agora é só um extra opcional. */
async function gravarArquivoProgresso(mudancas) {
  await garantirInicializado();
  _progressoCache = { ..._progressoCache, ...mudancas, savedAt: new Date().toISOString() };
  const salvouLocal = escreverProgressoLocalStorage(_progressoCache);
  await escreverArquivoProgresso();
  return salvouLocal;
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

// ── GRAVAÇÕES DA ALUNA (cards "Gravação do aluno") ─────────────
// Guardadas por aula + posição do card na tela (mesma chave usada pelo "marcar pra revisão",
// ex: "exemplo0") — a aluna pode gravar de novo quantas vezes quiser, cada gravação nova
// substitui a anterior daquele card.
async function getGravacaoAluna(aulaId, chave) {
  const dados = await lerArquivoProgresso();
  return (dados?.gravacoesAluna?.[aulaId]?.[chave]) || null;
}
async function salvarGravacaoAluna(aulaId, chave, audioUrl) {
  const dados = await lerArquivoProgresso();
  const gravacoesAluna = { ...(dados.gravacoesAluna || {}) };
  gravacoesAluna[aulaId] = { ...(gravacoesAluna[aulaId] || {}), [chave]: audioUrl };
  return gravarArquivoProgresso({ gravacoesAluna });
}
