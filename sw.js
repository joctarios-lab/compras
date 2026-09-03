/* CESTA — service worker: app shell offline-first.

   O app tem de abrir dentro do mercado, onde o 4G é ruim ou não existe. Isso não
   é um extra: é a vantagem competitiva inteira (ver docs/PROMPT-INICIAL.md,
   seção 2). Nenhuma tela pode esperar rede.

   A VERSAO ANDA JUNTO COM AS TAGS ?v= DO index.html, sempre, a cada entrega.
   Subir uma e esquecer a outra entrega o app novo com o CSS velho em cache — e
   isso aparece como defeito onde não há nenhum. */
'use strict';

const VERSAO = '6';
const CACHE = 'cesta-' + VERSAO;
const SHELL = [
  './',
  'index.html',
  'css/domi.css?v=' + VERSAO,
  'css/cesta.css?v=' + VERSAO,
  'js/config.js?v=' + VERSAO,
  'js/icons.js?v=' + VERSAO,
  'js/ui.js?v=' + VERSAO,
  'js/catalogo.js?v=' + VERSAO,
  'js/db.js?v=' + VERSAO,
  'js/precos.js?v=' + VERSAO,
  'js/despensa.js?v=' + VERSAO,
  'js/decisoes.js?v=' + VERSAO,
  'js/cozinha.js?v=' + VERSAO,
  'js/nfce.js?v=' + VERSAO,
  'js/importar.js?v=' + VERSAO,
  'js/fotos.js?v=' + VERSAO,
  'js/leitura.js?v=' + VERSAO,
  'js/auth.js?v=' + VERSAO,
  'js/bloqueio.js?v=' + VERSAO,
  'js/sync.js?v=' + VERSAO,
  'js/onboarding.js?v=' + VERSAO,
  'js/views/historico.js?v=' + VERSAO,
  'js/views/produtos.js?v=' + VERSAO,
  'js/planejar.js?v=' + VERSAO,
  'js/views/hoje.js?v=' + VERSAO,
  'js/views/planejar.js?v=' + VERSAO,
  'js/views/despensa.js?v=' + VERSAO,
  'js/views/analise.js?v=' + VERSAO,
  'js/views/dialogos.js?v=' + VERSAO,
  'js/views/lista.js?v=' + VERSAO,
  'js/views/mercado.js?v=' + VERSAO,
  'js/views/ferramentas.js?v=' + VERSAO,
  'js/views/importar.js?v=' + VERSAO,
  'js/views/ajustes.js?v=' + VERSAO,
  'js/views/sync.js?v=' + VERSAO,
  'js/views/familia.js?v=' + VERSAO,
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

  /* NAVEGAÇÃO: a rede tem 2 segundos para responder; depois disso o cache
     assume. É o único lugar do app onde se espera por rede, e o prazo é curto
     de propósito.

     Cache-first aqui prendia o app numa versão antiga: o navegador só confere o
     sw.js quando ele mesmo decide, e até lá a correção não chega a ninguém —
     foi o que aconteceu com quem apagou os dados e continuou vendo o app velho.

     No mercado nada muda: sem rede, o fetch falha na hora; com 4G ruim, o prazo
     estoura e o cache responde. O documento é UM arquivo — os outros 34
     continuam cache-first, que é onde a velocidade realmente mora. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const daRede = await Promise.race([
          fetch(req),
          new Promise((_, falha) => setTimeout(() => falha(new Error('lento')), 2000)),
        ]);
        if (daRede && daRede.ok) {
          const copia = daRede.clone();
          caches.open(CACHE).then(c => c.put('index.html', copia)).catch(() => {});
          return daRede;
        }
      } catch (_) { /* sem rede, ou rede lenta demais: o cache resolve */ }
      return (await caches.match('index.html')) || fetch(req);
    })());
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
