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

  console.log('\n' + ok + ' passaram, ' + fail + ' falharam');
  process.exit(fail ? 1 : 0);
})();
