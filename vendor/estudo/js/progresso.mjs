'use strict';

/**
 * PROGRESSO.JS — Substitui js/idb.js do projeto "estudos" original.
 * Mesma API pública (mesmos nomes de função, mesmas assinaturas async) que
 * estudo.js já espera — só troca onde o progresso é guardado: em vez de um
 * arquivo em uma pasta escolhida pelo usuário (File System Access API), usa
 * localStorage do navegador. Mais simples pra quem só quer estudar sem
 * configurar nada, ao custo de não sincronizar entre dispositivos/navegadores.
 */
const PROGRESSO_CHAVE = 'construtor-aulas-progresso';

function lerArquivoProgressoSync() {
  try {
    const bruto = localStorage.getItem(PROGRESSO_CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

async function lerArquivoProgresso() {
  return lerArquivoProgressoSync();
}

async function gravarArquivoProgresso(mudancas) {
  try {
    const atual = lerArquivoProgressoSync() || {};
    const dados = { ...atual, ...mudancas, savedAt: new Date().toISOString() };
    localStorage.setItem(PROGRESSO_CHAVE, JSON.stringify(dados));
    return true;
  } catch (e) {
    console.warn('Erro ao gravar progresso:', e);
    return false;
  }
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

// ── TRILHA ESCOLHIDA ───────────────────────────────────────────
async function getTrilha() {
  const dados = await lerArquivoProgresso();
  return dados?.trilha || null;
}
async function definirTrilha(trilhaId) { await gravarArquivoProgresso({ trilha: trilhaId }); }
