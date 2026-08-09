'use strict';

/**
 * INICIO.JS — Tela inicial do projeto exportado. Gera a trilha de
 * ciclos/etapas/aulas dinamicamente a partir de MODULOS/NIVEIS (js/data/
 * modulos.js) — nunca precisa ser escrita/sincronizada à mão — e reproduz a
 * mesma regra de trava/destrava/estrelas do projeto original (estudos):
 * uma corrente sequencial única por id de aula (MODULOS.flatMap ordem),
 * independente de etapa/nível. Progresso persiste em localStorage via
 * js/progresso.js.
 */

const state = { aulas: [] };

function listaAulas() {
  return (MODULOS || []).flatMap(m => m.aulas);
}

function aulaIdsDoNivel(nivel) {
  return (MODULOS || []).filter(m => nivel.etapas.includes(m.id)).flatMap(m => m.aulas.map(a => a.id));
}

/** Grupos de progresso: a sequência básica (ciclos que não estão em nenhuma trilha, sempre
 * liberada) e um grupo por trilha (só libera depois que a básica estiver 100% concluída E a
 * aluna tiver escolhido aquela trilha — ver niveis.mjs). Cada grupo tem sua própria corrente
 * sequencial independente — terminar uma aula libera a próxima dentro do MESMO grupo, nunca
 * pulando pra outro. Sem nenhuma trilha cadastrada, isso se comporta exatamente como antes: um
 * grupo só, com todos os ciclos, numa corrente sequencial única. */
function gruposDeProgresso() {
  const niveis = typeof NIVEIS !== 'undefined' ? NIVEIS : [];
  const trilhas = typeof TRILHAS !== 'undefined' ? TRILHAS : [];
  const idsEmTrilha = new Set(trilhas.flatMap(t => t.ciclos));
  const grupos = [{
    tipo: 'base',
    aulaIds: niveis.filter(n => !idsEmTrilha.has(n.id)).flatMap(aulaIdsDoNivel),
  }];
  trilhas.forEach(t => {
    grupos.push({
      tipo: 'trilha',
      trilhaId: t.id,
      aulaIds: niveis.filter(n => t.ciclos.includes(n.id)).flatMap(aulaIdsDoNivel),
    });
  });
  return grupos;
}

/** true quando toda a sequência básica (fora de qualquer trilha) já está concluída — é o que
 * libera a escolha de trilha na aba Estudos (ver niveis.mjs). Sem nenhum ciclo fora de trilha
 * (todo ciclo já pertence a alguma trilha), não tem o que concluir — a escolha já começa
 * liberada (every() de array vazio é true, então isso já "funcionaria sozinho" sem essa nota,
 * mas documentando pra não virar um "if (!length) return false" por engano de novo). */
function baseConcluida() {
  const grupoBase = gruposDeProgresso()[0];
  return grupoBase.aulaIds.every(id => state.aulas.find(a => a.id === id)?.status === 'completed');
}

async function carregarProgresso() {
  const [dados, trilhasEscolhidas] = await Promise.all([
    lerArquivoProgresso(),
    typeof getTrilhasEscolhidas === 'function' ? getTrilhasEscolhidas() : Promise.resolve([]),
  ]);
  const salvas = Array.isArray(dados?.aulas) ? dados.aulas : [];
  const buscarSalva = id => salvas.find(a => a.id === id) || { id, status: 'locked', progress: 0, stars: 0, favorita: false };

  // Dentro de um grupo desbloqueado: a partir de "completed" salvo, a primeira aula não
  // concluída fica ativa e tudo depois dela fica bloqueado — nunca confia cegamente no status
  // salvo (protege contra aula nova inserida no meio, etc). Grupo bloqueado: tudo fica 'locked',
  // mesmo que tivesse progresso salvo de antes (ex: trilha desmarcada depois de já ter começado).
  function processarGrupo(aulaIds, desbloqueado) {
    let achouAtiva = false;
    return aulaIds.map(id => {
      const salva = buscarSalva(id);
      if (!desbloqueado) return { ...salva, status: 'locked' };
      if (salva.status === 'completed') return salva;
      if (!achouAtiva) { achouAtiva = true; return { ...salva, status: 'active' }; }
      return { ...salva, status: 'locked', progress: 0, stars: 0 };
    });
  }

  const grupos = gruposDeProgresso();
  const aulasBase = processarGrupo(grupos[0].aulaIds, true);
  // Sem ciclo nenhum fora de trilha, a "base" é vazia — nada bloqueia a escolha de trilha nesse
  // caso (every() de array vazio já é true sozinho, mas fica explícito aqui pra não reintroduzir
  // um "length > 0 &&" por engano, que travava a escolha pra sempre quando não sobra nada de fora).
  const baseOk = aulasBase.every(a => a.status === 'completed');

  let todasAulas = aulasBase;
  grupos.slice(1).forEach(grupo => {
    const desbloqueado = baseOk && trilhasEscolhidas.includes(grupo.trilhaId);
    todasAulas = todasAulas.concat(processarGrupo(grupo.aulaIds, desbloqueado));
  });
  state.aulas = todasAulas;
}

async function salvarProgresso() {
  await gravarArquivoProgresso({ aulas: state.aulas });
}

/** Lê (e consome) o resultado gravado por estudo.js em sessionStorage antes de voltar. */
function lerResultadoSessao() {
  const maxId = listaAulas().reduce((max, a) => Math.max(max, a.id), 0);
  for (let i = 1; i <= maxId; i++) {
    const key = `aula${i}_resultado`;
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;
    sessionStorage.removeItem(key);
    const { aulaId, estrelas, acertos, total } = JSON.parse(raw);
    return { aulaId, estrelas, acertos, total, concluida: acertos >= Math.ceil(total * 0.5) };
  }
  return null;
}

function aplicarResultado(r) {
  const idx = state.aulas.findIndex(a => a.id === r.aulaId);
  if (idx === -1) return;
  const atual = state.aulas[idx];
  if (r.concluida) {
    state.aulas[idx] = { ...atual, status: 'completed', progress: 100, stars: r.estrelas };
    // Libera a próxima aula dentro do MESMO grupo (base ou trilha) — não necessariamente a
    // próxima posição no array, já que os grupos ficam concatenados nele em sequência.
    const grupo = gruposDeProgresso().find(g => g.aulaIds.includes(r.aulaId));
    const proximoId = grupo ? grupo.aulaIds[grupo.aulaIds.indexOf(r.aulaId) + 1] : undefined;
    if (proximoId != null) {
      const idxProxima = state.aulas.findIndex(a => a.id === proximoId);
      if (idxProxima !== -1 && state.aulas[idxProxima].status === 'locked') {
        state.aulas[idxProxima] = { ...state.aulas[idxProxima], status: 'active', progress: 0 };
      }
    }
  } else {
    state.aulas[idx] = { ...atual, status: 'active', progress: Math.round((r.acertos / r.total) * 100), stars: r.estrelas };
  }
}

/** Depois de voltar de uma aula (concluída ou não), rola a Início até a PRÓXIMA aula que a aluna
 * deve fazer — a que ficou "active" no mesmo grupo (base ou trilha) de onde ela voltou — e destaca
 * com uma animação, pra ela não precisar procurar. Só roda nesse retorno de aula (tem resultado de
 * sessão salvo), não em toda visita normal à Início. */
function destacarProximaAula(aulaOrigemId) {
  const grupo = gruposDeProgresso().find(g => g.aulaIds.includes(aulaOrigemId));
  if (!grupo) return;
  const aulaAlvo = grupo.aulaIds
    .map(id => state.aulas.find(a => a.id === id))
    .find(a => a && a.status === 'active');
  if (!aulaAlvo) return; // grupo todo concluído agora — nada pra destacar (a celebração de insígnia toma conta)
  const node = document.querySelector(`[data-aula="${aulaAlvo.id}"]`);
  const card = node?.querySelector('.aula-card');
  if (!node || !card) return;
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('proxima-destaque');
  setTimeout(() => card.classList.remove('proxima-destaque'), 2400);
}

/* ---------------------------------------------------------------------- */
/* Ícones                                                                   */
/* ---------------------------------------------------------------------- */

const ICONE_CADEADO = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
const ICONE_PADRAO = '<path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5 2.3-7.2-6-4.6h7.6z"></path>';
const ICONES_AULA = {
  busca:     '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
  pessoa:    '<circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path>',
  balao:     '<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"></path>',
  bandeira:  '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>',
  nuvem:     '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"></path>',
  relogio:   '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 16 14"></polyline>',
  resumo:    '<rect x="6" y="3" width="12" height="18" rx="2"></rect><line x1="9" y1="8" x2="15" y2="8"></line><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="12" y2="16"></line>',
  balanca:   '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path>',
  padrao:    ICONE_PADRAO,
};

function escaparHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------------- */
/* Construção da trilha (DOM a partir de MODULOS/NIVEIS)                    */
/* ---------------------------------------------------------------------- */

function montarEtapas() {
  const wrap = document.getElementById('etapasWrap');
  wrap.innerHTML = '';

  if (listaAulas().length === 0) {
    wrap.innerHTML = `<div class="vazio-aviso">Nenhuma aula exportada ainda.<br>Volte ao Construtor de Aulas, preencha o conteúdo e exporte de novo.</div>`;
    return;
  }

  (MODULOS || []).forEach(etapa => {
    const div = document.createElement('div');
    div.className = 'etapa-view';
    div.dataset.etapa = etapa.id;
    div.innerHTML = `
      <div class="hero-card">
        <div class="nivel-selector"><span></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="hero-content">
          <span class="hero-materia">${escaparHtml(etapa.materia || '')}</span>
          <h2 class="hero-title"></h2>
          <div class="progress-segments"></div>
        </div>
      </div>
      <div class="path-container">
        <div class="path-line"></div>
        <div class="path-line-lit"></div>
        ${etapa.aulas.map(aula => `
          <div class="aula-node" data-aula="${aula.id}">
            <div class="stars"><span class="star">★</span><span class="star">★</span><span class="star">★</span></div>
            <div class="icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></svg></div>
            <div class="aula-card">
              <button type="button" class="btn-favoritar" title="Marcar como favorita">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"></path></svg>
              </button>
              <h3>${escaparHtml(aula.titulo)}</h3>
              <p class="status"></p>
              <div class="progress-bar"><div class="progress-bar-fill" style="width:0%"></div></div>
              <button type="button" class="btn-acao"></button>
            </div>
          </div>`).join('')}
      </div>`;
    wrap.appendChild(div);
  });
}

/* ---------------------------------------------------------------------- */
/* Renderização de estado (lock/estrelas/progresso)                         */
/* ---------------------------------------------------------------------- */

function renderAulas() {
  state.aulas.forEach(aula => {
    const node = document.querySelector(`[data-aula="${aula.id}"]`);
    if (!node) return;

    const iconCircle = node.querySelector('.icon-circle');
    const iconSvg    = iconCircle.querySelector('svg');
    const card       = node.querySelector('.aula-card');
    const statusEl   = node.querySelector('.status');
    const barFill    = node.querySelector('.progress-bar-fill');
    const btn        = node.querySelector('.btn-acao');
    const stars      = node.querySelectorAll('.star');
    const btnFav     = node.querySelector('.btn-favoritar');
    if (btnFav) btnFav.classList.toggle('favorita', !!aula.favorita);

    const info = listaAulas().find(a => a.id === aula.id);
    if (iconSvg) iconSvg.innerHTML = aula.status === 'locked' ? ICONE_CADEADO : (ICONES_AULA[info?.icone] || ICONE_PADRAO);

    node.classList.toggle('locked', aula.status === 'locked');
    card.classList.toggle('locked', aula.status === 'locked');

    if (aula.status === 'locked') {
      iconCircle.className = 'icon-circle locked';
      statusEl.textContent = 'Bloqueada';
      barFill.style.width  = '0%';
      btn.textContent = '🔒 Bloqueada';
      btn.disabled    = true;
      btn.className   = 'btn-acao bloqueada';
      stars.forEach(s => { s.style.color = '#e5e7eb'; });
    } else if (aula.status === 'active') {
      iconCircle.className = 'icon-circle active';
      statusEl.textContent = aula.progress > 0 ? 'Em andamento' : 'Não iniciada';
      barFill.style.width  = `${aula.progress}%`;
      btn.textContent = aula.progress > 0 ? 'Continuar' : 'Começar';
      btn.disabled    = false;
      btn.className   = 'btn-acao ativa';
      stars.forEach((s, i) => { s.style.color = i < aula.stars ? '#FFD700' : '#e5e7eb'; });
    } else {
      iconCircle.className = 'icon-circle active';
      statusEl.textContent = 'Concluída';
      barFill.style.width  = '100%';
      btn.textContent = 'Recomeçar';
      btn.disabled    = false;
      btn.className   = 'btn-acao ativa';
      stars.forEach((s, i) => { s.style.color = i < aula.stars ? '#FFD700' : '#e5e7eb'; });
    }
  });

  atualizarTrilha();
  atualizarProgressoEtapas();
}

function atualizarTrilha() {
  document.querySelectorAll('.etapa-view').forEach(etapaView => {
    const container = etapaView.querySelector('.path-container');
    const lit       = etapaView.querySelector('.path-line-lit');
    const etapaInfo = (MODULOS || []).find(m => String(m.id) === etapaView.dataset.etapa);
    if (!container || !lit || !etapaInfo) return;

    const aulasDaEtapa = etapaInfo.aulas.map(a => state.aulas.find(s => s.id === a.id)).filter(Boolean);
    const circulos = aulasDaEtapa.map(aula => document.querySelector(`[data-aula="${aula.id}"] .icon-circle`)).filter(Boolean);

    let ultimoCompletoIdx = -1;
    for (let i = 0; i < aulasDaEtapa.length; i++) {
      if (aulasDaEtapa[i].status === 'completed') ultimoCompletoIdx = i;
      else break;
    }
    if (ultimoCompletoIdx === -1 || !circulos[ultimoCompletoIdx]) { lit.style.height = '0px'; return; }

    const containerTop = container.getBoundingClientRect().top;
    const centro = el => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
    const proximoCirculo = circulos[ultimoCompletoIdx + 1];
    const altura = (proximoCirculo ? centro(proximoCirculo) : centro(circulos[ultimoCompletoIdx])) - containerTop;
    lit.style.height = `${Math.max(0, altura)}px`;
  });
}

function atualizarProgressoEtapas() {
  document.querySelectorAll('.etapa-view').forEach(etapaView => {
    const heroCard     = etapaView.querySelector('.hero-card');
    const segmentsWrap = etapaView.querySelector('.progress-segments');
    const etapaInfo    = (MODULOS || []).find(m => String(m.id) === etapaView.dataset.etapa);
    if (!heroCard || !segmentsWrap || !etapaInfo) return;

    const aulasDaEtapa = etapaInfo.aulas.map(a => state.aulas.find(s => s.id === a.id)).filter(Boolean);
    const concluidas = aulasDaEtapa.filter(a => a.status === 'completed').length;

    segmentsWrap.innerHTML = aulasDaEtapa.map((_, i) => `<div class="segment${i < concluidas ? ' filled' : ''}"></div>`).join('');
    heroCard.classList.toggle('etapa-completa', aulasDaEtapa.length > 0 && concluidas === aulasDaEtapa.length);
  });
}

function atualizarSeletoresDeNivel() {
  document.querySelectorAll('.etapa-view[data-etapa]').forEach(etapaEl => {
    const etapaId = parseInt(etapaEl.dataset.etapa, 10);
    const niveis = NIVEIS || [];
    const posicao = niveis.findIndex(n => n.etapas.includes(etapaId));
    const nivel = niveis[posicao];

    // Selo de cima é sempre genérico ("Nível N") — quem carrega a informação
    // de verdade (o nome do ciclo) é o título grande abaixo da matéria, pra
    // não repetir o mesmo texto duas vezes.
    const span = etapaEl.querySelector('.nivel-selector span');
    if (span) span.textContent = posicao === -1 ? 'Etapa' : `Nível ${posicao + 1}`;

    const tituloEl = etapaEl.querySelector('.hero-title');
    if (tituloEl) tituloEl.textContent = nivel ? nivel.titulo : '';
  });
}

/* ---------------------------------------------------------------------- */
/* Colapsar/expandir cada etapa                                             */
/* ---------------------------------------------------------------------- */

function configurarColapsos() {
  document.querySelectorAll('.etapa-view').forEach(etapaView => {
    const nivelSelector = etapaView.querySelector('.nivel-selector');
    const heroCard      = etapaView.querySelector('.hero-card');
    const pathContainer = etapaView.querySelector('.path-container');
    let colapsado = false;
    function aplicar() {
      // hero-content (matéria/título/barra de progresso) fica sempre visível
      // mesmo recolhido — só a lista de aulas (pathContainer) esconde. Igual
      // ao comportamento real do estudos (configurarColapsoHero em script.js).
      [nivelSelector, heroCard, pathContainer].forEach(el => el.classList.toggle('collapsed', colapsado));
    }
    function alternar() { colapsado = !colapsado; aplicar(); }
    nivelSelector.addEventListener('click', e => { e.stopPropagation(); alternar(); });
    heroCard.addEventListener('click', e => { if (e.target.closest('.hero-content')) return; alternar(); });
    etapaView._setColapsado = valor => { colapsado = valor; aplicar(); };
  });
}

function aplicarColapsoInicial() {
  const etapas = Array.from(document.querySelectorAll('.etapa-view')).map(view => {
    const etapaInfo = (MODULOS || []).find(m => String(m.id) === view.dataset.etapa);
    const aulasDaEtapa = etapaInfo ? etapaInfo.aulas.map(a => state.aulas.find(s => s.id === a.id)).filter(Boolean) : [];
    return { view, emAndamento: aulasDaEtapa.some(a => a.status === 'active') };
  });
  const existeEmAndamento = etapas.some(e => e.emAndamento);
  etapas.forEach((etapa, i) => {
    const deveAbrir = existeEmAndamento ? etapa.emAndamento : i === etapas.length - 1;
    if (etapa.view._setColapsado) etapa.view._setColapsado(!deveAbrir);
  });
}

/* ---------------------------------------------------------------------- */
/* Eventos das aulas (favoritar / bloqueada / começar)                      */
/* ---------------------------------------------------------------------- */

function configurarEventosAulas() {
  document.getElementById('etapasWrap').addEventListener('click', e => {
    const btnFav = e.target.closest('.btn-favoritar');
    if (btnFav) {
      e.stopPropagation();
      const node   = btnFav.closest('[data-aula]');
      const aulaId = node ? parseInt(node.dataset.aula, 10) : null;
      const aula   = state.aulas.find(a => a.id === aulaId);
      if (aula && aula.status === 'locked') { showToast('🔒 Conclua a aula anterior para poder favoritar esta.'); return; }
      if (aula) {
        aula.favorita = !aula.favorita;
        renderAulas();
        showToast(aula.favorita ? '❤️ Aula marcada como favorita!' : 'Aula removida dos favoritos', 'success');
        salvarProgresso();
      }
      return;
    }

    const lockedNode = e.target.closest('.aula-node.locked');
    if (lockedNode) { showToast('🔒 Conclua a aula anterior para desbloquear'); return; }

    const btn = e.target.closest('.btn-acao');
    if (btn && !btn.disabled) {
      const node = btn.closest('[data-aula]');
      const aulaId = node ? node.dataset.aula : null;
      window.location.href = `estudo.html?aula=${aulaId || 1}`;
    }
  });
}

/* ---------------------------------------------------------------------- */
/* Toast + navegação inferior                                               */
/* ---------------------------------------------------------------------- */

let toastTimer;
function showToast(msg, type = 'default', duracao = 2500) {
  let toast = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === 'success' ? '#16a34a' : (type === 'warning' ? '#d97706' : '#1a1a2e');
  clearTimeout(toastTimer);
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), duracao);
}

function configurarBottomNav() {
  const paginas = {
    inicio:     document.getElementById('viewInicio'),
    erros:      document.getElementById('viewErros'),
    desempenho: document.getElementById('viewDesempenho'),
    niveis:     document.getElementById('viewNiveis'),
  };
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      Object.entries(paginas).forEach(([nome, el]) => { if (el) el.style.display = nome === view ? '' : 'none'; });
      document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n === item));
      if (view === 'erros') renderCadernoAtivo();
      if (view === 'niveis') renderNiveis();
      if (view === 'desempenho' && typeof renderDesempenho === 'function') renderDesempenho();
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Init                                                                      */
/* ---------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof garantirInicializado === 'function') await garantirInicializado();
  montarEtapas();
  if (listaAulas().length === 0) return;

  await carregarProgresso();
  const resultado = lerResultadoSessao();
  if (resultado) {
    aplicarResultado(resultado);
    await salvarProgresso();
  }
  if (typeof verificarInsignias === 'function') await verificarInsignias();

  atualizarSeletoresDeNivel();
  renderAulas();
  configurarColapsos();
  aplicarColapsoInicial();
  configurarEventosAulas();
  configurarEventosCadernos();
  configurarBottomNav();
  // Espera a transição de abrir/fechar etapa (.25s no CSS) assentar antes de rolar — senão o
  // scrollIntoView mira numa posição que ainda vai se mexer.
  if (resultado) setTimeout(() => destacarProximaAula(resultado.aulaId), 350);
});
