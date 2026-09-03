/* CESTA — a tela de Lista.

   O que acontece em casa, antes de sair: montar a lista rápido, com o catálogo
   ajudando, e sair sabendo mais ou menos quanto vai custar. */
'use strict';

const ViewLista = {

  /* Estimativa da lista pela mediana de cada item. É o número que a pessoa vê
     ANTES de sair de casa, e ele só existe onde há histórico — item sem
     referência entra como null e é contado à parte, nunca como zero: somar zero
     faria a estimativa parecer completa quando ela não é. */
  estimar(li) {
    const ref = Precos.referencia(DB, { product_id: li.product_id, item_id: li.item_id });
    if (!ref.n || ref.mediana == null) return null;
    const c = Precos.canonizar(li.qtd, li.unidade);
    if (!c || ref.unidade !== c.unidade) return null;
    return ref.mediana * c.qtd;
  },

  render() {
    const emCurso = DB.listaEmCurso();
    const planejadas = DB.listasPlanejadas();

    if (emCurso) {
      return `${this.cabecalho()}
        <div class="card destaque-compra">
          <p class="sub">Compra em andamento</p>
          <h2 class="sheet-title">${UI.esc(emCurso.nome)}</h2>
          <button class="btn" data-acao="ir-mercado" style="margin-top:var(--e3)">
            Voltar ao Modo Mercado
          </button>
        </div>
        ${this.corpoDaLista(emCurso)}`;
    }

    const lista = planejadas[0];
    if (!lista) {
      return `${this.cabecalho()}
        <div class="card">
          <div class="ui-empty">
            <b>Nenhuma lista ainda</b>
            Monte a lista da próxima compra. Dá para despejar tudo de uma vez,
            sem tirar a mão do teclado.
          </div>
          <button class="btn" data-acao="nova-lista">Criar lista</button>
        </div>`;
    }

    return `${this.cabecalho()}${this.corpoDaLista(lista)}`;
  },

  cabecalho() {
    return `<h1 class="titulo">Sua lista</h1>
      <p class="sub">Monte antes de sair. No mercado, é só ir preenchendo os preços.</p>`;
  },

  corpoDaLista(lista) {
    const itens = DB.itensDaLista(lista.id);
    const t = DB.totalDoCarrinho(lista.id, li => this.estimar(li));

    /* A estimativa se apresenta como estimativa. "≈" e "com base no seu
       histórico" não são enfeite: sem isso a pessoa cobra do app um número que
       ele nunca prometeu, e passa a não confiar nos que ele prometeu. */
    const semBase = itens.filter(li => !li.comprado && !li.nao_tinha && this.estimar(li) == null).length;
    const resumo = t.itens
      ? `<div class="kpi">
           <div><span class="kpi-label">Estimado</span>
             <b class="kpi-value">${t.total > 0 ? '≈ ' + UI.fmt(t.total) : '—'}</b></div>
           <div class="direita"><span class="kpi-label">Itens</span><b class="tx-amount">${t.itens}</b></div>
         </div>
         <p class="sub">${t.total > 0 ? 'Com base no seu histórico.' : 'Sem histórico ainda para estimar.'}
           ${semBase ? ` ${semBase} ${semBase === 1 ? 'item ainda não tem' : 'itens ainda não têm'} referência.` : ''}</p>`
      : '';

    return `
      <div class="card">
        <div class="add-linha">
          <input  id="add-item" placeholder="O que falta? Ex.: arroz" autocomplete="off"
                 enterkeyhint="done" aria-label="Adicionar item">
          <button class="btn add-btn" data-acao="add" aria-label="Adicionar">
            <span data-ico="mais"></span>
          </button>
        </div>
        <div id="sugestoes" class="ui-list" hidden></div>
        ${resumo}
      </div>

      ${itens.length ? `<div class="card lista-itens">${itens.map(li => this.linha(li)).join('')}</div>` : `
        <div class="card"><div class="ui-empty">
          <b>Lista vazia</b>
          Digite o primeiro item acima. O campo continua em foco — dá para
          despejar a lista inteira de uma vez.
        </div></div>`}

      ${itens.length ? `
        <button class="btn" data-acao="ir-mercado" style="margin-top:var(--e4)">
          Estou no mercado
        </button>` : ''}

      <button class="btn ghost" data-acao="mais-por-menos" style="margin-top:var(--e3)">
        <span data-ico="balanca"></span> Mais por Menos
      </button>`;
  },

  linha(li) {
    const item = DB.get('items', li.item_id);
    const nome = item ? item.nome : '(item removido)';
    const est = this.estimar(li);
    return `<div class="tx ${li.comprado ? 'comprado' : ''}" data-li="${li.id}">
      <button class="item-marca" data-acao="alternar" data-li="${li.id}"
              aria-label="${li.comprado ? 'Desmarcar' : 'Marcar como comprado'} ${UI.esc(nome)}">
        <span data-ico="${li.comprado ? 'ok' : ''}"></span>
      </button>
      <div class="tx-info">
        <b>${UI.esc(nome)}</b>
        <span class="sub">${li.qtd} ${UI.esc(li.unidade)}${est ? ' · ≈ ' + UI.fmt(est) : ''}</span>
      </div>
      <button class="item-remover" data-acao="remover" data-li="${li.id}" aria-label="Remover ${UI.esc(nome)}">×</button>
    </div>`;
  },

  /* ------------------------------------------------------- eventos --- */

  ligar(tela, recarregar) {
    const campo = tela.querySelector('#add-item');
    const caixa = tela.querySelector('#sugestoes');

    const adicionar = nome => {
      const texto = String(nome || (campo && campo.value) || '').trim();
      if (!texto) return;
      let lista = DB.listaEmCurso() || DB.listasPlanejadas()[0];
      if (!lista) lista = DB.novaLista({});
      /* O catálogo dá um palpite de corredor e unidade. Palpite entra no
         cadastro, nunca no preço: errar a unidade aqui envenenaria a mediana
         daquele produto para sempre. */
      const palpite = Catalogo.palpitar(texto);
      const item = DB.itemPorNome(texto, palpite ? {
        categoria: palpite.corredor, unidade: palpite.unidade, qtd_habitual: palpite.qtd,
      } : {});
      DB.addNaLista(lista.id, { item_id: item.id, qtd: item.qtd_habitual, unidade: item.unidade });
      recarregar();
      /* O FOCO VOLTA PARA O CAMPO. É o que permite despejar a lista inteira sem
         tirar a mão do teclado — e é a diferença entre montar a lista em dois
         minutos e desistir no quinto item. */
      const novo = document.querySelector('#add-item');
      if (novo) { novo.value = ''; novo.focus(); }
    };

    if (campo) {
      campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
      campo.addEventListener('input', () => {
        const t = campo.value.trim();
        if (!caixa) return;
        if (!t) { caixa.hidden = true; caixa.innerHTML = ''; return; }
        const achados = DB.buscarItens(t, 6);
        if (!achados.length) { caixa.hidden = true; caixa.innerHTML = ''; return; }
        caixa.hidden = false;
        caixa.innerHTML = achados.map(i =>
          `<button class="ui-opt" data-nome="${UI.esc(i.nome)}">${UI.esc(i.nome)}
             <span class="sub">${i.qtd_habitual} ${UI.esc(i.unidade)}</span></button>`).join('');
        for (const b of caixa.querySelectorAll('.ui-opt')) {
          b.addEventListener('click', () => adicionar(b.dataset.nome));
        }
      });
    }

    for (const b of tela.querySelectorAll('[data-acao]')) {
      b.addEventListener('click', () => {
        const acao = b.dataset.acao;
        const li = b.dataset.li ? DB.get('list_items', b.dataset.li) : null;

        if (acao === 'add') adicionar();
        else if (acao === 'nova-lista') { DB.novaLista({}); recarregar(); }
        else if (acao === 'alternar' && li) { DB.upsert('list_items', { id: li.id, comprado: !li.comprado }); recarregar(); }
        else if (acao === 'remover' && li) { DB.remove('list_items', li.id); recarregar(); }
        else if (acao === 'ir-mercado') abrirMercado();
        else if (acao === 'mais-por-menos') abrirMaisPorMenos();
      });
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewLista };
