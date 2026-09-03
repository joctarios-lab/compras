/* CESTA — ícones SVG inline.

   Inline, e não de CDN: o app precisa desenhar igual dentro do mercado, sem
   rede. Uma fonte de ícone que não carrega deixa quadrados vazios na barra de
   navegação — e a pessoa não descobre onde tocar. */
'use strict';

const ICONES = {
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  carrinho: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  historico: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3.5 3L21 7"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  tema: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  ok: '<path d="M20 6L9 17l-5-5"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  voltar: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  etiqueta: '<path d="M20.6 13.4L11 3.8A2 2 0 0 0 9.6 3H4a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.8 2.8 0 0 1 5.5.9c0 1.9-2.8 2.8-2.8 2.8"/><path d="M12 17h.01"/>',
  digital: '<path d="M12 11v3a9 9 0 0 1-.6 3.2"/><path d="M8.5 12a3.5 3.5 0 0 1 7 0v2a13 13 0 0 1-.5 3.6"/><path d="M5 12a7 7 0 0 1 14 0v2"/><path d="M2 10a10 10 0 0 1 17-5.6"/><path d="M18.5 19a17 17 0 0 0 .5-4"/>',
  compartilhar: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  repetir: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/>',
  balanca: '<path d="M12 3v18M7 7h10M5 12a3 3 0 0 0 6 0L8 6zM13 12a3 3 0 0 0 6 0l-3-6zM8 21h8"/>',
};

/* Troca todo [data-ico] pelo SVG correspondente. Chame depois de montar a tela:
   quem monta HTML por string não dispara nada, e o ícone ficaria vazio. */
function pintarIcones(raiz) {
  const alvo = raiz || document;
  for (const el of alvo.querySelectorAll('[data-ico]')) {
    const nome = el.dataset.ico;
    const d = ICONES[nome];
    if (!d || el.dataset.pintado === '1') continue;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"
      width="100%" height="100%" aria-hidden="true">${d}</svg>`;
    el.dataset.pintado = '1';
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ICONES, pintarIcones };
