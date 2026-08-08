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
      const idx = conteudo.exemplo.findIndex(i => i._id === token.id);
      const item = conteudo.exemplo[idx];
      const variante = item ? varianteDoExemplo(item) : 'padrao';
      const titulo = variante === 'padrao' ? `Exemplo ${numExemplo}` : NOME_TELA_ADICIONAR[`exemplo:${variante}`];
      return { tipo: 'exemplo', idx, id: token.id, titulo };
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

/** Dados de mentira só pra prévia de "que tipo de tela é essa" — nunca chegam a entrar
 * de verdade na aula (só depois que a usuária confirma em "+ Adicionar esta tela"). */
const DADOS_FICTICIOS_TELA = {
  exemplo: { tipo: 'acao', texto: 'Assim vai aparecer o texto do exemplo.', conclusao: '', obs: '', pontos: [] },
  exemploPalavraSelecionavel: {
    tipo: 'acao', texto: '',
    palavraSelecionavel: { instrucao: 'Assim vai aparecer a instrução.', sentenca: ['A', 'Maria', 'estudou', 'muito', '.'], correta: 2, rotulo: 'RÓTULO' },
  },
  exemploPalavraSelecionavelMultipla: {
    tipo: 'acao', texto: '',
    palavraSelecionavelMultipla: { instrucao: 'Assim vai aparecer a instrução.', sentenca: ['A', 'Maria', 'estudou', 'muito', '.'], corretas: [2, 3], rotulo: 'RÓTULO' },
  },
  exemploPalavraPointLabelExemplo: {
    tipo: 'acao', texto: '',
    palavraPointLabelExemplo: {
      titulo: 'Verbos de fenômeno da natureza.', tituloDestaque: [2, 3, 4],
      instrucao: 'Exemplo:', instrucaoDestaque: [],
      sentenca: ['Choveu', 'muito', 'ontem', '.'], corretas: [0], rotulo: 'VERBO',
    },
  },
  exemploPalavraMultiplosRotulos: {
    tipo: 'acao', texto: '',
    palavraMultiplosRotulos: {
      instrucao: 'Classifique cada palavra da frase:',
      sentenca: ['A', 'Maria', 'estudou', 'muito', '.'],
      rotulos: ['', 'SUJEITO', 'VERBO', 'ADVÉRBIO', ''],
    },
  },
  checagemMultipla: { titulo: 'Assim vai aparecer a pergunta da checagem.', opcoes: ['Alternativa A', 'Alternativa B', 'Alternativa C'], correta: 0 },
  checagemPalavra: { titulo: 'Assim vai aparecer a instrução da checagem.', sentenca: ['A', 'Maria', 'estudou', 'muito', '.'], correta: 2 },
};

const NOME_TELA_ADICIONAR = {
  exemplo: 'Adicionar exemplo',
  'exemplo:palavraSelecionavel': 'Palavra selecionável',
  'exemplo:palavraSelecionavelMultipla': 'Palavra selecionável (múltipla)',
  'exemplo:palavraPointLabelExemplo': 'Palavra(s) com Point Label - Exemplo',
  'exemplo:palavraMultiplosRotulos': 'Palavra(s) com Múltiplos Rótulos',
  'checagem:multipla': 'Questão múltipla escolha',
  'checagem:palavra': 'Selecione a palavra',
};

/** Tipo (e, se aplicável, a variante) escolhidos no popup "Tipo (Telas)" — ainda não
 * confirmados/adicionados à aula até clicar em "+ Adicionar esta tela". */
let tipoTelaPendente = null;
let modoTelaPendente = null;

function esconderPreviewNovaTela() {
  tipoTelaPendente = null;
  modoTelaPendente = null;
  const wrap = document.getElementById('previewNovaTelaWrap');
  if (wrap) wrap.style.display = 'none';
  const nome = document.querySelector('#btnAdicionarTela .campo-tipo-icone-nome');
  if (nome) nome.textContent = 'Selecione o tipo de tela';
}

function mostrarPreviewNovaTela(tipo, modo) {
  tipoTelaPendente = tipo;
  modoTelaPendente = modo || null;
  const aula = conteudoAulaAtual();
  document.querySelector('#btnAdicionarTela .campo-tipo-icone-nome').textContent =
    NOME_TELA_ADICIONAR[modo ? `${tipo}:${modo}` : tipo];

  const DADOS_EXEMPLO_POR_MODO = {
    palavraSelecionavel: DADOS_FICTICIOS_TELA.exemploPalavraSelecionavel,
    palavraSelecionavelMultipla: DADOS_FICTICIOS_TELA.exemploPalavraSelecionavelMultipla,
    palavraPointLabelExemplo: DADOS_FICTICIOS_TELA.exemploPalavraPointLabelExemplo,
    palavraMultiplosRotulos: DADOS_FICTICIOS_TELA.exemploPalavraMultiplosRotulos,
  };
  const body = document.getElementById('previewNovaTelaBody');
  if (tipo === 'exemplo') {
    body.innerHTML = previewExemplo(DADOS_EXEMPLO_POR_MODO[modo] || DADOS_FICTICIOS_TELA.exemplo);
  } else {
    const dados = modo === 'palavra' ? DADOS_FICTICIOS_TELA.checagemPalavra : DADOS_FICTICIOS_TELA.checagemMultipla;
    body.innerHTML = previewChecagemCorpo(dados, 'padrao');
  }

  // Cabeçalho com a mesma cor de marca das outras prévias — só pra mostrar como vai ficar,
  // por isso o "passo" é fictício (essa tela ainda nem foi adicionada de verdade).
  document.getElementById('previewNovaTelaInfo').textContent = `Nova tela • ${aula ? aula.titulo : ''}`;
  document.getElementById('previewNovaTelaProgress').innerHTML = ['', '', ''].map((_, i) =>
    `<div class="pp-seg ${i === 1 ? 'atual' : (i < 1 ? 'respondida' : '')}"></div>`
  ).join('');

  document.getElementById('previewNovaTelaWrap').style.display = '';
}

function renderEstruturaTelas() {
  const aula = conteudoAulaAtual();
  const lista = document.getElementById('telaLista');
  if (!lista) return;
  esconderPreviewNovaTela();
  if (!aula) { lista.innerHTML = '<p class="pp-vazio">Nenhuma aula selecionada.</p>'; return; }

  const passos = montarPassos(aula.conteudo);
  const linhasTelas = passos.map((passo, i) => `
      <button type="button" class="tela-row" data-idx="${i}">
        <span class="tela-row-icone tipo-${passo.tipo}">${ICONE_TELA[passo.tipo] || ''}</span>
        <span class="tela-row-label">${escaparHtml(passo.titulo)}</span>
        <span class="more" role="button" aria-label="Opções da tela" onclick="event.stopPropagation(); abrirMenuTela(event, ${i})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6E6A7A" stroke-width="2.2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </span>
      </button>`).join('');

  lista.innerHTML = linhasTelas;

  lista.querySelectorAll('.tela-row').forEach(row => {
    row.addEventListener('click', () => {
      conteudoEstado.passoIndex = parseInt(row.dataset.idx, 10);
      irParaSubtabEditor();
      renderizarConteudo();
    });
  });

  const btnAdicionar = document.getElementById('btnAdicionarTela');
  if (btnAdicionar) {
    const ICONE_PALAVRA = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>';
    const ICONE_ROTULO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828z"/><circle cx="7.5" cy="7.5" r="1.5" fill="#fff" stroke="none"/></svg>';
    btnAdicionar.onclick = () => {
      abrirEscolha('Tipo (Telas)', [
        {
          label: 'Adicionar exemplo', sublabel: 'Inclua um exemplo prático', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_TELA.exemplo, '#4A80F0'),
          onClick: () => mostrarPreviewNovaTela('exemplo'),
        },
        {
          label: 'Palavra selecionável', sublabel: 'Clique na palavra e mostra um rótulo (ex: VERBO)', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_ROTULO, '#8B5CF6'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'palavraSelecionavel'),
        },
        {
          label: 'Palavra selecionável (múltipla)', sublabel: 'Clique em várias palavras pra revelar o rótulo', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_ROTULO, '#7C3AED'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'palavraSelecionavelMultipla'),
        },
        {
          label: 'Palavra(s) com Point Label - Exemplo', sublabel: 'Sem clique — já mostra a(s) palavra(s) e o rótulo, só ilustrativo', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_ROTULO, '#0D9488'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'palavraPointLabelExemplo'),
        },
        {
          label: 'Palavra(s) com Múltiplos Rótulos', sublabel: 'Cada palavra clicada pode ter seu próprio rótulo (ex: SUJEITO, VERBO...)', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_ROTULO, '#DB2777'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'palavraMultiplosRotulos'),
        },
        {
          label: 'Questão múltipla escolha', sublabel: 'Crie uma pergunta com alternativas', grupo: 'Questão',
          iconeHtml: badgeIcone(ICONE_TELA.checagem, '#4A7AEA'),
          onClick: () => mostrarPreviewNovaTela('checagem', 'multipla'),
        },
        {
          label: 'Selecione a palavra', sublabel: 'A aluna clica na palavra certa da frase', grupo: 'Questão',
          iconeHtml: badgeIcone(ICONE_PALAVRA, '#0EA5E9'),
          onClick: () => mostrarPreviewNovaTela('checagem', 'palavra'),
        },
      ]);
    };
  }
  document.getElementById('btnCancelarAddTela').onclick = () => esconderPreviewNovaTela();
  document.getElementById('btnConfirmarAddTela').onclick = () => {
    if (!tipoTelaPendente) return;
    adicionarItemPasso(tipoTelaPendente, modoTelaPendente);
    irParaSubtabEditor();
  };
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

function adicionarItemPasso(tipoLista, variante) {
  const aula = conteudoAulaAtual();
  if (!aula) return;
  const conteudo = aula.conteudo;
  garantirOrdem(conteudo);
  const id = proximoIdItem(conteudo);
  if (tipoLista === 'exemplo') {
    const novoExemplo = { _id: id, tipo: 'acao', texto: '', conclusao: '', obs: '', pontos: [] };
    if (variante === 'palavraSelecionavel') {
      novoExemplo.palavraSelecionavel = { instrucao: '', sentenca: [], correta: 0, rotulo: '' };
    } else if (variante === 'palavraSelecionavelMultipla') {
      novoExemplo.palavraSelecionavelMultipla = { instrucao: '', sentenca: [], corretas: [], rotulo: '' };
    } else if (variante === 'palavraPointLabelExemplo') {
      novoExemplo.palavraPointLabelExemplo = { titulo: '', tituloDestaque: [], subtitulo: '', subtituloDestaque: [], instrucao: '', instrucaoDestaque: [], sentenca: [], corretas: [], rotulo: '' };
    } else if (variante === 'palavraMultiplosRotulos') {
      novoExemplo.palavraMultiplosRotulos = { instrucao: '', sentenca: [], rotulos: [] };
    }
    conteudo.exemplo.push(novoExemplo);
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'exemplo', id });
  } else if (tipoLista === 'checagem') {
    const base = { _id: id, titulo: '', correta: 0, feedbackCorreto: '', feedbackErrado: '' };
    conteudo.checagem.push(variante === 'palavra' ? { ...base, sentenca: [], classes: [] } : { ...base, opcoes: ['', ''] });
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

/** Monta, dentro de wrapEl, a lista das frases (de `campos`) que tiverem texto, um seletor
 * "Qual frase você quer destacar" e só DEPOIS de escolher uma é que aparece a lista de checkboxes
 * pra marcar quais palavras ficam destacadas em azul. Usado em vários cards (Exemplo, Palavra
 * selecionável, Checagem, etc). `campos` é [{ rotulo, campo }] — o campo que guarda os índices
 * destacados é sempre `${campo}Destaque`. Retorna a função de re-render, pra chamar no blur do
 * campo de texto correspondente. */
function montarDestaqueFrases(wrapEl, obj, campos) {
  let selecionado = null;

  function renderDestaques() {
    const presentes = campos.filter(c => obj[c.campo] && obj[c.campo].trim());
    if (!presentes.length) {
      wrapEl.innerHTML = '<p class="pp-vazio">Escreva algum texto acima pra escolher as palavras em destaque.</p>';
      return;
    }
    if (!presentes.some(c => c.campo === selecionado)) selecionado = null;

    wrapEl.innerHTML = `
      <div class="pp-destaque-frases-lista">
        ${presentes.map(c => `<p class="pp-destaque-frase-item"><strong>${escaparHtml(c.rotulo)}:</strong> "${escaparHtml(obj[c.campo])}"</p>`).join('')}
      </div>
      <div class="campo">
        <label>Qual frase você quer destacar palavras?</label>
        <select id="destaqueSelectFrase">
          <option value="">Selecione a frase...</option>
          ${presentes.map(c => `<option value="${c.campo}"${selecionado === c.campo ? ' selected' : ''}>${escaparHtml(c.rotulo)}</option>`).join('')}
        </select>
      </div>
      <div class="lista-itens" id="destaqueChecklistArea"></div>`;

    const checklistArea = wrapEl.querySelector('#destaqueChecklistArea');
    function renderChecklist() {
      checklistArea.innerHTML = '';
      const c = presentes.find(p => p.campo === selecionado);
      if (!c) return;
      const destaqueCampo = `${c.campo}Destaque`;
      if (!obj[destaqueCampo]) obj[destaqueCampo] = [];
      const tokens = tokenizarFrase(obj[c.campo]);
      tokens.forEach((tok, i) => {
        if (ehPontuacao(tok)) return;
        const label = document.createElement('label');
        label.style.cssText = 'font-size:13px;display:flex;align-items:center;gap:8px;';
        label.innerHTML = `<input type="checkbox" ${obj[destaqueCampo].includes(i) ? 'checked' : ''}> "${escaparHtml(tok)}"`;
        label.querySelector('input').addEventListener('change', e => {
          if (e.target.checked) { if (!obj[destaqueCampo].includes(i)) obj[destaqueCampo].push(i); }
          else { const pos = obj[destaqueCampo].indexOf(i); if (pos !== -1) obj[destaqueCampo].splice(pos, 1); }
          renderPreviewAtual();
        });
        checklistArea.appendChild(label);
      });
    }
    renderChecklist();

    wrapEl.querySelector('#destaqueSelectFrase').addEventListener('change', e => {
      selecionado = e.target.value || null;
      renderChecklist();
    });
  }
  renderDestaques();
  return renderDestaques;
}

/** Corta do array de destaque os índices que não existem mais (ou que agora caem em cima de
 * pontuação) depois de editar o texto do campo — evita que uma vírgula/ponto fique azul só
 * porque o texto mudou e empurrou a pontuação pra posição de uma palavra que já estava marcada. */
function podarDestaque(obj, campo) {
  const destaqueCampo = `${campo}Destaque`;
  const tokens = tokenizarFrase(obj[campo] || '');
  obj[destaqueCampo] = (obj[destaqueCampo] || []).filter(i => i < tokens.length && !ehPontuacao(tokens[i]));
}

/** Linha de label com botões "B"/"I" pra ligar/desligar negrito e itálico no texto inteiro
 * daquele campo — usa no lugar de um `<label>` simples. `campo` é o nome do campo no objeto
 * (os flags ficam em `${campo}Negrito`/`${campo}Italico`). */
function htmlLabelComEstilo(label, campo) {
  return `<div class="campo-label-linha">
    <label>${label}</label>
    <div class="campo-estilo-botoes">
      <button type="button" class="btn-estilo-texto" data-estilo-campo="${campo}" data-estilo-tipo="Negrito" title="Negrito"><strong>B</strong></button>
      <button type="button" class="btn-estilo-texto" data-estilo-campo="${campo}" data-estilo-tipo="Italico" title="Itálico"><em>I</em></button>
    </div>
  </div>`;
}

/** Liga todos os botões "B"/"I" (de htmlLabelComEstilo) dentro de `container` — cada clique liga/
 * desliga `obj[campo + 'Negrito']` ou `obj[campo + 'Italico']` e atualiza a prévia. */
function ligarBotoesEstiloTexto(container, obj) {
  container.querySelectorAll('.btn-estilo-texto').forEach(btn => {
    const flagCampo = `${btn.dataset.estiloCampo}${btn.dataset.estiloTipo}`;
    btn.classList.toggle('ativo', !!obj[flagCampo]);
    btn.addEventListener('click', () => {
      obj[flagCampo] = !obj[flagCampo];
      btn.classList.toggle('ativo', obj[flagCampo]);
      renderPreviewAtual();
    });
  });
}

/** Monta o atributo style="..." (negrito/itálico) pro texto inteiro de um campo, a partir dos
 * flags `${campo}Negrito`/`${campo}Italico` ligados pelos botões B/I. */
function estiloTextoInline(obj, campo, extraCss) {
  const partes = [];
  if (extraCss) partes.push(extraCss);
  if (obj[`${campo}Negrito`]) partes.push('font-weight:700');
  if (obj[`${campo}Italico`]) partes.push('font-style:italic');
  return partes.length ? ` style="${partes.join(';')}"` : '';
}

function escaparHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Migra o campo antigo "feedback" (um só, pra acerto e erro) pros novos feedbackCorreto/feedbackErrado,
 * na primeira vez que o item é aberto no editor — sem isso, itens salvos antes dessa mudança perderiam
 * o texto que já tinham. */
function migrarFeedbackChecagem(item) {
  if (item.feedbackCorreto === undefined && item.feedbackErrado === undefined) {
    item.feedbackCorreto = item.feedback || '';
    item.feedbackErrado = item.feedback || '';
    delete item.feedback;
  }
}

/** Nome curto e descrição de cada TIPOS_ICONE (js/data.js) — pra mostrar no seletor de tipo, já
 * que os valores internos ("predVerboNominal", "semSujeito"...) não são legíveis sozinhos. */
const NOME_TIPO_ICONE = {
  acao: 'Ação', estado: 'Estado', mudanca: 'Mudança', fenomeno: 'Fenômeno', infinito: 'Infinitivo',
  conjugar: 'Conjugação', gota: 'Gota', peca: 'Peça', foguete: 'Foguete', sujeito: 'Sujeito',
  fala: 'Fala', busca: 'Busca', tarefa: 'Tarefa', pergunta: 'Pergunta', dica: 'Dica',
  predVerbal: 'Predicado verbal', predNominal: 'Predicado nominal', predVerboNominal: 'Predicado verbo-nominal',
  semSujeito: 'Oração sem sujeito', externo: 'Ícone externo (link)',
};
const DESC_TIPO_ICONE = {
  acao: 'Verbo que indica uma ação', estado: 'Verbo de ligação/estado', mudanca: 'Indica mudança ou transformação',
  fenomeno: 'Fenômeno da natureza', infinito: 'Forma infinitiva do verbo', conjugar: 'Conjugação verbal',
  gota: 'Ícone de gota/líquido', peca: 'Ícone de peça/engrenagem', foguete: 'Ícone de foguete',
  sujeito: 'Sujeito da oração', fala: 'Fala ou discurso direto', busca: 'Busca ou pesquisa',
  tarefa: 'Tarefa ou lista', pergunta: 'Pergunta', dica: 'Dica ou observação',
  predVerbal: 'Predicado verbal', predNominal: 'Predicado nominal', predVerboNominal: 'Predicado verbo-nominal',
  semSujeito: 'Oração sem sujeito', externo: 'Envie o link de uma imagem em vez de escolher um ícone pronto',
};

/** Selo/badge quadrado arredondado com um ícone dentro — usado nas linhas dos popups de escolha
 * (abrirEscolha), tanto pro "Tipo (ícone)" quanto pro "Tipo (Telas)". */
function badgeIcone(svgHtml, corFundo) {
  return `<span class="badge-icone" style="background:${corFundo}">${svgHtml}</span>`;
}

/** Botão que mostra o ícone/nome escolhido e, ao clicar, abre a lista (abrirEscolha, igual "Nova etapa")
 * com todos os tipos — cada linha já com o ícone de verdade, na cor real, e uma descrição curta. */
function htmlTipoIconePicker(item, cor) {
  return `<div class="linha-tipo-icone">
    <button type="button" class="campo-tipo-icone-trigger">
      <span class="campo-tipo-icone-preview">${iconeTipo(item.tipo, cor, item.iconeUrl)}</span>
      <span class="campo-tipo-icone-nome">${escaparHtml(NOME_TIPO_ICONE[item.tipo] || item.tipo)}</span>
      <svg class="campo-tipo-icone-seta" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <button type="button" class="btn-icone-externo${item.tipo === 'externo' ? ' ativo' : ''}" title="Usar ícone externo (link)">🔗</button>
  </div>`;
}

/** Liga o gatilho de htmlTipoIconePicker(): clicar nele abre a lista de tipos (com ícone+descrição,
 * igual a estrutura já usada em "Nova etapa"); clicar no "🔗" ao lado vai direto pro ícone externo. */
function ligarTipoIconePicker(container, item, cor, aoMudar) {
  const trigger = container.querySelector('.campo-tipo-icone-trigger');
  const botaoExterno = container.querySelector('.btn-icone-externo');

  function selecionar(tipo) {
    item.tipo = tipo;
    trigger.querySelector('.campo-tipo-icone-preview').innerHTML = iconeTipo(item.tipo, cor, item.iconeUrl);
    trigger.querySelector('.campo-tipo-icone-nome').textContent = NOME_TIPO_ICONE[tipo] || tipo;
    botaoExterno.classList.toggle('ativo', tipo === 'externo');
    const campoUrl = container.querySelector('.campo-icone-externo');
    if (campoUrl) campoUrl.style.display = tipo === 'externo' ? '' : 'none';
    aoMudar();
  }

  trigger.addEventListener('click', () => {
    const itens = [...TIPOS_ICONE, 'externo'].map(t => ({
      label: NOME_TIPO_ICONE[t] || t,
      sublabel: DESC_TIPO_ICONE[t] || '',
      iconeHtml: badgeIcone(iconeTipo(t, cor), '#f5f5fa'),
      onClick: () => selecionar(t),
    }));
    abrirEscolha('Escolha o tipo de ícone', itens);
  });

  botaoExterno.addEventListener('click', () => {
    selecionar('externo');
    const campoUrl = container.querySelector('.campo-icone-externo');
    if (campoUrl) container.querySelector('[data-icone-url]').focus();
  });
}

/** Campo de URL do ícone externo (só visível quando o "Tipo" selecionado é "externo") — HTML pronto
 * pra colar logo depois do <select> de tipo; quem chama ainda precisa achar o input e ligar o evento. */
function htmlCampoIconeExterno(item) {
  return `<div class="campo campo-icone-externo" style="${item.tipo === 'externo' ? '' : 'display:none'}">
    <label>Link do ícone (imagem)</label>
    <input type="text" data-icone-url placeholder="https://exemplo.com/icone.png">
  </div>`;
}

/** Acha o input do htmlCampoIconeExterno() dentro de `container`, preenche com item.iconeUrl e liga o evento. */
function ligarCampoIconeExterno(container, item) {
  const input = container.querySelector('[data-icone-url]');
  input.value = item.iconeUrl || '';
  input.addEventListener('input', () => { item.iconeUrl = input.value; renderPreviewAtual(); });
}

/* ---------------------------------------------------------------------- */
/* Render principal                                                        */
/* ---------------------------------------------------------------------- */

function renderizarConteudo() {
  const aula = conteudoAulaAtual();
  const formEl = document.getElementById('formPasso');
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
      <div class="campo">${htmlLabelComEstilo('Título', 'titulo')}<input type="text" data-f="titulo"></div>
      <div class="campo">${htmlLabelComEstilo('Descrição', 'descricao')}<textarea data-f="descricao"></textarea></div>
      <div class="campo">${htmlLabelComEstilo('O que você vai aprender', 'aprender')}<textarea data-f="aprender"></textarea></div>
      <div class="campo">${htmlLabelComEstilo('Por que isso importa', 'importancia')}<textarea data-f="importancia"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueAC"></div>
    </div>`;
  el.querySelectorAll('[data-f]').forEach(input => {
    input.value = d[input.dataset.f] || '';
    input.addEventListener('input', () => { d[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(el, d);

  const renderDestaquesAC = montarDestaqueFrases(el.querySelector('#listaDestaqueAC'), d, [
    { rotulo: 'Título', campo: 'titulo' },
    { rotulo: 'Descrição', campo: 'descricao' },
    { rotulo: 'O que você vai aprender', campo: 'aprender' },
    { rotulo: 'Por que isso importa', campo: 'importancia' },
  ]);
  el.querySelectorAll('[data-f]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(d, input.dataset.f); renderDestaquesAC(); });
  });
}

/** Qual "variante" de exemplo é essa — decidido em "Tipo (Telas)" na criação. Cada uma tem seu
 * próprio formulário focado (renderFormExemplo), sem misturar campos das outras variantes. */
function varianteDoExemplo(item) {
  if (item.palavraPointLabelExemplo) return 'palavraPointLabelExemplo';
  if (item.palavraMultiplosRotulos) return 'palavraMultiplosRotulos';
  if (item.palavraSelecionavelMultipla) return 'palavraSelecionavelMultipla';
  if (item.palavraSelecionavel) return 'palavraSelecionavel';
  return 'padrao';
}

const RENDER_BLOCO_VARIANTE = {
  palavraSelecionavel: renderBlocoPalavraSelecionavel,
  palavraSelecionavelMultipla: renderBlocoPalavraSelecionavelMultipla,
  palavraPointLabelExemplo: renderBlocoPalavraPointLabelExemplo,
  palavraMultiplosRotulos: renderBlocoPalavraMultiplosRotulos,
};

function renderFormExemplo(el, conteudo, passo) {
  const item = conteudo.exemplo[passo.idx];
  if (!item.pontos) item.pontos = [];
  const variante = varianteDoExemplo(item);

  if (variante !== 'padrao') {
    el.innerHTML = `
      <div class="form-secao">
        <div class="campo"><label>Tipo (ícone)</label>${htmlTipoIconePicker(item, '#4A80F0')}</div>
        ${htmlCampoIconeExterno(item)}
        <div id="blocoVarianteExemplo"></div>
      </div>`;
    ligarCampoIconeExterno(el, item);
    ligarTipoIconePicker(el, item, '#4A80F0', renderPreviewAtual);
    RENDER_BLOCO_VARIANTE[variante](el.querySelector('#blocoVarianteExemplo'), item);
    return;
  }

  el.innerHTML = `
    <div class="form-secao">
      <div class="campo"><label>Tipo (ícone)</label>${htmlTipoIconePicker(item, '#4A80F0')}</div>
      ${htmlCampoIconeExterno(item)}
      <div class="campo">${htmlLabelComEstilo('Texto', 'texto')}<textarea data-f="texto"></textarea></div>
      <div class="campo">${htmlLabelComEstilo('Conclusão (opcional)', 'conclusao')}<textarea data-f="conclusao"></textarea></div>
      <div class="campo">${htmlLabelComEstilo('Observação (opcional)', 'obs')}<textarea data-f="obs"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueExemplo"></div>
      <div class="secao-titulo-editor">Pontos (opcional — lista usada no tipo "dica")</div>
      <div class="lista-itens" id="listaPontos"></div>
      <button class="btn-add-item" type="button">+ Adicionar ponto</button>
    </div>`;
  el.querySelectorAll('[data-f]').forEach(input => {
    input.value = item[input.dataset.f] || '';
    input.addEventListener('input', () => { item[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
  ligarCampoIconeExterno(el, item);
  ligarTipoIconePicker(el, item, '#4A80F0', renderPreviewAtual);
  ligarBotoesEstiloTexto(el, item);

  const renderDestaquesExemplo = montarDestaqueFrases(el.querySelector('#listaDestaqueExemplo'), item, [
    { rotulo: 'Texto', campo: 'texto' },
    { rotulo: 'Conclusão', campo: 'conclusao' },
    { rotulo: 'Observação', campo: 'obs' },
  ]);
  el.querySelectorAll('[data-f]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(item, input.dataset.f); renderDestaquesExemplo(); });
  });

  const listaPontos = el.querySelector('#listaPontos');
  function renderPontos() {
    listaPontos.innerHTML = '';
    item.pontos.forEach((ponto, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo"><strong>Ponto ${i + 1}</strong><button class="btn-remover-item" type="button">Remover</button></div>
        <div class="campo">${htmlTipoIconePicker(ponto, '#4A80F0')}</div>
        ${htmlCampoIconeExterno(ponto)}
        <div class="campo">${htmlLabelComEstilo('Texto do ponto', 'texto')}<input type="text" data-pf="texto" placeholder="Texto do ponto"></div>
        <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
        <div id="listaDestaquePonto${i}"></div>`;
      card.querySelector('[data-pf="texto"]').value = ponto.texto || '';
      ligarBotoesEstiloTexto(card, ponto);
      ligarCampoIconeExterno(card, ponto);
      ligarTipoIconePicker(card, ponto, '#4A80F0', renderPreviewAtual);
      card.querySelector('[data-pf="texto"]').addEventListener('input', e => { ponto.texto = e.target.value; renderPreviewAtual(); });
      const renderDestaquesPonto = montarDestaqueFrases(card.querySelector(`#listaDestaquePonto${i}`), ponto, [
        { rotulo: 'Texto do ponto', campo: 'texto' },
      ]);
      card.querySelector('[data-pf="texto"]').addEventListener('blur', () => { podarDestaque(ponto, 'texto'); renderDestaquesPonto(); });
      card.querySelector('.btn-remover-item').addEventListener('click', () => { item.pontos.splice(i, 1); renderPontos(); renderPreviewAtual(); });
      listaPontos.appendChild(card);
    });
  }
  renderPontos();
  el.querySelector('.btn-add-item').addEventListener('click', () => { item.pontos.push({ tipo: 'dica', texto: '' }); renderPontos(); renderPreviewAtual(); });
}

/** "Palavra selecionável" — clique numa palavra da frase e mostra um rótulo de texto livre
 * embaixo dela (a pessoa que monta a aula escolhe a frase, qual palavra é a certa e o rótulo).
 * Opcional: fica null até a usuária clicar em "+ Adicionar seleção de palavra". */
function renderBlocoPalavraSelecionavel(bloco, item) {
  const ps = item.palavraSelecionavel;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Palavra selecionável</strong></div>
      <div class="campo">${htmlLabelComEstilo('Instrução (opcional)', 'instrucao')}<input type="text" data-psf="instrucao" placeholder="Ex: Selecione o verbo abaixo:"></div>
      <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="psFraseTexto" placeholder="Ex: A Maria estudou muito."></textarea></div>
      <div class="secao-titulo-editor">Marque a palavra certa</div>
      <div class="lista-itens" id="listaPalavrasSelecionaveis"></div>
      <div class="campo" style="margin-top:12px"><label>Rótulo (aparece embaixo da palavra ao acertar)</label><input type="text" data-psf="rotulo" placeholder="Ex: VERBO"></div>
      <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaquePS"></div>
    </div>`;

  ligarBotoesEstiloTexto(bloco, ps);
  const renderDestaquesPS = montarDestaqueFrases(bloco.querySelector('#listaDestaquePS'), ps, [
    { rotulo: 'Instrução', campo: 'instrucao' },
  ]);
  bloco.querySelector('[data-psf="instrucao"]').addEventListener('blur', () => { podarDestaque(ps, 'instrucao'); renderDestaquesPS(); });

  bloco.querySelectorAll('[data-psf]').forEach(input => {
    input.value = ps[input.dataset.psf] || '';
    input.addEventListener('input', () => { ps[input.dataset.psf] = input.value; renderPreviewAtual(); });
  });

  const fraseInput = bloco.querySelector('#psFraseTexto');
  fraseInput.value = ps.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  const listaPalavras = bloco.querySelector('#listaPalavrasSelecionaveis');
  function renderPalavras() {
    listaPalavras.innerHTML = '';
    ps.sentenca.forEach((tok, i) => {
      if (ehPontuacao(tok)) return;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<label style="font-size:13px;display:flex;align-items:center;gap:8px;">
        <input type="radio" name="psCorreta" ${ps.correta === i ? 'checked' : ''}> "${escaparHtml(tok)}"
      </label>`;
      card.querySelector('input[type="radio"]').addEventListener('change', () => { ps.correta = i; renderPreviewAtual(); });
      listaPalavras.appendChild(card);
    });
    if (!ps.sentenca.length) listaPalavras.innerHTML = '<p class="pp-vazio">Escreva a frase acima pra escolher a palavra certa.</p>';
  }
  renderPalavras();

  fraseInput.addEventListener('blur', () => {
    ps.sentenca = tokenizarFrase(fraseInput.value);
    if (ps.correta >= ps.sentenca.length) ps.correta = 0;
    renderPalavras();
    renderPreviewAtual();
  });
}

/** Igual a renderBlocoPalavraSelecionavelMultipla, mas SEM clique — a(s) palavra(s) já aparece(m)
 * destacada(s) com o rótulo desde o início, só como ilustração (não trava o "Próximo" esperando
 * acerto). Pode marcar uma ou várias palavras (checkbox), igual a versão múltipla interativa. */
function renderBlocoPalavraPointLabelExemplo(bloco, item) {
  const ple = item.palavraPointLabelExemplo;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Palavra(s) com Point Label - Exemplo</strong></div>
      <div class="campo">${htmlLabelComEstilo('Título (opcional)', 'titulo')}<input type="text" data-plef="titulo" placeholder="Ex: Verbos de ação"></div>
      <div class="campo">${htmlLabelComEstilo('Subtítulo (opcional)', 'subtitulo')}<input type="text" data-plef="subtitulo" placeholder="Ex: Um exemplo de aplicação"></div>
      <div class="campo">${htmlLabelComEstilo('Instrução (opcional)', 'instrucao')}<input type="text" data-plef="instrucao" placeholder="Ex: Exemplo:"></div>
      <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="pleFraseTexto" placeholder="Ex: Choveu muito ontem."></textarea></div>
      <div class="secao-titulo-editor">Marque as palavras certas (pode ser mais de uma)</div>
      <div class="lista-itens" id="listaPalavrasPointLabelExemplo"></div>
      <div class="campo" style="margin-top:12px"><label>Rótulo (aparece embaixo das palavras)</label><input type="text" data-plef="rotulo" placeholder="Ex: VERBO"></div>
      <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaquePLE"></div>
    </div>`;

  bloco.querySelectorAll('[data-plef]').forEach(input => {
    input.value = ple[input.dataset.plef] || '';
    input.addEventListener('input', () => { ple[input.dataset.plef] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(bloco, ple);

  const renderDestaques = montarDestaqueFrases(bloco.querySelector('#listaDestaquePLE'), ple, [
    { rotulo: 'Título', campo: 'titulo' },
    { rotulo: 'Subtítulo', campo: 'subtitulo' },
    { rotulo: 'Instrução', campo: 'instrucao' },
  ]);
  bloco.querySelector('[data-plef="titulo"]').addEventListener('blur', () => { podarDestaque(ple, 'titulo'); renderDestaques(); });
  bloco.querySelector('[data-plef="subtitulo"]').addEventListener('blur', () => { podarDestaque(ple, 'subtitulo'); renderDestaques(); });
  bloco.querySelector('[data-plef="instrucao"]').addEventListener('blur', () => { podarDestaque(ple, 'instrucao'); renderDestaques(); });

  const fraseInput = bloco.querySelector('#pleFraseTexto');
  fraseInput.value = ple.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  const listaPalavras = bloco.querySelector('#listaPalavrasPointLabelExemplo');
  function renderPalavras() {
    listaPalavras.innerHTML = '';
    ple.sentenca.forEach((tok, i) => {
      if (ehPontuacao(tok)) return;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<label style="font-size:13px;display:flex;align-items:center;gap:8px;">
        <input type="checkbox" ${ple.corretas.includes(i) ? 'checked' : ''}> "${escaparHtml(tok)}"
      </label>`;
      card.querySelector('input[type="checkbox"]').addEventListener('change', e => {
        if (e.target.checked) { if (!ple.corretas.includes(i)) ple.corretas.push(i); }
        else { ple.corretas = ple.corretas.filter(idx => idx !== i); }
        renderPreviewAtual();
      });
      listaPalavras.appendChild(card);
    });
    if (!ple.sentenca.length) listaPalavras.innerHTML = '<p class="pp-vazio">Escreva a frase acima pra escolher as palavras.</p>';
  }
  renderPalavras();

  fraseInput.addEventListener('blur', () => {
    ple.sentenca = tokenizarFrase(fraseInput.value);
    ple.corretas = ple.corretas.filter(idx => idx < ple.sentenca.length);
    renderPalavras();
    renderPreviewAtual();
  });
}

/** Igual a renderBlocoPalavraSelecionavel, mas permite marcar VÁRIAS palavras certas (checkbox em
 * vez de rádio) — a aluna precisa clicar em todas antes de liberar o "Próximo". */
function renderBlocoPalavraSelecionavelMultipla(bloco, item) {
  const psm = item.palavraSelecionavelMultipla;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Palavra selecionável (múltipla)</strong></div>
      <div class="campo">${htmlLabelComEstilo('Instrução (opcional)', 'instrucao')}<input type="text" data-psmf="instrucao" placeholder="Ex: Selecione as palavras do predicado:"></div>
      <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="psmFraseTexto" placeholder="Ex: A Maria estudou muito ontem."></textarea></div>
      <div class="secao-titulo-editor">Marque as palavras certas (pode ser mais de uma)</div>
      <div class="lista-itens" id="listaPalavrasSelecionaveisMultipla"></div>
      <div class="campo" style="margin-top:12px"><label>Rótulo (aparece embaixo das palavras ao acertar)</label><input type="text" data-psmf="rotulo" placeholder="Ex: PREDICADO"></div>
      <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaquePSM"></div>
    </div>`;

  ligarBotoesEstiloTexto(bloco, psm);
  const renderDestaquesPSM = montarDestaqueFrases(bloco.querySelector('#listaDestaquePSM'), psm, [
    { rotulo: 'Instrução', campo: 'instrucao' },
  ]);
  bloco.querySelector('[data-psmf="instrucao"]').addEventListener('blur', () => { podarDestaque(psm, 'instrucao'); renderDestaquesPSM(); });

  bloco.querySelectorAll('[data-psmf]').forEach(input => {
    input.value = psm[input.dataset.psmf] || '';
    input.addEventListener('input', () => { psm[input.dataset.psmf] = input.value; renderPreviewAtual(); });
  });

  const fraseInput = bloco.querySelector('#psmFraseTexto');
  fraseInput.value = psm.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  const listaPalavras = bloco.querySelector('#listaPalavrasSelecionaveisMultipla');
  function renderPalavras() {
    listaPalavras.innerHTML = '';
    psm.sentenca.forEach((tok, i) => {
      if (ehPontuacao(tok)) return;
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `<label style="font-size:13px;display:flex;align-items:center;gap:8px;">
        <input type="checkbox" ${psm.corretas.includes(i) ? 'checked' : ''}> "${escaparHtml(tok)}"
      </label>`;
      card.querySelector('input[type="checkbox"]').addEventListener('change', e => {
        if (e.target.checked) { if (!psm.corretas.includes(i)) psm.corretas.push(i); }
        else { psm.corretas = psm.corretas.filter(idx => idx !== i); }
        renderPreviewAtual();
      });
      listaPalavras.appendChild(card);
    });
    if (!psm.sentenca.length) listaPalavras.innerHTML = '<p class="pp-vazio">Escreva a frase acima pra escolher as palavras certas.</p>';
  }
  renderPalavras();

  fraseInput.addEventListener('blur', () => {
    psm.sentenca = tokenizarFrase(fraseInput.value);
    psm.corretas = psm.corretas.filter(idx => idx < psm.sentenca.length);
    renderPalavras();
    renderPreviewAtual();
  });
}

/** "Palavra(s) com Múltiplos Rótulos" — clicável: cada palavra pode ter o SEU PRÓPRIO rótulo (ex:
 * "Maria" = SUJEITO, "estudou" = VERBO, "muito" = ADVÉRBIO, tudo na mesma frase). A aluna clica em
 * cada palavra marcada e o rótulo daquela palavra aparece; precisa revelar todas pra liberar o
 * "Próximo". Palavras sem rótulo ficam de fora do exercício (clique nelas conta como erro). */
function renderBlocoPalavraMultiplosRotulos(bloco, item) {
  const pmr = item.palavraMultiplosRotulos;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Palavra(s) com Múltiplos Rótulos</strong></div>
      <div class="campo">${htmlLabelComEstilo('Instrução (opcional)', 'instrucao')}<input type="text" data-pmrf="instrucao" placeholder="Ex: Classifique cada palavra da frase:"></div>
      <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="pmrFraseTexto" placeholder="Ex: A Maria estudou muito."></textarea></div>
      <div class="secao-titulo-editor">Rótulo de cada palavra (deixe em branco se não tiver rótulo)</div>
      <div class="lista-itens" id="listaPalavrasMultiplosRotulos"></div>
      <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaquePMR"></div>
    </div>`;

  ligarBotoesEstiloTexto(bloco, pmr);
  bloco.querySelectorAll('[data-pmrf]').forEach(input => {
    input.value = pmr[input.dataset.pmrf] || '';
    input.addEventListener('input', () => { pmr[input.dataset.pmrf] = input.value; renderPreviewAtual(); });
  });
  const renderDestaquesPMR = montarDestaqueFrases(bloco.querySelector('#listaDestaquePMR'), pmr, [
    { rotulo: 'Instrução', campo: 'instrucao' },
  ]);
  bloco.querySelector('[data-pmrf="instrucao"]').addEventListener('blur', () => { podarDestaque(pmr, 'instrucao'); renderDestaquesPMR(); });

  const fraseInput = bloco.querySelector('#pmrFraseTexto');
  fraseInput.value = pmr.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  const listaPalavras = bloco.querySelector('#listaPalavrasMultiplosRotulos');
  function renderPalavras() {
    listaPalavras.innerHTML = '';
    pmr.sentenca.forEach((tok, i) => {
      if (ehPontuacao(tok)) return;
      if (pmr.rotulos[i] === undefined) pmr.rotulos[i] = '';
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="campo-linha">
          <strong style="min-width:70px;display:flex;align-items:center;">"${escaparHtml(tok)}"</strong>
          <input type="text" data-rotulo placeholder="Rótulo (opcional)">
        </div>`;
      card.querySelector('[data-rotulo]').value = pmr.rotulos[i] || '';
      card.querySelector('[data-rotulo]').addEventListener('input', e => { pmr.rotulos[i] = e.target.value; renderPreviewAtual(); });
      listaPalavras.appendChild(card);
    });
    if (!pmr.sentenca.length) listaPalavras.innerHTML = '<p class="pp-vazio">Escreva a frase acima pra marcar os rótulos.</p>';
  }
  renderPalavras();

  fraseInput.addEventListener('blur', () => {
    pmr.sentenca = tokenizarFrase(fraseInput.value);
    pmr.rotulos = pmr.sentenca.map((_, i) => pmr.rotulos[i] || '');
    renderPalavras();
    renderPreviewAtual();
  });
}

function renderFormChecagem(el, conteudo, passo) {
  const item = conteudo.checagem[passo.idx];
  const modo = Array.isArray(item.sentenca) ? 'palavra' : 'multipla';

  // O tipo de exercício já foi escolhido em "Tipo (Telas)" ao criar essa checagem — sem seletor
  // duplicado aqui, só um rótulo indicando qual é.
  el.innerHTML = `
    <div class="form-secao">
      <div class="checagem-modo-rotulo">${modo === 'palavra' ? '🖱️ Selecione a palavra' : '☑️ Questão múltipla escolha'}</div>
      <div id="corpoChecagem"></div>
    </div>`;

  const corpo = el.querySelector('#corpoChecagem');
  if (modo === 'multipla') renderCorpoChecagemMultipla(corpo, item);
  else renderCorpoChecagemPalavra(corpo, item);
}

function renderCorpoChecagemMultipla(corpo, item) {
  if (!Array.isArray(item.opcoes) || item.opcoes.length < 2) item.opcoes = ['', ''];
  migrarFeedbackChecagem(item);
  corpo.innerHTML = `
    <div class="campo-check"><input type="checkbox" id="chkInvertido"><label for="chkInvertido">Subtítulo antes do título</label></div>
    <div class="campo-linha">
      <div class="campo"><label>Dificuldade</label>
        <select data-f="dificuldade"><option value="">—</option><option>Fácil</option><option>Médio</option><option>Difícil</option></select>
      </div>
    </div>
    <div class="campo">${htmlLabelComEstilo('Subtítulo (opcional)', 'subtitulo')}<input type="text" data-f="subtitulo"></div>
    <div class="campo">${htmlLabelComEstilo('Título / pergunta', 'titulo')}<textarea data-f="titulo"></textarea></div>
    <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
    <div id="listaDestaqueChecMultipla"></div>
    <div class="secao-titulo-editor">Alternativas (marque a correta)</div>
    <div class="lista-itens" id="listaOpcoes"></div>
    <button class="btn-add-item" type="button" id="btnAddOpcao">+ Adicionar alternativa</button>
    <div class="campo" style="margin-top:12px"><label>✅ Feedback quando ACERTAR</label><textarea data-f="feedbackCorreto"></textarea></div>
    <div class="campo"><label>❌ Feedback quando ERRAR</label><textarea data-f="feedbackErrado"></textarea></div>`;

  corpo.querySelector('#chkInvertido').checked = !!item.invertido;
  corpo.querySelector('#chkInvertido').addEventListener('change', e => { item.invertido = e.target.checked; renderPreviewAtual(); });
  corpo.querySelectorAll('[data-f]').forEach(input => {
    input.value = item[input.dataset.f] || '';
    input.addEventListener('input', () => { item[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(corpo, item);

  const renderDestaquesChecMultipla = montarDestaqueFrases(corpo.querySelector('#listaDestaqueChecMultipla'), item, [
    { rotulo: 'Título / pergunta', campo: 'titulo' },
    { rotulo: 'Subtítulo', campo: 'subtitulo' },
  ]);
  corpo.querySelectorAll('[data-f="titulo"], [data-f="subtitulo"]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(item, input.dataset.f); renderDestaquesChecMultipla(); });
  });

  if (!Array.isArray(item.opcoesNegrito)) item.opcoesNegrito = [];
  if (!Array.isArray(item.opcoesItalico)) item.opcoesItalico = [];
  if (!Array.isArray(item.opcoesDestaque)) item.opcoesDestaque = [];
  const listaOpcoes = corpo.querySelector('#listaOpcoes');
  function renderOpcoes() {
    listaOpcoes.innerHTML = '';
    item.opcoes.forEach((texto, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo">
          <strong><input type="radio" name="opcaoCorreta" ${item.correta === i ? 'checked' : ''}> Correta</strong>
          <div class="campo-estilo-botoes">
            <button type="button" class="btn-estilo-texto" data-opcao-estilo="Negrito" title="Negrito"><strong>B</strong></button>
            <button type="button" class="btn-estilo-texto" data-opcao-estilo="Italico" title="Itálico"><em>I</em></button>
          </div>
          <button class="btn-remover-item" type="button">Remover</button>
        </div>
        <input type="text" data-of>
        <div class="pp-destaque-opcao-checklist"></div>`;
      card.querySelector('[data-of]').value = texto;
      card.querySelector('[data-of]').addEventListener('input', e => { item.opcoes[i] = e.target.value; renderPreviewAtual(); });
      card.querySelector('input[type="radio"]').addEventListener('change', () => { item.correta = i; renderPreviewAtual(); });
      card.querySelectorAll('[data-opcao-estilo]').forEach(btn => {
        const arrCampo = `opcoes${btn.dataset.opcaoEstilo}`;
        btn.classList.toggle('ativo', !!item[arrCampo][i]);
        btn.addEventListener('click', () => {
          item[arrCampo][i] = !item[arrCampo][i];
          btn.classList.toggle('ativo', item[arrCampo][i]);
          renderPreviewAtual();
        });
      });
      const checklistOpcao = card.querySelector('.pp-destaque-opcao-checklist');
      function renderDestaqueOpcao() {
        checklistOpcao.innerHTML = '';
        if (!item.opcoesDestaque[i]) item.opcoesDestaque[i] = [];
        const tokens = tokenizarFrase(item.opcoes[i] || '');
        item.opcoesDestaque[i] = item.opcoesDestaque[i].filter(idx => idx < tokens.length && !ehPontuacao(tokens[idx]));
        if (!tokens.length) return;
        tokens.forEach((tok, idx) => {
          if (ehPontuacao(tok)) return;
          const label = document.createElement('label');
          label.style.cssText = 'font-size:12px;display:inline-flex;align-items:center;gap:4px;margin-right:10px;';
          label.innerHTML = `<input type="checkbox" ${item.opcoesDestaque[i].includes(idx) ? 'checked' : ''}> "${escaparHtml(tok)}"`;
          label.querySelector('input').addEventListener('change', e => {
            if (e.target.checked) { if (!item.opcoesDestaque[i].includes(idx)) item.opcoesDestaque[i].push(idx); }
            else { item.opcoesDestaque[i] = item.opcoesDestaque[i].filter(x => x !== idx); }
            renderPreviewAtual();
          });
          checklistOpcao.appendChild(label);
        });
      }
      renderDestaqueOpcao();
      card.querySelector('[data-of]').addEventListener('blur', renderDestaqueOpcao);
      card.querySelector('.btn-remover-item').addEventListener('click', () => {
        item.opcoes.splice(i, 1);
        item.opcoesNegrito.splice(i, 1);
        item.opcoesItalico.splice(i, 1);
        item.opcoesDestaque.splice(i, 1);
        if (item.correta >= item.opcoes.length) item.correta = 0;
        renderOpcoes(); renderPreviewAtual();
      });
      listaOpcoes.appendChild(card);
    });
  }
  renderOpcoes();
  corpo.querySelector('#btnAddOpcao').addEventListener('click', () => {
    item.opcoes.push('');
    item.opcoesNegrito.push(false);
    item.opcoesItalico.push(false);
    item.opcoesDestaque.push([]);
    renderOpcoes(); renderPreviewAtual();
  });
}

function renderCorpoChecagemPalavra(corpo, item) {
  if (!Array.isArray(item.sentenca)) item.sentenca = [];
  if (!Array.isArray(item.classes)) item.classes = [];
  migrarFeedbackChecagem(item);
  const fraseAtual = item.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  corpo.innerHTML = `
    <div class="campo">${htmlLabelComEstilo('Título / instrução', 'titulo')}<input type="text" data-f="titulo" placeholder="Ex: Clique no verbo da frase:"></div>
    <div class="campo">${htmlLabelComEstilo('Descrição (opcional)', 'subtitulo')}<input type="text" data-f="subtitulo" placeholder="Aparece só se você preencher"></div>
    <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="fraseTexto" placeholder="Ex: A Maria cantou no coral."></textarea></div>
    <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
    <div id="listaDestaqueChecPalavra"></div>
    <div class="secao-titulo-editor">Classifique cada palavra e marque a correta</div>
    <div class="lista-itens" id="listaPalavras"></div>
    <div class="campo" style="margin-top:12px"><label>✅ Feedback quando ACERTAR</label><textarea data-f="feedbackCorreto"></textarea></div>
    <div class="campo"><label>❌ Feedback quando ERRAR</label><textarea data-f="feedbackErrado"></textarea></div>`;

  corpo.querySelectorAll('[data-f="titulo"], [data-f="subtitulo"], [data-f="feedbackCorreto"], [data-f="feedbackErrado"]').forEach(input => {
    input.value = item[input.dataset.f] || '';
    input.addEventListener('input', () => { item[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(corpo, item);

  const renderDestaquesChecPalavra = montarDestaqueFrases(corpo.querySelector('#listaDestaqueChecPalavra'), item, [
    { rotulo: 'Título / instrução', campo: 'titulo' },
    { rotulo: 'Descrição', campo: 'subtitulo' },
  ]);
  corpo.querySelectorAll('[data-f="titulo"], [data-f="subtitulo"]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(item, input.dataset.f); renderDestaquesChecPalavra(); });
  });

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
      <div class="campo">${htmlLabelComEstilo('Título do resumo', 'titulo')}<input type="text" id="resumoTitulo"></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueResumo"></div>
      <div class="secao-titulo-editor">Itens</div>
      <div class="lista-itens" id="listaResumoItens"></div>
      <button class="btn-add-item" type="button" id="btnAddResumoItem">+ Adicionar item</button>
    </div>`;
  el.querySelector('#resumoTitulo').value = r.titulo || '';
  el.querySelector('#resumoTitulo').addEventListener('input', e => { r.titulo = e.target.value; renderPreviewAtual(); });
  ligarBotoesEstiloTexto(el, r);

  const renderDestaquesResumo = montarDestaqueFrases(el.querySelector('#listaDestaqueResumo'), r, [
    { rotulo: 'Título do resumo', campo: 'titulo' },
  ]);
  el.querySelector('#resumoTitulo').addEventListener('blur', () => { podarDestaque(r, 'titulo'); renderDestaquesResumo(); });

  const lista = el.querySelector('#listaResumoItens');
  function renderItens() {
    lista.innerHTML = '';
    r.itens.forEach((it, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo"><strong>Item ${i + 1}</strong><button class="btn-remover-item" type="button">Remover</button></div>
        <div class="campo">${htmlTipoIconePicker(it, it.cor || '#5B2BCB')}</div>
        ${htmlCampoIconeExterno(it)}
        <div class="campo-linha">
          <div class="campo"><label>Cor</label><input type="color" data-rf="cor"></div>
          <div class="campo"><label>Fundo</label><input type="color" data-rf="corFundo"></div>
        </div>
        <div class="campo">${htmlLabelComEstilo('Título', 'titulo')}<input type="text" data-rf="titulo" placeholder="Título"></div>
        <div class="campo">${htmlLabelComEstilo('Exemplos', 'exemplos')}<input type="text" data-rf="exemplos" placeholder="Ex: 5 questões"></div>
        <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
        <div id="listaDestaqueResumoItem${i}"></div>`;
      card.querySelector('[data-rf="cor"]').value = it.cor || '#5B2BCB';
      card.querySelector('[data-rf="corFundo"]').value = it.corFundo || '#f0eaff';
      card.querySelector('[data-rf="titulo"]').value = it.titulo || '';
      card.querySelector('[data-rf="exemplos"]').value = it.exemplos || '';
      card.querySelectorAll('[data-rf]').forEach(input => {
        input.addEventListener('input', () => { it[input.dataset.rf] = input.value; renderPreviewAtual(); });
      });
      ligarBotoesEstiloTexto(card, it);
      const renderDestaquesResumoItem = montarDestaqueFrases(card.querySelector(`#listaDestaqueResumoItem${i}`), it, [
        { rotulo: 'Título', campo: 'titulo' },
        { rotulo: 'Exemplos', campo: 'exemplos' },
      ]);
      card.querySelectorAll('[data-rf="titulo"], [data-rf="exemplos"]').forEach(input => {
        input.addEventListener('blur', () => { podarDestaque(it, input.dataset.rf); renderDestaquesResumoItem(); });
      });
      ligarCampoIconeExterno(card, it);
      ligarTipoIconePicker(card, it, it.cor || '#5B2BCB', renderPreviewAtual);
      // A cor do ícone (campo "Cor") pode mudar depois — atualiza o ícone mostrado no seletor de tipo.
      card.querySelector('[data-rf="cor"]').addEventListener('input', () => {
        card.querySelector('.campo-tipo-icone-preview').innerHTML = iconeTipo(it.tipo, it.cor || '#5B2BCB', it.iconeUrl);
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
      <div class="campo">${htmlLabelComEstilo('Título', 'titulo')}<input type="text" data-f="titulo"></div>
      <div class="campo"><label>Conteúdo (HTML simples: &lt;p&gt;, &lt;strong&gt;)</label><textarea data-f="html" rows="8"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueLicao"></div>
    </div>`;
  el.querySelectorAll('[data-f]').forEach(input => {
    input.value = l[input.dataset.f] || '';
    input.addEventListener('input', () => { l[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(el, l);

  const renderDestaquesLicao = montarDestaqueFrases(el.querySelector('#listaDestaqueLicao'), l, [
    { rotulo: 'Título', campo: 'titulo' },
  ]);
  el.querySelector('[data-f="titulo"]').addEventListener('blur', () => { podarDestaque(l, 'titulo'); renderDestaquesLicao(); });
}

/* ---------------------------------------------------------------------- */
/* Pré-visualização                                                        */
/* ---------------------------------------------------------------------- */

/** Chamada a cada tecla digitada no formulário — atualiza as duas caixas. */
function renderPreviewAtual() {
  salvarAutomaticamente();
  const aula = conteudoAulaAtual();
  const passos = montarPassos(aula.conteudo);
  const passo = passos[Math.min(conteudoEstado.passoIndex, passos.length - 1)];
  renderPreviewTela(aula, passos, passo);
  renderPreviewAula();
}

const ICONE_GENERICO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 7.2H22l-6 4.6 2.3 7.2-6.3-4.5-6.3 4.5 2.3-7.2-6-4.6h7.6z"/></svg>';

/** Um por valor de TIPOS_ICONE (js/data.js) — cópia exata de RESUMO_ICONES do motor real
 * (vendor/estudo/js/estudo.mjs), pra prévia mostrar o mesmo ícone que a aluna vai ver de verdade. */
const ICONES_TIPO = {
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

/** Ícone de um "tipo" (TIPOS_ICONE), na cor pedida — pronto pra colar num pp-*-icone. Se
 * tipo for "externo" com iconeUrl definido, mostra a imagem enviada em vez do ícone padrão. */
function iconeTipo(tipo, cor, iconeUrl) {
  if (tipo === 'externo' && iconeUrl) {
    return `<img src="${escaparHtml(iconeUrl)}" alt="" style="width:60%;height:60%;object-fit:contain">`;
  }
  const gerador = ICONES_TIPO[tipo] || ICONES_TIPO.acao;
  return `<svg viewBox="0 0 24 24" width="26" height="26">${gerador(cor)}</svg>`;
}

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
  // Aceita tanto os campos novos (feedbackCorreto/feedbackErrado) quanto o antigo "feedback"
  // (item ainda não aberto no editor pra migrar) como texto de reserva.
  const textoFeedback = item && (resp === 'acerto' ? (item.feedbackCorreto || item.feedback) : (item.feedbackErrado || item.feedback));
  if (temToggle && resp !== 'padrao' && textoFeedback) {
    feedbackEl.style.display = 'flex';
    feedbackEl.classList.add(resp === 'acerto' ? 'acerto' : 'erro');
    feedbackEl.innerHTML = `<span>${resp === 'acerto' ? '✅' : '❌'}</span><span class="pp-feedback-texto">${escaparHtml(textoFeedback)}</span>`;
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
    <p class="pp-titulo"${estiloTextoInline(d, 'titulo', 'text-align:center')}>${renderFraseComDestaque(d.titulo, d.tituloDestaque)}</p>
    <p class="pp-intro-desc"${estiloTextoInline(d, 'descricao')}>${renderFraseComDestaque(d.descricao, d.descricaoDestaque)}</p>
    ${d.aprender ? `<div class="pp-info-box"><h3>Você vai aprender</h3><p${estiloTextoInline(d, 'aprender')}>${renderFraseComDestaque(d.aprender, d.aprenderDestaque)}</p></div>` : ''}
    ${d.importancia ? `<div class="pp-info-box"><h3>Por que importa</h3><p${estiloTextoInline(d, 'importancia')}>${renderFraseComDestaque(d.importancia, d.importanciaDestaque)}</p></div>` : ''}`;
}

function previewExemplo(item) {
  const temPalavraSelecionavel = item.palavraSelecionavel && item.palavraSelecionavel.sentenca && item.palavraSelecionavel.sentenca.length;
  const temPalavraSelecionavelMultipla = item.palavraSelecionavelMultipla && item.palavraSelecionavelMultipla.sentenca && item.palavraSelecionavelMultipla.sentenca.length;
  const temPalavraPointLabelExemplo = item.palavraPointLabelExemplo && item.palavraPointLabelExemplo.sentenca && item.palavraPointLabelExemplo.sentenca.length;
  const temPalavraMultiplosRotulos = item.palavraMultiplosRotulos && item.palavraMultiplosRotulos.sentenca && item.palavraMultiplosRotulos.sentenca.length;
  if (!item.texto && !temPalavraSelecionavel && !temPalavraSelecionavelMultipla && !temPalavraPointLabelExemplo && !temPalavraMultiplosRotulos) return '<p class="pp-vazio">Preencha o texto para ver a prévia.</p>';
  return `
    <div class="pp-exemplo-icone">${iconeTipo(item.tipo, '#4A80F0', item.iconeUrl)}</div>
    ${item.texto ? `<p class="pp-exemplo-texto"${estiloTextoInline(item, 'texto')}>${renderFraseComDestaque(item.texto, item.textoDestaque)}</p>` : ''}
    ${item.conclusao ? `<p class="pp-exemplo-conclusao"${estiloTextoInline(item, 'conclusao')}>${renderFraseComDestaque(item.conclusao, item.conclusaoDestaque)}</p>` : ''}
    ${item.obs ? `<p class="pp-exemplo-texto"${estiloTextoInline(item, 'obs')}>${renderFraseComDestaque(item.obs, item.obsDestaque)}</p>` : ''}
    ${(item.pontos && item.pontos.length) ? `<div class="pp-pontos">${item.pontos.map(p => `
      <div class="pp-ponto"><div class="pp-ponto-icone">${iconeTipo(p.tipo, '#4A80F0', p.iconeUrl)}</div><p class="pp-ponto-texto"${estiloTextoInline(p, 'texto')}>${renderFraseComDestaque(p.texto, p.textoDestaque)}</p></div>`).join('')}</div>` : ''}
    ${item.palavraSelecionavel ? previewPalavraSelecionavel(item.palavraSelecionavel) : ''}
    ${item.palavraSelecionavelMultipla ? previewPalavraSelecionavelMultipla(item.palavraSelecionavelMultipla) : ''}
    ${item.palavraPointLabelExemplo ? previewPalavraSelecionavelMultipla(item.palavraPointLabelExemplo, 'Exemplo:') : ''}
    ${item.palavraMultiplosRotulos ? previewPalavraMultiplosRotulos(item.palavraMultiplosRotulos) : ''}`;
}

/** Agrupa índices em blocos contíguos (ex: [1,2,4] -> [[1,2],[4,4]]) — o colchete de cada
 * grupo cobre só as palavras próximas, sem "engolir" uma palavra não marcada no meio. */
function agruparIndicesContiguos(indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  const grupos = [];
  if (!sorted.length) return grupos;
  let inicio = sorted[0], fim = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === fim + 1) fim = sorted[i];
    else { grupos.push([inicio, fim]); inicio = fim = sorted[i]; }
  }
  grupos.push([inicio, fim]);
  return grupos;
}

/** Agrupa um array `rotulos` (mesmo tamanho da sentença, '' = sem rótulo) em blocos de palavras
 * ADJACENTES que têm o MESMO rótulo — cada bloco vira um colchete só (ex: "muito bem" os dois
 * rotulados "ADVÉRBIO" ganham um colchete; palavras com rótulos diferentes ficam em colchetes
 * separados, mesmo se vizinhas). */
function agruparRotulos(rotulos) {
  const grupos = [];
  let atual = null;
  (rotulos || []).forEach((r, i) => {
    if (r && atual && atual.rotulo === r && atual.fim === i - 1) {
      atual.fim = i;
    } else {
      if (atual) grupos.push(atual);
      atual = r ? { rotulo: r, inicio: i, fim: i } : null;
    }
  });
  if (atual) grupos.push(atual);
  return grupos;
}

/** Paleta usada pra dar uma cor diferente a cada rótulo distinto (ex: SUJEITO roxo, VERBO verde) —
 * a cor é sempre a mesma pro mesmo texto de rótulo, na ordem em que aparecem na frase. */
const PALETA_ROTULOS = ['#7B3FF2', '#0D9488', '#DB2777', '#EA580C', '#0EA5E9', '#65A30D', '#DC2626', '#9333EA'];
function corDoRotulo(rotulo, mapaCores) {
  if (!mapaCores.has(rotulo)) mapaCores.set(rotulo, PALETA_ROTULOS[mapaCores.size % PALETA_ROTULOS.length]);
  return mapaCores.get(rotulo);
}

/** Renderiza um texto corrido (Título/Instrução) com algumas palavras em azul de destaque —
 * diferente dos "chips", aqui o texto continua fluindo normalmente, só muda a cor da palavra. */
function renderFraseComDestaque(texto, indices) {
  if (!texto) return '';
  const tokens = tokenizarFrase(texto);
  const destacadas = new Set(indices || []);
  const partes = tokens.map((tok, i) =>
    (destacadas.has(i) && !ehPontuacao(tok)) ? `<span class="pp-destaque-azul">${escaparHtml(tok)}</span>` : escaparHtml(tok)
  );
  return partes.join(' ').replace(/ ([.,!?;:]+)/g, '$1');
}

/** Prévia da "palavra selecionável" — mostra a palavra certa já destacada com o rótulo em
 * colchete embaixo (na prévia não dá pra "clicar" de verdade, então já mostra resolvido). */
function previewPalavraSelecionavel(ps, instrucaoPadrao) {
  if (!ps.sentenca || !ps.sentenca.length) return '';
  const chips = ps.sentenca.map((tok, i) => {
    const pontuacao = ehPontuacao(tok);
    const destaque = i === ps.correta;
    return `<span class="pp-chip${pontuacao ? ' pontuacao' : ''}${destaque ? ' pp-chip-alvo' : ''}" style="grid-column:${i + 1};grid-row:1">${escaparHtml(tok)}</span>`;
  }).join('');
  const colchete = ps.rotulo
    ? `<div class="pp-chip-bracket" style="grid-column:${ps.correta + 1}/span 1;grid-row:2">${escaparHtml(ps.rotulo)}</div>`
    : `<div class="pp-chip-bracket pp-chip-bracket-vazio" style="grid-column:${ps.correta + 1}/span 1;grid-row:2">Rótulo</div>`;
  return `
    <div class="pp-palavra-select">
      <div class="pp-palavra-select-cabecalho">
        <div class="pp-palavra-select-icone">${iconeTipo('tarefa', '#4A80F0')}</div>
        <p class="pp-palavra-select-instrucao"${estiloTextoInline(ps, 'instrucao')}>${ps.instrucao ? renderFraseComDestaque(ps.instrucao, ps.instrucaoDestaque) : escaparHtml(instrucaoPadrao || 'Selecione a palavra abaixo:')}</p>
      </div>
      <div class="pp-frase-anotada">${chips}${colchete}</div>
    </div>`;
}

/** Igual a previewPalavraSelecionavel, mas destaca várias palavras — os colchetes ficam
 * agrupados por blocos contíguos (ex: duas palavras seguidas ganham um colchete só). */
function previewPalavraSelecionavelMultipla(psm, instrucaoPadrao) {
  if (!psm.sentenca || !psm.sentenca.length) return '';
  const corretasSet = new Set(psm.corretas || []);
  const chips = psm.sentenca.map((tok, i) => {
    const pontuacao = ehPontuacao(tok);
    const destaque = corretasSet.has(i);
    return `<span class="pp-chip${pontuacao ? ' pontuacao' : ''}${destaque ? ' pp-chip-alvo' : ''}" style="grid-column:${i + 1};grid-row:1">${escaparHtml(tok)}</span>`;
  }).join('');
  const grupos = agruparIndicesContiguos(psm.corretas || []);
  const colchetes = grupos.map(([ini, fim]) => psm.rotulo
    ? `<div class="pp-chip-bracket" style="grid-column:${ini + 1}/span ${fim - ini + 1};grid-row:2">${escaparHtml(psm.rotulo)}</div>`
    : `<div class="pp-chip-bracket pp-chip-bracket-vazio" style="grid-column:${ini + 1}/span ${fim - ini + 1};grid-row:2">Rótulo</div>`
  ).join('');
  return `
    ${psm.titulo ? `<p class="pp-palavra-select-titulo"${estiloTextoInline(psm, 'titulo')}>${renderFraseComDestaque(psm.titulo, psm.tituloDestaque)}</p>` : ''}
    ${psm.subtitulo ? `<p class="pp-palavra-select-subtitulo"${estiloTextoInline(psm, 'subtitulo')}>${renderFraseComDestaque(psm.subtitulo, psm.subtituloDestaque)}</p>` : ''}
    <div class="pp-palavra-select">
      <div class="pp-palavra-select-cabecalho">
        <div class="pp-palavra-select-icone">${iconeTipo('tarefa', '#4A80F0')}</div>
        <p class="pp-palavra-select-instrucao"${estiloTextoInline(psm, 'instrucao')}>${psm.instrucao ? renderFraseComDestaque(psm.instrucao, psm.instrucaoDestaque) : escaparHtml(instrucaoPadrao || 'Selecione as palavras abaixo:')}</p>
      </div>
      <div class="pp-frase-anotada">${chips}${colchetes}</div>
    </div>`;
}

/** Prévia da "Palavra(s) com Múltiplos Rótulos" — mostra tudo já resolvido (não dá pra clicar de
 * verdade na prévia), cada palavra com seu próprio colchete/rótulo embaixo. */
function previewPalavraMultiplosRotulos(pmr) {
  if (!pmr.sentenca || !pmr.sentenca.length) return '';
  const mapaCores = new Map();
  const chips = pmr.sentenca.map((tok, i) => {
    const pontuacao = ehPontuacao(tok);
    const rotulo = pmr.rotulos[i];
    const estiloCor = rotulo ? `;border-color:${corDoRotulo(rotulo, mapaCores)};background:${corDoRotulo(rotulo, mapaCores)}1a;color:${corDoRotulo(rotulo, mapaCores)}` : '';
    return `<span class="pp-chip${pontuacao ? ' pontuacao' : ''}" style="grid-column:${i + 1};grid-row:1${estiloCor}">${escaparHtml(tok)}</span>`;
  }).join('');
  const grupos = agruparRotulos(pmr.rotulos || []);
  const colchetes = grupos.map(g =>
    `<div class="pp-chip-bracket" style="grid-column:${g.inicio + 1}/span ${g.fim - g.inicio + 1};grid-row:2;color:${corDoRotulo(g.rotulo, mapaCores)}">${escaparHtml(g.rotulo)}</div>`
  ).join('');
  return `
    <div class="pp-palavra-select">
      <div class="pp-palavra-select-cabecalho">
        <div class="pp-palavra-select-icone">${iconeTipo('tarefa', '#4A80F0')}</div>
        <p class="pp-palavra-select-instrucao"${estiloTextoInline(pmr, 'instrucao')}>${pmr.instrucao ? renderFraseComDestaque(pmr.instrucao, pmr.instrucaoDestaque) : escaparHtml('Classifique cada palavra:')}</p>
      </div>
      <div class="pp-frase-anotada">${chips}${colchetes}</div>
    </div>`;
}

/** Corpo puro do exercício de checagem (sem tocar em feedback/toggle) — reaproveitado pelas duas caixas de preview. */
function previewChecagemCorpo(item, resp) {
  const modo = Array.isArray(item.sentenca) ? 'palavra' : 'multipla';

  if (modo === 'multipla') {
    if (!item.titulo && (item.opcoes || []).every(o => !o)) return '<p class="pp-vazio">Preencha o exercício para ver a prévia.</p>';
    const letras = 'ABCDEFGH';
    const cabecalho = item.invertido
      ? `<p class="pp-subtitulo"${estiloTextoInline(item, 'subtitulo')}>${renderFraseComDestaque(item.subtitulo || '', item.subtituloDestaque)}</p><p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque)}</p>`
      : `<p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque)}</p>${item.subtitulo ? `<p class="pp-subtitulo"${estiloTextoInline(item, 'subtitulo')}>${renderFraseComDestaque(item.subtitulo, item.subtituloDestaque)}</p>` : ''}`;
    const opcoes = (item.opcoes || []).map((texto, i) => {
      let cls = '';
      if (resp !== 'padrao') {
        if (i === item.correta) cls = 'correta';
        else if (resp === 'erro' && i === proximoIndiceErrado(item)) cls = 'errada';
      }
      const partesEstilo = [];
      if ((item.opcoesNegrito || [])[i]) partesEstilo.push('font-weight:700');
      if ((item.opcoesItalico || [])[i]) partesEstilo.push('font-style:italic');
      const estiloOpcao = partesEstilo.length ? ` style="${partesEstilo.join(';')}"` : '';
      return `<button class="pp-opcao ${cls}"><span class="pp-letra">${letras[i] || i + 1}</span><span${estiloOpcao}>${renderFraseComDestaque(texto, (item.opcoesDestaque || [])[i])}</span></button>`;
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
  return `<p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque)}</p>${item.subtitulo ? `<p class="pp-subtitulo"${estiloTextoInline(item, 'subtitulo')}>${renderFraseComDestaque(item.subtitulo, item.subtituloDestaque)}</p>` : ''}<div class="pp-sentenca">${chips}</div>`;
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
    ${r.titulo ? `<p class="pp-titulo"${estiloTextoInline(r, 'titulo')}>${renderFraseComDestaque(r.titulo, r.tituloDestaque)}</p>` : ''}
    ${r.itens.map(it => `
      <div class="pp-resumo-item">
        <div class="pp-resumo-icone" style="background:${it.corFundo || '#eef2ff'};color:${it.cor || '#4A80F0'}">${iconeTipo(it.tipo, it.cor || '#4A80F0', it.iconeUrl)}</div>
        <div class="pp-resumo-info">
          <span class="pp-resumo-titulo-item"${estiloTextoInline(it, 'titulo', `color:${it.cor || '#1a1a2e'}`)}>${renderFraseComDestaque(it.titulo, it.tituloDestaque)}</span>
          <span class="pp-resumo-exemplos"${estiloTextoInline(it, 'exemplos')}>${renderFraseComDestaque(it.exemplos, it.exemplosDestaque)}</span>
        </div>
      </div>`).join('')}`;
}

function previewLicao(l) {
  if (!l.html && !l.titulo) return '<p class="pp-vazio">Preencha para ver a prévia.</p>';
  return `<p class="pp-titulo"${estiloTextoInline(l, 'titulo')}>📖 ${renderFraseComDestaque(l.titulo, l.tituloDestaque)}</p><div class="pp-licao-corpo">${l.html}</div>`;
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
