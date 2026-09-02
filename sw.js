/* CESTA — service worker: app shell offline-first.

   O app tem de abrir dentro do mercado, onde o 4G é ruim ou não existe. Isso não
   é um extra: é a vantagem competitiva inteira (ver docs/PROMPT-INICIAL.md,
   seção 2). Nenhuma tela pode esperar rede.

   A VERSAO ANDA JUNTO COM AS TAGS ?v= DO index.html, sempre, a cada entrega.
   Subir uma e esquecer a outra entrega o app novo com o CSS velho em cache — e
   isso aparece como defeito onde não há nenhum. */
'use strict';

const VERSAO = '2';
const CACHE = 'cesta-' + VERSAO;
const SHELL = [
  './',
  'index.html',
  'css/styles.css?v=' + VERSAO,
  'js/config.js?v=' + VERSAO,
  'js/icons.js?v=' + VERSAO,
  'js/ui.js?v=' + VERSAO,
  'js/db.js?v=' + VERSAO,
  'js/precos.js?v=' + VERSAO,
  'js/nfce.js?v=' + VERSAO,
  'js/importar.js?v=' + VERSAO,
  'js/fotos.js?v=' + VERSAO,
  'js/leitura.js?v=' + VERSAO,
  'js/sync.js?v=' + VERSAO,
  'js/views/lista.js?v=' + VERSAO,
  'js/views/mercado.js?v=' + VERSAO,
  'js/views/ferramentas.js?v=' + VERSAO,
  'js/views/historico.js?v=' + VERSAO,
  'js/views/importar.js?v=' + VERSAO,
  'js/views/ajustes.js?v=' + VERSAO,
  'js/views/sync.js?v=' + VERSAO,
  'js/views/camera.js?v=' + VERSAO,
  'js/app.js?v=' + VERSAO,
  'manifest.webmanifest',
  'icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Navegação: responde o shell do cache primeiro. Esperar a rede aqui é a
     tela branca de dois segundos na entrada do mercado. */
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }

  /* Fontes do Google: cache-first com gravação, porque elas não mudam e a
     segunda abertura não deve depender de rede para desenhar o texto certo. */
  if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return resp;
      }).catch(() => r))
    );
    return;
  }

  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
