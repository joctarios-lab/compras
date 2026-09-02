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
eval(fs.readFileSync(BASE + 'js/precos.js', 'utf8') + '; global.Precos = Precos;');
eval(fs.readFileSync(BASE + 'js/nfce.js', 'utf8') + '; global.NFCe = NFCe;');
eval(fs.readFileSync(BASE + 'js/importar.js', 'utf8') + '; global.Importar = Importar;');
eval(fs.readFileSync(BASE + 'js/sync.js', 'utf8') + '; global.Sync = Sync; global.SYNC_TABELAS = SYNC_TABELAS;');
eval(fs.readFileSync(BASE + 'js/leitura.js', 'utf8') + '; global.Leitura = Leitura;');

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

/* ================================================ O MOTOR DE PRECOS === */

console.log('\n=== Unidade canonica ===');

/* Comparar R$ 24,90 (5 kg) com R$ 5,90 (1 kg) sem normalizar da o diagnostico
   OPOSTO ao correto. E o erro mais caro que este app pode cometer, porque ele
   erra com confianca. */
check('5 kg por 24,90 sai a 4,98/kg', Precos.precoBase(24.90, 5, 'kg').valor, 4.98);
check('e a unidade e kg', Precos.precoBase(24.90, 5, 'kg').unidade, 'kg');
check('500 g por 4,50 sai a 9,00/kg', Precos.precoBase(4.50, 500, 'g').valor, 9);
check('grama vira quilo, nao fica em grama', Precos.precoBase(4.50, 500, 'g').unidade, 'kg');
check('2 L por 8,00 sai a 4,00/L', Precos.precoBase(8, 2, 'l').valor, 4);
check('350 ml por 3,50 sai a 10,00/L', Precos.precoBase(3.50, 350, 'ml').valor, 10);
check('unidade avulsa fica em un', Precos.precoBase(12, 6, 'un').valor, 2);

/* O "leve 3": tres pacotes de 500 g por R$ 12 sao 1,5 kg, nao 500 g. */
check('embalagem multipla multiplica a quantidade', Precos.precoBase(12, 500, 'g', 3).valor, 8);

/* UNIDADE DESCONHECIDA FICA DE FORA, nao vira 'un' por omissao: um palpite aqui
   envenena a mediana daquele produto para sempre, e ninguem consegue enxergar
   esse defeito depois. */
check('unidade que nao conheco devolve nulo', Precos.precoBase(10, 1, 'bandeja'), null);
check('e a normalizacao tambem', Precos.normalizarUnidade('bandeja'), null);
check('mas PC do PDV vira unidade', Precos.normalizarUnidade('PC'), 'un');
check('KG maiusculo tambem', Precos.normalizarUnidade('KG'), 'kg');
check('quilo por extenso idem', Precos.normalizarUnidade('quilo'), 'kg');
check('quantidade zero nao vira divisao por zero', Precos.precoBase(10, 0, 'kg'), null);
check('quantidade negativa idem', Precos.precoBase(10, -2, 'kg'), null);

console.log('\n=== Mais por Menos (sem historico nenhum) ===');

/* O detergente de 500 ml a 3,20 contra o refil de 1 L a 5,90. Nao depende de
   historico: e a resposta a armadilha central do produto. */
const mpm = Precos.maisPorMenos(
  { preco: 3.20, qtd: 500, unidade: 'ml' },
  { preco: 5.90, qtd: 1, unidade: 'l' });
check('acha o vencedor certo', mpm.melhor, 'b');
check('o frasco sai a 6,40/L', mpm.a.valor, 6.4);
check('o refil sai a 5,90/L', mpm.b.valor, 5.9);
check('e diz quanto o caro custa a mais', Math.round(mpm.economiaPct * 100), 8);
check('empate e empate, nao um vencedor sorteado',
  Precos.maisPorMenos({ preco: 10, qtd: 1, unidade: 'kg' }, { preco: 20, qtd: 2, unidade: 'kg' }).empate, true);
check('e empate nao elege ninguem',
  Precos.maisPorMenos({ preco: 10, qtd: 1, unidade: 'kg' }, { preco: 20, qtd: 2, unidade: 'kg' }).melhor, null);
/* Peso com volume nao se compara. Devolver um numero aqui seria devolver um
   numero ERRADO, que e a pior resposta possivel. */
check('peso com volume recusa a comparacao',
  Precos.maisPorMenos({ preco: 5, qtd: 1, unidade: 'kg' }, { preco: 5, qtd: 1, unidade: 'l' }).erro, 'unidades diferentes');

console.log('\n=== Mediana, e por que nao media ===');

check('mediana de lista impar', Precos.mediana([1, 5, 3]), 3);
check('mediana de lista par', Precos.mediana([1, 3, 5, 7]), 4);
check('lista vazia devolve nulo, nao zero', Precos.mediana([]), null);
/* Com 3 a 5 pontos uma promocao de 40% arrasta a MEDIA e o app passa meses
   chamando preco normal de caro. A mediana ignora a ponta sem descarta-la. */
const comPromocao = [10, 10, 10, 6];
check('a promocao nao arrasta a mediana', Precos.mediana(comPromocao), 10);
check('mas arrastaria a media', comPromocao.reduce((a, b) => a + b) / 4 < 10, true);

console.log('\n=== Referencia e diagnostico ===');

DB.apagarTudo();
const lojaP = DB.upsert('stores', { nome: 'Mercado Teste' });
const lojaQ = DB.upsert('stores', { nome: 'Atacado Teste' });
const itemArroz = DB.upsert('items', { nome: 'Arroz', unidade: 'kg', qtd_habitual: 5 });
const prodArroz = DB.upsert('products', { item_id: itemArroz.id, marca: 'Tio Joao', embalagem_qtd: 5, embalagem_unidade: 'kg' });

/* AS DATAS SAO RELACOES, nunca absolutas: "faz 30 dias", "faz 60 dias". Assim o
   teste vale no dia 31, em fevereiro e na virada do ano. */
const diasAtras = n => {
  const d = new Date(new Date().getTime() - n * 864e5);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const semBase = Precos.avaliar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, preco: 25, qtd: 5, unidade: 'kg' });
/* n = 0 E CINZA, NUNCA AMARELO. Dizer "na media" sem media e a mentira que
   destroi a confianca no app inteiro. */
check('sem historico o selo e cinza', semBase.selo, 'slate');
check('e o rotulo diz primeiro registro', semBase.rotulo, 'Primeiro registro');
check('nunca amarelo sem base', semBase.selo === 'amber', false);
check('e nao inventa porcentagem', semBase.delta, null);
check('mas ja informa o preco por quilo', semBase.precoBase, 5);

Precos.registrar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, store_id: lojaP.id, data: diasAtras(90), preco_total: 25, qtd: 5, unidade: 'kg' });
Precos.registrar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, store_id: lojaP.id, data: diasAtras(60), preco_total: 25, qtd: 5, unidade: 'kg' });
Precos.registrar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, store_id: lojaQ.id, data: diasAtras(30), preco_total: 21, qtd: 5, unidade: 'kg' });

const ref = Precos.referencia(DB, { product_id: prodArroz.id, item_id: itemArroz.id });
check('a referencia junta as tres observacoes', ref.n, 3);
check('a mediana e 5,00/kg', ref.mediana, 5);
check('e a confianca fica boa com tres', ref.confianca, 'boa');
check('o escopo diz que comparou o produto', ref.escopo, 'produto');
check('guarda o melhor preco ja visto', ref.melhorPreco, 4.2);
check('e a loja em que ele estava', ref.melhorLoja, lojaQ.id);

const caro = Precos.avaliar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, preco: 30, qtd: 5, unidade: 'kg' });
check('preco bem acima e vermelho', caro.selo, 'red');
check('com a porcentagem certa', caro.pct, 20);
check('e diz que esta acima', caro.acima, true);

const bom = Precos.avaliar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, preco: 20, qtd: 5, unidade: 'kg' });
check('preco bem abaixo e verde', bom.selo, 'green');
check('com a porcentagem certa', bom.pct, 20);

const naMedia = Precos.avaliar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, preco: 25.5, qtd: 5, unidade: 'kg' });
check('preco perto da mediana e amarelo', naMedia.selo, 'amber');

/* O LIMIAR E UM SO, e a fronteira tem de ser exata dos dois lados. */
const noLimiar = Precos.diagnosticar(5 * (1 + Precos.LIMIAR), { n: 3, mediana: 5, confianca: 'boa', escopo: 'produto' });
check('exatamente no limiar ja e caro', noLimiar.selo, 'red');
const abaixoDoLimiar = Precos.diagnosticar(5 * (1 + Precos.LIMIAR - 0.001), { n: 3, mediana: 5, confianca: 'boa', escopo: 'produto' });
check('um passo antes ainda e media', abaixoDoLimiar.selo, 'amber');
const noLimiarBaixo = Precos.diagnosticar(5 * (1 - Precos.LIMIAR), { n: 3, mediana: 5, confianca: 'boa', escopo: 'produto' });
check('e do lado de baixo tambem', noLimiarBaixo.selo, 'green');

/* A CASCATA: sem o produto exato, cai para o item generico — e DIZ que caiu.
   Apresentar "arroz em geral" como se fosse o mesmo produto seria mentir por
   omissao. */
const outroProduto = DB.upsert('products', { item_id: itemArroz.id, marca: 'Outra', embalagem_qtd: 1, embalagem_unidade: 'kg' });
const porItem = Precos.referencia(DB, { product_id: outroProduto.id, item_id: itemArroz.id });
check('sem o produto exato, compara pelo item', porItem.escopo, 'item');
check('e ainda assim tem base', porItem.n, 3);

/* JANELA DE 6 MESES: comparar com o ano passado diz que tudo esta caro —
   verdadeiro e inutil na gondola. */
Precos.registrar(DB, { product_id: prodArroz.id, item_id: itemArroz.id, store_id: lojaP.id, data: diasAtras(400), preco_total: 10, qtd: 5, unidade: 'kg' });
check('observacao de mais de um ano fica fora da janela', Precos.referencia(DB, { product_id: prodArroz.id }).n, 3);
check('mas entra numa janela maior', Precos.referencia(DB, { product_id: prodArroz.id }, { janelaMeses: 24 }).n, 4);

/* Confianca por numero de observacoes: um veredito com uma observacao anterior
   nao pode se apresentar como um com dez. */
DB.apagarTudo();
const it2 = DB.upsert('items', { nome: 'Cafe', unidade: 'kg' });
const pr2 = DB.upsert('products', { item_id: it2.id, marca: 'X', embalagem_qtd: 0.5, embalagem_unidade: 'kg' });
Precos.registrar(DB, { product_id: pr2.id, item_id: it2.id, data: diasAtras(10), preco_total: 20, qtd: 500, unidade: 'g' });
check('uma observacao da confianca baixa', Precos.referencia(DB, { product_id: pr2.id }).confianca, 'baixa');
Precos.registrar(DB, { product_id: pr2.id, item_id: it2.id, data: diasAtras(20), preco_total: 22, qtd: 500, unidade: 'g' });
check('duas dao confianca media', Precos.referencia(DB, { product_id: pr2.id }).confianca, 'media');

/* Historico noutra unidade NAO pode ser comparado: daria um numero, e o numero
   estaria errado. */
const emUn = Precos.avaliar(DB, { product_id: pr2.id, item_id: it2.id, preco: 20, qtd: 1, unidade: 'un' });
check('historico em kg nao avalia preco em un', emUn.base, false);

console.log('\n=== A embalagem que encolheu ===');

DB.apagarTudo();
const itBisc = DB.upsert('items', { nome: 'Biscoito', unidade: 'g' });
const prBisc = DB.upsert('products', { item_id: itBisc.id, marca: 'Y', embalagem_qtd: 150, embalagem_unidade: 'g' });
Precos.registrar(DB, { product_id: prBisc.id, item_id: itBisc.id, data: diasAtras(60), preco_total: 4.50, qtd: 150, unidade: 'g' });
Precos.registrar(DB, { product_id: prBisc.id, item_id: itBisc.id, data: diasAtras(5), preco_total: 4.50, qtd: 120, unidade: 'g' });
const enc = Precos.encolhimento(DB, prBisc.id);
check('detecta que o pacote encolheu', !!enc, true);
check('de 150 g', Math.round(enc.de * 1000), 150);
check('para 120 g', Math.round(enc.para * 1000), 120);
check('encolheu 20%', Math.round(enc.encolheuPct * 100), 20);
check('o preco da etiqueta nao mudou', enc.precoEtiquetaIgual, true);
/* E ESTE e o numero que a pessoa nao ve sozinha: 150->120 g pelo mesmo preco e
   25% de aumento por quilo. */
check('mas o preco por quilo subiu 25%', Math.round(enc.subiuPorBase * 100), 25);

/* Embalagem que CRESCEU nao e encolhimento: avisar "encolheu" ali seria dar um
   alarme falso, e alarme falso desliga o alarme. */
Precos.registrar(DB, { product_id: prBisc.id, item_id: itBisc.id, data: diasAtras(1), preco_total: 6, qtd: 200, unidade: 'g' });
check('embalagem maior nao vira aviso de encolhimento', Precos.encolhimento(DB, prBisc.id), null);

console.log('\n=== Cesta comparavel x total gasto ===');

DB.apagarTudo();
const mesAtual = DB.mesDe(DB.hojeISO());
const mesPassado = (() => {
  const [a, m] = mesAtual.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
})();
const dia = mes => mes + '-05';

const itA = DB.upsert('items', { nome: 'Leite', unidade: 'l' });
const prA = DB.upsert('products', { item_id: itA.id, marca: 'A', embalagem_qtd: 1, embalagem_unidade: 'l' });
const itB = DB.upsert('items', { nome: 'Feijao', unidade: 'kg' });
const prB = DB.upsert('products', { item_id: itB.id, marca: 'B', embalagem_qtd: 1, embalagem_unidade: 'kg' });
const itC = DB.upsert('items', { nome: 'Picanha', unidade: 'kg' });
const prC = DB.upsert('products', { item_id: itC.id, marca: 'C', embalagem_qtd: 1, embalagem_unidade: 'kg' });

// Nos dois meses: leite sobe 10%, feijao fica igual
Precos.registrar(DB, { product_id: prA.id, item_id: itA.id, data: dia(mesPassado), preco_total: 5, qtd: 1, unidade: 'l' });
Precos.registrar(DB, { product_id: prA.id, item_id: itA.id, data: dia(mesAtual), preco_total: 5.5, qtd: 1, unidade: 'l' });
Precos.registrar(DB, { product_id: prB.id, item_id: itB.id, data: dia(mesPassado), preco_total: 8, qtd: 1, unidade: 'kg' });
Precos.registrar(DB, { product_id: prB.id, item_id: itB.id, data: dia(mesAtual), preco_total: 8, qtd: 1, unidade: 'kg' });
// SO no mes atual: a picanha do churrasco — cara, e que NAO pode entrar
Precos.registrar(DB, { product_id: prC.id, item_id: itC.id, data: dia(mesAtual), preco_total: 90, qtd: 1, unidade: 'kg' });

const cesta = Precos.cestaComparavel(DB, mesPassado, mesAtual);
check('so os produtos dos DOIS meses entram', cesta.n, 2);
/* Leite 5->5,5 e feijao 8->8: (13,5-13)/13 = 3,8%. Se a picanha entrasse, o
   indice iria a centenas de por cento — e seria "inflacao" que nunca existiu. */
check('a cesta comparavel da 3,8%', Math.round(cesta.indice * 1000) / 10, 3.8);
check('a picanha do churrasco NAO entra', cesta.produtos.some(p => p.product_id === prC.id), false);
check('cesta vazia devolve nulo, nao zero', Precos.cestaComparavel(DB, '1999-01', '1999-02').indice, null);

/* O que mais subiu exige n>=2 nos dois meses: um preco solto em cada ponta e
   ruido, e ranquear ruido faz a tela mentir com numeros. */
check('com uma observacao por mes, nada e ranqueado',
  Precos.maisSubiram(DB, mesPassado, mesAtual).length, 0);
Precos.registrar(DB, { product_id: prA.id, item_id: itA.id, data: dia(mesPassado), preco_total: 5, qtd: 1, unidade: 'l' });
Precos.registrar(DB, { product_id: prA.id, item_id: itA.id, data: dia(mesAtual), preco_total: 5.5, qtd: 1, unidade: 'l' });
const subiram = Precos.maisSubiram(DB, mesPassado, mesAtual);
check('com duas em cada mes, o leite aparece', subiram.length, 1);
check('e a variacao e de 10%', Math.round(subiram[0].variacao * 100), 10);

console.log('\n=== Cadencia de compra ===');

DB.apagarTudo();
const itPapel = DB.upsert('items', { nome: 'Papel higienico', unidade: 'un' });
for (const d of [90, 60, 30]) {
  Precos.registrar(DB, { item_id: itPapel.id, data: diasAtras(d), preco_total: 20, qtd: 1, unidade: 'un' });
}
const cad = Precos.cadencia(DB, itPapel.id);
check('descobre o intervalo de 30 dias', cad.intervalo, 30);
check('e quantos dias fazem desde a ultima', cad.diasDesde, 30);
check('avisa que esta acabando', cad.acabando, true);
check('uma compra so nao gera cadencia', Precos.cadencia(DB, DB.upsert('items', { nome: 'Novo' }).id), null);

/* =============================================== NFC-e E IMPORTACAO === */

console.log('\n=== Ler a nota fiscal ===');

const chave44 = '35260812345678000199650010000012341000000001';
check('a chave de teste tem mesmo 44 digitos', chave44.length, 44);
// O portal imprime a chave em grupos de quatro: os espacos tem de sumir antes
check('extrai a chave escrita em grupos',
  NFCe.extrairChave('Chave: ' + chave44.replace(/(\d{4})/g, '$1 ')), chave44);
// Menos de 44 digitos NAO e chave — aceitar seria criar uma nota fantasma que
// nunca casaria com a de verdade no dedupe
check('numero curto nao vira chave', NFCe.extrairChave('nota 12345'), null);
check('extrai a chave completa', NFCe.extrairChave('NFe' + chave44), chave44);
check('e le a UF dela', NFCe.dadosDaChave(chave44).uf, '35');
check('e o CNPJ do emitente', NFCe.dadosDaChave(chave44).cnpj, '12345678000199');
check('chave curta nao vira dados', NFCe.dadosDaChave('123'), null);

const xml = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${chave44}">
  <emit><xNome>MERCADO BOM PRECO LTDA</xNome></emit>
  <ide><dhEmi>2026-08-15T19:30:00-03:00</dhEmi></ide>
  <det nItem="1"><prod><cProd>1234</cProd><cEAN>7891234567895</cEAN>
    <xProd>ARROZ TIO JOAO T1 5KG</xProd><uCom>UN</uCom><qCom>1.0000</qCom>
    <vUnCom>24.9000</vUnCom><vProd>24.90</vProd></prod></det>
  <det nItem="2"><prod><cProd>5678</cProd><cEAN>SEM GTIN</cEAN>
    <xProd>QJO MUSS FAT</xProd><uCom>KG</uCom><qCom>0.4500</qCom>
    <vUnCom>52.0000</vUnCom><vProd>23.40</vProd></prod></det>
  <total><ICMSTot><vNF>48.30</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

const notaXML = NFCe.ler(xml, 'nota.xml');
check('le o XML da nota', !!notaXML, true);
check('com os dois itens', notaXML.itens.length, 2);
check('a chave de acesso', notaXML.chave, chave44);
check('o nome da loja', notaXML.loja, 'MERCADO BOM PRECO LTDA');
check('a data de emissao', notaXML.data, '2026-08-15');
check('o total da nota', notaXML.total, 48.30);
check('a descricao do primeiro item', notaXML.itens[0].descricao, 'ARROZ TIO JOAO T1 5KG');
check('o EAN quando existe', notaXML.itens[0].ean, '7891234567895');
/* "SEM GTIN" e o que o layout manda escrever quando nao ha codigo. Tratar esse
   texto como EAN casaria produtos completamente diferentes. */
check('e "SEM GTIN" NAO vira um EAN', notaXML.itens[1].ean, null);
check('o peso do queijo vem em kg', notaXML.itens[1].qtd, 0.45);
check('e o valor da linha', notaXML.itens[1].valorTotal, 23.40);

const csv = 'descricao;quantidade;unidade;valor total\nARROZ 5KG;1;UN;24,90\nLEITE;6;UN;35,40';
const notaCSV = NFCe.ler(csv, 'planilha.csv');
check('le o CSV com ponto e virgula', notaCSV.itens.length, 2);
check('e entende virgula decimal brasileira', notaCSV.itens[0].valorTotal, 24.90);
check('arquivo sem nada reconhecivel devolve nulo', NFCe.ler('bom dia', 'x.txt'), null);

console.log('\n=== Casamento, dedupe e vinculo aprendido ===');

DB.apagarTudo();
const lojaImp = Importar.lojaDaNota(notaXML);
check('a loja nasce da nota', lojaImp.nome, 'MERCADO BOM PRECO LTDA');
check('e guarda o CNPJ da chave', lojaImp.cnpj, '12345678000199');
check('importar de novo nao duplica a loja', Importar.lojaDaNota(notaXML).id, lojaImp.id);

let linhas = Importar.preparar(notaXML, lojaImp.id);
check('prepara as duas linhas', linhas.length, 2);
/* O tamanho sai do TEXTO como sugestao: "ARROZ TIO JOAO T1 5KG" -> 5 kg. */
check('acha o tamanho no nome do produto', linhas[0].qtd, 5);
check('na unidade certa', linhas[0].unidade, 'kg');
check('e o queijo usa o peso da propria nota', linhas[1].qtd, 0.45);

/* MARCADO NAO E APLICADO: so entra marcado o que tem identidade exata ou ja foi
   confirmado antes. Sem isso, uma nota de 60 itens entraria com 60 palpites —
   foi assim que o app de financas errou 19 lancamentos e R$ 5.322. */
check('produto novo entra DESMARCADO', linhas[1].incluir, false);
check('e a tela diz que e produto novo', linhas[1].confianca, 'nenhuma');

for (const l of linhas) l.incluir = true;
const r1 = Importar.gravar(notaXML, linhas, lojaImp.id);
check('grava as duas linhas', r1.gravadas, 2);
check('e cria uma observacao para cada', DB.all('price_obs').length, 2);
check('com a data da NOTA, nao a de hoje', DB.all('price_obs')[0].data, '2026-08-15');
check('a origem fica registrada', DB.all('price_obs')[0].origem, 'nfce');
check('o arroz entra a 4,98/kg', DB.all('price_obs').find(o => o.preco_total === 24.90).preco_base, 4.98);

/* DEDUPE PELA CHAVE. Reimportar o mesmo arquivo dobraria o preco de tudo e
   envenenaria a mediana sem sinal nenhum na tela. */
const r2 = Importar.gravar(notaXML, linhas, lojaImp.id);
check('reimportar a mesma nota e recusado', r2.erro, 'ja_importada');
check('e nada foi duplicado', DB.all('price_obs').length, 2);

/* O VINCULO APRENDIDO: a segunda nota da mesma rede chega quase pronta. */
check('o vinculo foi aprendido', DB.all('aliases').length > 0, true);
const notaDois = { ...notaXML, chave: chave44.slice(0, 43) + '2' };
const linhas2 = Importar.preparar(notaDois, lojaImp.id);
check('o texto ja visto volta reconhecido', linhas2[1].confianca, 'aprendido');
check('e ja vem marcado', linhas2[1].incluir, true);
check('o EAN reconhece sem depender de texto', linhas2[0].confianca, 'ean');

/* UNIDADE DESCONHECIDA FICA DE FORA. */
const notaTorta = { chave: null, loja: 'X', data: '2026-08-01', itens: [
  { descricao: 'ALGO ESTRANHO', ean: null, qtd: 2, unidade: 'BANDEJA', valorTotal: 10 }] };
const linhasTortas = Importar.preparar(notaTorta, lojaImp.id);
check('linha com unidade desconhecida e marcada como problema', linhasTortas[0].problema, 'unidade desconhecida');
check('e nao pode ser incluida', linhasTortas[0].incluir, false);

/* Nome INTEIRO, nunca pedaco: comparar pedacos foi o que fez "ARAGUARI" virar
   conta de agua no app de financas. */
DB.upsert('items', { nome: 'Cafe' });
const notaParcial = { chave: null, loja: 'X', data: '2026-08-01', itens: [
  { descricao: 'CAFETEIRA ELETRICA', ean: null, qtd: 1, unidade: 'UN', valorTotal: 120 }] };
check('"CAFETEIRA" nao casa com o item "Cafe"',
  Importar.preparar(notaParcial, lojaImp.id)[0].confianca, 'nenhuma');

/* ================================================ LISTA E CARRINHO === */

console.log('\n=== Lista e total do carrinho ===');

DB.apagarTudo();
const lj = DB.upsert('stores', { nome: 'Super' });
const lista = DB.novaLista({ nome: 'Semana', store_id: lj.id, orcamento: 200 });
check('a lista nasce planejada', lista.status, 'planejada');
check('e nao ha compra em curso', DB.listaEmCurso(), null);

const iArroz = DB.itemPorNome('Arroz', { unidade: 'kg', qtd_habitual: 5 });
const iLeite = DB.itemPorNome('Leite', { unidade: 'l', qtd_habitual: 6 });
check('o item nasce no catalogo', DB.all('items').length, 2);
/* "Arroz" e "arroz" sao a MESMA coisa: deixar os dois nascerem partiria o
   historico do produto pela metade, sem ninguem perceber. */
check('o mesmo nome em outra caixa nao cria item novo', DB.itemPorNome('arroz').id, iArroz.id);
check('e o catalogo continua com dois', DB.all('items').length, 2);

DB.addNaLista(lista.id, { item_id: iArroz.id, qtd: 5, unidade: 'kg' });
DB.addNaLista(lista.id, { item_id: iLeite.id, qtd: 6, unidade: 'un' });
check('a lista tem dois itens', DB.itensDaLista(lista.id).length, 2);

const t0 = DB.totalDoCarrinho(lista.id, () => null);
check('carrinho vazio soma zero', t0.firme, 0);
check('mas conhece o total de itens', t0.itens, 2);
check('e todos estao pendentes', t0.pendentes, 2);

const li1 = DB.itensDaLista(lista.id)[0];
DB.upsert('list_items', { id: li1.id, comprado: true, preco_total: 24.90 });
const t1 = DB.totalDoCarrinho(lista.id, () => 30);
check('o que ja tem preco soma firme', t1.firme, 24.90);
/* O QUE FALTA E ESTIMATIVA, e fica em SEPARADO: misturar os dois faria a pessoa
   confiar num palpite como se fosse o valor do caixa. */
check('e o que falta fica estimado a parte', t1.estimado, 30);
check('sem se misturarem', t1.total, 54.90);
check('a contagem de comprados sobe', t1.comprados, 1);

/* "Nao tinha" sai da conta inteira: nem soma, nem conta como pendente. */
const li2 = DB.itensDaLista(lista.id)[1];
DB.upsert('list_items', { id: li2.id, nao_tinha: true });
const t2 = DB.totalDoCarrinho(lista.id, () => 30);
check('item indisponivel sai da estimativa', t2.estimado, 0);
check('e da contagem de itens', t2.itens, 1);

/* UMA COMPRA EM CURSO POR VEZ: duas fariam o preco cair na compra errada, e
   isso e invisivel ate o mes virar. */
DB.upsert('lists', { id: lista.id, status: 'em_curso' });
check('agora ha uma compra em curso', DB.listaEmCurso().id, lista.id);
DB.upsert('lists', { id: lista.id, status: 'fechada', data_fechamento: DB.hojeISO() });
check('fechada, ela sai de curso', DB.listaEmCurso(), null);
check('e aparece no historico', DB.listasFechadas().length, 1);

/* O catalogo ordena por FREQUENCIA: o que se compra toda semana tem de estar no
   topo da primeira letra digitada. */
DB.apagarTudo();
const raro = DB.itemPorNome('Abacaxi');
const comum = DB.itemPorNome('Arroz');
for (let i = 0; i < 3; i++) {
  Precos.registrar(DB, { item_id: comum.id, data: diasAtras(i * 10), preco_total: 25, qtd: 5, unidade: 'kg' });
}
check('o mais comprado vem primeiro na busca', DB.buscarItens('a')[0].id, comum.id);
check('e o raro vem depois', DB.buscarItens('a')[1].id, raro.id);

/* ========================================================== SYNC === */

console.log('\n=== Sincronizacao (F8) ===');

DB.apagarTudo();
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1' };
check('nao esta logado sem token', Sync.logado(), false);
check('nem configurado sem url', (Sync.cfg = { anonKey: 'k' }, Sync.configurado()), false);
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1', access_token: 't' };
check('configurado com url e chave', Sync.configurado(), true);

/* TODA STORE SINCRONIZADA precisa estar declarada: uma que fique de fora nunca
   sobe, e ninguem descobre ate trocar de aparelho. */
for (const s of ['stores', 'items', 'products', 'lists', 'list_items', 'price_obs', 'nfce_docs', 'aliases']) {
  check(`${s} esta declarada para sincronizar`, !!SYNC_TABELAS[s], true);
}

const obsSync = Precos.registrar(DB, { item_id: DB.itemPorNome('Teste').id, data: DB.hojeISO(), preco_total: 10, qtd: 1, unidade: 'kg' });
const linhaEnviada = Sync.linhaDe('price_obs', DB.get('price_obs', obsSync.id));
check('a linha enviada leva o dono', linhaEnviada.user_id, 'u1');
check('e o carimbo do cliente para resolver conflito', !!linhaEnviada.updated_at, true);
check('e a marca de apagado', linhaEnviada.deleted, false);
check('o preco por unidade vai junto', linhaEnviada.preco_base, 10);
/* `dirty` e de controle LOCAL: mandar para o banco criaria uma coluna que nao
   existe, e o Postgres recusaria o lote inteiro — nada mais sincronizaria. */
check('mas o controle local NAO e enviado', linhaEnviada.dirty, undefined);

/* O schema tem de cobrir o que o app envia: coluna faltando derruba o lote. */
const schema = fs.readFileSync(BASE + 'supabase/schema.sql', 'utf8');
for (const [tabela, colunas] of Object.entries(SYNC_TABELAS)) {
  const bloco = (schema.match(new RegExp('create table if not exists public\\.' + tabela + '[\\s\\S]*?\\);')) || [''])[0];
  const faltando = colunas.filter(c => !bloco.includes(c));
  check(`${tabela}: o schema tem todas as colunas enviadas`,
    faltando.length ? faltando.join(', ') : true, true);
}
/* server_at e o marcador do pull: sem o gatilho, um aparelho offline perde
   registros em silencio. */
check('o schema cria o carimbo do servidor', schema.includes('server_at'), true);
check('com gatilho em toda escrita', schema.includes('trg_server_at'), true);
check('e RLS por dono', schema.includes('auth.uid()'), true);

/* A ORDEM DAS DECLARACOES NO SCHEMA.

   Numa base NOVA, o bloco que acrescenta server_at nao pode vir antes dos
   create table: o `alter table if exists` passa em silencio, mas o
   `create index` da linha seguinte aborta com "relation does not exist" e
   derruba o script inteiro — nenhuma tabela e criada, e o unico sinal e o erro
   no painel do Supabase.

   Foi exatamente assim que o schema estava, e so apareceu quando o verificador
   consultou um projeto de verdade e achou zero tabelas. */
/* SEM OS COMENTARIOS. Um teste que procura um literal casa com o comentario que
   FALA sobre o literal — e passa (ou reprova) sem olhar para o SQL de verdade.
   Aconteceu aqui: o comentario que explica o defeito do 'create index' fez o
   teste de idempotencia reprovar. */
const sql = schema.split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n');
const posPrimeiraTabela = sql.search(/create table if not exists/);
const posIndice = sql.search(/create index if not exists/);
const posTrigger = sql.search(/create trigger trg_server_at/);
const posAlter = sql.search(/add column if not exists server_at/);
check('as tabelas sao criadas antes dos indices', posPrimeiraTabela < posIndice, true);
check('e antes dos gatilhos', posPrimeiraTabela < posTrigger, true);
check('e antes de acrescentar o carimbo do servidor', posPrimeiraTabela < posAlter, true);
check('o RLS vem por ultimo', sql.search(/create policy/) > posPrimeiraTabela, true);

/* O schema tem de ser IDEMPOTENTE: rodar de novo e o jeito certo de aplicar uma
   atualizacao, e um `create table` sem guarda apagaria essa possibilidade. */
const criacoes = sql.match(/create table[^(]*/gi) || [];
check('toda criacao de tabela e idempotente',
  criacoes.every(c => /if not exists/i.test(c)), true);
check('e todo indice tambem',
  (sql.match(/create (unique )?index[^(]*/gi) || []).every(c => /if not exists/i.test(c)), true);
/* Gatilho nao aceita "if not exists": o jeito idempotente e derrubar antes. */
check('o gatilho e derrubado antes de recriado', sql.includes('drop trigger if exists'), true);
check('e a politica de RLS tambem', sql.includes('drop policy if exists'), true);

/* O verificador de banco existe e cobre as mesmas tabelas que o app envia: se
   ele conferir menos, uma tabela pode faltar no banco sem ninguem notar. */
const verificador = fs.readFileSync(BASE + 'supabase/verificar.js', 'utf8');
for (const tabela of Object.keys(SYNC_TABELAS)) {
  check(`o verificador confere a tabela ${tabela}`, verificador.includes(tabela + ':'), true);
}

/* ======================================================= LEITURA === */

console.log('\n=== Camera, codigo de barras e OCR ===');

/* A BarcodeDetector NAO existe no Safari — logo, em nenhum navegador de iPhone.
   O app tem de DIZER isso, e nao mostrar um botao que falha em silencio. */
check('sem BarcodeDetector, o app sabe que nao suporta', Leitura.suportaBarras(), false);
check('o OCR nasce desligado', Leitura.ocrLigado(), false);
/* O QR do cupom carrega a chave da NOTA, nao um EAN de produto: trata-lo como
   codigo de barras criaria um produto fantasma. */
check('o QR da nota e reconhecido como chave', Leitura.chaveDeQR('http://sefaz.x/consulta?p=' + chave44 + '|2|1'), chave44);
check('e um EAN comum nao vira chave de nota', Leitura.chaveDeQR('7891234567895'), null);

/* ================================================== SHELL COMPLETO === */

console.log('\n=== Todos os modulos no shell ===');

/* Todo arquivo js/ do projeto tem de estar no index E no cache do sw: um modulo
   fora do cache e buscado na rede — dentro do mercado, onde nao ha rede. */
const listarJs = (dir, prefixo) => fs.readdirSync(BASE + dir)
  .filter(f => f.endsWith('.js'))
  .map(f => prefixo + f);
const modulos = listarJs('js', 'js/').concat(listarJs('js/views', 'js/views/'));
for (const m of modulos) {
  check(`${m} esta no index`, shell.includes(m + '?v='), true);
  check(`${m} esta no cache offline`, sw.includes(`'${m}?v=' + VERSAO`), true);
}

(async () => {

/* ============================ AS LACUNAS QUE AS SABOTAGENS REVELARAM ===

   Cinco sabotagens passaram na primeira rodada. Nenhuma era redundante — as
   cinco eram TESTE VAZIO, o modo de falhar mais silencioso que existe: o teste
   estava escrito, rodava, e nao exercitava a regra que dizia proteger.

   Cada bloco abaixo e a assercao que faltava. */

console.log('\n=== As lacunas (achadas por sabotagem) ===');

/* 1. A CESTA COMPARAVEL, do lado que faltava.

   O teste anterior so cobria produto que existe SO NO MES ATUAL (a picanha do
   churrasco). Mas o laco percorre o mes BASE, entao a picanha nunca teve chance
   de entrar — a assercao passava sem exercitar nada. O caso de verdade e o
   inverso: produto comprado no mes passado e NAO comprado neste. */
DB.apagarTudo();
const mAtual = DB.mesDe(DB.hojeISO());
const mPassado = (() => {
  const [a, m] = mAtual.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
})();

const itL = DB.upsert('items', { nome: 'Leite2', unidade: 'l' });
const prL = DB.upsert('products', { item_id: itL.id, marca: 'A', embalagem_qtd: 1, embalagem_unidade: 'l' });
const itS = DB.upsert('items', { nome: 'Sorvete', unidade: 'l' });
const prS = DB.upsert('products', { item_id: itS.id, marca: 'S', embalagem_qtd: 2, embalagem_unidade: 'l' });

// Nos dois meses, sem variacao nenhuma
Precos.registrar(DB, { product_id: prL.id, item_id: itL.id, data: mPassado + '-05', preco_total: 5, qtd: 1, unidade: 'l' });
Precos.registrar(DB, { product_id: prL.id, item_id: itL.id, data: mAtual + '-05', preco_total: 5, qtd: 1, unidade: 'l' });
// So no mes PASSADO, e caro: se entrar, arrasta o indice para baixo sozinho
Precos.registrar(DB, { product_id: prS.id, item_id: itS.id, data: mPassado + '-05', preco_total: 40, qtd: 2, unidade: 'l' });

const cestaMeia = Precos.cestaComparavel(DB, mPassado, mAtual);
check('produto que sumiu no mes atual fica de fora', cestaMeia.n, 1);
check('e o indice nao se mexe por causa dele', cestaMeia.indice, 0);
check('nem o produto ausente aparece na lista',
  cestaMeia.produtos.some(p => p.product_id === prS.id), false);

/* Unidade diferente entre os meses tambem nao entra: comparar R$/L com R$/un
   daria um numero, e o numero estaria errado. */
const itQ = DB.upsert('items', { nome: 'Queijo2' });
const prQ = DB.upsert('products', { item_id: itQ.id, marca: 'Q' });
Precos.registrar(DB, { product_id: prQ.id, item_id: itQ.id, data: mPassado + '-05', preco_total: 30, qtd: 1, unidade: 'kg' });
Precos.registrar(DB, { product_id: prQ.id, item_id: itQ.id, data: mAtual + '-05', preco_total: 15, qtd: 1, unidade: 'un' });
check('produto que mudou de unidade fica de fora',
  Precos.cestaComparavel(DB, mPassado, mAtual).n, 1);

/* 2. REGISTRAR RECUSA UNIDADE QUE NAO SABE CONVERTER.

   O teste anterior cobria a TELA DE IMPORTACAO, nao a gravacao. A porta de
   entrada de preco e Precos.registrar, e e ela que precisa se recusar: um
   palpite gravado aqui envenena a mediana daquele produto para sempre, e o
   defeito e invisivel depois. */
DB.apagarTudo();
const itX = DB.upsert('items', { nome: 'Bandeja de ovos' });
const antesDeTentar = DB.all('price_obs').length;
const recusada = Precos.registrar(DB, {
  item_id: itX.id, data: DB.hojeISO(), preco_total: 18, qtd: 1, unidade: 'BANDEJA',
});
check('registrar recusa a unidade que nao conhece', recusada, null);
check('e NAO grava nada com palpite', DB.all('price_obs').length, antesDeTentar);
// E o caminho feliz continua funcionando, senao o teste acima passaria com a
// funcao inteira quebrada
check('mas grava normalmente com unidade conhecida',
  !!Precos.registrar(DB, { item_id: itX.id, data: DB.hojeISO(), preco_total: 18, qtd: 12, unidade: 'un' }), true);
check('e a observacao entrou mesmo', DB.all('price_obs').length, antesDeTentar + 1);

/* 3. O CASAMENTO POR NOME SUGERE, MAS NAO APLICA.

   O teste anterior olhava uma linha com confianca "nenhuma" — que vem
   desmarcada por definicao. O caso que importa e o do meio: nome IGUAL a um
   item do catalogo. Ele deve ser sugerido e vir DESMARCADO, porque nome igual
   nao e prova de que e o mesmo produto. Foi assim que o app de financas errou
   19 lancamentos e R$ 5.322. */
DB.apagarTudo();
const lojaC = DB.upsert('stores', { nome: 'Loja C' });
DB.upsert('items', { nome: 'ARROZ' });
const notaNome = { chave: null, loja: 'Loja C', data: '2026-08-01', itens: [
  { descricao: 'ARROZ', ean: null, qtd: 5, unidade: 'KG', valorTotal: 25 }] };
const linhaNome = Importar.preparar(notaNome, lojaC.id)[0];
check('nome igual e reconhecido', linhaNome.confianca, 'nome');
check('mas NAO vem marcado para entrar', linhaNome.incluir, false);
// O EAN, sim, vem marcado: ali a identidade e exata, nao ha adivinhacao
const prodEAN = DB.upsert('products', { item_id: DB.itemPorNome('Leite3').id, ean: '7890000000017' });
const notaEAN = { chave: null, loja: 'Loja C', data: '2026-08-01', itens: [
  { descricao: 'QUALQUER COISA', ean: '7890000000017', qtd: 1, unidade: 'L', valorTotal: 5 }] };
const linhaEAN = Importar.preparar(notaEAN, lojaC.id)[0];
check('mas o EAN vem marcado, porque e identidade exata', linhaEAN.incluir, true);
check('e aponta o produto certo', linhaEAN.product_id, prodEAN.id);

/* 4. O PULL PEDE PELO CARIMBO DO SERVIDOR.

   Nao havia teste NENHUM do pull — o que existia olhava o schema, que a
   sabotagem nao tocava. Aqui o Sync roda de verdade contra um fetch falso, e o
   que se mede e a URL que ele pede.

   Isto importa mais que parece: no app de financas, pedir "o que mudou desde X"
   pelo relogio do CLIENTE causou PERDA SILENCIOSA de registros de um aparelho
   que ficou offline. Nada dava erro — os dados apenas sumiam. */
DB.apagarTudo();
const pedidos = [];
const fetchOriginal = global.fetch;
global.fetch = async (url) => {
  pedidos.push(String(url));
  return { ok: true, json: async () => [], text: async () => '' };
};
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1', access_token: 't' };
DB.data.meta.lastSync = '2026-01-01T00:00:00Z';
await Sync.pull();
global.fetch = fetchOriginal;

check('o pull consultou todas as tabelas', pedidos.length, Object.keys(SYNC_TABELAS).length);
check('e filtrou pelo carimbo do SERVIDOR', pedidos.every(u => u.includes('server_at=gt.')), true);
check('nunca pelo relogio do cliente', pedidos.some(u => u.includes('updated_at=gt.')), false);
check('e ordenou por ele tambem', pedidos.every(u => u.includes('order=server_at.asc')), true);

/* 5. O RLS COBRE CADA TABELA, uma por uma.

   O teste anterior procurava a string "auth.uid()" no arquivo inteiro — e ela
   aparece em outros lugares, entao a sabotagem que abriu a politica para `true`
   passou batido. Sem RLS de verdade, a chave anon (que e publica por natureza)
   daria a qualquer pessoa acesso a base inteira. */
const politica = (schema.match(/create policy[\s\S]*?with check \([^)]*\)/) || [''])[0];
check('a politica compara com o dono da linha', politica.includes('user_id = auth.uid()'), true);
check('na leitura', /using \(user_id = auth\.uid\(\)\)/.test(schema), true);
check('e na escrita', /with check \(user_id = auth\.uid\(\)\)/.test(schema), true);
check('e nunca libera para todos', /using \(true\)|with check \(true\)/.test(schema), false);
// A politica e criada em laco: a lista do laco tem de conter TODA tabela
// sincronizada, senao uma delas fica sem protecao nenhuma
const listaRLS = (schema.match(/tabelas text\[\] := array\[([\s\S]*?)\]/) || [])[1] || '';
for (const t of Object.keys(SYNC_TABELAS)) {
  check(`${t} entra no laco que cria o RLS`, listaRLS.includes(`'${t}'`), true);
}




/* ===================================== AS TELAS RODAM DE VERDADE ===

   Ate aqui as views eram conferidas como ARQUIVO — existem, estao no shell,
   estao no cache. Nada disso as EXECUTA. Um erro de runtime numa tela (uma
   variavel com nome trocado, um campo que nao existe) quebraria o app inteiro
   na primeira abertura, e nenhum teste diria nada.

   Aqui elas sao montadas de verdade, com dados reais no banco, e o que se mede
   e o HTML que sai. */

console.log('\n=== As telas montam ===');

eval(fs.readFileSync(BASE + 'js/views/lista.js', 'utf8') + '; global.ViewLista = ViewLista;');
eval(fs.readFileSync(BASE + 'js/views/mercado.js', 'utf8') + '; global.Mercado = Mercado;');
eval(fs.readFileSync(BASE + 'js/views/historico.js', 'utf8') + '; global.ViewHistorico = ViewHistorico;');

DB.apagarTudo();

/* 1. LISTA VAZIA. O estado vazio tem de dizer o PROXIMO PASSO — "sem dados" so
   informa o que a pessoa ja esta vendo. */
const listaVazia = ViewLista.render();
check('a lista monta sem nenhum dado', listaVazia.length > 50, true);
check('e o vazio convida a criar a lista', /Criar lista|Nenhuma lista/.test(listaVazia), true);

/* 2. LISTA COM ITENS E ESTIMATIVA. */
const lojaV = DB.upsert('stores', { nome: 'Mercado da Esquina' });
const listaV = DB.novaLista({ nome: 'Semana', store_id: lojaV.id, orcamento: 300 });
const itArrozV = DB.itemPorNome('Arroz', { unidade: 'kg', qtd_habitual: 5 });
const itLeiteV = DB.itemPorNome('Leite', { unidade: 'l', qtd_habitual: 1 });
DB.addNaLista(listaV.id, { item_id: itArrozV.id, qtd: 5, unidade: 'kg' });
DB.addNaLista(listaV.id, { item_id: itLeiteV.id, qtd: 1, unidade: 'l' });

const comItens = ViewLista.render();
check('a lista mostra os itens', comItens.includes('Arroz') && comItens.includes('Leite'), true);
check('e oferece ir ao mercado', comItens.includes('Estou no mercado'), true);
check('e o Mais por Menos, que nao precisa de historico', comItens.includes('Mais por Menos'), true);
/* Sem historico NAO ha estimativa — e a tela diz isso, em vez de mostrar R$ 0,00,
   que seria um numero falso apresentado como verdadeiro. */
check('sem historico, nao inventa estimativa', comItens.includes('Sem histórico ainda'), true);

// Com historico, a estimativa aparece
const prodArrozV = DB.upsert('products', { item_id: itArrozV.id, marca: 'T', embalagem_qtd: 5, embalagem_unidade: 'kg' });
for (const d of [10, 40]) {
  Precos.registrar(DB, { product_id: prodArrozV.id, item_id: itArrozV.id, store_id: lojaV.id,
    data: diasAtras(d), preco_total: 25, qtd: 5, unidade: 'kg' });
}
const li = DB.itensDaLista(listaV.id).find(x => x.item_id === itArrozV.id);
check('a estimativa do item sai da mediana', ViewLista.estimar(li), 25);
check('e aparece na tela', ViewLista.render().includes('Com base no seu histórico'), true);
/* Item sem referencia NAO entra como zero: somar zero faria a estimativa
   parecer completa quando ela nao e. */
const liLeite = DB.itensDaLista(listaV.id).find(x => x.item_id === itLeiteV.id);
check('item sem historico nao vira zero na estimativa', ViewLista.estimar(liLeite), null);
check('e a tela avisa quantos faltam', ViewLista.render().includes('referência'), true);

/* 3. MODO MERCADO. */
DB.upsert('lists', { id: listaV.id, status: 'em_curso' });
Mercado.listaId = listaV.id;
Mercado.focoId = null;
const mercadoHtml = Mercado.render();
check('o Modo Mercado monta', mercadoHtml.length > 100, true);
check('mostra o total do carrinho', mercadoHtml.includes('No carrinho'), true);
check('e a barra de orcamento', mercadoHtml.includes('orcamento') || mercadoHtml.includes('disponíveis'), true);
check('com o item pendente', mercadoHtml.includes('Arroz'), true);
check('e o botao de finalizar', mercadoHtml.includes('Finalizar compra'), true);

/* O painel de preco so existe na linha em FOCO: abrir todos de uma vez encheria
   a tela de campos e destruiria a leitura no corredor. */
check('sem foco, nenhum campo de preco aberto', mercadoHtml.includes('campo-preco'), false);
Mercado.focoId = li.id;
const comFoco = Mercado.render();
check('com foco, o campo de preco aparece', comFoco.includes('campo-preco'), true);
check('e so um', (comFoco.match(/campo-preco/g) || []).length, 1);
check('o teclado ja abre em modo decimal', comFoco.includes('inputmode="decimal"'), true);

/* 4. O DIAGNOSTICO NA TELA. A cor NUNCA informa sozinha: palavra e numero
   sempre junto do selo. */
const diagCaro = Mercado.htmlDoDiagnostico(
  Precos.avaliar(DB, { product_id: prodArrozV.id, item_id: itArrozV.id, preco: 30, qtd: 5, unidade: 'kg' }));
check('o selo vermelho aparece', diagCaro.includes('s-red'), true);
check('com a PALAVRA junto da cor', diagCaro.includes('Caro'), true);
check('e a porcentagem', diagCaro.includes('20%'), true);
check('e a base auditavel: a mediana', diagCaro.includes('mediana'), true);
check('e quantos registros a sustentam', diagCaro.includes('registros'), true);
/* Quando esta caro, a tela precisa dizer o que FAZER — um 🔴 sozinho deixa a
   pessoa sem saida. */
check('e o melhor preco ja visto, para poder decidir', diagCaro.includes('Melhor preço já visto'), true);

const diagSemBase = Mercado.htmlDoDiagnostico(
  Precos.avaliar(DB, { item_id: itLeiteV.id, preco: 5, qtd: 1, unidade: 'l' }));
check('sem base, o selo e cinza', diagSemBase.includes('s-slate'), true);
check('e diz primeiro registro', diagSemBase.includes('Primeiro registro'), true);
check('nunca "na media"', diagSemBase.includes('Na média'), false);

/* 5. HISTORICO. */
const histVazio = (DB.apagarTudo(), ViewHistorico.render());
check('o historico monta vazio', histVazio.includes('Ainda não há nada registrado'), true);
check('e oferece importar nota, que e o atalho para ter historico',
  histVazio.includes('Importar nota fiscal'), true);

// Com dados dos dois meses, os cartoes aparecem
const itH = DB.upsert('items', { nome: 'Cafe', unidade: 'kg' });
const prH = DB.upsert('products', { item_id: itH.id, marca: 'C', embalagem_qtd: 0.5, embalagem_unidade: 'kg' });
const mA = DB.mesDe(DB.hojeISO());
const mP = ViewHistorico.mesAnterior(mA);
Precos.registrar(DB, { product_id: prH.id, item_id: itH.id, data: mP + '-05', preco_total: 20, qtd: 500, unidade: 'g' });
Precos.registrar(DB, { product_id: prH.id, item_id: itH.id, data: mA + '-05', preco_total: 22, qtd: 500, unidade: 'g' });
/* PRECO OBSERVADO NAO E GASTO: ver o preco na gondola nao significa ter
   comprado, e somar observacao como despesa inflaria o mes de quem so anda
   consultando. O gasto vem da compra fechada ou da nota importada — por isso as
   duas notas abaixo, sem as quais o cartao de gasto nao tem o que dizer. */
DB.upsert('nfce_docs', { chave: 'h1', data: mP + '-05', total: 100, itens_importados: 1 });
DB.upsert('nfce_docs', { chave: 'h2', data: mA + '-05', total: 130, itens_importados: 1 });
check('preco observado sozinho NAO vira gasto',
  (DB.remove('nfce_docs', DB.all('nfce_docs')[0].id), DB.remove('nfce_docs', DB.all('nfce_docs')[0].id),
   ViewHistorico.gastoDoMes(mA)), 0);
DB.upsert('nfce_docs', { chave: 'h3', data: mP + '-05', total: 100, itens_importados: 1 });
DB.upsert('nfce_docs', { chave: 'h4', data: mA + '-05', total: 130, itens_importados: 1 });
const histCheio = ViewHistorico.render();
check('com dados, mostra a cesta comparavel', histCheio.includes('Sua cesta comparável'), true);
/* OS DOIS NUMEROS TEM NOMES DIFERENTES na mesma tela: e a regra que impede o
   defeito de "Disponivel" x "Saldo em conta" do DOMI. */
check('e o total gasto, com outro nome', histCheio.includes('Você gastou'), true);
check('e deixa claro que gasto nao e inflacao', histCheio.includes('não é inflação'), true);

check('a virada de ano no mes anterior', ViewHistorico.mesAnterior('2027-01'), '2026-12');
check('e o mes comum', ViewHistorico.mesAnterior('2026-09'), '2026-08');

/* 6. O GASTO DO MES vem das DUAS origens: compra fechada no app e nota
   importada. Contar so a primeira deixava esta tela vazia para quem importou
   meses de nota e ainda nao fechou compra nenhuma — que e o caminho
   recomendado para comecar a usar o app. Achado por teste de tela. */
DB.apagarTudo();
const mesG = DB.mesDe(DB.hojeISO());
const lojaG = DB.upsert('stores', { nome: 'Loja G' });
DB.upsert('nfce_docs', { chave: 'k1', store_id: lojaG.id, data: mesG + '-10', total: 250, itens_importados: 3 });
check('nota importada conta como gasto do mes', ViewHistorico.gastoDoMes(mesG), 250);

const listaG = DB.novaLista({ nome: 'C', store_id: lojaG.id });
DB.upsert('lists', { id: listaG.id, status: 'fechada', data_fechamento: mesG + '-20', total_cupom: 100 });
check('e a compra fechada soma junto', ViewHistorico.gastoDoMes(mesG), 350);

/* A GUARDA CONTRA DOBRAR: fechar a compra no app e depois importar o cupom da
   MESMA ida ao mercado nao pode contar duas vezes — um numero que dobra sozinho
   destroi a confianca na tela inteira. */
DB.upsert('nfce_docs', { chave: 'k2', store_id: lojaG.id, data: mesG + '-20', total: 100, itens_importados: 5 });
check('a nota da mesma ida ao mercado nao dobra o gasto', ViewHistorico.gastoDoMes(mesG), 350);
check('mas outra loja no mesmo dia conta normalmente',
  (DB.upsert('nfce_docs', { chave: 'k3', store_id: DB.upsert('stores', { nome: 'Outra' }).id,
     data: mesG + '-20', total: 60, itens_importados: 1 }), ViewHistorico.gastoDoMes(mesG)), 410);



  console.log(`
${ok} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})();
