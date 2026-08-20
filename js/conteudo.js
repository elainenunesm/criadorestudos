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

/** Próximo _id livre pra um novo item de exemplo/checagem/lista/timeline (referenciado em conteudo.ordem). */
function proximoIdItem(conteudo) {
  const ids = [...conteudo.exemplo, ...conteudo.checagem, ...conteudo.lista, ...conteudo.timeline].map(i => i._id || 0);
  return Math.max(0, ...ids) + 1;
}

/**
 * Garante que conteudo.ordem existe e reflete exatamente os itens atuais de
 * exemplo/checagem/lista/timeline (dá _id a quem não tem, inclui item novo no fim antes do
 * resumo, remove entrada de item excluído). Chamada sempre antes de ler a
 * ordem — assim aulas antigas (sem "ordem" salvo) se auto-reparam na hora.
 */
function garantirOrdem(conteudo) {
  if (!Array.isArray(conteudo.ordem)) conteudo.ordem = [];
  // Migração: aulas criadas antes da tela "Lista" existir tinham esse campo como objeto único
  // (ou nem tinham) — "Lista"/"Timeline" são repetíveis, igual Exemplo/Checagem, então são sempre um array.
  if (!Array.isArray(conteudo.lista)) conteudo.lista = [];
  if (!Array.isArray(conteudo.timeline)) conteudo.timeline = [];

  conteudo.exemplo.forEach(item => { if (!item._id) item._id = proximoIdItem(conteudo); });
  conteudo.checagem.forEach(item => { if (!item._id) item._id = proximoIdItem(conteudo); });
  conteudo.lista.forEach(item => { if (!item._id) item._id = proximoIdItem(conteudo); });
  conteudo.timeline.forEach(item => { if (!item._id) item._id = proximoIdItem(conteudo); });

  // Remove entradas de itens que não existem mais.
  conteudo.ordem = conteudo.ordem.filter(t => {
    if (t.tipo === 'exemplo') return conteudo.exemplo.some(i => i._id === t.id);
    if (t.tipo === 'checagem') return conteudo.checagem.some(i => i._id === t.id);
    if (t.tipo === 'lista') return conteudo.lista.some(i => i._id === t.id);
    if (t.tipo === 'timeline') return conteudo.timeline.some(i => i._id === t.id);
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
  conteudo.lista.forEach(item => {
    if (!presentes.has(`lista:${item._id}`)) conteudo.ordem.push({ tipo: 'lista', id: item._id });
  });
  conteudo.timeline.forEach(item => {
    if (!presentes.has(`timeline:${item._id}`)) conteudo.ordem.push({ tipo: 'timeline', id: item._id });
  });
  // Resumo/Lição nascem junto com a aula, mas podem ser excluídos (ver removerPassoAtual) — nesse
  // caso NÃO voltam sozinhos aqui, só se a professora clicar em "Tipo (Telas)" pra adicionar de novo.
  if (!presentes.has('resumo:') && !conteudo.resumoRemovido) conteudo.ordem.push({ tipo: 'resumo' });
  if (!presentes.has('licao:') && !conteudo.licaoRemovido) conteudo.ordem.push({ tipo: 'licao' });
}

const TITULO_TELA_FIXO = { antesComecar: 'Antes de começar', resumo: 'Resumo', licao: 'Lição' };

/** Monta a lista de passos a partir de conteudo.ordem — a numeração de "Exemplo N"/
 * "Checagem N"/"Lista N"/"Timeline N" segue a posição na sequência (não a posição de criação). */
function montarPassos(conteudo) {
  garantirOrdem(conteudo);
  let numExemplo = 0;
  let numChecagem = 0;
  let numLista = 0;
  let numTimeline = 0;
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
    if (token.tipo === 'lista') {
      numLista++;
      return { tipo: 'lista', idx: conteudo.lista.findIndex(i => i._id === token.id), id: token.id, titulo: `Lista ${numLista}` };
    }
    if (token.tipo === 'timeline') {
      numTimeline++;
      return { tipo: 'timeline', idx: conteudo.timeline.findIndex(i => i._id === token.id), id: token.id, titulo: `Timeline ${numTimeline}` };
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
  if (sel) {
    popularOpcoesSeletorAula(sel); // atualiza a lista antes de selecionar, caso a aula seja nova
    sel.value = `${cicloId}:${materiaId}:${aulaId}`;
  }
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
  lista: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="6" r="1.3" fill="#fff" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="#fff" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="#fff" stroke="none"/><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/></svg>',
  timeline: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><circle cx="5" cy="12" r="2" fill="#fff" stroke="none"/><circle cx="12" cy="12" r="2" fill="#fff" stroke="none"/><circle cx="19" cy="12" r="2" fill="#fff" stroke="none"/></svg>',
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
  exemploCardImagem: {
    tipo: 'acao', texto: '',
    cardImagem: {
      imagemUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='220'><rect width='100%25' height='100%25' fill='%23e5e7eb'/><text x='50%25' y='50%25' font-size='16' fill='%239ca3af' text-anchor='middle' dy='.3em'>Imagem</text></svg>",
      titulo: 'Assim vai aparecer o título.',
      subtitulo: 'E aqui o subtítulo.',
      texto: 'Assim vai aparecer o texto embaixo da imagem.',
    },
  },
  exemploFlashcard: {
    tipo: 'acao', texto: '',
    flashcard: { frente: 'Assim vai aparecer a frente do card.', verso: 'E aqui o verso, ao virar.' },
  },
  exemploAudio: {
    tipo: 'acao', texto: '',
    audio: { audioUrl: '', titulo: 'Assim vai aparecer o título.', subtitulo: 'E aqui o subtítulo.', texto: 'Assim vai aparecer o texto embaixo do áudio.' },
  },
  exemploGravacao: {
    tipo: 'acao', texto: '',
    gravacao: { audioUrl: '', titulo: 'Assim vai aparecer o título.', subtitulo: 'E aqui o subtítulo.', texto: 'Assim vai aparecer o texto embaixo da gravação.' },
  },
  exemploGravacaoAluno: {
    tipo: 'acao', texto: '',
    gravacaoAluno: { titulo: 'Assim vai aparecer o título.', subtitulo: 'E aqui o subtítulo.', texto: 'Assim vai aparecer o texto embaixo do gravador.' },
  },
  checagemMultipla: { titulo: 'Assim vai aparecer a pergunta da checagem.', opcoes: ['Alternativa A', 'Alternativa B', 'Alternativa C'], correta: 0 },
  checagemPalavra: { titulo: 'Assim vai aparecer a instrução da checagem.', sentenca: ['A', 'Maria', 'estudou', 'muito', '.'], correta: 2 },
  checagemCertoErrado: { titulo: 'Assim vai aparecer a afirmação da checagem.', opcoes: ['Certo', 'Errado'], correta: 0, certoErrado: true },
  checagemMultiplosRotulos: {
    titulo: 'Assim vai aparecer a instrução da checagem.',
    sentenca: ['O', 'menino', 'leu', 'o', 'livro', '.'],
    rotulos: ['SUJEITO', 'SUJEITO', 'VERBO;PREDICADO', 'PREDICADO', 'PREDICADO', ''],
    mostrarRespostaCadaItem: true, multiplosRotulos: true,
  },
  lista: {
    titulo: 'Assim vai aparecer o título da lista.',
    textoAntes: 'Assim vai aparecer o texto antes da lista (opcional).',
    itens: [
      { tipo: 'tarefa', cor: '#5B2BCB', corFundo: '#f0eaff', texto: 'Assim vai aparecer o texto do item.' },
      { tipo: 'tarefa', cor: '#5B2BCB', corFundo: '#f0eaff', texto: 'E aqui outro item da lista.' },
    ],
    descricao: 'Assim vai aparecer a descrição, depois da lista.',
  },
  timeline: {
    titulo: 'Assim vai aparecer o título da timeline.',
    instrucao: 'Clique em um período da linha do tempo para ver os detalhes.',
    eventos: [
      { ano: '1500', titulo: 'Primeiro período', cor: '#5B2BCB', descricao: 'Assim vai aparecer a descrição deste período.', caracteristicas: 'Primeira característica.\nSegunda característica.' },
      { ano: '1822', titulo: 'Segundo período', cor: '#F59E0B', descricao: 'Assim vai aparecer a descrição deste outro período.', caracteristicas: 'Outra característica.' },
    ],
  },
};

const NOME_TELA_ADICIONAR = {
  exemplo: 'Adicionar exemplo',
  'exemplo:palavraSelecionavel': 'Palavra selecionável',
  'exemplo:palavraSelecionavelMultipla': 'Palavra selecionável (múltipla)',
  'exemplo:palavraPointLabelExemplo': 'Palavra(s) com Point Label - Exemplo',
  'exemplo:palavraMultiplosRotulos': 'Palavra(s) com Múltiplos Rótulos',
  'exemplo:cardImagem': 'Card com imagem',
  'exemplo:flashcard': 'Flashcard',
  'exemplo:audio': 'Card de áudio',
  'exemplo:gravacao': 'Card de gravação',
  'exemplo:gravacaoAluno': 'Card de gravação do aluno',
  'checagem:multipla': 'Questão múltipla escolha',
  'checagem:palavra': 'Selecione a palavra',
  'checagem:certoErrado': 'Questão certo ou errado',
  'checagem:multiplosRotulos': 'Múltiplos Rótulos (questão)',
  resumo: 'Resumo',
  licao: 'Lição',
  lista: 'Adicionar lista',
  timeline: 'Adicionar timeline',
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
    cardImagem: DADOS_FICTICIOS_TELA.exemploCardImagem,
    flashcard: DADOS_FICTICIOS_TELA.exemploFlashcard,
    audio: DADOS_FICTICIOS_TELA.exemploAudio,
    gravacao: DADOS_FICTICIOS_TELA.exemploGravacao,
    gravacaoAluno: DADOS_FICTICIOS_TELA.exemploGravacaoAluno,
  };
  const body = document.getElementById('previewNovaTelaBody');
  if (tipo === 'exemplo') {
    body.innerHTML = previewExemplo(DADOS_EXEMPLO_POR_MODO[modo] || DADOS_FICTICIOS_TELA.exemplo);
  } else if (tipo === 'resumo') {
    // Mostra o resumo que já estava preenchido antes de excluir (conteúdo não se perde ao
    // excluir a tela — só sai da ordem — então volta exatamente como estava).
    body.innerHTML = previewResumo(aula.conteudo.resumo);
  } else if (tipo === 'licao') {
    body.innerHTML = previewLicao(aula.conteudo.licao);
  } else if (tipo === 'lista') {
    body.innerHTML = previewLista(DADOS_FICTICIOS_TELA.lista);
  } else if (tipo === 'timeline') {
    body.innerHTML = previewTimeline(DADOS_FICTICIOS_TELA.timeline);
  } else {
    const DADOS_CHECAGEM_POR_MODO = {
      palavra: DADOS_FICTICIOS_TELA.checagemPalavra,
      certoErrado: DADOS_FICTICIOS_TELA.checagemCertoErrado,
      multiplosRotulos: DADOS_FICTICIOS_TELA.checagemMultiplosRotulos,
    };
    const dados = DADOS_CHECAGEM_POR_MODO[modo] || DADOS_FICTICIOS_TELA.checagemMultipla;
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
    const ICONE_CERTO_ERRADO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg>';
    const ICONE_ROTULO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828z"/><circle cx="7.5" cy="7.5" r="1.5" fill="#fff" stroke="none"/></svg>';
    const ICONE_IMAGEM = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    const ICONE_FLASHCARD = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="15" height="12" rx="2"/><path d="M7 2h13a2 2 0 0 1 2 2v12"/></svg>';
    const ICONE_AUDIO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#fff" stroke="none"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const ICONE_MICROFONE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    const ICONE_MICROFONE_ALUNO = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><circle cx="19" cy="5" r="4" fill="#fff" stroke="none"/></svg>';
    btnAdicionar.onclick = () => {
      const itens = [
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
          label: 'Card com imagem', sublabel: 'Mostra uma imagem grande e um texto embaixo, só ilustrativo', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_IMAGEM, '#F59E0B'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'cardImagem'),
        },
        {
          label: 'Flashcard', sublabel: 'Card com frente e verso — a aluna toca pra virar e ver a resposta', grupo: 'Exemplo',
          iconeHtml: badgeIcone(ICONE_FLASHCARD, '#0EA5E9'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'flashcard'),
        },
        {
          label: 'Card de áudio', sublabel: 'Importe um arquivo de áudio pra tocar, com título/texto opcionais', grupo: 'Áudio',
          iconeHtml: badgeIcone(ICONE_AUDIO, '#10B981'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'audio'),
        },
        {
          label: 'Card de gravação', sublabel: 'Você grava sua própria voz direto pelo microfone, no Construtor', grupo: 'Áudio',
          iconeHtml: badgeIcone(ICONE_MICROFONE, '#EF4444'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'gravacao'),
        },
        {
          label: 'Card de gravação do aluno', sublabel: 'A aluna grava a própria voz, ao estudar a aula', grupo: 'Áudio',
          iconeHtml: badgeIcone(ICONE_MICROFONE_ALUNO, '#8B5CF6'),
          onClick: () => mostrarPreviewNovaTela('exemplo', 'gravacaoAluno'),
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
        {
          label: 'Questão certo ou errado', sublabel: 'Afirmação com duas alternativas fixas: Certo ou Errado', grupo: 'Questão',
          iconeHtml: badgeIcone(ICONE_CERTO_ERRADO, '#16A34A'),
          onClick: () => mostrarPreviewNovaTela('checagem', 'certoErrado'),
        },
        {
          label: 'Múltiplos Rótulos (questão)', sublabel: 'A aluna clica na(s) palavra(s) certa(s) pra cada rótulo (ex: verbo, sujeito, predicado)', grupo: 'Questão',
          iconeHtml: badgeIcone(ICONE_ROTULO, '#0D9488'),
          onClick: () => mostrarPreviewNovaTela('checagem', 'multiplosRotulos'),
        },
        {
          label: 'Adicionar lista', sublabel: 'Título + lista de ícones e textos + descrição', grupo: 'Lista',
          iconeHtml: badgeIcone(ICONE_TELA.lista, '#0D9488'),
          onClick: () => mostrarPreviewNovaTela('lista'),
        },
        {
          label: 'Adicionar timeline', sublabel: 'Linha do tempo com períodos clicáveis — cada um abre um card de detalhes', grupo: 'Timeline',
          iconeHtml: badgeIcone(ICONE_TELA.timeline, '#DB2777'),
          onClick: () => mostrarPreviewNovaTela('timeline'),
        },
      ];
      // "Resumo" e "Lição" são fixos por padrão (toda aula nasce com os dois) — só aparecem aqui
      // pra adicionar de volta se a professora tiver excluído antes (ver abrirMenuTela/removerPassoAtual).
      // "Lista" é repetível (igual Exemplo/Checagem, ver acima) — não entra aqui.
      if (aula.conteudo.resumoRemovido) {
        itens.push({
          label: 'Resumo', sublabel: 'Você excluiu — adicione de volta se quiser', grupo: 'Telas fixas',
          iconeHtml: badgeIcone(ICONE_TELA.resumo, '#F59E0B'),
          onClick: () => mostrarPreviewNovaTela('resumo'),
        });
      }
      if (aula.conteudo.licaoRemovido) {
        itens.push({
          label: 'Lição', sublabel: 'Você excluiu — adicione de volta se quiser', grupo: 'Telas fixas',
          iconeHtml: badgeIcone(ICONE_TELA.licao, '#16A34A'),
          onClick: () => mostrarPreviewNovaTela('licao'),
        });
      }
      abrirEscolha('Tipo (Telas)', itens);
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
  // Resumo e Lição são opcionais (podem ser excluídos e depois adicionados de volta pelo "Tipo
  // (Telas)"), diferente de "Antes de começar", que é sempre obrigatório.
  if (passo.tipo === 'exemplo' || passo.tipo === 'checagem' || passo.tipo === 'resumo' || passo.tipo === 'licao' || passo.tipo === 'lista' || passo.tipo === 'timeline') {
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

/** Reconstrói as opções do &lt;select&gt; "Editando a aula" a partir de CICLOS — chamada toda vez
 * que a aba Conteúdo é aberta (não só na primeira vez), senão uma aula criada depois da primeira
 * visita não aparece na lista e o seletor fica em branco ao tentar editá-la. Preserva a seleção
 * atual quando ainda existe. */
function popularOpcoesSeletorAula(sel) {
  const atual = sel.value;
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
  sel.value = atual;
}

function inicializarSeletorAula() {
  const sel = document.getElementById('seletorAula');
  popularOpcoesSeletorAula(sel);

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
    } else if (variante === 'cardImagem') {
      novoExemplo.cardImagem = { imagemUrl: '', titulo: '', subtitulo: '', texto: '' };
    } else if (variante === 'flashcard') {
      novoExemplo.flashcard = { frente: '', verso: '' };
    } else if (variante === 'audio') {
      novoExemplo.audio = { audioUrl: '', titulo: '', subtitulo: '', texto: '', obrigatorio: false };
    } else if (variante === 'gravacao') {
      novoExemplo.gravacao = { audioUrl: '', titulo: '', subtitulo: '', texto: '', obrigatorio: false };
    } else if (variante === 'gravacaoAluno') {
      novoExemplo.gravacaoAluno = { titulo: '', subtitulo: '', texto: '', obrigatorio: false };
    }
    conteudo.exemplo.push(novoExemplo);
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'exemplo', id });
  } else if (tipoLista === 'checagem') {
    const base = { _id: id, titulo: '', correta: 0, feedbackCorreto: '', feedbackErrado: '' };
    const novaChecagem = variante === 'palavra' ? { ...base, sentenca: [], classes: [] }
      : variante === 'certoErrado' ? { ...base, opcoes: ['Certo', 'Errado'], certoErrado: true }
      : variante === 'multiplosRotulos' ? { ...base, sentenca: [], rotulos: [], mostrarRespostaCadaItem: true, multiplosRotulos: true }
      : { ...base, opcoes: ['', ''] };
    conteudo.checagem.push(novaChecagem);
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'checagem', id });
  } else if (tipoLista === 'lista') {
    conteudo.lista.push({ _id: id, titulo: '', textoAntes: '', itens: [], descricao: '' });
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'lista', id });
  } else if (tipoLista === 'timeline') {
    conteudo.timeline.push({ _id: id, titulo: '', instrucao: '', eventos: [] });
    inserirNaOrdemAntesDoResumo(conteudo, { tipo: 'timeline', id });
  } else if (tipoLista === 'resumo' || tipoLista === 'licao') {
    // Só existe uma de cada — o conteúdo (texto já preenchido antes de excluir) não se perde,
    // então "adicionar de volta" é só religar a tela na ordem, via garantirOrdem().
    conteudo[`${tipoLista}Removido`] = false;
    garantirOrdem(conteudo);
    conteudoEstado.passoIndex = conteudo.ordem.findIndex(t => t.tipo === tipoLista);
    renderizarConteudo();
    return;
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
  else if (passo.tipo === 'lista') conteudo.lista.splice(passo.idx, 1);
  else if (passo.tipo === 'timeline') conteudo.timeline.splice(passo.idx, 1);
  else if (passo.tipo === 'resumo') conteudo.resumoRemovido = true;
  else if (passo.tipo === 'licao') conteudo.licaoRemovido = true;
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
      const negritoCampo = `${c.campo}DestaqueNegrito`;
      if (!obj[destaqueCampo]) obj[destaqueCampo] = [];
      if (!obj[negritoCampo]) obj[negritoCampo] = [];
      const tokens = tokenizarFrase(obj[c.campo]);
      tokens.forEach((tok, i) => {
        if (ehPontuacao(tok)) return;
        const linha = document.createElement('div');
        linha.style.cssText = 'font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:8px;';
        linha.innerHTML = `
          <label style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <input type="checkbox" data-destaque ${obj[destaqueCampo].includes(i) ? 'checked' : ''}> "${escaparHtml(tok)}"
          </label>
          <button type="button" class="btn-estilo-texto${obj[negritoCampo].includes(i) ? ' ativo' : ''}" data-negrito title="Deixar essa palavra em negrito"><strong>B</strong></button>`;
        linha.querySelector('[data-destaque]').addEventListener('change', e => {
          if (e.target.checked) { if (!obj[destaqueCampo].includes(i)) obj[destaqueCampo].push(i); }
          else { const pos = obj[destaqueCampo].indexOf(i); if (pos !== -1) obj[destaqueCampo].splice(pos, 1); }
          renderPreviewAtual();
        });
        const btnNegrito = linha.querySelector('[data-negrito]');
        btnNegrito.addEventListener('click', () => {
          const pos = obj[negritoCampo].indexOf(i);
          if (pos === -1) obj[negritoCampo].push(i); else obj[negritoCampo].splice(pos, 1);
          btnNegrito.classList.toggle('ativo', obj[negritoCampo].includes(i));
          renderPreviewAtual();
        });
        checklistArea.appendChild(linha);
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
  const tokens = tokenizarFrase(obj[campo] || '');
  const valido = i => i < tokens.length && !ehPontuacao(tokens[i]);
  obj[`${campo}Destaque`] = (obj[`${campo}Destaque`] || []).filter(valido);
  obj[`${campo}DestaqueNegrito`] = (obj[`${campo}DestaqueNegrito`] || []).filter(valido);
}

const ICONES_ALINHAMENTO = {
  esquerda: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
  centro: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></svg>',
  direita: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>',
};

/** Linha de label com botões "B"/"I"/alinhamento pra ligar/desligar negrito e itálico e escolher
 * o alinhamento do texto inteiro daquele campo — usa no lugar de um `<label>` simples. `campo` é
 * o nome do campo no objeto (os flags ficam em `${campo}Negrito`/`${campo}Italico`/
 * `${campo}Alinhamento`). O botão de alinhamento abre um menuzinho com Esquerda/Centro/Direita. */
function htmlLabelComEstilo(label, campo) {
  return `<div class="campo-label-linha">
    <label>${label}</label>
    <div class="campo-estilo-botoes">
      <button type="button" class="btn-estilo-texto" data-estilo-campo="${campo}" data-estilo-tipo="Negrito" title="Negrito"><strong>B</strong></button>
      <button type="button" class="btn-estilo-texto" data-estilo-campo="${campo}" data-estilo-tipo="Italico" title="Itálico"><em>I</em></button>
      <div class="campo-alinhamento-wrap">
        <button type="button" class="btn-estilo-texto btn-alinhamento" data-alinhamento-campo="${campo}" title="Alinhamento do texto">${ICONES_ALINHAMENTO.esquerda}</button>
        <div class="menu-alinhamento" hidden>
          <button type="button" data-alinhar="esquerda" title="Esquerda">${ICONES_ALINHAMENTO.esquerda}</button>
          <button type="button" data-alinhar="centro" title="Centro">${ICONES_ALINHAMENTO.centro}</button>
          <button type="button" data-alinhar="direita" title="Direita">${ICONES_ALINHAMENTO.direita}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/** Liga todos os botões "B"/"I" e de alinhamento (de htmlLabelComEstilo) dentro de `container` —
 * B/I ligam/desligam `obj[campo + 'Negrito']`/`obj[campo + 'Italico']`; o botão de alinhamento
 * abre um menuzinho com Esquerda/Centro/Direita que escreve em `obj[campo + 'Alinhamento']`.
 * Sempre atualiza a prévia depois de qualquer mudança. */
function ligarBotoesEstiloTexto(container, obj) {
  container.querySelectorAll('.btn-estilo-texto[data-estilo-tipo]').forEach(btn => {
    const flagCampo = `${btn.dataset.estiloCampo}${btn.dataset.estiloTipo}`;
    btn.classList.toggle('ativo', !!obj[flagCampo]);
    btn.addEventListener('click', () => {
      obj[flagCampo] = !obj[flagCampo];
      btn.classList.toggle('ativo', obj[flagCampo]);
      renderPreviewAtual();
    });
  });

  container.querySelectorAll('.btn-alinhamento').forEach(btn => {
    const campo = btn.dataset.alinhamentoCampo;
    const alinhamentoCampo = `${campo}Alinhamento`;
    const wrap = btn.closest('.campo-alinhamento-wrap');
    const menu = wrap.querySelector('.menu-alinhamento');

    function aplicarIcone() {
      const atual = obj[alinhamentoCampo] || 'esquerda';
      btn.innerHTML = ICONES_ALINHAMENTO[atual];
      btn.classList.toggle('ativo', atual !== 'esquerda');
    }
    aplicarIcone();

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const jaAberto = !menu.hidden;
      document.querySelectorAll('.menu-alinhamento').forEach(m => { m.hidden = true; });
      menu.hidden = jaAberto;
    });
    menu.querySelectorAll('[data-alinhar]').forEach(opcao => {
      opcao.addEventListener('click', e => {
        e.stopPropagation();
        obj[alinhamentoCampo] = opcao.dataset.alinhar;
        aplicarIcone();
        menu.hidden = true;
        renderPreviewAtual();
      });
    });
  });
}

// Fecha qualquer menu de alinhamento aberto ao clicar fora dele — um só listener no documento
// (não um por menu) porque o formulário inteiro é recriado a cada troca de passo/campo.
document.addEventListener('click', () => {
  document.querySelectorAll('.menu-alinhamento').forEach(m => { m.hidden = true; });
});

/** Monta o atributo style="..." (negrito/itálico/alinhamento) pro texto inteiro de um campo, a
 * partir dos flags `${campo}Negrito`/`${campo}Italico`/`${campo}Alinhamento` ligados pelos
 * botões B/I/alinhamento. */
function estiloTextoInline(obj, campo, extraCss) {
  const partes = [];
  if (extraCss) partes.push(extraCss);
  if (obj[`${campo}Negrito`]) partes.push('font-weight:700');
  if (obj[`${campo}Italico`]) partes.push('font-style:italic');
  const alinhamento = obj[`${campo}Alinhamento`];
  if (alinhamento === 'centro') partes.push('text-align:center');
  else if (alinhamento === 'direita') partes.push('text-align:right');
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
  semSujeito: 'Oração sem sujeito', livro: 'Livro', certo: 'Certo (✓)', errado: 'Errado (✗)',
  externo: 'Ícone externo (link)',
};
const DESC_TIPO_ICONE = {
  acao: 'Verbo que indica uma ação', estado: 'Verbo de ligação/estado', mudanca: 'Indica mudança ou transformação',
  fenomeno: 'Fenômeno da natureza', infinito: 'Forma infinitiva do verbo', conjugar: 'Conjugação verbal',
  gota: 'Ícone de gota/líquido', peca: 'Ícone de peça/engrenagem', foguete: 'Ícone de foguete',
  sujeito: 'Sujeito da oração', fala: 'Fala ou discurso direto', busca: 'Busca ou pesquisa',
  tarefa: 'Tarefa ou lista', pergunta: 'Pergunta', dica: 'Dica ou observação',
  predVerbal: 'Predicado verbal', predNominal: 'Predicado nominal', predVerboNominal: 'Predicado verbo-nominal',
  semSujeito: 'Oração sem sujeito', livro: 'Ícone de livro/leitura',
  certo: 'Marca de certo/correto', errado: 'Marca de errado/incorreto',
  externo: 'Envie o link de uma imagem em vez de escolher um ícone pronto',
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
 * pra colar logo depois do <select> de tipo; quem chama ainda precisa achar o input e ligar o evento.
 * Também tem "Importar arquivo" (vira base64), pra imagens locais irem embutidas no export sem
 * depender de um link — mesmo padrão do Card com imagem e do Ícone da insígnia. */
function htmlCampoIconeExterno(item) {
  return `<div class="campo campo-icone-externo" style="${item.tipo === 'externo' ? '' : 'display:none'}">
    <label>Link do ícone (ou importe um arquivo do computador)</label>
    <div class="campo-linha-imagem">
      <input type="text" data-icone-url placeholder="https://exemplo.com/icone.png">
      <button type="button" class="btn-add-item btn-importar-icone">Importar arquivo</button>
    </div>
    <input type="file" accept="image/*" class="input-arquivo-icone" hidden>
  </div>`;
}

/** Acha o input do htmlCampoIconeExterno() dentro de `container`, preenche com item.iconeUrl e liga
 * os eventos (digitar o link ou importar um arquivo — os dois escrevem em item.iconeUrl). */
function ligarCampoIconeExterno(container, item) {
  const input = container.querySelector('[data-icone-url]');
  input.value = item.iconeUrl || '';
  input.addEventListener('input', () => { item.iconeUrl = input.value; renderPreviewAtual(); });

  const btnImportar = container.querySelector('.btn-importar-icone');
  const inputArquivo = container.querySelector('.input-arquivo-icone');
  btnImportar.addEventListener('click', () => inputArquivo.click());
  inputArquivo.addEventListener('change', () => {
    const arquivo = inputArquivo.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      item.iconeUrl = leitor.result;
      input.value = leitor.result;
      renderPreviewAtual();
    };
    leitor.readAsDataURL(arquivo);
  });
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
    lista: renderFormLista,
    timeline: renderFormTimeline,
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
  if (item.cardImagem) return 'cardImagem';
  if (item.flashcard) return 'flashcard';
  if (item.audio) return 'audio';
  if (item.gravacao) return 'gravacao';
  if (item.gravacaoAluno) return 'gravacaoAluno';
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
  cardImagem: renderBlocoCardImagem,
  flashcard: renderBlocoFlashcard,
  audio: renderBlocoAudio,
  gravacao: renderBlocoGravacao,
  gravacaoAluno: renderBlocoGravacaoAluno,
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
      <p class="pp-vazio" style="margin:0 0 10px">Uma palavra pode ter mais de um rótulo ao mesmo tempo — separe com ; (ex: "jogaram" pode ser <strong>VERBO;PREDICADO</strong>, ficando no colchete de cima E no colchete mais largo embaixo).</p>
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
          <input type="text" data-rotulo placeholder="Ex: VERBO ou VERBO;PREDICADO">
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

/** "Card com imagem" — só ilustrativo (sem clique): uma imagem grande em cima e um texto
 * embaixo, pra mostrar uma foto/ilustração com uma legenda ou explicação. */
function renderBlocoCardImagem(bloco, item) {
  const ci = item.cardImagem;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Card com imagem</strong></div>
      <div class="campo">
        <label>Link da imagem (ou importe um arquivo do computador)</label>
        <div class="campo-linha-imagem">
          <input type="text" data-cif="imagemUrl" placeholder="https://exemplo.com/imagem.jpg">
          <button type="button" class="btn-add-item btn-importar-imagem">Importar arquivo</button>
        </div>
        <input type="file" accept="image/*" class="input-arquivo-imagem" hidden>
      </div>
      <div class="campo">${htmlLabelComEstilo('Título (opcional)', 'titulo')}<input type="text" data-cif="titulo" placeholder="Ex: Título do card"></div>
      <div class="campo">${htmlLabelComEstilo('Subtítulo (opcional)', 'subtitulo')}<input type="text" data-cif="subtitulo" placeholder="Ex: Subtítulo do card"></div>
      <div class="campo">${htmlLabelComEstilo('Texto (opcional)', 'texto')}<textarea data-cif="texto"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueCardImagem"></div>
    </div>`;
  bloco.querySelectorAll('[data-cif]').forEach(input => {
    input.value = ci[input.dataset.cif] || '';
    input.addEventListener('input', () => { ci[input.dataset.cif] = input.value; renderPreviewAtual(); });
  });

  const inputUrl = bloco.querySelector('[data-cif="imagemUrl"]');
  const inputArquivo = bloco.querySelector('.input-arquivo-imagem');
  bloco.querySelector('.btn-importar-imagem').addEventListener('click', () => inputArquivo.click());
  inputArquivo.addEventListener('change', () => {
    const arquivo = inputArquivo.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      ci.imagemUrl = leitor.result;
      inputUrl.value = leitor.result;
      renderPreviewAtual();
    };
    leitor.readAsDataURL(arquivo);
  });

  ligarBotoesEstiloTexto(bloco, ci);
  const renderDestaquesCI = montarDestaqueFrases(bloco.querySelector('#listaDestaqueCardImagem'), ci, [
    { rotulo: 'Título', campo: 'titulo' },
    { rotulo: 'Subtítulo', campo: 'subtitulo' },
    { rotulo: 'Texto', campo: 'texto' },
  ]);
  bloco.querySelectorAll('[data-cif="titulo"], [data-cif="subtitulo"], [data-cif="texto"]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(ci, input.dataset.cif); renderDestaquesCI(); });
  });
}

/** "Flashcard" — só ilustrativo, sem correção: frente e verso, a aluna toca no card pra virar e
 * ver a resposta (no player de verdade; aqui na prévia do Construtor mostra os dois lados). */
function renderBlocoFlashcard(bloco, item) {
  const fc = item.flashcard;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Flashcard</strong></div>
      <div class="campo">${htmlLabelComEstilo('Frente (pergunta ou termo)', 'frente')}<textarea data-fcf="frente"></textarea></div>
      <div class="campo">${htmlLabelComEstilo('Verso (resposta ou definição)', 'verso')}<textarea data-fcf="verso"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueFlashcard"></div>
    </div>`;
  bloco.querySelectorAll('[data-fcf]').forEach(input => {
    input.value = fc[input.dataset.fcf] || '';
    input.addEventListener('input', () => { fc[input.dataset.fcf] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(bloco, fc);
  const renderDestaquesFC = montarDestaqueFrases(bloco.querySelector('#listaDestaqueFlashcard'), fc, [
    { rotulo: 'Frente', campo: 'frente' },
    { rotulo: 'Verso', campo: 'verso' },
  ]);
  bloco.querySelectorAll('[data-fcf]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(fc, input.dataset.fcf); renderDestaquesFC(); });
  });
}

/** Checkbox "Obrigatório" pros cards de áudio/gravação — quando marcado, o "Próximo" só libera
 * depois que a aluna escutar o áudio até o fim (Card de áudio/gravação) ou gravar pelo menos uma
 * vez (Card de gravação do aluno); `rotulo` já vem escrito certo pra cada caso. */
function htmlCampoObrigatorio(rotulo) {
  return `<label class="campo-check"><input type="checkbox" data-obrigatorio> ${escaparHtml(rotulo)}</label>`;
}
function ligarCampoObrigatorio(bloco, obj) {
  const input = bloco.querySelector('[data-obrigatorio]');
  input.checked = !!obj.obrigatorio;
  input.addEventListener('change', () => { obj.obrigatorio = input.checked; renderPreviewAtual(); });
}

/** "Card de áudio" — importa um arquivo de áudio do computador (embutido em base64, mesmo padrão
 * do Card com imagem) pra tocar, com título/subtítulo/texto opcionais embaixo do player. */
function renderBlocoAudio(bloco, item) {
  const a = item.audio;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Card de áudio</strong></div>
      <div class="campo">
        <label>Arquivo de áudio</label>
        <button type="button" class="btn-add-item btn-importar-audio">Importar arquivo de áudio</button>
        <input type="file" accept="audio/*" class="input-arquivo-audio" hidden>
        <div class="campo-audio-preview"></div>
      </div>
      <div class="campo">${htmlCampoObrigatorio('Obrigatório escutar até o fim pra liberar o Próximo')}</div>
      <div class="campo">${htmlLabelComEstilo('Título (opcional)', 'titulo')}<input type="text" data-af="titulo" placeholder="Ex: Título do card"></div>
      <div class="campo">${htmlLabelComEstilo('Subtítulo (opcional)', 'subtitulo')}<input type="text" data-af="subtitulo" placeholder="Ex: Subtítulo do card"></div>
      <div class="campo">${htmlLabelComEstilo('Texto (opcional)', 'texto')}<textarea data-af="texto"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueAudio"></div>
    </div>`;
  bloco.querySelectorAll('[data-af]').forEach(input => {
    input.value = a[input.dataset.af] || '';
    input.addEventListener('input', () => { a[input.dataset.af] = input.value; renderPreviewAtual(); });
  });

  const previewWrap = bloco.querySelector('.campo-audio-preview');
  function renderAudioPreview() {
    previewWrap.innerHTML = a.audioUrl ? `<audio controls src="${escaparHtml(a.audioUrl)}"></audio>` : '';
  }
  renderAudioPreview();

  const inputArquivo = bloco.querySelector('.input-arquivo-audio');
  bloco.querySelector('.btn-importar-audio').addEventListener('click', () => inputArquivo.click());
  inputArquivo.addEventListener('change', () => {
    const arquivo = inputArquivo.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      a.audioUrl = leitor.result;
      renderAudioPreview();
      renderPreviewAtual();
    };
    leitor.readAsDataURL(arquivo);
  });

  ligarCampoObrigatorio(bloco, a);
  ligarBotoesEstiloTexto(bloco, a);
  const renderDestaquesA = montarDestaqueFrases(bloco.querySelector('#listaDestaqueAudio'), a, [
    { rotulo: 'Título', campo: 'titulo' },
    { rotulo: 'Subtítulo', campo: 'subtitulo' },
    { rotulo: 'Texto', campo: 'texto' },
  ]);
  bloco.querySelectorAll('[data-af="titulo"], [data-af="subtitulo"], [data-af="texto"]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(a, input.dataset.af); renderDestaquesA(); });
  });
}

/** Só uma gravação por vez pode estar em andamento na tela (guarda o stream/recorder ativos pra
 * conseguir parar ao clicar de novo no botão, mesmo se o bloco tiver sido re-renderizado). */
let _gravacaoAtiva = null;

/** "Card de gravação" — grava a própria voz direto pelo microfone (MediaRecorder da Web API), sem
 * precisar de nenhum arquivo pronto; ao parar, já mostra o player pra ouvir o resultado na hora
 * (mesmo formulário do Card de áudio depois disso — título/subtítulo/texto opcionais). Precisa
 * rodar em contexto seguro (https ou localhost) — em file:// o navegador pode bloquear o microfone. */
function renderBlocoGravacao(bloco, item) {
  const g = item.gravacao;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Card de gravação</strong></div>
      <div class="campo">
        <label>Grave sua voz pelo microfone</label>
        <div class="campo-gravacao-controles">
          <button type="button" class="btn-add-item btn-gravar-audio">🎙️ Gravar áudio</button>
          <span class="gravacao-status"></span>
        </div>
        <div class="campo-audio-preview"></div>
      </div>
      <div class="campo">${htmlCampoObrigatorio('Obrigatório escutar até o fim pra liberar o Próximo')}</div>
      <div class="campo">${htmlLabelComEstilo('Título (opcional)', 'titulo')}<input type="text" data-gf="titulo" placeholder="Ex: Título do card"></div>
      <div class="campo">${htmlLabelComEstilo('Subtítulo (opcional)', 'subtitulo')}<input type="text" data-gf="subtitulo" placeholder="Ex: Subtítulo do card"></div>
      <div class="campo">${htmlLabelComEstilo('Texto (opcional)', 'texto')}<textarea data-gf="texto"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueGravacao"></div>
    </div>`;
  bloco.querySelectorAll('[data-gf]').forEach(input => {
    input.value = g[input.dataset.gf] || '';
    input.addEventListener('input', () => { g[input.dataset.gf] = input.value; renderPreviewAtual(); });
  });

  const btnGravar = bloco.querySelector('.btn-gravar-audio');
  const status = bloco.querySelector('.gravacao-status');
  const previewWrap = bloco.querySelector('.campo-audio-preview');

  function renderAudioPreview() {
    previewWrap.innerHTML = g.audioUrl ? `<audio controls src="${escaparHtml(g.audioUrl)}"></audio>` : '';
    btnGravar.textContent = g.audioUrl ? '🎙️ Gravar novamente' : '🎙️ Gravar áudio';
  }
  renderAudioPreview();

  btnGravar.addEventListener('click', async () => {
    if (_gravacaoAtiva) { _gravacaoAtiva.recorder.stop(); return; } // clique de novo enquanto grava = parar
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status.textContent = 'Seu navegador não permite gravar áudio aqui.';
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      status.textContent = 'Não deu pra acessar o microfone (permissão negada?).';
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      _gravacaoAtiva = null;
      btnGravar.classList.remove('gravando');
      status.textContent = '';
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const leitor = new FileReader();
      leitor.onload = () => {
        g.audioUrl = leitor.result;
        renderAudioPreview();
        renderPreviewAtual();
      };
      leitor.readAsDataURL(blob);
    };
    _gravacaoAtiva = { stream, recorder };
    recorder.start();
    btnGravar.textContent = '⏹️ Parar gravação';
    btnGravar.classList.add('gravando');
    status.textContent = 'Gravando...';
  });

  ligarCampoObrigatorio(bloco, g);
  ligarBotoesEstiloTexto(bloco, g);
  const renderDestaquesG = montarDestaqueFrases(bloco.querySelector('#listaDestaqueGravacao'), g, [
    { rotulo: 'Título', campo: 'titulo' },
    { rotulo: 'Subtítulo', campo: 'subtitulo' },
    { rotulo: 'Texto', campo: 'texto' },
  ]);
  bloco.querySelectorAll('[data-gf="titulo"], [data-gf="subtitulo"], [data-gf="texto"]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(g, input.dataset.gf); renderDestaquesG(); });
  });
}

/** "Card de gravação do aluno" — diferente do "Card de gravação" (que é a professora quem grava,
 * aqui no Construtor), este não tem áudio nenhum pra configurar: é a ALUNA quem grava a própria
 * voz, no player de verdade, ao estudar a aula. Por isso o formulário só tem título/subtítulo/
 * texto opcionais (o prompt do que ela deve falar) — sem botão de gravar nem de importar arquivo. */
function renderBlocoGravacaoAluno(bloco, item) {
  const g = item.gravacaoAluno;
  bloco.innerHTML = `
    <div class="item-card">
      <div class="item-card-topo"><strong>Card de gravação do aluno</strong></div>
      <p class="pp-vazio" style="margin:0 0 4px">A aluna vai gravar a própria voz aqui, ao estudar a aula — não dá pra gravar por ela no Construtor.</p>
      <div class="campo">${htmlCampoObrigatorio('Obrigatório gravar pra liberar o Próximo')}</div>
      <div class="campo">${htmlLabelComEstilo('Título (opcional)', 'titulo')}<input type="text" data-gaf="titulo" placeholder="Ex: Agora é sua vez"></div>
      <div class="campo">${htmlLabelComEstilo('Subtítulo (opcional)', 'subtitulo')}<input type="text" data-gaf="subtitulo" placeholder="Ex: Grave-se lendo a frase abaixo"></div>
      <div class="campo">${htmlLabelComEstilo('Texto (opcional)', 'texto')}<textarea data-gaf="texto"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueGravacaoAluno"></div>
    </div>`;
  bloco.querySelectorAll('[data-gaf]').forEach(input => {
    input.value = g[input.dataset.gaf] || '';
    input.addEventListener('input', () => { g[input.dataset.gaf] = input.value; renderPreviewAtual(); });
  });

  ligarCampoObrigatorio(bloco, g);
  ligarBotoesEstiloTexto(bloco, g);
  const renderDestaquesGA = montarDestaqueFrases(bloco.querySelector('#listaDestaqueGravacaoAluno'), g, [
    { rotulo: 'Título', campo: 'titulo' },
    { rotulo: 'Subtítulo', campo: 'subtitulo' },
    { rotulo: 'Texto', campo: 'texto' },
  ]);
  bloco.querySelectorAll('[data-gaf="titulo"], [data-gaf="subtitulo"], [data-gaf="texto"]').forEach(input => {
    input.addEventListener('blur', () => { podarDestaque(g, input.dataset.gaf); renderDestaquesGA(); });
  });
}

function renderFormChecagem(el, conteudo, passo) {
  const item = conteudo.checagem[passo.idx];
  // multiplosRotulos também usa "sentenca" (array), então precisa ser conferido ANTES de "palavra".
  const modo = item.multiplosRotulos ? 'multiplosRotulos'
    : Array.isArray(item.sentenca) ? 'palavra'
    : (item.certoErrado ? 'certoErrado' : 'multipla');
  const ROTULO_MODO = {
    palavra: '🖱️ Selecione a palavra',
    certoErrado: '✅❌ Certo ou errado',
    multipla: '☑️ Questão múltipla escolha',
    multiplosRotulos: '🏷️ Múltiplos Rótulos',
  };

  // O tipo de exercício já foi escolhido em "Tipo (Telas)" ao criar essa checagem — sem seletor
  // duplicado aqui, só um rótulo indicando qual é.
  el.innerHTML = `
    <div class="form-secao">
      <div class="checagem-modo-rotulo">${ROTULO_MODO[modo]}</div>
      <div id="corpoChecagem"></div>
    </div>`;

  const corpo = el.querySelector('#corpoChecagem');
  if (modo === 'multiplosRotulos') renderCorpoChecagemMultiplosRotulos(corpo, item);
  else if (modo === 'palavra') renderCorpoChecagemPalavra(corpo, item);
  else renderCorpoChecagemMultipla(corpo, item);
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
    <div class="secao-titulo-editor">${item.certoErrado ? 'Certo ou Errado (marque a correta)' : 'Alternativas (marque a correta)'}</div>
    <div class="lista-itens" id="listaOpcoes"></div>
    ${item.certoErrado ? '' : '<button class="btn-add-item" type="button" id="btnAddOpcao">+ Adicionar alternativa</button>'}
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
          ${item.certoErrado ? '' : '<button class="btn-remover-item" type="button">Remover</button>'}
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
      const btnRemover = card.querySelector('.btn-remover-item');
      if (btnRemover) btnRemover.addEventListener('click', () => {
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
  const btnAddOpcao = corpo.querySelector('#btnAddOpcao');
  if (btnAddOpcao) btnAddOpcao.addEventListener('click', () => {
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

/** "Múltiplos Rótulos (questão)" — versão de CHECAGEM (com correção) do card de Exemplo "Palavra(s)
 * com Múltiplos Rótulos": a aluna escolhe um papel (os botões vêm dos rótulos que você escrever
 * aqui — não são fixos, podem ser qualquer nome: VERBO/SUJEITO/PREDICADO, ou qualquer outra coisa)
 * e clica nas palavras certas de cada um; uma palavra pode ter mais de um papel ao mesmo tempo,
 * separando com ";" — mesma regra do card de Exemplo. */
function renderCorpoChecagemMultiplosRotulos(corpo, item) {
  if (!Array.isArray(item.sentenca)) item.sentenca = [];
  if (!Array.isArray(item.rotulos)) item.rotulos = [];
  if (item.mostrarRespostaCadaItem === undefined) item.mostrarRespostaCadaItem = true;
  migrarFeedbackChecagem(item);
  const fraseAtual = item.sentenca.join(' ').replace(/ ([.,!?;:])/g, '$1');

  corpo.innerHTML = `
    <div class="campo">${htmlLabelComEstilo('Título / instrução', 'titulo')}<textarea data-f="titulo" placeholder="Ex: Clique no verbo, no sujeito e no predicado da frase:"></textarea></div>
    <div class="campo"><label>Frase (edite e clique fora para gerar as palavras)</label><textarea id="mrFraseTexto" placeholder="Ex: O menino leu o livro."></textarea></div>
    <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
    <div id="listaDestaqueChecMr"></div>
    <div class="secao-titulo-editor">Rótulo de cada palavra (deixe em branco se não tiver)</div>
    <p class="pp-vazio" style="margin:0 0 10px">Os botões que a aluna vê vêm dos nomes que você escrever aqui (ex: VERBO, SUJEITO, PREDICADO). Uma palavra pode ter mais de um rótulo — separe com ; (ex: "leu" pode ser <strong>VERBO;PREDICADO</strong>).</p>
    <div class="lista-itens" id="listaPalavrasChecMr"></div>
    <div class="campo"><label class="campo-check"><input type="checkbox" id="chkMostrarRespostaCadaItem"> Mostrar "Resposta de cada item" ao confirmar</label></div>
    <div class="campo" style="margin-top:12px"><label>✅ Feedback quando ACERTAR</label><textarea data-f="feedbackCorreto"></textarea></div>
    <div class="campo"><label>❌ Feedback quando ERRAR</label><textarea data-f="feedbackErrado"></textarea></div>`;

  corpo.querySelectorAll('[data-f]').forEach(input => {
    input.value = item[input.dataset.f] || '';
    input.addEventListener('input', () => { item[input.dataset.f] = input.value; renderPreviewAtual(); });
  });
  ligarBotoesEstiloTexto(corpo, item);

  corpo.querySelector('#chkMostrarRespostaCadaItem').checked = item.mostrarRespostaCadaItem;
  corpo.querySelector('#chkMostrarRespostaCadaItem').addEventListener('change', e => {
    item.mostrarRespostaCadaItem = e.target.checked;
    renderPreviewAtual();
  });

  const renderDestaquesChecMr = montarDestaqueFrases(corpo.querySelector('#listaDestaqueChecMr'), item, [
    { rotulo: 'Título / instrução', campo: 'titulo' },
  ]);
  corpo.querySelector('[data-f="titulo"]').addEventListener('blur', () => { podarDestaque(item, 'titulo'); renderDestaquesChecMr(); });

  const fraseInput = corpo.querySelector('#mrFraseTexto');
  fraseInput.value = fraseAtual;

  const listaPalavras = corpo.querySelector('#listaPalavrasChecMr');
  function renderPalavras() {
    listaPalavras.innerHTML = '';
    item.sentenca.forEach((tok, i) => {
      if (ehPontuacao(tok)) return;
      if (item.rotulos[i] === undefined) item.rotulos[i] = '';
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="campo-linha">
          <strong style="min-width:70px;display:flex;align-items:center;">"${escaparHtml(tok)}"</strong>
          <input type="text" data-rotulo placeholder="Ex: VERBO ou VERBO;PREDICADO">
        </div>`;
      card.querySelector('[data-rotulo]').value = item.rotulos[i] || '';
      card.querySelector('[data-rotulo]').addEventListener('input', e => { item.rotulos[i] = e.target.value; renderPreviewAtual(); });
      listaPalavras.appendChild(card);
    });
    if (!item.sentenca.length) listaPalavras.innerHTML = '<p class="pp-vazio">Escreva a frase acima pra marcar os rótulos.</p>';
  }
  renderPalavras();

  fraseInput.addEventListener('blur', () => {
    item.sentenca = tokenizarFrase(fraseInput.value);
    item.rotulos = item.sentenca.map((_, i) => item.rotulos[i] || '');
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

function renderFormLista(el, conteudo, passo) {
  const li = conteudo.lista[passo.idx];
  el.innerHTML = `
    <div class="form-secao">
      <div class="campo-check"><input type="checkbox" id="chkListaIcone"><label for="chkListaIcone">Ícone no topo do card (opcional)</label></div>
      <div id="listaIconeWrap" style="display:none">
        <div class="campo">${htmlTipoIconePicker(li.icone || {}, (li.icone && li.icone.cor) || '#5B2BCB')}</div>
        ${htmlCampoIconeExterno(li.icone || {})}
        <div class="campo-linha">
          <div class="campo"><label>Cor</label><input type="color" data-lif="cor"></div>
          <div class="campo"><label>Fundo</label><input type="color" data-lif="corFundo"></div>
        </div>
      </div>
      <div class="campo" style="margin-top:16px">${htmlLabelComEstilo('Título', 'titulo')}<input type="text" id="listaTitulo"></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueListaTitulo"></div>
      <div class="campo" style="margin-top:16px">${htmlLabelComEstilo('Texto antes da lista (opcional)', 'textoAntes')}<textarea id="listaTextoAntes" rows="3"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueListaTextoAntes"></div>
      <div class="secao-titulo-editor">Itens (ícone + texto)</div>
      <div class="lista-itens" id="listaListaItens"></div>
      <button class="btn-add-item" type="button" id="btnAddListaItem">+ Adicionar item</button>
      <div class="campo" style="margin-top:16px">${htmlLabelComEstilo('Texto depois da lista (opcional)', 'descricao')}<textarea id="listaDescricao" rows="4"></textarea></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="listaDestaqueListaDescricao"></div>
    </div>`;

  const chkIcone = el.querySelector('#chkListaIcone');
  const iconeWrap = el.querySelector('#listaIconeWrap');
  chkIcone.checked = !!li.icone;
  iconeWrap.style.display = li.icone ? '' : 'none';
  if (li.icone) {
    el.querySelector('[data-lif="cor"]').value = li.icone.cor || '#5B2BCB';
    el.querySelector('[data-lif="corFundo"]').value = li.icone.corFundo || '#f0eaff';
    el.querySelectorAll('[data-lif]').forEach(input => {
      input.addEventListener('input', () => { li.icone[input.dataset.lif] = input.value; renderPreviewAtual(); });
    });
    el.querySelector('[data-lif="cor"]').addEventListener('input', () => {
      el.querySelector('.campo-tipo-icone-preview').innerHTML = iconeTipo(li.icone.tipo, li.icone.cor || '#5B2BCB', li.icone.iconeUrl);
    });
    ligarCampoIconeExterno(el, li.icone);
    ligarTipoIconePicker(el, li.icone, li.icone.cor || '#5B2BCB', renderPreviewAtual);
  }
  chkIcone.addEventListener('change', () => {
    if (chkIcone.checked) { li.icone = li.icone || { tipo: 'acao', cor: '#5B2BCB', corFundo: '#f0eaff' }; }
    else { delete li.icone; }
    renderFormLista(el, conteudo, passo);
    renderPreviewAtual();
  });
  el.querySelector('#listaTitulo').value = li.titulo || '';
  el.querySelector('#listaTitulo').addEventListener('input', e => { li.titulo = e.target.value; renderPreviewAtual(); });
  el.querySelector('#listaTextoAntes').value = li.textoAntes || '';
  el.querySelector('#listaTextoAntes').addEventListener('input', e => { li.textoAntes = e.target.value; renderPreviewAtual(); });
  el.querySelector('#listaDescricao').value = li.descricao || '';
  el.querySelector('#listaDescricao').addEventListener('input', e => { li.descricao = e.target.value; renderPreviewAtual(); });
  ligarBotoesEstiloTexto(el, li);

  const renderDestaquesListaTitulo = montarDestaqueFrases(el.querySelector('#listaDestaqueListaTitulo'), li, [
    { rotulo: 'Título', campo: 'titulo' },
  ]);
  el.querySelector('#listaTitulo').addEventListener('blur', () => { podarDestaque(li, 'titulo'); renderDestaquesListaTitulo(); });

  const renderDestaquesListaTextoAntes = montarDestaqueFrases(el.querySelector('#listaDestaqueListaTextoAntes'), li, [
    { rotulo: 'Texto antes', campo: 'textoAntes' },
  ]);
  el.querySelector('#listaTextoAntes').addEventListener('blur', () => { podarDestaque(li, 'textoAntes'); renderDestaquesListaTextoAntes(); });

  const renderDestaquesListaDescricao = montarDestaqueFrases(el.querySelector('#listaDestaqueListaDescricao'), li, [
    { rotulo: 'Descrição', campo: 'descricao' },
  ]);
  el.querySelector('#listaDescricao').addEventListener('blur', () => { podarDestaque(li, 'descricao'); renderDestaquesListaDescricao(); });

  const lista = el.querySelector('#listaListaItens');
  function renderItens() {
    lista.innerHTML = '';
    li.itens.forEach((it, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo"><strong>Item ${i + 1}</strong><button class="btn-remover-item" type="button">Remover</button></div>
        <div class="campo">${htmlTipoIconePicker(it, it.cor || '#5B2BCB')}</div>
        ${htmlCampoIconeExterno(it)}
        <div class="campo-linha">
          <div class="campo"><label>Cor</label><input type="color" data-lf="cor"></div>
          <div class="campo"><label>Fundo</label><input type="color" data-lf="corFundo"></div>
        </div>
        <div class="campo">${htmlLabelComEstilo('Texto', 'texto')}<input type="text" data-lf="texto" placeholder="Ex: Construir escolas."></div>
        <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
        <div id="listaDestaqueListaItem${i}"></div>`;
      card.querySelector('[data-lf="cor"]').value = it.cor || '#5B2BCB';
      card.querySelector('[data-lf="corFundo"]').value = it.corFundo || '#f0eaff';
      card.querySelector('[data-lf="texto"]').value = it.texto || '';
      card.querySelectorAll('[data-lf]').forEach(input => {
        input.addEventListener('input', () => { it[input.dataset.lf] = input.value; renderPreviewAtual(); });
      });
      ligarBotoesEstiloTexto(card, it);
      const renderDestaquesListaItem = montarDestaqueFrases(card.querySelector(`#listaDestaqueListaItem${i}`), it, [
        { rotulo: 'Texto', campo: 'texto' },
      ]);
      card.querySelector('[data-lf="texto"]').addEventListener('blur', () => { podarDestaque(it, 'texto'); renderDestaquesListaItem(); });
      ligarCampoIconeExterno(card, it);
      ligarTipoIconePicker(card, it, it.cor || '#5B2BCB', renderPreviewAtual);
      card.querySelector('[data-lf="cor"]').addEventListener('input', () => {
        card.querySelector('.campo-tipo-icone-preview').innerHTML = iconeTipo(it.tipo, it.cor || '#5B2BCB', it.iconeUrl);
      });
      card.querySelector('.btn-remover-item').addEventListener('click', () => { li.itens.splice(i, 1); renderItens(); renderPreviewAtual(); });
      lista.appendChild(card);
    });
  }
  renderItens();
  el.querySelector('#btnAddListaItem').addEventListener('click', () => {
    li.itens.push({ tipo: 'acao', cor: '#5B2BCB', corFundo: '#f0eaff', texto: '' });
    renderItens(); renderPreviewAtual();
  });
}

/** Timeline: linha do tempo com pontos clicáveis — cada "evento" tem ano/título
 * (rótulo do ponto) e, ao clicar, abre um card com descrição + lista de
 * características (uma por linha, sem destaque por palavra — texto curto,
 * não precisa da mesma finura dos campos de parágrafo). */
function renderFormTimeline(el, conteudo, passo) {
  const tl = conteudo.timeline[passo.idx];
  el.innerHTML = `
    <div class="form-secao">
      <div class="campo">${htmlLabelComEstilo('Título', 'titulo')}<input type="text" id="tlTitulo"></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="tlDestaqueTitulo"></div>
      <div class="campo" style="margin-top:16px">${htmlLabelComEstilo('Instrução (opcional)', 'instrucao')}<input type="text" id="tlInstrucao" placeholder="Ex: Clique em um período da linha do tempo para ver os detalhes."></div>
      <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
      <div id="tlDestaqueInstrucao"></div>
      <div class="secao-titulo-editor">Períodos (pontos da linha do tempo)</div>
      <div class="lista-itens" id="tlEventos"></div>
      <button class="btn-add-item" type="button" id="btnAddTlEvento">+ Adicionar período</button>
    </div>`;

  el.querySelector('#tlTitulo').value = tl.titulo || '';
  el.querySelector('#tlTitulo').addEventListener('input', e => { tl.titulo = e.target.value; renderPreviewAtual(); });
  el.querySelector('#tlInstrucao').value = tl.instrucao || '';
  el.querySelector('#tlInstrucao').addEventListener('input', e => { tl.instrucao = e.target.value; renderPreviewAtual(); });
  ligarBotoesEstiloTexto(el, tl);

  const renderDestaquesTlTitulo = montarDestaqueFrases(el.querySelector('#tlDestaqueTitulo'), tl, [
    { rotulo: 'Título', campo: 'titulo' },
  ]);
  el.querySelector('#tlTitulo').addEventListener('blur', () => { podarDestaque(tl, 'titulo'); renderDestaquesTlTitulo(); });

  const renderDestaquesTlInstrucao = montarDestaqueFrases(el.querySelector('#tlDestaqueInstrucao'), tl, [
    { rotulo: 'Instrução', campo: 'instrucao' },
  ]);
  el.querySelector('#tlInstrucao').addEventListener('blur', () => { podarDestaque(tl, 'instrucao'); renderDestaquesTlInstrucao(); });

  const listaEventos = el.querySelector('#tlEventos');
  function renderEventos() {
    listaEventos.innerHTML = '';
    tl.eventos.forEach((ev, i) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-topo"><strong>Período ${i + 1}</strong><button class="btn-remover-item" type="button">Remover</button></div>
        <div class="campo-linha">
          <div class="campo"><label>Ano (ou período, ex: "1964 – 1985")</label><input type="text" data-tf="ano" placeholder="Ex: 1500"></div>
          <div class="campo" style="flex:0 0 auto"><label>Cor</label><input type="color" data-tf="cor"></div>
        </div>
        <div class="campo">${htmlLabelComEstilo('Título do período', 'titulo')}<input type="text" data-tf="titulo" placeholder="Ex: Período Colonial"></div>
        <div class="secao-titulo-editor" style="margin-top:12px">Destaque nas frases (palavras em azul)</div>
        <div id="tlDestaqueEventoTitulo${i}"></div>
        <div class="campo" style="margin-top:12px">${htmlLabelComEstilo('Descrição', 'descricao')}<textarea data-tf="descricao" rows="3"></textarea></div>
        <div class="secao-titulo-editor">Destaque nas frases (palavras em azul)</div>
        <div id="tlDestaqueEventoDescricao${i}"></div>
        <div class="campo" style="margin-top:12px"><label>Características (uma por linha, opcional)</label><textarea data-tf="caracteristicas" rows="4" placeholder="Ex:&#10;Regime autoritário e centralização do poder&#10;Censura à imprensa"></textarea></div>`;
      card.querySelector('[data-tf="ano"]').value = ev.ano || '';
      card.querySelector('[data-tf="cor"]').value = ev.cor || '#5B2BCB';
      card.querySelector('[data-tf="titulo"]').value = ev.titulo || '';
      card.querySelector('[data-tf="descricao"]').value = ev.descricao || '';
      card.querySelector('[data-tf="caracteristicas"]').value = ev.caracteristicas || '';
      card.querySelectorAll('[data-tf]').forEach(input => {
        input.addEventListener('input', () => { ev[input.dataset.tf] = input.value; renderPreviewAtual(); });
      });
      ligarBotoesEstiloTexto(card, ev);

      const renderDestaquesEventoTitulo = montarDestaqueFrases(card.querySelector(`#tlDestaqueEventoTitulo${i}`), ev, [
        { rotulo: 'Título', campo: 'titulo' },
      ]);
      card.querySelector('[data-tf="titulo"]').addEventListener('blur', () => { podarDestaque(ev, 'titulo'); renderDestaquesEventoTitulo(); });

      const renderDestaquesEventoDescricao = montarDestaqueFrases(card.querySelector(`#tlDestaqueEventoDescricao${i}`), ev, [
        { rotulo: 'Descrição', campo: 'descricao' },
      ]);
      card.querySelector('[data-tf="descricao"]').addEventListener('blur', () => { podarDestaque(ev, 'descricao'); renderDestaquesEventoDescricao(); });

      card.querySelector('.btn-remover-item').addEventListener('click', () => { tl.eventos.splice(i, 1); renderEventos(); renderPreviewAtual(); });
      listaEventos.appendChild(card);
    });
  }
  renderEventos();
  el.querySelector('#btnAddTlEvento').addEventListener('click', () => {
    tl.eventos.push({ ano: '', titulo: '', cor: '#5B2BCB', descricao: '', caracteristicas: '' });
    renderEventos(); renderPreviewAtual();
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
  livro: cor => `<path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path fill="none" stroke="${cor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  certo: cor => `<path fill="none" stroke="${cor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>`,
  errado: cor => `<path fill="none" stroke="${cor}" stroke-width="2.5" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>`,
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
  if (passo.tipo === 'lista') return { html: previewLista(aula.conteudo.lista[passo.idx]), temToggle: false };
  if (passo.tipo === 'timeline') return { html: previewTimeline(aula.conteudo.timeline[passo.idx]), temToggle: false };
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

// Ícones fixos do "Antes de começar" (livro/lâmpada) — cópia exata dos usados no player real
// (vendor/estudo/js/estudo.mjs:mostrarIntro), pra prévia mostrar o mesmo que a aluna vai ver.
// Não são escolhidos pela professora (ver TIPOS_ICONE) — ficam sempre fixos nesses dois campos.
const ICONE_PP_LIVRO = '<svg viewBox="0 0 24 24" fill="none" stroke="#4A80F0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
const ICONE_PP_LAMPADA = '<svg viewBox="0 0 24 24" fill="none" stroke="#4A80F0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';

function previewAntesComecar(d) {
  if (!d.titulo && !d.descricao) return '<p class="pp-vazio">Preencha os campos ao lado para ver a prévia.</p>';
  const itemAprender = d.aprender ? `
    <div class="pp-ac-info-item">
      <div class="pp-ac-info-icone-wrap">${ICONE_PP_LIVRO}</div>
      <div class="pp-ac-info-texto">
        <h3>O que você vai aprender</h3>
        <p${estiloTextoInline(d, 'aprender')}>${renderFraseComDestaque(d.aprender, d.aprenderDestaque, d.aprenderDestaqueNegrito)}</p>
      </div>
    </div>` : '';
  const itemImportancia = d.importancia ? `
    <div class="pp-ac-info-item">
      <div class="pp-ac-info-icone-wrap">${ICONE_PP_LAMPADA}</div>
      <div class="pp-ac-info-texto">
        <h3>Por que isso é importante</h3>
        <p${estiloTextoInline(d, 'importancia')}>${renderFraseComDestaque(d.importancia, d.importanciaDestaque, d.importanciaDestaqueNegrito)}</p>
      </div>
    </div>` : '';
  return `
    <span class="pp-marcar-cartao"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></span>
    <span class="pp-intro-label">Antes de começar</span>
    <p class="pp-titulo pp-intro-titulo"${estiloTextoInline(d, 'titulo')}>${renderFraseComDestaque(d.titulo, d.tituloDestaque, d.tituloDestaqueNegrito)}</p>
    <p class="pp-intro-desc"${estiloTextoInline(d, 'descricao')}>${renderFraseComDestaque(d.descricao, d.descricaoDestaque, d.descricaoDestaqueNegrito)}</p>
    ${(itemAprender || itemImportancia) ? `<div class="pp-ac-info">${itemAprender}${itemImportancia}</div>` : ''}`;
}

function previewExemplo(item) {
  const temPalavraSelecionavel = item.palavraSelecionavel && item.palavraSelecionavel.sentenca && item.palavraSelecionavel.sentenca.length;
  const temPalavraSelecionavelMultipla = item.palavraSelecionavelMultipla && item.palavraSelecionavelMultipla.sentenca && item.palavraSelecionavelMultipla.sentenca.length;
  const temPalavraPointLabelExemplo = item.palavraPointLabelExemplo && item.palavraPointLabelExemplo.sentenca && item.palavraPointLabelExemplo.sentenca.length;
  const temPalavraMultiplosRotulos = item.palavraMultiplosRotulos && item.palavraMultiplosRotulos.sentenca && item.palavraMultiplosRotulos.sentenca.length;
  const temCardImagem = item.cardImagem && (item.cardImagem.imagemUrl || item.cardImagem.titulo || item.cardImagem.subtitulo || item.cardImagem.texto);
  const temFlashcard = item.flashcard && (item.flashcard.frente || item.flashcard.verso);
  const temAudio = item.audio && (item.audio.audioUrl || item.audio.titulo || item.audio.subtitulo || item.audio.texto);
  const temGravacao = item.gravacao && (item.gravacao.audioUrl || item.gravacao.titulo || item.gravacao.subtitulo || item.gravacao.texto);
  const temGravacaoAluno = !!item.gravacaoAluno; // sem audioUrl (quem grava é a aluna, no player) — o card sempre existe uma vez criado
  if (!item.texto && !temPalavraSelecionavel && !temPalavraSelecionavelMultipla && !temPalavraPointLabelExemplo && !temPalavraMultiplosRotulos && !temCardImagem && !temFlashcard && !temAudio && !temGravacao && !temGravacaoAluno) return '<p class="pp-vazio">Preencha o texto para ver a prévia.</p>';
  return `
    <div class="pp-exemplo-icone">${iconeTipo(item.tipo, '#4A80F0', item.iconeUrl)}</div>
    ${item.texto ? `<p class="pp-exemplo-texto"${estiloTextoInline(item, 'texto')}>${renderFraseComDestaque(item.texto, item.textoDestaque, item.textoDestaqueNegrito)}</p>` : ''}
    ${item.conclusao ? `<p class="pp-exemplo-conclusao"${estiloTextoInline(item, 'conclusao')}>${renderFraseComDestaque(item.conclusao, item.conclusaoDestaque, item.conclusaoDestaqueNegrito)}</p>` : ''}
    ${item.obs ? `
    <div class="pp-exemplo-obs-box">
      <span class="pp-exemplo-obs-icone"><svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" fill="#4A80F0"/><rect x="11" y="10" width="2" height="7" rx="1" fill="#fff"/><rect x="11" y="6.5" width="2" height="2" rx="1" fill="#fff"/></svg></span>
      <p class="pp-exemplo-obs-texto"${estiloTextoInline(item, 'obs')}>${renderFraseComDestaque(item.obs, item.obsDestaque, item.obsDestaqueNegrito)}</p>
    </div>` : ''}
    ${(item.pontos && item.pontos.length) ? `<div class="pp-pontos">${item.pontos.map(p => `
      <div class="pp-ponto"><div class="pp-ponto-icone">${iconeTipo(p.tipo, '#4A80F0', p.iconeUrl)}</div><p class="pp-ponto-texto"${estiloTextoInline(p, 'texto')}>${renderFraseComDestaque(p.texto, p.textoDestaque, p.textoDestaqueNegrito)}</p></div>`).join('')}</div>` : ''}
    ${item.palavraSelecionavel ? previewPalavraSelecionavel(item.palavraSelecionavel) : ''}
    ${item.palavraSelecionavelMultipla ? previewPalavraSelecionavelMultipla(item.palavraSelecionavelMultipla) : ''}
    ${item.palavraPointLabelExemplo ? previewPalavraSelecionavelMultipla(item.palavraPointLabelExemplo, 'Exemplo:') : ''}
    ${item.palavraMultiplosRotulos ? previewPalavraMultiplosRotulos(item.palavraMultiplosRotulos) : ''}
    ${item.cardImagem ? previewCardImagem(item.cardImagem) : ''}
    ${item.flashcard ? previewFlashcard(item.flashcard) : ''}
    ${item.audio ? previewAudioCard(item.audio) : ''}
    ${item.gravacao ? previewAudioCard(item.gravacao) : ''}
    ${item.gravacaoAluno ? previewGravacaoAlunoCard(item.gravacaoAluno) : ''}`;
}

/** Selo "Obrigatório" mostrado na prévia do Construtor quando o card de áudio/gravação está
 * marcado como obrigatório — só ilustrativo aqui (quem trava o Próximo de verdade é o player). */
function tagObrigatorio(obj) {
  return obj.obrigatorio ? '<span class="pp-audio-obrigatorio-tag">Obrigatório</span>' : '';
}

/** Prévia do "Card com imagem" — só ilustrativo: imagem grande em cima, texto embaixo. */
function previewCardImagem(ci) {
  if (!ci.imagemUrl && !ci.titulo && !ci.subtitulo && !ci.texto) return '';
  const temCorpo = ci.titulo || ci.subtitulo || ci.texto;
  return `
    <div class="pp-card-imagem">
      ${ci.imagemUrl ? `<img class="pp-card-imagem-img" src="${escaparHtml(ci.imagemUrl)}" alt="">` : ''}
      ${temCorpo ? `<div class="pp-card-imagem-corpo">
        ${ci.titulo ? `<p class="pp-card-imagem-titulo"${estiloTextoInline(ci, 'titulo')}>${renderFraseComDestaque(ci.titulo, ci.tituloDestaque, ci.tituloDestaqueNegrito)}</p>` : ''}
        ${ci.subtitulo ? `<p class="pp-card-imagem-subtitulo"${estiloTextoInline(ci, 'subtitulo')}>${renderFraseComDestaque(ci.subtitulo, ci.subtituloDestaque, ci.subtituloDestaqueNegrito)}</p>` : ''}
        ${ci.texto ? `<p class="pp-card-imagem-texto"${estiloTextoInline(ci, 'texto')}>${renderFraseComDestaque(ci.texto, ci.textoDestaque, ci.textoDestaqueNegrito)}</p>` : ''}
      </div>` : ''}
    </div>`;
}

/** Prévia do "Card de áudio"/"Card de gravação" — mesmo layout pros dois: player de áudio nativo
 * em cima, título/subtítulo/texto opcionais embaixo (a diferença entre eles é só como o áudio foi
 * obtido no editor — arquivo importado ou gravado pelo microfone). */
function previewAudioCard(a) {
  if (!a.audioUrl && !a.titulo && !a.subtitulo && !a.texto) return '';
  return `
    <div class="pp-card-audio">
      ${tagObrigatorio(a)}
      ${(a.titulo || a.subtitulo) ? `<div class="pp-card-audio-cabecalho">
        ${a.titulo ? `<p class="pp-card-audio-titulo"${estiloTextoInline(a, 'titulo')}>${renderFraseComDestaque(a.titulo, a.tituloDestaque, a.tituloDestaqueNegrito)}</p>` : ''}
        ${a.subtitulo ? `<p class="pp-card-audio-subtitulo"${estiloTextoInline(a, 'subtitulo')}>${renderFraseComDestaque(a.subtitulo, a.subtituloDestaque, a.subtituloDestaqueNegrito)}</p>` : ''}
      </div>` : ''}
      ${a.audioUrl ? `<audio class="pp-card-audio-player" controls src="${escaparHtml(a.audioUrl)}"></audio>` : ''}
      ${a.texto ? `<p class="pp-card-audio-texto"${estiloTextoInline(a, 'texto')}>${renderFraseComDestaque(a.texto, a.textoDestaque, a.textoDestaqueNegrito)}</p>` : ''}
    </div>`;
}

/** Prévia do "Card de gravação do aluno" — mostra um "mock" não-funcional do gravador (a
 * gravação de verdade só acontece no player exportado, com a aluna estudando). */
function previewGravacaoAlunoCard(g) {
  return `
    <div class="pp-card-audio pp-card-gravacao-aluno">
      ${tagObrigatorio(g)}
      ${(g.titulo || g.subtitulo) ? `<div class="pp-card-audio-cabecalho">
        ${g.titulo ? `<p class="pp-card-audio-titulo"${estiloTextoInline(g, 'titulo')}>${renderFraseComDestaque(g.titulo, g.tituloDestaque, g.tituloDestaqueNegrito)}</p>` : ''}
        ${g.subtitulo ? `<p class="pp-card-audio-subtitulo"${estiloTextoInline(g, 'subtitulo')}>${renderFraseComDestaque(g.subtitulo, g.subtituloDestaque, g.subtituloDestaqueNegrito)}</p>` : ''}
      </div>` : ''}
      <div class="pp-gravacao-aluno-mock">🎙️ Gravar áudio</div>
      <p class="pp-gravacao-aluno-mock-nota">A aluna grava aqui, ao estudar a aula.</p>
      ${g.texto ? `<p class="pp-card-audio-texto"${estiloTextoInline(g, 'texto')}>${renderFraseComDestaque(g.texto, g.textoDestaque, g.textoDestaqueNegrito)}</p>` : ''}
    </div>`;
}

/** Prévia do "Flashcard" — no Construtor mostra os dois lados já abertos, lado a lado (aqui não
 * dá pra "virar" de verdade); só no player de verdade é que a aluna toca pra virar o card. */
function previewFlashcard(fc) {
  if (!fc.frente && !fc.verso) return '';
  return `
    <div class="pp-flashcard">
      <div class="pp-flashcard-lado">
        <span class="pp-flashcard-rotulo">Frente</span>
        ${fc.frente ? `<p class="pp-flashcard-texto"${estiloTextoInline(fc, 'frente')}>${renderFraseComDestaque(fc.frente, fc.frenteDestaque, fc.frenteDestaqueNegrito)}</p>` : ''}
      </div>
      <div class="pp-flashcard-divisor"></div>
      <div class="pp-flashcard-lado">
        <span class="pp-flashcard-rotulo">Verso</span>
        ${fc.verso ? `<p class="pp-flashcard-texto"${estiloTextoInline(fc, 'verso')}>${renderFraseComDestaque(fc.verso, fc.versoDestaque, fc.versoDestaqueNegrito)}</p>` : ''}
      </div>
    </div>`;
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

/** Uma palavra pode ter mais de um rótulo ao mesmo tempo (ex: "jogaram" é VERBO e também faz
 * parte do PREDICADO) — nesse caso, separa os rótulos por ";" no campo de texto. Retorna a lista
 * (vazia se não tiver rótulo nenhum). */
function listaRotulos(rotuloTexto) {
  return String(rotuloTexto || '').split(';').map(s => s.trim()).filter(Boolean);
}

/** Decide em que "linha" (nível de colchete) cada rótulo distinto vai ficar: um rótulo que nunca
 * aparece sozinho — só como o 2º (ou 3º...) de uma palavra com vários — fica numa linha mais
 * abaixo, pra caber o colchete mais largo embaixo dos colchetes menores (ex: SUJEITO/VERBO em
 * cima, PREDICADO — mais largo, cobre também o VERBO — embaixo). A linha de um rótulo é sempre a
 * MAIOR posição em que ele aparece em qualquer palavra, pra não pular de linha conforme a frase
 * muda de palavra em palavra. */
function linhaPorRotulo(n, rotulosBrutos) {
  const linha = new Map();
  for (let i = 0; i < n; i++) {
    listaRotulos(rotulosBrutos[i]).forEach((r, pos) => {
      linha.set(r, Math.max(linha.get(r) ?? 0, pos));
    });
  }
  return linha;
}

/** A partir da linha de cada rótulo (linhaPorRotulo), monta um array por linha — cada um no
 * formato que agruparRotulos() espera (uma entrada por palavra, '' se não tiver rótulo NESSA
 * linha). `rotulosBrutos` pode já vir filtrado (ex: só os rótulos das palavras reveladas). */
function porLinha(n, rotulosBrutos, linhaDoRotulo) {
  const totalLinhas = linhaDoRotulo.size ? Math.max(...linhaDoRotulo.values()) + 1 : 0;
  const linhas = Array.from({ length: totalLinhas }, () => Array(n).fill(''));
  for (let i = 0; i < n; i++) {
    listaRotulos(rotulosBrutos[i]).forEach(r => {
      const l = linhaDoRotulo.get(r);
      if (l !== undefined) linhas[l][i] = r;
    });
  }
  return linhas;
}

/** Paleta usada pra dar uma cor diferente a cada rótulo distinto (ex: SUJEITO roxo, VERBO verde) —
 * a cor é sempre a mesma pro mesmo texto de rótulo, na ordem em que aparecem na frase. */
const PALETA_ROTULOS = ['#7B3FF2', '#0D9488', '#DB2777', '#EA580C', '#0EA5E9', '#65A30D', '#DC2626', '#9333EA'];
function corDoRotulo(rotulo, mapaCores) {
  if (!mapaCores.has(rotulo)) mapaCores.set(rotulo, PALETA_ROTULOS[mapaCores.size % PALETA_ROTULOS.length]);
  return mapaCores.get(rotulo);
}

/** Renderiza um texto corrido (Título/Instrução) com algumas palavras em azul de destaque e/ou em
 * negrito — diferente dos "chips", aqui o texto continua fluindo normalmente, só muda o estilo da
 * palavra. Uma palavra pode ser só azul, só negrito, ou as duas coisas ao mesmo tempo. */
/** Quebra por "\n" (Enter no textarea) viram <br> — sem isso o texto sempre saía tudo numa linha
 * só. Os índices de destaque continuam contando palavra por palavra em sequência ao longo das
 * linhas (mesma ordem de tokenizarFrase(texto) inteiro), então não invalida destaques já salvos. */
function renderFraseComDestaque(texto, indices, indicesNegrito) {
  if (!texto) return '';
  const destacadas = new Set(indices || []);
  const negritos = new Set(indicesNegrito || []);
  let contador = 0;
  return texto.split('\n').map(linha => {
    const partes = tokenizarFrase(linha).map(tok => {
      const i = contador++;
      if (ehPontuacao(tok)) return escaparHtml(tok);
      const azul = destacadas.has(i);
      const negrito = negritos.has(i);
      if (!azul && !negrito) return escaparHtml(tok);
      const classe = azul ? ' class="pp-destaque-azul"' : '';
      const estilo = negrito ? ' style="font-weight:700"' : '';
      return `<span${classe}${estilo}>${escaparHtml(tok)}</span>`;
    });
    return partes.join(' ').replace(/ ([.,!?;:]+)/g, '$1');
  }).join('<br>');
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
        <p class="pp-palavra-select-instrucao"${estiloTextoInline(ps, 'instrucao')}>${ps.instrucao ? renderFraseComDestaque(ps.instrucao, ps.instrucaoDestaque, ps.instrucaoDestaqueNegrito) : escaparHtml(instrucaoPadrao || 'Selecione a palavra abaixo:')}</p>
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
    ${psm.titulo ? `<p class="pp-palavra-select-titulo"${estiloTextoInline(psm, 'titulo')}>${renderFraseComDestaque(psm.titulo, psm.tituloDestaque, psm.tituloDestaqueNegrito)}</p>` : ''}
    ${psm.subtitulo ? `<p class="pp-palavra-select-subtitulo"${estiloTextoInline(psm, 'subtitulo')}>${renderFraseComDestaque(psm.subtitulo, psm.subtituloDestaque, psm.subtituloDestaqueNegrito)}</p>` : ''}
    <div class="pp-palavra-select">
      <div class="pp-palavra-select-cabecalho">
        <div class="pp-palavra-select-icone">${iconeTipo('tarefa', '#4A80F0')}</div>
        <p class="pp-palavra-select-instrucao"${estiloTextoInline(psm, 'instrucao')}>${psm.instrucao ? renderFraseComDestaque(psm.instrucao, psm.instrucaoDestaque, psm.instrucaoDestaqueNegrito) : escaparHtml(instrucaoPadrao || 'Selecione as palavras abaixo:')}</p>
      </div>
      <div class="pp-frase-anotada">${chips}${colchetes}</div>
    </div>`;
}

/** Prévia da "Palavra(s) com Múltiplos Rótulos" — mostra tudo já resolvido (não dá pra clicar de
 * verdade na prévia), cada palavra com seu próprio colchete/rótulo embaixo. */
function previewPalavraMultiplosRotulos(pmr) {
  if (!pmr.sentenca || !pmr.sentenca.length) return '';
  const mapaCores = new Map();
  const rotulosBrutos = pmr.rotulos || [];
  const linhaDoRotulo = linhaPorRotulo(pmr.sentenca.length, rotulosBrutos);
  const chips = pmr.sentenca.map((tok, i) => {
    const pontuacao = ehPontuacao(tok);
    // A palavra fica colorida se tiver um rótulo "de primeira linha" — quando o único rótulo dela
    // é mais largo/embaixo (ex: só PREDICADO), fica sem cor própria, igual ao colchete de baixo.
    const rotuloLinha0 = listaRotulos(rotulosBrutos[i]).find(r => linhaDoRotulo.get(r) === 0);
    const estiloCor = rotuloLinha0 ? `;border-color:${corDoRotulo(rotuloLinha0, mapaCores)};background:${corDoRotulo(rotuloLinha0, mapaCores)}1a;color:${corDoRotulo(rotuloLinha0, mapaCores)}` : '';
    return `<span class="pp-chip${pontuacao ? ' pontuacao' : ''}" style="grid-column:${i + 1};grid-row:1${estiloCor}">${escaparHtml(tok)}</span>`;
  }).join('');
  const colchetes = porLinha(pmr.sentenca.length, rotulosBrutos, linhaDoRotulo).map((linhaArr, linhaIdx) =>
    agruparRotulos(linhaArr).map(g =>
      `<div class="pp-chip-bracket" style="grid-column:${g.inicio + 1}/span ${g.fim - g.inicio + 1};grid-row:${linhaIdx + 2};color:${corDoRotulo(g.rotulo, mapaCores)}">${escaparHtml(g.rotulo)}</div>`
    ).join('')
  ).join('');
  return `
    <div class="pp-palavra-select">
      <div class="pp-palavra-select-cabecalho">
        <div class="pp-palavra-select-icone">${iconeTipo('tarefa', '#4A80F0')}</div>
        <p class="pp-palavra-select-instrucao"${estiloTextoInline(pmr, 'instrucao')}>${pmr.instrucao ? renderFraseComDestaque(pmr.instrucao, pmr.instrucaoDestaque, pmr.instrucaoDestaqueNegrito) : escaparHtml('Classifique cada palavra:')}</p>
      </div>
      <div class="pp-frase-anotada">${chips}${colchetes}</div>
    </div>`;
}

/** Prévia da questão "Múltiplos Rótulos" — mostra os botões de papel (rótulos distintos usados na
 * frase) e a frase com os colchetes da resposta CERTA já resolvidos, mais um "Confirmar resposta"
 * só ilustrativo (não dá pra clicar de verdade aqui; a interação de verdade é no player). */
function previewChecagemMultiplosRotulos(item) {
  if (!item.titulo && (!item.sentenca || item.sentenca.length === 0)) return '<p class="pp-vazio">Preencha o exercício para ver a prévia.</p>';
  const mapaCores = new Map();
  const rotulosBrutos = item.rotulos || [];
  const papeis = [];
  rotulosBrutos.forEach(r => listaRotulos(r).forEach(rot => { if (!papeis.includes(rot)) papeis.push(rot); }));
  const botoes = papeis.map(papel => {
    const cor = corDoRotulo(papel, mapaCores);
    return `<span class="pp-modo-btn" style="border-color:${cor};color:${cor}"><span class="pp-modo-dot" style="background:${cor}"></span>${escaparHtml(papel.toUpperCase())}</span>`;
  }).join('');
  const linhaDoRotulo = linhaPorRotulo(item.sentenca.length, rotulosBrutos);
  const chips = item.sentenca.map((tok, i) => {
    const pontuacao = ehPontuacao(tok);
    const rotuloLinha0 = listaRotulos(rotulosBrutos[i]).find(r => linhaDoRotulo.get(r) === 0);
    const estiloCor = rotuloLinha0 ? `;border-color:${corDoRotulo(rotuloLinha0, mapaCores)};background:${corDoRotulo(rotuloLinha0, mapaCores)}1a;color:${corDoRotulo(rotuloLinha0, mapaCores)}` : '';
    return `<span class="pp-chip${pontuacao ? ' pontuacao' : ''}" style="grid-column:${i + 1};grid-row:1${estiloCor}">${escaparHtml(tok)}</span>`;
  }).join('');
  const colchetes = porLinha(item.sentenca.length, rotulosBrutos, linhaDoRotulo).map((linhaArr, linhaIdx) =>
    agruparRotulos(linhaArr).map(g =>
      `<div class="pp-chip-bracket" style="grid-column:${g.inicio + 1}/span ${g.fim - g.inicio + 1};grid-row:${linhaIdx + 2};color:${corDoRotulo(g.rotulo, mapaCores)}">${escaparHtml(g.rotulo)}</div>`
    ).join('')
  ).join('');
  return `
    <p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque, item.tituloDestaqueNegrito)}</p>
    <div class="pp-modo-toggle">${botoes}</div>
    <div class="pp-frase-anotada">${chips}${colchetes}</div>
    <button type="button" class="pp-btn-confirmar" disabled>Confirmar resposta</button>`;
}

/** Corpo puro do exercício de checagem (sem tocar em feedback/toggle) — reaproveitado pelas duas caixas de preview. */
function previewChecagemCorpo(item, resp) {
  if (item.multiplosRotulos) return previewChecagemMultiplosRotulos(item);
  const modo = Array.isArray(item.sentenca) ? 'palavra' : 'multipla';

  if (modo === 'multipla') {
    if (!item.titulo && (item.opcoes || []).every(o => !o)) return '<p class="pp-vazio">Preencha o exercício para ver a prévia.</p>';
    const letras = 'ABCDEFGH';
    const cabecalho = item.invertido
      ? `<p class="pp-subtitulo"${estiloTextoInline(item, 'subtitulo')}>${renderFraseComDestaque(item.subtitulo || '', item.subtituloDestaque, item.subtituloDestaqueNegrito)}</p><p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque, item.tituloDestaqueNegrito)}</p>`
      : `<p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque, item.tituloDestaqueNegrito)}</p>${item.subtitulo ? `<p class="pp-subtitulo"${estiloTextoInline(item, 'subtitulo')}>${renderFraseComDestaque(item.subtitulo, item.subtituloDestaque, item.subtituloDestaqueNegrito)}</p>` : ''}`;
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
      return `<button class="pp-opcao ${cls}"><span class="pp-letra">${letras[i] || i + 1}</span><span${estiloOpcao}>${renderFraseComDestaque(texto, (item.opcoesDestaque || [])[i], (item.opcoesDestaqueNegrito || [])[i])}</span></button>`;
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
  return `<p class="pp-titulo"${estiloTextoInline(item, 'titulo')}>${renderFraseComDestaque(item.titulo || '', item.tituloDestaque, item.tituloDestaqueNegrito)}</p>${item.subtitulo ? `<p class="pp-subtitulo"${estiloTextoInline(item, 'subtitulo')}>${renderFraseComDestaque(item.subtitulo, item.subtituloDestaque, item.subtituloDestaqueNegrito)}</p>` : ''}<div class="pp-sentenca">${chips}</div>`;
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
    ${r.titulo ? `<p class="pp-titulo"${estiloTextoInline(r, 'titulo')}>${renderFraseComDestaque(r.titulo, r.tituloDestaque, r.tituloDestaqueNegrito)}</p>` : ''}
    ${r.itens.map(it => `
      <div class="pp-resumo-item">
        <div class="pp-resumo-icone" style="background:${it.corFundo || '#eef2ff'};color:${it.cor || '#4A80F0'}">${iconeTipo(it.tipo, it.cor || '#4A80F0', it.iconeUrl)}</div>
        <div class="pp-resumo-info">
          <span class="pp-resumo-titulo-item"${estiloTextoInline(it, 'titulo', `color:${it.cor || '#1a1a2e'}`)}>${renderFraseComDestaque(it.titulo, it.tituloDestaque, it.tituloDestaqueNegrito)}</span>
          <span class="pp-resumo-exemplos"${estiloTextoInline(it, 'exemplos')}>${renderFraseComDestaque(it.exemplos, it.exemplosDestaque, it.exemplosDestaqueNegrito)}</span>
        </div>
      </div>`).join('')}`;
}

function previewLista(li) {
  if (!li.itens.length && !li.descricao && !li.textoAntes) return '<p class="pp-vazio">Adicione itens para ver a prévia.</p>';
  return `
    ${li.icone ? `<div class="pp-lista-icone-topo" style="background:${li.icone.corFundo || '#eef2ff'};color:${li.icone.cor || '#4A80F0'}">${iconeTipo(li.icone.tipo, li.icone.cor || '#4A80F0', li.icone.iconeUrl)}</div>` : ''}
    ${li.titulo ? `<p class="pp-titulo"${estiloTextoInline(li, 'titulo')}>${renderFraseComDestaque(li.titulo, li.tituloDestaque, li.tituloDestaqueNegrito)}</p>` : ''}
    ${li.textoAntes ? `<p class="pp-lista-descricao"${estiloTextoInline(li, 'textoAntes')}>${renderFraseComDestaque(li.textoAntes, li.textoAntesDestaque, li.textoAntesDestaqueNegrito)}</p>` : ''}
    ${li.itens.map(it => `
      <div class="pp-resumo-item">
        <div class="pp-resumo-icone" style="background:${it.corFundo || '#eef2ff'};color:${it.cor || '#4A80F0'}">${iconeTipo(it.tipo, it.cor || '#4A80F0', it.iconeUrl)}</div>
        <span class="pp-lista-item-texto"${estiloTextoInline(it, 'texto')}>${renderFraseComDestaque(it.texto, it.textoDestaque, it.textoDestaqueNegrito)}</span>
      </div>`).join('')}
    ${li.descricao ? `<p class="pp-lista-descricao"${estiloTextoInline(li, 'descricao')}>${renderFraseComDestaque(li.descricao, li.descricaoDestaque, li.descricaoDestaqueNegrito)}</p>` : ''}`;
}

/** Prévia da timeline — só mostra o card de detalhes do 1º período (a prévia
 * do Construtor é uma foto estática, não clicável; a interatividade de
 * verdade — clicar num ponto pra trocar o card — é só no player exportado). */
function previewTimeline(tl) {
  if (!tl.eventos.length) return '<p class="pp-vazio">Adicione períodos para ver a prévia.</p>';
  const pontos = tl.eventos.map((ev, i) => `
    <div class="pp-tl-ponto${i === 0 ? ' ativo' : ''}" style="--tl-cor:${ev.cor || '#5B2BCB'}">
      <span class="pp-tl-ano">${escaparHtml(ev.ano || '')}</span>
      <span class="pp-tl-dot"></span>
      <span class="pp-tl-rotulo">${escaparHtml(ev.titulo || '')}</span>
    </div>`).join('');
  return `
    ${tl.titulo ? `<p class="pp-titulo"${estiloTextoInline(tl, 'titulo')}>${renderFraseComDestaque(tl.titulo, tl.tituloDestaque, tl.tituloDestaqueNegrito)}</p>` : ''}
    ${tl.instrucao ? `<p class="pp-intro-desc"${estiloTextoInline(tl, 'instrucao')}>${renderFraseComDestaque(tl.instrucao, tl.instrucaoDestaque, tl.instrucaoDestaqueNegrito)}</p>` : ''}
    <div class="pp-tl-trilha">${pontos}</div>
    ${previewTimelineDetalhe(tl.eventos[0])}`;
}

function previewTimelineDetalhe(ev) {
  const caracteristicas = (ev.caracteristicas || '').split('\n').map(s => s.trim()).filter(Boolean);
  return `
    <div class="pp-tl-detalhe" style="--tl-cor:${ev.cor || '#5B2BCB'}">
      <div class="pp-tl-detalhe-icone"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
      <p class="pp-tl-detalhe-titulo"${estiloTextoInline(ev, 'titulo')}>${renderFraseComDestaque(ev.titulo || '', ev.tituloDestaque, ev.tituloDestaqueNegrito)}</p>
      ${ev.ano ? `<p class="pp-tl-detalhe-ano">${escaparHtml(ev.ano)}</p>` : ''}
      ${ev.descricao ? `<p class="pp-tl-detalhe-desc"${estiloTextoInline(ev, 'descricao')}>${renderFraseComDestaque(ev.descricao, ev.descricaoDestaque, ev.descricaoDestaqueNegrito)}</p>` : ''}
      ${caracteristicas.length ? `
      <div class="pp-tl-carac">
        <p class="pp-tl-carac-titulo">Principais características</p>
        ${caracteristicas.map(c => `
        <div class="pp-tl-carac-item">
          <span class="pp-tl-carac-check">✓</span>
          <span>${escaparHtml(c)}</span>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
}

function previewLicao(l) {
  if (!l.html && !l.titulo) return '<p class="pp-vazio">Preencha para ver a prévia.</p>';
  return `<p class="pp-titulo"${estiloTextoInline(l, 'titulo')}>📖 ${renderFraseComDestaque(l.titulo, l.tituloDestaque, l.tituloDestaqueNegrito)}</p><div class="pp-licao-corpo">${l.html}</div>`;
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
