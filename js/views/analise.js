/* CESTA — ANÁLISE: onde o histórico vira decisão.

   Reúne o que já existia (histórico e produtos) com o que a onda 2 trouxe:
   onde comprar, para onde vai o dinheiro, e os preços-alvo. */
'use strict';

const ViewAnalise = {

  aba: 'resumo',   // resumo | onde | dinheiro | produtos | alvos

  render() {
    return `
      <h1 class="titulo">Análise</h1>
      <p class="sub">O que o seu histórico já sabe dizer.</p>

      <div class="chips rolavel">
        <button class="chip ${this.aba === 'resumo' ? 'active' : ''}" data-sub="resumo">Resumo</button>
        <button class="chip ${this.aba === 'onde' ? 'active' : ''}" data-sub="onde">Onde comprar</button>
        <button class="chip ${this.aba === 'dinheiro' ? 'active' : ''}" data-sub="dinheiro">O dinheiro</button>
        <button class="chip ${this.aba === 'produtos' ? 'active' : ''}" data-sub="produtos">Produtos</button>
        <button class="chip ${this.aba === 'alvos' ? 'active' : ''}" data-sub="alvos">Alvos</button>
      </div>

      ${this.aba === 'resumo' ? ViewHistorico.render(true)
        : this.aba === 'onde' ? this.telaOnde()
        : this.aba === 'dinheiro' ? this.telaDinheiro()
        : this.aba === 'produtos' ? ViewProdutos.render(true)
        : this.telaAlvos()}`;
  },

  /* ---------------------------------------------------- onde comprar --- */

  telaOnde() {
    const plano = DB.proximoPlano();
    const listaId = plano && plano.list_id ? plano.list_id
      : (DB.listaEmCurso() || DB.listasPlanejadas()[0] || {}).id;

    if (!listaId) {
      return `<div class="card"><div class="ui-empty">
        <b>Monte uma lista primeiro</b>
        A comparação é da SUA lista: o app soma o preço de cada item em cada
        mercado onde você já comprou.
      </div></div>`;
    }

    const r = Decisoes.ondeComprar(DB, listaId);

    if (r.motivo) {
      return `<div class="card">
        <div class="ui-empty">
          <b>Ainda não dá para comparar</b>
          ${r.motivo === 'menos de dois mercados'
            ? 'É preciso ter registrado preços em pelo menos dois mercados diferentes.'
            : `Só ${r.cobertos} de ${r.total} itens da lista foram comprados nos mesmos mercados. Comparar com menos que isso daria a resposta errada com cara de precisão.`}
        </div>
      </div>`;
    }

    const melhor = r.lojas[0];
    return `
      <div class="card">
        <p class="section-title" style="margin-top:0">A sua lista, em cada mercado</p>
        <p class="sub">Comparando os <b>${r.cobertos} itens</b> que você já comprou
          em todos eles — a mesma cesta nos dois lugares.</p>
        <div class="lista-itens" style="margin-top:var(--e3)">
          ${r.lojas.map((l, i) => `<div class="tx">
            <div class="tx-info">
              <b>${i === 0 ? '🏆 ' : ''}${UI.esc(l.loja.nome)}</b>
              <span class="sub">${i === 0 ? 'mais barato' : `${UI.fmt(l.diferenca)} a mais`}</span>
            </div>
            <b class="tx-amount">${UI.fmt(l.custo)}</b>
          </div>`).join('')}
        </div>
        ${r.economia > 0 ? `<p class="sub" style="margin-top:var(--e3)">
          Escolher ${UI.esc(melhor.loja.nome)} economiza <b>${UI.fmt(r.economia)}</b>
          nesta compra. Vale considerar a distância e o tempo também.</p>` : ''}
      </div>`;
  },

  /* ----------------------------------------------- para onde vai o R$ --- */

  telaDinheiro() {
    const d = Decisoes.ondeVaiODinheiro(DB, { meses: 3 });
    if (!d.itens.length) {
      return `<div class="card"><div class="ui-empty">
        <b>Sem gastos registrados ainda</b>
        Depois de algumas compras, esta tela mostra os poucos produtos que fazem
        a maior parte da conta.
      </div></div>`;
    }

    return `
      <div class="card">
        <p class="section-title" style="margin-top:0">Os últimos 3 meses</p>
        <div class="kpi" style="margin-top:0">
          <div><span class="kpi-label">Total</span><b class="kpi-value">${UI.fmt(d.total)}</b></div>
          <div class="direita"><span class="kpi-label">Produtos</span><b class="tx-amount">${d.itens.length}</b></div>
        </div>
        <p class="sub"><b>${d.quantosFazem80} ${d.quantosFazem80 === 1 ? 'produto faz' : 'produtos fazem'}
          80% da sua conta.</b> Economizar 10% neles vale mais que cortar todo o resto —
          é onde vale olhar primeiro.</p>
      </div>

      <div class="card">
        <p class="section-title" style="margin-top:0">Por corredor</p>
        <div class="lista-itens">
          ${d.porCategoria.slice(0, 6).map(c => `<div class="tx">
            <span class="tx-ico">${c.corredor.icone}</span>
            <div class="tx-info">
              <b>${c.corredor.nome}</b>
              <div class="barra-fina"><div style="width:${((c.gasto / d.total) * 100).toFixed(1)}%"></div></div>
            </div>
            <div class="direita">
              <b class="tx-amount">${UI.fmt(c.gasto)}</b>
              <span class="sub">${Math.round((c.gasto / d.total) * 100)}%</span>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <p class="section-title" style="margin-top:0">Onde o dinheiro se concentra</p>
        <div class="lista-itens">
          ${d.itens.slice(0, 12).map(l => `<div class="tx">
            <span class="badge ${l.classe === 'A' ? 'b-red' : l.classe === 'B' ? 'b-amber' : 'b-slate'}">${l.classe}</span>
            <div class="tx-info">
              <b>${UI.esc(l.item.nome)}</b>
              <span class="sub">${l.vezes} ${l.vezes === 1 ? 'compra' : 'compras'} · ${Math.round(l.pct * 100)}% da conta</span>
            </div>
            <b class="tx-amount">${UI.fmt(l.gasto)}</b>
          </div>`).join('')}
        </div>
        <p class="sub">A: os que somam os primeiros 80% · B: os 15% seguintes ·
          C: o resto, que quase não muda a conta.</p>
      </div>`;
  },

  /* ---------------------------------------------------------- alvos --- */

  telaAlvos() {
    const alvos = DB.all('price_targets');
    const batidos = Decisoes.alvosBatidos(DB);
    const idsBatidos = new Set(batidos.map(b => b.alvo.id));

    return `
      <div class="card">
        <p class="section-title" style="margin-top:0">Preços-alvo</p>
        <p class="sub">Diga quanto você aceita pagar. No mercado, o app avisa
          quando o preço bater o alvo — em vez de você ter de lembrar de conferir.</p>
        <button class="btn" data-acao="novo-alvo" style="margin-top:var(--e3)">
          Definir um preço-alvo
        </button>
      </div>

      ${batidos.length ? `<p class="section-title">Batendo agora</p>
        <div class="card lista-itens">
          ${batidos.map(b => {
            const item = b.alvo.item_id ? DB.get('items', b.alvo.item_id) : null;
            const loja = b.loja ? DB.get('stores', b.loja) : null;
            return `<div class="tx">
              <div class="tx-info">
                <b>${UI.esc(item ? item.nome : 'produto')}</b>
                <span class="sub">${UI.fmtBase(b.melhor, b.unidade)}${loja ? ' em ' + UI.esc(loja.nome) : ''}
                  · alvo ${UI.fmtBase(b.alvo.valor, b.alvo.unidade)}</span>
              </div>
              <span class="badge b-green">🟢 bateu</span>
            </div>`;
          }).join('')}
        </div>` : ''}

      ${alvos.length ? `<p class="section-title">Todos os alvos</p>
        <div class="card lista-itens">
          ${alvos.map(a => {
            const item = a.item_id ? DB.get('items', a.item_id) : null;
            return `<div class="tx">
              <div class="tx-info">
                <b>${UI.esc(item ? item.nome : 'produto')}</b>
                <span class="sub">avisar abaixo de ${UI.fmtBase(a.valor, a.unidade)}</span>
              </div>
              <div class="direita">
                ${idsBatidos.has(a.id) ? '<span class="badge b-green">batendo</span>' : ''}
                <button class="btn-mini" data-acao="apagar-alvo" data-alvo="${a.id}">remover</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}`;
  },

  ligar(tela) {
    for (const b of tela.querySelectorAll('[data-sub]')) {
      b.addEventListener('click', () => { this.aba = b.dataset.sub; irPara('analise'); });
    }
    // As telas reaproveitadas trazem os próprios eventos
    if (this.aba === 'resumo') ViewHistorico.ligar(tela);
    if (this.aba === 'produtos') ViewProdutos.ligar(tela);

    for (const b of tela.querySelectorAll('[data-acao]')) {
      b.addEventListener('click', () => {
        if (b.dataset.acao === 'novo-alvo') abrirNovoAlvo();
        else if (b.dataset.acao === 'apagar-alvo') {
          DB.remove('price_targets', b.dataset.alvo);
          irPara('analise');
          UI.toast('Alvo removido');
        }
      });
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewAnalise };
