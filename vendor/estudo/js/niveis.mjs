'use strict';

/**
 * NIVEIS.MJS — Aba "Estudos": visão geral por nível/ciclo, igual ao estudos
 * original. Cada ciclo criado no Construtor de Aulas vira uma NIVEIS entry
 * (js/data/modulos.mjs) — todas elas aparecem aqui dentro de um card único
 * "Nível 1 — Fundamentos" (mesma estrutura do app original, onde só existe
 * um nível "de verdade" e os demais são ciclos cumulativos dele). O status
 * "CONCLUÍDA" é calculado direto da % de aulas completas do ciclo — a
 * insígnia (aba "Desempenho", ver renderDesempenho()) é só a representação
 * visual disso, não um estado salvo à parte.
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

// Qual trilha escolhida está sendo mostrada nas abas (ver renderTrilhasEscolhidas) — só estado de
// tela, não é salvo; some/reresolve sozinho se a trilha ativa deixar de estar escolhida.
let trilhaTabAtiva = null;

async function renderNiveis() {
  const wrap = document.getElementById('niveisLista');
  if (!wrap) return;
  const niveis = NIVEIS || [];
  const trilhas = TRILHAS || [];
  const idsEmTrilha = new Set(trilhas.flatMap(t => t.ciclos));
  // Só os ciclos que NÃO pertencem a nenhuma trilha entram no card "Nível 1 — Fundamentos" — os
  // de trilha aparecem embaixo da trilha escolhida (ver renderTrilhasEscolhidas), não aqui.
  const niveisBase = niveis.filter(n => !idsEmTrilha.has(n.id));

  let nivelCardHtml = '';
  if (niveisBase.length > 0) {
    const ganhaTudo = niveisBase.every(nivelConcluido);
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
          ${niveisBase.map(renderCicloSecao).join('')}
        </div>
      </div>`;
  }

  let trilhaHtml = '';
  let trilhasEscolhidasHtml = '';

  if (trilhas.length > 0) {
    const desbloqueado = typeof baseConcluida === 'function' && baseConcluida();
    if (!desbloqueado) {
      trilhaHtml = `
        <div class="trilha-section trilha-bloqueada">
          <div class="trilha-bloqueada-cabecalho">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONE_CADEADO_NIVEIS}</svg>
            <h3 class="trilha-titulo">Escolha sua trilha</h3>
          </div>
          <p class="trilha-desc">Conclua a trilha básica (Nível 1) para escolher o concurso que você está estudando.</p>
        </div>`;
    } else {
      const trilhasEscolhidas = await getTrilhasEscolhidas();
      trilhaHtml = `
        <div class="trilha-section">
          <h3 class="trilha-titulo">Escolha sua trilha</h3>
          <p class="trilha-desc">Pode escolher mais de uma ao mesmo tempo — cada uma progride separada.</p>
          <div class="trilha-grid">
            ${trilhas.map(t => `
              <div class="trilha-card${trilhasEscolhidas.includes(t.id) ? ' selecionada' : ''}" data-trilha-id="${t.id}">
                <div class="trilha-icone">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6"/><path d="M18 6a9 9 0 0 1-9 9"/><circle cx="18" cy="6" r="3"/></svg>
                </div>
                <span class="trilha-nome">${escaparHtml(t.titulo)}</span>
                <span class="trilha-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
              </div>`).join('')}
          </div>
        </div>`;

      // Ciclos das trilhas escolhidas ficam AQUI embaixo, fora do card "Nível 1" — uma trilha só
      // mostra a lista direto; duas ou mais viram abas (uma por trilha) pra escolher qual ver.
      const escolhidasObjs = trilhas.filter(t => trilhasEscolhidas.includes(t.id));
      if (escolhidasObjs.length > 0) {
        if (!escolhidasObjs.some(t => t.id === trilhaTabAtiva)) trilhaTabAtiva = escolhidasObjs[0].id;
        const trilhaAtiva = escolhidasObjs.find(t => t.id === trilhaTabAtiva);
        const niveisDaTrilha = niveis.filter(n => trilhaAtiva.ciclos.includes(n.id));

        trilhasEscolhidasHtml = `
          <div class="nivel-card-unico">
            ${escolhidasObjs.length > 1 ? `
            <div class="cadernos-tabs trilha-tabs">
              ${escolhidasObjs.map(t => `<button type="button" class="caderno-tab${t.id === trilhaTabAtiva ? ' active' : ''}" data-trilha-tab="${t.id}">${escaparHtml(t.titulo)}</button>`).join('')}
            </div>` : `<h3 class="sprint-titulo trilha-tab-titulo-unica">${escaparHtml(trilhaAtiva.titulo)}</h3>`}
            <div class="nivel-card-unico-corpo">
              ${niveisDaTrilha.map(renderCicloSecao).join('')}
            </div>
          </div>`;
      }
    }
  }

  wrap.innerHTML = `<div class="sprint-lista">${nivelCardHtml}</div>${trilhaHtml}${trilhasEscolhidasHtml}`;

  wrap.querySelectorAll('.ciclo-secao:not(.bloqueada)').forEach(secao => {
    secao.addEventListener('click', () => irParaNivel(parseInt(secao.dataset.nivelId, 10)));
  });

  wrap.querySelectorAll('.nivel-card-unico-cabecalho').forEach(cabecalho => {
    cabecalho.addEventListener('click', () => {
      cabecalho.classList.toggle('collapsed');
      cabecalho.nextElementSibling?.classList.toggle('collapsed');
    });
  });

  wrap.querySelectorAll('.trilha-tabs [data-trilha-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      trilhaTabAtiva = parseInt(tab.dataset.trilhaTab, 10);
      renderNiveis();
    });
  });

  wrap.querySelectorAll('.trilha-card').forEach(card => {
    card.addEventListener('click', async () => {
      const trilhaId = parseInt(card.dataset.trilhaId, 10);
      const { escolhendo, salvou } = await alternarTrilhaEscolhida(trilhaId);
      if (!salvou) { showToast('⚠️ Não foi possível salvar — reconecte a pasta e tente de novo.', 'warning'); return; }
      if (escolhendo) trilhaTabAtiva = trilhaId;
      const trilha = trilhas.find(t => t.id === trilhaId);
      showToast(escolhendo ? `🎯 Trilha "${trilha?.titulo}" escolhida!` : `Trilha "${trilha?.titulo}" removida`, 'success');
      // A trilha escolhida libera a primeira aula dela lá no Início — recarrega o progresso
      // e a lista de níveis (mostra os ciclos dela embaixo da escolha).
      await carregarProgresso();
      renderAulas();
      renderNiveis();
    });
  });
}

/** Estrela usada quando o ciclo não tem um ícone de insígnia próprio (nem link externo, nem
 * arquivo importado no Construtor de Aulas). */
function iconeInsigniaPadrao() {
  return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
}

/** Aba "Desempenho" — uma insígnia por ciclo (NIVEIS), com o ícone escolhido no Construtor de
 * Aulas (ou a estrela padrão). Conquistada quando todas as aulas do ciclo estão concluídas. */
function renderDesempenho() {
  const wrap = document.getElementById('viewDesempenho');
  if (!wrap) return;
  const niveis = NIVEIS || [];
  if (!niveis.length) {
    wrap.innerHTML = `<h2>Desempenho</h2><p>Nenhuma insígnia disponível ainda.</p>`;
    return;
  }
  wrap.innerHTML = `
    <div class="erros-header">
      <h2>Desempenho</h2>
      <p>Conclua todas as aulas de um ciclo para ganhar a insígnia dele.</p>
    </div>
    <div class="insignias-grid">
      ${niveis.map(nivel => {
        const conquistada = nivelConcluido(nivel);
        const desbloqueada = nivelDesbloqueado(nivel);
        const icone = nivel.insigniaUrl
          ? `<img src="${nivel.insigniaUrl}" alt="" class="insignia-card-img">`
          : iconeInsigniaPadrao();
        const statusTexto = conquistada ? 'Conquistada' : (desbloqueada ? 'Em andamento' : 'Bloqueada');
        const classeStatus = conquistada ? 'conquistada' : (desbloqueada ? '' : 'bloqueada');
        return `
          <div class="insignia-card ${classeStatus}" data-insignia-id="${nivel.id}">
            <div class="insignia-card-icone">${icone}</div>
            <p class="insignia-card-titulo">${escaparHtml(nivel.titulo)}</p>
            <p class="insignia-card-status">${statusTexto}</p>
          </div>`;
      }).join('')}
    </div>`;
}

/** Toca um pequeno arpejo de conquista (dó-mi-sol-dó) via Web Audio, sem depender de nenhum
 * arquivo de áudio externo — mesma ideia do estudos/js/script.js original. Se o navegador
 * bloquear autoplay (sem gesto do usuário ainda) ou não suportar, falha em silêncio; o resto da
 * celebração (troca de tela + animação) continua normalmente. */
function tocarSomConquista() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.25, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.4);
    });
  } catch (e) {
    // Web Audio indisponível/bloqueado — segue sem som.
  }
}

/** Leva a aluna até o Desempenho, destaca a insígnia recém-conquistada com uma animação e toca
 * o som — chamada só quando é uma conquista NOVA de verdade (ver verificarInsignias). */
function celebrarInsignia(nivel) {
  const navItem = document.querySelector('.nav-item[data-view="desempenho"]');
  if (navItem) navItem.click();
  tocarSomConquista();
  setTimeout(() => {
    const card = document.querySelector(`.insignia-card[data-insignia-id="${nivel.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('nova');
      setTimeout(() => card.classList.remove('nova'), 3600);
    }
    showToast(`🏅 Nova insígnia: ${nivel.titulo}!`, 'success', 4500);
  }, 80);
}

/** Confere se algum ciclo foi concluído agora (todas as aulas dele "completed") e ainda não tem
 * insígnia registrada — se sim, grava a conquista (progresso.mjs) e dispara a celebração. Chamada
 * depois de qualquer atualização real do progresso (voltar de uma aula, reconectar a pasta), pra
 * pegar tanto quem acabou de terminar quanto quem já tinha terminado tudo antes dessa
 * funcionalidade existir — nesse segundo caso a conquista é registrada mas SEM celebração, pra
 * não "comemorar" algo antigo do nada. O id da insígnia é o próprio id do ciclo (nível). */
async function verificarInsignias() {
  const jaConquistadas = await getInsignias();
  const novas = [];
  for (const nivel of (NIVEIS || [])) {
    if (jaConquistadas.includes(nivel.id)) continue;
    if (!nivelConcluido(nivel)) continue;
    const { nova } = await conquistarInsignia(nivel.id);
    if (nova) novas.push(nivel);
  }
  // Espera a navegação/rolagem normal de "voltar da aula" assentar antes de trocar pra tela de
  // Desempenho — senão as duas animações brigam.
  if (novas.length > 0) setTimeout(() => celebrarInsignia(novas[0]), 900);
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
