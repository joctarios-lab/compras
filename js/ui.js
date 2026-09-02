/* CESTA — primitivos de tela: máscara de moeda, folhas, avisos e o teclado.

   Herdado do DOMI, onde estas peças já foram para o mercado e voltaram. */
'use strict';

const UI = {

  /* ---------------------------------------------------------- moeda --- */

  /* Formata em real. Sempre com duas casas: preço com uma casa só ("R$ 4,9")
     lê-se errado num relance, e relance é tudo o que se tem no corredor. */
  fmt(v) {
    const n = Number(v) || 0;
    return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },

  /* Formata um preço por unidade canônica: R$ 4,98/kg.
     Três casas quando o valor é pequeno — R$ 0,04/un e R$ 0,04/un podem ser
     preços diferentes, e arredondar aqui esconderia a diferença que o app
     existe para mostrar. */
  fmtBase(v, unidade) {
    const n = Number(v) || 0;
    const casas = n < 1 ? 3 : 2;
    return 'R$ ' + n.toFixed(casas).replace('.', ',') + '/' + unidade;
  },

  /* MÁSCARA DE ENTRADA: a pessoa digita dígitos, o campo mostra dinheiro.
     `498` vira R$ 4,98. Sem isto, digitar preço no mercado exige achar a
     vírgula no teclado numérico — que em vários teclados nem está lá. */
  mascaraMoeda(el) {
    const aplicar = () => {
      const digitos = String(el.value).replace(/\D/g, '').slice(0, 9);
      el.value = digitos ? this.fmt(Number(digitos) / 100) : '';
      // O cursor vai sempre para o fim: editar no meio de um valor mascarado
      // produz resultado imprevisível, e ninguém tenta isso de propósito.
      if (el.setSelectionRange) {
        const n = el.value.length;
        try { el.setSelectionRange(n, n); } catch (_) {}
      }
    };
    el.addEventListener('input', aplicar);
    el.inputMode = 'decimal';
    return aplicar;
  },

  /* Lê o número de volta de um campo mascarado. */
  lerMoeda(el) {
    const digitos = String(el && el.value || '').replace(/\D/g, '');
    return digitos ? Number(digitos) / 100 : 0;
  },

  /* --------------------------------------------------------- teclado --- */

  /* O TECLADO DO CELULAR NÃO ENCOLHE A PÁGINA — ele cobre o rodapé. Medir por
     innerHeight não enxerga isso; o visualViewport, sim. A altura coberta vira
     a variável --teclado, e daí a folha se apoia acima dele.

     É o problema mais difícil da tela principal deste app: o campo de preço vive
     no rodapé, na zona do polegar, exatamente onde o teclado sobe. */
  ligarTeclado() {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (!vv) return;
    const medir = () => {
      const oculto = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--teclado', oculto + 'px');
      /* 120px separa o teclado das barrinhas do navegador que aparecem e somem
         ao rolar — abaixo disso não é teclado, é o Chrome se mexendo. */
      document.body.classList.toggle('teclado-aberto', oculto > 120);
    };
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    medir();
  },

  /* ---------------------------------------------------------- folhas --- */

  /* Folha que sobe de baixo. Devolve uma função que a fecha.
     No Modo Mercado NÃO se usa folha para registrar preço — lá a entrada é
     direta, sem diálogo. Folha é para o que acontece fora do corredor. */
  folha(html, { aoFechar } = {}) {
    const fundo = document.createElement('div');
    fundo.className = 'folha-fundo';
    fundo.innerHTML = `<div class="folha" role="dialog" aria-modal="true">
      <div class="folha-alca"></div>${html}</div>`;
    const fechar = () => {
      if (!fundo.parentNode) return;
      fundo.remove();
      document.removeEventListener('keydown', naTecla);
      if (aoFechar) aoFechar();
    };
    const naTecla = e => { if (e.key === 'Escape') fechar(); };
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', naTecla);
    document.body.appendChild(fundo);
    return fechar;
  },

  /* ---------------------------------------------------------- avisos --- */

  _toast: null,

  /* Aviso curto. Ele fala — não pisca uma cor e some: a cor sozinha não informa,
     e no corredor ninguém está olhando para a tela quando ela pisca. */
  toast(texto, ms = 2600) {
    if (this._toast) this._toast.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = texto;
    document.body.appendChild(el);
    this._toast = el;
    setTimeout(() => { if (el.parentNode) el.remove(); }, ms);
    return el;
  },

  /* --------------------------------------------------------- diversos --- */

  esc(s) {
    return String(s == null ? '' : s)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
    /* split/join, não replace: '$' numa string de substituição do replace() é
       padrão especial e corrompe qualquer texto com 'R$'. */
  },

  /* Tela acesa enquanto se anda pelo mercado. Falha em silêncio onde não há
     suporte — é conveniência, e nenhum fluxo pode depender dela. */
  async manterAcesa() {
    try {
      if (navigator.wakeLock) return await navigator.wakeLock.request('screen');
    } catch (_) {}
    return null;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { UI };
