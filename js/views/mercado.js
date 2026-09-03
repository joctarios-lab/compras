/* CESTA — o Modo Mercado.

   É AQUI QUE O APP SE GANHA OU SE PERDE. Cinco regras que valem mais que
   qualquer detalhe de layout desta tela:

     1. NENHUM DIÁLOGO. Confirmar, salvar, escolher — cada um desses é fricção
        paga quarenta vezes por compra. Ações são reversíveis por desfazer, não
        prevenidas por pergunta.
     2. NENHUM SPINNER, NENHUMA REDE. Os dados são locais. Se algo carrega, o
        app está errado — e essa é a vantagem competitiva inteira.
     3. O DIAGNÓSTICO APARECE ENQUANTO SE DIGITA. Não depois de confirmar.
     4. GRAVA A CADA TECLA. O app pode morrer no meio do mercado (bateria, aba
        descartada pelo iOS). Perder um carrinho de 40 itens é imperdoável.
     5. A COR NUNCA INFORMA SOZINHA. Palavra e número junto do selo, sempre. */
'use strict';

const Mercado = {
  listaId: null,
  focoId: null,     // qual item está com o campo de preço aberto
  _wake: null,

  /* ---------------------------------------------------------- abrir --- */

  async abrir(lista) {
    this.listaId = lista.id;
    if (lista.status !== 'em_curso') {
      DB.upsert('lists', { id: lista.id, status: 'em_curso' });
    }
    // Tela acesa entre a gôndola e o carrinho. Falha em silêncio onde não há
    // suporte: é conveniência, e nenhum fluxo depende dela.
    this._wake = await UI.manterAcesa();
    document.body.classList.add('modo-mercado');
  },

  fechar() {
    document.body.classList.remove('modo-mercado');
    if (this._wake && this._wake.release) { try { this._wake.release(); } catch (_) {} }
    this._wake = null;
    this.focoId = null;
  },

  /* --------------------------------------------------------- render --- */

  render() {
    const lista = DB.get('lists', this.listaId);
    if (!lista) return '<div class="ui-empty"><b>Compra não encontrada</b></div>';

    const itens = DB.itensDaLista(lista.id);
    /* A ORDEM É A DO MERCADO: hortifrúti na entrada, limpeza no fundo. É o
       ganho de tempo mais concreto que uma lista pode dar, e sai de graça do
       corredor que cada item já tem. */
    const pendentes = itens.filter(li => !li.comprado && !li.nao_tinha).sort((a, b) => {
      const ia = DB.get('items', a.item_id), ib = DB.get('items', b.item_id);
      const oa = Catalogo.corredor(ia ? ia.categoria : 'outros').ordem;
      const ob = Catalogo.corredor(ib ? ib.categoria : 'outros').ordem;
      return oa - ob || String(ia && ia.nome).localeCompare(String(ib && ib.nome));
    });
    const feitos = itens.filter(li => li.comprado);
    const t = DB.totalDoCarrinho(lista.id, li => ViewLista.estimar(li));
    const loja = lista.store_id ? DB.get('stores', lista.store_id) : null;

    return `
      <div class="mercado-topo" role="status" aria-live="polite">
        <div class="mercado-total">
          <span class="rotulo">No carrinho</span>
          <b class="valor grande">${UI.fmt(t.firme)}</b>
          ${t.estimado > 0 ? `<span class="sub">+ ${t.aEstimar} ${t.aEstimar === 1 ? 'item' : 'itens'} ≈ ${UI.fmt(t.estimado)}</span>` : ''}
        </div>
        <div class="mercado-contagem">
          <b>${t.comprados}</b><span class="sub">de ${t.itens}</span>
        </div>
      </div>
      ${this.barraOrcamento(lista, t)}

      ${pendentes.length ? `<div class="card lista-mercado">
        ${this.comCorredores(pendentes)}
      </div>` : `<div class="card"><div class="ui-empty">
        <b>Tudo pego</b>
        Toque em “Finalizar compra” para conferir o total no caixa.
      </div></div>`}

      <div class="mercado-acoes">
        <button class="btn btn-vazado" data-acao="add-aqui">
          <span data-ico="mais"></span> Item que não estava na lista
        </button>
        <button class="btn btn-vazado" data-acao="mais-por-menos">
          <span data-ico="balanca"></span> Mais por Menos
        </button>
        <button class="btn" data-acao="finalizar">Finalizar compra</button>
      </div>

      ${feitos.length ? `<p class="section-title">Já no carrinho</p>
        <div class="card lista-mercado feitos">${feitos.map(li => this.linhaFeita(li)).join('')}</div>` : ''}

      ${loja ? `<p class="sub" style="margin-top:var(--e4)">Comprando em ${UI.esc(loja.nome)}</p>` : ''}`;
  },

  /* O orçamento fala em PALAVRAS, não só em cor: no corredor ninguém está
     olhando para a tela quando ela muda de tom. */
  barraOrcamento(lista, t) {
    if (!lista.orcamento) return '';
    const usado = t.total / lista.orcamento;
    const estourou = t.total > lista.orcamento;
    const perto = !estourou && usado >= 0.85;
    const selo = estourou ? 'b-red' : perto ? 'b-amber' : 'b-green';
    const texto = estourou
      ? `Passou ${UI.fmt(t.total - lista.orcamento)} do orçamento`
      : perto ? `Faltam ${UI.fmt(lista.orcamento - t.total)} para o limite`
              : `${UI.fmt(lista.orcamento - t.total)} disponíveis`;
    return `<div class="orcamento">
      <div class="orcamento-trilho"><div class="orcamento-barra ${selo}" style="width:${Math.min(100, usado * 100).toFixed(1)}%"></div></div>
      <span class="badge ${selo}">${texto}</span>
    </div>`;
  },

  /* Insere o nome do corredor quando ele muda. Só quando muda: repetir o
     cabeçalho a cada item viraria ruído numa lista de quarenta. */
  comCorredores(pendentes) {
    let atual = null;
    return pendentes.map(li => {
      const item = DB.get('items', li.item_id);
      const c = Catalogo.corredor(item ? item.categoria : 'outros');
      const cabecalho = c.id !== atual ? `<p class="corredor-titulo">${c.icone} ${c.nome}</p>` : '';
      atual = c.id;
      return cabecalho + this.linha(li);
    }).join('');
  },

  linha(li) {
    const item = DB.get('items', li.item_id);
    const nome = item ? item.nome : '(item removido)';
    const aberto = this.focoId === li.id;

    return `<div class="mercado-linha ${aberto ? 'aberta' : ''}" data-li="${li.id}">
      <button class="mercado-toque" data-acao="focar" data-li="${li.id}">
        <div class="mercado-nome">
          <b>${UI.esc(nome)}</b>
          <span class="sub">${li.qtd} ${UI.esc(li.unidade)}</span>
        </div>
        <span class="mercado-seta" data-ico="${aberto ? '' : 'mais'}"></span>
      </button>
      ${aberto ? this.painelDePreco(li, nome) : ''}
    </div>`;
  },

  /* O painel de preço: campo, quantidade e o diagnóstico ao vivo.
     Fica no fundo da linha, e a linha em foco sobe para a zona do polegar. */
  painelDePreco(li, nome) {
    return `<div class="preco-painel">
      <div class="preco-campos">
        <label class="preco-campo">
          <span class="rotulo">Preço pago</span>
          <input class="campo-preco" id="preco-${li.id}" inputmode="decimal"
                 enterkeyhint="done" placeholder="R$ 0,00" aria-label="Preço de ${UI.esc(nome)}">
        </label>
        <label class="preco-campo estreito">
          <span class="rotulo">Qtd</span>
          <input class="campo-qtd" id="qtd-${li.id}" inputmode="decimal"
                 value="${li.qtd}" aria-label="Quantidade">
        </label>
        <label class="preco-campo estreito">
          <span class="rotulo">Un.</span>
          <select class="campo-un" id="un-${li.id}" aria-label="Unidade">
            ${['un', 'kg', 'g', 'l', 'ml'].map(u =>
              `<option value="${u}" ${u === String(li.unidade).toLowerCase() ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="diag-area" id="diag-${li.id}" role="status" aria-live="polite">
        ${this.htmlDoDiagnostico(null)}
      </div>

      <div class="preco-botoes">
        <button class="btn btn-vazado" data-acao="nao-tinha" data-li="${li.id}">Não tinha</button>
        <button class="btn btn-grande" data-acao="confirmar" data-li="${li.id}">
          <span data-ico="ok"></span> No carrinho
        </button>
      </div>
    </div>`;
  },

  /* O DIAGNÓSTICO. Sempre com a base à vista: quem não pode auditar o número
     não confia nele na segunda vez que ele o surpreender. */
  htmlDoDiagnostico(d) {
    if (!d) return `<div class="diag b-slate"><span>Digite o preço</span></div>`;

    if (!d.base) {
      return `<div class="diag b-slate">
          <span>⚪ ${UI.esc(d.rotulo)}</span>
          ${d.precoBase ? `<span class="pct">${UI.fmtBase(d.precoBase, d.unidade)}</span>` : ''}
        </div>
        ${d.explicacao ? `<p class="diag-nota">${UI.esc(d.explicacao)}</p>` : ''}`;
    }

    const emoji = d.badge === 'green' ? '🟢' : d.selo === 'red' ? '🔴' : '🟡';
    const sinal = d.acima ? '+' : '−';
    const confianca = d.confianca === 'boa' ? '' :
      d.confianca === 'media' ? ' · pouco histórico' : ' · só 1 registro antes';
    const escopo = d.escopo === 'item' ? ' (comparado com o item em geral)' : '';

    const loja = d.melhorLoja ? DB.get('stores', d.melhorLoja) : null;
    const dica = d.melhorPreco != null && d.selo === 'red'
      ? `<p class="diag-nota">Melhor preço já visto: <b>${UI.fmtBase(d.melhorPreco, d.unidade)}</b>${
          loja ? ' em ' + UI.esc(loja.nome) : ''}${d.melhorData ? ', em ' + this.dataCurta(d.melhorData) : ''}.</p>`
      : '';

    return `<div class="diag b-${d.selo}">
        <span>${emoji} ${UI.esc(d.rotulo)}</span>
        <span class="pct">${sinal}${d.pct}%</span>
      </div>
      <p class="diag-nota">${UI.fmtBase(d.precoBase, d.unidade)} · mediana ${UI.fmtBase(d.mediana, d.unidade)}
        (${d.n} ${d.n === 1 ? 'registro' : 'registros'}${confianca})${escopo}</p>
      ${dica}`;
  },

  dataCurta(iso) {
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}`;
  },

  linhaFeita(li) {
    const item = DB.get('items', li.item_id);
    return `<div class="mercado-linha feita">
      <div class="mercado-nome">
        <b>${UI.esc(item ? item.nome : '—')}</b>
        <span class="sub">${li.qtd} ${UI.esc(li.unidade)}</span>
      </div>
      <div class="direita">
        ${li.pegou_por ? `<span class="pegou-por">${UI.esc(li.pegou_por)}</span>` : ''}
        <b class="valor">${li.preco_total != null ? UI.fmt(li.preco_total) : '—'}</b>
        <button class="btn-desfazer" data-acao="desfazer" data-li="${li.id}">desfazer</button>
      </div>
    </div>`;
  },

  /* -------------------------------------------------------- eventos --- */

  ligar(tela, recarregar) {
    for (const b of tela.querySelectorAll('[data-acao]')) {
      b.addEventListener('click', () => this.acao(b.dataset.acao, b.dataset.li, recarregar));
    }

    if (!this.focoId) return;
    const li = DB.get('list_items', this.focoId);
    if (!li) return;

    const campoPreco = tela.querySelector('#preco-' + li.id);
    const campoQtd = tela.querySelector('#qtd-' + li.id);
    const campoUn = tela.querySelector('#un-' + li.id);
    const area = tela.querySelector('#diag-' + li.id);
    if (!campoPreco) return;

    const aplicarMascara = UI.mascaraMoeda(campoPreco);

    /* AVALIA A CADA TECLA. Sem confirmar, sem botão, sem esperar. É a diferença
       entre um app que responde e um app que se consulta. */
    const avaliar = () => {
      aplicarMascara();
      const preco = UI.lerMoeda(campoPreco);
      const qtd = Number(String(campoQtd.value).replace(',', '.')) || 0;
      const unidade = campoUn.value;
      if (!preco) { area.innerHTML = this.htmlDoDiagnostico(null); return; }
      const d = Precos.avaliar(DB, {
        product_id: li.product_id, item_id: li.item_id, preco, qtd, unidade,
      });
      area.innerHTML = this.htmlDoDiagnostico(d);
      pintarIcones(area);
    };

    campoPreco.addEventListener('input', avaliar);
    campoQtd.addEventListener('input', avaliar);
    campoUn.addEventListener('change', avaliar);
    campoPreco.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.confirmar(li.id, recarregar); }
    });
    campoPreco.focus();
  },

  acao(acao, liId, recarregar) {
    if (acao === 'focar') {
      // Tocar de novo na linha aberta fecha: o mesmo toque desfaz, sem botão de
      // cancelar e sem diálogo.
      this.focoId = this.focoId === liId ? null : liId;
      recarregar();
    } else if (acao === 'confirmar') {
      this.confirmar(liId, recarregar);
    } else if (acao === 'nao-tinha') {
      /* "Não tinha" É DADO, não lixo: alimenta o que esta loja costuma faltar. */
      DB.upsert('list_items', { id: liId, nao_tinha: true, comprado: false });
      this.focoId = null;
      recarregar();
      UI.toast('Marcado como indisponível nesta loja');
    } else if (acao === 'desfazer') {
      const li = DB.get('list_items', liId);
      if (li && li.obs_id) DB.remove('price_obs', li.obs_id);
      DB.upsert('list_items', { id: liId, comprado: false, preco_total: null, obs_id: null });
      recarregar();
    } else if (acao === 'add-aqui') {
      this.adicionarAqui(recarregar);
    } else if (acao === 'mais-por-menos') {
      abrirMaisPorMenos();
    } else if (acao === 'finalizar') {
      abrirFechamento(this.listaId);
    }
  },

  /* Grava a observação de preço e marca o item. A observação é a FONTE ÚNICA:
     o diagnóstico não é gravado junto — ele é recalculado sempre que a tela
     precisar dele. */
  confirmar(liId, recarregar) {
    const li = DB.get('list_items', liId);
    if (!li) return;
    const campoPreco = document.querySelector('#preco-' + liId);
    const campoQtd = document.querySelector('#qtd-' + liId);
    const campoUn = document.querySelector('#un-' + liId);
    const preco = UI.lerMoeda(campoPreco);
    if (!preco) { UI.toast('Digite o preço antes de guardar'); return; }

    const qtd = Number(String(campoQtd.value).replace(',', '.')) || 1;
    const unidade = campoUn.value;
    const lista = DB.get('lists', this.listaId);

    const obs = Precos.registrar(DB, {
      product_id: li.product_id,
      item_id: li.item_id,
      store_id: lista ? lista.store_id : null,
      data: DB.hojeISO(),
      preco_total: preco,
      qtd, unidade,
      origem: 'digitado',
    });

    DB.upsert('list_items', {
      id: liId, comprado: true, nao_tinha: false,
      preco_total: preco, qtd, unidade,
      obs_id: obs ? obs.id : null,
      /* QUEM PEGOU. Numa lista compartilhada, é o que impede as duas pessoas
         no mesmo mercado de pegarem a mesma coisa — e é o motivo prático de
         compartilhar a lista, mais que ver a lista igual. */
      pegou_por: Sync.temFamilia() ? Sync.meuNome() : null,
    });

    /* PULA PARA O PRÓXIMO PENDENTE. Sem isso a pessoa precisa procurar onde
       tocar depois de cada item — quarenta vezes por compra. */
    const pendentes = DB.itensDaLista(this.listaId).filter(x => !x.comprado && !x.nao_tinha);
    this.focoId = pendentes.length ? pendentes[0].id : null;
    recarregar();
  },

  adicionarAqui(recarregar) {
    const fechar = UI.folha(`
      <h2 class="titulo">Item fora da lista</h2>
      <p class="sub">Entra na compra e no seu catálogo.</p>
      <input  id="novo-aqui" placeholder="Ex.: azeite" enterkeyhint="done"
             autocomplete="off" style="margin-top:var(--e3)">
      <button class="btn" id="ok-aqui" style="margin-top:var(--e3)">Adicionar</button>`);
    const campo = document.querySelector('#novo-aqui');
    const confirmar = () => {
      const nome = String(campo.value || '').trim();
      if (!nome) return;
      const item = DB.itemPorNome(nome);
      const novo = DB.addNaLista(this.listaId, { item_id: item.id, qtd: item.qtd_habitual, unidade: item.unidade });
      fechar();
      this.focoId = novo.id;   // já abre o campo de preço: era o que a pessoa queria
      recarregar();
    };
    document.querySelector('#ok-aqui').addEventListener('click', confirmar);
    campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } });
    campo.focus();
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Mercado };
