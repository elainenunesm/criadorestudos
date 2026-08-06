'use strict';

/**
 * SW.JS — Service worker do Construtor de Aulas (PWA). Estratégia
 * network-first: sempre busca a versão mais nova na rede primeiro (importante
 * porque o app muda com frequência) e só cai pro cache quando estiver
 * offline. O cache existe pra permitir abrir sem internet, não pra acelerar
 * quando já tem rede. Sobe a versão do cache (CACHE) quando mudar essa
 * lista, só pra forçar uma limpeza do cache antigo.
 */
const CACHE = 'construtor-aulas-v3';
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
  // {cache:'reload'} ignora o cache HTTP do navegador — sem isso, um deploy
  // recente podia ser "pré-cacheado" com bytes antigos que o navegador ainda
  // tinha guardados, e a atualização nunca aparecia de verdade.
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS.map(url => new Request(url, { cache: 'reload' }))))
  );
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
    fetch(event.request)
      .then(resposta => {
        const copia = resposta.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
