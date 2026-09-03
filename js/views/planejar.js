/* CESTA — PLANEJAR: o calendário de compras, as listas e o cardápio.

   É a área que existe para ser usada em casa, com calma. O Modo Mercado é
   pressa; aqui é decisão. */
'use strict';

const ViewPlanejar = {

  aba: 'compras',   // compras | cardapio | eventos

  render() {
    return `
      <h1 class="titulo">Planejar</h1>
      <p class="sub">O que vai ser comprado, quando, e por quanto.</p>

      <div class="sub-abas">
        <button class="sub-aba ${this.aba === 'compras' ? 'ativa' : ''}" data-sub="compras">Compras</button>
        <button class="sub-aba ${this.aba === 'cardapio' ? 'ativa' : ''}" data-sub="cardapio">Cardápio</button>
        <button class="sub-aba ${this.aba === 'eventos' ? 'ativa' : ''}" data-sub="eventos">Eventos</button>
      </div>

      ${this.aba === 'compras' ? this.telaCompras()
        : this.aba === 'cardapio' ? this.telaCardapio()
        : this.telaEventos()}`;
  },

  /* ------------------------------------------------------- compras --- */

  telaCompras() {
    const planos = DB.planosAbertos();
    const fechados = DB.listasFechadas().slice(0, 5);

    return `
      <button class="btn" data-acao="novo-plano">
        <span data-ico="mais"></span> Marcar uma compra
      </button>

      ${planos.length ? `<p class="section-title">Marcadas</p>
        <div class="card">${planos.map(p => this.linhaPlano(p)).join('')}</div>`
      : `<div class="card" style="margin-top:var(--e3)"><div class="ui-empty">
          <b>Nenhuma compra marcada</b>
          Marcar o dia do rancho é o que faz o app montar a lista sozinho, com o
          que deve faltar até lá.
        </div></div>`}

      <p class="section-title">Modelos</p>
      <p class="sub">Um ciclo vira modelo depois da primeira compra: o app passa
        a sugerir o que costuma entrar nele.</p>
      <div class="ciclos">
        ${Object.entries(CICLOS).filter(([, c]) => c.planeja).map(([id, c]) => {
          const n = DB.recorrentesDo(id).length;
          return `<button class="ciclo-card" data-acao="recorrentes" data-ciclo="${id}">
            <span class="ciclo-ico">${c.icone}</span>
            <b>${c.nome}</b>
            <span class="sub">${n ? `${n} ${n === 1 ? 'item fixo' : 'itens fixos'}` : 'sem itens fixos'}</span>
          </button>`;
        }).join('')}
      </div>

      ${fechados.length ? `<p class="section-title">Compras anteriores</p>
        <div class="card">${fechados.map(l => {
          const t = DB.totalDoCarrinho(l.id, () => null);
          const loja = l.store_id ? DB.get('stores', l.store_id) : null;
          return `<button class="item-linha linha-clicavel" data-acao="repetir" data-lista="${l.id}">
            <div class="item-corpo">
              <b>${UI.esc(l.nome)}</b>
              <span class="sub">${this.dataBR(l.data_fechamento)}${loja ? ' · ' + UI.esc(loja.nome) : ''} · ${t.comprados} itens</span>
            </div>
            <div class="direita">
              <b class="valor">${UI.fmt(l.total_cupom || t.firme)}</b>
              <span class="sub">repetir</span>
            </div>
          </button>`;
        }).join('')}</div>` : ''}`;
  },

  linhaPlano(p) {
    const ciclo = CICLOS[p.ciclo] || CICLOS.mensal;
    const dias = DB.diasAte(p.data);
    const itens = p.list_id ? DB.itensDaLista(p.list_id).length : 0;
    const custo = p.list_id ? Planejar.custoPrevisto(DB, p.list_id) : { previsto: 0 };
    const atrasado = dias < 0;
    return `<button class="item-linha linha-clicavel" data-acao="abrir-plano" data-plano="${p.id}">
      <span class="item-emoji">${ciclo.icone}</span>
      <div class="item-corpo">
        <b>${UI.esc(p.nome)}</b>
        <span class="sub">${this.dataBR(p.data)} · ${itens} ${itens === 1 ? 'item' : 'itens'}${
          custo.previsto ? ' · ≈ ' + UI.fmt(custo.previsto) : ''}</span>
      </div>
      <span class="badge ${atrasado ? 'b-red' : dias <= 2 ? 'b-amber' : 'b-slate'}">
        ${atrasado ? 'atrasada' : dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `${dias}d`}
      </span>
    </button>`;
  },

  /* ------------------------------------------------------- cardápio --- */

  /* Resolve "o que vou fazer de janta" e "o que preciso comprar" de uma vez —
     que é a mesma pergunta feita dos dois lados. */
  telaCardapio() {
    const hoje = DB.hojeISO();
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(new Date(hoje + 'T12:00:00').getTime() + i * 864e5);
      const p = n => String(n).padStart(2, '0');
      dias.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    }
    const cardapio = Cozinha.cardapioDa(DB, dias[0], dias[6]);
    const porDia = {};
    for (const c of cardapio) porDia[c.data] = c;

    const lista = Cozinha.listaDoCardapio(DB, dias[0], dias[6]);
    const faltando = lista.filter(l => !l.temEmCasa);

    return `
      <p class="sub">Escolha os jantares da semana. O app soma os ingredientes e
        desconta o que já existe em casa.</p>

      <div class="card">
        ${dias.map(d => {
          const c = porDia[d];
          const receita = c ? DB.get('recipes', c.recipe_id) : null;
          const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
          const dow = nomes[new Date(d + 'T12:00:00').getDay()];
          return `<button class="item-linha linha-clicavel" data-acao="escolher-prato" data-data="${d}">
            <span class="dia-chip">${dow}<b>${d.slice(8, 10)}</b></span>
            <div class="item-corpo">
              ${receita ? `<b>${UI.esc(receita.nome)}</b>
                <span class="sub">${c.porcoes} ${c.porcoes === 1 ? 'porção' : 'porções'} · ≈ ${UI.fmt(Cozinha.custoDoPrato(DB, receita.id, c.porcoes).custo)}</span>`
                : `<b class="fraco">Escolher prato</b>`}
            </div>
          </button>`;
        }).join('')}
      </div>

      ${lista.length ? `
        <p class="section-title">O que a semana pede</p>
        <div class="card">
          <div class="linha-resumo" style="margin-top:0">
            <div><span class="rotulo">Falta comprar</span><b class="valor grande">${faltando.length}</b></div>
            <div class="direita"><span class="rotulo">Já tem em casa</span><b class="valor">${lista.length - faltando.length}</b></div>
          </div>
          <div class="lista-itens" style="margin-top:var(--e3)">
            ${lista.map(l => `<div class="item-linha ${l.temEmCasa ? 'comprado' : ''}">
              <span class="item-emoji">${Catalogo.corredor(l.item.categoria).icone}</span>
              <div class="item-corpo">
                <b>${UI.esc(l.item.nome)}</b>
                <span class="sub">precisa de ${Despensa.fmtQtd(l.precisa, l.unidade)}${
                  l.temEmCasa ? ' · tem em casa' : l.incerto ? ' · não sei o que há em casa' : ` · faltam ${Despensa.fmtQtd(l.faltam, l.unidade)}`}</span>
              </div>
            </div>`).join('')}
          </div>
          ${faltando.length ? `<button class="btn" data-acao="cardapio-lista" style="margin-top:var(--e3)">
            Pôr os ${faltando.length} que faltam na lista
          </button>` : ''}
        </div>` : ''}`;
  },

  /* -------------------------------------------------------- eventos --- */

  telaEventos() {
    return `
      <p class="sub">Quantas pessoas vêm? O app calcula as quantidades e monta
        a lista com o custo previsto.</p>
      <div class="ciclos">
        ${Object.entries(Cozinha.EVENTOS).map(([id, e]) => `
          <button class="ciclo-card" data-acao="evento" data-evento="${id}">
            <span class="ciclo-ico">${e.icone}</span>
            <b>${e.nome}</b>
          </button>`).join('')}
      </div>`;
  },

  dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}`;
  },

  ligar(tela) {
    for (const b of tela.querySelectorAll('[data-sub]')) {
      b.addEventListener('click', () => { this.aba = b.dataset.sub; irPara('planejar'); });
    }
    for (const b of tela.querySelectorAll('[data-acao]')) {
      b.addEventListener('click', () => {
        const a = b.dataset.acao;
        if (a === 'novo-plano') abrirNovoPlano();
        else if (a === 'abrir-plano') abrirPlano(b.dataset.plano);
        else if (a === 'recorrentes') abrirRecorrentes(b.dataset.ciclo);
        else if (a === 'repetir') repetirCompra(b.dataset.lista);
        else if (a === 'escolher-prato') abrirEscolhaDePrato(b.dataset.data);
        else if (a === 'cardapio-lista') porCardapioNaLista();
        else if (a === 'evento') abrirEvento(b.dataset.evento);
      });
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewPlanejar };
