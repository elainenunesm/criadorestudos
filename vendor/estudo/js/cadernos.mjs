'use strict';

/**
 * CADERNOS.MJS — Aba "Cadernos": erros, favoritos e telas/perguntas
 * marcadas para revisão. Usa js/progresso.mjs (localStorage) pros dados e
 * MODULOS (js/data/modulos.mjs) pra listar as aulas na ordem certa. Depende
 * de listaAulas()/escaparHtml()/state, definidos em js/inicio.mjs.
 */

let cadernoAtivo = 'erros';
let subCadernoAtivo = 'aula';

const SUBTABS_POR_CADERNO = {
  erros:   [{ valor: 'aula', label: 'Por aula' }, { valor: 'geral', label: 'Geral' }],
  revisao: [{ valor: 'telas', label: 'Aulas' }, { valor: 'perguntas', label: 'Perguntas' }],
};

function trocarCadernoTab(tab) {
  cadernoAtivo = tab;
  document.querySelectorAll('.caderno-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));

  const subtabsBar = document.getElementById('cadernosSubtabs');
  const config = SUBTABS_POR_CADERNO[tab];
  if (config) {
    subtabsBar.style.display = 'flex';
    const botoes = subtabsBar.querySelectorAll('.caderno-subtab');
    config.forEach((cfg, i) => {
      if (!botoes[i]) return;
      botoes[i].textContent = cfg.label;
      botoes[i].dataset.subtab = cfg.valor;
      botoes[i].classList.toggle('active', i === 0);
    });
    subCadernoAtivo = config[0].valor;
  } else {
    subtabsBar.style.display = 'none';
  }
  renderCadernoAtivo();
}

function trocarCadernoSubTab(sub) {
  subCadernoAtivo = sub;
  document.querySelectorAll('.caderno-subtab').forEach(btn => btn.classList.toggle('active', btn.dataset.subtab === sub));
  renderCadernoAtivo();
}

function formatarTempoRelativo(iso) {
  const diffMin = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${Math.floor(diffMin)}min`;
  const h = diffMin / 60;
  if (h < 24) return `há ${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 30) return `há ${Math.floor(d)}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function ehPergunta(chave) {
  return chave.startsWith('checagem') || chave.startsWith('questao');
}

const EMPTY_ERROS = `
  <div class="erros-empty">
    <p class="erros-empty-emoji">🎉</p>
    <p>Nenhum erro registrado ainda.</p>
    <p class="erros-empty-sub">As questões que você errar aparecem aqui e ficam disponíveis para revisão até você dominá-las.</p>
  </div>`;

const EMPTY_FAVORITOS = `
  <div class="erros-empty">
    <p class="erros-empty-emoji">🤍</p>
    <p>Nenhuma aula favoritada ainda.</p>
    <p class="erros-empty-sub">Toque no coraçãozinho no card da aula para marcá-la como favorita.</p>
  </div>`;

function emptyRevisaoHtml(mostrarPerguntas) {
  return `
    <div class="erros-empty">
      <p class="erros-empty-emoji">🔖</p>
      <p>${mostrarPerguntas ? 'Nenhuma pergunta marcada ainda.' : 'Nenhuma tela marcada ainda.'}</p>
      <p class="erros-empty-sub">${mostrarPerguntas
        ? 'Toque na etiqueta no canto das perguntas da aula para marcá-las.'
        : 'Toque na etiqueta no canto das telas de definição, contexto e exemplo para marcá-las.'}</p>
    </div>`;
}

async function renderErrosPorAula() {
  const list = document.getElementById('errosList');
  if (!list) return;
  const notebook = await getErrorNotebook();
  let html = '';
  listaAulas().forEach(aula => {
    const idxs = notebook[String(aula.id)] || [];
    if (idxs.length === 0) return;
    html += `
      <div class="erro-card">
        <div class="erro-card-info">
          <h3>${escaparHtml(aula.titulo)}</h3>
          <p>${idxs.length} ${idxs.length !== 1 ? 'questões' : 'questão'} para revisar</p>
        </div>
        <button type="button" class="btn-praticar" data-aula="${aula.id}">Praticar</button>
      </div>`;
  });
  list.innerHTML = html || EMPTY_ERROS;
}

async function renderErrosGeral() {
  const list = document.getElementById('errosList');
  if (!list) return;
  const [notebook, recentes] = await Promise.all([getErrorNotebook(), getErrosRecentes()]);
  const total = Object.values(notebook).reduce((soma, arr) => soma + (arr || []).length, 0);
  const maisRecente = recentes.reduce((max, r) => (!max || new Date(r.quando) > new Date(max)) ? r.quando : max, null);
  const subtitulo = `${total} ${total !== 1 ? 'perguntas' : 'pergunta'} de todas as aulas, do mais recente ao mais antigo`
    + (maisRecente ? ` — último erro ${formatarTempoRelativo(maisRecente)}` : '');

  list.innerHTML = total > 0 ? `
    <div class="erro-card">
      <div class="erro-card-info">
        <h3>Todos os erros</h3>
        <p>${subtitulo}</p>
      </div>
      <button type="button" class="btn-praticar" id="btnPraticarGeral">Praticar</button>
    </div>` : EMPTY_ERROS;
}

async function renderErrosView() {
  if (subCadernoAtivo === 'geral') return renderErrosGeral();
  return renderErrosPorAula();
}

function renderFavoritosView() {
  const list = document.getElementById('errosList');
  if (!list) return;
  let html = '';
  listaAulas().forEach(aulaInfo => {
    const aula = state.aulas.find(a => a.id === aulaInfo.id);
    if (!aula || !aula.favorita || aula.status === 'locked') return;
    html += `
      <div class="erro-card">
        <div class="erro-card-info">
          <h3>${escaparHtml(aulaInfo.titulo)}</h3>
          <p class="cor-favorito">Aula favorita</p>
        </div>
        <button type="button" class="btn-praticar" data-aula="${aulaInfo.id}">Abrir</button>
      </div>`;
  });
  list.innerHTML = html || EMPTY_FAVORITOS;
}

async function renderRevisaoView() {
  const list = document.getElementById('errosList');
  if (!list) return;
  const marcados = await getCartoesMarcados();
  const mostrarPerguntas = subCadernoAtivo === 'perguntas';
  let html = '';
  listaAulas().forEach(aula => {
    const chaves = (marcados[String(aula.id)] || []).filter(c => ehPergunta(c) === mostrarPerguntas);
    if (chaves.length === 0) return;
    const rotulo = mostrarPerguntas ? 'pergunta' : 'tela';
    html += `
      <div class="erro-card">
        <div class="erro-card-info">
          <h3>${escaparHtml(aula.titulo)}</h3>
          <p class="cor-revisao">${chaves.length} ${rotulo}${chaves.length !== 1 ? 's' : ''} para revisar</p>
        </div>
        <button type="button" class="btn-praticar" data-aula="${aula.id}">Ver</button>
      </div>`;
  });
  list.innerHTML = html || emptyRevisaoHtml(mostrarPerguntas);
}

async function renderCadernoAtivo() {
  if (cadernoAtivo === 'favoritos') return renderFavoritosView();
  if (cadernoAtivo === 'revisao') return renderRevisaoView();
  return renderErrosView();
}

function configurarEventosCadernos() {
  document.querySelectorAll('.caderno-tab').forEach(btn => {
    btn.addEventListener('click', () => trocarCadernoTab(btn.dataset.tab));
  });
  document.querySelectorAll('.caderno-subtab').forEach(btn => {
    btn.addEventListener('click', () => trocarCadernoSubTab(btn.dataset.subtab));
  });
  document.getElementById('errosList').addEventListener('click', e => {
    if (e.target.closest('#btnPraticarGeral')) {
      window.location.href = 'estudo.html?modo=erros&geral=1';
      return;
    }
    const btn = e.target.closest('.btn-praticar');
    if (!btn) return;
    const aulaId = btn.dataset.aula;
    if (cadernoAtivo === 'favoritos') {
      window.location.href = `estudo.html?aula=${aulaId}`;
    } else if (cadernoAtivo === 'revisao') {
      const tipo = subCadernoAtivo === 'perguntas' ? 'perguntas' : 'telas';
      window.location.href = `estudo.html?aula=${aulaId}&modo=revisao&tipo=${tipo}`;
    } else {
      window.location.href = `estudo.html?aula=${aulaId}&modo=erros`;
    }
  });
}
