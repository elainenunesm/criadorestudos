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
    // {tipo, id} (exemplo/checagem, um por item, referenciado pelo _id abaixo).
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
  };
}

const CICLOS = [
  {
    id: 1,
    titulo: 'Ciclo 1 – Base Jurídica',
    materias: [
      {
        id: 1,
        titulo: 'Português',
        aulas: [
          { id: 1, titulo: 'Aula 1 – Verbos', conteudo: novoConteudo() },
          { id: 2, titulo: 'Aula 2 – Sujeito', conteudo: novoConteudo() },
          { id: 3, titulo: 'Aula 3 – Predicado', conteudo: novoConteudo() },
        ],
      },
      {
        id: 2,
        titulo: 'Direito Administrativo',
        aulas: [
          { id: 4, titulo: 'Aula 1 – Conceitos', conteudo: novoConteudo() },
          { id: 5, titulo: 'Aula 2 – Princípios', conteudo: novoConteudo() },
          { id: 6, titulo: 'Aula 3 – Atos administrativos', conteudo: novoConteudo() },
        ],
      },
    ],
  },
  { id: 2, titulo: 'Ciclo 2 – Específica', materias: [] },
  { id: 3, titulo: 'Ciclo 3 – Avançada', materias: [] },
];

/** Tipos de ícone reconhecidos pelo player (estudos/js/estudo.js:RESUMO_ICONES). */
const TIPOS_ICONE = [
  'acao', 'estado', 'mudanca', 'fenomeno', 'infinito', 'conjugar', 'gota',
  'peca', 'foguete', 'sujeito', 'fala', 'busca', 'tarefa', 'pergunta',
  'dica', 'predVerbal', 'predNominal', 'predVerboNominal', 'semSujeito',
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
