/* CESTA — a cozinha: cardápio da semana, eventos e rateio.

   É a onda 3, e é onde o app deixa de falar de compras e passa a falar de
   COMIDA — que é o motivo pelo qual as compras existem.

   "O que vou fazer de janta?" e "o que preciso comprar?" são a mesma pergunta
   feita de dois lados, e resolver as duas de uma vez é o que nenhum app
   brasileiro faz bem. */
'use strict';

/* Um catálogo de pratos que a casa brasileira faz de verdade, com os
   ingredientes em quantidade por porção.

   POR QUE VEM PRONTO: pedir que a pessoa cadastre receitas antes de usar o
   recurso é o mesmo erro do inventário da despensa — ninguém cadastra, o
   recurso morre. Ela edita e acrescenta as dela depois, sobre uma base que já
   funciona. */
const PRATOS = [
  { nome: 'Arroz com feijão e bife', tempo: 40, itens: [
    ['Arroz', 0.09, 'kg'], ['Feijão', 0.06, 'kg'], ['Bife', 0.15, 'kg'],
    ['Alho', 0.005, 'kg'], ['Cebola', 0.03, 'kg'], ['Óleo de soja', 0.02, 'l'] ] },
  { nome: 'Frango assado com batata', tempo: 70, itens: [
    ['Frango', 0.25, 'kg'], ['Batata', 0.2, 'kg'], ['Alho', 0.005, 'kg'],
    ['Cebola', 0.03, 'kg'], ['Limão', 0.02, 'kg'] ] },
  { nome: 'Macarronada', tempo: 30, itens: [
    ['Macarrão', 0.1, 'kg'], ['Molho de tomate', 0.12, 'kg'],
    ['Queijo mussarela', 0.03, 'kg'], ['Cebola', 0.02, 'kg'], ['Alho', 0.005, 'kg'] ] },
  { nome: 'Strogonoff de frango', tempo: 40, itens: [
    ['Frango', 0.18, 'kg'], ['Arroz', 0.09, 'kg'], ['Requeijão', 0.05, 'kg'],
    ['Molho de tomate', 0.06, 'kg'], ['Cebola', 0.03, 'kg'] ] },
  { nome: 'Carne moída com purê', tempo: 45, itens: [
    ['Carne moída', 0.15, 'kg'], ['Batata', 0.25, 'kg'], ['Leite', 0.05, 'l'],
    ['Manteiga', 0.015, 'kg'], ['Cebola', 0.03, 'kg'] ] },
  { nome: 'Peixe com legumes', tempo: 40, itens: [
    ['Peixe', 0.2, 'kg'], ['Batata', 0.15, 'kg'], ['Cenoura', 0.08, 'kg'],
    ['Limão', 0.03, 'kg'], ['Alho', 0.005, 'kg'] ] },
  { nome: 'Feijoada simples', tempo: 90, itens: [
    ['Feijão', 0.12, 'kg'], ['Linguiça', 0.12, 'kg'], ['Arroz', 0.09, 'kg'],
    ['Alho', 0.008, 'kg'], ['Cebola', 0.04, 'kg'] ] },
  { nome: 'Omelete e salada', tempo: 20, itens: [
    ['Ovos', 2, 'un'], ['Tomate', 0.08, 'kg'], ['Alface', 0.25, 'un'],
    ['Queijo mussarela', 0.03, 'kg'], ['Cebola', 0.02, 'kg'] ] },
  { nome: 'Sopa de legumes', tempo: 50, itens: [
    ['Batata', 0.15, 'kg'], ['Cenoura', 0.1, 'kg'], ['Cebola', 0.04, 'kg'],
    ['Macarrão', 0.04, 'kg'], ['Frango', 0.1, 'kg'] ] },
  { nome: 'Panqueca de carne', tempo: 55, itens: [
    ['Carne moída', 0.12, 'kg'], ['Farinha de trigo', 0.06, 'kg'], ['Leite', 0.12, 'l'],
    ['Ovos', 1, 'un'], ['Molho de tomate', 0.1, 'kg'] ] },
  { nome: 'Escondidinho', tempo: 60, itens: [
    ['Carne moída', 0.15, 'kg'], ['Batata', 0.25, 'kg'], ['Requeijão', 0.04, 'kg'],
    ['Queijo mussarela', 0.04, 'kg'], ['Cebola', 0.03, 'kg'] ] },
  { nome: 'Salada com frango grelhado', tempo: 25, itens: [
    ['Frango', 0.15, 'kg'], ['Alface', 0.3, 'un'], ['Tomate', 0.1, 'kg'],
    ['Cenoura', 0.06, 'kg'], ['Limão', 0.02, 'kg'] ] },
];

/* Eventos brasileiros, com a quantidade por pessoa que se usa na prática.
   Estes números vêm do costume, não de nutrição — e o app diz isso. */
const EVENTOS = {
  churrasco: {
    nome: 'Churrasco', icone: '🔥',
    porPessoa: [
      ['Bife', 0.4, 'kg'], ['Linguiça', 0.15, 'kg'], ['Frango', 0.15, 'kg'],
      ['Pão francês', 0.08, 'kg'], ['Cerveja', 3, 'un'], ['Refrigerante', 0.4, 'l'],
      ['Arroz', 0.06, 'kg'], ['Cebola', 0.05, 'kg'], ['Limão', 0.05, 'kg'],
      ['Sal', 0.02, 'kg'],
    ],
    fixos: [['Água mineral', 5, 'l']],
    nota: 'Carne: 400 g por adulto é a conta que costuma sobrar pouco. Com criança, conte meia porção.',
  },
  festa: {
    nome: 'Festa / aniversário', icone: '🎂',
    porPessoa: [
      ['Refrigerante', 0.5, 'l'], ['Pão de forma', 0.15, 'un'],
      ['Presunto', 0.05, 'kg'], ['Queijo mussarela', 0.05, 'kg'],
      ['Biscoito', 0.05, 'kg'],
    ],
    fixos: [['Bolo', 1, 'un'], ['Água mineral', 5, 'l']],
    nota: 'Salgadinho e docinho variam demais por família — acrescente os seus.',
  },
  natal: {
    nome: 'Ceia de Natal', icone: '🎄',
    porPessoa: [
      ['Frango', 0.35, 'kg'], ['Arroz', 0.08, 'kg'], ['Batata', 0.15, 'kg'],
      ['Refrigerante', 0.5, 'l'], ['Cebola', 0.04, 'kg'],
    ],
    fixos: [['Água mineral', 5, 'l']],
    nota: 'A conta do peru ou pernil entra como um item só, e você ajusta o peso.',
  },
  cafe: {
    nome: 'Café da manhã reforçado', icone: '☕',
    porPessoa: [
      ['Pão francês', 0.1, 'kg'], ['Leite', 0.25, 'l'], ['Café', 0.02, 'kg'],
      ['Manteiga', 0.02, 'kg'], ['Presunto', 0.04, 'kg'], ['Queijo mussarela', 0.04, 'kg'],
      ['Ovos', 1, 'un'],
    ],
    fixos: [],
    nota: '',
  },
};

const Cozinha = {

  PRATOS, EVENTOS,

  /* -------------------------------------------------------- receitas --- */

  /* Instala o catálogo pronto no banco da casa, uma vez. Depois disso as
     receitas são da pessoa: ela edita, apaga e cria as dela. */
  semearPratos(db) {
    if (db.all('recipes').length) return 0;
    let n = 0;
    for (const p of PRATOS) {
      const receita = db.upsert('recipes', { nome: p.nome, porcoes: 1, tempo: p.tempo, semente: true });
      for (const [nome, qtd, unidade] of p.itens) {
        const def = Catalogo.ITENS_COMUNS.find(i => i[0] === nome);
        const item = db.itemPorNome(nome, def
          ? { categoria: def[1], unidade: def[2], qtd_habitual: def[3] } : {});
        db.upsert('recipe_items', { recipe_id: receita.id, item_id: item.id, qtd, unidade });
      }
      n++;
    }
    return n;
  },

  ingredientesDe(db, recipe_id) {
    return db.all('recipe_items').filter(r => r.recipe_id === recipe_id);
  },

  /* Quanto custa fazer um prato, pela mediana de cada ingrediente. É o número
     que responde "sai mais barato cozinhar ou pedir?" — e ele existe de graça,
     porque o app já sabe o preço de tudo. */
  custoDoPrato(db, recipe_id, porcoes = 1) {
    let custo = 0, comBase = 0, semBase = 0;
    for (const ing of this.ingredientesDe(db, recipe_id)) {
      const ref = Precos.referencia(db, { item_id: ing.item_id });
      const c = Precos.canonizar(ing.qtd * porcoes, ing.unidade);
      if (ref.n && ref.mediana != null && c && ref.unidade === c.unidade) {
        custo += ref.mediana * c.qtd; comBase++;
      } else semBase++;
    }
    return { custo, comBase, semBase, porPorcao: porcoes > 0 ? custo / porcoes : custo };
  },

  /* -------------------------------------------------------- cardápio --- */

  /* O cardápio da semana: uma refeição por dia. Simples de propósito — cardápio
     com café, almoço e janta em três colunas é um formulário, e formulário
     ninguém preenche duas semanas seguidas. */
  cardapioDa(db, deISO, ateISO) {
    return db.all('menu')
      .filter(m => m.data >= deISO && m.data <= ateISO)
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  },

  marcarNoCardapio(db, data, recipe_id, porcoes) {
    const ja = db.all('menu').find(m => m.data === data);
    const dados = { data, recipe_id, porcoes: Number(porcoes) || this.pessoasDaCasa(db) };
    return ja ? db.upsert('menu', { id: ja.id, ...dados }) : db.upsert('menu', dados);
  },

  pessoasDaCasa(db) {
    const n = db.membrosDaCasa().length;
    return n > 0 ? n : 2;
  },

  /* O CARDÁPIO VIRA LISTA. Soma os ingredientes de todos os pratos da semana e
     DESCONTA o que a despensa diz que já existe em casa — senão a lista mandaria
     comprar o arroz que está no armário, que é exatamente o erro que este app
     existe para evitar. */
  listaDoCardapio(db, deISO, ateISO) {
    const precisa = {};

    for (const dia of this.cardapioDa(db, deISO, ateISO)) {
      for (const ing of this.ingredientesDe(db, dia.recipe_id)) {
        const c = Precos.canonizar(ing.qtd * (dia.porcoes || 1), ing.unidade);
        if (!c) continue;
        const alvo = precisa[ing.item_id] || (precisa[ing.item_id] = { item_id: ing.item_id, qtd: 0, unidade: c.unidade });
        if (alvo.unidade !== c.unidade) continue;
        alvo.qtd += c.qtd;
      }
    }

    return Object.values(precisa).map(p => {
      const item = db.get('items', p.item_id);
      const saldo = Despensa.saldoDe(db, p.item_id);
      /* Só desconta o que se pode afirmar. Saldo desconhecido conta como zero
         em casa — é melhor comprar de novo do que ficar sem o ingrediente na
         hora de cozinhar. O custo dos dois erros não é o mesmo. */
      const emCasa = (saldo && !saldo.perecivel && saldo.saldo != null) ? saldo.saldo : 0;
      const faltam = Math.max(0, p.qtd - emCasa);
      return {
        item, item_id: p.item_id,
        precisa: p.qtd, emCasa, faltam,
        unidade: p.unidade,
        temEmCasa: emCasa >= p.qtd,
        incerto: !saldo || saldo.saldo == null,
      };
    }).sort((a, b) => a.item.nome.localeCompare(b.item.nome));
  },

  /* ---------------------------------------------------------- eventos --- */

  /* "Churrasco para 12" vira uma lista com as quantidades calculadas. É o tipo
     de coisa que se conta para outra pessoa no dia seguinte. */
  listaDeEvento(db, tipo, pessoas) {
    const def = EVENTOS[tipo];
    if (!def) return null;
    const n = Math.max(1, Number(pessoas) || 1);
    const linhas = [];

    const juntar = (nome, qtd, unidade) => {
      const catalogado = Catalogo.ITENS_COMUNS.find(i => i[0] === nome);
      const item = db.itemPorNome(nome, catalogado
        ? { categoria: catalogado[1], unidade: catalogado[2], qtd_habitual: catalogado[3] } : {});
      const ref = Precos.referencia(db, { item_id: item.id });
      const c = Precos.canonizar(qtd, unidade);
      const custo = (ref.n && ref.mediana != null && c && ref.unidade === c.unidade)
        ? ref.mediana * c.qtd : null;
      linhas.push({ item, item_id: item.id, qtd, unidade, custo });
    };

    for (const [nome, porPessoa, unidade] of def.porPessoa) juntar(nome, porPessoa * n, unidade);
    for (const [nome, qtd, unidade] of def.fixos) juntar(nome, qtd, unidade);

    const comCusto = linhas.filter(l => l.custo != null);
    return {
      tipo, def, pessoas: n,
      linhas,
      custoPrevisto: comCusto.reduce((s, l) => s + l.custo, 0),
      semPreco: linhas.length - comCusto.length,
      porPessoa: comCusto.length ? comCusto.reduce((s, l) => s + l.custo, 0) / n : null,
    };
  },

  criarListaDeEvento(db, tipo, pessoas, dataISO) {
    const calculo = this.listaDeEvento(db, tipo, pessoas);
    if (!calculo) return null;
    const plano = db.novoPlano({
      ciclo: 'evento',
      data: dataISO || db.hojeISO(),
      nome: `${calculo.def.nome} para ${calculo.pessoas}`,
      orcamento: calculo.custoPrevisto || null,
    });
    for (const l of calculo.linhas) {
      db.addNaLista(plano.list_id, { item_id: l.item_id, qtd: l.qtd, unidade: l.unidade });
    }
    return plano;
  },

  /* ----------------------------------------------------------- rateio --- */

  /* Quem pagou o quê, e quem deve quanto. Serve para república e para casa em
     que duas pessoas dividem as contas.

     A regra: divide o TOTAL da compra pelos membros marcados, e desconta o que
     cada um já pagou. Sem tentar dividir item a item — isso vira planilha, e
     planilha ninguém preenche depois do mercado. */
  ratear(db, list_id, membroIds) {
    const lista = db.get('lists', list_id);
    if (!lista) return null;
    const total = lista.total_cupom || db.totalDoCarrinho(list_id, () => null).firme;
    const membros = (membroIds && membroIds.length ? membroIds : db.membrosDaCasa().map(m => m.id))
      .map(id => db.get('members', id)).filter(Boolean);
    if (!membros.length) return null;

    const quota = total / membros.length;
    const pagos = db.all('splits').filter(s => s.list_id === list_id);

    return {
      total, quota,
      membros: membros.map(m => {
        const pago = pagos.filter(p => p.member_id === m.id).reduce((s, p) => s + Number(p.valor || 0), 0);
        return { membro: m, quota, pago, saldo: pago - quota };
      }),
    };
  },

  registrarPagamento(db, list_id, member_id, valor) {
    return db.upsert('splits', { list_id, member_id, valor: Number(valor) });
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Cozinha, PRATOS, EVENTOS };
