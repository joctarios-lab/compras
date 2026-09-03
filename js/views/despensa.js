/* CESTA — DESPENSA: o que existe em casa.

   Ela nunca pede que você mantenha nada. Cada linha mostra a conta que produziu
   o número, porque uma estimativa que não se pode auditar perde a confiança na
   primeira vez que erra — e ela vai errar às vezes, por construção. */
'use strict';

const ViewDespensa = {

  filtro: 'tudo',   // tudo | acabando | vencendo

  render() {
    const tudo = Despensa.tudo(DB);
    const acabando = Despensa.acabando(DB, { ateDias: 7 });
    const vencendo = Despensa.vencendo(DB);

    if (!tudo.length) {
      return `<h1 class="titulo">Despensa</h1>
        <p class="sub">O que tem em casa, sem você precisar anotar nada.</p>
        <div class="card"><div class="ui-empty">
          <b>Ainda vazia</b>
          A despensa se enche sozinha: tudo o que você registra numa compra ou
          importa de uma nota fiscal entra aqui. O consumo sai do seu próprio
          ritmo de compra.
        </div>
        <button class="btn" data-acao="importar">
          Importar nota fiscal
        </button></div>`;
    }

    const lista = this.filtro === 'acabando' ? acabando
      : this.filtro === 'vencendo' ? vencendo
      : tudo;

    return `<h1 class="titulo">Despensa</h1>
      <p class="sub">Estimada pelas suas compras e pelo seu ritmo de consumo.
        Corrija o que estiver errado — a correção ensina o app.</p>

      <div class="sub-abas">
        <button class="sub-aba ${this.filtro === 'tudo' ? 'ativa' : ''}" data-f="tudo">Tudo (${tudo.length})</button>
        <button class="sub-aba ${this.filtro === 'acabando' ? 'ativa' : ''}" data-f="acabando">Acabando (${acabando.length})</button>
        <button class="sub-aba ${this.filtro === 'vencendo' ? 'ativa' : ''}" data-f="vencendo">Vencendo (${vencendo.length})</button>
      </div>

      ${lista.length ? `<div class="card lista-itens">
        ${lista.map(s => this.linha(s)).join('')}
      </div>` : `<div class="card"><div class="ui-empty">
        <b>Nada aqui</b>
        ${this.filtro === 'acabando' ? 'Nenhum item se aproximando do fim.' : 'Nenhum item passando da validade típica.'}
      </div></div>`}`;
  },

  linha(s) {
    const corredor = Catalogo.corredor(s.item.categoria);

    /* O que se mostra à direita depende do que se PODE afirmar:
         · saldo conhecido  → a quantidade e quando acaba
         · perecível        → há quantos dias foi comprado
         · desconhecido     → "não sei", em palavras
       Mostrar zero onde não se sabe seria afirmar que acabou. */
    let direita;
    if (s.perecivel) {
      direita = `<span class="badge ${s.vencido ? 'b-red' : 'b-slate'}">
        ${s.diasDesdeUltima == null ? '—' : s.vencido ? 'pode ter estragado' : `há ${s.diasDesdeUltima}d`}
      </span>`;
    } else if (s.saldo == null) {
      direita = `<span class="badge b-slate">não sei</span>`;
    } else {
      const selo = s.diasParaAcabar == null ? 'b-slate'
        : s.diasParaAcabar <= 0 ? 'b-red'
        : s.diasParaAcabar <= 7 ? 'b-amber' : 'b-green';
      direita = `<b class="valor">${Despensa.fmtQtd(s.saldo, s.unidade)}</b>
        <span class="badge ${selo}">${s.diasParaAcabar == null ? '—'
          : s.diasParaAcabar <= 0 ? 'acabou' : `~${s.diasParaAcabar}d`}</span>`;
    }

    return `<button class="item-linha linha-clicavel" data-item="${s.item_id}">
      <span class="item-emoji">${corredor.icone}</span>
      <div class="item-corpo">
        <b>${UI.esc(s.item.nome)}${s.corrigido ? ' <span class="marca-mini">corrigido</span>' : ''}</b>
        <span class="sub">${UI.esc(s.explicacao)}</span>
      </div>
      <div class="direita">${direita}</div>
    </button>`;
  },

  abrirDetalhe(itemId) {
    const s = Despensa.saldoDe(DB, itemId);
    if (!s) return;
    const corredor = Catalogo.corredor(s.item.categoria);

    const fechar = UI.folha(`
      <h2 class="titulo">${corredor.icone} ${UI.esc(s.item.nome)}</h2>
      <p class="sub">${UI.esc(s.explicacao)}</p>

      ${!s.perecivel && s.saldo != null ? `
        <div class="linha-resumo">
          <div><span class="rotulo">Deve haver em casa</span>
            <b class="valor grande">${Despensa.fmtQtd(s.saldo, s.unidade)}</b></div>
          ${s.diasParaAcabar != null ? `<div class="direita">
            <span class="rotulo">Acaba em</span>
            <b class="valor">${s.diasParaAcabar <= 0 ? 'já acabou' : s.diasParaAcabar + ' dias'}</b></div>` : ''}
        </div>` : ''}

      ${s.perecivel ? `<p class="sub"><b>${UI.esc(s.item.nome)} estraga rápido.</b>
        O app não estima o que sobrou — acompanha pelo seu ritmo de compra, que é
        o que dá para saber sem você abrir a geladeira.</p>` : ''}

      <p class="section-title">Está errado?</p>
      <p class="sub">Diga quanto há de verdade. O app passa a contar a partir daí,
        e a estimativa melhora.</p>
      <div class="preco-campos" style="margin-top:var(--e2)">
        <label class="preco-campo">
          <span class="rotulo">Tenho em casa</span>
          <input  id="dp-qtd" inputmode="decimal" placeholder="0">
        </label>
        <label class="preco-campo estreito">
          <span class="rotulo">Un.</span>
          <input  id="dp-un" value="${UI.esc(s.unidade)}" readonly>
        </label>
      </div>
      <button class="btn" id="dp-ok" style="margin-top:var(--e2)">
        Corrigir
      </button>
      <button class="btn btn-vazado" id="dp-zero" style="margin-top:var(--e2)">
        Acabou — não tenho mais
      </button>

      <p class="section-title">Histórico de entradas</p>
      <div class="lista-itens">
        ${Despensa.entradasDe(DB, itemId).slice(-6).reverse().map(e => {
          const loja = e.store_id ? DB.get('stores', e.store_id) : null;
          return `<div class="item-linha">
            <div class="item-corpo">
              <b>${Despensa.fmtQtd(e.qtd_canonica, e.unidade_base)}</b>
              <span class="sub">${this.dataBR(e.data)}${loja ? ' · ' + UI.esc(loja.nome) : ''}</span>
            </div>
            <span class="sub">${UI.fmt(e.preco_total)}</span>
          </div>`;
        }).join('') || '<p class="sub">Nenhuma entrada registrada.</p>'}
      </div>`);

    const corrigir = valor => {
      Despensa.corrigir(DB, itemId, valor, s.unidade);
      fechar();
      irPara('despensa');
      UI.toast('Corrigido. O app aprendeu com isso.');
    };
    document.querySelector('#dp-ok').addEventListener('click', () => {
      const v = Number(String(document.querySelector('#dp-qtd').value).replace(',', '.'));
      if (!isFinite(v) || v < 0) { UI.toast('Digite a quantidade'); return; }
      corrigir(v);
    });
    document.querySelector('#dp-zero').addEventListener('click', () => corrigir(0));
  },

  dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
  },

  ligar(tela) {
    for (const b of tela.querySelectorAll('[data-f]')) {
      b.addEventListener('click', () => { this.filtro = b.dataset.f; irPara('despensa'); });
    }
    for (const b of tela.querySelectorAll('[data-item]')) {
      b.addEventListener('click', () => this.abrirDetalhe(b.dataset.item));
    }
    for (const b of tela.querySelectorAll('[data-acao="importar"]')) {
      b.addEventListener('click', () => abrirImportacao());
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewDespensa };
