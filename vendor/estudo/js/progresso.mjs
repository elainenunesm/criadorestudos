'use strict';

/**
 * PROGRESSO.JS — Substitui js/idb.js do projeto "estudos" original. Mesma API pública (mesmos
 * nomes de função, mesmas assinaturas async) que estudo.js/inicio.mjs/cadernos.mjs/niveis.mjs já
 * esperam.
 *
 * O progresso só é guardado na PASTA CONECTADA (File System Access API, Chrome/Edge): um arquivo
 * "progresso.json" de verdade no computador da aluna. Nada é guardado de forma duradoura no
 * navegador (localStorage) — atualizar a página sem pasta conectada zera o progresso.
 *
 * Única exceção: um "vai-e-vem" em sessionStorage, só pra o progresso sobreviver à troca de tela
 * dentro da mesma visita (index.html ↔ estudo.html são carregamentos de página separados; sem isso
 * completar a aula 1 e ir pra aula 2 faria a 1 "esquecer" que foi concluída). Ele é apagado ao
 * atualizar a página (F5) e ao fechar a aba, e nunca é usado quando há pasta conectada.
 */

const LOCALSTORAGE_CHAVE_PROGRESSO = 'estudo-progresso';
const IDB_NOME_PROGRESSO = 'estudo-progresso-fs';
const IDB_STORE_PROGRESSO = 'handles';
const IDB_CHAVE_PROGRESSO = 'pastaProgresso';
const NOME_ARQUIVO_PROGRESSO = 'progresso.json';

let _pastaProgressoHandle = null;
let _progressoCache = {};
let _inicializacaoPromise = null;

const SESSION_CHAVE_PROGRESSO = 'estudo-progresso-sessao';

/** Apaga a cópia antiga do navegador (versões anteriores guardavam o progresso aqui) e, se a página
 * foi atualizada (F5), também o vai-e-vem da sessão — assim atualizar sem pasta conectada zera. */
function limparProgressoDoNavegador() {
  try { localStorage.removeItem(LOCALSTORAGE_CHAVE_PROGRESSO); } catch (e) { /* ignora */ }
  try {
    let emIframe = false;
    try { emIframe = window.top !== window; } catch (e) { emIframe = true; }
    if (emIframe) {
      // Dentro de um iframe (ex.: pré-visualização) quem atualiza é a página-mãe: o iframe nasce de novo
      // como "navegação", mas a sessão da aba continua. Compara a "origem de tempo" da página de cima —
      // muda a cada carregamento dela, e fica igual quando só o iframe troca de tela.
      let origem = null;
      try { origem = String(window.top.performance.timeOrigin); } catch (e) { /* página-mãe de outra origem */ }
      if (origem) {
        if (sessionStorage.getItem('estudo-progresso-origem') !== origem) sessionStorage.removeItem(SESSION_CHAVE_PROGRESSO);
        sessionStorage.setItem('estudo-progresso-origem', origem);
        return;
      }
    }
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload') sessionStorage.removeItem(SESSION_CHAVE_PROGRESSO);
  } catch (e) { /* ignora */ }
}

function lerProgressoLocalStorage() {
  try {
    const bruto = sessionStorage.getItem(SESSION_CHAVE_PROGRESSO);
    return bruto ? JSON.parse(bruto) : {};
  } catch (e) {
    return {};
  }
}

function escreverProgressoLocalStorage(dados) {
  try {
    sessionStorage.setItem(SESSION_CHAVE_PROGRESSO, JSON.stringify(dados));
    return true;
  } catch (e) {
    console.warn('Não deu pra guardar o progresso desta visita:', e);
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
let _arquivoProgressoManualNome = null; // navegador sem pasta (celular): nome do progresso.json aberto
const SEM_PASTA = !('showDirectoryPicker' in window);

/** Navegador sem pasta (Chrome do celular): botão extra "Salvar" que baixa o progresso.json. */
function garantirBotaoSalvarProgresso(badge) {
  let btn = document.getElementById('pastaProgressoSalvar');
  if (btn) return btn;
  btn = badge.cloneNode(true);
  btn.id = 'pastaProgressoSalvar';
  btn.removeAttribute('onclick');
  btn.title = 'Baixa o seu progresso em um arquivo progresso.json — depois use "Abrir progresso" pra carregar de volta';
  btn.querySelector('.pasta-progresso-badge-texto').removeAttribute('id');
  btn.querySelector('.pasta-progresso-badge-texto').textContent = 'Salvar';
  btn.classList.remove('conectado');
  btn.addEventListener('click', salvarArquivoProgressoManual);
  // Os dois botões num grupo só — o cabeçalho distribui o espaço entre seus filhos diretos.
  const grupo = document.createElement('div');
  grupo.className = 'pasta-progresso-grupo';
  badge.parentNode.insertBefore(grupo, badge);
  grupo.append(badge, btn);
  return btn;
}

function salvarArquivoProgressoManual() {
  const blob = new Blob([JSON.stringify(_progressoCache, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = NOME_ARQUIVO_PROGRESSO;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Navegador sem pasta: abre um progresso.json escolhido pela aluna (precisa de toque, por isso no clique). */
function abrirArquivoProgressoManual() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.addEventListener('change', async () => {
    const arq = inp.files && inp.files[0];
    if (!arq) return;
    let dados;
    try {
      dados = JSON.parse(await arq.text());
      if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('formato');
    } catch (e) {
      window.alert('Esse arquivo não parece um progresso.json válido.');
      return;
    }
    _progressoCache = dados;
    escreverProgressoLocalStorage(dados); // vai-e-vem da visita: sobrevive à troca de tela, não ao F5
    _arquivoProgressoManualNome = arq.name;
    atualizarBadgePastaProgresso();
    if (typeof carregarProgresso === 'function') {
      await carregarProgresso();
      if (typeof renderAulas === 'function') renderAulas();
      if (typeof atualizarSeletoresDeNivel === 'function') atualizarSeletoresDeNivel();
    }
  });
  inp.click();
}

function atualizarBadgePastaProgresso() {
  const badge = document.getElementById('pastaProgressoBadge');
  if (!badge) return;
  const texto = document.getElementById('pastaProgressoBadgeTexto');
  if (SEM_PASTA) {
    garantirBotaoSalvarProgresso(badge);
    badge.classList.toggle('conectado', !!_arquivoProgressoManualNome);
    texto.textContent = _arquivoProgressoManualNome || 'Abrir progresso';
    badge.title = 'Este navegador não conecta pastas — abra o seu progresso.json salvo antes e use "Salvar" para baixar uma cópia atualizada';
    return;
  }
  if (_pastaProgressoHandle) {
    badge.classList.add('conectado');
    texto.textContent = _pastaProgressoHandle.name;
    badge.title = `Progresso salvo em "${_pastaProgressoHandle.name}" — clique pra trocar de pasta`;
  } else {
    badge.classList.remove('conectado');
    texto.textContent = 'Conectar pasta';
    badge.title = 'Conecte uma pasta para guardar o seu progresso — sem pasta, ele zera ao atualizar a página';
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
  if (SEM_PASTA) { abrirArquivoProgressoManual(); return; }
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
  _progressoCache = (await lerArquivoProgressoDaPasta()) || {}; // só o que está na pasta; nada da visita anterior
  try { sessionStorage.removeItem(SESSION_CHAVE_PROGRESSO); } catch (e) { /* ignora */ }
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
  limparProgressoDoNavegador();
  _progressoCache = lerProgressoLocalStorage(); // só o vai-e-vem desta visita (vazio ao atualizar)
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await lerHandleProgresso();
      if (handle) {
        const permissao = await handle.queryPermission({ mode: 'readwrite' });
        if (permissao === 'granted') {
          _pastaProgressoHandle = handle;
          const dadosPasta = await lerArquivoProgressoDaPasta();
          _progressoCache = dadosPasta || {}; // com pasta conectada, só vale o que está nela
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
  // Com pasta conectada o progresso vai só pra pasta; sem pasta, só pro vai-e-vem da visita.
  const salvou = _pastaProgressoHandle ? true : escreverProgressoLocalStorage(_progressoCache);
  await escreverArquivoProgresso();
  return salvou;
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
