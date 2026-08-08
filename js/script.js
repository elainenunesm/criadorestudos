// Toggle nodes
function toggleNode(el) {
  const node = el.closest('.node');
  const expanded = node.getAttribute('aria-expanded') === 'true';
  node.setAttribute('aria-expanded', String(!expanded));
  node.classList.toggle('collapsed', expanded);
  const arrow = el.querySelector('.arrow');
  if (arrow) arrow.classList.toggle('rotated', !expanded);
}

// Tabs
let conteudoInicializado = false;
let configInicializado = false;

function switchTab(btn, painel) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  mostrarPainel(painel);
}

function mostrarPainel(painel) {
  document.getElementById('painelEstrutura').classList.toggle('ativo', painel === 'estrutura');
  document.getElementById('painelConteudo').classList.toggle('ativo', painel === 'conteudo');
  document.getElementById('painelConfig').classList.toggle('ativo', painel === 'config');
  document.getElementById('painelEstatistica').classList.toggle('ativo', painel === 'estatistica');
  document.getElementById('painelSobre').classList.toggle('ativo', painel === 'sobre');
  document.getElementById('tabsNav').style.display = (painel === 'config' || painel === 'estatistica' || painel === 'sobre') ? 'none' : '';
  if (painel === 'conteudo' && !conteudoInicializado) {
    conteudoInicializado = true;
    inicializarConteudo();
  }
  if (painel === 'config' && !configInicializado) {
    configInicializado = true;
    inicializarConfig();
  }
}

function abrirInicio() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tabEstrutura').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.bottom-nav .nav-item:first-child').classList.add('active');
  mostrarPainel('estrutura');
}

function abrirConfig() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navLayout').classList.add('active');
  mostrarPainel('config');
}

function abrirEstatistica() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navEstatistica').classList.add('active');
  mostrarPainel('estatistica');
}

function abrirSobre() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('navSobre').classList.add('active');
  mostrarPainel('sobre');
}

// Menu "..." de ciclo/matéria/aula (renomear / excluir) — genérico
let menuAberto = null;

function fecharMenuAberto() {
  if (menuAberto) { menuAberto.remove(); menuAberto = null; }
}

/** itens: [{ acao: 'renomear'|'excluir', label, onClick }] */
function abrirMenu(event, itens) {
  event.stopPropagation();
  fecharMenuAberto();

  const btn = event.currentTarget;
  const menu = document.createElement('div');
  menu.className = 'menu-ciclo';
  menu.innerHTML = itens.map(it => `<button type="button" data-acao="${it.acao}">${it.label}</button>`).join('');
  document.body.appendChild(menu);

  const rect = btn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.right - menu.offsetWidth}px`;

  itens.forEach(it => {
    menu.querySelector(`[data-acao="${it.acao}"]`).addEventListener('click', () => { fecharMenuAberto(); it.onClick(); });
  });

  menuAberto = menu;
  setTimeout(() => document.addEventListener('click', fecharMenuAberto, { once: true }), 0);
}

/** Troca `label` por um <input> editável no lugar, salvando com Enter/blur e cancelando com Esc. */
function iniciarEdicaoInline(label, valorOriginal, aoSalvar) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'node-label-edit';
  input.value = valorOriginal;
  label.replaceWith(input);
  input.focus();
  input.select();

  let resolvido = false;
  function salvar() {
    if (resolvido) return;
    resolvido = true;
    const novo = input.value.trim() || valorOriginal;
    aoSalvar(novo);
    salvarAutomaticamente();
    const novoLabel = document.createElement('span');
    novoLabel.className = label.className;
    novoLabel.textContent = novo;
    input.replaceWith(novoLabel);
  }
  function cancelar() {
    if (resolvido) return;
    resolvido = true;
    input.replaceWith(label);
  }

  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); salvar(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  });
  input.addEventListener('blur', salvar);
  input.addEventListener('click', e => e.stopPropagation());
}

/** Modal de confirmação (substitui confirm() nativo) — chama aoConfirmar() só se o usuário clicar em Excluir. */
function confirmarExclusao(mensagem, aoConfirmar) {
  const overlay = document.getElementById('modalConfirmar');
  const btnOk = document.getElementById('modalConfirmarOk');
  const btnCancelar = document.getElementById('modalConfirmarCancelar');
  document.getElementById('modalConfirmarTexto').textContent = mensagem;

  overlay.classList.add('show');

  function fechar() {
    overlay.classList.remove('show');
    btnOk.removeEventListener('click', onOk);
    btnCancelar.removeEventListener('click', onCancelar);
    overlay.removeEventListener('click', onOverlay);
  }
  function onOk() { fechar(); aoConfirmar(); salvarAutomaticamente(); }
  function onCancelar() { fechar(); }
  function onOverlay(e) { if (e.target === overlay) fechar(); }

  btnOk.addEventListener('click', onOk);
  btnCancelar.addEventListener('click', onCancelar);
  overlay.addEventListener('click', onOverlay);
}

// ── Ciclo ──────────────────────────────────────────────────────
function abrirMenuCiclo(event, cicloId) {
  abrirMenu(event, [
    { acao: 'renomear', label: '✏️ Renomear', onClick: () => renomearCiclo(cicloId) },
    { acao: 'excluir', label: '🗑 Excluir ciclo', onClick: () => excluirCiclo(cicloId) },
  ]);
}

function renomearCiclo(cicloId) {
  const ciclo = CICLOS.find(c => c.id === cicloId);
  const label = document.querySelector(`.node[data-ciclo-id="${cicloId}"] > .node-header > .node-label`);
  if (!ciclo || !label) return;
  iniciarEdicaoInline(label, ciclo.titulo, novo => { ciclo.titulo = novo; });
}

function excluirCiclo(cicloId) {
  const ciclo = CICLOS.find(c => c.id === cicloId);
  if (!ciclo) return;
  confirmarExclusao(`Excluir "${ciclo.titulo}"? Isso remove todas as matérias e aulas dele também.`, () => {
    const idx = CICLOS.findIndex(c => c.id === cicloId);
    if (idx !== -1) CICLOS.splice(idx, 1);
    const node = document.querySelector(`.node[data-ciclo-id="${cicloId}"]`);
    if (node) node.remove();
  });
}

// ── Matéria (etapa) ───────────────────────────────────────────
function abrirMenuMateria(event, cicloId, materiaId) {
  abrirMenu(event, [
    { acao: 'renomear', label: '✏️ Renomear', onClick: () => renomearMateria(cicloId, materiaId) },
    { acao: 'excluir', label: '🗑 Excluir matéria', onClick: () => excluirMateria(cicloId, materiaId) },
  ]);
}

function renomearMateria(cicloId, materiaId) {
  const info = buscarMateria(cicloId, materiaId);
  const label = document.querySelector(`.node[data-ciclo-id="${cicloId}"] .node[data-materia-id="${materiaId}"] > .node-header > .node-label`);
  if (!info || !label) return;
  iniciarEdicaoInline(label, info.materia.titulo, novo => { info.materia.titulo = novo; });
}

function excluirMateria(cicloId, materiaId) {
  const info = buscarMateria(cicloId, materiaId);
  if (!info) return;
  confirmarExclusao(`Excluir "${info.materia.titulo}"? Isso remove todas as aulas dela também.`, () => {
    const idx = info.ciclo.materias.findIndex(m => m.id === materiaId);
    if (idx !== -1) info.ciclo.materias.splice(idx, 1);
    const node = document.querySelector(`.node[data-ciclo-id="${cicloId}"] .node[data-materia-id="${materiaId}"]`);
    if (node) node.remove();
  });
}

function buscarMateria(cicloId, materiaId) {
  const ciclo = CICLOS.find(c => c.id === cicloId);
  if (!ciclo) return null;
  const materia = ciclo.materias.find(m => m.id === materiaId);
  if (!materia) return null;
  return { ciclo, materia };
}

// ── Aula ────────────────────────────────────────────────────────
function abrirMenuAula(event, cicloId, materiaId, aulaId) {
  abrirMenu(event, [
    { acao: 'renomear', label: '✏️ Renomear', onClick: () => renomearAula(cicloId, materiaId, aulaId) },
    { acao: 'excluir', label: '🗑 Excluir aula', onClick: () => excluirAula(cicloId, materiaId, aulaId) },
  ]);
}

function linhaDaAula(materiaId, aulaId) {
  return document.querySelector(`.node[data-materia-id="${materiaId}"] .lesson-row[data-aula-id="${aulaId}"]`);
}

function renomearAula(cicloId, materiaId, aulaId) {
  const info = buscarAula(cicloId, materiaId, aulaId);
  const linha = linhaDaAula(materiaId, aulaId);
  const spanLabel = linha ? linha.querySelector('.lesson-label') : null;
  if (!info || !spanLabel) return;
  iniciarEdicaoInline(spanLabel, info.aula.titulo, novo => { info.aula.titulo = novo; });
}

function excluirAula(cicloId, materiaId, aulaId) {
  const info = buscarAula(cicloId, materiaId, aulaId);
  if (!info) return;
  confirmarExclusao(`Excluir "${info.aula.titulo}"?`, () => {
    const idx = info.materia.aulas.findIndex(a => a.id === aulaId);
    if (idx !== -1) info.materia.aulas.splice(idx, 1);
    const linha = linhaDaAula(materiaId, aulaId);
    if (linha) linha.remove();
  });
}

// ── Criar ciclo / matéria / aula ────────────────────────────────
const ICONE_ARROW = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 2 6 6 3 10"/></svg>';
const ICONE_MAIS_16 = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6E6A7A" stroke-width="2.2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
const ICONE_MAIS_14 = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6E6A7A" stroke-width="2.2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
const ICONE_LICAO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6E6A7A" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const ICONE_ADICIONAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7B3FF2" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

function iconeFolder(cor) {
  return `<svg viewBox="0 0 24 24" fill="${cor}" stroke="none"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/></svg>`;
}

function escaparHtmlScript(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function configurarTeclaNodeHeader(btn) {
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
  });
}

function htmlLinhaAula(cicloId, materiaId, aula) {
  return `<a href="#" class="lesson-row" data-aula-id="${aula.id}" role="treeitem" aria-label="${escaparHtmlScript(aula.titulo)}" onclick="abrirConteudoAula(${cicloId},${materiaId},${aula.id}); return false;">
    <span aria-hidden="true">${ICONE_LICAO}</span>
    <span class="lesson-label">${escaparHtmlScript(aula.titulo)}</span>
    <button type="button" class="more-aula" aria-label="Opções da aula" onclick="abrirMenuAula(event, ${cicloId}, ${materiaId}, ${aula.id})">${ICONE_MAIS_14}</button>
  </a>`;
}

function criarLinhaAula(cicloId, materiaId, aula) {
  const template = document.createElement('template');
  template.innerHTML = htmlLinhaAula(cicloId, materiaId, aula).trim();
  return template.content.firstElementChild;
}

function criarNoCiclo(ciclo) {
  const node = document.createElement('div');
  node.className = 'node collapsed';
  node.setAttribute('role', 'treeitem');
  node.setAttribute('aria-expanded', 'false');
  node.setAttribute('aria-label', ciclo.titulo);
  node.dataset.cicloId = ciclo.id;
  node.innerHTML = `
    <div class="node-header" onclick="toggleNode(this)" role="button" tabindex="0" aria-label="Expandir ou recolher ${escaparHtmlScript(ciclo.titulo)}">
      <span class="arrow" aria-hidden="true">${ICONE_ARROW}</span>
      <span class="folder-icon" aria-hidden="true">${iconeFolder('#7B3FF2')}</span>
      <span class="node-label">${escaparHtmlScript(ciclo.titulo)}</span>
      <button class="more" aria-label="Opções do ciclo" onclick="abrirMenuCiclo(event, ${ciclo.id})">${ICONE_MAIS_16}</button>
    </div>`;
  configurarTeclaNodeHeader(node.querySelector('.node-header'));
  return node;
}

function criarNoMateria(cicloId, materia) {
  const node = document.createElement('div');
  node.className = 'node';
  node.setAttribute('role', 'treeitem');
  node.setAttribute('aria-expanded', 'true');
  node.setAttribute('aria-label', materia.titulo);
  node.dataset.materiaId = materia.id;
  node.innerHTML = `
    <div class="node-header" onclick="toggleNode(this)" role="button" tabindex="0" aria-label="Expandir ou recolher ${escaparHtmlScript(materia.titulo)}">
      <span class="arrow rotated" aria-hidden="true">${ICONE_ARROW}</span>
      <span class="folder-icon" aria-hidden="true">${iconeFolder('#4A7AEA')}</span>
      <span class="node-label">${escaparHtmlScript(materia.titulo)}</span>
      <button class="more" aria-label="Opções da matéria" onclick="abrirMenuMateria(event, ${cicloId}, ${materia.id})">${ICONE_MAIS_16}</button>
    </div>
    <div class="children" role="group">
      ${materia.aulas.map(aula => htmlLinhaAula(cicloId, materia.id, aula)).join('')}
      <a href="#" class="add-lesson" aria-label="Adicionar aula" onclick="novaAulaEm(${cicloId}, ${materia.id}); return false;">
        <span aria-hidden="true">${ICONE_ADICIONAR}</span>
        Adicionar aula
      </a>
    </div>`;
  configurarTeclaNodeHeader(node.querySelector('.node-header'));
  return node;
}

function proximoIdCiclo() { return Math.max(0, ...CICLOS.map(c => c.id)) + 1; }
function proximoIdMateria() { return Math.max(0, ...CICLOS.flatMap(c => c.materias.map(m => m.id))) + 1; }
function proximoIdAula() { return Math.max(0, ...CICLOS.flatMap(c => c.materias.flatMap(m => m.aulas.map(a => a.id)))) + 1; }

function novoCiclo() {
  const ciclo = { id: proximoIdCiclo(), titulo: 'Novo ciclo', materias: [] };
  CICLOS.push(ciclo);
  salvarAutomaticamente();

  const node = criarNoCiclo(ciclo);
  document.querySelector('.tree-wrap').appendChild(node);
  configurarArrasteCiclo(node, ciclo.id);
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  iniciarEdicaoInline(node.querySelector('.node-label'), ciclo.titulo, novo => { ciclo.titulo = novo; });
}

/** Modal de escolha (substitui "sempre vai pro último") — itens: [{ label, sublabel?, grupo?, onClick }].
 * Se algum item tiver `grupo`, a lista ganha títulos de seção (itens do mesmo grupo devem vir
 * seguidos). Com 5 itens ou mais, aparece um campo de busca no topo pra filtrar por label/sublabel. */
function abrirEscolha(titulo, itens) {
  const overlay = document.getElementById('modalEscolher');
  const lista = document.getElementById('modalEscolherLista');
  const btnCancelar = document.getElementById('modalEscolherCancelar');
  const buscaWrap = document.getElementById('modalEscolherBuscaWrap');
  const buscaInput = document.getElementById('modalEscolherBusca');
  document.getElementById('modalEscolherTitulo').textContent = titulo;

  const mostrarBusca = itens.length >= 5;
  buscaWrap.style.display = mostrarBusca ? '' : 'none';
  buscaInput.value = '';

  function renderLista(termoBusca) {
    lista.innerHTML = '';
    const termo = (termoBusca || '').trim().toLowerCase();
    const filtrados = termo
      ? itens.filter(it => `${it.label} ${it.sublabel || ''}`.toLowerCase().includes(termo))
      : itens;

    if (!filtrados.length) {
      lista.innerHTML = '<p class="pp-vazio">Nada encontrado.</p>';
      return;
    }

    let grupoAtual = null;
    filtrados.forEach(it => {
      if (it.grupo && it.grupo !== grupoAtual) {
        grupoAtual = it.grupo;
        const header = document.createElement('p');
        header.className = 'modal-lista-grupo-titulo';
        header.textContent = it.grupo;
        lista.appendChild(header);
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'modal-lista-item' + (it.iconeHtml ? ' modal-lista-item-icone' : '');
      const textos = `<span>${escaparHtmlScript(it.label)}</span>${it.sublabel ? `<span class="modal-lista-sub">${escaparHtmlScript(it.sublabel)}</span>` : ''}`;
      // iconeHtml é sempre montado internamente (badgeIcone()/ICONES_TIPO em conteudo.js), nunca vem de
      // texto digitado pela usuária — por isso entra direto, sem escapar (senão o SVG viraria texto cru).
      btn.innerHTML = (it.iconeHtml || '') + `<span class="modal-lista-item-textos">${textos}</span>`;
      btn.addEventListener('click', () => { fechar(); it.onClick(); });
      lista.appendChild(btn);
    });
  }
  renderLista('');
  buscaInput.oninput = () => renderLista(buscaInput.value);

  overlay.classList.add('show');

  function fechar() {
    overlay.classList.remove('show');
    btnCancelar.removeEventListener('click', fechar);
    overlay.removeEventListener('click', onOverlay);
    buscaInput.oninput = null;
  }
  function onOverlay(e) { if (e.target === overlay) fechar(); }
  btnCancelar.addEventListener('click', fechar);
  overlay.addEventListener('click', onOverlay);
}

function novaEtapa() {
  if (CICLOS.length === 0) { novoCiclo(); return; }
  if (CICLOS.length === 1) { novaEtapaEm(CICLOS[0].id); return; }
  abrirEscolha('Adicionar matéria em qual ciclo?', CICLOS.map(c => ({
    label: c.titulo,
    onClick: () => novaEtapaEm(c.id),
  })));
}

function novaEtapaEm(cicloId) {
  const ciclo = CICLOS.find(c => c.id === cicloId);
  if (!ciclo) return;

  const materia = { id: proximoIdMateria(), titulo: 'Nova matéria', aulas: [] };
  ciclo.materias.push(materia);
  salvarAutomaticamente();

  const cicloNode = document.querySelector(`.node[data-ciclo-id="${ciclo.id}"]`);
  cicloNode.classList.remove('collapsed');
  cicloNode.setAttribute('aria-expanded', 'true');
  const cicloArrow = cicloNode.querySelector(':scope > .node-header .arrow');
  if (cicloArrow) cicloArrow.classList.add('rotated');

  let childrenWrap = cicloNode.querySelector(':scope > .children');
  if (!childrenWrap) {
    childrenWrap = document.createElement('div');
    childrenWrap.className = 'children';
    childrenWrap.setAttribute('role', 'group');
    cicloNode.appendChild(childrenWrap);
  }

  const materiaNode = criarNoMateria(ciclo.id, materia);
  childrenWrap.appendChild(materiaNode);
  materiaNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  iniciarEdicaoInline(materiaNode.querySelector('.node-label'), materia.titulo, novo => { materia.titulo = novo; });
}

function novaAula() {
  const todasMaterias = CICLOS.flatMap(c => c.materias.map(m => ({ cicloId: c.id, cicloTitulo: c.titulo, materiaId: m.id, materiaTitulo: m.titulo })));
  if (todasMaterias.length === 0) { novaEtapa(); return; }
  if (todasMaterias.length === 1) { novaAulaEm(todasMaterias[0].cicloId, todasMaterias[0].materiaId); return; }
  abrirEscolha('Adicionar aula em qual matéria?', todasMaterias.map(m => ({
    label: m.materiaTitulo,
    sublabel: m.cicloTitulo,
    onClick: () => novaAulaEm(m.cicloId, m.materiaId),
  })));
}

function novaAulaEm(cicloId, materiaId) {
  const info = buscarMateria(cicloId, materiaId);
  if (!info) return;

  const aula = { id: proximoIdAula(), titulo: 'Nova aula', conteudo: novoConteudo() };
  info.materia.aulas.push(aula);
  salvarAutomaticamente();

  const cicloNode = document.querySelector(`.node[data-ciclo-id="${cicloId}"]`);
  cicloNode.classList.remove('collapsed');
  cicloNode.setAttribute('aria-expanded', 'true');
  const cicloArrow = cicloNode.querySelector(':scope > .node-header .arrow');
  if (cicloArrow) cicloArrow.classList.add('rotated');

  const materiaNode = document.querySelector(`.node[data-ciclo-id="${cicloId}"] .node[data-materia-id="${materiaId}"]`);
  materiaNode.classList.remove('collapsed');
  materiaNode.setAttribute('aria-expanded', 'true');
  const materiaArrow = materiaNode.querySelector(':scope > .node-header .arrow');
  if (materiaArrow) materiaArrow.classList.add('rotated');

  const childrenWrap = materiaNode.querySelector(':scope > .children');
  const addLessonLink = childrenWrap.querySelector('.add-lesson');
  const linha = criarLinhaAula(cicloId, materiaId, aula);
  childrenWrap.insertBefore(linha, addLessonLink);
  configurarArrasteAula(linha, cicloId, materiaId, aula.id);

  linha.scrollIntoView({ behavior: 'smooth', block: 'center' });
  iniciarEdicaoInline(linha.querySelector('.lesson-label'), aula.titulo, novo => { aula.titulo = novo; });
}

// Busca na árvore de Estrutura (ciclo/matéria/aula) — digitar filtra a lista, escondendo quem
// não bate e mostrando só os ramos que levam a um resultado (expandindo os que precisar).
function normalizarBusca(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function expandirTemporarioBusca(node) {
  if (node.classList.contains('collapsed')) node.dataset.expandidoPelaBusca = '1';
  node.classList.remove('collapsed');
  node.setAttribute('aria-expanded', 'true');
  const arrow = node.querySelector(':scope > .node-header .arrow');
  if (arrow) arrow.classList.add('rotated');
}

function filtrarArvoreEstrutura(termoOriginal) {
  const treeWrap = document.querySelector('.tree-wrap');
  const vazio = document.getElementById('buscaEstruturaVazia');
  if (!treeWrap) return;
  const termo = normalizarBusca(termoOriginal);

  if (!termo) {
    treeWrap.querySelectorAll('.busca-oculto').forEach(el => el.classList.remove('busca-oculto'));
    treeWrap.querySelectorAll('[data-expandido-pela-busca]').forEach(node => {
      delete node.dataset.expandidoPelaBusca;
      node.classList.add('collapsed');
      node.setAttribute('aria-expanded', 'false');
      const arrow = node.querySelector(':scope > .node-header .arrow');
      if (arrow) arrow.classList.remove('rotated');
    });
    if (vazio) vazio.style.display = 'none';
    treeWrap.style.display = '';
    return;
  }

  // Top-down: se o ciclo ou a matéria bate com a busca, TODO o conteúdo dentro dele fica visível
  // (mesmo que o texto da aula em si não bata) — e o inverso também funciona: uma aula que bate
  // mantém a matéria/ciclo dela visíveis e expandidos, mesmo que os nomes deles não batam.
  treeWrap.querySelectorAll('.node[data-ciclo-id]').forEach(cicloNode => {
    const labelCiclo = normalizarBusca(cicloNode.querySelector(':scope > .node-header .node-label')?.textContent);
    const cicloBate = labelCiclo.includes(termo);
    let cicloTemVisivel = cicloBate;

    cicloNode.querySelectorAll(':scope > .children > .node[data-materia-id]').forEach(materiaNode => {
      const labelMateria = normalizarBusca(materiaNode.querySelector(':scope > .node-header .node-label')?.textContent);
      const materiaBate = cicloBate || labelMateria.includes(termo);
      let materiaTemVisivel = materiaBate;

      materiaNode.querySelectorAll(':scope > .children > .lesson-row').forEach(row => {
        const labelAula = normalizarBusca(row.querySelector('.lesson-label')?.textContent);
        const aulaBate = materiaBate || labelAula.includes(termo);
        row.classList.toggle('busca-oculto', !aulaBate);
        if (aulaBate) materiaTemVisivel = true;
      });

      materiaNode.classList.toggle('busca-oculto', !materiaTemVisivel);
      if (materiaTemVisivel && !materiaBate) expandirTemporarioBusca(materiaNode);
      if (materiaTemVisivel) cicloTemVisivel = true;
    });

    cicloNode.classList.toggle('busca-oculto', !cicloTemVisivel);
    if (cicloTemVisivel && !cicloBate) expandirTemporarioBusca(cicloNode);
  });

  const temAlgumaCoisaVisivel = !!treeWrap.querySelector('.node[data-ciclo-id]:not(.busca-oculto)');
  treeWrap.style.display = temAlgumaCoisaVisivel ? '' : 'none';
  if (vazio) vazio.style.display = temAlgumaCoisaVisivel ? 'none' : '';
}

const inputBuscaEstrutura = document.getElementById('buscaEstrutura');
if (inputBuscaEstrutura) {
  inputBuscaEstrutura.addEventListener('input', () => filtrarArvoreEstrutura(inputBuscaEstrutura.value));
}

// ── Arrastar pra reordenar (ciclos entre si, aulas dentro da mesma matéria) ──────────

/** Move o item de `array` achado por `idOrigem` pra ficar do lado do item `idDestino` — depois
 * do destino se arrastou pra baixo, antes se arrastou pra cima. Retorna a direção (útil pra
 * reposicionar o elemento correspondente no DOM do mesmo jeito). */
function moverNoArray(array, idOrigem, idDestino) {
  const idxOrigem = array.findIndex(x => x.id === idOrigem);
  const idxDestino = array.findIndex(x => x.id === idDestino);
  if (idxOrigem === -1 || idxDestino === -1 || idxOrigem === idxDestino) return null;
  const paraBaixo = idxOrigem < idxDestino;
  const [item] = array.splice(idxOrigem, 1);
  let alvo = array.findIndex(x => x.id === idDestino);
  if (paraBaixo) alvo += 1;
  array.splice(alvo, 0, item);
  return paraBaixo;
}

let arrastando = null; // { tipo: 'ciclo'|'aula', id, materiaId? }

/** `handleEl` é o que o usuário agarra pra arrastar; `alvoEl` é onde ele pode soltar (pode ser
 * o mesmo elemento). `extra` guarda contexto extra (ex: materiaId, pra aula só trocar de posição
 * dentro da mesma matéria). */
function configurarArraste(handleEl, alvoEl, tipo, id, extra, aoSoltar) {
  handleEl.draggable = true;
  handleEl.addEventListener('dragstart', e => {
    arrastando = { tipo, id, ...extra };
    alvoEl.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
  });
  handleEl.addEventListener('dragend', () => {
    alvoEl.classList.remove('arrastando');
    document.querySelectorAll('.arraste-hover').forEach(n => n.classList.remove('arraste-hover'));
    arrastando = null;
  });

  function podeSoltarAqui() {
    if (!arrastando || arrastando.tipo !== tipo || arrastando.id === id) return false;
    if (tipo === 'aula' && arrastando.materiaId !== extra.materiaId) return false;
    return true;
  }

  alvoEl.addEventListener('dragover', e => {
    if (!podeSoltarAqui()) return;
    e.preventDefault();
    alvoEl.classList.add('arraste-hover');
  });
  alvoEl.addEventListener('dragleave', () => alvoEl.classList.remove('arraste-hover'));
  alvoEl.addEventListener('drop', e => {
    e.preventDefault();
    alvoEl.classList.remove('arraste-hover');
    if (!podeSoltarAqui()) return;
    aoSoltar(arrastando.id, id, alvoEl);
    salvarAutomaticamente();
  });
}

function configurarArrasteCiclo(nodeEl, cicloId) {
  const header = nodeEl.querySelector(':scope > .node-header');
  configurarArraste(header, nodeEl, 'ciclo', cicloId, {}, (idOrigem, idDestino) => {
    const paraBaixo = moverNoArray(CICLOS, idOrigem, idDestino);
    if (paraBaixo === null) return;
    const elOrigem = document.querySelector(`.node[data-ciclo-id="${idOrigem}"]`);
    if (paraBaixo) nodeEl.after(elOrigem);
    else nodeEl.before(elOrigem);
  });
}

function configurarArrasteAula(linhaEl, cicloId, materiaId, aulaId) {
  configurarArraste(linhaEl, linhaEl, 'aula', aulaId, { materiaId }, (idOrigem, idDestino) => {
    const info = buscarMateria(cicloId, materiaId);
    if (!info) return;
    const paraBaixo = moverNoArray(info.materia.aulas, idOrigem, idDestino);
    if (paraBaixo === null) return;
    const elOrigem = linhaDaAula(materiaId, idOrigem);
    if (paraBaixo) linhaEl.after(elOrigem);
    else linhaEl.before(elOrigem);
  });
}

/** Reconstrói a árvore inteira (ciclo > matéria > aula) a partir de CICLOS — chamado no
 * carregamento da página (lista vazia na primeira vez, ou restaurada do autosave), já com
 * clique/teclado/arraste ligados em cada nó criado. */
function renderArvoreCompleta() {
  const treeWrap = document.querySelector('.tree-wrap');
  const vazio = document.getElementById('arvoreVazia');
  if (!treeWrap) return;
  treeWrap.innerHTML = '';

  CICLOS.forEach(ciclo => {
    const nodeCiclo = criarNoCiclo(ciclo);
    treeWrap.appendChild(nodeCiclo);
    configurarArrasteCiclo(nodeCiclo, ciclo.id);

    if (ciclo.materias.length) {
      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'children';
      childrenWrap.setAttribute('role', 'group');
      nodeCiclo.appendChild(childrenWrap);

      ciclo.materias.forEach(materia => {
        const nodeMateria = criarNoMateria(ciclo.id, materia);
        childrenWrap.appendChild(nodeMateria);
        materia.aulas.forEach(aula => {
          const linha = linhaDaAula(materia.id, aula.id);
          if (linha) configurarArrasteAula(linha, ciclo.id, materia.id, aula.id);
        });
      });
    }
  });

  if (vazio) vazio.style.display = CICLOS.length ? 'none' : '';
}
renderArvoreCompleta();
