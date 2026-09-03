/* CESTA — leitura de PDF, sem biblioteca nenhuma.

   POR QUE ISTO EXISTE. Vários estados — o Rio Grande do Norte entre eles — só
   entregam a NFC-e em PDF: não há XML para baixar, e a página de consulta é uma
   aplicação que não se salva de forma útil. Sem ler PDF, quem mora nesses
   estados não tem como trazer o histórico, e o app volta a ser "use por três
   meses e depois fica bom".

   POR QUE SEM BIBLIOTECA. O pdf.js pesa ~1 MB e o app inteiro tem 200 KB; ele
   entraria no cache offline de todo mundo por um recurso usado uma vez por mês.
   E este projeto não tem dependência nenhuma — é o que permite servi-lo em
   qualquer host estático.

   COMO FUNCIONA. Um PDF é uma sequência de objetos; o texto vive dentro de
   streams comprimidos com Flate, nos operadores Tj e TJ. O navegador traz
   DecompressionStream('deflate') desde 2023, então dá para abrir tudo com o que
   já existe na plataforma.

   O QUE ISTO NÃO FAZ: PDF escaneado (imagem) não tem camada de texto, e aí não
   há o que extrair — o app diz isso em vez de devolver silêncio. */
'use strict';

const PDF = {

  /* ---------------------------------------------------------- suporte --- */

  /* O DecompressionStream existe em Chrome/Edge 80+, Safari 16.4+ e Firefox
     113+. Onde não existir, o app avisa e oferece os outros formatos, em vez de
     falhar sem explicação. */
  disponivel() {
    return typeof DecompressionStream !== 'undefined';
  },

  async inflar(bytes) {
    /* Dois formatos possíveis: zlib (com cabeçalho) e deflate cru. O PDF usa o
       primeiro, mas alguns geradores emitem o segundo — tentar os dois custa
       nada e evita um "não consegui ler" que seria mentira. */
    for (const formato of ['deflate', 'deflate-raw']) {
      try {
        const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(formato));
        return new Uint8Array(await new Response(fluxo).arrayBuffer());
      } catch (_) { /* tenta o próximo */ }
    }
    return null;
  },

  /* ------------------------------------------------------- extração --- */

  /* Desfaz os escapes de string do PDF: \n, \( , \) e os octais \053. */
  destrancar(s) {
    return s
      .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '', t: '\t', b: '', f: '' }[c] ?? c))
      .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  },

  /* Todo o texto do PDF, em ordem de leitura.

     Cada linha do documento vira uma linha aqui — é o que permite ao parser da
     NFC-e trabalhar por posição relativa, já que o DANFE é uma tabela e o PDF
     não guarda tabela nenhuma: guarda pedaços de texto com coordenadas. */
  async texto(arquivo) {
    if (!this.disponivel()) return { erro: 'sem_suporte' };

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    /* latin1 preserva byte a byte, que é o que o corpo do PDF precisa: o texto
       visível é decodificado depois, e usar utf-8 aqui corromperia os offsets. */
    const bruto = new TextDecoder('latin1').decode(bytes);

    if (!bruto.startsWith('%PDF')) return { erro: 'nao_e_pdf' };

    let saida = '';
    let comTexto = 0;

    const re = /stream\r?\n/g;
    let m;
    while ((m = re.exec(bruto))) {
      const inicio = m.index + m[0].length;
      const fim = bruto.indexOf('endstream', inicio);
      if (fim < 0) continue;

      const conteudoBruto = await this.inflar(bytes.subarray(inicio, fim));
      if (!conteudoBruto) continue;   // imagem ou fonte: não há texto aqui
      const conteudo = new TextDecoder('latin1').decode(conteudoBruto);

      let achouAqui = false;

      /* (texto) Tj — uma string por vez */
      for (const t of conteudo.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) {
        saida += this.destrancar(t[1]) + '\n';
        achouAqui = true;
      }
      /* [(a) -250 (b)] TJ — pedaços com ajuste de espaçamento entre eles.
         Os números são kerning e não entram no texto; juntar os pedaços é o que
         reconstrói a palavra. */
      for (const t of conteudo.matchAll(/\[((?:[^\][]|\\.)*)\]\s*TJ/g)) {
        let linha = '';
        for (const p of t[1].matchAll(/\(((?:[^()\\]|\\.)*)\)/g)) linha += this.destrancar(p[1]);
        saida += linha + '\n';
        achouAqui = true;
      }
      if (achouAqui) comTexto++;
    }

    if (!saida.trim()) {
      /* Sem camada de texto: é um PDF escaneado, ou gerado como imagem. Não há
         o que extrair, e dizer isso é melhor que devolver vazio — a pessoa
         precisa saber que o problema é o arquivo, não o app. */
      return { erro: 'sem_texto' };
    }

    return { texto: saida, blocos: comTexto };
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { PDF };
