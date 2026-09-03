/* CESTA — o motor de preços.

   É o coração do app: aqui mora a única resposta que justifica ele existir —
   "este preço é bom?". Nenhuma view recalcula nada disto por fora. No app de
   finanças, três dos defeitos corrigidos nasceram exatamente de a regra ser
   copiada dentro da tela: o número da tela passava a discordar do número da
   outra tela, e descobrir qual dos dois estava certo custava horas.

   NÃO HÁ DOM NESTE ARQUIVO. Ele roda inteiro sob node, sem navegador, e é isso
   que permite testar a matemática do dinheiro sem testar pixel. */
'use strict';

const Precos = {

  /* O LIMIAR VIVE AQUI E SÓ AQUI. Duas cópias divergem no dia em que uma for
     ajustada, e aí o badge da lista discorda do badge do mercado. */
  LIMIAR: 0.07,
  JANELA_MESES: 6,

  /* ------------------------------------------------------- unidades --- */

  /* As três bases canônicas. Comparar R$ 24,90 (5 kg) com R$ 5,90 (1 kg) sem
     normalizar dá o diagnóstico OPOSTO ao correto — é o erro mais caro que este
     app pode cometer, porque ele erra com confiança. */
  UNIDADES: {
    kg: { base: 'kg', fator: 1 },
    g:  { base: 'kg', fator: 0.001 },
    l:  { base: 'L',  fator: 1 },
    ml: { base: 'L',  fator: 0.001 },
    un: { base: 'un', fator: 1 },
  },

  /* Sinônimos que a vida real escreve. O mapa é EXPLÍCITO de propósito: o que
     não está aqui devolve null e fica de fora da comparação, em vez de virar
     'un' por omissão. Uma unidade chutada envenena a mediana do produto para
     sempre, e é um defeito que ninguém consegue enxergar depois. */
  SINONIMOS: {
    quilo: 'kg', quilos: 'kg', kilo: 'kg', kg: 'kg', k: 'kg',
    grama: 'g', gramas: 'g', g: 'g', gr: 'g',
    litro: 'l', litros: 'l', l: 'l', lt: 'l', lts: 'l',
    ml: 'ml', mililitro: 'ml', mililitros: 'ml',
    un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un',
    pc: 'un', pct: 'un', pacote: 'un', cx: 'un', caixa: 'un',
    dz: 'un', duzia: 'un', 'dúzia': 'un',
    /* AS EMBALAGENS QUE O CUPOM CHAMA PELO NOME. Cada mercado cadastra a
       unidade que quer no sistema dele, e o cupom traz o que foi cadastrado:
       um mesmo iogurte é UND num mercado e PTE (pote) no outro.

       Todas contam como UMA unidade — que é o que são. O tamanho da embalagem
       vem da descrição do produto ("510G"), não daqui, e é o app que o lê
       depois para comparar preço por quilo. */
    bdj: 'un', bandeja: 'un',
    vdo: 'un', vidro: 'un',
    pte: 'un', pote: 'un',
    frc: 'un', frasco: 'un',
    sc: 'un', saco: 'un', sch: 'un', sache: 'un', 'sachê': 'un',
    fd: 'un', fardo: 'un',
    bd: 'un', bl: 'un', blister: 'un',
    rl: 'un', rolo: 'un',
    tb: 'un', tubo: 'un',
    lta: 'un', lata: 'un',
    gf: 'un', garrafa: 'un',
    par: 'un', pr: 'un',
  },

  normalizarUnidade(u) {
    if (u == null) return null;
    const chave = String(u).trim().toLowerCase();
    if (!chave) return null;
    const sin = this.SINONIMOS[chave];
    return sin || (this.UNIDADES[chave] ? chave : null);
  },

  /* Converte (quantidade, unidade) para a base canônica.
     Devolve null quando a unidade é desconhecida ou a quantidade não serve —
     null significa "não sei", e "não sei" nunca vira um palpite silencioso. */
  canonizar(qtd, unidade) {
    const u = this.normalizarUnidade(unidade);
    if (!u) return null;
    const n = Number(qtd);
    if (!isFinite(n) || n <= 0) return null;
    const def = this.UNIDADES[u];
    return { qtd: n * def.fator, unidade: def.base };
  },

  /* O número que o app existe para mostrar: quanto custa UMA unidade canônica.
     `embalagens` cobre o "leve 3": 3 pacotes de 500 g por R$ 12 são 1,5 kg. */
  precoBase(precoTotal, qtd, unidade, embalagens = 1) {
    const c = this.canonizar(qtd, unidade);
    const p = Number(precoTotal);
    const n = Number(embalagens) || 1;
    if (!c || !isFinite(p) || p < 0 || n <= 0) return null;
    return { valor: p / (c.qtd * n), unidade: c.unidade };
  },

  /* ------------------------------------------- MAIS POR MENOS (F1) --- */

  /* O comparador de embalagens. Detergente 500 ml a R$ 3,20 contra o refil de
     1 L a R$ 5,90: qual compensa?

     Isto NÃO DEPENDE DE HISTÓRICO NENHUM — é aritmética de gôndola, e funciona
     no minuto zero de uso. É a resposta à armadilha central do produto (um
     comparador sem histórico é uma tela vazia) e, sozinho, já justifica ter o
     app instalado antes da primeira compra registrada. */
  maisPorMenos(a, b) {
    const pa = this.precoBase(a.preco, a.qtd, a.unidade, a.embalagens);
    const pb = this.precoBase(b.preco, b.qtd, b.unidade, b.embalagens);
    if (!pa || !pb) return { erro: 'unidade desconhecida' };
    if (pa.unidade !== pb.unidade) return { erro: 'unidades diferentes' };

    const caro = Math.max(pa.valor, pb.valor);
    const barato = Math.min(pa.valor, pb.valor);
    // Empate real existe: dois preços por litro iguais não têm vencedor, e
    // fingir um faria o app recomendar por ruído de arredondamento.
    const empate = Math.abs(pa.valor - pb.valor) < 1e-9;

    return {
      a: pa, b: pb,
      unidade: pa.unidade,
      melhor: empate ? null : (pa.valor < pb.valor ? 'a' : 'b'),
      empate,
      // Quanto o caro custa a mais que o barato, em % do barato
      economiaPct: barato > 0 ? (caro - barato) / barato : 0,
      diferenca: caro - barato,
    };
  },

  /* --------------------------------------------------- estatística --- */

  /* MEDIANA, NÃO MÉDIA. Com 3 a 5 pontos — que é o normal aqui — uma promoção
     de 40% arrasta a média e o app passa os meses seguintes chamando preço
     normal de "caro". A mediana ignora a ponta sem precisar descartá-la. */
  mediana(nums) {
    const v = nums.filter(n => isFinite(n)).slice().sort((x, y) => x - y);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  },

  /* --------------------------------------------------- observações --- */

  /* Subtrai meses de uma data ISO sem depender de biblioteca. Fixar o dia 1 do
     mês de corte é de propósito: a janela é de MESES, e "seis meses atrás" no
     dia 31 não pode significar uma coisa diferente do dia 1. */
  inicioDaJanela(hojeISO, meses) {
    const d = new Date(hojeISO + 'T12:00:00');
    d.setMonth(d.getMonth() - meses);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
  },

  /* As observações que servem de referência para um alvo.
     O alvo é { product_id } ou { item_id }: o primeiro é preciso ("o mesmo Tio
     João 5 kg"), o segundo é mais amplo e mais ruidoso ("arroz em geral"). */
  observacoes(db, alvo, { hoje, janelaMeses = this.JANELA_MESES, excluirId = null } = {}) {
    const desde = this.inicioDaJanela(hoje || db.hojeISO(), janelaMeses);
    return db.all('price_obs').filter(o => {
      if (excluirId && o.id === excluirId) return false;
      if (!o.data || o.data < desde) return false;
      if (!isFinite(o.preco_base) || o.preco_base <= 0) return false;
      if (alvo.product_id) return o.product_id === alvo.product_id;
      if (alvo.item_id) return o.item_id === alvo.item_id;
      return false;
    });
  },

  /* A REFERÊNCIA, em cascata. Tenta o produto exato; se não houver base, cai
     para o item genérico; se ainda assim não houver, devolve n=0 — e n=0 é uma
     resposta legítima, não uma falha a esconder.

     A cascata precisa DIZER qual nível usou: comparar com "arroz em geral" e
     apresentar como se fosse o mesmo produto seria mentir por omissão. */
  referencia(db, { product_id, item_id }, opts = {}) {
    const tentativas = [];
    if (product_id) tentativas.push(['produto', { product_id }]);
    if (item_id) tentativas.push(['item', { item_id }]);

    for (const [escopo, alvo] of tentativas) {
      const obs = this.observacoes(db, alvo, opts);
      if (!obs.length) continue;

      const valores = obs.map(o => o.preco_base);
      const med = this.mediana(valores);
      const barato = obs.reduce((a, o) => (o.preco_base < a.preco_base ? o : a), obs[0]);
      const recente = obs.reduce((a, o) => (o.data > a.data ? o : a), obs[0]);

      return {
        mediana: med,
        n: obs.length,
        min: Math.min(...valores),
        max: Math.max(...valores),
        unidade: obs[0].unidade_base || null,
        ultima: recente.preco_base,
        ultimaData: recente.data,
        melhorPreco: barato.preco_base,
        melhorLoja: barato.store_id,
        melhorData: barato.data,
        /* A confiança é dita em palavras junto do selo. Um veredito baseado em
           uma única observação anterior não pode se apresentar como o mesmo
           veredito baseado em dez. */
        confianca: obs.length >= 3 ? 'boa' : obs.length === 2 ? 'media' : 'baixa',
        escopo,
      };
    }

    return { mediana: null, n: 0, escopo: 'nenhum', confianca: 'nenhuma' };
  },

  /* ------------------------------------------------- o diagnóstico --- */

  /* O veredito. Devolve dados, nunca HTML: quem desenha é a view.

     n = 0 É CINZA, NUNCA AMARELO. Dizer "na média" quando não há média é a
     mentira que destrói a confiança no app inteiro — e é o mesmo tipo de
     defeito que no app de finanças aparecia como "o número da tela não bate com
     outro número da própria tela". */
  diagnosticar(precoBase, ref) {
    if (!isFinite(precoBase) || precoBase <= 0) {
      return { selo: 'slate', rotulo: 'Sem preço', delta: null, n: 0, base: false };
    }
    if (!ref || !ref.n || ref.mediana == null || ref.mediana <= 0) {
      return {
        selo: 'slate', rotulo: 'Primeiro registro', delta: null, n: 0, base: false,
        explicacao: 'Ainda não há com o que comparar. Este preço passa a ser a sua referência.',
      };
    }

    const delta = (precoBase - ref.mediana) / ref.mediana;
    const selo = delta <= -this.LIMIAR ? 'green' : delta >= this.LIMIAR ? 'red' : 'amber';
    const rotulo = selo === 'green' ? 'Excelente' : selo === 'red' ? 'Caro' : 'Na média';

    return {
      selo, rotulo, delta,
      pct: Math.round(Math.abs(delta) * 100),
      acima: delta > 0,
      n: ref.n,
      mediana: ref.mediana,
      confianca: ref.confianca,
      escopo: ref.escopo,
      base: true,
      /* O melhor preço já visto vem JUNTO do veredito. Um "🔴 Caro" sozinho
         deixa a pessoa sem saída: ela precisa saber quanto isso já custou e
         onde, para decidir se leva assim mesmo ou espera. */
      melhorPreco: ref.melhorPreco,
      melhorLoja: ref.melhorLoja,
      melhorData: ref.melhorData,
    };
  },

  /* Diagnóstico direto do que a pessoa acabou de digitar, sem gravar nada.
     É o que o Modo Mercado chama a cada tecla. */
  avaliar(db, { product_id, item_id, preco, qtd, unidade, embalagens }, opts = {}) {
    const pb = this.precoBase(preco, qtd, unidade, embalagens);
    if (!pb) return { selo: 'slate', rotulo: 'Falta a quantidade', delta: null, n: 0, base: false };
    const ref = this.referencia(db, { product_id, item_id }, opts);
    /* A referência tem de estar na MESMA unidade do que se avalia. Comparar
       R$/kg com R$/un daria um número, e o número estaria errado — o pior tipo
       de resposta que este app pode dar. */
    if (ref.n && ref.unidade && ref.unidade !== pb.unidade) {
      return {
        selo: 'slate', rotulo: 'Primeiro registro', delta: null, n: 0, base: false,
        explicacao: 'O histórico deste produto está em outra unidade.',
        precoBase: pb.valor, unidade: pb.unidade,
      };
    }
    const d = this.diagnosticar(pb.valor, ref);
    d.precoBase = pb.valor;
    d.unidade = pb.unidade;
    return d;
  },

  /* ------------------------------------------ ENCOLHIMENTO (5.2) --- */

  /* A redução de embalagem — o aumento que o consumidor não enxerga.

     Sai quase de graça da unidade canônica, porque já gravamos a quantidade em
     cada observação. Nenhum concorrente entrega isso, e é o tipo de coisa que
     faz a pessoa contar do app para outra pessoa. */
  encolhimento(db, product_id, { hoje, janelaMeses = 12 } = {}) {
    const obs = this.observacoes(db, { product_id }, { hoje, janelaMeses })
      .filter(o => isFinite(o.qtd_canonica) && o.qtd_canonica > 0)
      .sort((a, b) => (a.data < b.data ? -1 : 1));
    if (obs.length < 2) return null;

    const atual = obs[obs.length - 1];
    // A embalagem anterior é a última que era DIFERENTE da atual — não a
    // penúltima observação, que quase sempre já é do mesmo tamanho.
    let anterior = null;
    for (let i = obs.length - 2; i >= 0; i--) {
      if (Math.abs(obs[i].qtd_canonica - atual.qtd_canonica) > 1e-9) { anterior = obs[i]; break; }
    }
    if (!anterior || anterior.qtd_canonica <= atual.qtd_canonica) return null;

    const encolheuPct = (anterior.qtd_canonica - atual.qtd_canonica) / anterior.qtd_canonica;
    const subiuPorBase = anterior.preco_base > 0
      ? (atual.preco_base - anterior.preco_base) / anterior.preco_base : 0;

    return {
      de: anterior.qtd_canonica,
      para: atual.qtd_canonica,
      unidade: atual.unidade_base,
      encolheuPct,
      subiuPorBase,
      // O preço de etiqueta pode não ter mudado nada — e é justamente esse o
      // caso que a pessoa não percebe sozinha.
      precoEtiquetaIgual: Math.abs(atual.preco_total - anterior.preco_total) < 0.01,
      precoAntes: anterior.preco_total,
      precoAgora: atual.preco_total,
      dataAntes: anterior.data,
      dataAgora: atual.data,
    };
  },

  /* ------------------------------------------------- séries (F4) --- */

  /* A mediana de cada mês, para um alvo. Mediana por mês, e não todas as
     observações soltas: um mês com cinco compras não pode pesar cinco vezes
     mais que um mês com uma. */
  serieMensal(db, alvo, { meses = 12, hoje } = {}) {
    const obs = this.observacoes(db, alvo, { hoje, janelaMeses: meses });
    const porMes = {};
    for (const o of obs) {
      const m = String(o.data).slice(0, 7);
      (porMes[m] || (porMes[m] = [])).push(o.preco_base);
    }
    return Object.keys(porMes).sort().map(mes => ({
      mes,
      mediana: this.mediana(porMes[mes]),
      n: porMes[mes].length,
    }));
  },

  /* A CESTA COMPARÁVEL — a inflação pessoal, medida direito.

     Comparar o total de um mês com o do outro NÃO mede inflação: mede que você
     comprou coisas diferentes. Um mês com churrasco "inflaciona" 30%.

     A regra é CESTA FECHADA: só entram produtos observados nos DOIS períodos, e
     o índice é ponderado pela quantidade do período base. O app mostra os dois
     números com nomes que não se confundem — "sua cesta comparável: +4,1%" e
     "você gastou: +18%" —, porque um rótulo só para os dois repetiria o defeito
     de "Disponível" versus "Saldo em conta" no app de finanças. */
  cestaComparavel(db, mesBase, mesAtual) {
    const doMes = mes => {
      const mapa = {};
      for (const o of db.all('price_obs')) {
        if (String(o.data).slice(0, 7) !== mes) continue;
        if (!o.product_id || !isFinite(o.preco_base) || o.preco_base <= 0) continue;
        (mapa[o.product_id] || (mapa[o.product_id] = [])).push(o);
      }
      const saida = {};
      for (const [pid, lista] of Object.entries(mapa)) {
        saida[pid] = {
          mediana: this.mediana(lista.map(o => o.preco_base)),
          qtd: lista.reduce((s, o) => s + (Number(o.qtd_canonica) || 0), 0),
          unidade: lista[0].unidade_base,
        };
      }
      return saida;
    };

    const base = doMes(mesBase);
    const atual = doMes(mesAtual);

    let custoBase = 0, custoAtual = 0, n = 0;
    const produtos = [];
    for (const pid of Object.keys(base)) {
      const a = atual[pid];
      if (!a) continue;                       // não está nos dois: fica de fora
      if (a.unidade !== base[pid].unidade) continue;  // mudou de unidade: incomparável
      const peso = base[pid].qtd || 1;
      custoBase += base[pid].mediana * peso;
      custoAtual += a.mediana * peso;
      n++;
      produtos.push({
        product_id: pid,
        de: base[pid].mediana,
        para: a.mediana,
        variacao: base[pid].mediana > 0 ? (a.mediana - base[pid].mediana) / base[pid].mediana : 0,
      });
    }

    /* Cesta vazia devolve null, não zero. Zero significaria "não variou", que é
       uma afirmação — e aqui não há afirmação nenhuma a fazer. */
    if (!n || custoBase <= 0) return { indice: null, n: 0, produtos: [] };

    return {
      indice: (custoAtual - custoBase) / custoBase,
      n,
      custoBase,
      custoAtual,
      produtos: produtos.sort((a, b) => b.variacao - a.variacao),
    };
  },

  /* O que mais subiu. Exige n≥2 em AMBOS os meses: um produto com um preço em
     cada ponta é ruído, e ranquear ruído faz a tela mentir com números. */
  maisSubiram(db, mesBase, mesAtual, { minObs = 2, limite = 10 } = {}) {
    const porMes = mes => {
      const mapa = {};
      for (const o of db.all('price_obs')) {
        if (String(o.data).slice(0, 7) !== mes || !o.product_id) continue;
        (mapa[o.product_id] || (mapa[o.product_id] = [])).push(o.preco_base);
      }
      return mapa;
    };
    const a = porMes(mesBase), b = porMes(mesAtual);
    const saida = [];
    for (const pid of Object.keys(a)) {
      if (!b[pid] || a[pid].length < minObs || b[pid].length < minObs) continue;
      const de = this.mediana(a[pid]), para = this.mediana(b[pid]);
      if (!de) continue;
      saida.push({ product_id: pid, de, para, variacao: (para - de) / de, nBase: a[pid].length, nAtual: b[pid].length });
    }
    return saida.sort((x, y) => y.variacao - x.variacao).slice(0, limite);
  },

  /* ------------------------------------------------ CADÊNCIA (F4) --- */

  /* A despensa digital, pelo caminho barato.

     Controle de estoque exige um inventário que a pessoa precisa manter — e
     ninguém mantém, então o dado apodrece e o app passa a mentir. O histórico
     já entrega 80% disso de graça: se você compra arroz a cada ~34 dias e faz
     40 que não compra, provavelmente está acabando. Zero manutenção. */
  cadencia(db, item_id, { hoje } = {}) {
    const datas = [...new Set(db.all('price_obs')
      .filter(o => o.item_id === item_id && o.data)
      .map(o => o.data))].sort();
    if (datas.length < 2) return null;

    const dias = [];
    for (let i = 1; i < datas.length; i++) {
      const d = (new Date(datas[i] + 'T12:00:00') - new Date(datas[i - 1] + 'T12:00:00')) / 864e5;
      if (d > 0) dias.push(d);
    }
    if (!dias.length) return null;

    const intervalo = this.mediana(dias);
    const ultima = datas[datas.length - 1];
    const hojeIso = hoje || db.hojeISO();
    const desde = Math.round((new Date(hojeIso + 'T12:00:00') - new Date(ultima + 'T12:00:00')) / 864e5);

    return {
      intervalo: Math.round(intervalo),
      ultima,
      diasDesde: desde,
      compras: datas.length,
      /* 15% de folga antes de sugerir: avisar no dia exato transformaria a
         sugestão em ruído semanal, e sugestão que erra sempre é desligada. */
      acabando: desde >= intervalo * 0.85,
      atrasado: desde > intervalo * 1.5,
    };
  },

  /* ------------------------------------------------- gravação (F1) --- */

  /* Registra uma observação de preço. É a ÚNICA porta de entrada de preço no
     app: importador de NFC-e, digitação no mercado e semeadura declarada passam
     todos por aqui, para a normalização acontecer num lugar só.

     O DIAGNÓSTICO NÃO É GRAVADO — só o fato. "🔴 Caro +14%" é sempre derivado
     na hora de mostrar, porque guardar o veredito congelado significa ter dois
     números que discordam no dia em que a regra mudar. */
  registrar(db, { product_id, item_id, store_id, data, preco_total, qtd, unidade, embalagens, origem, foto_id, nfce_chave }) {
    const pb = this.precoBase(preco_total, qtd, unidade, embalagens);
    if (!pb) return null;   // unidade desconhecida fica de fora, não vira 'un'
    const c = this.canonizar(qtd, unidade);
    return db.upsert('price_obs', {
      product_id: product_id || null,
      item_id: item_id || null,
      store_id: store_id || null,
      data: data || db.hojeISO(),
      preco_total: Number(preco_total),
      qtd: Number(qtd),
      unidade: this.normalizarUnidade(unidade),
      qtd_canonica: c.qtd * (Number(embalagens) || 1),
      unidade_base: pb.unidade,
      preco_base: pb.valor,
      origem: origem || 'digitado',
      foto_id: foto_id || null,
      nfce_chave: nfce_chave || null,
    });
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Precos };
