/* CESTA — a suite inteira, em varias datas de calendario.

   Congelar o relogio impede a suite de apodrecer, mas sozinho troca um defeito
   por outro: ela deixaria de olhar para o calendario para sempre. Este arquivo
   roda a MESMA suite nas bordas que costumam quebrar coisa de verdade.

   Verde num dia so nao e verde. */
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

/* As datas sao escolhidas pelas bordas, nao por sorteio:
     - primeiro dia do mes: nao ha passado
     - meio do mes: o caso comum, a ancora
     - penultimo e ULTIMO dia: nao ha futuro dentro do mes
     - fevereiro e o 29 de fevereiro: o mes curto e o dia que so existe as vezes
     - virada de ano e primeiro dia do ano: o mes anterior muda de ano junto

   Neste app importam tambem, quando as regras de preco existirem (F2 em
   diante): mes sem nenhuma compra — a mediana nao existe —, produto observado
   uma unica vez, e nota importada com data retroativa atravessando a virada. */
const DATAS = [
  ['primeiro dia do mes',      '2026-09-01T10:00:00-03:00'],
  ['meio do mes (a ancora)',   '2026-09-02T10:00:00-03:00'],
  ['penultimo dia do mes',     '2026-09-29T10:00:00-03:00'],
  ['ULTIMO dia do mes',        '2026-09-30T10:00:00-03:00'],
  ['ultimo dia de mes de 31',  '2026-08-31T10:00:00-03:00'],
  ['fevereiro',                '2027-02-15T10:00:00-03:00'],
  ['29 de fevereiro',          '2028-02-29T10:00:00-03:00'],
  ['virada de ano',            '2026-12-31T10:00:00-03:00'],
  ['primeiro dia do ano',      '2027-01-01T10:00:00-03:00'],
];

let reprovadas = 0;

for (const [rotulo, iso] of DATAS) {
  let saida = '';
  let passou = true;
  try {
    saida = execSync('node tests/smoke.js', {
      cwd: RAIZ, encoding: 'utf8', env: { ...process.env, HOJE: iso },
    });
  } catch (e) {
    saida = String(e.stdout || '') + String(e.stderr || '');
    passou = false;
  }
  const resumo = (saida.match(/(\d+) passaram, (\d+) falharam/) || []);
  const linha = resumo[0] || 'a suite nem chegou ao fim';
  console.log(`${passou ? '  OK  ' : ' FALHA'} | ${rotulo.padEnd(26)} ${iso.slice(0, 10)}  ${linha}`);
  if (!passou) {
    reprovadas++;
    // As linhas de falha, para nao ser preciso rodar de novo so para ve-las
    for (const l of saida.split('\n')) if (l.includes('FALHA')) console.log('        ' + l.trim());
  }
}

console.log(`\n${DATAS.length - reprovadas}/${DATAS.length} datas verdes`);
process.exit(reprovadas ? 1 : 0);
