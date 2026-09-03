/* CESTA — leitura de NFC-e.

   POR QUE ISTO É IMPORTAÇÃO DE ARQUIVO, E NÃO CONSULTA DIRETA:

   Não existe API pública nacional de consulta de NFC-e. Cada estado tem o seu
   portal, com URL própria — e essas URLs mudam (MG e PB já trocaram as suas).
   Vários estados exigem captcha. E o CORS bloqueia o fetch direto do navegador:
   um PWA não consegue, por conta própria, buscar a página do SEFAZ.

   Prometer "escaneou o QR, importou" sem servidor é prometer o que a plataforma
   não entrega. Então: o arquivo entra, o parse é local, e funciona offline —
   o mesmo padrão do importador OFX, que já provou ser sólido no app de
   finanças. Ver docs/pesquisa-mercado.md.

   TRÊS PARSERS, UMA SAÍDA. XML, HTML e CSV produzem a MESMA estrutura canônica,
   e daí para a frente existe um único caminho de importação. Três caminhos de
   gravação seria garantir que dois deles fiquem com defeito sem ninguém ver. */
'use strict';

const NFCe = {

  /* A chave de acesso: 44 dígitos. É o identificador único da nota — o `fitid`
     deste app —, e é o que impede reimportar a mesma nota duas vezes. */
  extrairChave(texto) {
    const bruto = String(texto || '');

    /* O RÓTULO VEM PRIMEIRO. Varrer o texto atrás dos primeiros 44 dígitos
       devolvia, no DANFE em PDF, o número + a série + o CNPJ + a IE + o CEP
       colados — 44 dígitos por coincidência, e a chave errada quebra o dedupe
       de um jeito invisível: duas notas da mesma loja gerariam a mesma chave
       falsa, e o app recusaria a segunda dizendo "já importada". */
    const comRotulo = bruto.match(
      /CHAVE\s*(?:DE\s*)?ACESSO[^0-9]{0,40}((?:\d[\s.]*){44})/i);
    if (comRotulo) {
      const so = comRotulo[1].replace(/\D/g, '');
      if (so.length === 44) return so;
    }

    /* Sem rótulo — o XML traz a chave no atributo Id — vale a varredura livre. */
    const s = bruto.replace(/\D/g, '');
    const m = s.match(/\d{44}/);
    return m ? m[0] : null;
  },

  /* A chave carrega a data (posições 3-6: AAMM) e o CNPJ do emitente (6-20).
     Ler daí é melhor que confiar no texto da página, que muda por estado. */
  dadosDaChave(chave) {
    if (!chave || chave.length !== 44) return null;
    const ano = 2000 + Number(chave.slice(2, 4));
    const mes = chave.slice(4, 6);
    return { uf: chave.slice(0, 2), ano, mes, cnpj: chave.slice(6, 20), numero: chave.slice(25, 34) };
  },

  /* ------------------------------------------------------------- XML --- */

  /* O melhor caminho: estruturado, com GTIN quando o emitente informa.
     Sem DOMParser (node), cai para expressão regular — o XML da NFC-e é gerado
     por máquina e tem forma estável, então é seguro aqui, ao contrário de HTML
     escrito por humano. */
  lerXML(texto) {
    const src = String(texto || '');
    if (!/<(det|infNFe)/i.test(src)) return null;

    const tag = (bloco, nome) => {
      const m = bloco.match(new RegExp('<' + nome + '[^>]*>([\\s\\S]*?)</' + nome + '>', 'i'));
      return m ? m[1].trim() : null;
    };

    const chave = this.extrairChave((src.match(/Id="?NFe(\d{44})"?/i) || [])[1] || src);
    const emitente = (src.match(/<emit[\s\S]*?<xNome>([\s\S]*?)<\/xNome>/i) || [])[1];
    const dataEmissao = ((src.match(/<dhEmi>([\s\S]*?)<\/dhEmi>/i) ||
                          src.match(/<dEmi>([\s\S]*?)<\/dEmi>/i) || [])[1] || '').slice(0, 10) || null;
    const total = Number((src.match(/<ICMSTot[\s\S]*?<vNF>([\s\S]*?)<\/vNF>/i) || [])[1]) || null;

    const itens = [];
    for (const m of src.matchAll(/<det[^>]*>([\s\S]*?)<\/det>/gi)) {
      const bloco = m[1];
      const prod = (bloco.match(/<prod[^>]*>([\s\S]*?)<\/prod>/i) || [])[1] || bloco;
      const ean = tag(prod, 'cEAN');
      itens.push({
        descricao: tag(prod, 'xProd') || '',
        codigo: tag(prod, 'cProd') || null,
        // "SEM GTIN" é o que o layout manda escrever quando não há código. Tratar
        // esse texto como um EAN casaria produtos completamente diferentes.
        ean: ean && /^\d{8,14}$/.test(ean) ? ean : null,
        qtd: Number(tag(prod, 'qCom')) || null,
        unidade: tag(prod, 'uCom') || null,
        valorUnitario: Number(tag(prod, 'vUnCom')) || null,
        valorTotal: Number(tag(prod, 'vProd')) || null,
      });
    }
    if (!itens.length) return null;
    return { chave, loja: emitente, data: dataEmissao, total, itens, formato: 'xml' };
  },

  /* ------------------------------------------------------------ HTML --- */

  /* A página de consulta salva do portal do estado. É o caminho que funciona
     hoje, sem servidor e sem captcha — o usuário abre a nota, salva a página e
     importa o arquivo.

     O layout varia por estado, então o parser é TOLERANTE: procura os padrões
     que os portais têm em comum (a tabela de itens, "Qtde.:", "Vl. Unit.:") e
     desiste explicitamente quando não reconhece, em vez de devolver lixo. */
  lerHTML(texto) {
    let src = String(texto || '');
    if (!/<[a-z]/i.test(src)) return null;

    const semTags = t => String(t).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ').trim();

    const numeroBR = t => {
      if (t == null) return null;
      const limpo = String(t).replace(/[^\d,.-]/g, '').trim();
      if (!limpo) return null;
      // 1.234,56 (br) vs 1234.56 (en): a vírgula manda quando existe
      const n = limpo.includes(',')
        ? Number(limpo.split('.').join('').replace(',', '.'))
        : Number(limpo);
      return isFinite(n) ? n : null;
    };

    const chave = this.extrairChave(semTags(src));
    const plano = semTags(src);

    const itens = [];
    /* Cada item da NFC-e vem numa linha de tabela com descrição, quantidade,
       unidade e valores. Percorremos as linhas e extraímos por rótulo, porque
       a ORDEM das colunas muda de estado para estado — a posição não é
       confiável, o rótulo é. */
    for (const tr of src.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const linha = tr[1];
      const t = semTags(linha);
      const qtd = numeroBR((t.match(/Qtde\.?\s*:?\s*([\d.,]+)/i) || [])[1]);
      const un = (t.match(/UN\s*:?\s*([A-Za-zçÇ]+)/i) || [])[1];
      const vUnit = numeroBR((t.match(/Vl\.?\s*Unit\.?\s*:?\s*([\d.,]+)/i) || [])[1]);
      const vTotal = numeroBR((t.match(/Vl\.?\s*Total\s*:?\s*([\d.,]+)/i) || [])[1]);
      if (qtd == null && vUnit == null) continue;

      // A descrição é o que vem antes do primeiro rótulo numérico
      let descricao = t.split(/\(C[óo]digo:/i)[0].split(/Qtde\.?\s*:/i)[0].trim();
      descricao = descricao.replace(/\s*\d+\s*$/, '').trim();
      if (!descricao) continue;

      const codigo = (t.match(/C[óo]digo:\s*([\w.-]+)/i) || [])[1] || null;
      itens.push({
        descricao,
        codigo,
        ean: codigo && /^\d{8,14}$/.test(codigo) ? codigo : null,
        qtd, unidade: un || null,
        valorUnitario: vUnit,
        valorTotal: vTotal != null ? vTotal : (qtd != null && vUnit != null ? qtd * vUnit : null),
      });
    }

    if (!itens.length) return null;

    const loja = (plano.match(/^([^\n]{3,80}?)\s*CNPJ/i) || [])[1] || null;
    const dataTxt = (plano.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1];
    const data = dataTxt ? dataTxt.split('/').reverse().join('-') : null;
    const total = numeroBR((plano.match(/Valor a pagar R\$\s*:?\s*([\d.,]+)/i) || [])[1]);

    return { chave, loja: loja && loja.trim(), data, total, itens, formato: 'html' };
  },

  /* ------------------------------------------------------------- CSV --- */

  /* O formato de escape universal: saída de qualquer planilha. Existe porque
     nenhum dos dois acima funciona em 100% dos casos, e ficar sem caminho
     nenhum é pior que digitar. */
  lerCSV(texto) {
    const linhas = String(texto || '').split(/\r?\n/).filter(l => l.trim());
    if (linhas.length < 2) return null;

    const sep = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ';' : ',';
    const cab = linhas[0].split(sep).map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''));
    const acha = (...nomes) => cab.findIndex(c => nomes.some(n => c.includes(n)));

    const iDesc = acha('descri', 'produto', 'item', 'nome');
    const iQtd = acha('qtd', 'quant');
    const iUn = acha('unid', 'un');
    const iVal = acha('total', 'valor');
    const iUnit = acha('unit');
    const iEan = acha('ean', 'gtin', 'barra');
    const iData = acha('data');
    if (iDesc < 0) return null;

    const num = t => {
      const s = String(t || '').replace(/[^\d,.-]/g, '');
      if (!s) return null;
      const n = s.includes(',') ? Number(s.split('.').join('').replace(',', '.')) : Number(s);
      return isFinite(n) ? n : null;
    };

    const itens = [];
    let data = null;
    for (const l of linhas.slice(1)) {
      const col = l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const descricao = col[iDesc];
      if (!descricao) continue;
      if (iData >= 0 && col[iData] && !data) {
        const d = col[iData];
        data = d.includes('/') ? d.split('/').reverse().join('-') : d.slice(0, 10);
      }
      const qtd = iQtd >= 0 ? num(col[iQtd]) : 1;
      const unit = iUnit >= 0 ? num(col[iUnit]) : null;
      const total = iVal >= 0 ? num(col[iVal]) : (qtd != null && unit != null ? qtd * unit : null);
      itens.push({
        descricao,
        codigo: null,
        ean: iEan >= 0 && /^\d{8,14}$/.test(String(col[iEan] || '')) ? col[iEan] : null,
        qtd: qtd == null ? 1 : qtd,
        unidade: iUn >= 0 ? col[iUn] : null,
        valorUnitario: unit,
        valorTotal: total,
      });
    }
    if (!itens.length) return null;
    return { chave: null, loja: null, data, total: null, itens, formato: 'csv' };
  },

  /* ------------------------------------------------------------- PDF ---

     VÁRIOS ESTADOS SÓ ENTREGAM PDF. O Rio Grande do Norte é um deles: não há
     XML para baixar, e a página de consulta é uma aplicação que não se salva de
     forma útil. Sem ler PDF, quem mora nesses estados não tem como trazer o
     histórico — e o app volta a ser "use por três meses e depois fica bom".

     O DANFE é uma TABELA, e o PDF não guarda tabela: guarda pedaços de texto
     com coordenadas. Extraído, cada célula vira uma linha, e o item fica assim,
     sempre nesta ordem:

         6                                  ← número do item
         43515                              ← código
         PRESUNTO PERU PERDIGAO KG          ← descrição
         5102                               ← CFOP
         16024900                           ← NCM
         0                                  ← CST/CSOSN
         0,286                              ← quantidade
         KG                                 ← unidade      ← A ÂNCORA
         28,99                              ← valor unitário
         8,29                               ← base de ICMS
         20,00                              ← alíquota
         1,66                               ← ICMS
         8,29                               ← valor total

     A ÂNCORA É A COLUNA DE UNIDADE, mas pela FORMA, não por uma lista de
     nomes. Ela é o único campo de texto no meio dos números, e é isso que a
     torna reconhecível: contar a partir do número do item quebraria no primeiro
     produto cuja descrição tem quebra de linha, e ancorar no valor quebraria em
     qualquer item com desconto.

     POR QUE NÃO UMA LISTA DE UNIDADES. Era o que eu tinha: UN, KG, L, PC, CX.
     Funcionou numa nota e falhou na seguinte — do MESMO estado, com o MESMO
     layout, de outro mercado. Porque a unidade não é um campo padronizado da
     NFC-e: é o que o supermercado cadastrou no sistema dele. Um cupom do WMS
     traz UND9, KG9, PCT9, BDJ9 (bandeja), VDO9 (vidro), PTE9 (pote), FRC9
     (frasco) — nenhum deles na minha lista, e o app dizia "não consegui ler
     este arquivo" sobre uma nota perfeita.

     Manter uma lista assim é prometer conhecer o cadastro de todo mercado do
     país. A forma, não. */

  /* A linha parece uma célula de unidade? Letras, com dígitos opcionais no fim
     (o UND9 do WMS), curta, e nunca um número. Reconhecer pela forma admite a
     unidade que ainda não vi — e a prova aritmética adiante é que decide se a
     linha é mesmo um item. */
  pareceUnidade(t) {
    if (t == null) return false;
    const s = String(t).trim();
    return s.length >= 1 && s.length <= 8 && /^[A-Za-zÀ-ÿ]{1,6}\d{0,2}$/.test(s);
  },

  /* O nome da unidade, sem o sufixo do sistema do mercado: UND9 → UND. O que
     ele significa — se vira 'un', 'kg' ou nada — é decisão do Precos, que tem
     o mapa explícito de sinônimos. Aqui só se remove o ruído. */
  limparUnidade(t) {
    return String(t || '').trim().replace(/\d+$/, '').toUpperCase() || null;
  },

  numeroBR(t) {
    if (t == null) return null;
    const limpo = String(t).replace(/[^\d,.-]/g, '').trim();
    if (!limpo) return null;
    // 1.234,56 (br) — a vírgula manda quando existe
    const n = limpo.includes(',')
      ? Number(limpo.split('.').join('').replace(',', '.'))
      : Number(limpo);
    return isFinite(n) ? n : null;
  },

  /* Só um número, e um número de dinheiro/quantidade — não um NCM de oito
     dígitos nem um CFOP de quatro, que também são "números" na linha. */
  soNumero(t) {
    if (t == null) return null;
    const s = String(t).trim();
    if (!/^[\d.,]+$/.test(s)) return null;
    return this.numeroBR(s);
  },

  lerPDF(texto) {
    const linhas = String(texto || '').split('\n').map(l => l.trim());
    if (!linhas.some(l => /DANFE|NFC-?e/i.test(l))) return null;

    const itens = [];

    for (let i = 0; i < linhas.length; i++) {
      if (!this.pareceUnidade(linhas[i])) continue;
      /* A célula de unidade fica ENTRE números: a quantidade antes, o valor
         depois. Sem esta checagem, toda palavra curta do cabeçalho ("Item",
         "Un", "Icms") viraria candidata e o trabalho todo cairia na aritmética. */
      if (this.soNumero(linhas[i - 1]) == null) continue;
      if (this.soNumero(linhas[i + 1]) == null) continue;

      /* O LAYOUT É DESCOBERTO, NÃO PRESUMIDO.

         Eu havia fixado as posições: quantidade em i-1, descrição em i-5,
         unitário em i+1, total em i+5. Isso é o DANFE do Rio Grande do Norte, e
         de mais nenhum. Cada Sefaz monta a tabela com as colunas que quer — uma
         traz base de cálculo, outra não; uma põe o CFOP antes da descrição,
         outra depois. Bastava trocar de estado para o parser achar zero itens e
         o app dizer "não consegui ler este arquivo", sobre uma nota perfeita.

         A saída não é uma tabela de layouts por estado — seriam 27 palpites a
         manter. É usar a ÚNICA relação que vale em toda nota fiscal do país:

             quantidade × valor unitário = valor total

         Essa igualdade identifica os papéis sozinha. Procura-se, na vizinhança
         da âncora, a combinação de três números que a satisfaz. Se existe, os
         papéis estão definidos por aritmética, não por contagem de linhas — e
         a mesma prova que descobre o layout impede o parser de inventar: uma
         combinação que não fecha simplesmente não vira item. */
      /* QUANTIDADE E UNITÁRIO NÃO SE PROCURAM: eles cercam a âncora.

         O cabeçalho do DANFE é `… Qtde | Un | Vl. unid. | … | Vl. total`, e
         essas três colunas são adjacentes por definição do layout — a variação
         entre estados está nas colunas de imposto que vêm DEPOIS do unitário.

         Eu tinha alargado a busca da quantidade para até quatro linhas atrás,
         "por robustez". O efeito foi o oposto: o CFOP (5102) e o NCM (04022110)
         viraram candidatos, e combinações absurdas passaram na folga de 2% —
         que é apertada em reais e larguíssima em dezenas de milhares. Um item
         saiu com quantidade 5.102 e total de R$ 260.886. Liberdade onde a
         estrutura já dava a resposta não é robustez, é ruído. */
      const qtd = this.soNumero(linhas[i - 1]);
      const valorUnitario = this.soNumero(linhas[i + 1]);
      if (qtd == null || qtd <= 0 || valorUnitario == null || valorUnitario <= 0) continue;

      /* SÓ O VALOR TOTAL É PROCURADO, porque só ele muda de lugar: entre o
         unitário e ele podem existir base de ICMS, alíquota e imposto — ou
         nada disso.

         Candidato precisa ter casa decimal: no DANFE todo valor em reais vem
         com duas. Sem essa exigência, o número do próximo item ("2") e o código
         dele entrariam na conta. A janela ainda para na primeira linha de
         texto, que é onde o item seguinte começa. */
      const esperado = qtd * valorUnitario;
      let melhor = null;
      for (let d = 2; d <= 8; d++) {
        const l = linhas[i + d];
        if (l == null) break;
        if (!l) continue;
        const n = this.soNumero(l);
        if (n == null) break;              // texto: o próximo item começou
        if (!/[.,]\d{2}$/.test(l)) continue;   // não é valor em reais
        if (n <= 0) continue;
        const erro = Math.abs(n - esperado);
        /* Folga de 2% ou 5 centavos: cobre arredondamento de peso variável e
           desconto de centavos, sem deixar passar uma coluna errada. */
        if (erro / esperado > 0.02 && erro > 0.05) continue;
        /* O MAIS À DIREITA entre os que fecham. Numa nota sem redução de base,
           a base de ICMS é igual ao total e vem antes dele: as duas fecham a
           conta, e pegar a mais próxima escolhia a base. Dá o mesmo número
           quase sempre — e o "quase" é justamente o item com base reduzida,
           onde entraria preço errado no histórico sem sinal nenhum. */
        melhor = { qtd, valorUnitario, valorTotal: n, dTotal: d };
      }
      if (!melhor) continue;
      melhor.dQtd = 1;

      /* A DESCRIÇÃO é a última linha ANTES da quantidade que não é número.

         Contá-la em posição fixa quebrava em qualquer nota cujo produto tenha o
         nome em duas linhas — e nome comprido é a regra, não a exceção, num
         cupom de mercado. Aqui se caminha para trás até achar texto. */
      let descricao = null;
      let codigo = null;
      for (let d = melhor.dQtd + 1; d <= melhor.dQtd + 8; d++) {
        const l = linhas[i - d];
        if (l == null) break;
        if (!l) continue;
        if (this.soNumero(l) != null) {
          /* Número puro antes da descrição costuma ser o código do produto:
             guarda-se o último visto, que é o mais próximo dela. */
          if (/^\d{3,}$/.test(l)) codigo = l;
          continue;
        }
        /* O CST/CSOSN vem como "0/60" ou "0/40" — não é número puro por causa
           da barra, e por isso passava direto e virava NOME DE PRODUTO. Doze
           itens de uma nota e quarenta de outra entraram assim, e "0/60" na
           despensa é o tipo de coisa que faz a pessoa perder a confiança no
           app inteiro. */
        if (/^[\d]{1,3}([/\-][\d]{1,3})+$/.test(l)) continue;
        if (l.length >= 3) { descricao = l; break; }
      }
      if (!descricao) continue;

      /* Um cabeçalho de tabela não é produto: sem esta guarda, "Descrição" e
         "Vl. total" entrariam na despensa como coisas compradas.

         A comparação é com o rótulo INTEIRO, não com o começo dele. Casar por
         prefixo descartava todo produto cujo nome principia por uma dessas
         palavras — e "PRODUTO DE LIMPEZA", "TOTAL LIGHT", "BASE PARA BOLO" são
         nomes que existem na prateleira. Uma guarda que joga fora item legítimo
         é pior que o problema que ela evita. */
      const rotulo = descricao.toLowerCase().replace(/[.\s:]+/g, ' ').trim();
      if (['descrição', 'descricao', 'código', 'codigo', 'produto', 'item',
        'qtde', 'qtd', 'quantidade', 'un', 'und', 'unid', 'unidade',
        'vl unid', 'vl unit', 'v unit', 'valor unitário', 'valor unitario',
        'vl total', 'valor total', 'total', 'alíquota', 'aliquota', 'alíq',
        'bc icms', 'base icms', 'base de cálculo', 'icms', 'ncm', 'cfop',
        'cst', 'cst/csosn', 'cst csosn', 'csosn'].includes(rotulo)) continue;

      itens.push({
        descricao,
        codigo,
        ean: codigo && /^\d{8,14}$/.test(codigo) ? codigo : null,
        qtd: melhor.qtd,
        unidade: this.limparUnidade(linhas[i]),
        valorUnitario: melhor.valorUnitario,
        valorTotal: melhor.valorTotal,
      });
    }

    if (!itens.length) return null;

    /* OS RÓTULOS DO CABEÇALHO TAMBÉM VARIAM entre Sefaz. Cada campo aceita as
       formas que aparecem na prática, e a ausência de um não invalida a nota:
       uma compra sem o nome da loja ainda é uma compra com preços. */
    const tudo = linhas.join('\n');
    const primeiro = (...res) => {
      for (const re of res) {
        const m = tudo.match(re);
        if (m && m[1]) return m[1].trim();
      }
      return null;
    };

    const dataTxt = primeiro(
      /Data de Emiss[ãa]o:?\s*(\d{2}\/\d{2}\/\d{4})/i,
      /Emiss[ãa]o:?\s*(\d{2}\/\d{2}\/\d{4})/i,
      /Data:?\s*(\d{2}\/\d{2}\/\d{4})/i,
      /(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/,
      /(\d{2}\/\d{2}\/\d{4})/);

    const loja = primeiro(
      /RAZ[ÃA]O SOCIAL:?\s*(.+)/i,
      /Nome\s*\/?\s*Raz[ãa]o Social:?\s*(.+)/i,
      /Emitente:?\s*\n\s*(.+)/i);

    const total = this.numeroBR(primeiro(
      /Valor Total da Nota \(R\$\)\s*\n\s*R?\$?\s*([\d.,]+)/i,
      /Valor (?:Total|a pagar)[^\n]*\n\s*R?\$?\s*([\d.,]+)/i,
      /Valor (?:Total|a pagar)[^\d\n]*([\d.,]+)/i,
      /Total (?:da nota|a pagar)[^\d\n]*([\d.,]+)/i));

    return {
      chave: this.extrairChave(tudo),
      loja,
      data: dataTxt ? dataTxt.split('/').reverse().join('-') : null,
      /* Sem o total declarado, a soma dos itens é a melhor estimativa — e é
         honesta: é exatamente o que foi lido, sem nada suposto. */
      total: total != null ? total : itens.reduce((s, it) => s + it.valorTotal, 0),
      itens,
      formato: 'pdf',
    };
  },

  /* ---------------------------------------------------------- entrada --- */

  /* A porta única. Descobre o formato pelo conteúdo, não pela extensão: um
     arquivo salvo como .txt continua sendo o que é por dentro. */
  ler(texto, nomeArquivo) {
    const t = String(texto || '');
    /* O PDF chega aqui já como TEXTO — js/pdf.js o extrai antes, porque abrir
       PDF é trabalho de outra natureza (bytes, zlib) e não cabe num leitor de
       nota fiscal. */
    const tentativas = /\.csv$/i.test(nomeArquivo || '')
      ? ['lerCSV', 'lerPDF', 'lerXML', 'lerHTML']
      : ['lerXML', 'lerHTML', 'lerPDF', 'lerCSV'];
    for (const metodo of tentativas) {
      try {
        const r = this[metodo](t);
        if (r && r.itens && r.itens.length) return r;
      } catch (_) { /* formato errado: tenta o próximo */ }
    }
    return null;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { NFCe };
