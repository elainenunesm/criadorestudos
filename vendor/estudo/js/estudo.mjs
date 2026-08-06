'use strict';

/**
 * ESTUDO.JS — Controller genérico da tela de estudos.
 * Carrega dinamicamente o arquivo de questões da aula via URL: ?aula=N
 * Para criar uma nova aula, basta criar js/data/questoes/aula-N.mjs
 */

const LETRAS = ['A', 'B', 'C', 'D'];
const params   = new URLSearchParams(window.location.search);
const aulaId   = params.get('aula') || '1';
const modoErros   = params.get('modo') === 'erros';
const modoRevisao = params.get('modo') === 'revisao';
// "Geral" do Caderno de Erros: junta as checagens erradas de TODAS as aulas
// numa prática só, do erro mais recente pro mais antigo (sem precisar de ?aula=N).
const modoErrosGeral = modoErros && params.get('geral') === '1';
// Sub-tipo do caderno de Revisão: 'perguntas' mostra só checagem*/questao*
// marcadas, 'telas' mostra só definicao/contexto/exemplo* marcadas. Sem o
// parâmetro (links antigos), mostra tudo que estiver marcado, como antes.
const tipoRevisao = params.get('tipo');

// Questões pontuadas desativadas por enquanto (dado da aula mantido em
// js/data/questoes/aula-N.mjs para reativar depois — é só voltar para true).
const QUESTOES_ATIVAS = false;

// ── ESTADO ───────────────────────────────────────────────────
const estado = {
  atual:         0,
  respostas:     [],   // preenchido após carregar as questões
  origIdx:       [],   // mapeia índice exibido -> índice original em aula.questoes (modo caderno de erros)
  totalOriginal: 0,    // nº de questões da 1ª rodada, para a mensagem final após rodadas de revisão
};

// true quando a aula carregada é o Simulado (montarSimulado) — usado só em
// mostrarFinalizadoChecagem() pra saber se deve limpar a semente do sorteio
// ao terminar a tentativa com 100% de acerto (ver js/idb.js).
let aulaEhSimulado = false;

// ── CARREGAR QUESTÕES DINAMICAMENTE ─────────────────────────
function carregarAula(id) {
  return new Promise((resolve, reject) => {
    const script  = document.createElement('script');
    script.src    = `js/data/questoes/aula-${id}.mjs`;
    script.onload = () => resolve(window.AULA_DATA);
    script.onerror = () => reject(new Error(`Aula ${id} não encontrada.`));
    document.head.appendChild(script);
  });
}

// ── ELEMENTOS ────────────────────────────────────────────────
const questaoInfo      = document.getElementById('questaoInfo');
const progressSegs     = document.getElementById('progressSegmentos');
const questaoTitulo    = document.getElementById('questaoTitulo');
const questaoSubtitulo = document.getElementById('questaoSubtitulo');
const opcoesEl         = document.getElementById('opcoes');
const feedbackBar      = document.getElementById('feedbackBar');
const feedbackIcon     = document.getElementById('feedbackIcon');
const feedbackTexto    = document.getElementById('feedbackTexto');
const btnAnterior      = document.getElementById('btnAnterior');
const btnProxima       = document.getElementById('btnProxima');
const questaoArea      = document.getElementById('questaoArea');
const scrollFade       = document.getElementById('scrollFade');

// ── TOAST ────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'default') {
  let toast = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === 'warning' ? '#d97706' : '';
  clearTimeout(toastTimer);
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), type === 'warning' ? 4000 : 2200);
}

// Monta o texto da barra de feedback com o "Correto!"/"Incorreto." em
// uma linha e a explicação em outra, separados por um espaço maior.
// Quando errado, acrescenta uma terceira linha indicando a alternativa certa.
function montarFeedbackHtml(acertou, texto, letraCorreta) {
  const titulo = acertou ? 'Correto!' : 'Incorreto.';
  const correta = !acertou && letraCorreta
    ? `<span class="feedback-correta">Alternativa ${letraCorreta} é a correta.</span>`
    : '';
  return `<span class="feedback-titulo">${titulo}</span><span class="feedback-explicacao">${texto}</span>${correta}`;
}

function atualizarScrollFade() {
  if (!questaoArea || !scrollFade) return;
  const atBottom = questaoArea.scrollHeight - questaoArea.scrollTop <= questaoArea.clientHeight + 8;
  scrollFade.classList.toggle('oculto', atBottom);
}
questaoArea.addEventListener('scroll', atualizarScrollFade);

// Frases longas (ex: "Aconteceram fatos estranhos naquela noite.") podem não
// caber na largura da tela — o .frase-anotada-wrap já deixa arrastar pro
// lado (overflow-x:auto), mas sem nenhuma pista visual isso parecia palavra
// cortada/sumida. Liga .tem-overflow (degradê na borda, ver estudo.css) só
// quando o conteúdo realmente não cabe inteiro. Chamada depois de popular
// qualquer grid .frase-anotada, então roda em todas de uma vez.
function marcarOverflowNasFrasesAnotadas() {
  document.querySelectorAll('.frase-anotada-wrap').forEach(wrap => {
    wrap.classList.toggle('tem-overflow', wrap.scrollWidth > wrap.clientWidth + 2);
  });
}

// ── TELAS DE INTRODUÇÃO ─────────────────────────────────────
let introTotal = 0;

function renderIntroSegs(step) {
  progressSegs.innerHTML = '';
  for (let i = 0; i < introTotal; i++) {
    const seg = document.createElement('div');
    seg.className = i <= step ? 'seg respondida' : 'seg';
    progressSegs.appendChild(seg);
  }
}

function mostrarIntro(aula, introIdx = 0) {
  // Oculta elementos das questões
  feedbackBar.style.display = 'none';
  btnAnterior.style.display = introIdx > 0 ? '' : 'none';

  // Atualiza header
  questaoInfo.textContent = aula.titulo;
  if (introIdx === 0) {
    progressSegs.innerHTML = '';
  } else {
    renderIntroSegs(introIdx - 1);
  }

  // Monta conteúdo da intro
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';

  const ac = aula.antesComecar || {};
  opcoesEl.innerHTML = `
    <div class="intro-card">
      <span class="intro-label">Antes de começar</span>
      <h2 class="intro-titulo">${ac.titulo || aula.titulo}</h2>
      <p class="intro-desc">${ac.descricao || ''}</p>
      <div class="intro-info">
        <div class="intro-info-item">
          <div class="intro-info-icone-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="#4A80F0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="26" height="26">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div class="intro-info-texto">
            <h3>O que você vai aprender</h3>
            <p>${ac.aprender || ''}</p>
          </div>
        </div>
        <div class="intro-info-item">
          <div class="intro-info-icone-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="#4A80F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="26" height="26">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
              <path d="M9 18h6"/>
              <path d="M10 22h4"/>
            </svg>
          </div>
          <div class="intro-info-texto">
            <h3>Por que isso é importante</h3>
            <p>${ac.importancia || ''}</p>
          </div>
        </div>
      </div>
    </div>`;

  // Botão "Começar"
  btnProxima.innerHTML  = 'Começar <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled   = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

function sairIntro() {
  feedbackBar.style.display = '';
  btnAnterior.style.display = '';
  questaoTitulo.innerHTML   = '';
}

// ── MARCAR CARTÃO PARA REVISÃO ───────────────────────────────
// Etiqueta tipo marca-página no lado esquerdo das telas de conteúdo
// (definição, contexto, exemplo...). Fica salva no arquivo de progresso.
let cartaoMarcadoSet = new Set();

function marcarCartaoHtml(chave) {
  const marcada = cartaoMarcadoSet.has(chave);
  return `
    <button type="button" class="btn-marcar-cartao${marcada ? ' marcada' : ''}" data-chave="${chave}" title="Marcar para revisão">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>`;
}

function ativarBotaoMarcar() {
  const btn = opcoesEl.querySelector('.btn-marcar-cartao');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const chave = btn.dataset.chave;
    const marcandoOtimista = !cartaoMarcadoSet.has(chave);
    // Atualiza a tela na hora (sensação de resposta imediata), mas só
    // confirma "salvo" depois que gravarArquivoProgresso() de fato terminar
    // — sem isso, uma permissão de pasta "esquecida" fazia parecer que
    // marcou quando na verdade nada foi salvo em disco.
    if (marcandoOtimista) cartaoMarcadoSet.add(chave); else cartaoMarcadoSet.delete(chave);
    btn.classList.toggle('marcada', marcandoOtimista);

    const { marcando, salvou } = await alternarCartaoMarcado(aulaId, chave);
    if (!salvou) {
      // Não salvou de verdade — desfaz o estado otimista na tela.
      if (marcandoOtimista) cartaoMarcadoSet.delete(chave); else cartaoMarcadoSet.add(chave);
      btn.classList.toggle('marcada', !marcandoOtimista);
      showToast('⚠️ Não foi possível salvar — reconecte a pasta e tente de novo.', 'warning');
      return;
    }
    showToast(marcando ? '🔖 Marcada para revisão!' : 'Removida da revisão');
  });
}

function mostrarDefinicao(aula, introIdx) {
  const def = aula.definicao || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="definicao-card">
      ${marcarCartaoHtml('definicao')}
      <div class="definicao-icone-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="#4A80F0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="40" height="40">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <p class="definicao-texto">${def.texto || ''}</p>
    </div>`;
  ativarBotaoMarcar();
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

function mostrarContexto(aula, introIdx) {
  const ctx = aula.contexto || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = introIdx > 0 ? '' : 'none';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="contexto-card">
      ${marcarCartaoHtml('contexto')}
      <div class="contexto-icone-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="#4A80F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>
      <p class="contexto-texto">${ctx.texto || ''}</p>
      ${ctx.nota ? `
      <div class="contexto-nota">
        <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="10" fill="#4A80F0"/><rect x="11" y="11" width="2" height="6" rx="1" fill="white"/><rect x="11" y="8" width="2" height="2" rx="1" fill="white"/></svg>
        <span>${ctx.nota}</span>
      </div>` : ''}
    </div>`;
  ativarBotaoMarcar();
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// Tela de exemplo do fenômeno da natureza usa um nascer do sol
// (em vez da chuva do resumo), para casar com a palavra "Amanheceu".
const EXEMPLO_ICONE_FENOMENO = `
  <path fill="none" stroke="#4A80F0" stroke-width="1.8" stroke-linecap="round" d="M13 2v2M8.5 4.9l1 1M17.5 4.9l-1 1"/>
  <path fill="#4A80F0" d="M8 12a5 5 0 0 1 10 0z"/>
  <line x1="6" y1="12" x2="20" y2="12" stroke="#4A80F0" stroke-width="1.8" stroke-linecap="round"/>
  <path fill="none" stroke="#4A80F0" stroke-width="1.8" stroke-linecap="round" d="M8 16h4M15 16h3M10 19h3"/>`;

// Rótulo do colchete anotado embaixo da palavra. Aceita um índice único ou
// um intervalo (ex: o predicado cobre o verbo + a palavra recém-clicada).
const ROTULO_PAPEL = { verbo: 'Verbo', sujeito: 'Sujeito', predicado: 'Predicado', auxiliar: 'Auxiliar', principal: 'Principal' };

function anotarPapelInterativo(wrap, idxOuIdxs, papel) {
  const lista  = Array.isArray(idxOuIdxs) ? idxOuIdxs : [idxOuIdxs];
  const sorted = [...lista].sort((a, b) => a - b);
  // O predicado fica numa linha abaixo de verbo/sujeito porque seu colchete
  // pode cobrir a mesma coluna do verbo (ele é o núcleo do predicado).
  const linha = papel === 'predicado' ? 3 : 2;

  // Agrupa em blocos contíguos — um papel pode ficar "quebrado" por outro no
  // meio da frase (ex: predicado quebrado pelo sujeito na ordem invertida:
  // "Aconteceram fatos estranhos naquela noite" — predicado é [0,3,4], não
  // um intervalo único, senão o colchete cobriria o sujeito também).
  const grupos = [];
  let inicio = sorted[0], fim = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === fim + 1) {
      fim = sorted[i];
    } else {
      grupos.push([inicio, fim]);
      inicio = fim = sorted[i];
    }
  }
  grupos.push([inicio, fim]);

  grupos.forEach(([ini, final]) => {
    wrap.insertAdjacentHTML('beforeend',
      `<div class="anotacao-${papel}" style="grid-column:${ini + 1}/span ${final - ini + 1};grid-row:${linha}">${ROTULO_PAPEL[papel]}</div>`);
  });
}

// Passo de exemplo com mais de uma palavra clicável pro mesmo papel (ex:
// "estudou" e "ontem", ambos parte do predicado). Diferente de marcarAntes
// (travado, só contexto), as palavras em "corretas" continuam clicáveis —
// algumas já têm uma cor própria conhecida (papeisIniciais, ex: o verbo
// continua azul mesmo depois de confirmado como parte do predicado) e viram
// a cor do papel principal quando não têm uma cor própria. O colchete do
// papel principal cresce a cada clique, até cobrir todas as palavras certas.
function renderInterativoMultiplo(ex, interativo, wrap) {
  const jaAcertou = ex._acertouInterativo === true;
  btnProxima.disabled = !jaAcertou;
  wrap.innerHTML = '';

  // Palavras já encontradas num passo anterior (ex: o verbo) entram contadas
  // desde o início — não precisam de um clique extra pra "confirmar" de novo.
  if (!ex._selecionadas) ex._selecionadas = [...(interativo.preSelecionadas || [])];
  const marcarAntes    = interativo.marcarAntes || [];
  const papeisIniciais = interativo.papeisIniciais || {};

  interativo.palavras.forEach((palavra, idx) => {
    const btn = document.createElement('button');
    btn.className = 'word-chip word-chip-sm';
    btn.textContent = palavra;
    btn.style.gridColumn = String(idx + 1);
    btn.style.gridRow    = '1';

    const prefixada  = marcarAntes.find(m => Array.isArray(m.idx) ? m.idx.includes(idx) : m.idx === idx);
    const ehAlvo      = interativo.corretas.includes(idx);
    const jaSelecionada = ex._selecionadas.includes(idx);

    if (PONTUACAO_RE.test(palavra)) {
      btn.classList.add('pontuacao');
      btn.disabled = true;
    } else if (prefixada) {
      btn.disabled = true;
      btn.classList.add(`${prefixada.papel}-correto`);
    } else if (ehAlvo && jaAcertou) {
      btn.disabled = true;
      btn.classList.add(`${papeisIniciais[idx] || interativo.papel}-correto`);
    } else if (ehAlvo) {
      // Mesmo já contando desde o início (preSelecionadas), a palavra
      // continua clicável — clicar nela de novo também "abre" o colchete do
      // predicado, igual clicar numa palavra nova.
      if (jaSelecionada || papeisIniciais[idx]) btn.classList.add(`${papeisIniciais[idx] || interativo.papel}-correto`);
      btn.addEventListener('click', () => {
        ex._algumClique = true;
        if (!ex._selecionadas.includes(idx)) ex._selecionadas.push(idx);
        if (interativo.corretas.every(i => ex._selecionadas.includes(i))) ex._acertouInterativo = true;
        renderInterativoMultiplo(ex, interativo, wrap);
      });
    } else {
      btn.disabled = true;
    }
    wrap.appendChild(btn);
  });

  marcarAntes.forEach(m => anotarPapelInterativo(wrap, m.idx, m.papel));
  Object.keys(papeisIniciais).forEach(idxStr => {
    const idx = Number(idxStr);
    if (interativo.corretas.includes(idx) && (ex._selecionadas.includes(idx) || jaAcertou)) {
      anotarPapelInterativo(wrap, idx, papeisIniciais[idx]);
    }
  });
  // O colchete do papel principal (predicado) só aparece depois de um clique
  // de verdade — palavras pré-selecionadas sozinhas (ex: o verbo, já sabido
  // de um passo anterior) não bastam pra "abrir" o predicado sozinhas, mas
  // clicar em qualquer uma das palavras-alvo (mesmo já contada) já conta.
  const mostrarPrincipal = jaAcertou || ex._algumClique === true;
  if (mostrarPrincipal && ex._selecionadas.length > 0) {
    anotarPapelInterativo(wrap, ex._selecionadas, interativo.papel);
  }

  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// Frase já anotada, só ilustrativa (sem clique) — usada pra recapitular a
// divisão sujeito/verbo/predicado de um passo anterior, com os colchetes
// já prontos, em vez de repetir a explicação em texto.
function renderFraseAnotadaEstatica(dados, wrap) {
  dados.sentenca.forEach((palavra, i) => {
    const btn = document.createElement('button');
    let cls = 'word-chip word-chip-sm';
    if (PONTUACAO_RE.test(palavra))       cls += ' pontuacao';
    else if (i === dados.verbo)                cls += ' verbo-correto';
    else if (dados.sujeito.includes(i))   cls += ' sujeito-correto';
    else if (dados.predicado.includes(i)) cls += ' predicado-correto';
    btn.className         = cls;
    btn.textContent        = palavra;
    btn.disabled           = true;
    btn.style.gridColumn   = String(i + 1);
    btn.style.gridRow      = '1';
    wrap.appendChild(btn);
  });
  if (dados.sujeito.length)   anotarPapelInterativo(wrap, dados.sujeito, 'sujeito');
  if (dados.verbo != null)    anotarPapelInterativo(wrap, dados.verbo, 'verbo');
  if (dados.predicado.length) anotarPapelInterativo(wrap, dados.predicado, 'predicado');
}

// Passo de exemplo com uma checklist de perguntas sim/não (ex: "o verbo
// destacado é haver? é fazer? é fenômeno da natureza?") — precisa acertar
// todas antes de liberar o "Próximo". Progresso guardado em ex._simNaoOk,
// array paralelo a caixa.perguntasSimNao (true quando já respondida certo).
function renderSimNao(ex, wrap) {
  const perguntas = ex.caixa.perguntasSimNao;
  if (!ex._simNaoOk) ex._simNaoOk = perguntas.map(() => false);
  const todasCertas = ex._simNaoOk.every(Boolean);
  btnProxima.disabled = !todasCertas;

  wrap.innerHTML = perguntas.map((p, i) => `
    <div class="simnao-item">
      <p class="simnao-texto">${p.texto}</p>
      <div class="simnao-botoes">
        <button type="button" class="simnao-btn" data-i="${i}" data-valor="true"${ex._simNaoOk[i] ? ' disabled' : ''}>Sim</button>
        <button type="button" class="simnao-btn" data-i="${i}" data-valor="false"${ex._simNaoOk[i] ? ' disabled' : ''}>Não</button>
      </div>
    </div>`).join('') +
    (todasCertas ? `
    <div class="passo-caixa-divisor"></div>
    <p class="passo-caixa-seta">→ ${ex.caixa.conclusao}</p>` : '');

  perguntas.forEach((p, i) => {
    if (ex._simNaoOk[i]) {
      const certoBtn = wrap.querySelector(`.simnao-btn[data-i="${i}"][data-valor="${p.resposta}"]`);
      if (certoBtn) certoBtn.classList.add('correta');
      return;
    }
    wrap.querySelectorAll(`.simnao-btn[data-i="${i}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const valor = btn.dataset.valor === 'true';
        if (valor === p.resposta) {
          ex._simNaoOk[i] = true;
          renderSimNao(ex, wrap);
        } else {
          btn.classList.add('errada');
          setTimeout(() => btn.classList.remove('errada'), 500);
        }
      });
    });
  });
}

function mostrarExemplo(aula, introIdx, i) {
  const ex = (aula.exemplo || [])[i] || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  const icone = ex.tipo === 'fenomeno'
    ? EXEMPLO_ICONE_FENOMENO
    : (RESUMO_ICONES[ex.tipo] ? RESUMO_ICONES[ex.tipo]('#4A80F0') : RESUMO_ICONES.acao('#4A80F0'));
  opcoesEl.innerHTML = `
    <div class="exemplo-card">
      ${marcarCartaoHtml(`exemplo${i}`)}
      <div class="exemplo-icone-wrap">
        <svg viewBox="-6 0 30 24" fill="none" width="60" height="48">
          <line x1="-5" y1="8"  x2="0" y2="8"  stroke="#b8ccf4" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="-5" y1="12" x2="1" y2="12" stroke="#b8ccf4" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="-5" y1="16" x2="0" y2="16" stroke="#b8ccf4" stroke-width="2.2" stroke-linecap="round"/>
          ${icone}
        </svg>
      </div>
      ${ex.texto ? `<p class="exemplo-texto">${ex.texto}</p>` : ''}
      ${ex.conclusao ? `<p class="exemplo-conclusao">${ex.conclusao}</p>` : ''}
      ${ex.obs ? `<p class="exemplo-texto">${ex.obs}</p>` : ''}
      ${(ex.pontos || []).length ? `
      <div class="exemplo-pontos">
        ${ex.pontos.map(p => `
          <div class="exemplo-ponto">
            <div class="exemplo-ponto-icone">
              <svg viewBox="0 0 24 24" width="22" height="22">${RESUMO_ICONES[p.tipo] ? RESUMO_ICONES[p.tipo]('#4A80F0') : ''}</svg>
            </div>
            <p class="exemplo-ponto-texto">${p.texto}</p>
          </div>`).join('')}
      </div>` : ''}
      ${ex.fechamento ? `<p class="exemplo-texto">${ex.fechamento}</p>` : ''}
      ${ex.passo ? `
      <div class="passo-bloco">
        <div class="passo-linha">
          <div class="passo-numero">${ex.passo.numero}</div>
          <p class="passo-instrucao">– ${ex.passo.instrucao}</p>
        </div>
        ${ex.passo.nota ? `<p class="passo-nota">${ex.passo.nota}</p>` : ''}
      </div>` : ''}
      ${ex.caixa ? (ex.caixa.anotado ? `
      <div class="passo-caixa">
        <div class="frase-anotada-wrap"><div class="frase-anotada" id="exemploAnotado" style="grid-template-columns:repeat(${ex.caixa.anotado.sentenca.length},auto)"></div></div>
      </div>` : ex.caixa.perguntasSimNao ? `
      <div class="passo-caixa">
        <div class="simnao-wrap" id="simNaoWrap"></div>
      </div>` : (!ex.caixa.titulo && !ex.caixa.exemplo && !ex.caixa.sentencaAnotada && !ex.caixa.interativo && !ex.caixa.inline && (ex.caixa.perguntas || []).length) ? `
      <div class="passo-caixa passo-caixa-somente-texto">
        <div class="passo-caixa-perguntas">
          ${ex.caixa.perguntas.map(p => typeof p === 'string'
            ? `<p class="passo-caixa-seta">→ ${p}</p>`
            : `<p class="passo-caixa-nota-indent">${p.nota}</p>`
          ).join('')}
        </div>
      </div>` : `
      <div class="passo-caixa">
        <div class="passo-caixa-cabecalho">
          <div class="passo-caixa-icone">
            <svg viewBox="0 0 24 24" width="22" height="22">${RESUMO_ICONES[ex.caixa.tipo] ? RESUMO_ICONES[ex.caixa.tipo]('#4A80F0') : ''}</svg>
          </div>
          ${ex.caixa.interativo
            ? `<p class="passo-caixa-inline"><strong>${ex.caixa.rotulo || 'Selecione o verbo abaixo:'}</strong></p>`
            : ex.caixa.inline
              ? `<p class="passo-caixa-inline"><strong>Exemplo:</strong> ${ex.caixa.exemplo}</p>`
              : `<div class="passo-caixa-corpo">
                   <p class="passo-caixa-titulo">${ex.caixa.titulo || 'Exemplo:'}</p>
                   ${ex.caixa.exemplo ? `<p class="passo-caixa-texto">${ex.caixa.exemplo}</p>` : ''}
                 </div>`}
        </div>
        ${ex.caixa.interativo ? `<div class="frase-anotada-wrap"><div class="frase-anotada" id="exemploSentence" style="grid-template-columns:repeat(${ex.caixa.interativo.palavras.length},auto)"></div></div>` : ''}
        ${ex.caixa.sentencaAnotada ? `<div class="frase-anotada-wrap"><div class="frase-anotada" id="exemploCaixaAnotada" style="grid-template-columns:repeat(${ex.caixa.sentencaAnotada.sentenca.length},auto)"></div></div>` : ''}
        ${(ex.caixa.perguntas || []).length ? `
        <div class="passo-caixa-divisor"></div>
        <div class="passo-caixa-perguntas">
          ${ex.caixa.perguntas.map(p => typeof p === 'string'
            ? `<p class="passo-caixa-seta">→ ${p}</p>`
            : `<p class="passo-caixa-nota-indent">${p.nota}</p>`
          ).join('')}
        </div>` : ''}
        ${ex.caixa.resposta ? `
        <div class="passo-caixa-divisor"></div>
        <p class="passo-caixa-resposta"><strong>Resposta:</strong> ${ex.caixa.resposta}</p>` : ''}
      </div>`) : ''}
    </div>`;
  ativarBotaoMarcar();
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  // Palavras clicáveis dentro da caixa de exemplo (ex: selecionar o verbo).
  // Não é uma checagem — não conta erro, só trava o "Próximo" até acertar.
  if (ex.caixa && ex.caixa.anotado) {
    renderFraseAnotadaEstatica(ex.caixa.anotado, document.getElementById('exemploAnotado'));
    btnProxima.disabled = false;
  } else if (ex.caixa && ex.caixa.sentencaAnotada) {
    renderFraseAnotadaEstatica(ex.caixa.sentencaAnotada, document.getElementById('exemploCaixaAnotada'));
    btnProxima.disabled = false;
  } else if (ex.caixa && ex.caixa.perguntasSimNao) {
    renderSimNao(ex, document.getElementById('simNaoWrap'));
  } else if (ex.caixa && ex.caixa.interativo && Array.isArray(ex.caixa.interativo.corretas)) {
    renderInterativoMultiplo(ex, ex.caixa.interativo, document.getElementById('exemploSentence'));
  } else if (ex.caixa && ex.caixa.interativo) {
    const interativo = ex.caixa.interativo;
    const jaAcertou   = ex._acertouInterativo === true;
    btnProxima.disabled = !jaAcertou;
    const wrap = document.getElementById('exemploSentence');
    // Palavras já encontradas num passo anterior (ex: o verbo, antes de
    // procurar o sujeito) aparecem travadas e destacadas, com o colchete já
    // anotado embaixo — não fazem parte da pergunta deste passo, só dão
    // contexto do que já foi descoberto.
    const marcarAntes = interativo.marcarAntes || [];
    interativo.palavras.forEach((palavra, idx) => {
      const btn = document.createElement('button');
      btn.className = 'word-chip word-chip-sm';
      btn.textContent = palavra;
      btn.style.gridColumn = String(idx + 1);
      btn.style.gridRow    = '1';
      const prefixada = marcarAntes.find(m => Array.isArray(m.idx) ? m.idx.includes(idx) : m.idx === idx);
      if (PONTUACAO_RE.test(palavra)) {
        btn.classList.add('pontuacao');
        btn.disabled = true;
      } else if (prefixada) {
        btn.disabled = true;
        btn.classList.add(`${prefixada.papel}-correto`);
      } else if (jaAcertou) {
        btn.disabled = true;
        if (idx === interativo.correta) btn.classList.add(interativo.papel ? `${interativo.papel}-correto` : 'correta');
      } else {
        btn.addEventListener('click', () => {
          if (idx === interativo.correta) {
            ex._acertouInterativo = true;
            btn.classList.add(interativo.papel ? `${interativo.papel}-correto` : 'correta');
            Array.from(wrap.children).forEach(c => c.disabled = true);
            btnProxima.disabled = false;
            if (interativo.papel) anotarPapelInterativo(wrap, interativo.intervaloAoAcertar || idx, interativo.papel);
          } else {
            btn.classList.add('errada');
            setTimeout(() => btn.classList.remove('errada'), 500);
          }
        });
      }
      wrap.appendChild(btn);
    });
    marcarAntes.forEach(m => anotarPapelInterativo(wrap, m.idx, m.papel));
    if (jaAcertou && interativo.papel) {
      anotarPapelInterativo(wrap, interativo.intervaloAoAcertar || interativo.correta, interativo.papel);
    }
  } else {
    btnProxima.disabled = false;
  }

  marcarOverflowNasFrasesAnotadas();
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// ── ÍCONES DO RESUMO ─────────────────────────────────────────
const RESUMO_ICONES = {
  acao:     cor => `<path fill="${cor}" d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>`,
  estado:   cor => `<circle cx="12" cy="5" r="2.5" fill="${cor}"/><path fill="${cor}" d="M12 9c-3 0-5 2-5 4.5V17h3v4h4v-4h3v-3.5C17 11 15 9 12 9z"/>`,
  mudanca:  cor => `<path fill="none" stroke="${cor}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  fenomeno: cor => `<path fill="${cor}" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/><line x1="8" y1="20" x2="8" y2="23" stroke="${cor}" stroke-width="2.2" stroke-linecap="round"/><line x1="12" y1="20" x2="12" y2="23" stroke="${cor}" stroke-width="2.2" stroke-linecap="round"/><line x1="16" y1="20" x2="16" y2="23" stroke="${cor}" stroke-width="2.2" stroke-linecap="round"/>`,
  infinito: cor => `<text x="13" y="17" font-size="16" font-weight="700" fill="${cor}" text-anchor="middle">∞</text>`,
  conjugar: cor => `<path fill="none" stroke="${cor}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M18.5 4.5a2.121 2.121 0 0 1 3 3L9 20l-4.5 1 1-4.5L18.5 4.5z"/>`,
  gota:     cor => `<path fill="${cor}" d="M12 2s6 7.3 6 11.5A6 6 0 0 1 6 13.5C6 9.3 12 2 12 2z"/>`,
  peca:     cor => `<path fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 0 -1 -1h-1a2 2 0 0 1 0 -4h1a1 1 0 0 0 1 -1v-3a1 1 0 0 1 1 -1"/>`,
  foguete:  cor => `<path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>`,
  sujeito:  cor => `<circle cx="12" cy="8" r="4" fill="none" stroke="${cor}" stroke-width="1.8"/><path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>`,
  fala:     cor => `<path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><circle cx="9" cy="11" r="1" fill="${cor}"/><circle cx="12" cy="11" r="1" fill="${cor}"/><circle cx="15" cy="11" r="1" fill="${cor}"/>`,
  busca:    cor => `<circle cx="11" cy="11" r="7" fill="none" stroke="${cor}" stroke-width="2.1"/><line x1="20" y1="20" x2="16" y2="16" stroke="${cor}" stroke-width="2.1" stroke-linecap="round"/>`,
  tarefa:   cor => `<rect x="5" y="4" width="12" height="16" rx="2" fill="none" stroke="${cor}" stroke-width="1.6"/><line x1="8" y1="8" x2="14" y2="8" stroke="${cor}" stroke-width="1.6" stroke-linecap="round"/><line x1="8" y1="12" x2="12" y2="12" stroke="${cor}" stroke-width="1.6" stroke-linecap="round"/><path d="M14 16l4-4 2 2-4 4h-2v-2z" fill="none" stroke="${cor}" stroke-width="1.4" stroke-linejoin="round"/>`,
  pergunta: cor => `<path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><text x="9.5" y="14" font-size="9" font-weight="700" fill="${cor}">?</text>`,
  dica:     cor => `<path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"/>`,
  predVerbal:      cor => `<path fill="none" stroke="${cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/>`,
  predNominal:     cor => `<circle cx="12" cy="12" r="8" fill="none" stroke="${cor}" stroke-width="1.8"/><line x1="8" y1="12" x2="16" y2="12" stroke="${cor}" stroke-width="1.8" stroke-linecap="round"/>`,
  predVerboNominal: cor => `<path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 17H7a5 5 0 1 1 0-10h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/>`,
  semSujeito: cor => `<line x1="-1" y1="6"  x2="2" y2="6"  stroke="${cor}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/><line x1="-1" y1="10" x2="2" y2="10" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/><line x1="-1" y1="14" x2="2" y2="14" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/><circle cx="11" cy="8" r="4" fill="none" stroke="${cor}" stroke-width="1.8"/><path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" d="M4 21v-1a6 6 0 0 1 6-6h1.5"/><circle cx="18" cy="17" r="5" fill="none" stroke="${cor}" stroke-width="1.7"/><line x1="16.1" y1="15.1" x2="19.9" y2="18.9" stroke="${cor}" stroke-width="1.7" stroke-linecap="round"/><line x1="19.9" y1="15.1" x2="16.1" y2="18.9" stroke="${cor}" stroke-width="1.7" stroke-linecap="round"/>`,
};

function mostrarInfinitivo(aula, introIdx) {
  const inf = aula.infinitivo || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="infinitivo-card">
      <div class="infinitivo-icone-wrap">
        <span class="infinitivo-icone-simbolo">∞</span>
      </div>
      <p class="infinitivo-descricao">${inf.descricao || ''}</p>
      ${inf.nota ? `<p class="infinitivo-nota">${inf.nota}</p>` : ''}
      <p class="infinitivo-conj-titulo">Normalmente, os infinitivos terminam em:</p>
      <div class="infinitivo-conjs">
        ${(inf.conjugacoes || []).map(c => `
        <div class="infinitivo-conj-card">
          <span class="infinitivo-conj-sufixo">${c.sufixo}</span>
          <span class="infinitivo-conj-label">${c.label}</span>
        </div>`).join('')}
      </div>
      ${inf.extra ? `<p class="infinitivo-extra">${inf.extra}</p>` : ''}
    </div>`;
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

function mostrarResumo(aula, introIdx) {
  const res = aula.resumo || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="resumo-card">
      <p class="resumo-titulo">${res.titulo || ''}</p>
      ${(res.itens || []).map(item => `
      <div class="resumo-item">
        <div class="resumo-icone" style="background:${item.corFundo}">
          <svg viewBox="0 0 24 24" width="26" height="26">
            ${RESUMO_ICONES[item.tipo] ? RESUMO_ICONES[item.tipo](item.cor) : ''}
          </svg>
        </div>
        <div class="resumo-item-info">
          <span class="resumo-item-titulo" style="color:${item.cor}">${item.titulo}</span>
          <span class="resumo-item-exemplos">${item.exemplos}</span>
        </div>
      </div>`).join('')}
    </div>`;
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

function mostrarLicao(aula, introIdx) {
  const lic = aula.licao || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="resumo-card">
      <p class="resumo-titulo">${lic.titulo || ''}</p>
      <div class="licao-corpo">${lic.html || ''}</div>
    </div>`;
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

function mostrarIdentificacao(aula, introIdx) {
  const idf = aula.identificacao || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="idf-card">
      <div class="idf-header">
        <div class="idf-icone-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="30" height="30">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <p class="idf-titulo">${idf.titulo || ''}</p>
      </div>
      <p class="idf-intro">${idf.intro || ''}</p>
      <div class="idf-exemplos">
        ${(idf.exemplos || []).map(e => `
        <div class="idf-exemplo-card">
          <span class="idf-palavra">${e.palavra}</span>
          <span class="idf-linha">${e.infinitivo} → terminação <strong>${e.terminacao}</strong></span>
          <span class="idf-linha">→ ${e.conjugacao}</span>
        </div>`).join('')}
      </div>
      ${idf.rodape ? `<p class="idf-rodape">${idf.rodape}</p>` : ''}
    </div>`;
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// ── CHECAGEM (pergunta rápida no meio da introdução) ─────────
// Não conta na pontuação da aula — é só um checkpoint de leitura.
// A resposta escolhida fica guardada em dados._escolhida, então
// voltar/avançar preserva o estado já respondido.
// Checagens do tipo "duplo-select" (clicar no verbo e no sujeito) guardam
// a resposta como objeto {verbo, sujeito:[]} em vez de um índice único,
// então usam dados._correta (booleano) pra saber se acertou.
function acertouChecagem(dados) {
  return (dados.sujeito || dados.banco) ? dados._correta === true : dados._escolhida === dados.correta;
}

function mostrarChecagem(aula, introIdx, dados, checagemIdx, origemAulaId = aulaId) {
  // No modo "Geral", cada item pode vir de uma aula diferente — mostra o
  // título da aula de origem, não o título genérico "Caderno de Erros — Geral".
  const origemInfo = modoErrosGeral
    ? (MODULOS || []).flatMap(m => m.aulas).find(a => String(a.id) === String(origemAulaId))
    : null;
  questaoInfo.textContent      = origemInfo ? origemInfo.titulo : aula.titulo;
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  // Ordem invertida: a pergunta curta vem primeiro (em negrito, no
  // tamanho do subtítulo) e "O que é um verbo?" vem depois, mantendo
  // o tamanho grande que já tinha.
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  feedbackBar.style.display    = '';

  const respondida = dados._escolhida !== undefined;

  // Só a primeira checagem ("O que é um verbo?") usa a ordem invertida
  // (pergunta curta em negrito antes do título grande). As demais seguem
  // o layout padrão das questões, com o verbo em destaque no subtítulo.
  // Checagens com "sentenca" (clicar na palavra) não repetem a frase como
  // subtítulo — ela já aparece como as palavras clicáveis logo abaixo.
  opcoesEl.innerHTML = marcarCartaoHtml(`checagem${checagemIdx}`) + (dados.invertido
    ? `<p class="questao-subtitulo checagem-pergunta">${dados.subtitulo || ''}</p>
       <h2 class="questao-titulo checagem-titulo">${dados.titulo || ''}</h2>`
    : `<h2 class="questao-titulo checagem-instrucao">${dados.titulo || ''}</h2>` +
      ((dados.sentenca || dados.banco) ? '' : `<p class="questao-subtitulo checagem-frase">${dados.subtitulo || ''}</p>`)) +
    (dados.predicado ? '<div class="tri-select-wrap" id="triSelectWrap"></div>'
      : dados.sujeito ? '<div class="dual-select-wrap" id="dualSelectWrap"></div>'
      : dados.banco ? '<div class="reordenar-wrap" id="reordenarWrap"></div>'
      : dados.sentenca ? '<div class="sentence-display" id="sentenceDisplay"></div>' : '');
  ativarBotaoMarcar();

  if (dados.predicado) {
    mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, respondida);
  } else if (dados.sujeito) {
    mostrarChecagemDupla(aula, introIdx, dados, checagemIdx, origemAulaId, respondida);
  } else if (dados.banco) {
    mostrarChecagemReordenar(aula, introIdx, dados, checagemIdx, origemAulaId, respondida);
  } else if (dados.sentenca) {
    const wrap = document.getElementById('sentenceDisplay');
    const PONTUACAO = /^[.,!?;:]+$/;
    dados.sentenca.forEach((palavra, i) => {
      const ehPontuacao = PONTUACAO.test(palavra);
      const btn = document.createElement('button');
      btn.className = 'word-chip' + (ehPontuacao ? ' pontuacao' : '');
      btn.textContent = palavra;
      if (ehPontuacao) {
        btn.disabled = true;
      } else if (respondida) {
        btn.disabled = true;
        if (i === dados.correta)                                btn.classList.add('correta');
        else if (i === dados._escolhida && i !== dados.correta) btn.classList.add('errada');
      } else {
        btn.addEventListener('click', () => {
          dados._escolhida = i;
          if (i !== dados.correta) {
            addErro(origemAulaId, `checagem${checagemIdx}`);
            erroNestaSessao = true;
          }
          mostrarChecagem(aula, introIdx, dados, checagemIdx, origemAulaId);
        });
      }
      wrap.appendChild(btn);
    });

    // Depois de responder, mostra a classe gramatical de cada palavra da
    // frase (o verbo em verde, a escolha errada em vermelho, se houver).
    if (respondida && dados.classes) {
      const acertou = dados._escolhida === dados.correta;
      const linhas = dados.sentenca.map((palavra, i) => {
        if (PONTUACAO.test(palavra)) return '';
        const info = dados.classes[i] || {};
        const ehVerbo   = i === dados.correta;
        const ehErrada  = !acertou && i === dados._escolhida;
        const classe    = ehVerbo ? 'correta' : (ehErrada ? 'errada' : '');
        return `
          <div class="checagem-resultado-item${ehErrada ? ' errada-selecionada' : ''}">
            <span class="cri-palavra ${classe}">${palavra}</span>
            <span class="cri-seta">→</span>
            <span class="cri-classe ${classe}">${info.classe || ''}</span>
            ${ehVerbo  ? '<span class="cri-icone" style="color:#16a34a">✓</span>' : ''}
            ${ehErrada ? '<span class="cri-icone" style="color:#dc2626">✕</span>' : ''}
          </div>`;
      }).join('');
      opcoesEl.insertAdjacentHTML('beforeend', `
        <div class="checagem-resultado-itens">
          <p class="checagem-resultado-titulo">Resposta de cada item:</p>
          <div class="checagem-resultado-lista">${linhas}</div>
        </div>`);
    }
  } else {
    (dados.opcoes || []).forEach((texto, i) => {
      const btn = document.createElement('button');
      btn.className = 'opcao';
      if (respondida) {
        btn.disabled = true;
        if (i === dados.correta)                                btn.classList.add('correta');
        else if (i === dados._escolhida && i !== dados.correta) btn.classList.add('errada');
      } else {
        btn.addEventListener('click', () => {
          dados._escolhida = i;
          if (i !== dados.correta) {
            addErro(origemAulaId, `checagem${checagemIdx}`);
            erroNestaSessao = true;
          }
          mostrarChecagem(aula, introIdx, dados, checagemIdx, origemAulaId);
        });
      }
      btn.innerHTML = `<span class="letra">${LETRAS[i]}</span><span class="opcao-texto">${texto}</span>`;
      opcoesEl.appendChild(btn);
    });
  }

  if (respondida) {
    const acertou = acertouChecagem(dados);
    feedbackBar.className     = `feedback-bar show ${acertou ? 'acerto' : 'erro'}`;
    feedbackIcon.textContent  = acertou ? '✅' : '❌';
    const letraCorreta        = (dados.sentenca || dados.sujeito || dados.banco) ? null : LETRAS[dados.correta];
    feedbackTexto.innerHTML   = montarFeedbackHtml(acertou, dados.feedback, letraCorreta);
  } else {
    feedbackBar.className = 'feedback-bar';
  }

  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = !respondida;
  marcarOverflowNasFrasesAnotadas();
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// Checagem "clique no verbo e no sujeito" — duas seleções (verbo + sujeito,
// podendo ter mais de uma palavra) antes de confirmar. Não conta como
// respondida até clicar em "Confirmar resposta".
const PONTUACAO_RE = /^[.,!?;:]+$/;

function mostrarChecagemDupla(aula, introIdx, dados, checagemIdx, origemAulaId, respondida) {
  const wrap = document.getElementById('dualSelectWrap');
  const N = dados.sentenca.length;

  if (!respondida) {
    if (!dados._pendente) dados._pendente = { modo: 'verbo', verboIdx: null, sujeitoIdxs: [] };
    const { modo, verboIdx, sujeitoIdxs } = dados._pendente;
    const podeConfirmar = verboIdx !== null && sujeitoIdxs.length > 0;

    wrap.innerHTML = `
      <div class="modo-toggle">
        <button type="button" class="modo-btn${modo === 'verbo' ? ' ativo-verbo' : ''}" id="modoVerboBtn">
          <span class="modo-dot modo-dot-verbo"></span> VERBO
        </button>
        <button type="button" class="modo-btn${modo === 'sujeito' ? ' ativo-sujeito' : ''}" id="modoSujeitoBtn">
          <span class="modo-dot modo-dot-sujeito"></span> SUJEITO
        </button>
      </div>
      <div class="frase-anotada-wrap"><div class="frase-anotada" id="fraseAnotada" style="grid-template-columns:repeat(${N},auto)"></div></div>
      <button type="button" class="btn-confirmar-duplo" id="btnConfirmarDuplo"${podeConfirmar ? '' : ' disabled'}>Confirmar resposta</button>`;

    const grid = document.getElementById('fraseAnotada');
    dados.sentenca.forEach((palavra, i) => {
      const ehPontuacao = PONTUACAO_RE.test(palavra);
      const btn = document.createElement('button');
      let cls = 'word-chip';
      if (ehPontuacao)                     cls += ' pontuacao';
      else if (i === verboIdx)             cls += ' verbo-pendente';
      else if (sujeitoIdxs.includes(i))    cls += ' sujeito-pendente';
      btn.className = cls;
      btn.textContent = palavra;
      btn.style.gridColumn = String(i + 1);
      btn.style.gridRow = '1';
      if (ehPontuacao) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          const p = dados._pendente;
          if (p.modo === 'verbo') {
            if (p.verboIdx === i) {
              p.verboIdx = null;
            } else {
              p.verboIdx = i;
              p.sujeitoIdxs = p.sujeitoIdxs.filter(x => x !== i);
              p.modo = 'sujeito';
            }
          } else {
            if (i === p.verboIdx) return;
            const idx = p.sujeitoIdxs.indexOf(i);
            if (idx === -1) p.sujeitoIdxs.push(i); else p.sujeitoIdxs.splice(idx, 1);
          }
          mostrarChecagemDupla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
        });
      }
      grid.appendChild(btn);
    });

    if (verboIdx !== null) anotarPapelInterativo(grid, verboIdx, 'verbo');
    if (sujeitoIdxs.length > 0) anotarPapelInterativo(grid, sujeitoIdxs, 'sujeito');

    document.getElementById('modoVerboBtn').addEventListener('click', () => {
      dados._pendente.modo = 'verbo';
      mostrarChecagemDupla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
    });
    document.getElementById('modoSujeitoBtn').addEventListener('click', () => {
      dados._pendente.modo = 'sujeito';
      mostrarChecagemDupla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
    });
    if (podeConfirmar) {
      document.getElementById('btnConfirmarDuplo').addEventListener('click', () => {
        const verboCorreto   = dados._pendente.verboIdx === dados.verbo;
        const sujeitoCorreto = dados._pendente.sujeitoIdxs.length === dados.sujeito.length &&
                                dados.sujeito.every(i => dados._pendente.sujeitoIdxs.includes(i));
        const acertou = verboCorreto && sujeitoCorreto;
        dados._escolhida = { verbo: dados._pendente.verboIdx, sujeito: [...dados._pendente.sujeitoIdxs] };
        dados._correta   = acertou;
        if (!acertou) {
          addErro(origemAulaId, `checagem${checagemIdx}`);
          erroNestaSessao = true;
        }
        mostrarChecagem(aula, introIdx, dados, checagemIdx, origemAulaId);
      });
    }
    marcarOverflowNasFrasesAnotadas();
    return;
  }

  // Já respondida — mostra o resultado com a chave verbo/sujeito.
  wrap.innerHTML = `<div class="frase-anotada-wrap"><div class="frase-anotada" id="fraseAnotada" style="grid-template-columns:repeat(${N},auto)"></div></div>`;
  const grid = document.getElementById('fraseAnotada');
  const escolhida = dados._escolhida;
  dados.sentenca.forEach((palavra, i) => {
    const ehPontuacao = PONTUACAO_RE.test(palavra);
    const btn = document.createElement('button');
    let cls = 'word-chip';
    if (ehPontuacao) {
      cls += ' pontuacao';
    } else {
      const ehVerboCorreto   = i === dados.verbo;
      const ehSujeitoCorreto = dados.sujeito.includes(i);
      const foiVerbo         = i === escolhida.verbo;
      const foiSujeito       = escolhida.sujeito.includes(i);
      if      (ehVerboCorreto)                  cls += ' verbo-correto';
      else if (ehSujeitoCorreto)                cls += ' sujeito-correto';
      else if (foiVerbo && !ehVerboCorreto)     cls += ' verbo-errado';
      else if (foiSujeito && !ehSujeitoCorreto) cls += ' sujeito-errado';
    }
    btn.className = cls;
    btn.textContent = palavra;
    btn.disabled = true;
    btn.style.gridColumn = String(i + 1);
    btn.style.gridRow = '1';
    grid.appendChild(btn);
  });
  anotarPapelInterativo(grid, dados.verbo, 'verbo');
  anotarPapelInterativo(grid, dados.sujeito, 'sujeito');

  const linhas = dados.sentenca.map((palavra, i) => {
    if (PONTUACAO_RE.test(palavra)) return '';
    const ehVerbo   = i === dados.verbo;
    const ehSujeito = dados.sujeito.includes(i);
    const classe    = (ehVerbo || ehSujeito) ? 'correta' : '';
    const papel     = ehVerbo ? 'Verbo' : ehSujeito ? 'Sujeito' : '—';
    return `
      <div class="checagem-resultado-item">
        <span class="cri-palavra ${classe}">${palavra}</span>
        <span class="cri-seta">→</span>
        <span class="cri-classe ${classe}">${papel}</span>
        ${(ehVerbo || ehSujeito) ? '<span class="cri-icone" style="color:#16a34a">✓</span>' : ''}
      </div>`;
  }).join('');
  wrap.insertAdjacentHTML('beforeend', `
    <div class="checagem-resultado-itens">
      <p class="checagem-resultado-titulo">Resposta de cada item:</p>
      <div class="checagem-resultado-lista">${linhas}</div>
    </div>`);
  marcarOverflowNasFrasesAnotadas();
}

// Checagem "clique no verbo, no sujeito e no predicado" — três seleções
// (verbo, sujeito, predicado) em vez das duas do duplo-select. O predicado
// inclui o verbo (seu núcleo): clicar nele de novo, já em modo "predicado",
// confirma que ele também faz parte do predicado.
function mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, respondida) {
  const wrap = document.getElementById('triSelectWrap');
  const N = dados.sentenca.length;

  if (!respondida) {
    if (!dados._pendente) {
      dados._pendente = { modo: 'verbo', verboIdx: null, sujeitoIdxs: [], predicadoIdxs: [], predicadoConfirmado: false, semSujeito: false };
    }
    const p = dados._pendente;
    const podeConfirmar = p.verboIdx !== null && (p.sujeitoIdxs.length > 0 || p.semSujeito);

    wrap.innerHTML = `
      <div class="modo-toggle">
        <button type="button" class="modo-btn${p.modo === 'verbo' ? ' ativo-verbo' : ''}" id="modoVerboBtn">
          <span class="modo-dot modo-dot-verbo"></span> VERBO
        </button>
        <button type="button" class="modo-btn${p.modo === 'sujeito' ? ' ativo-sujeito' : ''}" id="modoSujeitoBtn">
          <span class="modo-dot modo-dot-sujeito"></span> SUJEITO
        </button>
        <button type="button" class="modo-btn${p.modo === 'predicado' ? ' ativo-predicado' : ''}" id="modoPredicadoBtn">
          <span class="modo-dot modo-dot-predicado"></span> PREDICADO
        </button>
      </div>
      <button type="button" class="modo-sem-sujeito-btn${p.semSujeito ? ' ativo' : ''}" id="btnSemSujeitoTripla">
        <span class="sem-sujeito-icone">⊘</span> Oração sem sujeito
      </button>
      <div class="frase-anotada-wrap"><div class="frase-anotada" id="fraseAnotadaTri" style="grid-template-columns:repeat(${N},auto)"></div></div>
      <button type="button" class="btn-confirmar-duplo" id="btnConfirmarTripla"${podeConfirmar ? '' : ' disabled'}>Confirmar resposta</button>`;

    const grid = document.getElementById('fraseAnotadaTri');
    dados.sentenca.forEach((palavra, i) => {
      const ehPontuacao = PONTUACAO_RE.test(palavra);
      const btn = document.createElement('button');
      let cls = 'word-chip';
      if (ehPontuacao) {
        cls += ' pontuacao';
      } else if (i === p.verboIdx) {
        cls += (p.modo === 'predicado' && p.predicadoConfirmado) ? ' predicado-pendente' : ' verbo-pendente';
      } else if (p.sujeitoIdxs.includes(i)) {
        cls += ' sujeito-pendente';
      } else if (p.predicadoIdxs.includes(i)) {
        cls += ' predicado-pendente';
      }
      btn.className = cls;
      btn.textContent = palavra;
      btn.style.gridColumn = String(i + 1);
      btn.style.gridRow = '1';
      if (ehPontuacao) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          if (p.modo === 'verbo') {
            if (p.verboIdx === i) {
              p.predicadoIdxs      = [];
              p.predicadoConfirmado = false;
              p.verboIdx = null;
            } else {
              p.sujeitoIdxs         = p.sujeitoIdxs.filter(x => x !== i);
              p.predicadoIdxs       = [];
              p.predicadoConfirmado = false;
              p.verboIdx = i;
              p.modo     = 'sujeito';
            }
          } else if (p.modo === 'sujeito') {
            if (i === p.verboIdx) return;
            p.semSujeito    = false;
            p.predicadoIdxs = p.predicadoIdxs.filter(x => x !== i);
            const idx = p.sujeitoIdxs.indexOf(i);
            if (idx === -1) p.sujeitoIdxs.push(i); else p.sujeitoIdxs.splice(idx, 1);
          } else {
            if (i === p.verboIdx) {
              p.predicadoConfirmado = true;
              if (!p.predicadoIdxs.includes(i)) p.predicadoIdxs.push(i);
            } else {
              if (p.sujeitoIdxs.includes(i)) return;
              const idx = p.predicadoIdxs.indexOf(i);
              if (idx === -1) p.predicadoIdxs.push(i); else p.predicadoIdxs.splice(idx, 1);
            }
          }
          mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
        });
      }
      grid.appendChild(btn);
    });

    if (p.sujeitoIdxs.length > 0) anotarPapelInterativo(grid, p.sujeitoIdxs, 'sujeito');
    if (p.verboIdx !== null) anotarPapelInterativo(grid, p.verboIdx, 'verbo');
    if ((p.predicadoConfirmado || p.predicadoIdxs.some(i => i !== p.verboIdx)) && p.predicadoIdxs.length > 0) {
      anotarPapelInterativo(grid, p.predicadoIdxs, 'predicado');
    }

    document.getElementById('modoVerboBtn').addEventListener('click', () => {
      dados._pendente.modo = 'verbo';
      mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
    });
    document.getElementById('modoSujeitoBtn').addEventListener('click', () => {
      dados._pendente.modo = 'sujeito';
      mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
    });
    document.getElementById('modoPredicadoBtn').addEventListener('click', () => {
      dados._pendente.modo = 'predicado';
      mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
    });
    // "Oração sem sujeito" — declaração explícita do aluno de que a frase não
    // tem sujeito (necessário pra liberar o "Confirmar resposta" nesses casos,
    // já que sem isso não dava pra confirmar sem marcar nenhuma palavra como
    // sujeito). Marcar uma palavra como sujeito desfaz essa declaração.
    document.getElementById('btnSemSujeitoTripla').addEventListener('click', () => {
      p.semSujeito = !p.semSujeito;
      if (p.semSujeito) p.sujeitoIdxs = [];
      mostrarChecagemTripla(aula, introIdx, dados, checagemIdx, origemAulaId, false);
    });
    if (podeConfirmar) {
      document.getElementById('btnConfirmarTripla').addEventListener('click', () => {
        const verboCorreto     = p.verboIdx === dados.verbo;
        const sujeitoCorreto   = dados.sujeito.length === 0
          ? (p.semSujeito && p.sujeitoIdxs.length === 0)
          : (!p.semSujeito && p.sujeitoIdxs.length === dados.sujeito.length &&
             dados.sujeito.every(i => p.sujeitoIdxs.includes(i)));
        const predicadoCorreto = p.predicadoIdxs.length === dados.predicado.length &&
                                  dados.predicado.every(i => p.predicadoIdxs.includes(i));
        const acertou = verboCorreto && sujeitoCorreto && predicadoCorreto;
        dados._escolhida = { verbo: p.verboIdx, sujeito: [...p.sujeitoIdxs], predicado: [...p.predicadoIdxs], semSujeito: p.semSujeito };
        dados._correta   = acertou;
        if (!acertou) {
          addErro(origemAulaId, `checagem${checagemIdx}`);
          erroNestaSessao = true;
        }
        mostrarChecagem(aula, introIdx, dados, checagemIdx, origemAulaId);
      });
    }
    marcarOverflowNasFrasesAnotadas();
    return;
  }

  // Já respondida — mostra o resultado com a chave sujeito/verbo/predicado.
  wrap.innerHTML = `<div class="frase-anotada-wrap"><div class="frase-anotada" id="fraseAnotadaTri" style="grid-template-columns:repeat(${N},auto)"></div></div>`;
  const grid = document.getElementById('fraseAnotadaTri');
  const escolhida = dados._escolhida;
  dados.sentenca.forEach((palavra, i) => {
    const ehPontuacao = PONTUACAO_RE.test(palavra);
    const btn = document.createElement('button');
    let cls = 'word-chip';
    if (ehPontuacao) {
      cls += ' pontuacao';
    } else {
      const ehVerboCorreto     = i === dados.verbo;
      const ehSujeitoCorreto   = dados.sujeito.includes(i);
      const ehPredicadoCorreto = dados.predicado.includes(i);
      const foiVerbo           = i === escolhida.verbo;
      const foiSujeito         = escolhida.sujeito.includes(i);
      const foiPredicado       = escolhida.predicado.includes(i);
      if      (ehVerboCorreto)                      cls += ' verbo-correto';
      else if (ehSujeitoCorreto)                    cls += ' sujeito-correto';
      else if (ehPredicadoCorreto)                  cls += ' predicado-correto';
      else if (foiVerbo && !ehVerboCorreto)         cls += ' verbo-errado';
      else if (foiSujeito && !ehSujeitoCorreto)     cls += ' sujeito-errado';
      else if (foiPredicado && !ehPredicadoCorreto) cls += ' predicado-errado';
    }
    btn.className = cls;
    btn.textContent = palavra;
    btn.disabled = true;
    btn.style.gridColumn = String(i + 1);
    btn.style.gridRow = '1';
    grid.appendChild(btn);
  });

  if (dados.sujeito.length > 0) anotarPapelInterativo(grid, dados.sujeito, 'sujeito');
  anotarPapelInterativo(grid, dados.verbo, 'verbo');
  anotarPapelInterativo(grid, dados.predicado, 'predicado');

  const linhas = dados.sentenca.map((palavra, i) => {
    if (PONTUACAO_RE.test(palavra)) return '';
    const ehVerbo     = i === dados.verbo;
    const ehSujeito   = dados.sujeito.includes(i);
    const ehPredicado = dados.predicado.includes(i) && !ehVerbo;
    const classe = (ehVerbo || ehSujeito || ehPredicado) ? 'correta' : '';
    const papel  = ehVerbo ? 'Verbo' : ehSujeito ? 'Sujeito' : ehPredicado ? 'Predicado' : '—';
    return `
      <div class="checagem-resultado-item">
        <span class="cri-palavra ${classe}">${palavra}</span>
        <span class="cri-seta">→</span>
        <span class="cri-classe ${classe}">${papel}</span>
        ${(ehVerbo || ehSujeito || ehPredicado) ? '<span class="cri-icone" style="color:#16a34a">✓</span>' : ''}
      </div>`;
  }).join('');
  wrap.insertAdjacentHTML('beforeend', `
    <div class="checagem-resultado-itens">
      <p class="checagem-resultado-titulo">Resposta de cada item:</p>
      <div class="checagem-resultado-lista">${linhas}</div>
    </div>`);
  marcarOverflowNasFrasesAnotadas();
}

// Checagem "reescreva na ordem direta" — a frase original (ordem inversa)
// fica fixa no topo só de referência; embaixo, um banco de palavras
// embaralhadas (dados.banco) que a pessoa clica em ordem pra ir montando a
// resposta numa caixa no meio. dados.ordemCorreta guarda a ordem certa como
// índices em dados.banco (não pelo texto, pra lidar com palavras repetidas).
function mostrarChecagemReordenar(aula, introIdx, dados, checagemIdx, origemAulaId, respondida) {
  const wrap = document.getElementById('reordenarWrap');

  if (!respondida) {
    if (!dados._pendente) dados._pendente = { escolhidos: [] };
    const p = dados._pendente;
    const podeConfirmar = p.escolhidos.length === dados.banco.length;

    wrap.innerHTML = `
      <div class="reordenar-referencia">
        <p class="reordenar-referencia-label">Frase original:</p>
        <p class="reordenar-referencia-texto">${dados.referencia.join(' ')}</p>
      </div>
      <div class="reordenar-resposta" id="reordenarResposta"></div>
      <div class="reordenar-banco" id="reordenarBanco"></div>
      <button type="button" class="btn-confirmar-duplo" id="btnConfirmarReordenar"${podeConfirmar ? '' : ' disabled'}>Confirmar resposta</button>`;

    const respostaEl = document.getElementById('reordenarResposta');
    const bancoEl     = document.getElementById('reordenarBanco');

    p.escolhidos.forEach(bancoIdx => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'word-chip';
      btn.textContent = dados.banco[bancoIdx];
      btn.addEventListener('click', () => {
        p.escolhidos = p.escolhidos.filter(i => i !== bancoIdx);
        mostrarChecagemReordenar(aula, introIdx, dados, checagemIdx, origemAulaId, false);
      });
      respostaEl.appendChild(btn);
    });

    dados.banco.forEach((palavra, i) => {
      const jaEscolhida = p.escolhidos.includes(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'word-chip';
      btn.textContent = palavra;
      btn.disabled = jaEscolhida;
      if (!jaEscolhida) {
        btn.addEventListener('click', () => {
          p.escolhidos.push(i);
          mostrarChecagemReordenar(aula, introIdx, dados, checagemIdx, origemAulaId, false);
        });
      }
      bancoEl.appendChild(btn);
    });

    if (podeConfirmar) {
      document.getElementById('btnConfirmarReordenar').addEventListener('click', () => {
        const acertou = p.escolhidos.every((idx, pos) => idx === dados.ordemCorreta[pos]);
        dados._escolhida = [...p.escolhidos];
        dados._correta   = acertou;
        if (!acertou) {
          addErro(origemAulaId, `checagem${checagemIdx}`);
          erroNestaSessao = true;
        }
        mostrarChecagem(aula, introIdx, dados, checagemIdx, origemAulaId);
      });
    }
    return;
  }

  // Já respondida — mostra a resposta dada e, se errou, a ordem certa.
  const acertou = dados._correta === true;
  wrap.innerHTML = `
    <div class="reordenar-referencia">
      <p class="reordenar-referencia-label">Frase original:</p>
      <p class="reordenar-referencia-texto">${dados.referencia.join(' ')}</p>
    </div>
    <p class="reordenar-referencia-label">Sua resposta:</p>
    <div class="reordenar-resposta reordenar-resposta-final">
      ${dados._escolhida.map((bancoIdx, pos) => {
        const certa = dados.ordemCorreta[pos] === bancoIdx;
        return `<span class="word-chip ${certa ? 'correta' : 'errada'}">${dados.banco[bancoIdx]}</span>`;
      }).join('')}
    </div>
    ${!acertou ? `
    <p class="reordenar-referencia-label">Ordem correta:</p>
    <div class="reordenar-resposta reordenar-resposta-final">
      ${dados.ordemCorreta.map(bancoIdx => `<span class="word-chip correta">${dados.banco[bancoIdx]}</span>`).join('')}
    </div>` : ''}`;
}

function mostrarSentido(aula, introIdx) {
  const s = aula.sentido || {};
  questaoInfo.textContent      = aula.titulo;
  feedbackBar.style.display    = 'none';
  btnAnterior.style.display    = '';
  renderIntroSegs(introIdx - 1);
  questaoTitulo.innerHTML      = '';
  questaoSubtitulo.textContent = '';
  opcoesEl.innerHTML = `
    <div class="sentido-card">
      <div class="sentido-dica">
        <span class="sentido-dica-icone">💡</span>
        <p>${s.dica || ''}</p>
      </div>
      ${(s.textos || []).map(t => `<p class="sentido-texto">${t}</p>`).join('')}
      <p class="sentido-exemplos-titulo">${s.exemplos?.titulo || ''}</p>
      <div class="sentido-exemplos">
        ${(s.exemplos?.itens || []).map(item => `
        <div class="sentido-item">
          <div class="resumo-icone" style="background:${item.corFundo}">
            <svg viewBox="0 0 24 24" width="26" height="26">
              ${RESUMO_ICONES[item.tipo] ? RESUMO_ICONES[item.tipo](item.cor) : ''}
            </svg>
          </div>
          <div class="sentido-item-texto">
            <p class="sentido-item-frase">${item.frase}</p>
            <p class="sentido-item-cadeia">${item.cadeia}</p>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  btnProxima.innerHTML = 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  btnProxima.disabled  = false;
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// ── RENDERIZAR QUESTÃO ───────────────────────────────────────
function renderQuestao(aula) {
  const questoes = aula.questoes;
  const q        = questoes[estado.atual];
  const idx      = estado.atual;
  const total    = questoes.length;

  // Header
  questaoInfo.textContent = `Questão ${idx + 1} de ${total} • ${aula.titulo}`;

  // Segmentos de progresso
  progressSegs.innerHTML = '';
  questoes.forEach((_, i) => {
    const seg = document.createElement('div');
    seg.className = 'seg';
    if (estado.respostas[i] !== null) seg.classList.add('respondida');
    else if (i === idx)               seg.classList.add('atual');
    progressSegs.appendChild(seg);
  });

  // Enunciado
  questaoTitulo.textContent = q.titulo;
  questaoSubtitulo.innerHTML = q.subtitulo;

  // Opções
  opcoesEl.innerHTML = '';
  const respostaDada = estado.respostas[idx];

  q.opcoes.forEach((texto, i) => {
    const btn = document.createElement('button');
    btn.className = 'opcao';

    if (respostaDada !== null) {
      btn.disabled = true;
      if (i === q.correta)                              btn.classList.add('correta');
      else if (i === respostaDada && i !== q.correta)   btn.classList.add('errada');
    }

    btn.innerHTML = `<span class="letra">${LETRAS[i]}</span><span class="opcao-texto">${texto}</span>`;

    if (respostaDada === null) {
      btn.addEventListener('click', () => {
        responder(i, aula);
      });
    }
    opcoesEl.appendChild(btn);
  });

  // Feedback
  if (respostaDada !== null) {
    const acertou = respostaDada === q.correta;
    feedbackBar.className     = `feedback-bar show ${acertou ? 'acerto' : 'erro'}`;
    feedbackIcon.textContent  = acertou ? '✅' : '❌';
    feedbackTexto.innerHTML   = montarFeedbackHtml(acertou, q.feedback, LETRAS[q.correta]);
  } else {
    feedbackBar.className = 'feedback-bar';
  }

  // Botões de navegação
  btnAnterior.disabled = idx === 0;

  const todasRespondidas = estado.respostas.every(r => r !== null);
  if (idx === total - 1) {
    btnProxima.innerHTML  = 'Concluir ✓';
    btnProxima.disabled   = !todasRespondidas;
  } else {
    btnProxima.innerHTML  = `Próxima <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    btnProxima.disabled   = respostaDada === null;
  }
  questaoArea.scrollTop = 0;
  atualizarScrollFade();
}

// ── RESPONDER ────────────────────────────────────────────────
function responder(opcaoIdx, aula) {
  if (estado.respostas[estado.atual] !== null) return;
  estado.respostas[estado.atual] = opcaoIdx;

  // Errou → vai para o caderno de erros e não sai mais de lá, mesmo se acertar depois.
  const q = aula.questoes[estado.atual];
  if (opcaoIdx !== q.correta) {
    addErro(aulaId, estado.origIdx[estado.atual]);
    erroNestaSessao = true;
  }

  renderQuestao(aula);
}

// ── REVISÃO (repete só as questões erradas até acertar tudo) ─
// Regra vale para qualquer aula, pois vive aqui no controller genérico,
// não no arquivo de dados de cada aula.
let aguardandoRevisao   = false;
let idxsRevisaoPendente = [];
let aguardandoReinicio  = false;

// Marca se errou algo nesta visita à aula (mesmo já tendo concluído antes) —
// usado para mandar direto pro Caderno de Erros ao sair, em vez do Início.
let erroNestaSessao = false;

function mostrarRevisao(idxsErrados) {
  aguardandoRevisao   = true;
  idxsRevisaoPendente = idxsErrados;
  const n = idxsErrados.length;
  document.getElementById('resultadoEmoji').textContent    = '🔄';
  document.getElementById('resultadoTitulo').textContent   = 'Vamos revisar!';
  document.getElementById('resultadoDesc').textContent     = `Você errou ${n} ${n !== 1 ? 'questões' : 'questão'}. Responda de novo até acertar tudo para concluir a aula.`;
  document.getElementById('resultadoEstrelas').textContent = '';
  document.getElementById('resultadoBtnContinuar').textContent = 'Revisar agora';
  document.getElementById('resultadoOverlay').classList.add('show');
}

// Errou tudo na rodada — a lição inteira não ficou clara, volta pro início
// da aula (telas de introdução) em vez de só repetir as mesmas questões.
function mostrarReinicio() {
  aguardandoReinicio = true;
  document.getElementById('resultadoEmoji').textContent    = '📚';
  document.getElementById('resultadoTitulo').textContent   = 'Vamos rever a aula';
  document.getElementById('resultadoDesc').textContent     = 'Você errou todas as questões. Vamos revisar a aula desde o início antes de tentar de novo.';
  document.getElementById('resultadoEstrelas').textContent = '';
  document.getElementById('resultadoBtnContinuar').textContent = 'Rever a aula';
  document.getElementById('resultadoOverlay').classList.add('show');
}

// ── MESMA REGRA PARA AS CHECAGENS ─────────────────────────────
// Enquanto as questões pontuadas estiverem desativadas, as checagens são
// "as questões" da aula — então valem as mesmas regras de revisão/reinício.
let aguardandoRevisaoChecagem = false;
let checagemRevisaoPendente   = [];

function mostrarRevisaoChecagem(itens) {
  aguardandoRevisaoChecagem = true;
  checagemRevisaoPendente   = itens;
  const n = itens.length;
  document.getElementById('resultadoEmoji').textContent    = '🔄';
  document.getElementById('resultadoTitulo').textContent   = 'Vamos revisar!';
  document.getElementById('resultadoDesc').textContent     = `Você errou ${n} ${n !== 1 ? 'questões' : 'questão'}. Responda de novo até acertar tudo para concluir a aula.`;
  document.getElementById('resultadoEstrelas').textContent = '';
  document.getElementById('resultadoBtnContinuar').textContent = 'Revisar agora';
  document.getElementById('resultadoOverlay').classList.add('show');
}

// Se a aula concluída é a última da sua Etapa, a celebração é pelo módulo
// inteiro (não só pela aula) — e o próximo nível é liberado no Início.
function infoEtapaDaAula() {
  const etapa = (MODULOS || []).find(m => m.aulas.some(a => a.id === parseInt(aulaId)));
  if (!etapa) return null;
  const ehUltima = etapa.aulas[etapa.aulas.length - 1].id === parseInt(aulaId);
  return { etapa, ehUltima };
}

function mostrarFinalizadoChecagem() {
  // Tentativa do Simulado terminou com 100% de acerto — limpa a semente do
  // sorteio pra próxima vez montar um conjunto novo (ver montarSimulado).
  if (aulaEhSimulado) limparSimuladoSeed();

  const infoEtapa = infoEtapaDaAula();
  if (infoEtapa && infoEtapa.ehUltima) {
    document.getElementById('resultadoEmoji').textContent    = '🏆';
    document.getElementById('resultadoTitulo').textContent   = 'Parabéns!';
    document.getElementById('resultadoDesc').textContent     = `Você concluiu o módulo "${infoEtapa.etapa.titulo}" com 100% de acerto! Um novo nível foi liberado.`;
  } else {
    document.getElementById('resultadoEmoji').textContent    = '🎉';
    document.getElementById('resultadoTitulo').textContent   = 'Excelente!';
    document.getElementById('resultadoDesc').textContent     = 'Você completou a aula com 100% de acerto!';
  }
  document.getElementById('resultadoEstrelas').textContent = '★★★';
  document.getElementById('resultadoBtnContinuar').textContent = 'Voltar ao início';
  document.getElementById('resultadoOverlay').classList.add('show');
  sessionStorage.setItem(`aula${aulaId}_resultado`, JSON.stringify({
    aulaId: parseInt(aulaId), estrelas: 3, acertos: 1, total: 1,
  }));
}

// Praticando só os erros do caderno de erros (não a aula inteira) —
// termina sem estrelas nem desbloquear a próxima aula.
function mostrarPraticaConcluidaChecagem() {
  document.getElementById('resultadoEmoji').textContent    = '📓';
  document.getElementById('resultadoTitulo').textContent   = 'Prática concluída!';
  document.getElementById('resultadoDesc').textContent     = 'Você acertou todas as questões revisadas.';
  document.getElementById('resultadoEstrelas').textContent = '';
  document.getElementById('resultadoBtnContinuar').textContent = 'Voltar ao início';
  document.getElementById('resultadoOverlay').classList.add('show');
}

// ── RESULTADO ────────────────────────────────────────────────
function mostrarResultado(aula) {
  const questoes = aula.questoes;
  const acertos  = estado.respostas.filter((r, i) => r === questoes[i].correta).length;

  if (modoErros) {
    document.getElementById('resultadoEmoji').textContent   = '📓';
    document.getElementById('resultadoTitulo').textContent  = 'Prática concluída!';
    document.getElementById('resultadoDesc').textContent    = `Você acertou ${acertos} de ${questoes.length} questões revisadas. As questões erradas continuam no caderno de erros para você revisar de novo.`;
    document.getElementById('resultadoEstrelas').textContent = '';
    document.getElementById('resultadoOverlay').classList.add('show');
    return;
  }

  // Só chega aqui depois de acertar 100% da rodada (a última, após as
  // revisões necessárias) — por isso sempre fecha com as 3 estrelas.
  const total = estado.totalOriginal || questoes.length;
  const infoEtapa = infoEtapaDaAula();
  if (infoEtapa && infoEtapa.ehUltima) {
    document.getElementById('resultadoEmoji').textContent  = '🏆';
    document.getElementById('resultadoTitulo').textContent = 'Parabéns!';
    document.getElementById('resultadoDesc').textContent   = `Você concluiu o módulo "${infoEtapa.etapa.titulo}" com 100% de acerto! Um novo nível foi liberado.`;
  } else {
    document.getElementById('resultadoEmoji').textContent  = '🎉';
    document.getElementById('resultadoTitulo').textContent = 'Excelente!';
    document.getElementById('resultadoDesc').textContent   = `Você completou as ${total} questões da aula com 100% de acerto!`;
  }
  document.getElementById('resultadoEstrelas').textContent = '★★★';
  document.getElementById('resultadoOverlay').classList.add('show');

  // Passa resultado para index.html via sessionStorage
  sessionStorage.setItem(`aula${aulaId}_resultado`, JSON.stringify({
    aulaId:   parseInt(aulaId),
    estrelas: 3,
    acertos:  total,
    total,
  }));
}

// ── LIÇÃO (modal) ────────────────────────────────────────────
function abrirLicao(aula) {
  const el = document.getElementById('licaoHeader');
  if (el) el.textContent = aula.licao.titulo;
  const corpo = document.getElementById('licaoCorpo');
  if (corpo) corpo.innerHTML = aula.licao.html;
  document.getElementById('licaoOverlay').classList.add('show');
}

// Embaralha uma cópia do array (Fisher-Yates) — não mexe no original. Usa
// `rand` (0-1) como fonte de aleatoriedade; por padrão Math.random(), mas o
// Simulado passa um gerador com semente fixa (ver montarSimulado) pra poder
// repetir o mesmo sorteio entre recarregamentos da mesma tentativa.
function embaralhar(lista, rand = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Gerador pseudoaleatório simples e determinístico (mulberry32) — mesma
// semente sempre produz a mesma sequência, ao contrário de Math.random().
function criarGeradorComSemente(semente) {
  let a = semente;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Monta a aula sintética do Simulado: carrega todas as aulas dos módulos 1
// a 5, sorteia N itens de checagem de cada módulo (aula.simulado.porModulo)
// e embaralha a ordem final. Cada item é clonado (JSON) pra não compartilhar
// estado (_escolhida/_correta/_pendente) com a aula original — senão
// responder aqui "sujaria" o progresso de quem depois faz a aula de verdade.
//
// O sorteio usa uma semente salva no arquivo de progresso (getSimuladoSeed),
// não Math.random() puro: enquanto a tentativa atual não termina (100% de
// acerto), qualquer recarregamento — inclusive abrir o Caderno de Erros —
// tem que sortear o MESMO conjunto/ordem, senão o índice "checagemN" salvo
// no caderno passaria a apontar pra uma pergunta diferente a cada vez.
async function montarSimulado(aulaBase) {
  const qtdPorModulo = (aulaBase.simulado && aulaBase.simulado.porModulo) || 5;
  const etapaIds     = aulaBase.simulado.etapaIds || [];
  const modulosBase  = (MODULOS || []).filter(m => etapaIds.includes(m.id));
  const porAula = {};
  await Promise.all(
    modulosBase.flatMap(m => m.aulas.map(a => a.id))
      .map(async id => { porAula[id] = await carregarAula(id); })
  );

  let semente = await getSimuladoSeed();
  if (semente == null) {
    semente = Math.floor(Math.random() * 2 ** 31);
    await definirSimuladoSeed(semente);
  }
  const rand = criarGeradorComSemente(semente);

  let itens = [];
  modulosBase.forEach(modulo => {
    const pool = modulo.aulas.flatMap(a => (porAula[a.id].checagem || []));
    const escolhidos = embaralhar(pool, rand).slice(0, qtdPorModulo).map(d => JSON.parse(JSON.stringify(d)));
    itens = itens.concat(escolhidos);
  });

  return { ...aulaBase, checagem: embaralhar(itens, rand), questoes: [] };
}

// ── INIT ─────────────────────────────────────────────────────
// No modo "Geral" (Caderno de Erros), carrega TODAS as aulas com checagens
// erradas de uma vez e monta uma aula sintética com os itens já na ordem
// certa (mais recente primeiro) — o resto do controller nem percebe a
// diferença, já que só enxerga um objeto "aula" com um array "checagem".
async function carregarDadosIniciais() {
  if (modoErrosGeral) {
    const [notebook, recentes, cartoesMarcados] = await Promise.all([
      getErrorNotebook(), getErrosRecentes(), getCartoesMarcados(),
    ]);
    const aulaIdsComErro = Object.keys(notebook).filter(id =>
      (notebook[id] || []).some(x => typeof x === 'string' && /^checagem\d+$/.test(x))
    );
    if (aulaIdsComErro.length === 0) {
      window.location.href = 'index.html?view=erros';
      return null;
    }
    const porAula = {};
    await Promise.all(aulaIdsComErro.map(async id => { porAula[id] = await carregarAula(id); }));

    const mapaQuando = new Map(recentes.map(r => [`${r.aulaId}:${r.chave}`, r.quando]));
    const itens = [];
    aulaIdsComErro.forEach(id => {
      (notebook[id] || [])
        .filter(x => typeof x === 'string' && /^checagem\d+$/.test(x))
        .forEach(chave => {
          const i     = parseInt(chave.slice('checagem'.length), 10);
          const dados = porAula[id].checagem && porAula[id].checagem[i];
          if (!dados) return;
          itens.push({ aulaId: id, i, dados, quando: mapaQuando.get(`${id}:${chave}`) || null });
        });
    });
    // Mais recente primeiro; erros sem horário conhecido (registrados antes
    // dessa funcionalidade existir) vão pro fim, sem inventar uma ordem.
    itens.sort((a, b) => {
      if (a.quando && b.quando) return new Date(b.quando) - new Date(a.quando);
      return a.quando ? -1 : (b.quando ? 1 : 0);
    });

    const aulaOriginal = { titulo: 'Caderno de Erros — Geral', checagem: itens.map(it => it.dados), questoes: [] };
    return { aulaOriginal, notebook, cartoesMarcados, itensGeral: itens };
  }

  const [aulaCarregada, notebook, cartoesMarcados] = await Promise.all([
    carregarAula(aulaId),
    modoErros ? getErrorNotebook() : Promise.resolve(null),
    getCartoesMarcados(),
  ]);
  aulaEhSimulado = !!aulaCarregada.simulado;
  const aulaOriginal = aulaCarregada.simulado ? await montarSimulado(aulaCarregada) : aulaCarregada;
  return { aulaOriginal, notebook, cartoesMarcados, itensGeral: null };
}

carregarDadosIniciais().then((carregado) => {
  if (!carregado) return; // modo Geral sem nenhum erro — já redirecionou
  const { aulaOriginal, notebook, cartoesMarcados, itensGeral } = carregado;
  let aula = aulaOriginal;
  let modoErrosChecagem     = false;
  let checagemErrosIniciais = [];
  cartaoMarcadoSet = new Set(cartoesMarcados[String(aulaId)] || []);

  if (modoErrosGeral) {
    modoErrosChecagem     = true;
    checagemErrosIniciais = itensGeral.map(it => ({ dados: it.dados, i: it.i, aulaId: it.aulaId }));
  } else if (modoErros) {
    const todosErros = notebook[String(aulaId)] || [];
    const errIdxs = todosErros
      .filter(i => Number.isInteger(i) && i >= 0 && aulaOriginal.questoes && i < aulaOriginal.questoes.length)
      .slice().sort((a, b) => a - b);
    // Erros de checagem ficam guardados como "checagemN" — extrai o índice.
    const checagemErrIdxs = todosErros
      .filter(x => typeof x === 'string' && /^checagem\d+$/.test(x))
      .map(x => parseInt(x.slice('checagem'.length), 10))
      .filter(i => aulaOriginal.checagem && i >= 0 && i < aulaOriginal.checagem.length)
      .sort((a, b) => a - b);

    if (errIdxs.length === 0 && checagemErrIdxs.length === 0) {
      window.location.href = 'index.html?view=erros';
      return;
    }
    if (errIdxs.length === 0) {
      // Só tem erros de checagem — pratica direto só essas, sem passar
      // pela aula inteira (introdução, exemplos etc.).
      aula = { ...aulaOriginal, titulo: `Caderno de Erros — ${aulaOriginal.titulo}` };
      modoErrosChecagem     = true;
      checagemErrosIniciais = checagemErrIdxs.map(i => ({ dados: aulaOriginal.checagem[i], i }));
    } else {
      aula = { ...aulaOriginal, titulo: `Caderno de Erros — ${aulaOriginal.titulo}`, questoes: errIdxs.map(i => aulaOriginal.questoes[i]) };
      estado.origIdx = errIdxs;
    }
  } else if (modoRevisao) {
    aula = { ...aulaOriginal, titulo: `Revisão — ${aulaOriginal.titulo}`, questoes: [] };
  } else {
    if (!QUESTOES_ATIVAS) aula = { ...aula, questoes: [] };
    estado.origIdx = aula.questoes.map((_, i) => i);
    estado.totalOriginal = aula.questoes.length;
  }

  // Inicializa estado com o número correto de questões
  estado.respostas = new Array(aula.questoes.length).fill(null);

  // Telas de intro em ordem (dinâmico, baseado nos campos da aula) — puladas
  // no modo caderno de erros. No modo revisão, mostra só as telas marcadas.
  const introScreens = [];
  const introFns = {};
  if (modoRevisao) {
    // "tipo=telas" mostra só definição/contexto/exemplo marcados; "tipo=perguntas"
    // mostra só checagens marcadas. Sem o parâmetro, mostra tudo (compatibilidade).
    const mostrarTelas     = tipoRevisao !== 'perguntas';
    const mostrarPerguntas = tipoRevisao !== 'telas';
    if (mostrarTelas && cartaoMarcadoSet.has('definicao') && aula.definicao) {
      introScreens.push('definicao');
      introFns.definicao = mostrarDefinicao;
    }
    if (mostrarTelas && cartaoMarcadoSet.has('contexto') && aula.contexto) {
      introScreens.push('contexto');
      introFns.contexto = mostrarContexto;
    }
    if (mostrarTelas) {
      (aula.exemplo || []).forEach((_, i) => {
        const chave = `exemplo${i}`;
        if (cartaoMarcadoSet.has(chave)) {
          introScreens.push(chave);
          introFns[chave] = (a, idx) => mostrarExemplo(a, idx, i);
        }
      });
    }
    if (mostrarPerguntas) {
      (aula.checagem || []).forEach((dados, i) => {
        const chave = `checagem${i}`;
        if (cartaoMarcadoSet.has(chave)) {
          introScreens.push(chave);
          introFns[chave] = (a, idx) => mostrarChecagem(a, idx, dados, i);
        }
      });
    }
    if (introScreens.length === 0) {
      window.location.href = 'index.html?view=erros';
      return;
    }
  } else if (Array.isArray(aula.ordem) && aula.ordem.length > 0) {
    // Sequência customizada (Construtor de Aulas, aba "Estrutura das telas") —
    // cada token do array vira uma tela, na ordem exata em que aparece lá.
    // Sem "ordem" na aula, cai no comportamento padrão abaixo (compatibilidade
    // com aulas escritas à mão, sem essa propriedade).
    Object.assign(introFns, {
      justificativa: mostrarIntro, infinitivo: mostrarInfinitivo, resumo: mostrarResumo,
      identificacao: mostrarIdentificacao, sentido: mostrarSentido, licao: mostrarLicao,
      definicao: mostrarDefinicao, contexto: mostrarContexto,
    });
    (aula.exemplo || []).forEach((_, i) => { introFns[`exemplo${i}`] = (a, idx) => mostrarExemplo(a, idx, i); });
    (aula.checagem || []).forEach((dados, i) => { introFns[`checagem${i}`] = (a, idx) => mostrarChecagem(a, idx, dados, i); });
    aula.ordem.forEach(token => {
      const chave = token === 'antesComecar' ? 'justificativa' : token;
      if (introFns[chave]) introScreens.push(chave);
    });
  } else {
    introScreens.push('justificativa');
    Object.assign(introFns, { justificativa: mostrarIntro, infinitivo: mostrarInfinitivo, resumo: mostrarResumo, identificacao: mostrarIdentificacao, sentido: mostrarSentido });
    if (aula.infinitivo)    introScreens.push('infinitivo');
    if (aula.identificacao) introScreens.push('identificacao');
    if (aula.sentido)       introScreens.push('sentido');
    if (aula.definicao)     introScreens.push('definicao');
    if (aula.contexto)      introScreens.push('contexto');
    introFns.definicao = mostrarDefinicao;
    introFns.contexto  = mostrarContexto;
    (aula.exemplo || []).forEach((_, i) => {
      const chave = `exemplo${i}`;
      introScreens.push(chave);
      introFns[chave] = (a, idx) => mostrarExemplo(a, idx, i);
    });
    (aula.checagem || []).forEach((dados, i) => {
      const chave = `checagem${i}`;
      introScreens.push(chave);
      introFns[chave] = (a, idx) => mostrarChecagem(a, idx, dados, i);
    });
    // Tela de resumo desativada por enquanto (dados mantidos para uso futuro)
    // if (aula.resumo) introScreens.push('resumo');
  }
  introTotal = introScreens.length - 1;
  let introIdx = 0;
  let introAtiva = !modoErros;

  // ── Revisão/reinício das checagens (mesma regra das questões) ──
  // Enquanto QUESTOES_ATIVAS estiver desligado, as checagens são "as
  // questões" da aula, então repetem-se as erradas até fechar 100% —
  // ou reinicia a aula inteira se todas saírem erradas.
  let revisandoChecagem = false;
  let checagemFila       = [];
  let checagemPos        = 0;
  let introTotalSalvo    = 0;

  function itensChecagemErrados(itens) {
    return itens.filter(({ dados }) => !acertouChecagem(dados));
  }

  function avaliarChecagens(itens) {
    const erradas = itensChecagemErrados(itens);
    // No modo "Geral" não existe uma única aula pra "rever desde o início"
    // — mesmo errando tudo, só continua repetindo os itens errados.
    if (!modoErrosGeral && erradas.length > 0 && erradas.length === itens.length) {
      mostrarReinicio();
    } else if (erradas.length > 0) {
      mostrarRevisaoChecagem(erradas);
    } else if (modoErros) {
      // Só terminou de praticar os erros do caderno — não é a aula
      // completa, então não dá estrelas nem desbloqueia a próxima.
      mostrarPraticaConcluidaChecagem();
    } else if (aula.questoes.length === 0) {
      mostrarFinalizadoChecagem();
    } else {
      introAtiva = false;
      sairIntro();
      renderQuestao(aula);
    }
  }

  function finalizarChecagens() {
    avaliarChecagens((aula.checagem || []).map((dados, i) => ({ dados, i })));
  }

  function mostrarChecagemRevisaoAtual() {
    const { dados, i, aulaId: origemAulaId } = checagemFila[checagemPos];
    mostrarChecagem(aula, checagemPos, dados, i, origemAulaId || aulaId);
    btnAnterior.disabled = checagemPos === 0;
  }

  function iniciarRevisaoChecagem(itens) {
    revisandoChecagem = true;
    checagemFila       = itens;
    checagemPos        = 0;
    checagemFila.forEach(({ dados }) => { delete dados._escolhida; delete dados._correta; delete dados._pendente; });
    introTotalSalvo = introTotal;
    introTotal      = checagemFila.length;
    mostrarChecagemRevisaoAtual();
  }

  function finalizarRevisaoChecagem() {
    revisandoChecagem = false;
    introTotal = introTotalSalvo;
    avaliarChecagens(checagemFila);
  }

  if (modoErrosChecagem) {
    iniciarRevisaoChecagem(checagemErrosIniciais);
  } else if (introAtiva) {
    introFns[introScreens[0]](aula, 0);
    btnAnterior.style.display = 'none'; // nunca mostra "Anterior" na 1ª tela
  } else {
    sairIntro();
    renderQuestao(aula);
  }

  // Navegação
  btnAnterior.addEventListener('click', () => {
    if (revisandoChecagem) {
      if (checagemPos > 0) { checagemPos--; mostrarChecagemRevisaoAtual(); }
      return;
    }
    if (introAtiva) {
      if (introIdx > 0) {
        introIdx--;
        introFns[introScreens[introIdx]](aula, introIdx);
      }
      return;
    }
    if (estado.atual > 0) { estado.atual--; renderQuestao(aula); }
  });

  btnProxima.addEventListener('click', () => {
    if (revisandoChecagem) {
      checagemPos++;
      if (checagemPos < checagemFila.length) {
        mostrarChecagemRevisaoAtual();
      } else {
        finalizarRevisaoChecagem();
      }
      return;
    }
    if (introAtiva) {
      introIdx++;
      if (introIdx < introScreens.length) {
        introFns[introScreens[introIdx]](aula, introIdx);
      } else if (modoRevisao) {
        window.location.href = 'index.html?view=erros';
      } else {
        finalizarChecagens();
      }
      return;
    }
    if (estado.atual < aula.questoes.length - 1) {
      estado.atual++;
      renderQuestao(aula);
      return;
    }
    if (modoErros) {
      mostrarResultado(aula);
      return;
    }
    // Fim da rodada — se errou alguma, repete só as erradas até fechar 100%.
    // Se errou todas, a aula inteira não ficou clara: volta pro começo dela.
    const idxsErrados = aula.questoes
      .map((q, i) => (estado.respostas[i] !== q.correta ? estado.origIdx[i] : null))
      .filter(i => i !== null);
    if (idxsErrados.length === aula.questoes.length) {
      mostrarReinicio();
    } else if (idxsErrados.length > 0) {
      mostrarRevisao(idxsErrados);
    } else {
      mostrarResultado(aula);
    }
  });

  // Fechar lição
  document.getElementById('licaoFechar').addEventListener('click',    () => document.getElementById('licaoOverlay').classList.remove('show'));
  document.getElementById('licaoBtnFechar').addEventListener('click', () => document.getElementById('licaoOverlay').classList.remove('show'));

  // Fechar antes de terminar — se errou algo nesta visita, manda direto pro
  // Caderno de Erros em vez do Início, pra não perder de vista o que rever.
  // Terminar a aula de verdade (loop de revisão já fechou com 100%) sempre
  // volta pro Início — só a prática vinda do Caderno (modoErros) retorna
  // pra lá, pra continuar revisando outras questões erradas.
  const destinoVoltarCedo = () => (modoErros || erroNestaSessao) ? 'index.html?view=erros' : 'index.html';
  const destinoVoltarFinal = () => modoErros ? 'index.html?view=erros' : 'index.html';
  document.getElementById('btnFechar').addEventListener('click', () => {
    window.location.href = destinoVoltarCedo();
  });

  // Voltar ao início após resultado — ou começar a rodada de revisão/reinício
  document.getElementById('resultadoBtnContinuar').addEventListener('click', () => {
    if (aguardandoReinicio) {
      // Recarrega a aula do zero (telas de introdução, checagens, tudo).
      window.location.href = `estudo.html?aula=${aulaId}`;
      return;
    }
    if (aguardandoRevisao) {
      aguardandoRevisao = false;
      document.getElementById('resultadoOverlay').classList.remove('show');
      document.getElementById('resultadoBtnContinuar').textContent = 'Voltar ao início';
      aula = { ...aulaOriginal, questoes: idxsRevisaoPendente.map(i => aulaOriginal.questoes[i]) };
      estado.origIdx   = idxsRevisaoPendente;
      estado.atual     = 0;
      estado.respostas = new Array(aula.questoes.length).fill(null);
      renderQuestao(aula);
      return;
    }
    if (aguardandoRevisaoChecagem) {
      aguardandoRevisaoChecagem = false;
      document.getElementById('resultadoOverlay').classList.remove('show');
      document.getElementById('resultadoBtnContinuar').textContent = 'Voltar ao início';
      iniciarRevisaoChecagem(checagemRevisaoPendente);
      return;
    }
    window.location.href = destinoVoltarFinal();
  });

}).catch(err => {
  console.error(err);
  document.getElementById('questaoTitulo').textContent = 'Aula não encontrada.';
});
