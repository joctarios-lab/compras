/* CESTA — a despensa DERIVADA.

   POR QUE ELA NÃO É UM INVENTÁRIO. Todo app de despensa que já morreu, morreu
   pedindo que alguém mantivesse o dado: abrir o app depois do jantar e dar
   baixa em 200 g de arroz. Ninguém faz isso por duas semanas. O dado apodrece,
   e um app que mostra dado podre é pior que um app sem o recurso.

   COMO ESTA FUNCIONA, sem pedir nada:
     ENTRADA   fechar uma compra ou importar uma NFC-e põe o item em casa.
     SAÍDA     o consumo sai da CADÊNCIA que o app já calcula — se você compra
               5 kg de arroz a cada 30 dias, consome ~1,2 kg por semana.
     CORREÇÃO  um toque ajusta a quantidade, e a correção ENSINA: ela vira um
               ponto de partida novo, e a estimativa melhora.

   TRÊS REGRAS QUE NÃO SE NEGOCIAM:

   1. É DERIVADA E RECALCULÁVEL DO ZERO. Nada aqui é fonte da verdade — a
      verdade é price_obs mais as correções. Se o cálculo mudar amanhã, a
      despensa inteira se refaz sem migração e sem dado órfão.

   2. QUANDO NÃO SOUBER, CALA A BOCA. Item sem histórico que sustente uma
      cadência não entra na previsão. É a mesma regra do ⚪ do diagnóstico:
      assistente que chuta é pior que assistente nenhum.

   3. TODO NÚMERO MOSTRA A CONTA. "Comprou 5 kg em 12/09, consome ~1,2 kg por
      semana, deve acabar em 4 dias." Quem não pode auditar não confia — e aqui
      a estimativa vai errar às vezes, por construção. */
'use strict';

/* Quanto tempo cada tipo de coisa dura em casa. É por CORREDOR porque o
   corredor já diz muito: hortifrúti estraga em dias, mercearia dura meses.

   Isto não vira validade impressa na tela como se fosse verdade — serve para
   duas coisas: não dizer que você "tem alface em casa" três semanas depois de
   comprar, e avisar o que está perto de estragar. */
const DURACAO_TIPICA = {
  hortifruti: 7,
  padaria: 3,
  acougue: 5,       // na geladeira; congelado dura mais, e o app não sabe disso
  frios: 15,
  congelados: 90,
  bebidas: 180,
  mercearia: 180,
  limpeza: 365,
  higiene: 365,
  outros: 90,
};

/* Corredores cujo produto NÃO SE ESTOCA de verdade: comprar não significa "ter
   em casa" pelas próximas semanas. Eles entram na lista por RITMO ("você compra
   pão toda semana"), nunca por saldo. */
const PERECIVEIS = ['hortifruti', 'padaria', 'acougue'];

const Despensa = {

  DURACAO_TIPICA,
  PERECIVEIS,

  duracaoDe(item) {
    const c = item && item.categoria;
    return DURACAO_TIPICA[c] != null ? DURACAO_TIPICA[c] : DURACAO_TIPICA.outros;
  },

  ehPerecivel(item) { return PERECIVEIS.includes(item && item.categoria); },

  /* ---------------------------------------------------- as entradas --- */

  /* Tudo o que entrou em casa para um item, em ordem. Vem de price_obs, que já
     registra toda compra e toda nota importada — por isso a despensa não pede
     nenhum cadastro novo.

     A DEDUPLICAÇÃO IMPORTA: fechar a compra no app e depois importar o cupom
     da mesma ida ao mercado são o MESMO evento. Contar duas vezes faria o app
     dizer que você tem 10 kg de arroz quando tem 5 — e mandaria você não
     comprar arroz. */
  entradasDe(db, item_id) {
    const vistas = new Set();
    return db.all('price_obs')
      .filter(o => o.item_id === item_id && isFinite(o.qtd_canonica) && o.qtd_canonica > 0)
      .filter(o => {
        // mesma loja + mesmo dia + mesma quantidade = mesma compra registrada duas vezes
        const chave = `${o.store_id || '-'}|${o.data}|${o.qtd_canonica}`;
        if (vistas.has(chave)) return false;
        vistas.add(chave);
        return true;
      })
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  },

  /* A correção manual mais recente. Ela é um MARCO: a partir dela, o que veio
     antes não conta mais — a pessoa olhou o armário e disse o que havia. */
  correcaoDe(db, item_id) {
    return db.all('pantry_fix')
      .filter(c => c.item_id === item_id)
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || null;
  },

  corrigir(db, item_id, qtd, unidade) {
    return db.upsert('pantry_fix', {
      item_id,
      qtd: Number(qtd),
      unidade: unidade || null,
      data: db.hojeISO(),
    });
  },

  /* ----------------------------------------------- o saldo estimado --- */

  /* Quanto deve haver em casa de um item, hoje.

     A conta: parte do último marco (uma correção, ou a última compra), soma o
     que entrou depois e subtrai o consumo do período. Devolve SEMPRE a conta
     junto do número — sem ela, é palpite com cara de fato. */
  saldoDe(db, item_id, { hoje } = {}) {
    const item = db.get('items', item_id);
    if (!item) return null;

    const hojeIso = hoje || db.hojeISO();
    const entradas = this.entradasDe(db, item_id);
    const correcao = this.correcaoDe(db, item_id);
    if (!entradas.length && !correcao) return null;

    const cad = Precos.cadencia(db, item_id, { hoje: hojeIso });
    const unidade = (entradas[0] && entradas[0].unidade_base) || item.unidade || 'un';

    /* O marco: a correção manual vence a compra, porque alguém OLHOU o armário.
       Sem correção, o marco é a primeira entrada. */
    const marcoData = correcao ? correcao.data : entradas[0].data;
    const marcoQtd = correcao ? Number(correcao.qtd) : 0;

    const entrou = entradas
      .filter(e => e.data >= marcoData && !(correcao && e.data === correcao.data && e.data < hojeIso))
      .reduce((s, e) => s + e.qtd_canonica, 0);

    const dias = Math.max(0, Math.round(
      (new Date(hojeIso + 'T12:00:00') - new Date(marcoData + 'T12:00:00')) / 864e5));

    /* O CONSUMO POR DIA sai da cadência: comprar 5 kg a cada 30 dias significa
       consumir 5 kg em 30 dias. Sem cadência (menos de duas compras) não há
       consumo estimável — e aí o app não estima nada. */
    let consumoDia = null;
    if (cad && cad.intervalo > 0) {
      const medias = entradas.map(e => e.qtd_canonica);
      const porCompra = Precos.mediana(medias) || 0;
      consumoDia = porCompra / cad.intervalo;
    }

    const total = marcoQtd + entrou;
    const consumido = consumoDia != null ? consumoDia * dias : null;
    const saldo = consumido != null ? Math.max(0, total - consumido) : null;

    /* PERECÍVEL NÃO TEM SALDO. Dizer que você "tem alface" três semanas depois
       de comprar seria mentira com cara de dado. Ele se acompanha por ritmo. */
    const perecivel = this.ehPerecivel(item);
    const validade = this.duracaoDe(item);
    const diasDesdeUltima = entradas.length
      ? Math.round((new Date(hojeIso + 'T12:00:00') - new Date(entradas[entradas.length - 1].data + 'T12:00:00')) / 864e5)
      : null;

    return {
      item_id, item, unidade,
      perecivel,
      /* saldo null = "não sei", e a tela precisa dizer isso em palavras em vez
         de mostrar zero. Zero é uma afirmação: significa "acabou". */
      saldo: perecivel ? null : saldo,
      total, consumido, consumoDia,
      dias, marcoData, marcoQtd,
      corrigido: !!correcao,
      entradas: entradas.length,
      ultimaCompra: entradas.length ? entradas[entradas.length - 1].data : null,
      diasDesdeUltima,
      /* Dias até acabar. É o número que a página HOJE usa para dizer o que
         está acabando — e o que faz o app antecipar em vez de reagir. */
      diasParaAcabar: (!perecivel && saldo != null && consumoDia > 0)
        ? Math.floor(saldo / consumoDia) : null,
      /* Perecível: o que importa é se passou da validade típica. */
      vencido: perecivel && diasDesdeUltima != null && diasDesdeUltima > validade,
      validadeTipica: validade,
      cadencia: cad,
      /* A conta, em uma frase. Sem isso o número é palpite com cara de fato. */
      explicacao: this.explicar({ item, correcao, entradas, cad, consumoDia, unidade, saldo, perecivel, diasDesdeUltima }),
    };
  },

  explicar({ item, correcao, entradas, cad, consumoDia, unidade, saldo, perecivel, diasDesdeUltima }) {
    if (perecivel) {
      return diasDesdeUltima == null
        ? `${item.nome} estraga rápido — o app acompanha pelo seu ritmo de compra, não por quanto sobrou.`
        : `Última compra faz ${diasDesdeUltima} ${diasDesdeUltima === 1 ? 'dia' : 'dias'}. Perecível: o app não estima o que sobrou.`;
    }
    if (saldo == null) {
      return entradas.length < 2
        ? 'Ainda não dá para estimar: são precisas ao menos duas compras para saber o seu ritmo.'
        : 'Sem ritmo de consumo estimável ainda.';
    }
    const base = correcao
      ? `Você corrigiu para ${this.fmtQtd(correcao.qtd, unidade)} em ${this.dataBR(correcao.data)}`
      : `Comprou ${this.fmtQtd(entradas[entradas.length - 1].qtd_canonica, unidade)} em ${this.dataBR(entradas[entradas.length - 1].data)}`;
    const ritmo = consumoDia > 0
      ? `, e consome cerca de ${this.fmtQtd(consumoDia * 7, unidade)} por semana`
      : '';
    return base + ritmo + '.';
  },

  fmtQtd(q, unidade) {
    const n = Number(q) || 0;
    if ((unidade === 'kg' || unidade === 'L') && n < 1) {
      return `${Math.round(n * 1000)} ${unidade === 'kg' ? 'g' : 'ml'}`;
    }
    return `${Number(n.toFixed(2))} ${unidade}`;
  },

  dataBR(iso) {
    const [a, m, d] = String(iso).split('-');
    return `${d}/${m}`;
  },

  /* ------------------------------------------------------ a despensa --- */

  /* Tudo o que se sabe que há em casa. Recalculada do zero a cada chamada — é
     de propósito: não existe estado a manter, nem migração a fazer quando a
     regra mudar. */
  tudo(db, { hoje } = {}) {
    return db.all('items')
      .map(i => this.saldoDe(db, i.id, { hoje }))
      .filter(Boolean);
  },

  /* O QUE ESTÁ ACABANDO — o bloco mais importante da página HOJE.

     Dois caminhos, porque as duas metades da despensa se comportam diferente:
       - o que se estoca: acaba quando o saldo chega perto do fim;
       - o perecível: "acaba" quando passou o ritmo de compra habitual.

     `ateDias` é a janela: numa compra que acontece em 5 dias, interessa o que
     falta até lá, não o que falta hoje. É o que faz a lista do rancho já vir
     com o que vai acabar ANTES da próxima ida. */
  acabando(db, { ateDias = 7, hoje } = {}) {
    const saida = [];
    for (const s of this.tudo(db, { hoje })) {
      if (s.perecivel) {
        // Perecível: entra pelo ritmo. Sem cadência, não entra — silêncio.
        if (!s.cadencia) continue;
        const passou = s.diasDesdeUltima + ateDias >= s.cadencia.intervalo * 0.85;
        if (passou) saida.push({ ...s, motivo: 'ritmo', urgencia: s.diasDesdeUltima - s.cadencia.intervalo });
        continue;
      }
      if (s.diasParaAcabar == null) continue;
      if (s.diasParaAcabar <= ateDias) {
        saida.push({ ...s, motivo: 'saldo', urgencia: -s.diasParaAcabar });
      }
    }
    // O mais urgente primeiro: quem já acabou vem antes de quem acaba em 5 dias
    return saida.sort((a, b) => b.urgencia - a.urgencia);
  },

  /* O que provavelmente estragou. Vale dinheiro: desperdício é o gasto que
     ninguém contabiliza porque nunca aparece em nenhuma conta. */
  vencendo(db, { hoje } = {}) {
    return this.tudo(db, { hoje }).filter(s => s.vencido);
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Despensa, DURACAO_TIPICA, PERECIVEIS };
}
