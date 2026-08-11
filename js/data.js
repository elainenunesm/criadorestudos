'use strict';

/**
 * Modelo de dados da árvore de ciclos — espelha o que é renderizado no HTML.
 * Os ids são fixos (não recalculados no export) porque tanto o editor de
 * conteúdo (js/conteudo.js) quanto o export (js/export.js) precisam
 * concordar sobre qual arquivo aula-N.js pertence a qual aula.
 *
 * Cada aula carrega um "conteudo" no mesmo formato de window.AULA_DATA do
 * projeto estudos (ver estudos/js/data/questoes/aula-*.js) — é o que vira
 * o arquivo exportado.
 */

function novoConteudo() {
  return {
    // Ordem em que as telas aparecem pra aluna — livre, editável em "Estrutura
    // das telas". Cada item é {tipo} (antesComecar/resumo/licao, únicos) ou
    // {tipo, id} (exemplo/checagem/lista, um por item, referenciado pelo _id abaixo).
    ordem: [{ tipo: 'antesComecar' }, { tipo: 'resumo' }, { tipo: 'licao' }],
    antesComecar: {
      titulo: '',
      descricao: '',
      aprender: '',
      importancia: '',
    },
    exemplo: [],
    checagem: [],
    resumo: {
      titulo: '',
      itens: [],
    },
    licao: {
      titulo: '',
      html: '',
    },
    // "Lista" (título + lista de ícones/textos + descrição) é repetível, igual exemplo/checagem —
    // não nasce com a aula, a professora adiciona pelo "Tipo (Telas)" quantas vezes quiser.
    lista: [],
  };
}

/** Hierarquia da tela (Construtor): Ciclo > Etapa > Matéria > Aula.
 *
 * IMPORTANTE pra quem for mexer aqui depois: os nomes internos NÃO acompanham os rótulos
 * novos da tela — só o texto visível pra usuária mudou, os nomes de variável/função ficaram
 * como estavam antes, pra não precisar reescrever a busca de aula por id, o seletor "Editando
 * a aula", a exportação inteira e o salvamento em pasta/Git, que já tratam CICLOS como uma
 * lista plana. Ou seja:
 *   GRUPOS         = nível "Ciclo" na tela (novo, o mais de fora)
 *   CICLOS         = nível "Etapa" na tela (cada item ganhou um `grupoId`, apontando pro Ciclo/GRUPOS pai)
 *   ciclo.materias = nível "Matéria" na tela (nome já bate, sem mudança)
 * O app exportado (vendor/estudo) e js/export.js não sabem nada de GRUPOS/grupoId — pra eles
 * nada mudou (Nível = uma "Etapa"/CICLOS de hoje, exatamente como sempre foi). */
const GRUPOS = [];

const CICLOS = [];

/** Trilhas — caminhos opcionais compostos por um subconjunto dos ciclos (ex: "Auditor Fiscal",
 * "Tribunais"), além da sequência básica (os ciclos que não pertencem a nenhuma trilha). No
 * player exportado, a aluna só pode escolher uma trilha depois de concluir todos os ciclos
 * básicos — e pode escolher mais de uma ao mesmo tempo. Ver js/script.js (abrirModalTrilhas). */
const TRILHAS = [];

/** Tipos de ícone reconhecidos pelo player (estudos/js/estudo.js:RESUMO_ICONES). */
const TIPOS_ICONE = [
  'acao', 'estado', 'mudanca', 'fenomeno', 'infinito', 'conjugar', 'gota',
  'peca', 'foguete', 'sujeito', 'fala', 'busca', 'tarefa', 'pergunta',
  'dica', 'predVerbal', 'predNominal', 'predVerboNominal', 'semSujeito', 'livro',
  'certo', 'errado',
];

/** Localiza {ciclo, materia, aula} por ids. */
function buscarAula(cicloId, materiaId, aulaId) {
  const ciclo = CICLOS.find(c => c.id === cicloId);
  if (!ciclo) return null;
  const materia = ciclo.materias.find(m => m.id === materiaId);
  if (!materia) return null;
  const aula = materia.aulas.find(a => a.id === aulaId);
  if (!aula) return null;
  return { ciclo, materia, aula };
}

/** Lista achatada de todas as aulas, cada uma com o caminho (ciclo/matéria) junto. */
function listarTodasAulas() {
  const lista = [];
  CICLOS.forEach(ciclo => {
    ciclo.materias.forEach(materia => {
      materia.aulas.forEach(aula => {
        lista.push({ cicloId: ciclo.id, materiaId: materia.id, aulaId: aula.id, ciclo, materia, aula });
      });
    });
  });
  return lista;
}

/** Migração pra quando o Ciclo (GRUPOS) ainda não existia: se sobrar alguma Etapa (CICLOS) sem
 * `grupoId` válido — arquivo salvo antes desse nível existir, ou GRUPOS vazio mesmo com Etapas —
 * cria um Ciclo "Ciclo 1" e agrupa todas ali dentro, sem perder nada. Chamada ao carregar dados
 * de uma pasta conectada (js/pasta.js). */
function garantirGrupoPadrao() {
  const idsValidos = new Set(GRUPOS.map(g => g.id));
  const orfaos = CICLOS.filter(c => !idsValidos.has(c.grupoId));
  if (!orfaos.length) return;
  const grupo = { id: Math.max(0, ...GRUPOS.map(g => g.id)) + 1, titulo: 'Ciclo 1' };
  GRUPOS.push(grupo);
  orfaos.forEach(c => { c.grupoId = grupo.id; });
}

/* ---------------------------------------------------------------------- */
/* Autosave — só existe se tiver uma pasta conectada (ver js/pasta.js) e/ou  */
/* um repositório Git configurado (ver js/git.js). Sem nenhum dos dois,    */
/* nada é salvo nem recarregado: a tela sempre começa vazia. Toda          */
/* criação/edição/exclusão/reordenação chama isso.                         */
/* ---------------------------------------------------------------------- */
let _autosaveTimeout = null;

function salvarAutomaticamente() {
  clearTimeout(_autosaveTimeout);
  _autosaveTimeout = setTimeout(() => {
    if (typeof escreverJsonNaPastaConectada === 'function') escreverJsonNaPastaConectada();
    if (typeof agendarSincronizacaoGit === 'function') agendarSincronizacaoGit();
  }, 400);
}
