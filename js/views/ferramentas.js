/* CESTA — as ferramentas de gôndola e o fechamento da compra. */
'use strict';

/* ================================================== MAIS POR MENOS === */

/* O detergente de 500 ml a R$ 3,20 contra o refil de 1 L a R$ 5,90.

   Esta é a única tela do app que NÃO PRECISA DE HISTÓRICO NENHUM: é aritmética
   de gôndola e funciona no minuto zero de uso. Existe por causa da armadilha
   central do produto — um comparador sem histórico é uma tela vazia, e o app
   seria desinstalado antes de ficar útil. */
function abrirMaisPorMenos() {
  const lado = (id, titulo) => `
    <div class="mpm-lado">
      <p class="section-title" style="margin-top:0">${titulo}</p>
      <label class="preco-campo">
        <span class="kpi-label">Preço</span>
        <input class="amount-input" id="mpm-preco-${id}" type="text" inputmode="numeric" autocomplete="off" placeholder="R$ 0,00">
      </label>
      <div class="preco-campos" style="margin-top:var(--e2)">
        <label class="preco-campo">
          <span class="kpi-label">Tamanho</span>
          <input  id="mpm-qtd-${id}" inputmode="decimal" placeholder="500">
        </label>
        <label class="preco-campo estreito">
          <span class="kpi-label">Un.</span>
          <select  id="mpm-un-${id}">
            ${['ml', 'l', 'g', 'kg', 'un'].map(u => `<option value="${u}">${u}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>`;

  UI.folha(`
    <h2 class="sheet-title">Mais por Menos</h2>
    <p class="sub">Qual embalagem compensa? Não precisa de histórico — é conta de gôndola.</p>
    <div class="mpm" style="margin-top:var(--e3)">
      ${lado('a', 'Opção A')}
      ${lado('b', 'Opção B')}
    </div>
    <div id="mpm-resposta" class="mpm-resposta" role="status" aria-live="polite"></div>`);

  const campos = ['a', 'b'].flatMap(x => [`#mpm-preco-${x}`, `#mpm-qtd-${x}`, `#mpm-un-${x}`])
    .map(s => document.querySelector(s));
  const mascaras = ['a', 'b'].map(x => UI.mascaraMoeda(document.querySelector('#mpm-preco-' + x)));
  const resposta = document.querySelector('#mpm-resposta');

  const calcular = () => {
    mascaras.forEach(m => m());
    const ler = x => ({
      preco: UI.lerMoeda(document.querySelector('#mpm-preco-' + x)),
      qtd: Number(String(document.querySelector('#mpm-qtd-' + x).value).replace(',', '.')) || 0,
      unidade: document.querySelector('#mpm-un-' + x).value,
    });
    const a = ler('a'), b = ler('b');
    if (!a.preco || !b.preco || !a.qtd || !b.qtd) {
      resposta.innerHTML = '<p class="sub">Preencha os dois lados.</p>';
      return;
    }
    const r = Precos.maisPorMenos(a, b);
    if (r.erro) {
      resposta.innerHTML = `<div class="diag b-slate"><span>${r.erro === 'unidades diferentes'
        ? 'Compare coisas na mesma medida (peso com peso, volume com volume).'
        : 'Unidade desconhecida.'}</span></div>`;
      return;
    }
    if (r.empate) {
      resposta.innerHTML = `<div class="diag b-amber"><span>🟡 Dá no mesmo</span></div>
        <p class="diag-nota">As duas saem a ${UI.fmtBase(r.a.valor, r.unidade)}.</p>`;
      return;
    }
    const vencedor = r.melhor === 'a' ? 'A' : 'B';
    const ganho = r.melhor === 'a' ? r.a : r.b;
    const perde = r.melhor === 'a' ? r.b : r.a;
    resposta.innerHTML = `
      <div class="diag b-green"><span>🟢 Opção ${vencedor} compensa</span>
        <span class="pct">${Math.round(r.economiaPct * 100)}% mais barata</span></div>
      <p class="diag-nota">${UI.fmtBase(ganho.valor, r.unidade)} contra ${UI.fmtBase(perde.valor, r.unidade)} —
        diferença de ${UI.fmtBase(r.diferenca, r.unidade)}.</p>`;
  };

  for (const c of campos) if (c) c.addEventListener('input', calcular), c.addEventListener('change', calcular);
  calcular();
}

/* =================================================== FECHAMENTO === */

/* O CONFERIDOR DE CAIXA.

   Cuidado factual: no Brasil o preço de etiqueta JÁ INCLUI os impostos — não há
   imposto a somar no final. O que faz o total do app divergir do cupom é outra
   coisa: item de peso variável que só fecha na balança, promoção condicional
   (leve 3, pague 2) e item que entrou no carrinho sem passar pelo app.

   Ser o app que PEGA O ERRO DE PREÇO DO MERCADO vale mais em confiança do que
   dez telas de gráfico. */
function abrirFechamento(listaId) {
  const lista = DB.get('lists', listaId);
  if (!lista) return;
  const t = DB.totalDoCarrinho(listaId, li => ViewLista.estimar(li));
  const itens = DB.itensDaLista(listaId);
  const naoTinha = itens.filter(li => li.nao_tinha);
  const pendentes = itens.filter(li => !li.comprado && !li.nao_tinha);

  const fechar = UI.folha(`
    <h2 class="sheet-title">Fechar a compra</h2>
    <p class="sub">${t.comprados} ${t.comprados === 1 ? 'item registrado' : 'itens registrados'}${
      pendentes.length ? ` · ${pendentes.length} ainda sem preço` : ''}.</p>

    <div class="kpi" style="margin-top:var(--e3)">
      <div><span class="kpi-label">Total no app</span><b class="kpi-value">${UI.fmt(t.firme)}</b></div>
    </div>

    <label class="preco-campo" style="margin-top:var(--e4)">
      <span class="kpi-label">Total do cupom (opcional)</span>
      <input class="amount-input" id="fech-cupom" type="text" inputmode="numeric" autocomplete="off" placeholder="R$ 0,00">
    </label>
    <p class="sub">Confere se o caixa cobrou o que a gôndola prometia.</p>

    <div id="fech-conferencia" role="status" aria-live="polite" style="margin-top:var(--e3)"></div>

    ${naoTinha.length ? `<p class="section-title">Não tinha nesta loja</p>
      <p class="sub">${naoTinha.map(li => UI.esc((DB.get('items', li.item_id) || {}).nome || '')).join(', ')}</p>` : ''}

    <button class="btn" id="fech-ok" style="margin-top:var(--e4)">
      Encerrar compra
    </button>
    <button class="btn ghost" id="fech-voltar" style="margin-top:var(--e2)">Continuar comprando</button>`);

  const campo = document.querySelector('#fech-cupom');
  const mascara = UI.mascaraMoeda(campo);
  const area = document.querySelector('#fech-conferencia');

  const conferir = () => {
    mascara();
    const cupom = UI.lerMoeda(campo);
    if (!cupom) { area.innerHTML = ''; return; }
    const dif = cupom - t.firme;
    const rel = t.firme > 0 ? Math.abs(dif) / t.firme : 1;

    /* Um centavo de diferença é arredondamento de balança, não erro do mercado.
       Acusar isso como divergência faria o conferidor gritar em toda compra — e
       um alarme que sempre toca é um alarme desligado. */
    if (Math.abs(dif) < 0.02) {
      area.innerHTML = `<div class="diag b-green"><span>🟢 Bateu certinho</span></div>
        <p class="diag-nota">O caixa cobrou o que a gôndola prometia.</p>`;
      return;
    }
    const acima = dif > 0;
    area.innerHTML = `<div class="diag ${acima ? 'b-red' : 'b-amber'}">
        <span>${acima ? '🔴 O caixa cobrou mais' : '🟡 O caixa cobrou menos'}</span>
        <span class="pct">${UI.fmt(Math.abs(dif))}</span>
      </div>
      <p class="diag-nota">${acima
        ? `Diferença de ${(rel * 100).toFixed(1)}%. Vale conferir o cupom: preço de gôndola diferente do caixa é reclamável.`
        : 'Pode ser promoção aplicada no caixa, ou item de peso variável que fechou por menos.'}
        ${pendentes.length ? ` Há ${pendentes.length} ${pendentes.length === 1 ? 'item' : 'itens'} sem preço no app, o que também explica parte da diferença.` : ''}</p>`;
  };

  campo.addEventListener('input', conferir);
  document.querySelector('#fech-voltar').addEventListener('click', fechar);
  document.querySelector('#fech-ok').addEventListener('click', () => {
    DB.upsert('lists', {
      id: listaId,
      status: 'fechada',
      data_fechamento: DB.hojeISO(),
      total_cupom: UI.lerMoeda(campo) || null,
    });
    Mercado.fechar();
    fechar();
    irPara('historico');
    UI.toast('Compra encerrada. O histórico já está atualizado.');
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirMaisPorMenos, abrirFechamento };
