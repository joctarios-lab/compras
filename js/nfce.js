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
    const s = String(texto || '').replace(/\D/g, '');
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

  /* ---------------------------------------------------------- entrada --- */

  /* A porta única. Descobre o formato pelo conteúdo, não pela extensão: um
     arquivo salvo como .txt continua sendo o que é por dentro. */
  ler(texto, nomeArquivo) {
    const t = String(texto || '');
    const tentativas = /\.csv$/i.test(nomeArquivo || '')
      ? ['lerCSV', 'lerXML', 'lerHTML']
      : ['lerXML', 'lerHTML', 'lerCSV'];
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
