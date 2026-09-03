/* CESTA — primitivos de tela: máscara de moeda, folhas, avisos e o teclado.

   Herdado do DOMI, onde estas peças já foram para o mercado e voltaram. */
'use strict';

const UI = {

  /* ---------------------------------------------------------- moeda --- */

  /* Formata em real — a MESMA função do app de finanças, letra por letra.

     A minha montava o texto à mão e colava um "R$ " com espaço comum; o
     `toLocaleString` usa espaço NÃO-SEPARÁVEL entre o símbolo e o número. Os
     dois se parecem na tela e são caracteres diferentes: o valor quebrava linha
     entre o R$ e o número onde o do DOMI não quebra. Diferença pequena o
     bastante para eu não ver e grande o bastante para os apps não serem iguais.

     Sempre com duas casas: preço com uma casa só ("R$ 4,9") lê-se errado num
     relance, e relance é tudo o que se tem no corredor. */
  fmt(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  /* Formata um preço por unidade canônica: R$ 4,98/kg.
     Três casas quando o valor é pequeno — R$ 0,04/un e R$ 0,04/un podem ser
     preços diferentes, e arredondar aqui esconderia a diferença que o app
     existe para mostrar. */
  fmtBase(v, unidade) {
    const n = Number(v) || 0;
    const casas = n < 1 ? 3 : 2;
    /* O mesmo espaço não-separável do fmt: dois espaçamentos diferentes
       para o mesmo "R$" na mesma tela é o tipo de detalhe que ninguém nomeia
       e todo mundo sente. */
    return 'R$ ' + n.toFixed(casas).replace('.', ',') + '/' + unidade;
  },

  /* MÁSCARA MONETÁRIA — a mesma do app de finanças, dígito por dígito.

     Padrão bancário brasileiro: o que se digita entra como CENTAVOS. `498`
     vira R$ 4,98. É o que dispensa procurar a vírgula num teclado numérico de
     celular, onde em vários ela nem aparece.

     O valor verdadeiro mora em `dataset.cents`, não no texto exibido. Ler de
     volta reinterpretando o texto formatado — que era o que eu fazia aqui —
     depende de a formatação e a leitura concordarem para sempre; guardar o
     número cru não depende de nada. É assim no DOMI, e agora é assim aqui. */
  mascaraMoeda(el, valorInicial) {
    if (!el) return () => {};
    const set = cents => {
      el.dataset.cents = cents;
      el.value = cents === '' ? '' :
        (Number(cents) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const inicial = Number(valorInicial);
    set(inicial > 0 ? String(Math.round(inicial * 100)) : '');
    const aplicar = () => {
      const digitos = String(el.value).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
      set(digitos);
      // O cursor vai sempre para o fim: editar no meio de um valor mascarado
      // produz resultado imprevisível, e ninguém tenta isso de propósito.
      if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    };
    el.addEventListener('input', aplicar);
    el.addEventListener('focus', () => setTimeout(() => {
      if (el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    }, 0));
    el.inputMode = 'numeric';
    return aplicar;
  },

  /* Lê o número de volta — do dado guardado, nunca do texto na tela. */
  lerMoeda(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    return el ? (Number(el.dataset.cents) || 0) / 100 : 0;
  },

  /* --------------------------------------------------------- teclado --- */

  /* O TECLADO DO CELULAR NÃO ENCOLHE A PÁGINA — ele cobre o rodapé. Medir por
     innerHeight não enxerga isso; o visualViewport, sim. A altura coberta vira
     a variável --teclado, e daí a sheet se apoia acima dele.

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
     No Modo Mercado NÃO se usa sheet para registrar preço — lá a entrada é
     direta, sem diálogo. Folha é para o que acontece fora do corredor. */
  folha(html, { aoFechar } = {}) {
    const fundo = document.createElement('div');
    fundo.className = 'sheet-backdrop';
    /* O X NO CANTO É OBRIGATÓRIO, e não um enfeite.

       Antes dava para sair tocando no fundo escuro ou no Esc — duas coisas que
       ninguém descobre sozinho num celular. A alça sozinha era pior: ela parece
       arrastável, não é, e quem tenta puxar conclui que a tela travou.

       O botão fica no canto superior direito porque é onde a mão procura, e é
       grande o bastante para ser acertado sem mirar. */
    /* O X vai para DENTRO do título, que é onde o DOMI o põe — o .sheet-title
       dele já é um flex com espaço entre justamente para isso. Um X solto,
       posicionado por cima, era peça minha onde já havia a do DOMI. */
    const comX = html.replace(
      /<h2 class="sheet-title">([\s\S]*?)<\/h2>/,
      '<h2 class="sheet-title">$1<button class="close-x" type="button" aria-label="Fechar">✕</button></h2>');
    /* Folha sem título ganha um .sheet-title VAZIO só com o X. Nenhuma peça
       nova para isso: o .sheet-title do DOMI é flex com espaço entre, então um
       único filho já vai para a direita sozinho. Era o que eu resolveria
       inventando um botão flutuante posicionado por cima. */
    const cabeca = comX === html
      ? '<h2 class="sheet-title"><span></span><button class="close-x" type="button" aria-label="Fechar">✕</button></h2>'
      : '';
    fundo.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      ${cabeca}
      ${comX}</div>`;
    const fechar = () => {
      if (!fundo.parentNode) return;
      fundo.remove();
      document.removeEventListener('keydown', naTecla);
      if (aoFechar) aoFechar();
    };
    const naTecla = e => { if (e.key === 'Escape') fechar(); };
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    const botaoX = fundo.querySelector('.close-x');
    if (botaoX) botaoX.addEventListener('click', fechar);
    document.addEventListener('keydown', naTecla);
    document.body.appendChild(fundo);
    /* Todo campo de data da folha ganha o seletor ao ser criado — em UM lugar,
       porque ligar isso folha a folha garante que alguma fique de fora. */
    this.ligarDatas(fundo);
    /* E todo <select> vira o componente do DOMI, para os dois apps terem o
       MESMO dropdown — não um parecido. O select nativo tem a cara do sistema
       operacional, e num app de tema escuro isso salta aos olhos. */
    if (typeof UIForm !== 'undefined' && UIForm.enhance) {
      try { UIForm.enhance(fundo); } catch (_) {}
    }
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

  /* ------------------------------------------------------------ datas --- */

  /* O CAMPO INTEIRO ABRE O SELETOR, não só o iconezinho.

     No celular tocar em qualquer parte do campo já abre; no computador, o
     navegador exige acertar um quadradinho de 12px no canto — e quem não acerta
     conclui que o campo é só de digitação.  iguala os dois.

     O try/catch não é zelo: o navegador RECUSA showPicker fora de um gesto do
     usuário, e alguns não o têm. Nos dois casos o campo continua funcionando
     como sempre — digitável. */
  ligarSeletorDeData(el) {
    if (!el) return;
    el.addEventListener('click', () => {
      try { if (el.showPicker) el.showPicker(); } catch (_) {}
    });
  },

  /* Liga o seletor em todos os campos de data de uma tela de uma vez. */
  ligarDatas(raiz) {
    const onde = raiz || document;
    for (const el of onde.querySelectorAll('input[type="date"]')) this.ligarSeletorDeData(el);
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
