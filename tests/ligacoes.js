/* CESTA — a auditoria das LIGAÇÕES.

   POR QUE ESTE ARQUIVO EXISTE, e o que ele conserta no meu jeito de trabalhar.

   Botões pararam de responder depois de uma renomeação em massa de classes. A
   suíte continuou verde o tempo todo — porque ela testa REGRAS (a mediana, a
   despensa, a projeção) e telas que MONTAM, e um botão sem tratador monta
   perfeitamente. Ele só não faz nada quando alguém toca.

   O defeito não estava numa função: estava na LIGAÇÃO entre o HTML que uma tela
   gera e o código que a escuta. É o tipo de coisa que só aparece quando se olha
   o app inteiro de uma vez — que é exatamente o que eu não estava fazendo.

       node tests/ligacoes.js

   O que se verifica aqui, e por quê:

     1. Todo `data-acao` gerado tem quem o trate. Senão o botão é decoração.
     2. Todo id procurado por querySelector é criado por alguém. Senão o
        addEventListener explode ou, pior, silencia.
     3. Toda função chamada entre módulos existe. Uma renomeação parcial deixa
        chamadas órfãs que só quebram no clique.
     4. O vocabulário de classes é um só. Enquanto metade do app diz .folha e a
        outra metade .sheet, alguma coisa deixa de funcionar em silêncio.
     5. Toda aba do menu tem tela, e toda tela tem aba.

   Isto NÃO substitui a suíte: ela prova que as regras estão certas, e esta prova
   que dá para chegar até elas. */
'use strict';

const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..') + path.sep;

let ok = 0, fail = 0;
const check = (nome, real, esperado) => {
  const vazio = v => v === null || v === undefined;
  const bateu = (vazio(real) && vazio(esperado)) ||
    (!vazio(real) && !vazio(esperado) &&
     (Math.abs(Number(real) - Number(esperado)) < 0.001 || real === esperado));
  console.log(`${bateu ? '  OK  ' : ' FALHA'} | ${nome.padEnd(56)} ${bateu ? '' : `obtido ${real}, esperado ${esperado}`}`);
  bateu ? ok++ : fail++;
};

const arquivosJs = ['js/app.js', 'js/onboarding.js', 'js/bloqueio.js', 'js/ui.js']
  .concat(fs.readdirSync(BASE + 'js/views').filter(f => f.endsWith('.js')).map(f => 'js/views/' + f));
const fontes = {};
for (const a of arquivosJs) fontes[a] = fs.readFileSync(BASE + a, 'utf8');
const tudo = Object.values(fontes).join('\n');
const shell = fs.readFileSync(BASE + 'index.html', 'utf8');

/* ============================================ 1. OS BOTÕES RESPONDEM === */

console.log('\n=== Todo botão tem tratador ===');

/* Cada tela gera botões com data-acao e liga um tratador que olha
   b.dataset.acao. Se a tela gera "revisar" e o tratador só conhece "novo-plano",
   o botão existe, é bonito, e não faz nada — que é o defeito relatado. */
for (const arq of arquivosJs) {
  const src = fontes[arq];
  const geradas = [...src.matchAll(/data-acao="([a-z-]+)"/g)].map(m => m[1]);
  if (!geradas.length) continue;

  const tratadas = new Set([
    ...[...src.matchAll(/acao === '([a-z-]+)'/g)].map(m => m[1]),
    ...[...src.matchAll(/a === '([a-z-]+)'/g)].map(m => m[1]),
    ...[...src.matchAll(/dataset\.acao === '([a-z-]+)'/g)].map(m => m[1]),
  ]);
  /* Um tratador pode viver noutro arquivo (a tela gera, o roteador escuta), e
     por isso a busca cai para o app inteiro antes de acusar. */
  const orfas = [...new Set(geradas)].filter(a => !tratadas.has(a) &&
    !tudo.includes(`acao === '${a}'`) && !tudo.includes(`a === '${a}'`));

  check(`${arq.replace('js/views/', '')}: nenhum botão sem ação`,
    orfas.length ? orfas.join(', ') : true, true);
}

/* E o contrário: um tratador para uma ação que ninguém gera é código morto que
   engana quem for ler depois. */
{
  /* Conta também os data-ob da apresentação: ela tem tratador próprio, e o
     botão dela é tão botão quanto os outros. E ignora os valores de SITUAÇÃO
     ('estoura', 'atencao', 'tranquilo'), que o conselheiro compara mas ninguém
     gera como botão — um auditor que grita sem motivo ensina a ser ignorado. */
  const geradasTodas = new Set([
    ...[...tudo.matchAll(/data-acao="([a-z-]+)"/g)].map(m => m[1]),
    ...[...tudo.matchAll(/data-ob="([a-z-]+)"/g)].map(m => m[1]),
  ]);
  const situacoes = ['estoura', 'atencao', 'tranquilo', 'sem_orcamento'];
  const tratadasTodas = new Set([...tudo.matchAll(/acao === '([a-z-]+)'/g)].map(m => m[1]));
  const semDono = [...tratadasTodas].filter(a => !geradasTodas.has(a) && !situacoes.includes(a));
  check('nenhum tratador sem botão que o acione',
    semDono.length ? semDono.join(', ') : true, true);
}

/* ============================================ 2. OS IDs SE ENCONTRAM === */

console.log('\n=== Todo id procurado existe ===');

/* querySelector('#x') num id que ninguém cria devolve null, e o
   addEventListener na linha seguinte lança — ou, quando há guarda, silencia. Os
   dois desfechos são o mesmo para quem toca: nada acontece. */
for (const arq of arquivosJs) {
  const src = fontes[arq];
  const procurados = [...new Set([
    ...[...src.matchAll(/querySelector\('#([a-z0-9-]+)'\)/g)].map(m => m[1]),
    ...[...src.matchAll(/getElementById\('([a-z0-9-]+)'\)/g)].map(m => m[1]),
  ])];
  if (!procurados.length) continue;

  const orfaos = procurados.filter(id =>
    !tudo.includes(`id="${id}"`) && !shell.includes(`id="${id}"`) &&
    !tudo.includes('id="' + id + '-') && !tudo.includes(`id="\${`));

  check(`${arq.replace('js/views/', '')}: todo id procurado é criado`,
    orfaos.length ? orfaos.join(', ') : true, true);
}

/* ==================================== 3. AS FUNÇÕES ENTRE MÓDULOS === */

console.log('\n=== Toda função chamada existe ===');

/* As telas se chamam por funções globais (abrirFamilia, abrirNovoPlano…). Uma
   renomeação parcial deixa a chamada apontando para o nada, e isso só aparece
   no clique — nunca no carregamento. */
{
  const definidas = new Set([
    ...[...tudo.matchAll(/^function ([a-zA-Z][a-zA-Z0-9]*)\s*\(/gm)].map(m => m[1]),
    ...[...tudo.matchAll(/^async function ([a-zA-Z][a-zA-Z0-9]*)\s*\(/gm)].map(m => m[1]),
  ]);
  /* Só as chamadas SEM objeto antes: `abrirFamilia()` é função global e
     precisa existir; `Auth.abrirComBio()` e `this.abrirDetalhe()` são métodos,
     e cobrá-los aqui seria cobrar a existência de uma função que nunca houve. */
  const chamadas = new Set([...tudo.matchAll(/(?<![.\w])(abrir[A-Z][a-zA-Z]*|irPara|repetirCompra|porCardapioNaLista|pintarIdentidade|entrarNoMercado)\s*\(/g)].map(m => m[1]));

  /* Tira as DECLARAÇÕES de método, que casam com o mesmo padrão da chamada:
     `abrirDetalhe(itemId) {` e `abrirDetalhe(x)` só se distinguem pela chave
     que abre o bloco. Sem isto o auditor cobrava a existência de uma função
     global para todo método de objeto — e gritar sem motivo ensina a ser
     ignorado. */
  const metodos = new Set([...tudo.matchAll(/^\s{2,}([a-zA-Z][a-zA-Z0-9]*)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]));
  const semDefinicao = [...chamadas].filter(f =>
    !definidas.has(f) && !metodos.has(f) && f !== 'pintarIcones');
  check('toda função de tela chamada está definida',
    semDefinicao.length ? semDefinicao.join(', ') : true, true);
}

/* Os objetos de tela também: ViewHoje.render() precisa que ViewHoje exista e
   tenha render. */
{
  const objetos = ['ViewHoje', 'ViewPlanejar', 'ViewDespensa', 'ViewAnalise',
    'ViewLista', 'ViewHistorico', 'ViewProdutos', 'Mercado', 'Onboarding', 'Bloqueio'];
  for (const o of objetos) {
    const declarado = new RegExp(`const ${o} = \\{`).test(tudo);
    check(`${o} está declarado`, declarado, true);
  }
}

/* ============================== 4. UM VOCABULÁRIO DE CLASSES SÓ === */

console.log('\n=== O vocabulário é o do DOMI ===');

/* Enquanto metade do app diz .folha e a outra metade .sheet, alguma coisa deixa
   de funcionar em silêncio: o querySelector procura uma e o HTML gera a outra. */
const antigas = ['folha-fundo', 'folha-alca', 'dock-item', 'topbar-acao',
  'linha-acao', 'sub-abas ativa'];
for (const c of antigas) {
  const onde = arquivosJs.filter(a => fontes[a].includes(`'.${c}'`) || fontes[a].includes(`class="${c}"`));
  check(`ninguém usa .${c} (vocabulário antigo)`,
    onde.length ? onde.join(', ') : true, true);
}

/* O caso concreto que quebra: UI.folha cria .sheet-backdrop, e quem fecha a
   folha à mão precisa remover a MESMA classe. */
{
  /* A folha nasce por ATRIBUIÇÃO — fundo.className = '...' — e não por atributo
     no HTML. Foi por olhar só o atributo que a renomeação em massa deixou o app
     criando .folha-fundo enquanto o CSS já definia .sheet-backdrop: TODA folha
     abria sem estilo, e os botões dentro dela pareciam mortos. */
  const uiCria = /className = 'sheet-backdrop'/.test(fontes['js/ui.js'])
    && /class="sheet"/.test(fontes['js/ui.js']);
  check('UI cria a folha como .sheet-backdrop', uiCria, true);
  const removeErrado = arquivosJs.filter(a => fontes[a].includes("querySelector('.folha-fundo')"));
  check('e todo mundo remove a mesma classe',
    removeErrado.length ? removeErrado.join(', ') : true, true);
}

/* ================================= 5. ABAS E TELAS SE CORRESPONDEM === */

console.log('\n=== Toda aba tem tela ===');

{
  const abasNoMenu = [...new Set([...shell.matchAll(/data-aba="([a-z]+)"/g)].map(m => m[1]))];
  const roteadas = [...new Set([...fontes['js/app.js'].matchAll(/aba === '([a-z]+)'/g)].map(m => m[1]))];
  const listaAbas = (fontes['js/app.js'].match(/const ABAS = \[([^\]]*)\]/) || [])[1] || '';

  for (const aba of abasNoMenu) {
    check(`a aba "${aba}" tem tela no roteador`, roteadas.includes(aba), true);
    check(`e está declarada em ABAS`, listaAbas.includes(`'${aba}'`), true);
  }
  /* O contrário não é defeito: 'lista' é roteada e não tem aba própria, porque
     vive dentro de PLANEJAR. Mas ela precisa estar em ABAS, senão irPara a
     manda para HOJE. */
  check("a tela 'lista' é alcançável mesmo sem aba", listaAbas.includes("'lista'"), true);
}

/* ==================================== 6. O QUE O SHELL PROMETE === */

console.log('\n=== O shell e o service worker combinam ===');

{
  const scripts = [...shell.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
  const sw = fs.readFileSync(BASE + 'sw.js', 'utf8');
  const versao = (sw.match(/const VERSAO = '(\d+)'/) || [])[1];

  check('todo script do shell existe em disco',
    scripts.filter(s => !fs.existsSync(BASE + s)).join(', ') || true, true);
  check('e está no cache offline',
    scripts.filter(s => !sw.includes(`'${s}?v=' + VERSAO`)).join(', ') || true, true);

  const tags = [...new Set([...shell.matchAll(/\?v=(\d+)/g)].map(m => m[1]))];
  check('as tags de versão do shell são uma só', tags.length, 1);
  check('e batem com a do service worker', tags[0], versao);

  const css = [...shell.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m => m[1]);
  check('os dois CSS existem', css.filter(c => !fs.existsSync(BASE + c)).join(', ') || true, true);
  check('e estão no cache', css.filter(c => !sw.includes(`'${c}?v=' + VERSAO`)).join(', ') || true, true);
}

/* =============================== 7. APAGAR APAGA MESMO === */

console.log('\n=== Apagar tudo apaga tudo ===');

{
  const db = fs.readFileSync(BASE + 'js/db.js', 'utf8');
  /* Uma LISTA de chaves fica desatualizada na primeira chave nova que alguém
     criar. A varredura por prefixo pega as de hoje e as de amanhã. */
  check('apagarTudo varre por prefixo, não por lista',
    /startsWith\('cesta'\)/.test(db), true);
  check('e limpa a sessão da aba', db.includes("sessionStorage.removeItem('cesta.sessao')"), true);
  /* As fotos vivem noutro banco e sobreviveriam a tudo: são imagens de etiqueta
     com preço, data e lugar — o mesmo dado que a base guarda. */
  check('e apaga também as fotos do IndexedDB',
    db.includes("deleteDatabase('cesta-fotos')"), true);

  /* TODA chave que o app grava precisa cair na varredura. */
  const chaves = [...new Set([
    ...[...tudo.matchAll(/localStorage\.setItem\('([a-z.A-Z]+)'/g)].map(m => m[1]),
    'cesta.auth', 'cesta.abertura', 'cesta.v1',
  ])];
  const foraDoPrefixo = chaves.filter(k => !k.startsWith('cesta'));
  check('toda chave gravada começa com o prefixo varrido',
    foraDoPrefixo.length ? foraDoPrefixo.join(', ') : true, true);

  const aj = fontes['js/views/ajustes.js'];
  check('e a tela recarrega depois de apagar', aj.includes('location.reload()'), true);
}

/* ======================== 8. A CONFIGURAÇÃO INICIAL ACONTECE === */

console.log('\n=== O app abre configurando quando precisa ===');

{
  const app = fontes['js/app.js'];
  const ob = fontes['js/onboarding.js'];
  /* Um flag no localStorage sobrevive a versão antiga, a "apagar tudo" e a
     backup restaurado. A pergunta precisa ser sobre o ESTADO do aparelho. */
  check('o boot pergunta pela realidade, não pelo flag',
    app.includes('Onboarding.precisaConfigurar()'), true);
  check('e a pergunta olha identidade e dados',
    /temIdentidade/.test(ob) && /temDados/.test(ob), true);
  check('o service worker procura versão nova',
    app.includes('reg.update()'), true);
  check('e o app recarrega quando ela assume',
    app.includes('controllerchange'), true);
  check('com guarda contra laço de recarga',
    app.includes('jaRecarregou'), true);
}

/* ============ O RESUMO É A ÚLTIMA COISA DA SUÍTE ===

   Um bloco de testes inserido DEPOIS do console.log roda, conta, e não
   aparece: a suíte anunciava 771 enquanto 848 asserções tinham rodado. Nada
   reprovava — os 77 testes novos simplesmente não eram vistos por ninguém.

   É o mesmo modo de falhar do runner de sabotagem que anunciava "7/87": o
   número final estava certo para o que ele contou, e errado sobre o que
   aconteceu. Um teste que ninguém lê é um teste que não existe. */
{
  const suite = fs.readFileSync(BASE + 'tests/smoke.js', 'utf8');
  const posResumo = suite.indexOf('passaram, ' + '${fail}' + ' falharam');
  const posExit = suite.indexOf('process.exit(fail ? 1 : 0)');
  const depoisDoResumo = suite.slice(posResumo, posExit);
  check('nenhum teste roda depois do resumo',
    (depoisDoResumo.match(/^check\(/gm) || []).length, 0);
  check('e o resumo vem antes do exit', posResumo > 0 && posResumo < posExit, true);
}

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
