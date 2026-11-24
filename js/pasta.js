'use strict';

/**
 * PASTA.JS — Conecta o Construtor a uma pasta de verdade no computador (File
 * System Access API, Chrome/Edge) pra tudo salvar sozinho ali, além do
 * autosave no navegador (localStorage, ver js/data.js). Ao conectar, guarda
 * o handle da pasta no IndexedDB pra reconectar sozinho nas próximas vezes
 * (sem pedir de novo, contanto que a permissão ainda esteja concedida).
 */

const PASTA_DISPENSADA_KEY = 'construtorPastaDispensada';
const IDB_NOME_PASTA = 'construtor-aulas-fs';
const IDB_STORE_PASTA = 'handles';
const IDB_CHAVE_PASTA = 'pastaConectada';

let pastaConectadaHandle = null;
// Pasta guardada de antes (lida do IndexedDB na abertura): o clique em "Conectar" precisa chamar o
// seletor/permissão SEM esperar o IndexedDB, senão o navegador perde o "toque da usuária" e bloqueia.
let pastaHandleGuardado = null;

function abrirIdbPasta() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NOME_PASTA, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE_PASTA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function salvarHandlePasta(handle) {
  const db = await abrirIdbPasta();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PASTA, 'readwrite');
    tx.objectStore(IDB_STORE_PASTA).put(handle, IDB_CHAVE_PASTA);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function lerHandlePasta() {
  const db = await abrirIdbPasta();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PASTA, 'readonly');
    const req = tx.objectStore(IDB_STORE_PASTA).get(IDB_CHAVE_PASTA);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function removerHandlePasta() {
  const db = await abrirIdbPasta();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PASTA, 'readwrite');
    tx.objectStore(IDB_STORE_PASTA).delete(IDB_CHAVE_PASTA);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function mostrarBannerPasta(estado, nomePasta) {
  const banner = document.getElementById('pastaBanner');
  if (!banner) return;
  const titulo = document.getElementById('pastaBannerTitulo');
  const sub = document.getElementById('pastaBannerSub');
  const btn = document.getElementById('pastaBannerBtn');
  if (estado === 'conectado') {
    titulo.textContent = `Conectado à pasta "${nomePasta}"`;
    sub.textContent = 'Tudo que você criar ou editar salva sozinho ali';
    btn.textContent = 'Trocar';
  } else {
    titulo.textContent = 'Conecte uma pasta pra salvar automaticamente';
    sub.textContent = 'Além de salvar no navegador, tudo fica salvo direto ali também';
    btn.textContent = 'Conectar';
  }
  banner.hidden = false;
}

/** Cartão "Pasta no computador" da aba Conexão — o jeito sempre disponível de conectar (o banner
 * do topo some quando é dispensado). `msg` é um aviso opcional sobre a última ação. */
function atualizarCartaoPasta(estado, nomePasta, msg, ok = true) {
  const status = document.getElementById('pastaCartaoStatus');
  if (!status) return;
  const btn = document.getElementById('pastaCartaoBtn');
  const trocar = document.getElementById('pastaCartaoTrocar');
  if (estado === 'conectado') {
    status.textContent = msg || `Conectado à pasta "${nomePasta}".`;
    btn.textContent = 'Recarregar da pasta';
    trocar.style.display = '';
  } else if (estado === 'reconectar') {
    status.textContent = msg || `A pasta "${nomePasta}" precisa de permissão de novo. Toque em Reconectar.`;
    btn.textContent = 'Reconectar';
    trocar.style.display = '';
  } else {
    status.textContent = msg || 'Ainda não conectado.';
    btn.textContent = 'Conectar pasta';
    trocar.style.display = 'none';
  }
  status.classList.toggle('git-sync-ok', !!msg && ok);
  status.classList.toggle('git-sync-erro', !!msg && !ok);
}

/** Escreve o estado atual (ciclos + config) em "construtor-aulas.json", dentro da pasta
 * conectada — chamado pelo autosave (js/data.js) toda vez que algo muda. */
async function escreverJsonNaPastaConectada() {
  if (!pastaConectadaHandle) return;
  try {
    const permissao = await pastaConectadaHandle.queryPermission({ mode: 'readwrite' });
    if (permissao !== 'granted') return;
    // Trava de segurança: nunca troca um arquivo que tem ciclos por um estado vazio (ex.: a leitura
    // não foi aplicada, ou a tela foi aberta do zero) — foi assim que um arquivo bom já foi perdido.
    if (!CICLOS.length && !GRUPOS.length) {
      const { estado, dados } = await lerJsonDaPastaConectada();
      if (estado === 'erro' || (estado === 'ok' && ((dados.ciclos || []).length || (dados.grupos || []).length))) return;
    }
    const git = typeof obterConfigGitSemToken === 'function' ? obterConfigGitSemToken() : null;
    const dados = { savedAt: new Date().toISOString(), config: CONFIG_APP, grupos: GRUPOS, ciclos: CICLOS, trilhas: TRILHAS, git };
    const arquivoHandle = await pastaConectadaHandle.getFileHandle('construtor-aulas.json', { create: true });
    const writable = await arquivoHandle.createWritable();
    await writable.write(JSON.stringify(dados, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('Não deu pra salvar na pasta conectada:', e);
  }
}

/** Lê "construtor-aulas.json" da pasta conectada. Devolve { estado, dados }: 'ok' (leu),
 * 'nao-existe' (pasta nova, ainda sem nada salvo) ou 'erro' (existe mas não deu pra ler/entender —
 * nesse caso NUNCA se deve sobrescrever o arquivo). */
async function lerJsonDaPastaConectada() {
  if (!pastaConectadaHandle) return { estado: 'nao-existe', dados: null };
  let arquivoHandle;
  try {
    arquivoHandle = await pastaConectadaHandle.getFileHandle('construtor-aulas.json', { create: false });
  } catch (e) {
    if (e && e.name === 'NotFoundError') return { estado: 'nao-existe', dados: null };
    console.warn('Não deu pra abrir o arquivo da pasta:', e);
    return { estado: 'erro', dados: null };
  }
  try {
    const arquivo = await arquivoHandle.getFile();
    const dados = JSON.parse(await arquivo.text());
    if (!dados || typeof dados !== 'object') return { estado: 'erro', dados: null };
    return { estado: 'ok', dados };
  } catch (e) {
    console.warn('Não deu pra ler o arquivo da pasta:', e);
    return { estado: 'erro', dados: null };
  }
}

/** Aplica um objeto salvo ({ grupos, ciclos, trilhas, config, git }) e reconstrói a tela. */
function aplicarDadosSalvos(dados) {
  if (Array.isArray(dados.grupos)) {
    GRUPOS.length = 0;
    dados.grupos.forEach(g => GRUPOS.push(g));
  }
  if (Array.isArray(dados.ciclos)) {
    CICLOS.length = 0;
    dados.ciclos.forEach(c => CICLOS.push(c));
  }
  // Migração: arquivo salvo antes do nível "Ciclo" existir (ou GRUPOS vazio mesmo com etapas) —
  // agrupa tudo num "Ciclo 1" automático, sem perder nada.
  if (typeof garantirGrupoPadrao === 'function') garantirGrupoPadrao();
  if (Array.isArray(dados.trilhas)) {
    TRILHAS.length = 0;
    dados.trilhas.forEach(t => TRILHAS.push(t));
  }
  if (dados.config && typeof dados.config === 'object') {
    Object.assign(CONFIG_APP, dados.config);
  }
  if (dados.git && typeof aplicarConfigGitParcial === 'function') {
    aplicarConfigGitParcial(dados.git);
  }
  if (typeof renderArvoreCompleta === 'function') renderArvoreCompleta();
  if (typeof renderPreviewConfig === 'function') renderPreviewConfig();
}

/** Zera tudo que está na tela (ciclos, etapas, trilhas, config visual), pra que os dados venham SÓ
 * da pasta que acabou de ser conectada — sem sobrar nada da pasta/trabalho anterior. */
function limparDadosEmMemoria() {
  GRUPOS.length = 0;
  CICLOS.length = 0;
  TRILHAS.length = 0;
  Object.keys(CONFIG_APP).forEach(k => { delete CONFIG_APP[k]; });
  Object.assign(CONFIG_APP, CONFIG_APP_PADRAO); // definido em js/config.js
  if (typeof renderArvoreCompleta === 'function') renderArvoreCompleta();
  if (typeof renderPreviewConfig === 'function') renderPreviewConfig();
}

/** Lê o que estiver salvo na pasta conectada e aplica — substituindo o que estava na tela: se a
 * pasta tem arquivo, a tela passa a ser o arquivo; se não tem, a tela fica vazia (pasta nova).
 * Devolve o estado da leitura ('ok' | 'nao-existe' | 'erro'). No 'erro' não mexe em nada. */
async function aplicarDadosDaPastaConectada() {
  const { estado, dados } = await lerJsonDaPastaConectada();
  if (estado === 'erro') return estado;
  limparDadosEmMemoria();
  if (estado === 'ok') aplicarDadosSalvos(dados);
  return estado;
}

/** Conecta (ou reconecta) a pasta e carrega o "construtor-aulas.json" que já estiver nela.
 * Sem `escolherOutra`, reaproveita a pasta guardada de antes (só pede a permissão de novo, que
 * exige um toque da usuária) — só abre o seletor de pastas se não houver uma guardada. */
async function conectarPasta(escolherOutra = false) {
  if (!('showDirectoryPicker' in window)) {
    window.alert('Seu navegador não permite conectar a uma pasta. Use o Chrome ou o Edge (no computador). Dá pra carregar um arquivo .json pelo botão "Abrir arquivo .json" na aba Conexão.');
    return;
  }
  let handle = null;
  if (!escolherOutra) {
    try {
      const guardado = pastaConectadaHandle || pastaHandleGuardado;
      if (guardado && (await guardado.requestPermission({ mode: 'readwrite' })) === 'granted') handle = guardado;
    } catch (e) {
      handle = null; // handle antigo/inválido — cai pro seletor
    }
  }
  if (!handle) {
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // cancelou o seletor
      atualizarCartaoPasta('desconectado', '', `Não foi possível abrir o seletor de pastas (${(e && e.name) || 'erro'}). Abra o Construtor pelo Chrome/Edge, em https ou localhost.`, false);
      window.alert('Não foi possível abrir o seletor de pastas: ' + ((e && e.message) || e));
      return;
    }
    const permissao = await handle.requestPermission({ mode: 'readwrite' });
    if (permissao !== 'granted') {
      atualizarCartaoPasta('desconectado', '', 'Permissão negada: sem ela não dá pra salvar na pasta.', false);
      return;
    }
  }

  // Trocando de pasta: salva o que faltava na pasta anterior e cancela o autosave pendente, pra o
  // trabalho de uma pasta nunca ser gravado na outra.
  if (pastaConectadaHandle && pastaConectadaHandle !== handle) {
    try { await escreverJsonNaPastaConectada(); } catch (e) { /* segue */ }
  }
  if (typeof _autosaveTimeout !== 'undefined') clearTimeout(_autosaveTimeout);
  pastaConectadaHandle = handle;
  pastaHandleGuardado = handle;
  try { await salvarHandlePasta(handle); } catch (e) { console.warn('Não deu pra guardar a pasta pra reconectar depois:', e); }
  localStorage.removeItem(PASTA_DISPENSADA_KEY);

  const estado = await aplicarDadosDaPastaConectada(); // se essa pasta já tinha algo salvo, carrega
  mostrarBannerPasta('conectado', handle.name);
  if (estado === 'erro') {
    // Há um construtor-aulas.json lá, mas não foi possível ler: não escreve por cima, pra não perder.
    pastaConectadaHandle = null; // sem autosave até resolver — evita apagar o arquivo existente
    atualizarCartaoPasta('conectado', handle.name, `Pasta "${handle.name}" conectada, mas o arquivo construtor-aulas.json não pôde ser lido. Nada foi sobrescrito.`, false);
    return;
  }
  if (estado === 'ok') {
    atualizarCartaoPasta('conectado', handle.name, `Pasta "${handle.name}" conectada — dados carregados do arquivo.`);
  } else {
    atualizarCartaoPasta('conectado', handle.name, `Pasta "${handle.name}" conectada. Ainda não havia construtor-aulas.json: foi criado agora.`);
  }
  // Só cria o arquivo quando a pasta ainda não tinha um: se já existia, ele foi apenas LIDO, sem regravar.
  if (estado === 'nao-existe') await escreverJsonNaPastaConectada();
}

/** Fallback sem File System Access (ou pra abrir um backup): carrega um .json escolhido à mão. */
function abrirArquivoJsonManual(input) {
  const arquivo = input.files && input.files[0];
  input.value = '';
  if (!arquivo) return;
  const nomePasta = pastaConectadaHandle ? pastaConectadaHandle.name : '';
  const estadoAtual = pastaConectadaHandle ? 'conectado' : 'desconectado';
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const dados = JSON.parse(String(leitor.result));
      if (!dados || typeof dados !== 'object' || (!Array.isArray(dados.ciclos) && !Array.isArray(dados.grupos))) throw new Error('formato');
      aplicarDadosSalvos(dados);
      atualizarCartaoPasta(estadoAtual, nomePasta, `Arquivo "${arquivo.name}" carregado.`);
      if (typeof salvarAutomaticamente === 'function') salvarAutomaticamente();
    } catch (e) {
      atualizarCartaoPasta(estadoAtual, nomePasta, 'Esse arquivo não é um construtor-aulas.json válido.', false);
    }
  };
  leitor.onerror = () => atualizarCartaoPasta(estadoAtual, nomePasta, 'Não foi possível ler o arquivo.', false);
  leitor.readAsText(arquivo);
}

async function inicializarPastaConectada() {
  const banner = document.getElementById('pastaBanner');
  if (!banner) return;

  document.getElementById('pastaBannerBtn').addEventListener('click', () => conectarPasta(!!pastaConectadaHandle));
  document.getElementById('pastaBannerFechar').addEventListener('click', () => {
    banner.hidden = true;
    if (!pastaConectadaHandle) localStorage.setItem(PASTA_DISPENSADA_KEY, '1');
  });
  const cartaoBtn = document.getElementById('pastaCartaoBtn');
  if (cartaoBtn) cartaoBtn.addEventListener('click', () => conectarPasta(false));
  const cartaoTrocar = document.getElementById('pastaCartaoTrocar');
  if (cartaoTrocar) cartaoTrocar.addEventListener('click', () => conectarPasta(true));

  if (!('showDirectoryPicker' in window)) {
    atualizarCartaoPasta('desconectado', '', 'Este navegador não conecta a pastas. Use o Chrome ou o Edge, ou abra um arquivo .json.', false);
    return; // navegador sem suporte — nem convida
  }

  try {
    const handle = await lerHandlePasta();
    pastaHandleGuardado = handle;
    if (handle) {
      const permissao = await handle.queryPermission({ mode: 'readwrite' });
      if (permissao === 'granted') {
        pastaConectadaHandle = handle;
        const estado = await aplicarDadosDaPastaConectada();
        mostrarBannerPasta('conectado', handle.name);
        if (estado === 'erro') {
          pastaConectadaHandle = null; // não deixa o autosave sobrescrever um arquivo que não deu pra ler
          atualizarCartaoPasta('conectado', handle.name, `O arquivo construtor-aulas.json da pasta "${handle.name}" não pôde ser lido. Nada foi sobrescrito.`, false);
        } else {
          atualizarCartaoPasta('conectado', handle.name);
        }
        return;
      }
      mostrarBannerPasta('desconectado'); // handle existe mas a permissão expirou — convida a reconectar
      atualizarCartaoPasta('reconectar', handle.name);
      return;
    }
  } catch (e) {
    // segue pro convite padrão
  }

  atualizarCartaoPasta('desconectado');
  if (localStorage.getItem(PASTA_DISPENSADA_KEY) !== '1') {
    mostrarBannerPasta('desconectado');
  }
}

inicializarPastaConectada();

/** Botão de pasta do topo: conecta a pasta (e lê o construtor-aulas.json que já estiver nela).
 * Sem suporte do navegador, cai no download do .json de antes. */
function botaoPastaTopo() {
  if (!('showDirectoryPicker' in window)) {
    window.alert('Este navegador (ou esta janela) não permite escolher pastas. Abra o Construtor no Chrome ou no Edge do computador, ou use "Abrir arquivo .json" na aba Conexão.');
    return;
  }
  // Sempre abre o seletor: com uma pasta já guardada, conectarPasta(false) reconectaria nela em silêncio
  // (sem abrir nada), e parece que o botão não funciona.
  conectarPasta(true).catch(e => window.alert('Erro ao conectar a pasta: ' + ((e && e.message) || e)));
}
