/* CESTA — a importação: dedupe, casamento e o vínculo aprendido.

   A LIÇÃO QUE JÁ FOI PAGA: no app de finanças, casar descrição automaticamente
   ERROU 19 LANÇAMENTOS, R$ 5.322 — "PAGSEGURO INTERNET IP S.A." virava internet
   fixa e "ARAGUARI" virava conta de água. A regra que ficou de lá, e vale aqui
   igual: CASAR SÓ PARA SUGERIR, NUNCA PARA APLICAR SOZINHO.

   A descrição vem do PDV da loja, abreviada e sem padrão — `ARR TIO JOAO T1
   5KG`, `QJO MUSS FAT KG` —, e cada rede escreve do seu jeito. Por isso:

     1. EAN primeiro. Quando a nota traz o GTIN, o casamento é exato.
     2. Sem EAN, o app PROPÕE e a pessoa confirma em lote.
     3. O vínculo confirmado é APRENDIDO: (loja, texto do PDV) → produto. A
        segunda nota da mesma rede chega quase toda resolvida, e o esforço é
        decrescente — que é o que faz alguém importar a terceira nota. */
'use strict';

const Importar = {

  /* --------------------------------------------------- normalização --- */

  /* Reduz o texto do PDV a uma forma comparável: sem acento, sem pontuação,
     sem espaço duplo. Não tira abreviação — "ARR" continua "ARR" —, porque
     adivinhar abreviação é exatamente o que produziu os 19 erros. */
  normalizar(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /* A unidade do PDV vem torta: UN, KG, PC, CX, LT, DZ. O mapa está em
     Precos.SINONIMOS e é EXPLÍCITO: o que não está lá devolve null e o item
     fica de fora da comparação de preço, em vez de virar 'un' por omissão.

     Uma unidade chutada envenena a mediana daquele produto para sempre, e é um
     defeito que ninguém consegue enxergar depois. */
  unidadeDoPDV(u) { return Precos.normalizarUnidade(u); },

  /* Tenta arrancar o tamanho da embalagem do próprio texto: "ARROZ TIO JOAO
     5KG" → 5 kg. É uma SUGESTÃO que aparece preenchida na tela de revisão, e
     nunca uma decisão silenciosa. */
  tamanhoNoTexto(descricao) {
    const t = this.normalizar(descricao);
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*(KG|G|GR|ML|L|LT|UN|PC)\b/);
    if (!m) return null;
    const qtd = Number(String(m[1]).replace(',', '.'));
    const un = this.unidadeDoPDV(m[2]);
    if (!un || !isFinite(qtd) || qtd <= 0) return null;
    return { qtd, unidade: un };
  },

  /* ------------------------------------------------------ casamento --- */

  /* Devolve o vínculo APRENDIDO para este texto nesta loja, se houver.
     Aprendido é diferente de adivinhado: alguém já confirmou este exato texto. */
  aliasDe(store_id, descricao) {
    const chave = this.normalizar(descricao);
    return DB.all('aliases').find(a => a.texto_pdv === chave &&
      (a.store_id === store_id || a.store_id == null)) || null;
  },

  /* A sugestão de produto para uma linha da nota, em cascata de confiança.
     Cada nível DIZ o que é, e a tela mostra isso: "aprendido" entra marcado,
     "palpite" entra desmarcado e esperando confirmação. */
  sugerir(store_id, linha) {
    // 1. EAN: identidade exata, sem adivinhação nenhuma
    if (linha.ean) {
      const p = DB.all('products').find(x => x.ean === linha.ean);
      if (p) return { product_id: p.id, item_id: p.item_id, confianca: 'ean', auto: true };
    }
    // 2. Vínculo já confirmado por uma pessoa para este texto nesta loja
    const alias = this.aliasDe(store_id, linha.descricao);
    if (alias) {
      const p = DB.get('products', alias.product_id);
      if (p) return { product_id: p.id, item_id: p.item_id, confianca: 'aprendido', auto: true };
    }
    // 3. Nome INTEIRO batendo com um item do catálogo. Comparar o nome inteiro,
    //    e não pedaços, é o que impede "ARAGUARI" de virar conta de água.
    const chave = this.normalizar(linha.descricao);
    const item = DB.all('items').find(i => this.normalizar(i.nome) === chave);
    if (item) return { item_id: item.id, product_id: null, confianca: 'nome', auto: false };

    // 4. Nada. A pessoa decide — e é o caso normal na primeira nota.
    return { item_id: null, product_id: null, confianca: 'nenhuma', auto: false };
  },

  /* ------------------------------------------------------- preparar --- */

  /* Transforma a nota lida numa lista de linhas prontas para a tela de revisão.
     Não grava nada: preparar e gravar são passos separados de propósito, para a
     pessoa poder desistir depois de ver o que vai entrar. */
  preparar(nota, store_id) {
    return nota.itens.map((linha, i) => {
      const sug = this.sugerir(store_id, linha);
      const tamanho = this.tamanhoNoTexto(linha.descricao);
      const unNota = this.unidadeDoPDV(linha.unidade);

      /* A quantidade que importa para o preço por unidade canônica:
         - unidade de peso/volume na nota (KG, L) → a própria quantidade
         - unidade de contagem (UN, PC) com tamanho no texto → o tamanho
         O segundo caso é o que faz "6 UN de refrigerante 2L" virar 12 L. */
      let qtd = null, unidade = null;
      if (unNota && unNota !== 'un') { qtd = linha.qtd; unidade = unNota; }
      else if (tamanho) { qtd = tamanho.qtd * (linha.qtd || 1); unidade = tamanho.unidade; }
      else if (unNota === 'un') { qtd = linha.qtd; unidade = 'un'; }

      return {
        i,
        descricao: linha.descricao,
        ean: linha.ean,
        valorTotal: linha.valorTotal,
        qtdNota: linha.qtd,
        unidadeNota: linha.unidade,
        qtd, unidade,
        item_id: sug.item_id,
        product_id: sug.product_id,
        confianca: sug.confianca,
        /* MARCADO NÃO É APLICADO. Vem marcado o que tem identidade exata (EAN)
           ou já foi confirmado antes; o resto vem desmarcado e a pessoa decide.
           Sem isso, uma nota de 60 itens entraria com 60 palpites. */
        incluir: sug.auto,
        /* Nome sugerido para quando a pessoa aceitar criar o item: o texto do
           PDV mesmo, que ela edita se quiser. Inventar um nome "bonito" a
           partir da abreviação é adivinhação com outro nome. */
        nomeSugerido: linha.descricao,
        problema: !unidade ? 'unidade desconhecida' : (!linha.valorTotal ? 'sem valor' : null),
      };
    });
  },

  /* -------------------------------------------------------- gravar --- */

  jaImportada(chave) {
    return chave ? DB.all('nfce_docs').some(d => d.chave === chave) : false;
  },

  /* Grava a nota. Só as linhas marcadas entram, e cada confirmação vira alias
     para a próxima importação daquela loja. */
  gravar(nota, linhas, store_id) {
    /* DEDUPE PELA CHAVE DE ACESSO. Reimportar o mesmo arquivo não pode duplicar
       nada — é o `fitid` do OFX. Sem isso, importar duas vezes dobraria o preço
       de tudo e a mediana ficaria envenenada sem sinal nenhum na tela. */
    if (this.jaImportada(nota.chave)) {
      return { erro: 'ja_importada', chave: nota.chave };
    }

    const data = nota.data || DB.hojeISO();
    let gravadas = 0, ignoradas = 0;

    for (const l of linhas) {
      if (!l.incluir || l.problema || !l.qtd || !l.unidade || !l.valorTotal) { ignoradas++; continue; }

      // O item nasce aqui quando a pessoa aceitou criar
      let item_id = l.item_id;
      if (!item_id) {
        const item = DB.itemPorNome(l.nomeSugerido || l.descricao, { unidade: l.unidade });
        item_id = item.id;
      }

      // E o produto, quando há EAN ou marca a distinguir
      let product_id = l.product_id;
      if (!product_id && (l.ean || l.qtd)) {
        const existente = l.ean ? DB.all('products').find(p => p.ean === l.ean) : null;
        product_id = existente ? existente.id : DB.upsert('products', {
          item_id,
          marca: null,
          embalagem_qtd: l.qtd,
          embalagem_unidade: l.unidade,
          ean: l.ean || null,
          descricao_pdv: l.descricao,
        }).id;
      }

      Precos.registrar(DB, {
        product_id, item_id, store_id,
        data,
        preco_total: l.valorTotal,
        qtd: l.qtd,
        unidade: l.unidade,
        origem: 'nfce',
        nfce_chave: nota.chave || null,
      });
      gravadas++;

      /* O VÍNCULO APRENDIDO. É isto que faz a segunda nota da mesma rede chegar
         quase pronta — e é a diferença entre importar duas notas e importar o
         ano inteiro. */
      if (product_id && store_id) {
        const chave = this.normalizar(l.descricao);
        const ja = DB.all('aliases').find(a => a.texto_pdv === chave && a.store_id === store_id);
        if (!ja) DB.upsert('aliases', { store_id, texto_pdv: chave, product_id });
      }
    }

    DB.upsert('nfce_docs', {
      chave: nota.chave || ('sem-chave-' + Date.now()),
      store_id,
      data,
      total: nota.total || null,
      itens_importados: gravadas,
      formato: nota.formato,
    });

    return { gravadas, ignoradas, data };
  },

  /* A loja da nota: acha pelo CNPJ, senão pelo nome, senão cria.
     Preço sem loja é um número que não se pode explicar depois. */
  lojaDaNota(nota) {
    const dados = nota.chave ? NFCe.dadosDaChave(nota.chave) : null;
    if (dados && dados.cnpj) {
      const porCnpj = DB.all('stores').find(s => s.cnpj === dados.cnpj);
      if (porCnpj) return porCnpj;
    }
    if (nota.loja) {
      const chave = this.normalizar(nota.loja);
      const porNome = DB.all('stores').find(s => this.normalizar(s.nome) === chave);
      if (porNome) {
        if (dados && dados.cnpj && !porNome.cnpj) DB.upsert('stores', { id: porNome.id, cnpj: dados.cnpj });
        return porNome;
      }
    }
    if (!nota.loja && !(dados && dados.cnpj)) return null;
    return DB.upsert('stores', { nome: nota.loja || 'Mercado', cnpj: dados ? dados.cnpj : null });
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Importar };
