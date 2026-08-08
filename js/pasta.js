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

/** Escreve o estado atual (ciclos + config) em "construtor-aulas.json", dentro da pasta
 * conectada — chamado pelo autosave (js/data.js) toda vez que algo muda. */
async function escreverJsonNaPastaConectada() {
  if (!pastaConectadaHandle) return;
  try {
    const permissao = await pastaConectadaHandle.queryPermission({ mode: 'readwrite' });
    if (permissao !== 'granted') return;
    const git = typeof obterConfigGitSemToken === 'function' ? obterConfigGitSemToken() : null;
    const dados = { savedAt: new Date().toISOString(), config: CONFIG_APP, ciclos: CICLOS, git };
    const arquivoHandle = await pastaConectadaHandle.getFileHandle('construtor-aulas.json', { create: true });
    const writable = await arquivoHandle.createWritable();
    await writable.write(JSON.stringify(dados, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('Não deu pra salvar na pasta conectada:', e);
  }
}

/** Lê "construtor-aulas.json" da pasta conectada (se existir) e devolve os dados já em JSON —
 * ou null se a pasta ainda não tem nada salvo (pasta nova) ou não deu pra ler. */
async function lerJsonDaPastaConectada() {
  if (!pastaConectadaHandle) return null;
  try {
    const arquivoHandle = await pastaConectadaHandle.getFileHandle('construtor-aulas.json', { create: false });
    const arquivo = await arquivoHandle.getFile();
    return JSON.parse(await arquivo.text());
  } catch (e) {
    return null;
  }
}

/** Aplica o que estiver salvo na pasta conectada (se tiver algo) e reconstrói a tela —
 * chamado assim que conecta (ou reconecta sozinho) numa pasta. */
async function aplicarDadosDaPastaConectada() {
  const dados = await lerJsonDaPastaConectada();
  if (!dados) return;
  if (Array.isArray(dados.ciclos)) {
    CICLOS.length = 0;
    dados.ciclos.forEach(c => CICLOS.push(c));
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

async function conectarPasta() {
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

  pastaConectadaHandle = handle;
  await salvarHandlePasta(handle);
  localStorage.removeItem(PASTA_DISPENSADA_KEY);
  mostrarBannerPasta('conectado', handle.name);
  await aplicarDadosDaPastaConectada(); // se essa pasta já tinha algo salvo, carrega
  await escreverJsonNaPastaConectada(); // garante que o arquivo já existe/está atualizado
}

async function inicializarPastaConectada() {
  const banner = document.getElementById('pastaBanner');
  if (!banner) return;

  document.getElementById('pastaBannerBtn').addEventListener('click', conectarPasta);
  document.getElementById('pastaBannerFechar').addEventListener('click', () => {
    banner.hidden = true;
    if (!pastaConectadaHandle) localStorage.setItem(PASTA_DISPENSADA_KEY, '1');
  });

  if (!('showDirectoryPicker' in window)) return; // navegador sem suporte — nem convida

  try {
    const handle = await lerHandlePasta();
    if (handle) {
      const permissao = await handle.queryPermission({ mode: 'readwrite' });
      if (permissao === 'granted') {
        pastaConectadaHandle = handle;
        mostrarBannerPasta('conectado', handle.name);
        await aplicarDadosDaPastaConectada();
        return;
      }
      mostrarBannerPasta('desconectado'); // handle existe mas a permissão expirou — convida a reconectar
      return;
    }
  } catch (e) {
    // segue pro convite padrão
  }

  if (localStorage.getItem(PASTA_DISPENSADA_KEY) !== '1') {
    mostrarBannerPasta('desconectado');
  }
}

inicializarPastaConectada();
