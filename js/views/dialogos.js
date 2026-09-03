/* CESTA — as folhas do assistente: planos, sugestões, cardápio, eventos e
   preços-alvo. Ficam juntas porque são todas conversas curtas, e separá-las em
   um arquivo cada só espalharia o mesmo padrão por oito lugares. */
'use strict';

/* ==================================== MARCAR UMA COMPRA ================ */

function abrirNovoPlano() {
  const cfg = DB.cfg() || {};
  const lojas = DB.all('stores');
  const hoje = DB.hojeISO();

  /* O dia sugerido vem da rotina que a pessoa contou na abertura: se ela disse
     que faz o rancho no dia 5, o app já propõe o próximo dia 5. Perguntar de
     novo o que já foi respondido é o jeito mais fácil de parecer burro. */
  const sugerirData = ciclo => {
    if (ciclo === 'mensal' && cfg.dia_da_compra_grande) {
      const d = new Date(hoje + 'T12:00:00');
      const dia = Number(cfg.dia_da_compra_grande);
      if (d.getDate() >= dia) d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    if (ciclo === 'semanal') {
      const d = new Date(new Date(hoje + 'T12:00:00').getTime() + 7 * 864e5);
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    return hoje;
  };

  const fechar = UI.folha(`
    <h2 class="titulo">Marcar uma compra</h2>
    <p class="sub">Com data e orçamento, o app monta a lista sozinho e avisa
      quando estiver chegando.</p>

    <p class="section-title">Que tipo de compra?</p>
    <div class="ciclos">
      ${Object.entries(CICLOS).filter(([id]) => id !== 'evento').map(([id, c], i) => `
        <button class="ciclo-card ${i === 0 ? 'ativo' : ''}" data-ciclo="${id}">
          <span class="ciclo-ico">${c.icone}</span>
          <b>${c.nome}</b>
        </button>`).join('')}
    </div>

    <p class="section-title">Quando</p>
    <input  id="np-data" type="date" value="${sugerirData('mensal')}">

    <p class="section-title">Onde <span class="sub">(opcional)</span></p>
    <select  id="np-loja">
      <option value="">Decido na hora</option>
      ${lojas.map(l => `<option value="${l.id}">${UI.esc(l.nome)}</option>`).join('')}
    </select>

    <p class="section-title">Quanto pretende gastar <span class="sub">(opcional)</span></p>
    <input class="campo-preco" id="np-orc" inputmode="decimal" placeholder="R$ 0,00">
    <p class="sub">Serve para o app avisar antes de estourar, não para cobrar você.</p>

    <button class="btn" id="np-ok" style="margin-top:var(--e4)">
      Marcar e montar a lista
    </button>`);

  let ciclo = 'mensal';
  const mascara = UI.mascaraMoeda(document.querySelector('#np-orc'));
  document.querySelector('#np-orc').addEventListener('input', mascara);

  for (const b of document.querySelectorAll('.ciclo-card[data-ciclo]')) {
    b.addEventListener('click', () => {
      ciclo = b.dataset.ciclo;
      for (const o of document.querySelectorAll('.ciclo-card[data-ciclo]')) o.classList.toggle('ativo', o === b);
      document.querySelector('#np-data').value = sugerirData(ciclo);
    });
  }

  document.querySelector('#np-ok').addEventListener('click', () => {
    const plano = DB.novoPlano({
      ciclo,
      data: document.querySelector('#np-data').value || hoje,
      store_id: document.querySelector('#np-loja').value || null,
      orcamento: UI.lerMoeda(document.querySelector('#np-orc')) || null,
    });
    fechar();
    abrirRevisaoDeSugestoes(plano.id);
  });
}

/* ============================ A LISTA QUE SE MONTA SOZINHA ============= */

/* PROPÕE, NUNCA APLICA. Toda sugestão vem desmarcada com o motivo escrito ao
   lado. É a mesma regra do casamento da NFC-e — aplicar sozinho errou 19
   lançamentos no DOMI, e aqui o custo de errar é mandar comprar o que já tem. */
function abrirRevisaoDeSugestoes(planoId) {
  const plano = DB.get('plans', planoId);
  if (!plano) return;
  const sugestoes = Planejar.sugerirPara(DB, plano);

  if (!sugestoes.length) {
    /* SEM SUGESTÃO NÃO É BECO SEM SAÍDA. Dizer "não tenho o que te dizer" e
       parar ali é o pior desfecho possível: a pessoa fica sem saber se o app
       quebrou, se ela fez algo errado, ou o que fazer em seguida. */
    const temHistorico = DB.all('price_obs').length > 0;
    const f = UI.folha(`
      <h2 class="titulo">${UI.esc(plano.nome)}</h2>
      <p class="sub">A lista está pronta para você montar.</p>

      <div class="ob-exemplo" style="margin-top:var(--e3)">
        <b>Por que não sugeri nada</b>
        <p class="sub">${temHistorico
          ? 'Ainda não sei o seu ritmo: preciso ver você comprar o mesmo item duas vezes para prever quando ele acaba.'
          : 'Ainda não há nenhuma compra registrada — é do seu histórico que saem as sugestões.'}</p>
      </div>

      <p class="section-title">O jeito mais rápido de resolver</p>
      <p class="sub">Importar uma nota fiscal traz dezenas de preços de uma vez,
        e o app já passa a sugerir na próxima compra.</p>

      <button class="btn" id="ns-importar" style="margin-top:var(--e3)">
        Importar nota fiscal
      </button>
      <button class="btn btn-vazado" id="ns-lista" style="margin-top:var(--e2)">
        Montar a lista à mão
      </button>`);

    document.querySelector('#ns-importar').addEventListener('click', () => { f(); abrirImportacao(); });
    document.querySelector('#ns-lista').addEventListener('click', () => {
      f();
      ViewLista.listaId = plano.list_id;
      irPara('lista');
    });
    return;
  }

  const marcados = new Set();
  const fechar = UI.folha(`
    <h2 class="titulo">O que deve entrar</h2>
    <p class="sub">Sugestões para <b>${UI.esc(plano.nome)}</b>, de ${ViewPlanejar.dataBR(plano.data)}.
      Marque o que quiser — o app não põe nada sozinho.</p>

    <div class="linha-resumo">
      <div><span class="rotulo">Marcados</span><b class="valor grande" id="sg-conta">0</b></div>
      <button class="btn" id="sg-todos">Marcar todos</button>
    </div>

    <div class="revisao">
      ${sugestoes.map((s, i) => `
        <label class="rev-linha">
          <input type="checkbox" class="rev-check" data-i="${i}" data-item="${s.item_id}">
          <div class="rev-corpo">
            <b>${Catalogo.corredor(s.item.categoria).icone} ${UI.esc(s.item.nome)}</b>
            <span class="sub">${UI.esc(s.texto)}</span>
          </div>
          <span class="badge ${s.motivo === 'acabando' ? 'b-amber' : s.motivo === 'recorrente' ? 'b-blue' : 'b-slate'}">
            ${s.motivo === 'acabando' ? 'acabando' : s.motivo === 'recorrente' ? 'sempre entra' : 'no seu ritmo'}
          </span>
        </label>`).join('')}
    </div>

    <button class="btn" id="sg-ok" style="margin-top:var(--e4)">
      Pôr os marcados na lista
    </button>
    <button class="btn btn-vazado" id="sg-pular" style="margin-top:var(--e2)">Agora não</button>`);

  const conta = () => { document.querySelector('#sg-conta').textContent = marcados.size; };

  for (const cb of document.querySelectorAll('.rev-check')) {
    cb.addEventListener('change', () => {
      if (cb.checked) marcados.add(cb.dataset.item); else marcados.delete(cb.dataset.item);
      conta();
    });
  }
  document.querySelector('#sg-todos').addEventListener('click', () => {
    const ligar = marcados.size < sugestoes.length;
    marcados.clear();
    for (const cb of document.querySelectorAll('.rev-check')) {
      cb.checked = ligar;
      if (ligar) marcados.add(cb.dataset.item);
    }
    conta();
  });
  document.querySelector('#sg-pular').addEventListener('click', () => { fechar(); irPara('hoje'); });
  document.querySelector('#sg-ok').addEventListener('click', () => {
    const n = Planejar.aplicarSugestoes(DB, plano, [...marcados]);
    fechar();
    irPara('hoje');
    UI.toast(n ? `${n} ${n === 1 ? 'item entrou' : 'itens entraram'} na lista` : 'Nada foi adicionado');
  });
}

/* ===================================== O PLANO ABERTO ================== */

function abrirPlano(planoId) {
  const plano = DB.get('plans', planoId);
  if (!plano) return;
  const itens = plano.list_id ? DB.itensDaLista(plano.list_id) : [];
  const custo = plano.list_id ? Planejar.custoPrevisto(DB, plano.list_id) : { previsto: 0 };
  const ciclo = CICLOS[plano.ciclo] || CICLOS.mensal;

  const fechar = UI.folha(`
    <h2 class="titulo">${ciclo.icone} ${UI.esc(plano.nome)}</h2>
    <p class="sub">${ViewPlanejar.dataBR(plano.data)} · ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}
      ${custo.previsto ? '· ≈ ' + UI.fmt(custo.previsto) : ''}</p>

    <button class="btn" id="pl-sugestoes">
      Ver sugestões do app
    </button>
    <button class="btn btn-vazado" id="pl-lista" style="margin-top:var(--e2)">
      Abrir a lista
    </button>
    <button class="btn btn-vazado" id="pl-mercado" style="margin-top:var(--e2)">
      Estou no mercado
    </button>
    <button class="btn btn-vazado" id="pl-apagar" style="margin-top:var(--e5); color:var(--red-ink)">
      Desmarcar esta compra
    </button>`);

  document.querySelector('#pl-sugestoes').addEventListener('click', () => { fechar(); abrirRevisaoDeSugestoes(planoId); });
  document.querySelector('#pl-lista').addEventListener('click', () => { fechar(); ViewLista.listaId = plano.list_id; irPara('lista'); });
  document.querySelector('#pl-mercado').addEventListener('click', () => { fechar(); abrirMercado(plano.list_id); });
  document.querySelector('#pl-apagar').addEventListener('click', () => {
    DB.remove('plans', planoId);
    fechar(); irPara('planejar');
    UI.toast('Compra desmarcada. A lista continua salva.');
  });
}

/* ================================ RECORRENTES DO CICLO ================= */

function abrirRecorrentes(ciclo) {
  const c = CICLOS[ciclo] || CICLOS.mensal;
  const atuais = new Set(DB.recorrentesDo(ciclo).map(r => r.item_id));
  const itens = DB.all('items').sort((a, b) => a.nome.localeCompare(b.nome));

  UI.folha(`
    <h2 class="titulo">${c.icone} ${c.nome}</h2>
    <p class="sub">O que entra em toda compra deste tipo. Marcado aqui, o app
      sempre sugere — e você não remonta a mesma lista todo mês.</p>

    ${itens.length ? `<div class="revisao">
      ${itens.map(i => `<label class="rev-linha">
        <input type="checkbox" class="rec-check" data-item="${i.id}" ${atuais.has(i.id) ? 'checked' : ''}>
        <div class="rev-corpo">
          <b>${Catalogo.corredor(i.categoria).icone} ${UI.esc(i.nome)}</b>
          <span class="sub">${Catalogo.corredor(i.categoria).nome}</span>
        </div>
      </label>`).join('')}
    </div>` : '<p class="sub">Seu catálogo ainda está vazio.</p>'}`);

  for (const cb of document.querySelectorAll('.rec-check')) {
    cb.addEventListener('change', () => {
      DB.marcarRecorrente(cb.dataset.item, ciclo, cb.checked);
    });
  }
}

/* ==================================== REPETIR COMPRA =================== */

/* Uma compra fechada vira o molde da próxima. É o atalho que transforma a
   segunda compra do mês em 30 segundos de trabalho. */
function repetirCompra(listaId) {
  const antiga = DB.get('lists', listaId);
  if (!antiga) return;
  const itens = DB.itensDaLista(listaId).filter(li => li.comprado && !li.nao_tinha);

  const fechar = UI.folha(`
    <h2 class="titulo">Repetir esta compra</h2>
    <p class="sub">Cria uma compra nova com os ${itens.length} itens que você
      levou em ${ViewPlanejar.dataBR(antiga.data_fechamento)}.</p>
    <input  id="rp-data" type="date" value="${DB.hojeISO()}" style="margin-top:var(--e3)">
    <button class="btn" id="rp-ok" style="margin-top:var(--e3)">
      Criar a compra
    </button>`);

  document.querySelector('#rp-ok').addEventListener('click', () => {
    const plano = DB.novoPlano({
      ciclo: antiga.ciclo || 'mensal',
      data: document.querySelector('#rp-data').value || DB.hojeISO(),
      store_id: antiga.store_id,
      orcamento: antiga.orcamento,
    });
    for (const li of itens) {
      DB.addNaLista(plano.list_id, { item_id: li.item_id, product_id: li.product_id, qtd: li.qtd, unidade: li.unidade });
    }
    fechar();
    irPara('planejar');
    UI.toast(`Compra criada com ${itens.length} itens`);
  });
}

/* ======================================== CARDÁPIO ==================== */

function abrirEscolhaDePrato(data) {
  Cozinha.semearPratos(DB);
  const receitas = DB.all('recipes');
  const pessoas = Cozinha.pessoasDaCasa(DB);

  const fechar = UI.folha(`
    <h2 class="titulo">O que fazer nesse dia</h2>
    <p class="sub">${ViewPlanejar.dataBR(data)} · para ${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}</p>
    <div class="lista-itens" style="margin-top:var(--e3)">
      ${receitas.map(r => {
        const c = Cozinha.custoDoPrato(DB, r.id, pessoas);
        return `<button class="item-linha linha-clicavel" data-receita="${r.id}">
          <div class="item-corpo">
            <b>${UI.esc(r.nome)}</b>
            <span class="sub">${r.tempo ? r.tempo + ' min' : ''}${
              c.custo ? ' · ≈ ' + UI.fmt(c.custo) : ' · sem preço ainda'}</span>
          </div>
        </button>`;
      }).join('')}
    </div>
    <button class="btn btn-vazado" id="cd-limpar" style="margin-top:var(--e3)">Deixar esse dia livre</button>`);

  for (const b of document.querySelectorAll('[data-receita]')) {
    b.addEventListener('click', () => {
      Cozinha.marcarNoCardapio(DB, data, b.dataset.receita, pessoas);
      fechar();
      irPara('planejar');
    });
  }
  document.querySelector('#cd-limpar').addEventListener('click', () => {
    const ja = DB.all('menu').find(m => m.data === data);
    if (ja) DB.remove('menu', ja.id);
    fechar();
    irPara('planejar');
  });
}

function porCardapioNaLista() {
  const hoje = DB.hojeISO();
  const fim = new Date(new Date(hoje + 'T12:00:00').getTime() + 6 * 864e5);
  const p = n => String(n).padStart(2, '0');
  const fimIso = `${fim.getFullYear()}-${p(fim.getMonth() + 1)}-${p(fim.getDate())}`;

  const faltando = Cozinha.listaDoCardapio(DB, hoje, fimIso).filter(l => !l.temEmCasa);
  if (!faltando.length) { UI.toast('Você já tem tudo em casa'); return; }

  const plano = DB.proximoPlano();
  const listaId = plano && plano.list_id ? plano.list_id
    : (DB.listaEmCurso() || DB.listasPlanejadas()[0] || DB.novaLista({ ciclo: 'semanal' })).id;
  const jaTem = new Set(DB.itensDaLista(listaId).map(li => li.item_id));

  let n = 0;
  for (const l of faltando) {
    if (jaTem.has(l.item_id)) continue;
    DB.addNaLista(listaId, { item_id: l.item_id, qtd: l.faltam || l.precisa, unidade: l.unidade });
    n++;
  }
  irPara('planejar');
  UI.toast(n ? `${n} ${n === 1 ? 'item foi' : 'itens foram'} para a lista` : 'Já estavam na lista');
}

/* ========================================== EVENTOS =================== */

function abrirEvento(tipo) {
  const def = Cozinha.EVENTOS[tipo];
  if (!def) return;

  const fechar = UI.folha(`
    <h2 class="titulo">${def.icone} ${def.nome}</h2>
    <p class="sub">Quantas pessoas? O app calcula as quantidades e o custo pelo
      seu histórico de preços.</p>

    <div class="preco-campos" style="margin-top:var(--e3)">
      <label class="preco-campo">
        <span class="rotulo">Pessoas</span>
        <input  id="ev-pessoas" inputmode="numeric" value="10">
      </label>
      <label class="preco-campo">
        <span class="rotulo">Quando</span>
        <input  id="ev-data" type="date" value="${DB.hojeISO()}">
      </label>
    </div>

    <div id="ev-previa" style="margin-top:var(--e4)"></div>

    ${def.nota ? `<p class="sub">${def.nota}</p>` : ''}

    <button class="btn" id="ev-ok" style="margin-top:var(--e3)">
      Criar a lista
    </button>`);

  const previa = document.querySelector('#ev-previa');
  const campo = document.querySelector('#ev-pessoas');

  const calcular = () => {
    const n = Number(campo.value) || 1;
    const r = Cozinha.listaDeEvento(DB, tipo, n);
    previa.innerHTML = `
      <div class="linha-resumo" style="margin-top:0">
        <div><span class="rotulo">Custo previsto</span>
          <b class="valor grande">${r.custoPrevisto ? '≈ ' + UI.fmt(r.custoPrevisto) : '—'}</b></div>
        ${r.porPessoa ? `<div class="direita"><span class="rotulo">Por pessoa</span>
          <b class="valor">${UI.fmt(r.porPessoa)}</b></div>` : ''}
      </div>
      ${r.semPreco ? `<p class="sub">${r.semPreco} ${r.semPreco === 1 ? 'item ainda sem' : 'itens ainda sem'} histórico de preço.</p>` : ''}
      <div class="lista-itens" style="margin-top:var(--e3)">
        ${r.linhas.map(l => `<div class="item-linha">
          <span class="item-emoji">${Catalogo.corredor(l.item.categoria).icone}</span>
          <div class="item-corpo">
            <b>${UI.esc(l.item.nome)}</b>
            <span class="sub">${Despensa.fmtQtd(l.qtd, l.unidade)}</span>
          </div>
          <span class="sub">${l.custo != null ? UI.fmt(l.custo) : '—'}</span>
        </div>`).join('')}
      </div>`;
  };

  campo.addEventListener('input', calcular);
  calcular();

  document.querySelector('#ev-ok').addEventListener('click', () => {
    const plano = Cozinha.criarListaDeEvento(DB, tipo,
      Number(campo.value) || 1, document.querySelector('#ev-data').value);
    fechar();
    irPara('planejar');
    UI.toast(plano ? 'Lista do evento criada' : 'Não consegui criar');
  });
}

/* ======================================== PREÇO-ALVO ================== */

function abrirNovoAlvo() {
  const itens = DB.all('items')
    .map(i => ({ item: i, ref: Precos.referencia(DB, { item_id: i.id }) }))
    .filter(x => x.ref.n)
    .sort((a, b) => a.item.nome.localeCompare(b.item.nome));

  if (!itens.length) {
    UI.folha(`<h2 class="titulo">Preço-alvo</h2>
      <p class="sub">É preciso ter ao menos um preço registrado para definir um
        alvo — senão não haveria com o que comparar.</p>`);
    return;
  }

  const fechar = UI.folha(`
    <h2 class="titulo">Definir preço-alvo</h2>
    <p class="sub">O app avisa quando o preço bater o valor que você aceita pagar.</p>

    <p class="section-title">Produto</p>
    <select  id="al-item">
      ${itens.map(x => `<option value="${x.item.id}">${UI.esc(x.item.nome)} — hoje ${UI.fmtBase(x.ref.mediana, x.ref.unidade)}</option>`).join('')}
    </select>

    <p class="section-title">Avisar abaixo de</p>
    <input class="campo-preco" id="al-valor" inputmode="decimal" placeholder="R$ 0,00">
    <p class="sub" id="al-dica"></p>

    <button class="btn" id="al-ok" style="margin-top:var(--e3)">
      Criar alvo
    </button>`);

  const sel = document.querySelector('#al-item');
  const campo = document.querySelector('#al-valor');
  const dica = document.querySelector('#al-dica');
  const mascara = UI.mascaraMoeda(campo);

  const atualizar = () => {
    const x = itens.find(i => i.item.id === sel.value);
    if (!x) return;
    dica.innerHTML = `Você costuma pagar <b>${UI.fmtBase(x.ref.mediana, x.ref.unidade)}</b>
      e o melhor que já viu foi <b>${UI.fmtBase(x.ref.melhorPreco, x.ref.unidade)}</b>.
      O alvo é por ${x.ref.unidade}.`;
  };
  sel.addEventListener('change', atualizar);
  campo.addEventListener('input', mascara);
  atualizar();

  document.querySelector('#al-ok').addEventListener('click', () => {
    const x = itens.find(i => i.item.id === sel.value);
    const valor = UI.lerMoeda(campo);
    if (!valor) { UI.toast('Digite o valor do alvo'); return; }
    Decisoes.definirAlvo(DB, { item_id: x.item.id, valor, unidade: x.ref.unidade });
    fechar();
    irPara('analise');
    UI.toast('Alvo criado. O app avisa quando bater.');
  });
}

/* ================================ ORÇAMENTO DO MÊS ==================== */

function abrirOrcamentoDoMes() {
  const mes = DB.mesDe(DB.hojeISO());
  const atual = DB.orcamentoDoMes(mes);

  const fechar = UI.folha(`
    <h2 class="titulo">Orçamento do mês</h2>
    <p class="sub">Quanto a casa pretende gastar com mercado neste mês. É o que
      permite ao app avisar <b>antes</b> de estourar, em vez de você descobrir no
      extrato.</p>
    <input class="campo-preco" id="or-valor" inputmode="decimal"
           placeholder="R$ 0,00" value="${atual ? UI.fmt(atual) : ''}" style="margin-top:var(--e3)">
    <p class="sub">É diferente do orçamento de cada compra: este é o do mês inteiro,
      somando o rancho, as reposições e as idas rápidas.</p>
    <button class="btn" id="or-ok" style="margin-top:var(--e3)">Salvar</button>`);

  const campo = document.querySelector('#or-valor');
  const mascara = UI.mascaraMoeda(campo);
  campo.addEventListener('input', mascara);

  document.querySelector('#or-ok').addEventListener('click', () => {
    DB.setOrcamentoDoMes(mes, UI.lerMoeda(campo) || null);
    fechar();
    irPara('hoje');
    UI.toast('Orçamento do mês definido');
  });
}

/* =================================== COMPRA RÁPIDA ==================== */

/* A ida de emergência: acabou o leite, você passou na padaria. Três toques, sem
   lista, sem plano — porque exigir planejamento aqui seria exigir cerimônia de
   quem tem pressa. */
function abrirCompraRapida() {
  const lojas = DB.all('stores');
  const fechar = UI.folha(`
    <h2 class="titulo">Comprei agora</h2>
    <p class="sub">Registrar sem lista e sem plano. O preço entra no histórico
      igual, e o item entra na despensa.</p>

    <input  id="cr-item" placeholder="O que você comprou?" autocomplete="off" style="margin-top:var(--e3)">
    <div class="preco-campos" style="margin-top:var(--e2)">
      <label class="preco-campo">
        <span class="rotulo">Preço</span>
        <input class="campo-preco" id="cr-preco" inputmode="decimal" placeholder="R$ 0,00">
      </label>
      <label class="preco-campo estreito">
        <span class="rotulo">Qtd</span>
        <input  id="cr-qtd" inputmode="decimal" value="1">
      </label>
      <label class="preco-campo estreito">
        <span class="rotulo">Un.</span>
        <select  id="cr-un">
          ${['un', 'kg', 'g', 'l', 'ml'].map(u => `<option value="${u}">${u}</option>`).join('')}
        </select>
      </label>
    </div>

    <select  id="cr-loja" style="margin-top:var(--e2)">
      <option value="">Onde? (opcional)</option>
      ${lojas.map(l => `<option value="${l.id}">${UI.esc(l.nome)}</option>`).join('')}
    </select>

    <div id="cr-diag" style="margin-top:var(--e3)"></div>

    <button class="btn" id="cr-ok" style="margin-top:var(--e3)">
      Registrar
    </button>`);

  const campoItem = document.querySelector('#cr-item');
  const campoPreco = document.querySelector('#cr-preco');
  const campoQtd = document.querySelector('#cr-qtd');
  const campoUn = document.querySelector('#cr-un');
  const diag = document.querySelector('#cr-diag');
  const mascara = UI.mascaraMoeda(campoPreco);

  /* O diagnóstico aparece aqui também: mesmo na pressa, saber que o preço está
     caro é a informação que o app existe para dar. */
  const avaliar = () => {
    mascara();
    const nome = campoItem.value.trim();
    const preco = UI.lerMoeda(campoPreco);
    if (!nome || !preco) { diag.innerHTML = ''; return; }
    const existente = DB.all('items').find(i => i.nome.toLowerCase() === nome.toLowerCase());
    if (!existente) { diag.innerHTML = '<div class="diag b-slate"><span>⚪ Produto novo</span></div>'; return; }
    const d = Precos.avaliar(DB, {
      item_id: existente.id, preco,
      qtd: Number(String(campoQtd.value).replace(',', '.')) || 1,
      unidade: campoUn.value,
    });
    diag.innerHTML = Mercado.htmlDoDiagnostico(d);
  };

  campoItem.addEventListener('input', () => {
    const palpite = Catalogo.palpitar(campoItem.value);
    if (palpite) { campoUn.value = palpite.unidade; campoQtd.value = palpite.qtd; }
    avaliar();
  });
  campoPreco.addEventListener('input', avaliar);
  campoQtd.addEventListener('input', avaliar);
  campoUn.addEventListener('change', avaliar);

  document.querySelector('#cr-ok').addEventListener('click', () => {
    const nome = campoItem.value.trim();
    const preco = UI.lerMoeda(campoPreco);
    if (!nome) { UI.toast('Diga o que você comprou'); return; }
    if (!preco) { UI.toast('Digite o preço'); return; }

    const palpite = Catalogo.palpitar(nome);
    const item = DB.itemPorNome(nome, palpite
      ? { categoria: palpite.corredor, unidade: palpite.unidade, qtd_habitual: palpite.qtd } : {});

    Precos.registrar(DB, {
      item_id: item.id,
      store_id: document.querySelector('#cr-loja').value || null,
      data: DB.hojeISO(),
      preco_total: preco,
      qtd: Number(String(campoQtd.value).replace(',', '.')) || 1,
      unidade: campoUn.value,
      origem: 'digitado',
    });

    fechar();
    irPara('hoje');
    UI.toast(`${item.nome} registrado`);
  });

  campoItem.focus();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { abrirNovoPlano, abrirRevisaoDeSugestoes, abrirPlano, abrirRecorrentes,
    repetirCompra, abrirEscolhaDePrato, porCardapioNaLista, abrirEvento, abrirNovoAlvo,
    abrirOrcamentoDoMes, abrirCompraRapida };
}
