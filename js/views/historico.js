/* CESTA — o histórico: a memória de longo prazo.

   Aqui moram os dois números que não podem ter o mesmo nome: a CESTA
   COMPARÁVEL (a sua inflação, medida por cesta fechada) e o TOTAL GASTO (que
   sobe quando você compra mais coisas). Confundir os dois seria repetir o
   defeito de "Disponível" versus "Saldo em conta" no app de finanças. */
'use strict';

const ViewHistorico = {

  mesAnterior(mes) {
    const [a, m] = String(mes).split('-').map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  },

  nomeDoMes(mes) {
    const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const [a, m] = String(mes).split('-').map(Number);
    return `${nomes[m - 1]} de ${a}`;
  },

  /* O gasto do mês soma DUAS origens: as compras fechadas no app e as notas
     fiscais importadas. Contar só as primeiras deixava esta tela vazia para
     quem importou meses de nota e ainda não fechou nenhuma compra pelo app —
     que é exatamente o caminho recomendado para começar a usar o CESTA.

     A GUARDA CONTRA CONTAR DUAS VEZES: se existe uma compra fechada na mesma
     loja e no mesmo dia da nota, elas são a mesma ida ao mercado, e só a compra
     conta. Sem isso, quem fecha a compra no app e depois importa o cupom veria
     o gasto do mês dobrar — e um número que dobra sozinho destrói a confiança
     na tela inteira. */
  gastoDoMes(mes) {
    const compras = DB.listasFechadas().filter(l => String(l.data_fechamento).slice(0, 7) === mes);
    const daCompra = compras.reduce((s, l) => {
      const t = DB.totalDoCarrinho(l.id, () => null);
      return s + (l.total_cupom || t.firme);
    }, 0);

    const daNota = DB.all('nfce_docs')
      .filter(d => String(d.data).slice(0, 7) === mes && isFinite(d.total) && d.total > 0)
      .filter(d => !compras.some(l => l.data_fechamento === d.data && l.store_id === d.store_id))
      .reduce((s, d) => s + Number(d.total), 0);

    return daCompra + daNota;
  },

  render(dentro) {
    const compras = DB.listasFechadas();
    const obs = DB.all('price_obs');

    if (!compras.length && !obs.length) {
      return `${dentro ? '' : `<h1 class="titulo">Histórico</h1>`}
        <p class="sub">O que subiu, o que caiu e quanto a sua cesta variou.</p>
        <div class="card"><div class="ui-empty">
          <b>Ainda não há nada registrado</b>
          Depois da primeira compra — ou da primeira nota fiscal importada —
          esta tela mostra a evolução de cada produto.
        </div>
        <button class="btn" data-acao="importar">
          Importar nota fiscal
        </button></div>`;
    }

    const mes = DB.mesDe(DB.hojeISO());
    const anterior = this.mesAnterior(mes);

    return `${dentro ? '' : `<h1 class="titulo">Histórico</h1>`}
      <p class="sub">${obs.length} ${obs.length === 1 ? 'preço registrado' : 'preços registrados'} ·
        ${compras.length} ${compras.length === 1 ? 'compra' : 'compras'}</p>

      ${this.cartaoDaCesta(anterior, mes)}
      ${this.cartaoDeGasto(anterior, mes)}
      ${this.cartaoSubiram(anterior, mes)}
      ${this.cartaoEncolhimento()}
      ${this.cartaoCadencia()}
      ${this.cartaoCompras(compras)}

      <button class="btn ghost" data-acao="importar" style="margin-top:var(--e4)">
        Importar nota fiscal (NFC-e)
      </button>
      <button class="btn ghost" data-acao="entre-lojas" style="margin-top:var(--e2)">
        Onde minha cesta sai mais barata
      </button>`;
  },

  /* A CESTA COMPARÁVEL. Só entra produto observado nos DOIS meses — e o cartão
     diz quantos produtos entraram, porque um índice calculado sobre 3 produtos
     não merece a mesma confiança de um calculado sobre 40. */
  cartaoDaCesta(mesBase, mesAtual) {
    const c = Precos.cestaComparavel(DB, mesBase, mesAtual);
    if (!c.n) {
      return `<div class="card">
        <p class="section-title" style="margin-top:0">Sua cesta comparável</p>
        <div class="ui-empty" style="padding:var(--e4) 0">
          <b>Ainda não dá para comparar</b>
          É preciso ter comprado os mesmos produtos em dois meses diferentes.
          Importar notas antigas resolve isso de uma vez.
        </div></div>`;
    }
    const sobe = c.indice > 0;
    const selo = Math.abs(c.indice) < 0.02 ? 'b-slate' : sobe ? 'b-red' : 'b-green';
    return `<div class="card">
      <p class="section-title" style="margin-top:0">Sua cesta comparável</p>
      <div class="kpi">
        <div>
          <b class="kpi-value">${sobe ? '+' : '−'}${Math.abs(c.indice * 100).toFixed(1)}%</b>
          <span class="sub">${this.nomeDoMes(mesBase)} → ${this.nomeDoMes(mesAtual)}</span>
        </div>
        <span class="badge ${selo}">${c.n} ${c.n === 1 ? 'produto' : 'produtos'} nos dois meses</span>
      </div>
      <p class="sub">Mede só o que existe nos dois períodos — é a sua inflação de
        verdade, sem contar que você comprou coisas diferentes.</p>
    </div>`;
  },

  cartaoDeGasto(mesBase, mesAtual) {
    const a = this.gastoDoMes(mesBase), b = this.gastoDoMes(mesAtual);
    if (!a && !b) return '';
    const var_ = a > 0 ? (b - a) / a : null;
    return `<div class="card">
      <p class="section-title" style="margin-top:0">Você gastou</p>
      <div class="kpi">
        <div><span class="kpi-label">${this.nomeDoMes(mesAtual)}</span><b class="kpi-value">${UI.fmt(b)}</b></div>
        <div class="direita"><span class="kpi-label">${this.nomeDoMes(mesBase)}</span><b class="tx-amount">${UI.fmt(a)}</b></div>
      </div>
      ${var_ != null ? `<p class="sub">${var_ > 0 ? 'Subiu' : 'Caiu'} ${Math.abs(var_ * 100).toFixed(0)}% —
        <b>e isto não é inflação</b>: inclui ter comprado mais ou menos coisas.</p>` : ''}
    </div>`;
  },

  cartaoSubiram(mesBase, mesAtual) {
    const lista = Precos.maisSubiram(DB, mesBase, mesAtual, { limite: 5 });
    if (!lista.length) return '';
    return `<div class="card">
      <p class="section-title" style="margin-top:0">O que mais subiu</p>
      ${lista.map(p => {
        const prod = DB.get('products', p.product_id);
        const item = prod ? DB.get('items', prod.item_id) : null;
        const nome = prod ? `${item ? item.nome : ''} ${prod.marca || ''}`.trim() : 'produto';
        return `<div class="tx">
          <div class="tx-info">
            <b>${UI.esc(nome || '—')}</b>
            <span class="sub">${UI.fmt(p.de)} → ${UI.fmt(p.para)}</span>
          </div>
          <span class="badge ${p.variacao > 0 ? 'b-red' : 'b-green'}">
            ${p.variacao > 0 ? '+' : '−'}${Math.abs(p.variacao * 100).toFixed(0)}%
          </span>
        </div>`;
      }).join('')}
      <p class="sub">Só produtos com pelo menos duas medições em cada mês — um
        preço solto em cada ponta é ruído, não tendência.</p>
    </div>`;
  },

  /* O ENCOLHIMENTO DE EMBALAGEM: o aumento que ninguém enxerga sozinho. */
  cartaoEncolhimento() {
    const achados = [];
    for (const p of DB.all('products')) {
      const e = Precos.encolhimento(DB, p.id);
      if (e && e.encolheuPct > 0.02) achados.push({ produto: p, e });
    }
    if (!achados.length) return '';
    return `<div class="card">
      <p class="section-title" style="margin-top:0">A embalagem encolheu</p>
      ${achados.slice(0, 4).map(({ produto, e }) => {
        const item = DB.get('items', produto.item_id);
        const nome = `${item ? item.nome : ''} ${produto.marca || ''}`.trim();
        return `<div class="aviso-encolhimento">
          <b>${UI.esc(nome || 'produto')}</b>
          <p class="sub">De ${this.qtdCurta(e.de, e.unidade)} para ${this.qtdCurta(e.para, e.unidade)}.
            ${e.precoEtiquetaIgual
              ? `O preço da etiqueta não mudou, mas você está pagando
                 <b>${(e.subiuPorBase * 100).toFixed(0)}% mais por ${e.unidade}</b>.`
              : `O preço por ${e.unidade} ${e.subiuPorBase > 0 ? 'subiu' : 'caiu'}
                 ${Math.abs(e.subiuPorBase * 100).toFixed(0)}%.`}</p>
        </div>`;
      }).join('')}
    </div>`;
  },

  qtdCurta(q, unidade) {
    // Abaixo de 1 kg/L a leitura natural é em grama e mililitro, não "0,12 kg"
    if ((unidade === 'kg' || unidade === 'L') && q < 1) {
      return `${Math.round(q * 1000)} ${unidade === 'kg' ? 'g' : 'ml'}`;
    }
    return `${Number(q.toFixed(3))} ${unidade}`;
  },

  /* A DESPENSA, PELO CAMINHO BARATO: cadência em vez de inventário. */
  cartaoCadencia() {
    const avisos = [];
    for (const item of DB.all('items')) {
      const c = Precos.cadencia(DB, item.id);
      if (c && c.acabando) avisos.push({ item, c });
    }
    if (!avisos.length) return '';
    avisos.sort((a, b) => b.c.diasDesde - a.c.diasDesde);
    return `<div class="card">
      <p class="section-title" style="margin-top:0">Provavelmente está acabando</p>
      ${avisos.slice(0, 6).map(({ item, c }) => `<div class="tx">
        <div class="tx-info">
          <b>${UI.esc(item.nome)}</b>
          <span class="sub">Você costuma comprar a cada ${c.intervalo} dias · faz ${c.diasDesde}</span>
        </div>
        <span class="badge ${c.atrasado ? 'b-amber' : 'b-blue'}">${c.atrasado ? 'bem atrasado' : 'perto'}</span>
      </div>`).join('')}
      <p class="sub">Sai do seu próprio ritmo de compra — não há estoque a manter.</p>
    </div>`;
  },

  cartaoCompras(compras) {
    if (!compras.length) return '';
    return `<div class="card">
      <p class="section-title" style="margin-top:0">Compras</p>
      ${compras.slice(0, 8).map(l => {
        const t = DB.totalDoCarrinho(l.id, () => null);
        const loja = l.store_id ? DB.get('stores', l.store_id) : null;
        return `<div class="tx">
          <div class="tx-info">
            <b>${UI.esc(l.nome)}</b>
            <span class="sub">${this.dataBR(l.data_fechamento)}${loja ? ' · ' + UI.esc(loja.nome) : ''} ·
              ${t.comprados} ${t.comprados === 1 ? 'item' : 'itens'}</span>
          </div>
          <b class="tx-amount">${UI.fmt(l.total_cupom || t.firme)}</b>
        </div>`;
      }).join('')}
    </div>`;
  },

  dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
  },

  ligar(tela) {
    for (const b of tela.querySelectorAll('[data-acao]')) {
      b.addEventListener('click', () => {
        if (b.dataset.acao === 'importar') abrirImportacao();
        else if (b.dataset.acao === 'entre-lojas') abrirEntreLojas();
      });
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewHistorico };
