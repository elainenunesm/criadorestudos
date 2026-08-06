'use strict';

/**
 * CONTEUDO.JS — Aba "Conteúdo da aula": edita antesComecar/exemplo/checagem/
 * resumo/licao de uma aula, um passo por vez, na mesma ordem em que o
 * player real (estudos/estudo.html) mostra pra aluna — com pré-visualização
 * que usa as mesmas cores/estrutura do estudo.css (ver css/conteudo.css).
 */

const conteudoEstado = {
  cicloId: null,
  materiaId: null,
  aulaId: null,
  passoIndex: 0,
  respostaTela: 'padrao', // 'padrao' | 'acerto' | 'erro' — toggle da caixa "tela atual"
  aulaPassoIndex: 0,      // navegação própria da caixa "aula" — independente do passo sendo editado
  respostaAula: 'padrao', // toggle da caixa "aula"
};

function conteudoAulaAtual() {
  const info = buscarAula(conteudoEstado.cicloId, conteudoEstado.materiaId, conteudoEstado.aulaId);
  return info ? info.aula : null;
}

/** Próximo _id livre pra um novo item de exemplo/checagem (referenciado em conteudo.ordem). */
function proximoIdItem(conteudo) {
  const ids = [...conteudo.exemplo, ...conteudo.checagem].map(i => i._id || 0);
  return Math.max(0, ...ids) + 1;
}

/**
 * Garante que conteudo.ordem existe e reflete exatamente os itens atuais de
 * exemplo/checagem (dá _id a quem não tem, inclui item novo no fim antes do
 * resumo, remove entrada de item excluído). Chamada sempre antes de ler a
 * ordem — assim aulas antigas (sem "ordem" salvo) se auto-reparam na hora.
 */
function garantirOrdem(conteudo) {
  if (!Array.isArray(conteudo.ordem)) conteudo.ordem = [];

  conteudo.exemplo.forEach(item => { if (!item._id) item._id = proximoIdItem(conteudo); });
  conteudo.checagem.forEach(item => { if (!item._id) item._id = proximoIdItem(conteudo); });

  // Remove entradas de itens que não existem mais.
  conteudo.ordem = conteudo.ordem.filter(t => {
    if (t.tipo === 'exemplo') return conteudo.exemplo.some(i => i._id === t.id);
    if (t.tipo === 'checagem') return conteudo.checagem.some(i => i._id === t.id);
    return true;
  });

  const presentes = new Set(conteudo.ordem.map(t => `${t.tipo}:${t.id || ''}`));
  if (!presentes.has('antesComecar:')) conteudo.ordem.unshift({ tipo: 'antesComecar' });
  conteudo.exemplo.forEach(item => {
    if (!presentes.has(`exemplo:${item._id}`)) conteudo.ordem.push({ tipo: 'exemplo', id: item._id });
  });
  conteudo.checagem.forEach(item => {
    if (!presentes.has(`checagem:${item._id}`)) conteudo.ordem.push({ tipo: 'checagem', id: item._id });
  });
  if (!presentes.has('resumo:')) conteudo.ordem.push({ tipo: 'resumo' });
  if (!presentes.has('licao:')) conteudo.ordem.push({ tipo: 'licao' });
}

const TITULO_TELA_FIXO = { antesComecar: 'Antes de começar', resumo: 'Resumo', licao: 'Lição' };

/** Monta a lista de passos a partir de conteudo.ordem — a numeração de "Exemplo N"/
 * "Checagem N" segue a posição na sequência (não a posição de criação). */
function montarPassos(conteudo) {
  garantirOrdem(conteudo);
  let numExemplo = 0;
  let numChecagem = 0;
  return conteudo.ordem.map(token => {
    if (token.tipo === 'exemplo') {
      numExemplo++;
      return { tipo: 'exemplo', idx: conteudo.exemplo.findIndex(i => i._id === token.id), id: token.id, titulo: `Exemplo ${numExemplo}` };
    }
    if (token.tipo === 'checagem') {
      numChecagem++;
      return { tipo: 'checagem', idx: conteudo.checagem.findIndex(i => i._id === token.id), id: token.id, titulo: `Checagem ${numChecagem}` };
    }
    return { tipo: token.tipo, titulo: TITULO_TELA_FIXO[token.tipo] };
  });
}

/** Abre uma aula específica no editor (chamado pela árvore da aba Estrutura). */
function abrirConteudoAula(cicloId, materiaId, aulaId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tabConteudo').classList.add('active');
  mostrarPainel('conteudo'); // pode inicializar o seletor (lazy-init) antes de sabermos a aula certa

  conteudoEstado.cicloId = cicloId;
  conteudoEstado.materiaId = materiaId;
  conteudoEstado.aulaId = aulaId;
  conteudoEstado.passoIndex = 0;
  conteudoEstado.respostaTela = 'padrao';
  const sel = document.getElementById('seletorAula');
  if (sel) sel.value = `${cicloId}:${materiaId}:${aulaId}`;
  irParaSubtabEditor();
  renderizarConteudo();
}

/* ---------------------------------------------------------------------- */
/* Sub-abas "Estrutura das telas" / "Conteúdo da aula"                     */
/* ---------------------------------------------------------------------- */

function switchSubtabConteudo(btn, sub) {
  document.querySelectorAll('.subtab-conteudo').forEach(b => b.classList.toggle('active', b === btn));
  document.getElementById('subpainelEstrutura').classList.toggle('ativo', sub === 'estrutura');
  document.getElementById('subpainelEditor').classList.toggle('ativo', sub === 'editor');
  if (sub === 'estrutura') renderEstruturaTelas();
}

function irParaSubtabEditor() {
  document.querySelectorAll('.subtab-conteudo').forEach(b => b.classList.toggle('active', b.dataset.subtab === 'editor'));
  document.getElementById('subpainelEstrutura').classList.remove('ativo');
  document.getElementById('subpainelEditor').classList.add('ativo');
}

const ICONE_TELA = {
  antesComecar: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  exemplo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  checagem: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  resumo: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>',
  licao: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
};

function renderEstruturaTelas() {
  const aula = conteudoAulaAtual();
  const lista = document.getElementById('telaLista');
  const addCards = document.getElementById('telaListaAddCards');
  if (!lista) return;
  if (!aula) { lista.innerHTML = '<p class="pp-vazio">Nenhuma aula selecionada.</p>'; addCards.innerHTML = ''; return; }

  const passos = montarPassos(aula.conteudo);
  lista.innerHTML = passos.map((passo, i) => `
      <button type="button" class="tela-row" data-idx="${i}">
        <span class="tela-row-icone tipo-${passo.tipo}">${ICONE_TELA[passo.tipo] || ''}</span>
        <span class="tela-row-label">${escaparHtml(passo.titulo)}</span>
        <span class="more" role="button" aria-label="Opções da tela" onclick="event.stopPropagation(); abrirMenuTela(event, ${i})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6E6A7A" stroke-width="2.2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </span>
      </button>`).join('');

  lista.querySelectorAll('.tela-row').forEach(row => {
    row.addEventListener('click', () => {
      conteudoEstado.passoIndex = parseInt(row.dataset.idx, 10);
      irParaSubtabEditor();
      renderizarConteudo();
    });
  });

  addCards.innerHTML = `
    <button type="button" class="add-card" id="btnAddExemploLista">
      <span class="add-card-icone">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
      <span class="add-card-textos">
        <span class="add-card-titulo">Adicionar exemplo</span>
        <span class="add-card-sub">Inclua um exemplo prático</span>
      </span>
    </button>
    <button type="button" class="add-card" id="btnAddChecagemLista">
      <span class="add-card-icone add-card-icone-checagem">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
      <span class="add-card-textos">
        <span class="add-card-titulo">Adicionar checagem</span>
        <span class="add-card-sub">Crie uma pergunta rápida</span>
      </span>
    </button>`;
  addCards.querySelector('#btnAddExemploLista').onclick = () => { adicionarItemPasso('exemplo'); irParaSubtabEditor(); };
  addCards.querySelector('#btnAddChecagemLista').onclick = () => { adicionarItemPasso('checagem'); irParaSubtabEditor(); };
}

/** Ordem livre — qualquer tela pode trocar de lugar com a vizinha, de qualquer tipo. */
function podeMoverTela(passos, idx, direcao) {
  return !!passos[idx + direcao];
}

function moverTela(idx, direcao) {
  const aula = conteudoAulaAtual();
  if (!aula) return;
  const conteudo = aula.conteudo;
  garantirOrdem(conteudo);
  const j = idx + direcao;
  if (j < 0 || j >= conteudo.ordem.length) return;
  [conteudo.ordem[idx], conteudo.ordem[j]] = [conteudo.ordem[j], conteudo.ordem[idx]];
  renderEstruturaTelas();
}

function abrirMenuTela(event, idx) {
  const aula = conteudoAulaAtual();
  const passos = montarPassos(aula.conteudo);
  const passo = passos[idx];
  const itens = [];

  if (podeMoverTela(passos, idx, -1)) itens.push({ acao: 'subir', label: '⬆️ Mover para cima', onClick: () => moverTela(idx, -1) });
  if (podeMoverTela(passos, idx, 1)) itens.push({ acao: 'descer', label: '⬇️ Mover para baixo', onClick: () => moverTela(idx, 1) });
  if (passo.tipo === 'exemplo' || passo.tipo === 'checagem') {
    itens.push({
      acao: 'excluir', label: '🗑 Excluir esta tela', onClick: () => {
        conteudoEstado.passoIndex = idx;
        removerPassoAtual();
        renderEstruturaTelas();
      },
    });
  }

  abrirMenu(event, itens);
}

function inicializarSeletorAula() {
  const sel = document.getElementById('seletorAula');
  sel.innerHTML = '';
  CICLOS.forEach(ciclo => {
    ciclo.materias.forEach(materia => {
      if (materia.aulas.length === 0) return;
      const grupo = document.createElement('optgroup');
      grupo.label = `${ciclo.titulo} — ${materia.titulo}`;
      materia.aulas.forEach(aula => {
        const opt = document.createElement('option');
        opt.value = `${ciclo.id}:${materia.id}:${aula.id}`;
        opt.textContent = aula.titulo;
        grupo.appendChild(opt);
      });
      sel.appendChild(grupo);
    });
  });

  sel.addEventListener('change', () => {
    const [c, m, a] = sel.value.split(':').map(Number);
    conteudoEstado.cicloId = c;
    conteudoEstado.materiaId = m;
    conteudoEstado.aulaId = a;
    conteudoEstado.passoIndex = 0;
    conteudoEstado.respostaTela = 'padrao';
    renderizarConteudo();
    renderEstruturaTelas();
  });

  const primeira = listarTodasAulas()[0];
  if (primeira) {
    conteudoEstado.cicloId = primeira.cicloId;
    conteudoEstado.materiaId = primeira.materiaId;
    conteudoEstado.aulaId = primeira.aulaId;
    sel.value = `${primeira.cicloId}:${primeira.materiaId}:${primeira.aulaId}`;
  }
}

function irParaPasso(delta) {
  const aula = conteudoAulaAtual();
  if (!aula) return;
  const passos = montarPassos(aula.conteudo);
  conteudoEstado.passoIndex = Math.max(0, Math.min(passos.length - 1, conteudoEstado.passoIndex + delta));
  conteudoEstado.respostaTela = 'padrao';
  renderizarConteudo();
}

/** Insere o token do novo item na ordem, logo antes do Resumo (posição "padrão" pra item novo). */
function inserirNaOrdemAntesDoResumo(conteudo, token) {
  const posResumo = conteudo.ordem.findIndex(t => t.tipo === 'resumo');
  if (posResumo === -1) conteudo.ordem.push(token);
  else conteudo.ordem.splice(posResumo, 0, token);
}

function adicionarItemPasso(tipoLista) {
  const aula = conteudoAulaAtual();
  if (!aula) return;
  const conteudo = aula.conteudo;
  garantirOrdem(conteudo);
  const id = proximoIdItem(conteudo);
  if (tipoLista === 'exemplo') {
    conteudo.exemplo.push({ _id: id, tipo: 'acao', texto: '', conclusao: '', obs: '', pontos: [] });
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'exemplo', id });
  } else if (tipoLista === 'checagem') {
    conteudo.checagem.push({ _id: id, titulo: '', opcoes: ['', ''], correta: 0, feedback: '' });
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'checagem', id });
  } else {
    return;
  }
  conteudoEstado.passoIndex = conteudo.ordem.findIndex(t => t.tipo === tipoLista && t.id === id);
  renderizarConteudo();
}

function removerPassoAtual() {
  const aula = conteudoAulaAtual();
  if (!aula) return;
  const conteudo = aula.conteudo;
  const passos = montarPassos(conteudo);
  const passo = passos[conteudoEstado.passoIndex];
  if (passo.tipo === 'exemplo') conteudo.exemplo.splice(passo.idx, 1);
  else if (passo.tipo === 'checagem') conteudo.checagem.splice(passo.idx, 1);
  else return;
  conteudo.ordem = conteudo.ordem.filter(t => !(t.tipo === passo.tipo && t.id === passo.id));
  conteudoEstado.passoIndex = Math.max(0, conteudoEstado.passoIndex - 1);
  renderizarConteudo();
}

function tokenizarFrase(frase) {
  const bruta = frase.trim().split(/\s+/).filter(Boolean);
  const tokens = [];
  bruta.forEach(palavra => {
    const m = palavra.match(/^(.+?)([.,!?;:]+)$/);
    if (m) { tokens.push(m[1]); tokens.push(m[2]); }
    else tokens.push(palavra);
  });
  return tokens;
}
const ehPontuacao = tok => /^[.,!?;:]+$/.test(tok);

function escaparHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function opcoesTipoIcone(selecionado) {
  return TIPOS_ICONE.map(t => `<option value="${t}" ${t === selecionado ? 'selected' : ''}>${t}</option>`).join('');
}

/* ---------------------------------------------------------------------- */
/* Render principal                                                        */
/* ---------------------------------------------------------------------- */

function renderizarConteudo() {
  const aula = conteudoAulaAtual();
  const formEl = document.getElementById('formPasso');
  const addRemoveEl = document.getElementById('stepAddRemove');
  if (!aula) {
    formEl.innerHTML = '<p class="pp-vazio">Nenhuma aula selecionada.</p>';
    return;
  }

  const passos = montarPassos(aula.conteudo);
  conteudoEstado.passoIndex = Math.max(0, Math.min(passos.length - 1, conteudoEstado.passoIndex));
  const passo = passos[conteudoEstado.passoIndex];

  document.getElementById('passoContagem').textContent = `Passo ${conteudoEstado.passoIndex + 1} de ${passos.length}`;
  document.getElementById('passoTitulo').textContent = passo.titulo;
  document.getElementById('passoAnterior').disabled = conteudoEstado.passoIndex === 0;
  document.getElementById('passoProximo').disabled = conteudoEstado.passoIndex === passos.length - 1;

  document.getElementById('stepDots').innerHTML = passos.map((_, i) =>
    `<span class="step-dot ${i === conteudoEstado.passoIndex ? 'ativo' : (i < conteudoEstado.passoIndex ? 'feito' : '')}"></span>`
  ).join('');

  addRemoveEl.innerHTML = '';
  if (passo.tipo === 'exemplo' || passo.tipo === 'checagem') {
    const btnRemover = document.createElement('button');
    btnRemover.className = 'remover';
    btnRemover.textContent = passo.tipo === 'exemplo' ? '🗑 Remover este exemplo' : '🗑 Remover esta checagem';
    btnRemover.onclick = removerPassoAtual;
    addRemoveEl.appendChild(btnRemover);
  }

  const renderers = {
    antesComecar: renderFormAntesComecar,
    exemplo: renderFormExemplo,
    checagem: renderFormChecagem,
    resumo: renderFormResumo,
    licao: renderFormLicao,
  };
  renderers[passo.tipo](formEl, aula.conteudo, passo);

  // Caixa "tela atual" — sempre mostra o passo sendo editado, sem navegação própria.
  renderPreviewTela(aula, passos, passo);
  // Caixa "aula" — navegação independente (irParaPassoAula), não muda com o formulário.
  renderPreviewAula();
}

/* ---------------------------------------------------------------------- */
/* Formulários                                                             */
/* ---------------------------------------------------------------------- */

function renderFormAntesComecar(el, conteudo) {
  const d = conteudo.antesComecar;
  el.innerHTML = `
    <div class="form-secao">
      <div class="campo"><label>Título</label><input type="text" data-f="titulo"></div>
      <div class="campo"><label>Descrição</label><textarea data-f="descricao"></textarea></div>
      <div class="campo"><label>O que você vai aprender</label><textarea data-f="aprender"></textarea></div>
      <div class="campo"><label>Por que isso importa</label><textarea data-f="importancia"></textarea></div>
    </div>`;
  el.querySelectorAll('[data-f]').forEach(input => {
    input.value = d[input.dataset.f] || '';
    input.addEventListener('input', () => { d[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
}

function renderFormExemplo(el, conteudo, passo) {
  const item = conteudo.exemplo[passo.idx];
  if (!item.pontos) item.pontos = [];
  el.innerHTML = `
    <div class="form-secao">
      <div class="campo"><label>Tipo (ícone)</label><select data-f="tipo">${opcoesTipoIcone(item.tipo)}</select></div>
      <div class="campo"><label>Texto</label><textarea data-f="texto"></textarea></div>
      <div class="campo"><label>Conclusão (opcional)</label><textarea data-f="conclusao"></textarea></div>
      <div class="campo"><label>Observação (opcional)</label><textarea data-f="obs"></textarea></div>
      <div class="secao-titulo-editor">Pontos (opcional — lista usada no tipo "dica")</div>
      <div class="lista-itens" id="listaPontos"></div>
      <button class="btn-add-item" type="button">+ Adicionar ponto</button>
    </div>`;
  el.querySelectorAll('[data-f]').forEach(input => {
    input.value = item[input.dataset.f] || '';
    input.addEventListener('input', () => { item[input.dataset.f] = input.value; renderPreviewAtual(); });
  });

  const listaPontos = el.querySelector('#listaPontos');
  function renderPontos() {
    listaPontos.innerHTML = '';
    item.pontos.forEach((ponto, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo"><strong>Ponto ${i + 1}</strong><button class="btn-remover-item" type="button">Remover</button></div>
        <div class="campo"><select data-pf="tipo">${opcoesTipoIcone(ponto.tipo)}</select></div>
        <div class="campo"><input type="text" data-pf="texto" placeholder="Texto do ponto"></div>`;
      card.querySelector('[data-pf="tipo"]').value = ponto.tipo || 'dica';
      card.querySelector('[data-pf="texto"]').value = ponto.texto || '';
      card.querySelector('[data-pf="tipo"]').addEventListener('change', e => { ponto.tipo = e.target.value; renderPreviewAtual(); });
      card.querySelector('[data-pf="texto"]').addEventListener('input', e => { ponto.texto = e.target.value; renderPreviewAtual(); });
      card.querySelector('.btn-remover-item').addEventListener('click', () => { item.pontos.splice(i, 1); renderPontos(); renderPreviewAtual(); });
      listaPontos.appendChild(card);
    });
  }
  renderPontos();
  el.querySelector('.btn-add-item').addEventListener('click', () => { item.pontos.push({ tipo: 'dica', texto: '' }); renderPontos(); renderPreviewAtual(); });
}

function renderFormChecagem(el, conteudo, passo) {
  const item = conteudo.checagem[passo.idx];
  const modo = Array.isArray(item.sentenca) ? 'palavra' : 'multipla';

  el.innerHTML = `
    <div class="form-secao">
      <div class="campo">
        <label>Tipo de exercício</label>
        <select id="modoChecagem">
          <option value="multipla" ${modo === 'multipla' ? 'selected' : ''}>Múltipla escolha</option>
          <option value="palavra" ${modo === 'palavra' ? 'selected' : ''}>Clique na palavra</option>
        </select>
      </div>
      <div id="corpoChecagem"></div>
    </div>`;

  el.querySelector('#modoChecagem').addEventListener('change', e => {
    const novoModo = e.target.value;
    if (novoModo === 'palavra') {
      conteudo.checagem[passo.idx] = { titulo: item.titulo || '', sentenca: [], classes: [], correta: 0, feedback: item.feedback || '' };
    } else {
      conteudo.checagem[passo.idx] = { titulo: item.titulo || '', opcoes: ['', ''], correta: 0, feedback: item.feedback || '' };
    }
    renderFormChecagem(el, conteudo, passo);
    renderPreviewAtual();
  });

  const corpo = el.querySelector('#corpoChecagem');
  if (modo === 'multipla') renderCorpoChecagemMultipla(corpo, item);
  else renderCorpoChecagemPalavra(corpo, item);
}

function renderCorpoChecagemMultipla(corpo, item) {
  if (!Array.isArray(item.opcoes) || item.opcoes.length < 2) item.opcoes = ['', ''];
  corpo.innerHTML = `
    <div class="campo-check"><input type="checkbox" id="chkInvertido"><label for="chkInvertido">Mostrar subtítulo antes do título (invertido)</label></div>
    <div class="campo-linha">
      <div class="campo"><label>Dificuldade</label>
        <select data-f="dificuldade"><option value="">—</option><option>Fácil</option><option>Médio</option><option>Difícil</option></select>
      </div>
    </div>
    <div class="campo"><label>Subtítulo (opcional)</label><input type="text" data-f="subtitulo"></div>
    <div class="campo"><label>Título / pergunta</label><textarea data-f="titulo"></textarea></div>
    <div class="secao-titulo-editor">Alternativas (marque a correta)</div>
    <div class="lista-itens" id="listaOpcoes"></div>
    <button class="btn-add-item" type="button" id="btnAddOpcao">+ Adicionar alternativa</button>
    <div class="campo" style="margin-top:12px"><label>Feedback</label><textarea data-f="feedback"></textarea></div>`;

  corpo.querySelector('#chkInvertido').checked = !!item.invertido;
  corpo.querySelector('#chkInvertido').addEventListener('change', e => { item.invertido = e.target.checked; renderPreviewAtual(); });
  corpo.querySelectorAll('[data-f]').forEach(input => {
    input.value = item[input.dataset.f] || '';
    input.addEventListener('input', () => { item[input.dataset.f] = input.value; renderPreviewAtual(); });
  });

  const listaOpcoes = corpo.querySelector('#listaOpcoes');
  function renderOpcoes() {
    listaOpcoes.innerHTML = '';
    item.opcoes.forEach((texto, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo">
          <strong><input type="radio" name="opcaoCorreta" ${item.correta === i ? 'checked' : ''}> Correta</strong>
          <button class="btn-remover-item" type="button">Remover</button>
        </div>
        <input type="text" data-of>`;
      card.querySelector('[data-of]').value = texto;
      card.querySelector('[data-of]').addEventListener('input', e => { item.opcoes[i] = e.target.value; renderPreviewAtual(); });
      card.querySelector('input[type="radio"]').addEventListener('change', () => { item.correta = i; renderPreviewAtual(); });
      card.querySelector('.btn-remover-item').addEventListener('click', () => {
        item.opcoes.splice(i, 1);
        if (item.correta >= item.opcoes.length) item.correta = 0;
        renderOpcoes(); renderPreviewAtual();
      });
      listaOpcoes.appendChild(card);
    });
  }
  renderOpcoes();
  corpo.querySelector('#btnAddOpcao').addEventListener('click', () => { item.opcoes.push(''); renderOpcoes(); renderPreviewAtual(); });
}

function renderCorpoChecagemPalavra(corpo, item) {
  if (!Array.isArray(item.sentenca)) item.sentenca = [];
  if (!Array.isArray(item.classes)) item.classes = [];
  const fraseAtual = item.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  corpo.innerHTML = `
    <div class="campo"><label>Título / instrução</label><input type="text" data-f="titulo" placeholder="Ex: Clique no verbo da frase:"></div>
    <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="fraseTexto" placeholder="Ex: A Maria cantou no coral."></textarea></div>
    <div class="secao-titulo-editor">Classifique cada palavra e marque a correta</div>
    <div class="lista-itens" id="listaPalavras"></div>
    <div class="campo" style="margin-top:12px"><label>Feedback</label><textarea data-f="feedback"></textarea></div>`;

  corpo.querySelector('[data-f="titulo"]').value = item.titulo || '';
  corpo.querySelector('[data-f="titulo"]').addEventListener('input', e => { item.titulo = e.target.value; renderPreviewAtual(); });
  corpo.querySelector('[data-f="feedback"]').value = item.feedback || '';
  corpo.querySelector('[data-f="feedback"]').addEventListener('input', e => { item.feedback = e.target.value; renderPreviewAtual(); });

  const fraseInput = corpo.querySelector('#fraseTexto');
  fraseInput.value = fraseAtual;

  const listaPalavras = corpo.querySelector('#listaPalavras');
  function renderPalavras() {
    listaPalavras.innerHTML = '';
    let classeIdx = 0;
    item.sentenca.forEach((tok, i) => {
      if (ehPontuacao(tok)) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `<span style="font-size:12.5px;color:var(--text-sec)">Pontuação: "${escaparHtml(tok)}"</span>`;
        listaPalavras.appendChild(card);
        return;
      }
      const meuClasseIdx = classeIdx++;
      if (!item.classes[meuClasseIdx]) item.classes[meuClasseIdx] = { classe: '' };
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo">
          <strong>"${escaparHtml(tok)}"</strong>
          <label style="font-size:12px;display:flex;align-items:center;gap:4px;">
            <input type="radio" name="palavraCorreta" ${item.correta === i ? 'checked' : ''}> correta
          </label>
        </div>
        <input type="text" data-cf placeholder="Classe gramatical (ex: Verbo — pretérito de cantar)">`;
      card.querySelector('[data-cf]').value = item.classes[meuClasseIdx].classe || '';
      card.querySelector('[data-cf]').addEventListener('input', e => { item.classes[meuClasseIdx].classe = e.target.value; renderPreviewAtual(); });
      card.querySelector('input[type="radio"]').addEventListener('change', () => { item.correta = i; renderPreviewAtual(); });
      listaPalavras.appendChild(card);
    });
    item.classes.length = classeIdx;
  }
  renderPalavras();

  fraseInput.addEventListener('blur', () => {
    item.sentenca = tokenizarFrase(fraseInput.value);
    if (item.correta >= item.sentenca.length) item.correta = 0;
    renderPalavras();
    renderPreviewAtual();
  });
}

function renderFormResumo(el, conteudo) {
  const r = conteudo.resumo;
  el.innerHTML = `
    <div class="form-secao">
      <div class="campo"><label>Título do resumo</label><input type="text" id="resumoTitulo"></div>
      <div class="secao-titulo-editor">Itens</div>
      <div class="lista-itens" id="listaResumoItens"></div>
      <button class="btn-add-item" type="button" id="btnAddResumoItem">+ Adicionar item</button>
    </div>`;
  el.querySelector('#resumoTitulo').value = r.titulo || '';
  el.querySelector('#resumoTitulo').addEventListener('input', e => { r.titulo = e.target.value; renderPreviewAtual(); });

  const lista = el.querySelector('#listaResumoItens');
  function renderItens() {
    lista.innerHTML = '';
    r.itens.forEach((it, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo"><strong>Item ${i + 1}</strong><button class="btn-remover-item" type="button">Remover</button></div>
        <div class="campo"><select data-rf="tipo">${opcoesTipoIcone(it.tipo)}</select></div>
        <div class="campo-linha">
          <div class="campo"><label>Cor</label><input type="color" data-rf="cor"></div>
          <div class="campo"><label>Fundo</label><input type="color" data-rf="corFundo"></div>
        </div>
        <div class="campo"><input type="text" data-rf="titulo" placeholder="Título"></div>
        <div class="campo"><input type="text" data-rf="exemplos" placeholder="Ex: 5 questões"></div>`;
      card.querySelector('[data-rf="tipo"]').value = it.tipo || 'acao';
      card.querySelector('[data-rf="cor"]').value = it.cor || '#5B2BCB';
      card.querySelector('[data-rf="corFundo"]').value = it.corFundo || '#f0eaff';
      card.querySelector('[data-rf="titulo"]').value = it.titulo || '';
      card.querySelector('[data-rf="exemplos"]').value = it.exemplos || '';
      card.querySelectorAll('[data-rf]').forEach(input => {
        input.addEventListener('input', () => { it[input.dataset.rf] = input.value; renderPreviewAtual(); });
      });
      card.querySelector('.btn-remover-item').addEventListener('click', () => { r.itens.splice(i, 1); renderItens(); renderPreviewAtual(); });
      lista.appendChild(card);
    });
  }
  renderItens();
  el.querySelector('#btnAddResumoItem').addEventListener('click', () => {
    r.itens.push({ tipo: 'acao', cor: '#5B2BCB', corFundo: '#f0eaff', titulo: '', exemplos: '' });
    renderItens(); renderPreviewAtual();
  });
}

function renderFormLicao(el, conteudo) {
  const l = conteudo.licao;
  el.innerHTML = `
    <div class="form-secao">
      <div class="campo"><label>Título</label><input type="text" data-f="titulo"></div>
      <div class="campo"><label>Conteúdo (HTML simples: &lt;p&gt;, &lt;strong&gt;)</label><textarea data-f="html" rows="8"></textarea></div>
    </div>`;
  el.querySelectorAll('[data-f]').forEach(input => {
    input.value = l[input.dataset.f] || '';
    input.addEventListener('input', () => { l[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
}

/* ---------------------------------------------------------------------- */
/* Pré-visualização                                                        */
/* ---------------------------------------------------------------------- */

/** Chamada a cada tecla digitada no formulário — atualiza as duas caixas. */
function renderPreviewAtual() {
  const aula = conteudoAulaAtual();
  const passos = montarPassos(aula.conteudo);
  const passo = passos[Math.min(conteudoEstado.passoIndex, passos.length - 1)];
  renderPreviewTela(aula, passos, passo);
  renderPreviewAula();
}

const ICONE_GENERICO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5 2.3-7.2-6-4.6h7.6z"/></svg>';

/** Renderiza o corpo de um passo (função pura, sem tocar em nenhum elemento fixo). */
function corpoDoPasso(aula, passo, resp) {
  if (passo.tipo === 'antesComecar') return { html: previewAntesComecar(aula.conteudo.antesComecar), temToggle: false };
  if (passo.tipo === 'exemplo') return { html: previewExemplo(aula.conteudo.exemplo[passo.idx]), temToggle: false };
  if (passo.tipo === 'checagem') return { html: previewChecagemCorpo(aula.conteudo.checagem[passo.idx], resp), temToggle: true, item: aula.conteudo.checagem[passo.idx] };
  if (passo.tipo === 'resumo') return { html: previewResumo(aula.conteudo.resumo), temToggle: false };
  if (passo.tipo === 'licao') return { html: previewLicao(aula.conteudo.licao), temToggle: false };
  return { html: '', temToggle: false };
}

/** Preenche uma caixa player-preview (header + corpo + feedback) — reaproveitada pelas duas caixas. */
function preencherCaixaPreview(prefixo, aula, passos, indice, resp) {
  const passo = passos[indice];
  document.getElementById(`${prefixo}Info`).textContent = `Passo ${indice + 1} de ${passos.length} • ${aula.titulo}`;
  document.getElementById(`${prefixo}Progress`).innerHTML = passos.map((_, i) => {
    const cls = i < indice ? 'respondida' : (i === indice ? 'atual' : '');
    return `<div class="pp-seg ${cls}"></div>`;
  }).join('');

  const { html, temToggle, item } = corpoDoPasso(aula, passo, resp);
  document.getElementById(`${prefixo}Body`).innerHTML = html;

  const feedbackEl = document.getElementById(`${prefixo}Feedback`);
  feedbackEl.className = 'pp-feedback';
  if (temToggle && resp !== 'padrao' && item.feedback) {
    feedbackEl.style.display = 'flex';
    feedbackEl.classList.add(resp === 'acerto' ? 'acerto' : 'erro');
    feedbackEl.innerHTML = `<span>${resp === 'acerto' ? '✅' : '❌'}</span><span class="pp-feedback-texto">${escaparHtml(item.feedback)}</span>`;
  } else {
    feedbackEl.style.display = 'none';
  }

  const toggleEl = document.getElementById(`${prefixo}Toggle`);
  if (toggleEl) toggleEl.style.display = temToggle ? 'flex' : 'none';
}

/* ── Caixa "tela atual" — sempre o passo sendo editado, sem navegação própria ── */
function renderPreviewTela(aula, passos, passo) {
  const indice = passos.indexOf(passo);
  preencherCaixaPreview('preview', aula, passos, indice, conteudoEstado.respostaTela);
}

/* ── Caixa "aula" — navegação própria (‹ N/total ›), independente do formulário ── */
function renderPreviewAula() {
  const aula = conteudoAulaAtual();
  const info = document.getElementById('previewAulaInfo');
  if (!aula) { info.textContent = '—'; return; }

  const passos = montarPassos(aula.conteudo);
  conteudoEstado.aulaPassoIndex = Math.max(0, Math.min(passos.length - 1, conteudoEstado.aulaPassoIndex));
  preencherCaixaPreview('previewAula', aula, passos, conteudoEstado.aulaPassoIndex, conteudoEstado.respostaAula);

  document.getElementById('previewAulaContagem').textContent = `${conteudoEstado.aulaPassoIndex + 1}/${passos.length}`;
  document.getElementById('previewAulaAnterior').disabled = conteudoEstado.aulaPassoIndex === 0;
  document.getElementById('previewAulaProximo').disabled = conteudoEstado.aulaPassoIndex === passos.length - 1;
}

function irParaPassoAula(delta) {
  const aula = conteudoAulaAtual();
  if (!aula) return;
  const passos = montarPassos(aula.conteudo);
  conteudoEstado.aulaPassoIndex = Math.max(0, Math.min(passos.length - 1, conteudoEstado.aulaPassoIndex + delta));
  conteudoEstado.respostaAula = 'padrao';
  document.querySelectorAll('#previewAulaToggle button').forEach(b => b.classList.toggle('ativo', b.dataset.resp === 'padrao'));
  renderPreviewAula();
}

function previewAntesComecar(d) {
  if (!d.titulo && !d.descricao) return '<p class="pp-vazio">Preencha os campos ao lado para ver a prévia.</p>';
  return `
    <div class="pp-icone-circulo">${ICONE_GENERICO}</div>
    <p class="pp-titulo" style="text-align:center">${escaparHtml(d.titulo)}</p>
    <p class="pp-intro-desc">${escaparHtml(d.descricao)}</p>
    ${d.aprender ? `<div class="pp-info-box"><h3>Você vai aprender</h3><p>${escaparHtml(d.aprender)}</p></div>` : ''}
    ${d.importancia ? `<div class="pp-info-box"><h3>Por que importa</h3><p>${escaparHtml(d.importancia)}</p></div>` : ''}`;
}

function previewExemplo(item) {
  if (!item.texto) return '<p class="pp-vazio">Preencha o texto para ver a prévia.</p>';
  return `
    <div class="pp-exemplo-icone">${ICONE_GENERICO}</div>
    <p class="pp-exemplo-texto">${item.texto}</p>
    ${item.conclusao ? `<p class="pp-exemplo-conclusao">${item.conclusao}</p>` : ''}
    ${item.obs ? `<p class="pp-exemplo-texto">${item.obs}</p>` : ''}
    ${(item.pontos && item.pontos.length) ? `<div class="pp-pontos">${item.pontos.map(p => `
      <div class="pp-ponto"><div class="pp-ponto-icone">${ICONE_GENERICO}</div><p class="pp-ponto-texto">${p.texto}</p></div>`).join('')}</div>` : ''}`;
}

/** Corpo puro do exercício de checagem (sem tocar em feedback/toggle) — reaproveitado pelas duas caixas de preview. */
function previewChecagemCorpo(item, resp) {
  const modo = Array.isArray(item.sentenca) ? 'palavra' : 'multipla';

  if (modo === 'multipla') {
    if (!item.titulo && (item.opcoes || []).every(o => !o)) return '<p class="pp-vazio">Preencha o exercício para ver a prévia.</p>';
    const letras = 'ABCDEFGH';
    const cabecalho = item.invertido
      ? `<p class="pp-subtitulo">${escaparHtml(item.subtitulo || '')}</p><p class="pp-titulo">${escaparHtml(item.titulo || '')}</p>`
      : `<p class="pp-titulo">${escaparHtml(item.titulo || '')}</p>${item.subtitulo ? `<p class="pp-subtitulo">${escaparHtml(item.subtitulo)}</p>` : ''}`;
    const opcoes = (item.opcoes || []).map((texto, i) => {
      let cls = '';
      if (resp !== 'padrao') {
        if (i === item.correta) cls = 'correta';
        else if (resp === 'erro' && i === proximoIndiceErrado(item)) cls = 'errada';
      }
      return `<button class="pp-opcao ${cls}"><span class="pp-letra">${letras[i] || i + 1}</span><span>${escaparHtml(texto)}</span></button>`;
    }).join('');
    return `${cabecalho}<div class="pp-opcoes">${opcoes}</div>`;
  }

  if (!item.titulo && (!item.sentenca || item.sentenca.length === 0)) return '<p class="pp-vazio">Preencha o exercício para ver a prévia.</p>';
  const chips = (item.sentenca || []).map((tok, i) => {
    if (ehPontuacao(tok)) return `<span class="pp-chip pontuacao">${escaparHtml(tok)}</span>`;
    let cls = '';
    if (resp !== 'padrao') {
      if (i === item.correta) cls = 'correta';
      else if (resp === 'erro' && i === proximoIndiceErradoPalavra(item)) cls = 'errada';
    }
    return `<span class="pp-chip ${cls}">${escaparHtml(tok)}</span>`;
  }).join('');
  return `<p class="pp-titulo">${escaparHtml(item.titulo || '')}</p><div class="pp-sentenca">${chips}</div>`;
}

function proximoIndiceErrado(item) {
  const i = (item.opcoes || []).findIndex((_, idx) => idx !== item.correta);
  return i === -1 ? item.correta : i;
}
function proximoIndiceErradoPalavra(item) {
  const i = (item.sentenca || []).findIndex((tok, idx) => idx !== item.correta && !ehPontuacao(tok));
  return i === -1 ? item.correta : i;
}

function previewResumo(r) {
  if (!r.itens.length) return '<p class="pp-vazio">Adicione itens para ver a prévia.</p>';
  return `
    ${r.titulo ? `<p class="pp-titulo">${escaparHtml(r.titulo)}</p>` : ''}
    ${r.itens.map(it => `
      <div class="pp-resumo-item">
        <div class="pp-resumo-icone" style="background:${it.corFundo || '#eef2ff'};color:${it.cor || '#4A80F0'}">${ICONE_GENERICO}</div>
        <div class="pp-resumo-info">
          <span class="pp-resumo-titulo-item" style="color:${it.cor || '#1a1a2e'}">${escaparHtml(it.titulo)}</span>
          <span class="pp-resumo-exemplos">${escaparHtml(it.exemplos)}</span>
        </div>
      </div>`).join('')}`;
}

function previewLicao(l) {
  if (!l.html && !l.titulo) return '<p class="pp-vazio">Preencha para ver a prévia.</p>';
  return `<p class="pp-titulo">📖 ${escaparHtml(l.titulo)}</p><div class="pp-licao-corpo">${l.html}</div>`;
}

/* ---------------------------------------------------------------------- */
/* Inicialização                                                           */
/* ---------------------------------------------------------------------- */

function inicializarConteudo() {
  inicializarSeletorAula();
  document.getElementById('passoAnterior').addEventListener('click', () => irParaPasso(-1));
  document.getElementById('passoProximo').addEventListener('click', () => irParaPasso(1));
  document.getElementById('previewAulaAnterior').addEventListener('click', () => irParaPassoAula(-1));
  document.getElementById('previewAulaProximo').addEventListener('click', () => irParaPassoAula(1));

  document.querySelectorAll('#previewToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      conteudoEstado.respostaTela = btn.dataset.resp;
      document.querySelectorAll('#previewToggle button').forEach(b => b.classList.toggle('ativo', b === btn));
      renderPreviewAtual();
    });
  });
  document.querySelectorAll('#previewAulaToggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      conteudoEstado.respostaAula = btn.dataset.resp;
      document.querySelectorAll('#previewAulaToggle button').forEach(b => b.classList.toggle('ativo', b === btn));
      renderPreviewAula();
    });
  });

  renderizarConteudo();
  renderEstruturaTelas();
}
