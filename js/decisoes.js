/* CESTA — as decisões: onde comprar, vale a pena o atacado, preços-alvo e para
   onde vai o dinheiro.

   É a onda 2: o histórico deixa de só explicar o passado e passa a decidir o
   futuro. Cada função aqui responde uma pergunta que a pessoa faz em voz alta
   antes de sair de casa. */
'use strict';

const Decisoes = {

  /* ================================= ONDE COMPRAR ====================== */

  /* "Sua lista custa R$ 1.180 no Atacadão e R$ 1.310 no Assaí."

     Decide a viagem inteira, e só o SEU histórico pode responder isso — nenhum
     app de preço médio da região sabe o que você põe no carrinho.

     A REGRA QUE TORNA HONESTO: só entram na comparação os itens que você já
     comprou NAS DUAS lojas. Somar o preço de onde você tem histórico e ignorar
     o resto compararia cestas diferentes e daria a resposta errada com cara de
     precisão — o mesmo erro que a cesta comparável evita na inflação. */
  ondeComprar(db, list_id, { janelaMeses = 6 } = {}) {
    const itens = db.itensDaLista(list_id).filter(li => !li.nao_tinha);
    if (!itens.length) return { lojas: [], cobertos: 0, total: 0, motivo: 'lista vazia' };

    const lojas = db.all('stores');
    if (lojas.length < 2) return { lojas: [], cobertos: 0, total: itens.length, motivo: 'menos de dois mercados' };

    /* Preço mediano de cada item em cada loja. Sem observação naquela loja, o
       item simplesmente não existe para ela — e é isso que a interseção usa. */
    const preco = (item_id, product_id, store_id) => {
      const obs = db.all('price_obs').filter(o =>
        o.store_id === store_id &&
        (product_id ? o.product_id === product_id : o.item_id === item_id) &&
        isFinite(o.preco_base) && o.preco_base > 0 &&
        o.data >= Precos.inicioDaJanela(db.hojeISO(), janelaMeses));
      if (!obs.length) return null;
      return { valor: Precos.mediana(obs.map(o => o.preco_base)), unidade: obs[0].unidade_base };
    };

    // Os itens que têm preço em TODAS as lojas comparadas
    const comparaveis = [];
    for (const li of itens) {
      const porLoja = {};
      let temEmTodas = true;
      for (const loja of lojas) {
        const p = preco(li.item_id, li.product_id, loja.id);
        if (!p) { temEmTodas = false; break; }
        porLoja[loja.id] = p;
      }
      if (temEmTodas) comparaveis.push({ li, porLoja });
    }

    if (comparaveis.length < 3) {
      return {
        lojas: [], cobertos: comparaveis.length, total: itens.length,
        motivo: 'poucos itens comprados nos mesmos mercados',
      };
    }

    const resultado = lojas.map(loja => {
      let custo = 0;
      for (const { li, porLoja } of comparaveis) {
        const c = Precos.canonizar(li.qtd, li.unidade);
        const p = porLoja[loja.id];
        const qtd = c && c.unidade === p.unidade ? c.qtd : 1;
        custo += p.valor * qtd;
      }
      return { loja, custo };
    }).sort((a, b) => a.custo - b.custo);

    const melhor = resultado[0];
    for (const r of resultado) {
      r.diferenca = r.custo - melhor.custo;
      r.pct = melhor.custo > 0 ? r.diferenca / melhor.custo : 0;
    }

    return {
      lojas: resultado,
      cobertos: comparaveis.length,
      total: itens.length,
      economia: resultado.length > 1 ? resultado[resultado.length - 1].custo - melhor.custo : 0,
      motivo: null,
    };
  },

  /* ============================ VALE A PENA O ATACADO? ================== */

  /* 5 kg por R$ 24,90 ou 1 kg por R$ 5,90?

     O "Mais por Menos" responde a metade fácil: qual sai mais barato por quilo.
     Esta responde a que importa de verdade — SE COMPENSA PARA VOCÊ:

       · você consome isso antes de estragar?
       · quanto tempo o seu dinheiro fica parado na despensa?
       · cabe no orçamento desta compra?

     Comprar 5 kg de arroz é ótimo; 5 kg de fermento é jogar dinheiro fora
     devagar. A diferença é o seu consumo, e o app conhece o seu consumo. */
  valeAPena(db, item_id, { preco, qtd, unidade, precoAlternativo, qtdAlternativa, unidadeAlternativa } = {}) {
    const item = db.get('items', item_id);
    const grande = Precos.precoBase(preco, qtd, unidade);
    if (!item || !grande) return { erro: 'faltam dados' };

    const cad = Precos.cadencia(db, item_id);
    const entradas = Despensa.entradasDe(db, item_id);
    const porCompra = entradas.length ? Precos.mediana(entradas.map(e => e.qtd_canonica)) : null;
    const consumoDia = (cad && cad.intervalo > 0 && porCompra) ? porCompra / cad.intervalo : null;

    const c = Precos.canonizar(qtd, unidade);
    const duracaoDias = consumoDia && consumoDia > 0 ? c.qtd / consumoDia : null;
    const validade = Despensa.duracaoDe(item);

    /* A comparação com a embalagem menor, quando ela é informada. */
    let economiaPct = null, pequena = null;
    if (precoAlternativo && qtdAlternativa) {
      pequena = Precos.precoBase(precoAlternativo, qtdAlternativa, unidadeAlternativa || unidade);
      if (pequena && pequena.unidade === grande.unidade && pequena.valor > 0) {
        economiaPct = (pequena.valor - grande.valor) / pequena.valor;
      }
    }

    /* O veredito. Três motivos possíveis para NÃO valer, e cada um é dito em
       palavras — "não compensa" sem motivo não ajuda ninguém a decidir. */
    let vale = true, porque = [];

    if (duracaoDias == null) {
      vale = null;
      porque.push('Ainda não sei o seu ritmo de consumo — são precisas ao menos duas compras deste item.');
    } else {
      /* A DECISÃO É UMA SÓ: durar mais que a validade típica não compensa,
         perecível ou não. A categoria escolhe apenas COMO dizer isso —
         escrever dois ramos que decidem igual sugeria que ela mudava o
         veredito, e sugerir uma regra que não existe é o jeito mais fácil de
         alguém "corrigir" o código para o lado errado depois. */
      if (duracaoDias > validade) {
        vale = false;
        porque.push(Despensa.PERECIVEIS.includes(item.categoria)
          ? `${item.nome} estraga em cerca de ${validade} dias, e essa quantidade duraria ${Math.round(duracaoDias)}.`
          : `Daria para ${Math.round(duracaoDias)} dias, mas este tipo de produto costuma durar ${validade}. Parte iria para o lixo.`);
      } else {
        porque.push(`Daria para cerca de ${Math.round(duracaoDias)} dias — dentro do que este produto aguenta.`);
      }

      if (duracaoDias > 120) {
        porque.push(`É bastante dinheiro parado: ${UI.fmt(preco)} rendendo em casa por ${Math.round(duracaoDias / 30)} meses.`);
      }
    }

    if (economiaPct != null) {
      if (economiaPct <= 0.02) {
        vale = false;
        porque.push('A diferença por unidade é pequena demais para justificar levar mais.');
      } else {
        porque.push(`Sai ${Math.round(economiaPct * 100)}% mais barato por ${grande.unidade}.`);
      }
    }

    return {
      item, vale, porque,
      precoBase: grande.valor, unidade: grande.unidade,
      duracaoDias, validade, consumoDia, economiaPct,
      precoBaseAlternativo: pequena ? pequena.valor : null,
    };
  },

  /* ================================= PREÇOS-ALVO ======================= */

  /* "Me avise quando o café cair de R$ 18/kg."

     No mercado, o app destaca o item cujo preço bateu o alvo. É a diferença
     entre lembrar de conferir e ser avisado. */
  definirAlvo(db, { item_id, product_id, valor, unidade }) {
    const ja = db.alvoDe(item_id, product_id);
    const dados = { item_id: item_id || null, product_id: product_id || null,
                    valor: Number(valor), unidade, ativo: true };
    return ja ? db.upsert('price_targets', { id: ja.id, ...dados })
              : db.upsert('price_targets', dados);
  },

  /* Confere um preço contra o alvo. Devolve null quando não há alvo — e o
     chamador não pode tratar "sem alvo" como "não bateu". */
  conferirAlvo(db, { item_id, product_id, precoBase, unidade }) {
    const alvo = db.alvoDe(item_id, product_id);
    if (!alvo || !alvo.ativo) return null;
    /* Unidade diferente não se compara: um alvo em R$/kg contra um preço em
       R$/un daria um número, e o número estaria errado. */
    if (alvo.unidade && unidade && alvo.unidade !== unidade) return null;
    return {
      alvo: alvo.valor,
      bateu: precoBase <= alvo.valor,
      distancia: precoBase - alvo.valor,
      pct: alvo.valor > 0 ? (precoBase - alvo.valor) / alvo.valor : 0,
    };
  },

  /* Os alvos que estão sendo batidos agora, pelo último preço conhecido.
     Alimenta o conselheiro e a lista. */
  alvosBatidos(db) {
    const saida = [];
    for (const alvo of db.all('price_targets')) {
      if (!alvo.ativo) continue;
      const ref = Precos.referencia(db, { product_id: alvo.product_id, item_id: alvo.item_id }, { janelaMeses: 3 });
      if (!ref.n || ref.melhorPreco == null) continue;
      if (ref.unidade && alvo.unidade && ref.unidade !== alvo.unidade) continue;
      if (ref.melhorPreco <= alvo.valor) {
        saida.push({ alvo, melhor: ref.melhorPreco, loja: ref.melhorLoja, data: ref.melhorData, unidade: ref.unidade });
      }
    }
    return saida;
  },

  /* =========================== PARA ONDE VAI O DINHEIRO ================ */

  /* A curva ABC do carrinho: os poucos produtos que são a maior parte da conta.

     Cortar 10% em algo que é 1% do gasto não muda nada; cortar 10% no que é 30%
     muda o mês. Sem esta tela, a pessoa economiza no lugar errado — e é o tipo
     de coisa que só o histórico dela pode dizer. */
  ondeVaiODinheiro(db, { meses = 3, hoje } = {}) {
    const desde = Precos.inicioDaJanela(hoje || db.hojeISO(), meses);
    const porItem = {};
    let total = 0;

    for (const o of db.all('price_obs')) {
      if (!o.data || o.data < desde || !isFinite(o.preco_total)) continue;
      const item = o.item_id ? db.get('items', o.item_id) : null;
      if (!item) continue;
      const alvo = porItem[item.id] || (porItem[item.id] = { item, gasto: 0, vezes: 0 });
      alvo.gasto += Number(o.preco_total);
      alvo.vezes++;
      total += Number(o.preco_total);
    }

    const lista = Object.values(porItem).sort((a, b) => b.gasto - a.gasto);
    let acumulado = 0;
    for (const l of lista) {
      l.pct = total > 0 ? l.gasto / total : 0;
      /* A classe sai do acumulado ANTES de incluir este item: o produto que
         CRUZA a linha dos 80% ainda pertence ao grupo A.

         Classificar pelo acumulado depois de somá-lo tem um efeito absurdo —
         um item que sozinho é 97% do gasto sairia como C, e a tela mandaria
         economizar em tudo menos no que importa. */
      const antes = acumulado;
      acumulado += l.pct;
      l.acumulado = acumulado;
      l.classe = antes < 0.8 ? 'A' : antes < 0.95 ? 'B' : 'C';
    }

    const classeA = lista.filter(l => l.classe === 'A');
    return {
      total, meses,
      itens: lista,
      classeA,
      /* O número que resume: quantos produtos fazem 80% da conta. Costuma ser
         um punhado, e é isso que surpreende quem vê pela primeira vez. */
      quantosFazem80: classeA.length,
      porCategoria: this.porCategoria(lista),
    };
  },

  porCategoria(lista) {
    const mapa = {};
    for (const l of lista) {
      const c = Catalogo.corredor(l.item.categoria);
      const alvo = mapa[c.id] || (mapa[c.id] = { corredor: c, gasto: 0, itens: 0 });
      alvo.gasto += l.gasto;
      alvo.itens++;
    }
    return Object.values(mapa).sort((a, b) => b.gasto - a.gasto);
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Decisoes };
