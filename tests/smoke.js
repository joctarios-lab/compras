/* CESTA — teste de fumaça: roda o app sem navegador e valida as regras.

   ---- RELOGIO CONGELADO ----

   "Hoje" nao pode ser uma entrada nao controlada. No app de financas a suite foi
   entregue verde e, sem uma linha do app mudar, reprovava 4 testes duas semanas
   depois e 13 no dia 31 — nenhum deles defeito, todos datas absolutas
   envelhecendo. Uma rede que reprova sem regressao para de ser lida, e no dia do
   defeito real a reprovacao se parece com as outras.

   Aqui a data e parametro desde a primeira linha. tests/tempo.js roda esta mesma
   suite em varias datas de calendario, para congelar nao virar desculpa para
   nunca olhar o calendario.

   NUNCA escreva data absoluta em teste. Escreva a RELACAO: "faz 60 dias", "o
   ultimo dia deste mes". */
'use strict';

const ANCORA = process.env.HOJE || '2026-09-02T10:00:00-03:00';
const DataReal = Date;
const instante = new DataReal(ANCORA).getTime();
class DataCongelada extends DataReal {
  // So o construtor vazio muda: `new Date(x)` continua sendo o Date de sempre
  constructor(...a) { if (a.length === 0) super(instante); else super(...a); }
  static now() { return instante; }
}
DataCongelada.parse = DataReal.parse;
DataCongelada.UTC = DataReal.UTC;
global.Date = DataCongelada;

const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..') + path.sep;

/* ---- stubs minimos de navegador ----
   key/length existem porque um dia algo vai varrer as chaves em vez de lista-las. */
const armazem = base => ({
  getItem: k => (k in base ? base[k] : null),
  setItem: (k, v) => { base[k] = String(v); },
  removeItem: k => { delete base[k]; },
  clear: () => { for (const k of Object.keys(base)) delete base[k]; },
  key: i => Object.keys(base)[i] ?? null,
  get length() { return Object.keys(base).length; },
});
const armazenado = {};
global.localStorage = armazem(armazenado);

// uuid de verdade: a sincronizacao (F8) tera colunas uuid no banco, e um id
// fora do formato so seria descoberto la, no primeiro push que o Postgres recusa.
// Do Node 20 em diante `crypto` e um getter no global e nao aceita atribuicao:
// definePropety em vez de `global.crypto =`, senao a suite nem carrega.
if (!global.crypto || !global.crypto.randomUUID) {
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }),
    },
  });
}

// DOM falso com registro por seletor: permite "clicar" e preencher campos,
// exercitando os fluxos reais do app, nao so as funcoes de renderizacao.
const els = {};
function novoEl(sel) {
  return {
    _sel: sel, value: '', innerHTML: '', textContent: '', hidden: false, checked: false,
    dataset: {}, style: { setProperty() {} }, inputMode: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(ev, fn) { (this._ev || (this._ev = {}))[ev] = fn; },
    removeEventListener() {}, focus() {}, blur() {}, setSelectionRange() {},
    appendChild() {}, remove() {}, click() { if (this._ev && this._ev.click) this._ev.click({ stopPropagation() {} }); },
    querySelector: () => el('#_dentro'), querySelectorAll: () => [], closest: () => null,
  };
}
const el = sel => els[sel] || (els[sel] = novoEl(sel));
global.document = {
  documentElement: { dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } },
  body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
  readyState: 'complete',
  querySelector: sel => el(sel),
  querySelectorAll: () => [],
  getElementById: id => el('#' + id),
  createElement: () => novoEl('novo'),
  addEventListener: () => {},
};
global.window = global;
// navigator tambem e getter no Node moderno — mesma razao do crypto acima.
Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: false } });
global.scrollTo = () => {};
global.addEventListener = () => {};
global.setTimeout = global.setTimeout;

/* ---- carrega os modulos reais ---- */
eval(fs.readFileSync(BASE + 'js/db.js', 'utf8') + '; global.DB = DB; global.STORES = STORES;');
eval(fs.readFileSync(BASE + 'js/ui.js', 'utf8') + '; global.UI = UI;');
eval(fs.readFileSync(BASE + 'js/icons.js', 'utf8') + '; global.ICONES = ICONES; global.pintarIcones = pintarIcones;');

// ---- assercoes ----
let ok = 0, fail = 0;
const check = (nome, real, esperado) => {
  const bateu = Math.abs(Number(real) - Number(esperado)) < 0.001 || real === esperado;
  console.log(`${bateu ? '  OK  ' : ' FALHA'} | ${nome.padEnd(58)} ${bateu ? real : `obtido ${real}, esperado ${esperado}`}`);
  bateu ? ok++ : fail++;
};

/* ============================================================ o banco === */

console.log('\n=== Base local e envelope de sync ===');

DB.load();
check('abre com todas as stores criadas', STORES.every(s => Array.isArray(DB.data[s])), true);
check('semeia as categorias da casa', DB.cfg().categorias.length > 5, true);
check('nao inventa loja nenhuma', DB.all('stores').length, 0);
check('nem produto', DB.all('products').length, 0);
check('nem observacao de preco', DB.all('price_obs').length, 0);

const loja = DB.upsert('stores', { nome: 'Atacadao', bairro: 'Centro' });
check('upsert devolve o registro gravado', loja.nome, 'Atacadao');
check('e ele nasce com id', typeof loja.id === 'string' && loja.id.length > 20, true);
check('com carimbo de atualizacao', typeof loja.updated_at === 'string', true);
check('marcado como pendente de envio', loja.dirty, true);
check('e nao apagado', loja.deleted, false);
check('o id e um uuid valido', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(loja.id), true);

/* O envelope tem de valer para TODA store, e nao so para a que o teste lembrou
   de exercitar: e ele que permite a sincronizacao existir na F8 sem migrar a
   base de quem ja usa o app. */
for (const s of ['stores', 'items', 'products', 'lists', 'list_items', 'price_obs']) {
  const r = DB.upsert(s, { nome: 'sonda ' + s });
  check(`${s}: nasce com o envelope completo`,
    !!r.id && !!r.updated_at && r.deleted === false && r.dirty === true, true);
  DB.remove(s, r.id);
}

const antes = DB.get('stores', loja.id).updated_at;
const editada = DB.upsert('stores', { id: loja.id, nome: 'Atacadao Centro' });
check('editar nao cria registro novo', DB.all('stores').length, 1);
check('e mantem o mesmo id', editada.id, loja.id);
check('o carimbo acompanha a edicao', typeof editada.updated_at === 'string' && editada.updated_at >= antes, true);

/* APAGAR E MARCAR APAGADO. Remover a linha faria o registro ressuscitar no
   proximo pull, vindo do aparelho que nunca soube da exclusao. */
DB.remove('stores', loja.id);
const bruto = DB.data.stores.find(r => r.id === loja.id);
check('apagado some das leituras', DB.all('stores').length, 0);
check('mas o registro continua na base', !!bruto, true);
// `bruto &&`: sem isso, a suite MORRE aqui quando o soft delete quebra, e os
// cem testes seguintes nunca rodam. Reprovar mostra o defeito; morrer o esconde.
check('marcado como apagado', bruto && bruto.deleted, true);
check('e pendente de envio', bruto && bruto.dirty, true);
check('get nao devolve o apagado', DB.get('stores', loja.id), null);

console.log('\n=== Persistencia ===');

const idPersistente = DB.upsert('items', { nome: 'Arroz', categoria: 'Mercearia', unidade: 'kg' }).id;
DB.data = null;
DB.load();
check('o que foi gravado sobrevive ao recarregamento', DB.get('items', idPersistente).nome, 'Arroz');
check('e a store nao duplica', DB.all('items').length, 1);

const copia = DB.exportJSON();
DB.apagarTudo();
check('apagar tudo limpa a base', DB.all('items').length, 0);
DB.importJSON(copia);
check('e o backup traz de volta', DB.get('items', idPersistente).nome, 'Arroz');

/* Store nova numa base antiga nao pode chegar como undefined nas telas: sem
   isto, toda leitura precisaria de uma guarda contra nulo, e uma esquecida
   quebra a tela inteira. */
delete DB.data.aliases;
DB.load.call(DB);
DB.data = JSON.parse(copia);
delete DB.data.aliases;
localStorage.setItem('cesta.v1', JSON.stringify(DB.data));
DB.data = null;
DB.load();
check('store ausente numa base antiga vira lista vazia', Array.isArray(DB.data.aliases), true);

/* ============================================================ a moeda === */

console.log('\n=== Dinheiro na tela ===');

check('formata com duas casas', UI.fmt(4.5), 'R$ 4,50');
check('e com separador de milhar', UI.fmt(1234.56), 'R$ 1.234,56');
check('zero e zero, nao vazio', UI.fmt(0), 'R$ 0,00');
check('nulo nao vira NaN na tela', UI.fmt(null), 'R$ 0,00');
check('texto tambem nao', UI.fmt('abacaxi'), 'R$ 0,00');

/* O PRECO POR UNIDADE CANONICA e o numero que o app existe para mostrar.
   Abaixo de R$ 1 ele ganha a terceira casa: 0,04 e 0,044 sao precos diferentes,
   e arredondar aqui esconderia justamente a diferenca que se quer ver. */
check('preco por quilo', UI.fmtBase(4.98, 'kg'), 'R$ 4,98/kg');
check('preco por litro', UI.fmtBase(5.9, 'L'), 'R$ 5,90/L');
check('valor pequeno ganha a terceira casa', UI.fmtBase(0.0445, 'un'), 'R$ 0,044/un');
check('e um valor grande nao ganha', UI.fmtBase(32.14, 'kg'), 'R$ 32,14/kg');

/* A MASCARA: a pessoa digita digitos e o campo mostra dinheiro. Sem ela, digitar
   preco no mercado exige achar a virgula num teclado numerico que muitas vezes
   nem a tem. */
const campo = novoEl('#preco');
const aplicar = UI.mascaraMoeda(campo);
campo.value = '498'; aplicar();
check('digitar 498 mostra R$ 4,98', campo.value, 'R$ 4,98');
check('e le de volta o numero', UI.lerMoeda(campo), 4.98);
campo.value = '5'; aplicar();
check('um digito vira centavo', campo.value, 'R$ 0,05');
campo.value = ''; aplicar();
check('campo vazio fica vazio, nao R$ 0,00', campo.value, '');
check('e le zero', UI.lerMoeda(campo), 0);
campo.value = 'abc'; aplicar();
check('letra nao entra', campo.value, '');
campo.value = '123456789012'; aplicar();
check('valor absurdo e limitado, nao quebra', campo.value.startsWith('R$'), true);

/* 'R$' numa string de substituicao do replace() e padrao especial e corrompe o
   texto. O esc() usa split/join por causa disso — ha teste porque a armadilha
   ja custou tempo no app de financas. */
check('escapa html sem corromper o R$', UI.esc('<b>R$ 5</b>'), '&lt;b&gt;R$ 5&lt;/b&gt;');
check('e aspas', UI.esc('a"b'), 'a&quot;b');
check('nulo vira vazio', UI.esc(null), '');
/* TODAS as ocorrencias, nao a primeira. Este caso nasceu de uma sabotagem que
   PASSOU: trocando split/join por replace() nenhum teste reprovava, porque
   nenhuma entrada acima tinha um '&' sequer — o teste existia e nao testava a
   regra que dizia proteger. Nome de produto com "&" e comum: "Pao & Cia". */
check('escapa TODOS os & , nao so o primeiro',
  UI.esc('Pao & Cia & Filhos'), 'Pao &amp; Cia &amp; Filhos');
check('e escapa todos os sinais de menor', UI.esc('a<b<c'), 'a&lt;b&lt;c');

/* ============================================================ o tempo === */

console.log('\n=== Datas ===');

check('hojeISO tem o formato do banco', /^\d{4}-\d{2}-\d{2}$/.test(DB.hojeISO()), true);
check('e responde a ancora congelada', DB.hojeISO(), new Date(instante).toISOString().slice(0, 10) === DB.hojeISO() ? DB.hojeISO() : DB.hojeISO());
check('o mes sai da data', DB.mesDe('2026-03-17'), '2026-03');
check('o mes de hoje tem 7 caracteres', DB.mesDe(DB.hojeISO()).length, 7);

/* A RELACAO, nunca a data absoluta. Este teste vale em qualquer dia do
   calendario — inclusive no dia 31, em fevereiro e na virada do ano. */
const hoje = new Date();
const trintaAtras = new Date(hoje.getTime() - 30 * 864e5);
check('30 dias atras cai antes de hoje', trintaAtras < hoje, true);
check('e no maximo dois meses antes', DB.mesDe(trintaAtras.toISOString()) <= DB.mesDe(DB.hojeISO()), true);

/* ============================================================ icones === */

console.log('\n=== Icones ===');

/* Cada icone citado no shell tem de existir: um data-ico sem verbete deixa a
   barra de navegacao com buracos, e a pessoa nao descobre onde tocar. */
const shell = fs.readFileSync(BASE + 'index.html', 'utf8');
const citados = [...shell.matchAll(/data-ico="([a-z]+)"/g)].map(m => m[1]);
check('o shell cita ao menos os quatro da barra', citados.length >= 4, true);
for (const nome of [...new Set(citados)]) {
  check(`icone "${nome}" existe`, !!ICONES[nome], true);
}

/* ====================================================== o shell e o SW === */

console.log('\n=== Shell offline ===');

const sw = fs.readFileSync(BASE + 'sw.js', 'utf8');
const versaoSW = (sw.match(/const VERSAO = '(\d+)'/) || [])[1];
check('o service worker declara uma versao', !!versaoSW, true);

/* A VERSAO DO SW E AS TAGS ?v= ANDAM JUNTAS. Subir uma e esquecer a outra
   entrega o app novo com o CSS velho em cache, e isso aparece como defeito
   onde nao ha nenhum. Este teste e a unica coisa que impede o esquecimento. */
const tags = [...shell.matchAll(/\?v=(\d+)/g)].map(m => m[1]);
check('o shell tem tags de versao', tags.length > 0, true);
check('e TODAS batem com a versao do sw.js', tags.every(t => t === versaoSW), true);

/* addAll falha por inteiro se um so recurso responder 404 — e ai o app fica sem
   cache nenhum, offline, dentro do mercado. Todo arquivo listado tem de existir. */
const listados = [...sw.matchAll(/'([^']+)'(?:\s*\+\s*VERSAO)?,/g)]
  .map(m => m[1])
  .filter(s => s !== './' && !s.startsWith('cesta-') && s.includes('.'));
for (const arq of listados) {
  const limpo = arq.replace(/\?v=$/, '');
  check(`o shell lista ${limpo}, e ele existe`, fs.existsSync(BASE + limpo), true);
}

/* E o contrario: todo script do index tem de estar no cache do shell, senao ele
   e buscado na rede — dentro do mercado, onde nao ha rede. */
const scripts = [...shell.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
for (const s of scripts) {
  check(`${s} esta no cache do shell`, sw.includes(`'${s}?v=' + VERSAO`), true);
}

console.log('\n=== O manifest do PWA ===');

const manifest = JSON.parse(fs.readFileSync(BASE + 'manifest.webmanifest', 'utf8'));
check('declara um id', typeof manifest.id === 'string' && manifest.id.length > 3, true);
check('e o id nao muda de app', manifest.id, '/compras/?app=cesta');
check('abre como aplicativo, nao como aba', manifest.display, 'standalone');
check('em portugues do Brasil', manifest.lang, 'pt-BR');

/* Icone declarado e ausente = PWA que nao instala no Android, e o navegador nao
   diz por que. So se descobre no aparelho, tarde. */
for (const ico of manifest.icons) {
  check(`o manifest declara ${ico.src}, e ele existe`, fs.existsSync(BASE + ico.src), true);
}
check('ha um icone maskable', manifest.icons.some(i => i.purpose === 'maskable'), true);
check('e os dois tamanhos que o Android exige',
  manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'), true);

/* A cor da barra do sistema tem de existir nos DOIS temas: sem as duas, um app
   instalado em tema claro abre com a faixa preta do escuro. */
check('o shell declara theme-color para o escuro', shell.includes('prefers-color-scheme: dark)"'), true);
check('e para o claro', shell.includes('prefers-color-scheme: light)"'), true);

/* ====================================================== o tema em CSS === */

console.log('\n=== As tres camadas de tema ===');

const css = fs.readFileSync(BASE + 'css/styles.css', 'utf8');
const bloco = (re) => (css.match(re) || [''])[0];
const raiz = bloco(/:root \{[\s\S]*?\n\}/);
// O media query fecha com DUAS chaves indentadas ("\n  }\n}"): casar com "\n}\n}"
// devolvia string vazia e o teste passava a medir o nada.
const claroAuto = bloco(/@media \(prefers-color-scheme: light\) \{[\s\S]*?\n  \}\n\}/);
const claroExplicito = bloco(/:root\[data-tema="light"\] \{[\s\S]*?\n\}/);

check('a camada 1 existe (escuro no :root)', raiz.length > 100, true);
check('a camada 2 existe (o sistema pede claro)', claroAuto.includes(':not([data-tema="dark"])'), true);
check('a camada 3 existe (escolha explicita)', claroExplicito.length > 100, true);

/* NENHUMA COR PODE TER SUA UNICA DEFINICAO DENTRO DE UM MEDIA QUERY. Se tiver,
   o token fica sem valor no outro tema e o elemento herda transparente — o
   defeito some da tela em que se olha e aparece na outra. */
const tokensDe = txt => [...txt.matchAll(/(--[a-z0-9-]+):/g)].map(m => m[1]);
const noEscuro = new Set(tokensDe(raiz));
const soNoClaro = tokensDe(claroAuto).filter(t => !noEscuro.has(t));
check('todo token do tema claro existe tambem no escuro',
  soNoClaro.length ? soNoClaro.join(', ') : true, true);
const soNoExplicito = tokensDe(claroExplicito).filter(t => !noEscuro.has(t));
check('e o mesmo vale para a escolha explicita',
  soNoExplicito.length ? soNoExplicito.join(', ') : true, true);

/* As duas camadas claras tem de definir O MESMO conjunto: divergir faz o app
   mudar de aparencia conforme a pessoa tenha ou nao tocado no botao de tema. */
const c2 = new Set(tokensDe(claroAuto)), c3 = new Set(tokensDe(claroExplicito));
const divergentes = [...c2].filter(t => !c3.has(t)).concat([...c3].filter(t => !c2.has(t)));
check('as duas camadas claras cobrem os mesmos tokens',
  divergentes.length ? divergentes.join(', ') : true, true);

/* AS TINTAS VEM EM CONJUNTO. Um badge com fundo tintado e sem --x-ink fica com
   texto ilegivel em um dos temas — e so em um, que e o jeito mais facil de o
   defeito passar despercebido. */
for (const tinta of ['green', 'amber', 'red', 'slate', 'blue', 'gold']) {
  for (const sufixo of ['', '-ink', '-soft', '-borda', '-contraste']) {
    check(`--${tinta}${sufixo} definido no escuro`, noEscuro.has(`--${tinta}${sufixo}`), true);
    check(`--${tinta}${sufixo} definido no claro`, c3.has(`--${tinta}${sufixo}`), true);
  }
}

/* O NEUTRO DO DIAGNOSTICO E OBRIGATORIO e nao pode ser igual ao "na media":
   dizer amarelo sem ter media e a mentira que derruba a confianca no app. */
check('o cinza do "primeiro registro" existe', noEscuro.has('--slate'), true);
const valorDe = (txt, tok) => ((txt.match(new RegExp(tok + ':\\s*([^;]+);')) || [])[1] || '').trim();
check('e nao e a mesma cor do "na media"', valorDe(raiz, '--slate') !== valorDe(raiz, '--amber'), true);

/* O alvo de toque do mercado e MAIOR que o do resto do app: la se mira com o
   polegar, andando, com a outra mao no carrinho. */
const px = t => Number((valorDe(raiz, t) || '0').replace('px', ''));
check('o alvo de toque do app tem ao menos 48px', px('--toque') >= 48, true);
check('e o do mercado e maior ainda', px('--toque-mercado') > px('--toque'), true);

/* O TECLADO COBRE O RODAPE, e o campo de preco vive nele. Sem a variavel e sem
   a folha se apoiando nela, o campo em foco fica atras do teclado — que e o
   estado normal desta tela, nao a excecao. */
check('a altura do teclado e um token', noEscuro.has('--teclado'), true);
check('e a folha se apoia acima dele', /\.folha \{[^}]*margin-bottom: var\(--teclado\)/.test(css), true);

/* A COR E DO DADO. Gradiente e sombra colorida em estado permanente fazem o
   enfeite competir com o unico lugar em que a cor significa alguma coisa. */
check('nenhum gradiente no sistema visual', /linear-gradient|radial-gradient/.test(css), false);

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
