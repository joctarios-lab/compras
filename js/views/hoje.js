/* CESTA — HOJE: a página inicial.

   É a única tela que a pessoa abre SEM uma tarefa em mente, e por isso é a que
   define se o app é um assistente ou um formulário. Ela responde uma pergunta
   só: "o que eu preciso saber agora?".

   A ordem dos blocos não é estética — é a ordem em que as coisas importam para
   quem está com o mês correndo. */
'use strict';

const ViewHoje = {

  render() {
    const cfg = DB.cfg() || {};
    const nome = Sync.temFamilia() ? (Sync.cfg.nome || '') : '';
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

    return `
      <div class="hoje-topo">
        <h1 class="titulo">${saudacao}${nome ? ', ' + UI.esc(nome.split(' ')[0]) : ''}</h1>
        <p class="sub">${this.resumoDaCasa()}</p>
      </div>

      ${this.blocoProximaCompra()}
      ${this.blocoConselhos()}
      ${this.blocoAcabando()}
      ${this.blocoMes()}
      ${this.blocoAtalhos()}`;
  },

  resumoDaCasa() {
    const obs = DB.all('price_obs').length;
    if (!obs) return 'Vamos começar a acompanhar as compras da casa.';
    const produtos = DB.all('items').length;
    return `${produtos} produtos acompanhados · ${obs} preços registrados`;
  },

  /* ------------------------------------------------- a próxima compra --- */

  /* Primeiro bloco porque é a única coisa da tela com DATA. O resto pode ser
     visto amanhã; uma compra marcada para sábado, não. */
  blocoProximaCompra() {
    const plano = DB.proximoPlano();

    if (!plano) {
      return `<div class="card destaque-compra">
        <p class="section-title" style="margin-top:0">Próxima compra</p>
        <div class="ui-empty" style="padding:var(--e4) 0">
          <b>Nenhuma compra marcada</b>
          Marque o dia do rancho e o app monta a lista sozinho, com o que deve
          faltar até lá.
        </div>
        <button class="btn" data-acao="novo-plano">
          Marcar uma compra
        </button>
      </div>`;
    }

    const dias = DB.diasAte(plano.data);
    const ciclo = CICLOS[plano.ciclo] || CICLOS.mensal;
    const itens = plano.list_id ? DB.itensDaLista(plano.list_id).length : 0;
    const custo = plano.list_id ? Planejar.custoPrevisto(DB, plano.list_id) : { previsto: 0, semBase: 0 };
    const sugestoes = Planejar.sugerirPara(DB, plano).length;
    const loja = plano.store_id ? DB.get('stores', plano.store_id) : null;

    const quando = dias < 0 ? `atrasada há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
      : dias === 0 ? 'é hoje'
      : dias === 1 ? 'é amanhã'
      : `em ${dias} dias`;

    return `<div class="card destaque-compra">
      <p class="section-title" style="margin-top:0">Próxima compra</p>
      <div class="plano-cabeca">
        <span class="plano-ico">${ciclo.icone}</span>
        <div>
          <b class="plano-nome">${UI.esc(plano.nome)}</b>
          <span class="sub">${this.dataBR(plano.data)} · ${quando}${loja ? ' · ' + UI.esc(loja.nome) : ''}</span>
        </div>
      </div>

      <div class="linha-resumo">
        <div>
          <span class="rotulo">Previsto</span>
          <b class="valor grande">${custo.previsto > 0 ? '≈ ' + UI.fmt(custo.previsto) : '—'}</b>
        </div>
        <div class="direita">
          <span class="rotulo">Itens</span>
          <b class="valor">${itens}</b>
        </div>
      </div>

      ${plano.orcamento ? this.barraDoPlano(custo.previsto, plano.orcamento) : ''}
      ${custo.semBase ? `<p class="sub">${custo.semBase} ${custo.semBase === 1
        ? 'item ainda sem histórico de preço' : 'itens ainda sem histórico de preço'}.</p>` : ''}

      ${sugestoes ? `<button class="btn" data-acao="revisar" data-plano="${plano.id}" style="margin-top:var(--e3)">
        Revisar ${sugestoes} ${sugestoes === 1 ? 'sugestão' : 'sugestões'}
      </button>` : ''}
      <button class="btn ${sugestoes ? 'btn-vazado' : ''}" data-acao="ir-mercado" style="margin-top:var(--e2)">
        ${dias <= 0 ? 'Estou no mercado' : 'Ver a lista'}
      </button>
    </div>`;
  },

  barraDoPlano(previsto, orcamento) {
    const uso = orcamento > 0 ? previsto / orcamento : 0;
    const estoura = previsto > orcamento;
    const selo = estoura ? 'b-red' : uso >= 0.9 ? 'b-amber' : 'b-green';
    return `<div class="orcamento">
      <div class="orcamento-trilho"><div class="orcamento-barra ${selo}" style="width:${Math.min(100, uso * 100).toFixed(1)}%"></div></div>
      <span class="badge ${selo}">${estoura
        ? `${UI.fmt(previsto - orcamento)} acima do planejado`
        : `${UI.fmt(orcamento - previsto)} dentro do planejado`}</span>
    </div>`;
  },

  /* ---------------------------------------------------- o conselheiro --- */

  /* No máximo três, e só o que tem ação. Um painel que avisa de tudo não avisa
     de nada: a pessoa aprende a passar os olhos, e o aviso importante morre
     junto com os outros. */
  blocoConselhos() {
    const conselhos = Planejar.conselhos(DB, { limite: 3 });
    if (!conselhos.length) return '';
    return `<div class="conselhos">
      ${conselhos.map(c => `
        <button class="conselho s-${c.selo}" data-acao="conselho" data-alvo="${c.acao}">
          <span class="conselho-ico" data-ico="${c.ico}"></span>
          <div>
            <b>${UI.esc(c.titulo)}</b>
            <span>${c.texto}</span>
          </div>
        </button>`).join('')}
    </div>`;
  },

  /* ------------------------------------------------- o que está acabando --- */

  /* O bloco que faz o app ANTECIPAR em vez de reagir. Cada linha diz POR QUE
     acha isso — a estimativa vai errar às vezes, por construção, e um número
     que não se pode auditar perde a confiança na primeira vez que erra. */
  blocoAcabando() {
    const plano = DB.proximoPlano();
    const janela = plano ? Math.max(3, DB.diasAte(plano.data)) : 7;
    const lista = Despensa.acabando(DB, { ateDias: janela }).slice(0, 6);

    if (!lista.length) {
      const temBase = DB.all('price_obs').length >= 4;
      return `<div class="card">
        <p class="section-title" style="margin-top:0">Está acabando</p>
        <div class="ui-empty" style="padding:var(--e4) 0">
          <b>${temBase ? 'Nada acabando por enquanto' : 'Ainda aprendendo o seu ritmo'}</b>
          ${temBase
            ? 'O app avisa aqui quando algum item se aproximar do fim.'
            : 'Depois de duas compras do mesmo item, o app começa a prever quando ele vai acabar.'}
        </div>
      </div>`;
    }

    return `<div class="card">
      <p class="section-title" style="margin-top:0">Está acabando</p>
      <p class="sub">Estimado pelo seu ritmo de compra${plano ? `, até a compra de ${this.dataBR(plano.data)}` : ''}.</p>
      <div class="lista-itens">
        ${lista.map(s => this.linhaAcabando(s)).join('')}
      </div>
      <button class="btn btn-vazado" data-acao="por-na-lista" style="margin-top:var(--e3)">
        Pôr todos na lista
      </button>
    </div>`;
  },

  linhaAcabando(s) {
    const corredor = Catalogo.corredor(s.item.categoria);
    const quando = s.motivo === 'saldo'
      ? (s.diasParaAcabar <= 0 ? 'deve ter acabado' : `~${s.diasParaAcabar} dias`)
      : 'passou do ritmo';
    const selo = s.motivo === 'saldo' && s.diasParaAcabar <= 0 ? 'b-red' : 'b-amber';
    return `<div class="item-linha">
      <span class="item-emoji">${corredor.icone}</span>
      <div class="item-corpo">
        <b>${UI.esc(s.item.nome)}</b>
        <span class="sub">${UI.esc(s.explicacao)}</span>
      </div>
      <div class="direita">
        <span class="badge ${selo}">${quando}</span>
        <button class="btn-mini" data-acao="add-item" data-item="${s.item_id}">+ lista</button>
      </div>
    </div>`;
  },

  /* --------------------------------------------------------- o mês --- */

  blocoMes() {
    const p = Planejar.projecaoDoMes(DB);
    if (!p.gasto && !p.planejado) return '';

    const selo = p.situacao === 'estoura' ? 'b-red'
      : p.situacao === 'atencao' ? 'b-amber'
      : p.situacao === 'tranquilo' ? 'b-green' : 'b-slate';

    return `<div class="card">
      <p class="section-title" style="margin-top:0">O mês até agora</p>
      <div class="linha-resumo">
        <div>
          <span class="rotulo">Já gastou</span>
          <b class="valor grande">${UI.fmt(p.gasto)}</b>
        </div>
        <div class="direita">
          <span class="rotulo">Deve fechar em</span>
          <b class="valor">${UI.fmt(p.projetado)}</b>
        </div>
      </div>

      ${p.orcamento != null ? `
        <div class="orcamento">
          <div class="orcamento-trilho">
            <div class="orcamento-barra ${selo}" style="width:${Math.min(100, (p.projetado / p.orcamento) * 100).toFixed(1)}%"></div>
          </div>
          <span class="badge ${selo}">${p.estoura
            ? `${UI.fmt(Math.abs(p.sobra))} acima do planejado`
            : `${UI.fmt(p.sobra)} de folga`}</span>
        </div>
        <p class="sub">A projeção soma o que já saiu, as compras marcadas e o
          ritmo do dia a dia nos ${p.faltam} dias que faltam.</p>
      ` : `
        <p class="sub">Sem orçamento definido, o app não opina sobre o valor —
          só mostra o que aconteceu.</p>
        <button class="btn btn-vazado" data-acao="definir-orcamento" style="margin-top:var(--e2)">
          Definir orçamento do mês
        </button>
      `}
    </div>`;
  },

  /* ------------------------------------------------------- atalhos --- */

  blocoAtalhos() {
    return `<div class="atalhos">
      <button class="atalho" data-acao="compra-rapida">
        <span data-ico="carrinho"></span><b>Comprei agora</b>
        <span class="sub">registrar sem lista</span>
      </button>
      <button class="atalho" data-acao="mais-por-menos">
        <span data-ico="balanca"></span><b>Mais por Menos</b>
        <span class="sub">qual embalagem compensa</span>
      </button>
      <button class="atalho" data-acao="importar">
        <span data-ico="etiqueta"></span><b>Importar nota</b>
        <span class="sub">encher o histórico</span>
      </button>
    </div>`;
  },

  dataBR(iso) {
    if (!iso) return '';
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}`;
  },

  /* ------------------------------------------------------- eventos --- */

  ligar(tela) {
    const recarregar = () => irPara('hoje');

    for (const b of tela.querySelectorAll('[data-acao]')) {
      b.addEventListener('click', () => {
        const acao = b.dataset.acao;

        if (acao === 'novo-plano') abrirNovoPlano();
        else if (acao === 'revisar') abrirRevisaoDeSugestoes(b.dataset.plano);
        else if (acao === 'ir-mercado') {
          const plano = DB.proximoPlano();
          if (plano && DB.diasAte(plano.data) <= 0) abrirMercado();
          else irPara('planejar');
        }
        else if (acao === 'add-item') {
          const plano = DB.proximoPlano();
          const lista = plano && plano.list_id ? plano.list_id
            : (DB.listaEmCurso() || DB.listasPlanejadas()[0] || DB.novaLista({})).id;
          const item = DB.get('items', b.dataset.item);
          DB.addNaLista(lista, { item_id: item.id, qtd: item.qtd_habitual || 1, unidade: item.unidade || 'un' });
          UI.toast(`${item.nome} entrou na lista`);
          recarregar();
        }
        else if (acao === 'por-na-lista') {
          const plano = DB.proximoPlano();
          const listaId = plano && plano.list_id ? plano.list_id
            : (DB.listaEmCurso() || DB.listasPlanejadas()[0] || DB.novaLista({})).id;
          const janela = plano ? Math.max(3, DB.diasAte(plano.data)) : 7;
          const ids = Despensa.acabando(DB, { ateDias: janela }).slice(0, 6).map(s => s.item_id);
          const jaTem = new Set(DB.itensDaLista(listaId).map(li => li.item_id));
          let n = 0;
          for (const id of ids) {
            if (jaTem.has(id)) continue;
            const item = DB.get('items', id);
            DB.addNaLista(listaId, { item_id: id, qtd: item.qtd_habitual || 1, unidade: item.unidade || 'un' });
            n++;
          }
          UI.toast(n ? `${n} ${n === 1 ? 'item foi' : 'itens foram'} para a lista` : 'Já estavam todos na lista');
          recarregar();
        }
        else if (acao === 'definir-orcamento') abrirOrcamentoDoMes();
        else if (acao === 'compra-rapida') abrirCompraRapida();
        else if (acao === 'mais-por-menos') abrirMaisPorMenos();
        else if (acao === 'importar') abrirImportacao();
        else if (acao === 'conselho') {
          const alvo = b.dataset.alvo;
          if (alvo === 'despensa') irPara('despensa');
          else if (alvo === 'analise') irPara('analise');
          else if (alvo === 'revisar') { const p = DB.proximoPlano(); if (p) abrirRevisaoDeSugestoes(p.id); }
          else irPara('planejar');
        }
      });
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { ViewHoje };
