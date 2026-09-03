/* CESTA — a leitura de PDF de verdade, do byte ao texto.

   POR QUE ESTA SUÍTE EXISTE, SEPARADA DAS OUTRAS.

   O parser da NFC-e já era coberto pela fixture `danfe-rn.txt`. Só que essa
   fixture é TEXTO — ela nasceu depois da extração, e por isso nunca provou nada
   sobre a extração. O app dizia "este PDF é uma imagem" sobre um DANFE cheio de
   texto, e as 889 asserções seguiam verdes: cada peça estava certa, e a costura
   entre elas é que estava rompida.

   O DEFEITO. O corpo de um stream de PDF termina com uma quebra de linha antes
   da palavra `endstream`, e ela não faz parte do fluxo comprimido. O
   `DecompressionStream` do navegador aborta ao encontrá-la. Isso por si só não
   seria fatal — o texto já tinha sido descomprimido. Mas o
   `new Response(fluxo).arrayBuffer()` resolve com TUDO ou rejeita com NADA: o
   aborto jogava fora o que já havia chegado. Nos 15 streams da nota real,
   nenhum sobrevivia, e "não sobrou texto" foi lido como "não há texto".

   O inflate do zlib, que eu usei para conferir no Node, tolera essa cauda em
   silêncio. Era a razão de eu ver verde onde o usuário via erro. A lição vale
   além do PDF: verificar com uma ferramenta mais tolerante que a real não
   verifica nada.

   Esta suíte é assíncrona porque a descompressão é — e por isso ela imprime o
   resumo DEPOIS de esperar, nunca antes. */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');

function carregar(arq) {
  const src = fs.readFileSync(path.join(BASE, arq), 'utf8');
  return new Function('module', 'TextDecoder', 'Blob', 'Response',
    'DecompressionStream', 'console',
    src + '\n;return module.exports;')(
    { exports: {} }, TextDecoder, Blob, Response, DecompressionStream, console);
}

const { PDF } = carregar('js/pdf.js');
const { NFCe } = carregar('js/nfce.js');

let ok = 0, fail = 0;
function check(oQue, obtido, esperado) {
  const bom = obtido === esperado;
  if (bom) ok++; else fail++;
  console.log((bom ? '  OK   | ' : ' FALHA | ') + oQue.padEnd(58)
    + (bom ? '' : 'obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)));
}

/* Um File de mentira: o app só chama arrayBuffer(). */
function comoArquivo(buf) {
  return {
    name: 'nota.pdf',
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

(async () => {
  check('o DecompressionStream existe neste Node',
    typeof DecompressionStream !== 'undefined', true);

  /* ---- O PDF COM A CAUDA QUE ABORTAVA TUDO -------------------------------

     404 bytes, gerado à mão, sem um byte de dado de ninguém. A nota real do
     usuário não entra no repositório: ela tem CNPJ, endereço e a lista de
     compras da casa dele. */
  const fixture = path.join(BASE, 'tests/fixtures/pdf-com-cauda.pdf');
  const bin = fs.readFileSync(fixture);

  const fatiaComCauda = (() => {
    const bruto = bin.toString('latin1');
    const i = bruto.indexOf('stream\n') + 'stream\n'.length;
    const f = bruto.indexOf('endstream', i);
    return bin.subarray(i, f);
  })();
  check('a fixture tem a quebra de linha antes de endstream',
    fatiaComCauda[fatiaComCauda.length - 1], 0x0A);

  /* O leitor tudo-ou-nada, que era o de antes: prova que a fixture reproduz
     o defeito. Se um dia isto passar a devolver bytes, a fixture perdeu o
     sentido e precisa ser refeita — não silenciada. */
  let tudoOuNada = null;
  try {
    const fl = new Blob([fatiaComCauda]).stream()
      .pipeThrough(new DecompressionStream('deflate'));
    tudoOuNada = new Uint8Array(await new Response(fl).arrayBuffer());
  } catch (_) { tudoOuNada = null; }
  check('e o leitor tudo-ou-nada ainda falha nela (era o defeito)',
    tudoOuNada === null, true);

  /* O leitor do app, que guarda o que chegou antes do aborto. */
  const inflado = await PDF.inflar(fatiaComCauda);
  check('mas o leitor do app aproveita o que chegou', !!(inflado && inflado.length), true);

  const r = await PDF.texto(comoArquivo(bin));
  check('e a extração devolve texto, não "sem_texto"', !r.erro, true);
  check('com o conteúdo do documento',
    /DANFE NFC-e/.test(r.texto || ''), true);

  /* ---- NÃO É PDF, E ISSO PRECISA SER DITO DIFERENTE ---------------------

     "não é um PDF" e "é um PDF sem camada de texto" pedem coisas diferentes da
     pessoa. Confundi-los foi o que fez o usuário ouvir "é uma imagem" sobre um
     arquivo que não era. */
  const naoPdf = await PDF.texto(comoArquivo(Buffer.from('isto nao e um pdf', 'latin1')));
  check('arquivo que não é PDF diz nao_e_pdf', naoPdf.erro, 'nao_e_pdf');

  /* Um PDF de verdade, com stream de imagem e nenhum operador de texto. */
  const semTexto = Buffer.concat([
    Buffer.from('%PDF-1.4\n4 0 obj<</Filter/FlateDecode>>stream\n', 'latin1'),
    require('zlib').deflateSync(Buffer.from('\xFF\xD8\xFF\xE0 dados de imagem', 'latin1')),
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
  const imagem = await PDF.texto(comoArquivo(semTexto));
  check('PDF sem camada de texto diz sem_texto', imagem.erro, 'sem_texto');

  /* ---- DA EXTRAÇÃO ATÉ A NOTA MONTADA -----------------------------------

     A fixture de texto do DANFE real (anonimizada) segue cobrindo o parser.
     Aqui se confere que a extração entrega algo que o parser aceita. */
  const danfe = fs.readFileSync(path.join(BASE, 'tests/fixtures/danfe-rn.txt'), 'utf8');
  const nota = NFCe.lerPDF(danfe);
  check('o parser lê a nota da fixture', !!(nota && !nota.erro), true);
  check('com os 132 itens', (nota.itens || []).length, 132);
  check('todo item tem nome', (nota.itens || []).every(i => !!i.descricao), true);
  check('e preço', (nota.itens || []).every(i => Number(i.valorTotal) > 0), true);

  /* A SOMA DOS ITENS NÃO FECHA COM O TOTAL, e está certo: a nota declara
     R$ 50,90 de desconto. Guardar essa conta aqui é o que impede alguém (eu,
     em três meses) de "corrigir" o parser para forçar o fechamento. */
  const soma = (nota.itens || []).reduce((s, i) => s + (Number(i.valorTotal) || 0), 0);
  check('a soma dos itens menos o desconto dá o total da nota',
    Math.round((soma - (nota.desconto || 50.90)) * 100) / 100,
    Math.round(nota.total * 100) / 100);

  /* ---- OUTROS ESTADOS, OUTRAS COLUNAS ----------------------------------

     O parser estava preso ao layout do Rio Grande do Norte: quantidade em i-1,
     descrição em i-5, unitário em i+1, total em i+5. Bastava abrir a nota de
     outro estado para achar zero itens e o app dizer "não consegui ler este
     arquivo" sobre uma nota perfeita.

     Cada Sefaz monta a tabela com as colunas que quer. Os três layouts abaixo
     são inventados de propósito — o ponto não é acertar os 27 estados, é o
     parser não depender de conhecê-los: ele encontra os papéis pela igualdade
     `quantidade × unitário = total`, que vale em toda nota fiscal do país. */
  const cabecalho = [
    'DANFE NFC-e - Documento Auxiliar da Nota Fiscal do Consumidor Eletrônica',
    'RAZÃO SOCIAL: Mercado Teste Ltda',
    'Data de Emissão: 15/03/2026',
  ];

  const LAYOUTS = [
    {
      nome: 'colunas do RN (unitário, base, alíquota, ICMS, total)',
      /* código, descrição, CFOP, NCM, CST, qtd, UN, unit, base, alíq, ICMS, total */
      linhas: ['14421', 'ARROZ BRANCO TIPO 1 5KG', '5102', '10063021', '000',
        '2', 'UN', '25,00', '50,00', '20,00', '10,00', '50,00'],
    },
    {
      nome: 'sem colunas de ICMS (qtd, UN, unitário, total)',
      linhas: ['998877', 'FEIJAO CARIOCA 1KG', '3', 'KG', '8,50', '25,50'],
    },
    {
      nome: 'descrição em duas linhas, com desconto de centavos',
      linhas: ['5501', 'LEITE INTEGRAL LONGA VIDA',
        'CAIXA COM 12 UNIDADES', '12', 'UN', '5,49', '65,85'],
    },
  ];

  for (const l of LAYOUTS) {
    const nota = NFCe.lerPDF(cabecalho.concat(l.linhas).join('\n'));
    check('le o layout: ' + l.nome, !!(nota && nota.itens.length === 1), true);
    if (nota && nota.itens.length === 1) {
      const it = nota.itens[0];
      check('  e o nome nao e um numero', /^[A-Z]/.test(it.descricao), true);
      check('  e a conta fecha',
        Math.abs(it.qtd * it.valorUnitario - it.valorTotal) < 0.06, true);
    }
  }

  /* A descrição em duas linhas: o nome pego é a linha mais próxima da
     quantidade, que é onde o DANFE continua o texto comprido. */
  const duasLinhas = NFCe.lerPDF(cabecalho.concat(LAYOUTS[2].linhas).join('\n'));
  check('descrição em duas linhas pega a mais proxima da quantidade',
    duasLinhas.itens[0].descricao, 'CAIXA COM 12 UNIDADES');

  /* ---- O QUE NÃO FECHA NÃO ENTRA ---------------------------------------

     A mesma prova aritmética que descobre o layout é a que impede o parser de
     inventar. Sem ela, uma coluna deslocada viraria preço errado no histórico —
     e preço errado no histórico envenena todo diagnóstico depois. */
  const torto = NFCe.lerPDF(cabecalho.concat(
    ['777', 'PRODUTO QUALQUER', '2', 'UN', '10,00', '999,99']).join('\n'));
  check('coluna que nao fecha na conta NAO vira item', torto, null);

  /* Cabeçalho de tabela não é produto: sem esta guarda, "Descrição" e
     "Valor Total" entrariam na despensa como coisas compradas. */
  const soCabecalho = NFCe.lerPDF(cabecalho.concat(
    ['Código', 'Descrição', '1', 'UN', '1,00', '1,00']).join('\n'));
  check('cabecalho de tabela nao vira item', soCabecalho, null);

  /* Sem o total declarado, a soma dos itens é o melhor que se sabe — e é
     honesto, porque é exatamente o que foi lido. */
  const semTotal = NFCe.lerPDF(cabecalho.concat(LAYOUTS[1].linhas).join('\n'));
  check('sem total declarado, usa a soma dos itens', semTotal.total, 25.50);

  /* ---- A UNIDADE NÃO É UM CAMPO PADRONIZADO ----------------------------

     A falha que o usuário encontrou: duas notas do MESMO estado, com o MESMO
     layout, e a segunda não era lida. A diferença era o mercado — a coluna de
     unidade traz o que o supermercado cadastrou no sistema dele, não um código
     da Sefaz. Onde um cupom diz UN, o outro diz UND9; e aparecem BDJ9
     (bandeja), VDO9 (vidro), PTE9 (pote), FRC9 (frasco), PCT9 (pacote).

     Eu tinha uma lista fechada de unidades como âncora — o que é prometer
     conhecer o cadastro de todo mercado do país. Agora a âncora é a FORMA:
     texto curto entre dois números. */
  for (const [un, esperada] of [['UND9', 'UND'], ['KG9', 'KG'], ['BDJ9', 'BDJ'],
    ['VDO9', 'VDO'], ['PTE9', 'PTE'], ['FRC9', 'FRC'], ['PCT9', 'PCT'], ['UN', 'UN']]) {
    const nota = NFCe.lerPDF(cabecalho.concat(
      ['AR085019', 'MILHO VERDE BONARE', '5102', '20058000', '0',
        '2', un, '2,89', '5,78', '20,00', '1,16', '5,78']).join('\n'));
    check('le a unidade ' + un, nota && nota.itens.length === 1
      && nota.itens[0].unidade === esperada, true);
  }

  /* E toda unidade lida tem de significar algo para o motor de preços: uma
     unidade que ele não conhece deixa o item fora de toda comparação, que é o
     app inteiro. Bandeja, pote e vidro são UMA unidade — o tamanho vem da
     descrição do produto, não daqui. */
  const { Precos } = carregar('js/precos.js');
  for (const un of ['UND', 'KG', 'BDJ', 'VDO', 'PTE', 'FRC', 'PCT', 'UN', 'SCH', 'LTA']) {
    check('o motor de precos entende ' + un, !!Precos.normalizarUnidade(un), true);
  }

  /* ---- O CST NÃO É NOME DE PRODUTO -------------------------------------

     O CST/CSOSN vem como "0/60" — não é número puro por causa da barra, e por
     isso passava pela busca da descrição e virava o NOME do item. Quarenta
     produtos de uma nota entraram na despensa chamados "0/60". */
  const comCST = NFCe.lerPDF(cabecalho.concat(
    ['AR001632', 'ABACATE', '5102', '08044000', '0/40',
      '0,75', 'KG9', '3,39', '0,00', '0,00', '0,00', '2,54']).join('\n'));
  check('o CST 0/40 nao vira nome de produto',
    comCST && comCST.itens[0].descricao, 'ABACATE');

  /* ---- CFOP E NCM NÃO SÃO QUANTIDADE -----------------------------------

     Quando afrouxei a busca da quantidade "por robustez", o CFOP (5102) e o
     NCM (04022110) viraram candidatos, e combinações absurdas passaram na folga
     de 2% — apertada em reais, larguíssima em dezenas de milhares. Um item saiu
     com quantidade 5.102 e total de R$ 260.886.

     A quantidade e o unitário CERCAM a unidade: é o layout do DANFE
     (`Qtde | Un | Vl. unid.`), e não há o que procurar. */
  const comCodigos = NFCe.lerPDF(cabecalho.concat(
    ['14421', 'LEITE PO ITAMBE 200G SCH INTEGRAL', '5102', '04022110', '0',
      '1', 'UN', '8,99', '8,99', '20,00', '1,80', '8,99']).join('\n'));
  check('o CFOP nao vira quantidade', comCodigos && comCodigos.itens[0].qtd, 1);
  check('e o valor fica em reais, nao em dezenas de milhares',
    comCodigos && comCodigos.itens[0].valorTotal, 8.99);

  /* ---- O TOTAL É A ÚLTIMA COLUNA, NÃO A BASE DE ICMS --------------------

     Sem redução de base as duas são iguais e ambas fecham a conta; com redução
     de base, escolher a mais próxima traz um preço menor que o pago — e preço
     errado no histórico envenena todo diagnóstico depois, sem sinal nenhum. */
  const baseReduzida = NFCe.lerPDF(cabecalho.concat(
    ['99', 'PRODUTO COM BASE REDUZIDA', '5102', '10063021', '20',
      '2', 'UN', '10,00', '12,00', '20,00', '2,40', '20,00']).join('\n'));
  check('pega o valor total, nao a base de ICMS reduzida',
    baseReduzida && baseReduzida.itens[0].valorTotal, 20.00);

  console.log('\n' + ok + ' passaram, ' + fail + ' falharam');
  process.exit(fail ? 1 : 0);
})();
