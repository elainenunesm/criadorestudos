'use strict';

/**
 * SW.JS — Service worker do Construtor de Aulas (PWA). Cache-first pro app
 * shell, pra abrir instalado/offline. Sobe a versão do cache quando algum
 * arquivo listado abaixo mudar, senão o navegador continua servindo a
 * versão antiga do cache.
 */
const CACHE = 'construtor-aulas-v2';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/conteudo.css',
  './js/data.js',
  './js/zip.js',
  './js/vendor-embutido.js',
  './js/export.js',
  './js/conteudo.js',
  './js/config.js',
  './js/script.js',
  './js/pwa.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(resposta => {
          const copia = resposta.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copia));
          return resposta;
        })
        .catch(() => (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
