/* CESTA — Meus produtos: o que o app já sabe sobre o que você compra.

   POR QUE ESTA TELA EXISTE. Sem ela, o histórico de preços é invisível: a pessoa
   vê o veredito no corredor e não tem onde conferir de onde ele saiu, nem
   descobrir quanto costuma pagar por algo antes de sair de casa.

   É a tela que responde "quanto custa o arroz, mesmo?" — a pergunta que faz
   alguém abrir o app FORA do mercado, que é o que transforma um app de uso
   ocasional em um app que se consulta. */
'use strict';

const ViewProdutos = {

  busca: '',

  /* Junta tudo o que se sabe de um item: quantas vezes, quanto costuma custar,
     onde saiu mais barato, quando foi a última vez. */
  resumoDoItem(item) {
    const ref = Precos.referencia(DB, { item_id: item.id }, { janelaMeses: 12 });
    const cad = Precos.cadencia(DB, item.id);
    const obs = DB.all('price_obs').filter(o => o.item_id === item.id);
    return { item, ref, cad, vezes: obs.length };
  },

  render() {
    const itens = DB.all('items')
      .map(i => this.resumoDoItem(i))
      .filter(r => !this.busca || r.item.nome.toLowerCase().includes(this.busca.toLowerCase()))
      .sort((a, b) => b.vezes - a.vezes || a.item.nome.localeCompare(b.item.nome));

    const comHistorico = itens.filter(r => r.vezes > 0);

    if (!DB.all('items').length) {
      return `<h1 class="titulo">Meus produtos</h1>
        <p class="sub">Tudo o que você já comprou, e quanto costuma custar.</p>
        <div class="card"><div class="vazio">
          <b>Ainda não há produtos</b>
          Eles nascem sozinhos conforme você monta listas e registra preços.
          Importar uma nota fiscal preenche isto de uma vez.
        </div>
        <button class="btn btn-principal btn-largo btn-grande" data-acao="importar">
          Importar nota fiscal
        </button></div>`;
    }

    return `<h1 class="titulo">Meus produtos</h1>
      <p class="sub">${comHistorico.length} com histórico de preço · ${DB.all('items').length} no catálogo</p>

      <div class="card">
        <input class="campo" id="busca-prod" placeholder="Buscar produto"
               value="${UI.esc(this.busca)}" autocomplete="off" aria-label="Buscar produto">
      </div>

      ${itens.length ? `<div class="card lista-itens">
        ${itens.map(r => this.linha(r)).join('')}
      </div>` : `<div class="card"><div class="vazio"><b>Nada encontrado</b>
        Tente outro nome.</div></div>`}`;
  },

  linha({ item, ref, cad, vezes }) {
    const corredor = Catalogo.corredor(item.categoria);
    /* SEM HISTÓRICO, DIZ QUE NÃO TEM. Mostrar "R$ 0,00" seria um número falso
       apresentado como verdadeiro — o defeito que este app existe para não ter. */
    const preco = ref.n
      ? `<b class="valor">${UI.fmtBase(ref.mediana, ref.unidade || item.unidade)}</b>
         <span class="sub">${vezes} ${vezes === 1 ? 'registro' : 'registros'}</span>`
      : `<span class="selo s-slate">sem preço ainda</span>`;

    return `<button class="item-linha linha-clicavel" data-item="${item.id}">
      <span class="item-emoji">${corredor.icone}</span>
      <div class="item-corpo">
        <b>${UI.esc(item.nome)}</b>
        <span class="sub">${corredor.nome}${
          cad ? ` · compra a cada ${cad.intervalo} dias` : ''}${
          cad && cad.acabando ? ' · <b>talvez esteja acabando</b>' : ''}</span>
      </div>
      <div class="direita">${preco}</div>
    </button>`;
  },

  /* O detalhe do produto: a memória completa daquele item. É aqui que a pessoa
     confere de onde saiu o veredito que viu no corredor. */
  abrirDetalhe(itemId) {
    const item = DB.get('items', itemId);
    if (!item) return;
    const ref = Precos.referencia(DB, { item_id: item.id }, { janelaMeses: 12 });
    const cad = Precos.cadencia(DB, item.id);
    const serie = Precos.serieMensal(DB, { item_id: item.id }, { meses: 12 });
    const obs = DB.all('price_obs')
      .filter(o => o.item_id === item.id)
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, 12);

    const corredor = Catalogo.corredor(item.categoria);

    UI.folha(`
      <h2 class="titulo">${corredor.icone} ${UI.esc(item.nome)}</h2>
      <p class="sub">${corredor.nome}</p>

      ${ref.n ? `
        <div class="linha-resumo">
          <div>
            <span class="rotulo">Você costuma pagar</span>
            <b class="valor grande">${UI.fmtBase(ref.mediana, ref.unidade)}</b>
          </div>
          <div class="direita">
            <span class="rotulo">Melhor que já viu</span>
            <b class="valor">${UI.fmtBase(ref.melhorPreco, ref.unidade)}</b>
          </div>
        </div>
        <p class="sub">${ref.n} ${ref.n === 1 ? 'registro' : 'registros'} nos últimos 12 meses${
          ref.melhorLoja && DB.get('stores', ref.melhorLoja)
            ? ` · mais barato em <b>${UI.esc(DB.get('stores', ref.melhorLoja).nome)}</b>` : ''}</p>
      ` : `<div class="vazio" style="padding:var(--e4) 0">
        <b>Ainda sem preço registrado</b>
        Registre no Modo Mercado ou importe uma nota fiscal.
      </div>`}

      ${cad ? `<p class="secao">Ritmo de compra</p>
        <p class="sub">Você costuma comprar a cada <b>${cad.intervalo} dias</b>.
          A última foi há ${cad.diasDesde}.
          ${cad.acabando ? ' <b>Provavelmente está acabando.</b>' : ''}</p>` : ''}

      ${serie.length > 1 ? `<p class="secao">Mês a mês</p>
        <div class="mini-serie">
          ${serie.map(p => {
            const max = Math.max(...serie.map(x => x.mediana));
            const alt = max > 0 ? Math.max(6, (p.mediana / max) * 100) : 6;
            return `<div class="mini-barra" title="${p.mes}: ${UI.fmtBase(p.mediana, ref.unidade)}">
              <div style="height:${alt}%"></div>
              <span>${p.mes.slice(5)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

      ${obs.length ? `<p class="secao">Últimos preços</p>
        <div class="lista-itens">
          ${obs.map(o => {
            const loja = o.store_id ? DB.get('stores', o.store_id) : null;
            return `<div class="item-linha">
              <div class="item-corpo">
                <b>${UI.fmtBase(o.preco_base, o.unidade_base)}</b>
                <span class="sub">${this.dataBR(o.data)}${loja ? ' · ' + UI.esc(loja.nome) : ''}${
                  o.origem === 'nfce' ? ' · da nota fiscal' : ''}</span>
              </div>
              <span class="sub">${UI.fmt(o.preco_total)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

      <button class="btn btn-principal btn-largo btn-grande" id="prod-add" style="margin-top:var(--e4)">
        Adicionar à lista
      </button>`);

    document.querySelector('#prod-add').addEventListener('click', () => {
      const lista = DB.listaEmCurso() || DB.listasPlanejadas()[0] || DB.novaLista({});
      DB.addNaLista(lista.id, { item_id: item.id, qtd: item.qtd_habitual, unidade: item.unidade });
      document.querySelector('.folha-fundo').remove();
      UI.toast(`${item.nome} entrou na lista`);
      irPara('lista');
    });
  },

  dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}/${a}`;
  },

  ligar(tela) {
    const busca = tela.querySelector('#busca-prod');
    if (busca) {
      busca.addEventListener('input', () => {
        this.busca = busca.value;
        const foco = busca.selectionStart;
        irPara('produtos');
        const novo = document.querySelector('#busca-prod');
        if (novo) { novo.focus(); novo.setSelectionRange(foco, foco); }
      });
    }
    for (const b of tela.querySelectorAll('[data-item]')) {
      b.addEventListener('click', () => this.abrirDetalhe(b.dataset.item));
    }
    for (const b of tela.querySelectorAll('[data-acao="importar"]')) {
      b.addEventListener('click', () => abrirImportacao());
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewProdutos };
