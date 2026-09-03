/* CESTA — o planejamento: a lista que se monta sozinha, a projeção do mês e o
   conselheiro.

   É a parte do app que trabalha ENQUANTO a pessoa não está olhando. Se ela
   precisar pedir, não é assistente — é ferramenta. */
'use strict';

const Planejar = {

  /* ============================ A LISTA QUE SE MONTA SOZINHA ============ */

  /* Propõe o que deveria entrar numa compra planejada, de três fontes:

       1. o que a despensa diz que vai faltar até o dia da compra;
       2. os recorrentes daquele ciclo (papel higiênico no rancho, pão na semanal);
       3. o que a cadência diz que está na hora, mesmo sem saldo estimável.

     PROPÕE, NUNCA APLICA. Toda sugestão vem para revisão, com o motivo escrito.
     É a mesma regra do casamento da NFC-e — lá, aplicar sozinho errou 19
     lançamentos e R$ 5.322 no DOMI. Aqui o custo de errar é a pessoa comprar o
     que já tem, que é exatamente o que este recurso existe para evitar. */
  sugerirPara(db, plano) {
    const dias = Math.max(0, db.diasAte(plano.data));
    const naLista = new Set(
      (plano.list_id ? db.itensDaLista(plano.list_id) : []).map(li => li.item_id));

    const sugestoes = [];
    const vistos = new Set();

    const juntar = (item_id, motivo, texto, peso) => {
      if (!item_id || vistos.has(item_id) || naLista.has(item_id)) return;
      const item = db.get('items', item_id);
      if (!item) return;
      vistos.add(item_id);
      sugestoes.push({ item, item_id, motivo, texto, peso });
    };

    // 1. o que acaba antes da compra
    for (const s of Despensa.acabando(db, { ateDias: dias + 2 })) {
      const quando = s.motivo === 'saldo'
        ? (s.diasParaAcabar <= 0 ? 'deve ter acabado' : `acaba em ~${s.diasParaAcabar} dias`)
        : 'passou do seu ritmo de compra';
      juntar(s.item_id, 'acabando', quando, 100 + Math.max(0, 30 - (s.diasParaAcabar || 0)));
    }

    // 2. os recorrentes do ciclo
    for (const r of db.recorrentesDo(plano.ciclo)) {
      juntar(r.item_id, 'recorrente', 'entra em toda ' + (DB_CICLO_NOME[plano.ciclo] || 'compra'), 90);
    }

    // 3. a cadência, para o que não tem saldo estimável
    for (const item of db.all('items')) {
      const c = Precos.cadencia(db, item.id);
      if (c && c.acabando) juntar(item.id, 'cadencia', `você costuma comprar a cada ${c.intervalo} dias`, 70);
    }

    return sugestoes.sort((a, b) => b.peso - a.peso);
  },

  /* Aplica as sugestões que a pessoa confirmou. Só as confirmadas — a função
     nem aceita "todas" como atalho, para não existir o caminho fácil de
     aplicar sem revisar. */
  aplicarSugestoes(db, plano, itemIds) {
    if (!plano.list_id) return 0;
    let n = 0;
    for (const id of itemIds) {
      const item = db.get('items', id);
      if (!item) continue;
      db.addNaLista(plano.list_id, {
        item_id: id, qtd: item.qtd_habitual || 1, unidade: item.unidade || 'un',
      });
      n++;
    }
    return n;
  },

  /* ================================ O CUSTO PREVISTO DA LISTA ========== */

  /* Quanto a lista deve custar, pela mediana de cada item. Separa o que TEM
     referência do que não tem: somar zero pelo que falta faria a estimativa
     parecer completa quando não é. */
  custoPrevisto(db, list_id) {
    let previsto = 0, comBase = 0, semBase = 0;
    for (const li of db.itensDaLista(list_id)) {
      if (li.nao_tinha) continue;
      if (li.comprado && isFinite(li.preco_total)) { previsto += Number(li.preco_total); comBase++; continue; }
      const ref = Precos.referencia(db, { product_id: li.product_id, item_id: li.item_id });
      const c = Precos.canonizar(li.qtd, li.unidade);
      if (ref.n && ref.mediana != null && c && ref.unidade === c.unidade) {
        previsto += ref.mediana * c.qtd;
        comBase++;
      } else semBase++;
    }
    return { previsto, comBase, semBase };
  },

  /* ================================== A PROJEÇÃO DO MÊS ================= */

  /* Quanto o mês deve fechar, no ritmo atual.

     NÃO É REGRA DE TRÊS SOBRE O TOTAL. No DOMI, o run-rate ingênuo projetou
     R$ 162.807 num mês de R$ 17.981 de renda — porque uma compra grande no dia
     3 vira "você vai gastar isso dez vezes". Aqui a projeção é:

         o que JÁ GASTOU  +  o que as compras PLANEJADAS devem custar
                          +  o ritmo do dia a dia sobre os dias que faltam

     O dia a dia é o único pedaço que se extrapola, e ele é pequeno e regular —
     que é exatamente onde extrapolar faz sentido. */
  projecaoDoMes(db, { hoje } = {}) {
    const hojeIso = hoje || db.hojeISO();
    const mes = db.mesDe(hojeIso);
    const [ano, m] = mes.split('-').map(Number);
    const diasNoMes = new Date(ano, m, 0).getDate();
    const diaDeHoje = Number(hojeIso.slice(8, 10));
    const faltam = Math.max(0, diasNoMes - diaDeHoje);

    // 1. o que já saiu: compras fechadas + notas importadas (sem contar duas vezes)
    const gasto = ViewHistorico.gastoDoMes(mes);

    // 2. o que está planejado e ainda vai acontecer neste mês
    let planejado = 0;
    for (const p of db.planosAbertos()) {
      if (db.mesDe(p.data) !== mes || p.data < hojeIso) continue;
      const doPlano = p.list_id ? this.custoPrevisto(db, p.list_id).previsto : 0;
      // Sem lista montada ainda, vale o orçamento do plano — é o que a pessoa
      // pretende gastar, e ignorá-lo faria a projeção mentir para baixo.
      planejado += doPlano || Number(p.orcamento) || 0;
    }

    // 3. o ritmo do dia a dia, e SÓ ele
    const gastoDiaADia = db.listasFechadas()
      .filter(l => db.mesDe(l.data_fechamento) === mes && (l.ciclo === 'dia' || !l.ciclo))
      .reduce((s, l) => s + (l.total_cupom || db.totalDoCarrinho(l.id, () => null).firme), 0);
    const ritmoDia = diaDeHoje > 0 ? gastoDiaADia / diaDeHoje : 0;
    const doDiaADia = ritmoDia * faltam;

    const projetado = gasto + planejado + doDiaADia;
    const orcamento = db.orcamentoDoMes(mes);

    return {
      mes, gasto, planejado, doDiaADia, projetado,
      orcamento,
      sobra: orcamento != null ? orcamento - projetado : null,
      estoura: orcamento != null && projetado > orcamento,
      diasNoMes, faltam,
      /* A situação em uma palavra, para o selo. Sem orçamento não há situação a
         declarar — e inventar uma seria opinar sobre o dinheiro de alguém. */
      situacao: orcamento == null ? 'sem_orcamento'
        : projetado > orcamento ? 'estoura'
        : projetado > orcamento * 0.9 ? 'atencao' : 'tranquilo',
    };
  },

  /* ===================================== O CONSELHEIRO ================== */

  /* No máximo TRÊS avisos, e só os que têm ação. Um painel que avisa de tudo
     não avisa de nada: a pessoa aprende a passar os olhos e o aviso importante
     morre junto com os outros.

     Cada conselho tem: gravidade, texto em português claro, e o que fazer. */
  conselhos(db, { hoje, limite = 3 } = {}) {
    const lista = [];
    const hojeIso = hoje || db.hojeISO();

    // 1. o orçamento do mês em risco
    const proj = this.projecaoDoMes(db, { hoje: hojeIso });
    if (proj.estoura) {
      lista.push({
        peso: 100, selo: 'red', ico: 'alerta',
        titulo: `O mês deve fechar em ${UI.fmt(proj.projetado)}`,
        texto: `São ${UI.fmt(Math.abs(proj.sobra))} acima do que você planejou. Dá para revisar a próxima lista.`,
        acao: 'plano',
      });
    } else if (proj.situacao === 'atencao') {
      lista.push({
        peso: 70, selo: 'amber', ico: 'alerta',
        titulo: 'O mês está apertado',
        texto: `Na projeção sobram ${UI.fmt(proj.sobra)} — menos de 10% do previsto.`,
        acao: 'plano',
      });
    }

    // 2. a compra está chegando e a lista está magra
    const plano = db.proximoPlano();
    if (plano) {
      const dias = db.diasAte(plano.data);
      const nLista = plano.list_id ? db.itensDaLista(plano.list_id).length : 0;
      const sugeridos = this.sugerirPara(db, plano).length;
      if (dias >= 0 && dias <= 3 && sugeridos > 0) {
        lista.push({
          peso: 95, selo: 'blue', ico: 'lista',
          titulo: dias === 0 ? 'A compra é hoje' : `Faltam ${dias} dias para a compra`,
          texto: `Sua lista tem ${nLista} ${nLista === 1 ? 'item' : 'itens'} e há ${sugeridos} sugestões esperando revisão.`,
          acao: 'revisar',
        });
      }
    }

    // 3. o que já acabou
    const acabou = Despensa.acabando(db, { ateDias: 0, hoje: hojeIso });
    if (acabou.length) {
      lista.push({
        peso: 85, selo: 'amber', ico: 'despensa',
        titulo: `${acabou.length} ${acabou.length === 1 ? 'item acabou' : 'itens acabaram'}`,
        texto: acabou.slice(0, 3).map(s => s.item.nome).join(', ') + (acabou.length > 3 ? '…' : ''),
        acao: 'despensa',
      });
    }

    // 4. o que provavelmente estragou — desperdício é o gasto invisível
    const venceu = Despensa.vencendo(db, { hoje: hojeIso });
    if (venceu.length >= 2) {
      lista.push({
        peso: 60, selo: 'blue', ico: 'despensa',
        titulo: `${venceu.length} itens podem ter estragado`,
        texto: venceu.slice(0, 3).map(s => s.item.nome).join(', ') + '. Vale conferir antes de comprar de novo.',
        acao: 'despensa',
      });
    }

    // 5. um produto que subiu forte
    const mes = db.mesDe(hojeIso);
    const anterior = ViewHistorico.mesAnterior(mes);
    for (const p of Precos.maisSubiram(db, anterior, mes, { limite: 1 })) {
      if (p.variacao < 0.15) break;
      const prod = db.get('products', p.product_id);
      const item = prod ? db.get('items', prod.item_id) : null;
      lista.push({
        peso: 55, selo: 'red', ico: 'historico',
        titulo: `${item ? item.nome : 'Um produto'} subiu ${Math.round(p.variacao * 100)}%`,
        texto: `De ${UI.fmt(p.de)} para ${UI.fmt(p.para)} por unidade. Vale procurar outra marca ou outro mercado.`,
        acao: 'analise',
      });
    }

    // 6. a embalagem encolheu — o aumento que ninguém enxerga sozinho
    for (const prod of db.all('products')) {
      const e = Precos.encolhimento(db, prod.id);
      if (e && e.encolheuPct > 0.05 && e.precoEtiquetaIgual) {
        const item = db.get('items', prod.item_id);
        lista.push({
          peso: 65, selo: 'blue', ico: 'alerta',
          titulo: `A embalagem de ${item ? item.nome : 'um produto'} encolheu`,
          texto: `De ${Despensa.fmtQtd(e.de, e.unidade)} para ${Despensa.fmtQtd(e.para, e.unidade)} pelo mesmo preço — ${Math.round(e.subiuPorBase * 100)}% mais caro por ${e.unidade}.`,
          acao: 'analise',
        });
        break;
      }
    }

    return lista.sort((a, b) => b.peso - a.peso).slice(0, limite);
  },
};

/* O nome do ciclo, para as frases do conselheiro. Fica aqui e não em db.js
   porque é texto de tela, não regra de dados. */
const DB_CICLO_NOME = {
  mensal: 'compra do mês',
  semanal: 'compra da semana',
  dia: 'ida rápida',
  evento: 'lista de evento',
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Planejar, DB_CICLO_NOME };
