'use strict';

/**
 * NIVEIS.MJS — Aba "Estudos": visão geral por nível/ciclo, igual ao estudos
 * original. Cada ciclo criado no Construtor de Aulas vira uma NIVEIS entry
 * (js/data/modulos.mjs) — todas elas aparecem aqui dentro de um card único
 * "Nível 1 — Fundamentos" (mesma estrutura do app original, onde só existe
 * um nível "de verdade" e os demais são ciclos cumulativos dele).
 * Não há sistema de insígnias aqui (fora de escopo) — o status "CONCLUÍDA"
 * é calculado direto da % de aulas completas, não de insígnia conquistada.
 */

const ICONE_CADEADO_NIVEIS = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';

function nivelDesbloqueado(nivel) {
  const ids = aulaIdsDoNivel(nivel);
  if (ids.length === 0) return false;
  const primeira = state.aulas.find(a => a.id === ids[0]);
  return !!primeira && primeira.status !== 'locked';
}

function aulaIdsDoNivel(nivel) {
  return (MODULOS || []).filter(m => nivel.etapas.includes(m.id)).flatMap(m => m.aulas.map(a => a.id));
}

function chipsDeEtapas(nivel) {
  const etapas = (MODULOS || []).filter(m => nivel.etapas.includes(m.id));
  const materias = [...new Set(etapas.map(e => e.materia).filter(Boolean))];
  return materias.map(m => `<span class="sprint-materia-tag">${escaparHtml(m)}</span>`).join('');
}

function nivelConcluido(nivel) {
  const ids = aulaIdsDoNivel(nivel);
  if (ids.length === 0) return false;
  return ids.every(id => {
    const a = state.aulas.find(x => x.id === id);
    return a && a.status === 'completed';
  });
}

function renderCicloSecao(nivel) {
  if (!nivelDesbloqueado(nivel)) {
    return `
      <div class="ciclo-secao bloqueada">
        <span class="ciclo-secao-label bloqueada">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONE_CADEADO_NIVEIS}</svg>
          Ciclo ${nivel.id} — Bloqueado
        </span>
      </div>`;
  }

  const ids = aulaIdsDoNivel(nivel);
  const concluidas = ids.filter(id => {
    const a = state.aulas.find(x => x.id === id);
    return a && a.status === 'completed';
  }).length;
  const total = ids.length;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const concluida = nivelConcluido(nivel);
  const statusClasse = concluida ? 'concluida' : 'andamento';
  const statusTexto = concluida ? 'CONCLUÍDA' : 'EM ANDAMENTO';

  return `
    <div class="ciclo-secao" data-nivel-id="${nivel.id}">
      <div class="ciclo-secao-cabecalho">
        <span class="ciclo-secao-label">Ciclo ${nivel.id}</span>
        <span class="sprint-status ${statusClasse}">${statusTexto}</span>
      </div>
      <div class="sprint-etapas">${chipsDeEtapas(nivel)}</div>
      <div class="sprint-progress-row">
        <span class="sprint-progress-pct ${statusClasse}">${pct}%</span>
        <div class="sprint-progress-bar"><div class="sprint-progress-bar-fill" style="width:${pct}%"></div></div>
      </div>
    </div>`;
}

function renderNiveis() {
  const wrap = document.getElementById('niveisLista');
  if (!wrap) return;
  const niveis = NIVEIS || [];
  const nivelPrincipal = niveis[0];

  let nivelCardHtml = '';
  if (nivelPrincipal) {
    const ganhaTudo = niveis.length > 0 && niveis.every(nivelConcluido);
    const statusClasse = ganhaTudo ? 'concluida' : 'andamento';

    nivelCardHtml = `
      <div class="nivel-card-unico">
        <div class="nivel-card-unico-cabecalho">
          <div class="sprint-card-numero ${statusClasse}">
            ${ganhaTudo
              ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
              : '01'}
          </div>
          <h3 class="sprint-titulo">Nível 1 — Fundamentos</h3>
          <svg class="nivel-card-unico-seta" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="nivel-card-unico-corpo">
          ${niveis.map(renderCicloSecao).join('')}
        </div>
      </div>`;
  }

  const trilhaHtml = `
    <div class="trilha-section trilha-bloqueada">
      <div class="trilha-bloqueada-cabecalho">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONE_CADEADO_NIVEIS}</svg>
        <h3 class="trilha-titulo">Escolha sua trilha</h3>
      </div>
      <p class="trilha-desc">Conclua a trilha básica (Nível 1) para escolher o concurso que você está estudando.</p>
    </div>`;

  wrap.innerHTML = `<div class="sprint-lista">${nivelCardHtml}</div>${trilhaHtml}`;

  wrap.querySelectorAll('.ciclo-secao:not(.bloqueada)').forEach(secao => {
    secao.addEventListener('click', () => irParaNivel(parseInt(secao.dataset.nivelId, 10)));
  });

  wrap.querySelectorAll('.nivel-card-unico-cabecalho').forEach(cabecalho => {
    cabecalho.addEventListener('click', () => {
      cabecalho.classList.toggle('collapsed');
      cabecalho.nextElementSibling?.classList.toggle('collapsed');
    });
  });
}

function irParaNivel(nivelId) {
  const nivel = (NIVEIS || []).find(n => n.id === nivelId);
  if (!nivel) return;

  const paginas = { inicio: 'viewInicio', erros: 'viewErros', desempenho: 'viewDesempenho', niveis: 'viewNiveis' };
  Object.entries(paginas).forEach(([nome, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = nome === 'inicio' ? '' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'inicio'));

  setTimeout(() => {
    const idsDoNivel = aulaIdsDoNivel(nivel);
    const aulaAtiva = state.aulas.find(a => idsDoNivel.includes(a.id) && a.status === 'active');
    let el = null;
    if (aulaAtiva) {
      el = document.querySelector(`[data-aula="${aulaAtiva.id}"]`);
      const etapaView = el?.closest('.etapa-view');
      if (etapaView?._setColapsado) etapaView._setColapsado(false);
    } else {
      const etapaView = document.querySelector(`.etapa-view[data-etapa="${nivel.etapas[0]}"]`);
      if (etapaView?._setColapsado) etapaView._setColapsado(false);
      el = etapaView;
    }
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}
