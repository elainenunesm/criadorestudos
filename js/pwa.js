'use strict';

/**
 * PWA.JS — Mostra uma faixa convidando a instalar o Construtor assim que o
 * navegador avisa que dá pra instalar (evento beforeinstallprompt, só
 * dispara em Chrome/Edge com manifest + service worker OK, servido por
 * https). Se o app já estiver instalado (rodando em modo standalone) ou o
 * navegador não suportar instalação (ex: Safari), a faixa nem aparece.
 */
const PWA_DISPENSADO_KEY = 'construtorPwaDispensado';

function estaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function inicializarPwaBanner() {
  const banner = document.getElementById('pwaBanner');
  if (!banner || estaInstalado()) return;

  let promptEvento = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvento = event;
    if (localStorage.getItem(PWA_DISPENSADO_KEY) === '1') return;
    banner.hidden = false;
  });

  document.getElementById('pwaBannerInstalar').addEventListener('click', async () => {
    if (!promptEvento) return;
    banner.hidden = true;
    promptEvento.prompt();
    await promptEvento.userChoice;
    promptEvento = null;
  });

  document.getElementById('pwaBannerFechar').addEventListener('click', () => {
    banner.hidden = true;
    localStorage.setItem(PWA_DISPENSADO_KEY, '1');
  });

  window.addEventListener('appinstalled', () => {
    banner.hidden = true;
    localStorage.removeItem(PWA_DISPENSADO_KEY);
  });
}

inicializarPwaBanner();
