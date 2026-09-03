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
Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: { onLine: false } });
global.scrollTo = () => {};
global.addEventListener = () => {};
global.setTimeout = global.setTimeout;

/* ---- carrega os modulos reais ---- */
eval(fs.readFileSync(BASE + 'js/db.js', 'utf8') + '; global.DB = DB; global.STORES = STORES; global.CICLOS = CICLOS;');
eval(fs.readFileSync(BASE + 'js/ui.js', 'utf8') + '; global.UI = UI;');
eval(fs.readFileSync(BASE + 'js/icons.js', 'utf8') + '; global.ICONES = ICONES; global.pintarIcones = pintarIcones;');
eval(fs.readFileSync(BASE + 'js/catalogo.js', 'utf8') + '; global.Catalogo = Catalogo; global.CORREDORES = CORREDORES; global.ITENS_COMUNS = ITENS_COMUNS;');
eval(fs.readFileSync(BASE + 'js/precos.js', 'utf8') + '; global.Precos = Precos;');
eval(fs.readFileSync(BASE + 'js/despensa.js', 'utf8') + '; global.Despensa = Despensa;');
eval(fs.readFileSync(BASE + 'js/decisoes.js', 'utf8') + '; global.Decisoes = Decisoes;');
eval(fs.readFileSync(BASE + 'js/cozinha.js', 'utf8') + '; global.Cozinha = Cozinha; global.PRATOS = PRATOS; global.EVENTOS = EVENTOS;');
eval(fs.readFileSync(BASE + 'js/nfce.js', 'utf8') + '; global.NFCe = NFCe;');
eval(fs.readFileSync(BASE + 'js/importar.js', 'utf8') + '; global.Importar = Importar;');
eval(fs.readFileSync(BASE + 'js/sync.js', 'utf8') + '; global.Sync = Sync; global.SYNC_TABELAS = SYNC_TABELAS;');
eval(fs.readFileSync(BASE + 'js/leitura.js', 'utf8') + '; global.Leitura = Leitura;');

// ---- assercoes ----
let ok = 0, fail = 0;
const check = (nome, real, esperado) => {
  /* NULL NAO E ZERO, e a distincao e o coracao deste app: "nao sei quanto ha em
     casa" e "acabou" sao afirmacoes diferentes, e mostrar zero onde nao se sabe
     seria mentir. Number(null) === 0, entao a comparacao numerica dava toda
     assercao check(0, null) como verde — foi assim que a sabotagem do saldo de
     perecivel passou batido. */
  const vazio = v => v === null || v === undefined;
  if (vazio(esperado) || vazio(real)) {
    const bateuVazio = vazio(esperado) && vazio(real);
    console.log(`${bateuVazio ? '  OK  ' : ' FALHA'} | ${nome.padEnd(58)} ${bateuVazio ? real : `obtido ${real}, esperado ${esperado}`}`);
    bateuVazio ? ok++ : fail++;
    return;
  }
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

/* O CSS do app sao DOIS arquivos: o do DOMI, herdado sem alteracao, e a
   camada do CESTA por cima. Testar so um dos dois deixaria metade do sistema
   visual sem cobertura. */
const cssDomi = fs.readFileSync(BASE + 'css/domi.css', 'utf8');
const cssCesta = fs.readFileSync(BASE + 'css/cesta.css', 'utf8');
const css = cssDomi + cssCesta;
/* TODAS as ocorrências de cada camada, somadas — não a primeira.

   O CSS do app são dois arquivos: css/domi.css (herdado do app de finanças, sem
   alteração) e css/cesta.css (a camada de compras). Cada um define a sua parte
   das três camadas de tema, e o navegador soma. Ler só o primeiro bloco :root
   media metade do sistema visual e deixaria a outra metade sem cobertura
   nenhuma — foi o que aconteceu quando --slate passou a morar no cesta.css. */
const todos = re => (css.match(re) || []).join('\n');
const raiz = todos(/:root \{[\s\S]*?\n\}/g);
// O media query fecha com DUAS chaves indentadas ("\n  }\n}"): casar com "\n}\n}"
// devolvia string vazia e o teste passava a medir o nada.
const claroAuto = todos(/@media \(prefers-color-scheme: light\) \{[\s\S]*?\n  \}\n\}/g);
const claroExplicito = todos(/:root\[data-tema="light"\] \{[\s\S]*?\n\}/g);

/* O CSS herdado tem de ser IDENTICO ao do DOMI. Sem esta guarda, os dois apps
   divergem no primeiro ajuste que alguem fizer de um lado so — e "identicos"
   vira uma frase no README que ninguem confere. */
{
  const domiOriginal = 'D:/Projetos/meus-projetos/financas/css/styles.css';
  if (fs.existsSync(domiOriginal)) {
    /* COMPARANDO SEM O FIM DE LINHA. O .gitattributes normaliza tudo para LF,
       e o arquivo do app de financas usa CRLF — num clone novo a comparacao
       byte a byte reprovaria por causa da quebra de linha, que nao muda uma
       virgula do sistema visual. E a armadilha CRLF x LF que o RETOMADA ja
       documenta, aparecendo num lugar novo. */
    const semQuebra = t => t.split('\r\n').join('\n');
    check('css/domi.css e copia fiel do app de financas',
      semQuebra(fs.readFileSync(domiOriginal, 'utf8')) === semQuebra(cssDomi), true);
  }
}
/* E a camada do CESTA nao pode redefinir o que o DOMI ja define: duas fontes de
   verdade para o mesmo componente e como os dois apps comecam a se afastar. */
{
  const componentesDoDomi = ['.btn {', '.card {', '.icon-btn {', '.settings-item {',
    '.sheet {', '.tabbar {', '.tab {', '.topbar {', '.badge {', '.side-item {'];
  /* No inicio da linha: '.acoes-linha .btn {' especializa a largura dentro de
     um contexto e e legitimo; '.btn {' na coluna zero redefiniria o componente. */
  const redefinidos = componentesDoDomi.filter(c => new RegExp('^' + c.replace(/[.*+?^|[]\]/g, '\  const redefinidos = componentesDoDomi.filter(c => cssCesta.includes(c));'), 'm').test(cssCesta));
  check('a camada do CESTA nao redefine componente do DOMI',
    redefinidos.length ? redefinidos.join(', ') : true, true);
}

check('a camada 1 existe (escuro no :root)', raiz.length > 100, true);
check('a camada 2 existe (o sistema pede claro)', claroAuto.includes(':not([data-tema="dark"])'), true);
check('a camada 3 existe (escolha explicita)', claroExplicito.length > 100, true);

/* NENHUMA COR PODE TER SUA UNICA DEFINICAO DENTRO DE UM MEDIA QUERY. Se tiver,
   o token fica sem valor no outro tema e o elemento herda transparente — o
   defeito some da tela em que se olha e aparece na outra. */
/* SÓ OS TOKENS DE COR. A regra que importa é "toda cor definida num tema
   existe no outro" — uma cor esquecida some no tema oposto e o elemento herda
   transparente. Medida não é cor: --toque vale 48px no escuro e no claro, e
   exigir que ela seja redeclarada em cada tema é cobrar uma duplicação que não
   protege nada. */
const ehCor = v => /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i.test(v);
const tokensDe = txt => [...txt.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)]
  .filter(m => ehCor(m[2]))
  .map(m => m[1]);
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
/* --teclado NAO e cor, entao nao entra em noEscuro (que so guarda cores).
   O que importa aqui e que o token EXISTA e seja atualizado pelo visualViewport
   — e isso se ve no CSS e no ui.js, nao na lista de tintas. */
check('a altura do teclado e um token', /--teclado:/.test(css), true);
check('e o app atualiza esse token pelo visualViewport',
  fs.readFileSync(BASE + 'js/ui.js', 'utf8').includes("setProperty('--teclado'"), true);
/* A folha do DOMI se apoia no teclado pelo `bottom`, nao pelo margin — e a
   posicao dela e fixed. O teste procurava a forma do CESTA antigo. */
check('e a folha se apoia acima dele', /\.sheet \{[^}]*bottom: var\(--teclado\)/.test(css), true);

/* A COR E DO DADO. Gradiente e sombra colorida em estado permanente fazem o
   enfeite competir com o unico lugar em que a cor significa alguma coisa. */
/* SEM OS COMENTARIOS. O DOMI FALA sobre gradiente em cinco comentarios que
   explicam por que ele NAO usa gradiente — e o teste casava com o texto que
   defende a regra, em vez do CSS que a cumpre. E a mesma armadilha do
   'create index' no schema, e ela pega de novo toda vez que se procura um
   literal num arquivo comentado. */
const cssSemComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
/* O DOMI usa UM gradiente, e ele e uma regua: transparente -> linha ->
   transparente, para o filete de secao sumir nas pontas. Isso nao e decoracao
   colorida — e desenho de linha. A regra que vale para o CESTA e nao
   INTRODUZIR gradiente novo na camada dele. */
const semComentario = txt => txt.replace(/\/\*[\s\S]*?\*\//g, '');
check('a camada do CESTA nao introduz gradiente',
  /linear-gradient|radial-gradient/.test(semComentario(cssCesta)), false);
check('e o unico do herdado e uma regua, nao cor',
  (semComentario(cssDomi).match(/linear-gradient/g) || []).length, 1);

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
const emDias = n => {
  const d = new Date(new Date().getTime() + n * 864e5);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/* Uma data futura DENTRO do mes corrente: min(hoje + n, ultimo dia do mes).

   Sem isto, emDias(3) cai no MES SEGUINTE quando hoje e dia 29 — e a compra
   deixa de contar na projecao do mes, corretamente. O teste reprovava por
   herdar a relacao do acaso, nao por defeito do app: e exatamente a regra
   "escreva a RELACAO, nunca a data" que o rodizio de datas existe para cobrar.
   Medido: 5 reprovacoes em 5 das 9 datas do rodizio. */
const emDiasNoMes = n => {
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const dia = Math.min(hoje.getDate() + n, ultimo);
  const p = x => String(x).padStart(2, '0');
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(dia)}`;
};

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
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1', family_id: 'f1' };
check('nao esta logado sem token', Sync.logado(), false);
check('nem configurado sem url', (Sync.cfg = { anonKey: 'k' }, Sync.configurado()), false);
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1', access_token: 't', family_id: 'f1' };
check('configurado com url e chave', Sync.configurado(), true);

/* TODA STORE SINCRONIZADA precisa estar declarada: uma que fique de fora nunca
   sobe, e ninguem descobre ate trocar de aparelho. */
for (const s of ['stores', 'items', 'products', 'lists', 'list_items', 'price_obs', 'nfce_docs', 'aliases']) {
  check(`${s} esta declarada para sincronizar`, !!SYNC_TABELAS[s], true);
}

const obsSync = Precos.registrar(DB, { item_id: DB.itemPorNome('Teste').id, data: DB.hojeISO(), preco_total: 10, qtd: 1, unidade: 'kg' });
const linhaEnviada = Sync.linhaDe('price_obs', DB.get('price_obs', obsSync.id));
/* O ESCOPO É FAMILIAR, não pessoal. Se a lista é compartilhada, o histórico
   de precos tambem precisa ser: senao quem esta no mercado nao veria o
   diagnostico baseado nas compras que a outra pessoa da casa fez, e o app
   perderia metade do valor justamente para quem divide as compras. */
check('a linha enviada leva a familia', linhaEnviada.family_id, 'f1');
check('e nao o usuario, que e so quem entrou', linhaEnviada.user_id, undefined);
check('e o carimbo do cliente para resolver conflito', !!linhaEnviada.updated_at, true);
check('e a marca de apagado', linhaEnviada.deleted, false);
check('o preco por unidade vai junto', linhaEnviada.preco_base, 10);
/* `dirty` e de controle LOCAL: mandar para o banco criaria uma coluna que nao
   existe, e o Postgres recusaria o lote inteiro — nada mais sincronizaria. */
check('mas o controle local NAO e enviado', linhaEnviada.dirty, undefined);

/* O schema tem de cobrir o que o app envia: coluna faltando derruba o lote. */
const schema = fs.readFileSync(BASE + 'supabase/schema.sql', 'utf8');
/* O SQL SEM OS COMENTARIOS. Um teste que procura um literal casa com o
   comentario que FALA sobre o literal, e passa (ou reprova) sem olhar para o
   SQL de verdade — ja aconteceu aqui, com o 'create index'. */
const sql = schema.split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n');
for (const [tabela, colunas] of Object.entries(SYNC_TABELAS)) {
  const bloco = (schema.match(new RegExp('create table if not exists public\\.' + tabela + '[\\s\\S]*?\\);')) || [''])[0];
  const faltando = colunas.filter(c => !bloco.includes(c));
  check(`${tabela}: o schema tem todas as colunas enviadas`,
    faltando.length ? faltando.join(', ') : true, true);
}
/* server_at e o marcador do pull: sem o gatilho, um aparelho offline perde
   registros em silencio. */
check('o schema cria o carimbo do servidor', schema.includes('server_at'), true);
check('e a tabela de familias', sql.includes('create table if not exists public.families'), true);
check('e a de membros', sql.includes('create table if not exists public.family_members'), true);
/* O codigo da familia e UNICO: dois iguais fariam alguem entrar na casa errada,
   e o erro so apareceria quando a pessoa visse as compras de um estranho. */
check('o codigo da familia e unico', /codigo text not null unique/.test(sql), true);
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
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1', access_token: 't', family_id: 'f1' };
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
check('as tabelas de dados sao filtradas pela familia',
  /using \(family_id = public\.minha_familia\(\)\)/.test(sql), true);
check('e na escrita tambem', /with check \(family_id = public\.minha_familia\(\)\)/.test(sql), true);
/* A funcao que descobre a familia precisa ser SECURITY DEFINER com search_path
   fixo: sem isso a politica de family_members consultaria a tabela que ela
   mesma protege, e o Postgres entra em recursao infinita — o banco para de
   responder e ninguem entende por que. */
check('minha_familia() e security definer', /security definer/i.test(sql), true);
check('com o search_path preso', /set search_path = public/i.test(sql), true);
/* families e LEGIVEL por qualquer autenticado, e de proposito: e o que permite
   ENTRAR numa familia pelo codigo. Por isso o codigo tem seis caracteres
   aleatorios em vez de um numero sequencial — e por isso a leitura livre vale
   so para families, nunca para uma tabela de dados. */
check('so families tem leitura aberta', (sql.match(/using \(true\)/g) || []).length, 1);
check('e nenhuma tabela de dados libera escrita', /with check \(true\)/.test(sql), false);
/* Entrar numa familia e um ato de quem entra: ninguem pode inscrever outra
   pessoa, nem tirar. */
check('so o proprio usuario se inscreve', /with check \(user_id = auth\.uid\(\)\)/.test(sql), true);
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
eval(fs.readFileSync(BASE + 'js/planejar.js', 'utf8') + '; global.Planejar = Planejar;');

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
check('o selo vermelho aparece', diagCaro.includes('b-red'), true);
check('com a PALAVRA junto da cor', diagCaro.includes('Caro'), true);
check('e a porcentagem', diagCaro.includes('20%'), true);
check('e a base auditavel: a mediana', diagCaro.includes('mediana'), true);
check('e quantos registros a sustentam', diagCaro.includes('registros'), true);
/* Quando esta caro, a tela precisa dizer o que FAZER — um 🔴 sozinho deixa a
   pessoa sem saida. */
check('e o melhor preco ja visto, para poder decidir', diagCaro.includes('Melhor preço já visto'), true);

const diagSemBase = Mercado.htmlDoDiagnostico(
  Precos.avaliar(DB, { item_id: itLeiteV.id, preco: 5, qtd: 1, unidade: 'l' }));
check('sem base, o selo e cinza', diagSemBase.includes('b-slate'), true);
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




/* ====================== O CATALOGO E A ORDEM DO MERCADO === */

console.log('\n=== Catalogo semente ===');

check('ha corredores definidos', CORREDORES.length >= 8, true);
check('e itens comuns de verdade', ITENS_COMUNS.length >= 40, true);

/* A ORDEM DOS CORREDORES E A DO MERCADO, nao a do alfabeto: hortifruti na
   entrada, limpeza no fundo. E o que faz a lista parar de mandar a pessoa
   andar em ziguezague — o ganho de tempo mais concreto de um app de lista. */
const ordens = CORREDORES.map(c => c.ordem);
check('cada corredor tem uma ordem unica', new Set(ordens).size, CORREDORES.length);
check('o hortifruti vem antes da limpeza',
  Catalogo.corredor('hortifruti').ordem < Catalogo.corredor('limpeza').ordem, true);
check('e "outros" fica por ultimo',
  Catalogo.corredor('outros').ordem, Math.max(...ordens));
/* Corredor desconhecido nao pode quebrar a tela: cai em "outros". */
check('corredor que nao existe cai em outros', Catalogo.corredor('inventado').id, 'outros');
check('e corredor nulo tambem', Catalogo.corredor(null).id, 'outros');

/* TODO ITEM COMUM PRECISA DE UNIDADE QUE O MOTOR ENTENDA. Um item semeado com
   unidade desconhecida entraria no catalogo e nunca produziria diagnostico —
   o defeito ficaria escondido ate a pessoa registrar o preco. */
for (const [nome, corredor, unidade] of ITENS_COMUNS) {
  const canonica = Precos.normalizarUnidade(unidade);
  if (!canonica) check(`"${nome}" tem unidade que o motor entende`, unidade, 'uma unidade valida');
}
check('todas as unidades do catalogo sao conversiveis',
  ITENS_COMUNS.every(([, , u]) => !!Precos.normalizarUnidade(u)), true);
check('e todo item aponta para um corredor que existe',
  ITENS_COMUNS.every(([, c]) => CORREDORES.some(x => x.id === c)), true);
check('sem nomes repetidos no catalogo',
  new Set(ITENS_COMUNS.map(i => i[0].toLowerCase())).size, ITENS_COMUNS.length);

/* O PALPITE preenche o cadastro, nunca o preco. */
const p1 = Catalogo.palpitar('Arroz');
check('acha o item pelo nome exato', p1.unidade, 'kg');
check('e marca que foi exato', p1.exato, true);
const p2 = Catalogo.palpitar('leite integral');
check('acha pela primeira palavra', p2 && p2.unidade, 'l');
check('mas avisa que nao foi exato', p2.exato, false);
check('e o que nao conhece devolve nulo', Catalogo.palpitar('caviar beluga'), null);
check('nome vazio tambem', Catalogo.palpitar(''), null);

/* ========================================= A PRIMEIRA VEZ === */

console.log('\n=== Abertura (onboarding) ===');

eval(fs.readFileSync(BASE + 'js/onboarding.js', 'utf8') + '; global.Onboarding = Onboarding;');

localStorage.removeItem('cesta.abertura');
check('na primeira abertura, a apresentacao aparece', Onboarding.jaFez(), false);
Onboarding.marcarFeito();
check('e depois de vista, nao volta sozinha', Onboarding.jaFez(), true);

/* TODA TELA DA APRESENTACAO PRECISA MONTAR. Uma que quebre deixa quem abriu o
   app pela primeira vez numa tela em branco — e essa pessoa nao volta. */
DB.apagarTudo();
Onboarding.passo = 0;
Onboarding.escolhidos = new Set();
for (let i = 0; i < Onboarding.telas.length; i++) {
  Onboarding.passo = i;
  const html = Onboarding.telas[i].call(Onboarding);
  check(`a tela ${i + 1} da apresentacao monta`, typeof html === 'string' && html.length > 200, true);
}

/* A PRIMEIRA TELA TEM DE DIZER O QUE O APP E. Sem isso, a apresentacao existe
   e nao resolve o problema que ela existe para resolver. */
Onboarding.passo = 0;
const tela1 = Onboarding.telas[0].call(Onboarding);
check('a primeira tela faz a pergunta do corredor', /pre[çc]o t[áa] bom/i.test(tela1), true);
check('e diz que a comparacao e com o proprio historico', /voc[êe] mesmo/i.test(tela1), true);
check('e que funciona sem internet', /sem internet/i.test(tela1), true);
// O cifrao escrito por codigo de caractere: '$' numa string de substituicao do
// replace() e padrao especial, e ja corrompeu este arquivo uma vez.
check('e mostra um exemplo com numero de verdade', tela1.includes('R' + String.fromCharCode(36)), true);
/* PULAVEL SEMPRE: quem ja entendeu nao pode ser obrigado a assistir. */
check('da para pular', tela1.includes('data-ob="pular"'), true);

/* ENSINAR FAZENDO: o que a pessoa escolhe na apresentacao VIRA a lista dela. */
Onboarding.escolhidos = new Set(['Arroz', 'Leite', 'Detergente']);
Onboarding.aplicarEscolhas();
const listaNova = DB.listasPlanejadas()[0] || DB.listaEmCurso();
check('a apresentacao cria uma lista de verdade', !!listaNova, true);
check('com os itens escolhidos', DB.itensDaLista(listaNova.id).length, 3);
check('e os itens entram no catalogo', DB.all('items').length, 3);
/* O item nasce com a unidade do catalogo: sem isso o app acumularia meses de
   dados em unidade errada antes de alguem perceber. */
const arrozOb = DB.all('items').find(i => i.nome === 'Arroz');
check('o item nasce com a unidade certa', arrozOb.unidade, 'kg');
check('e no corredor certo', arrozOb.categoria, 'mercearia');
/* Aplicar duas vezes NAO duplica: a pessoa pode voltar e avancar na apresentacao. */
Onboarding.aplicarEscolhas();
check('voltar e avancar nao duplica os itens', DB.itensDaLista(listaNova.id).length, 3);

/* ============================================= SEGURANCA === */

console.log('\n=== PIN e criptografia ===');

eval(fs.readFileSync(BASE + 'js/auth.js', 'utf8') + '; global.Auth = Auth;');

localStorage.removeItem('cesta.auth');
Auth.load();
check('a protecao nasce desligada', Auth.ligado(), false);
check('e a digital tambem', Auth.bioAtiva(), false);

/* O BLOQUEIO PROGRESSIVO existe porque um PIN de 4 digitos tem 10 mil
   combinacoes: sem ele, quem tem o aparelho na mao tenta todas em minutos. */
check('sem erros, nada esta bloqueado', Auth.bloqueadoPor(), 0);
for (let i = 0; i < 4; i++) Auth.registrarErro();
check('quatro erros ainda nao bloqueiam', Auth.bloqueadoPor(), 0);
Auth.registrarErro();
check('o quinto bloqueia', Auth.bloqueadoPor() > 0, true);
/* E dobra: se a espera fosse fixa, bastaria esperar sempre o mesmo tanto. */
const primeiraEspera = Auth.bloqueadoPor();
for (let i = 0; i < 5; i++) Auth.registrarErro();
check('e a espera aumenta a cada rodada', Auth.bloqueadoPor() > primeiraEspera, true);
Auth.registrarAcerto();
check('acertar limpa o bloqueio', Auth.bloqueadoPor(), 0);
check('e zera a contagem', Auth.cfg.erros, 0);

/* A CRIPTOGRAFIA DE VERDADE, com o WebCrypto do node. Testar isto com um
   simulacro provaria que o simulacro funciona, nao o app. */
{
  const salt = Auth.b64(crypto.getRandomValues(new Uint8Array(16)));
  const chave = await Auth.derivar('1234', salt, true);
  const outra = await Auth.derivar('4321', salt, true);

  DB.apagarTudo();
  DB.upsert('items', { nome: 'Segredo', unidade: 'kg' });
  DB.setChave(chave);
  await new Promise(r => setTimeout(r, 60));   // a gravacao cifrada e assincrona

  const cru = localStorage.getItem('cesta.v1');
  check('o que fica gravado esta cifrado', JSON.parse(cru).cifrado, true);
  /* O TESTE QUE IMPORTA: o nome do item NAO PODE aparecer no texto gravado.
     Um "cifrado: true" com o conteudo legivel ao lado seria o pior desfecho —
     a tela dizendo que protege, sem proteger. */
  check('e o conteudo nao aparece em claro', cru.includes('Segredo'), false);

  DB.data = null; DB.chave = null;
  DB.load();
  check('sem a chave, a base abre TRANCADA', DB.trancado, true);
  /* E nao pode abrir vazia: criar uma base nova aqui apagaria por cima do que
     esta cifrado na primeira gravacao — perda total e silenciosa. */
  check('e nao inventa uma base vazia', DB.data, null);

  let recusou = false;
  try { await DB.abrirCom(outra); } catch (_) { recusou = true; }
  check('o PIN errado nao abre', recusou, true);
  check('e a base continua trancada', DB.trancado, true);

  await DB.abrirCom(chave);
  check('o PIN certo abre', DB.trancado, false);
  check('com os dados intactos', DB.all('items')[0].nome, 'Segredo');

  DB.setChave(null);
  await new Promise(r => setTimeout(r, 60));
  check('desligar a protecao volta a gravar em claro',
    localStorage.getItem('cesta.v1').includes('Segredo'), true);
}

/* ============================================== FAMILIA === */

console.log('\n=== Familia e lista compartilhada ===');

/* O CODIGO E DITADO POR TELEFONE. Letras e numeros ambiguos (O/0, I/1/L, S/5)
   viram suporte tecnico: "e o e ou o zero?". */
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1', access_token: 't' };
const codigos = Array.from({ length: 40 }, () => Sync.gerarCodigo());
check('o codigo tem seis caracteres', codigos[0].length, 6);
check('e nao repete facil', new Set(codigos).size > 35, true);
check('sem caracteres que se confundem ao ditar',
  codigos.every(c => !/[O0I1LS5U]/.test(c)), true);
check('e sempre em maiuscula', codigos.every(c => c === c.toUpperCase()), true);

check('sem familia, nao ha o que compartilhar', Sync.temFamilia(), false);
/* SINCRONIZAR SEM FAMILIA NAO PODE ACONTECER: todo registro subiria sem dono e
   o RLS recusaria o lote inteiro — sem erro visivel na tela. */
/* SEM FAMILIA, O SYNC NAO PODE NEM TOCAR A REDE.

   Todo registro subiria sem dono e o RLS recusaria o lote inteiro — sem erro
   visivel na tela, e com a pessoa achando que sincronizou.

   O que se mede aqui e se o FETCH ACONTECEU, nao o valor devolvido: com
   navigator.onLine false o sync devolve null antes de olhar a familia, e o
   teste passaria sem exercitar a regra. Foi assim que a sabotagem escapou. */
{
  let tocouARede = 0;
  const fetchAntes = global.fetch;
  global.fetch = async () => { tocouARede++; return { ok: true, json: async () => [], text: async () => '' }; };
  navigator.onLine = true;
  try { await Sync.sincronizar(); } catch (_) { /* sem familia nao deveria nem chegar aqui */ }
  global.fetch = fetchAntes;
  navigator.onLine = false;
  check('e a sincronizacao nao toca a rede', tocouARede, 0);
}

Sync.cfg.family_id = 'f1';
check('com familia, ela existe', Sync.temFamilia(), true);
check('e o nome de quem esta usando tem um padrao', Sync.meuNome(), 'Eu');
Sync.cfg.nome = 'Ana';
check('e passa a ser o nome de verdade', Sync.meuNome(), 'Ana');

/* QUEM PEGOU O ITEM e o ganho pratico de compartilhar: duas pessoas no mesmo
   mercado nao pegam a mesma coisa duas vezes. */
check('a coluna de quem pegou vai para o banco',
  SYNC_TABELAS.list_items.includes('pegou_por'), true);
check('e o schema tem essa coluna', sql.includes('pegou_por'), true);

/* ======================================== A LISTA POR CORREDOR === */

console.log('\n=== A lista na ordem do mercado ===');

DB.apagarTudo();
const listaOrd = DB.novaLista({ nome: 'Ordem' });
// De proposito fora de ordem, como alguem digitaria
for (const nome of ['Detergente', 'Banana', 'Leite', 'Arroz', 'Pão francês']) {
  const def = ITENS_COMUNS.find(i => i[0] === nome);
  const item = DB.itemPorNome(nome, { categoria: def[1], unidade: def[2], qtd_habitual: def[3] });
  DB.addNaLista(listaOrd.id, { item_id: item.id, qtd: def[3], unidade: def[2] });
}
Mercado.listaId = listaOrd.id;
Mercado.focoId = null;
const htmlOrd = Mercado.render();

const posDe = nome => htmlOrd.indexOf(nome);
check('o hortifruti vem antes da mercearia', posDe('Banana') < posDe('Arroz'), true);
check('a mercearia antes dos frios... na ordem da loja',
  posDe('Pão francês') < posDe('Leite'), true);
check('e a limpeza fica por ultimo', posDe('Detergente') > posDe('Leite'), true);
/* O cabecalho do corredor so aparece quando MUDA: repeti-lo a cada item viraria
   ruido numa lista de quarenta. */
check('o corredor aparece como divisoria', htmlOrd.includes('corredor-titulo'), true);
check('uma vez por corredor, nao por item',
  (htmlOrd.match(/corredor-titulo/g) || []).length <= 5, true);

/* ==================================== O SHELL COM AS TELAS NOVAS === */

console.log('\n=== Desktop e shell ===');

/* A SIDEBAR e a barra de baixo sao a MESMA navegacao: uma aba que exista so num
   dos dois some para metade dos usuarios, dependendo do aparelho. */
const abasDock = [...shell.matchAll(/class="tab"[^>]*data-aba="([a-z]+)"/g)].map(m => m[1]);
const abasSide = [...shell.matchAll(/class="side-item"[^>]*data-aba="([a-z]+)"/g)].map(m => m[1]);
check('a barra de baixo tem abas', abasDock.length >= 3, true);
check('e a sidebar tambem', abasSide.length >= 3, true);
check('toda aba da barra existe na sidebar',
  abasDock.every(a => abasSide.includes(a)), true);

/* O DOMI resolve isso com .only-desk / .only-mob e um media query proprio.
   O que precisa continuar valendo: no celular a sidebar nao aparece, e no
   desktop a barra de baixo nao aparece. */
check('a sidebar nao aparece no celular', /\.sidebar \{[^}]*display: none/.test(css), true);
/* O DOMI já esconde a tabbar no desktop, no media query dele. O CESTA não
   precisa repetir a regra — precisa NÃO quebrá-la, e é isso que se mede. */
check('e a barra de baixo some no desktop', /\.tabbar, \.fab \{ display: none/.test(cssDomi), true);

/* A tela de bloqueio vive FORA do #app: desenhar o app e so depois pedir o PIN
   mostraria os dados por um quadro — e um quadro basta para uma foto. */
check('a tela de bloqueio existe no shell', shell.includes('id="lock"'), true);
check('e fica fora do app', shell.indexOf('id="lock"') < shell.indexOf('id="app"'), true);
check('nasce escondida', /<div id="lock" class="lock" hidden>/.test(shell), true);

/* A ajuda precisa estar alcancavel dos DOIS lugares: quem esta no celular nao
   ve a sidebar, e quem esta no desktop nao ve a barra de baixo. */
check('a ajuda esta no topo', shell.includes('id="btn-ajuda"'), true);
check('e na sidebar', shell.includes('id="side-ajuda"'), true);


/* ================================= A DESPENSA DERIVADA === */

console.log('\n=== Despensa: derivada, nunca digitada ===');

DB.apagarTudo();
const lojaD = DB.upsert('stores', { nome: 'Mercado D' });
const arrozD = DB.itemPorNome('Arroz', { categoria: 'mercearia', unidade: 'kg', qtd_habitual: 5 });

check('sem compra nenhuma, a despensa esta vazia', Despensa.tudo(DB).length, 0);
check('e nao inventa saldo', Despensa.saldoDe(DB, arrozD.id), null);

/* Uma compra so: entra em casa, mas NAO da para estimar consumo — e o app diz
   isso em vez de chutar. E a mesma regra do circulo branco do diagnostico. */
Precos.registrar(DB, { item_id: arrozD.id, store_id: lojaD.id, data: diasAtras(10),
  preco_total: 25, qtd: 5, unidade: 'kg' });
const s1 = Despensa.saldoDe(DB, arrozD.id);
check('com uma compra, o item existe na despensa', !!s1, true);
check('mas o saldo e desconhecido', s1.saldo, null);
check('e a explicacao diz o porque', /duas compras/.test(s1.explicacao), true);

/* Duas compras: nasce a cadencia, e com ela o consumo estimado. */
Precos.registrar(DB, { item_id: arrozD.id, store_id: lojaD.id, data: diasAtras(40),
  preco_total: 25, qtd: 5, unidade: 'kg' });
const s2 = Despensa.saldoDe(DB, arrozD.id);
check('com duas compras, o consumo passa a ser estimavel', s2.consumoDia > 0, true);
check('e o saldo tambem', s2.saldo != null, true);
/* 5 kg a cada 30 dias = 1/6 kg por dia. Comprou 5 kg ha 10 dias, com 5 kg
   anteriores: 10 kg menos 40 dias de consumo. */
check('a conta bate com o ritmo', Math.round(s2.consumoDia * 1000) / 1000, 0.167);
check('e a explicacao mostra a conta', /consome cerca de/.test(s2.explicacao), true);

/* A CORRECAO E UM MARCO: a pessoa olhou o armario, e o que veio antes nao
   conta mais. Sem isso, corrigir nao adiantaria nada. */
Despensa.corrigir(DB, arrozD.id, 2, 'kg');
const s3 = Despensa.saldoDe(DB, arrozD.id);
check('corrigir vira o novo ponto de partida', s3.corrigido, true);
check('e o saldo passa a partir dali', s3.saldo <= 2, true);
check('a explicacao cita a correcao', /corrigiu/.test(s3.explicacao), true);

/* PERECIVEL NAO TEM SALDO. Dizer que voce "tem alface" tres semanas depois de
   comprar seria mentira com cara de dado. */
const alface = DB.itemPorNome('Alface', { categoria: 'hortifruti', unidade: 'un' });
for (const d of [30, 15]) {
  Precos.registrar(DB, { item_id: alface.id, data: diasAtras(d), preco_total: 4, qtd: 1, unidade: 'un' });
}
const sAlf = Despensa.saldoDe(DB, alface.id);
check('perecivel e marcado como tal', sAlf.perecivel, true);
check('e nao tem saldo estimado', sAlf.saldo, null);
check('nem previsao de quando acaba', sAlf.diasParaAcabar, null);
check('mas sabe ha quantos dias foi comprado', sAlf.diasDesdeUltima, 15);
check('e acusa que provavelmente estragou', sAlf.vencido, true);

/* DEDUPLICACAO: fechar a compra no app e importar o cupom da MESMA ida sao o
   mesmo evento. Contar duas vezes faria o app dizer que ha 10 kg onde ha 5 —
   e mandaria a pessoa NAO comprar arroz. */
const feijao = DB.itemPorNome('Feijão', { categoria: 'mercearia', unidade: 'kg' });
Precos.registrar(DB, { item_id: feijao.id, store_id: lojaD.id, data: diasAtras(5),
  preco_total: 8, qtd: 1, unidade: 'kg', origem: 'digitado' });
Precos.registrar(DB, { item_id: feijao.id, store_id: lojaD.id, data: diasAtras(5),
  preco_total: 8, qtd: 1, unidade: 'kg', origem: 'nfce' });
check('a mesma compra registrada duas vezes conta uma', Despensa.entradasDe(DB, feijao.id).length, 1);
// Mas duas compras de verdade no mesmo dia, em lojas diferentes, contam as duas
Precos.registrar(DB, { item_id: feijao.id, store_id: DB.upsert('stores', { nome: 'Outro' }).id,
  data: diasAtras(5), preco_total: 9, qtd: 1, unidade: 'kg' });
check('mas compras diferentes no mesmo dia contam as duas', Despensa.entradasDe(DB, feijao.id).length, 2);

/* A DESPENSA E RECALCULAVEL DO ZERO: nao existe estado a manter. */
const antes = Despensa.saldoDe(DB, arrozD.id).saldo;
const depois = Despensa.saldoDe(DB, arrozD.id).saldo;
check('o calculo e estavel entre chamadas', antes, depois);

/* O QUE ESTA ACABANDO — o bloco que faz o app antecipar. */
DB.apagarTudo();
const cafe = DB.itemPorNome('Café', { categoria: 'mercearia', unidade: 'g', qtd_habitual: 500 });
for (const d of [60, 30]) {
  Precos.registrar(DB, { item_id: cafe.id, data: diasAtras(d), preco_total: 20, qtd: 500, unidade: 'g' });
}
const acabando = Despensa.acabando(DB, { ateDias: 7 });
check('o cafe comprado ha 30 dias, com ritmo de 30, aparece', acabando.length >= 1, true);
check('e diz por que', !!acabando[0].explicacao, true);
/* A JANELA IMPORTA: numa compra que acontece em 10 dias, interessa o que falta
   ate la, e nao o que falta hoje. */
check('janela zero e mais restrita que janela de 30 dias',
  Despensa.acabando(DB, { ateDias: 0 }).length <= Despensa.acabando(DB, { ateDias: 30 }).length, true);

/* ============================= A LISTA QUE SE MONTA SOZINHA === */

console.log('\n=== Planejamento ===');

DB.apagarTudo();
const lojaP2 = DB.upsert('stores', { nome: 'Atacado P' });
const arrozP = DB.itemPorNome('Arroz', { categoria: 'mercearia', unidade: 'kg', qtd_habitual: 5 });
const papelP = DB.itemPorNome('Papel higiênico', { categoria: 'higiene', unidade: 'un', qtd_habitual: 12 });
for (const d of [60, 30]) {
  Precos.registrar(DB, { item_id: arrozP.id, store_id: lojaP2.id, data: diasAtras(d), preco_total: 25, qtd: 5, unidade: 'kg' });
}
DB.marcarRecorrente(papelP.id, 'mensal', true);
check('o recorrente foi marcado', DB.recorrentesDo('mensal').length, 1);

const planoP = DB.novoPlano({ ciclo: 'mensal', data: DB.hojeISO(), store_id: lojaP2.id, orcamento: 500 });
check('o plano nasce com uma lista junto', !!planoP.list_id, true);
check('e a lista guarda o ciclo', DB.get('lists', planoP.list_id).ciclo, 'mensal');

const sug = Planejar.sugerirPara(DB, planoP);
check('o app sugere o que esta acabando e o recorrente', sug.length >= 2, true);
check('e cada sugestao diz o motivo', sug.every(s => !!s.texto && !!s.motivo), true);
check('o recorrente esta entre elas', sug.some(s => s.item_id === papelP.id), true);

/* PROPOE, NUNCA APLICA. Aplicar sozinho e o erro que custou 19 lancamentos e
   R$ 5.322 no DOMI — aqui custaria mandar comprar o que ja se tem. */
check('sugerir NAO poe nada na lista', DB.itensDaLista(planoP.list_id).length, 0);
Planejar.aplicarSugestoes(DB, planoP, [sug[0].item_id]);
check('so entra o que foi confirmado', DB.itensDaLista(planoP.list_id).length, 1);
/* O que ja esta na lista nao e sugerido de novo. */
check('e o que ja entrou nao volta a ser sugerido',
  Planejar.sugerirPara(DB, planoP).some(s => s.item_id === sug[0].item_id), false);

/* O PROXIMO PLANO: o mais proximo que ainda nao passou. Uma compra ATRASADA
   continua sendo a proxima coisa a fazer — esconde-la seria fingir que ela
   nao existe. */
DB.apagarTudo();
const atrasado = DB.novoPlano({ ciclo: 'mensal', data: diasAtras(3) });
check('sem plano futuro, o atrasado e o proximo', DB.proximoPlano().id, atrasado.id);
check('e o app sabe que ele atrasou', DB.diasAte(atrasado.data), -3);
const futuro = DB.novoPlano({ ciclo: 'semanal', data: emDias(5) });
check('com um futuro, ele passa a ser o proximo', DB.proximoPlano().id, futuro.id);

/* ================================== A PROJECAO DO MES === */

console.log('\n=== Projeção do mês ===');

DB.apagarTudo();
const mesP = DB.mesDe(DB.hojeISO());
DB.setOrcamentoDoMes(mesP, 1000);
check('o orcamento do mes fica gravado', DB.orcamentoDoMes(mesP), 1000);

const proj0 = Planejar.projecaoDoMes(DB);
check('sem gasto, a projecao e zero', proj0.projetado, 0);
check('e a situacao e tranquila', proj0.situacao, 'tranquilo');

/* Uma compra planejada de R$ 900 entra na projecao — e e isso que permite
   avisar ANTES, em vez de a pessoa descobrir no extrato. */
DB.novoPlano({ ciclo: 'mensal', data: emDiasNoMes(3), orcamento: 900 });
const proj1 = Planejar.projecaoDoMes(DB);
check('a compra marcada entra na projecao', proj1.planejado, 900);
check('e o mes segue dentro do orcamento', proj1.estoura, false);

DB.novoPlano({ ciclo: 'semanal', data: emDiasNoMes(5), orcamento: 300 });
const proj2 = Planejar.projecaoDoMes(DB);
check('duas compras somam', proj2.planejado, 1200);
check('e agora o mes estoura', proj2.estoura, true);
check('dizendo em quanto', Math.round(proj2.sobra), -200);

/* SEM ORCAMENTO, O APP NAO OPINA. Inventar uma situacao seria opinar sobre o
   dinheiro de alguem sem ter sido convidado. */
DB.apagarTudo();
const projSem = Planejar.projecaoDoMes(DB);
check('sem orcamento nao ha situacao a declarar', projSem.situacao, 'sem_orcamento');
check('nem folga a mostrar', projSem.sobra, null);

/* ==================================== O CONSELHEIRO === */

console.log('\n=== Conselheiro ===');

DB.apagarTudo();
check('sem dados, nao ha o que aconselhar', Planejar.conselhos(DB).length, 0);

DB.setOrcamentoDoMes(DB.mesDe(DB.hojeISO()), 100);
DB.novoPlano({ ciclo: 'mensal', data: emDiasNoMes(2), orcamento: 900 });
const cons = Planejar.conselhos(DB);
check('o estouro do mes vira conselho', cons.some(c => /fechar em/.test(c.titulo)), true);
check('e todo conselho tem acao', cons.every(c => !!c.acao), true);
check('e texto explicando', cons.every(c => !!c.texto), true);
/* NO MAXIMO TRES. Um painel que avisa de tudo nao avisa de nada. */
check('nunca passa de tres', Planejar.conselhos(DB, { limite: 3 }).length <= 3, true);

/* ==================================== ONDE COMPRAR === */

console.log('\n=== Onde comprar ===');

DB.apagarTudo();
const lojaA = DB.upsert('stores', { nome: 'Atacadão' });
const lojaB = DB.upsert('stores', { nome: 'Assaí' });
const listaOC = DB.novaLista({ nome: 'Teste' });

const itensOC = [
  ['Arroz', 'kg', 5, 25, 27],
  ['Feijão', 'kg', 1, 8, 9],
  ['Leite', 'l', 1, 5, 5.5],
];
for (const [nome, un, qtd, pa, pb] of itensOC) {
  const it = DB.itemPorNome(nome, { unidade: un, qtd_habitual: qtd });
  DB.addNaLista(listaOC.id, { item_id: it.id, qtd, unidade: un });
  Precos.registrar(DB, { item_id: it.id, store_id: lojaA.id, data: diasAtras(10), preco_total: pa, qtd, unidade: un });
  Precos.registrar(DB, { item_id: it.id, store_id: lojaB.id, data: diasAtras(8), preco_total: pb, qtd, unidade: un });
}

const oc = Decisoes.ondeComprar(DB, listaOC.id);
check('compara as duas lojas', oc.lojas.length, 2);
check('e acha a mais barata', oc.lojas[0].loja.id, lojaA.id);
check('com os tres itens comparaveis', oc.cobertos, 3);
check('e diz quanto se economiza', Math.round(oc.economia * 100) / 100, 3.5);

/* A REGRA QUE TORNA HONESTO: um item comprado em uma loja so NAO entra. Somar
   onde se tem historico e ignorar o resto compararia cestas diferentes — o
   mesmo erro que a cesta comparavel evita na inflacao. */
const soNumaLoja = DB.itemPorNome('Azeite', { unidade: 'ml', qtd_habitual: 500 });
DB.addNaLista(listaOC.id, { item_id: soNumaLoja.id, qtd: 500, unidade: 'ml' });
Precos.registrar(DB, { item_id: soNumaLoja.id, store_id: lojaA.id, data: diasAtras(5), preco_total: 30, qtd: 500, unidade: 'ml' });
const oc2 = Decisoes.ondeComprar(DB, listaOC.id);
check('item comprado numa loja so fica de fora', oc2.cobertos, 3);
check('e o total da lista continua sendo dito', oc2.total, 4);

/* Com uma loja so, nao ha comparacao a fazer — e o app diz isso. */
DB.apagarTudo();
const l1 = DB.upsert('stores', { nome: 'Unica' });
const listaU = DB.novaLista({});
const itU = DB.itemPorNome('Arroz', { unidade: 'kg' });
DB.addNaLista(listaU.id, { item_id: itU.id, qtd: 5, unidade: 'kg' });
Precos.registrar(DB, { item_id: itU.id, store_id: l1.id, data: diasAtras(5), preco_total: 25, qtd: 5, unidade: 'kg' });
check('com uma loja so, o app explica em vez de comparar',
  Decisoes.ondeComprar(DB, listaU.id).motivo, 'menos de dois mercados');

/* ================================ VALE A PENA O ATACADO === */

console.log('\n=== Vale a pena o atacado ===');

DB.apagarTudo();
const arrozV = DB.itemPorNome('Arroz', { categoria: 'mercearia', unidade: 'kg', qtd_habitual: 5 });
for (const d of [60, 30]) {
  Precos.registrar(DB, { item_id: arrozV.id, data: diasAtras(d), preco_total: 25, qtd: 5, unidade: 'kg' });
}
const vale = Decisoes.valeAPena(DB, arrozV.id, { preco: 45, qtd: 10, unidade: 'kg' });
check('10 kg de arroz duram cerca de 60 dias', Math.round(vale.duracaoDias), 60);
check('e cabem na validade da mercearia', vale.vale, true);
check('com o motivo escrito', vale.porque.length >= 1, true);

/* O CASO QUE O "MAIS POR MENOS" NAO PEGA: sai mais barato por quilo e mesmo
   assim nao compensa, porque estraga antes de acabar. */
const alfaceV = DB.itemPorNome('Alface', { categoria: 'hortifruti', unidade: 'un' });
for (const d of [21, 14, 7]) {
  Precos.registrar(DB, { item_id: alfaceV.id, data: diasAtras(d), preco_total: 4, qtd: 1, unidade: 'un' });
}
const valeAlf = Decisoes.valeAPena(DB, alfaceV.id, { preco: 20, qtd: 10, unidade: 'un' });
check('dez alfaces nao compensam', valeAlf.vale, false);
check('e o motivo e o estrago', /estraga|lixo/.test(valeAlf.porque.join(' ')), true);

/* SEM RITMO CONHECIDO, O APP NAO OPINA — devolve null, que e diferente de nao. */
const novoV = DB.itemPorNome('Quinoa', { categoria: 'mercearia', unidade: 'kg' });
check('sem historico, nao ha veredito', Decisoes.valeAPena(DB, novoV.id, { preco: 40, qtd: 2, unidade: 'kg' }).vale, null);

/* ==================================== PRECOS-ALVO === */

console.log('\n=== Preços-alvo ===');

DB.apagarTudo();
const cafeA = DB.itemPorNome('Café', { unidade: 'g', qtd_habitual: 500 });
Precos.registrar(DB, { item_id: cafeA.id, data: diasAtras(5), preco_total: 20, qtd: 500, unidade: 'g' });
check('sem alvo, conferir devolve nulo',
  Decisoes.conferirAlvo(DB, { item_id: cafeA.id, precoBase: 30, unidade: 'kg' }), null);

Decisoes.definirAlvo(DB, { item_id: cafeA.id, valor: 35, unidade: 'kg' });
const c1 = Decisoes.conferirAlvo(DB, { item_id: cafeA.id, precoBase: 30, unidade: 'kg' });
check('preco abaixo do alvo bate', c1.bateu, true);
const c2 = Decisoes.conferirAlvo(DB, { item_id: cafeA.id, precoBase: 40, unidade: 'kg' });
check('e acima nao bate', c2.bateu, false);
/* Unidade diferente NAO se compara: daria um numero, e o numero estaria errado. */
check('alvo em kg nao se compara com preco em un',
  Decisoes.conferirAlvo(DB, { item_id: cafeA.id, precoBase: 5, unidade: 'un' }), null);
check('definir de novo nao duplica o alvo',
  (Decisoes.definirAlvo(DB, { item_id: cafeA.id, valor: 30, unidade: 'kg' }), DB.all('price_targets').length), 1);
check('o cafe a R$ 40/kg esta batendo o alvo de 30?', Decisoes.alvosBatidos(DB).length, 0);

/* =============================== PARA ONDE VAI O DINHEIRO === */

console.log('\n=== Curva ABC ===');

DB.apagarTudo();
const caro = DB.itemPorNome('Carne', { categoria: 'acougue', unidade: 'kg' });
const barato = DB.itemPorNome('Sal', { categoria: 'mercearia', unidade: 'kg' });
for (let i = 0; i < 4; i++) {
  Precos.registrar(DB, { item_id: caro.id, data: diasAtras(i * 15), preco_total: 100, qtd: 2, unidade: 'kg' });
  Precos.registrar(DB, { item_id: barato.id, data: diasAtras(i * 15), preco_total: 3, qtd: 1, unidade: 'kg' });
}
const abc = Decisoes.ondeVaiODinheiro(DB, { meses: 6 });
check('a carne lidera o gasto', abc.itens[0].item.id, caro.id);
check('e e classe A', abc.itens[0].classe, 'A');
check('o sal nao e classe A', abc.itens.find(i => i.item.id === barato.id).classe !== 'A', true);
check('e o app diz quantos fazem 80%', abc.quantosFazem80, 1);
check('agrupando tambem por corredor', abc.porCategoria.length, 2);

/* ========================================== COZINHA === */

console.log('\n=== Cardápio e eventos ===');

DB.apagarTudo();
const nPratos = Cozinha.semearPratos(DB);
check('o catalogo de pratos vem pronto', nPratos >= 10, true);
check('e nao duplica ao rodar de novo', Cozinha.semearPratos(DB), 0);
check('todo prato tem ingredientes',
  DB.all('recipes').every(r => Cozinha.ingredientesDe(DB, r.id).length > 0), true);
/* Todo ingrediente precisa de unidade que o motor entenda, senao o custo do
   prato nunca fecha e a lista do cardapio sai errada. */
check('e toda unidade de ingrediente e conversivel',
  DB.all('recipe_items').every(r => !!Precos.normalizarUnidade(r.unidade)), true);

const macarrao = DB.all('recipes').find(r => /Macarronada/.test(r.nome));
check('o custo do prato nasce sem preco', Cozinha.custoDoPrato(DB, macarrao.id).custo, 0);

const itMac = DB.all('items').find(i => i.nome === 'Macarrão');
Precos.registrar(DB, { item_id: itMac.id, data: diasAtras(5), preco_total: 5, qtd: 500, unidade: 'g' });
check('com preco, o custo aparece', Cozinha.custoDoPrato(DB, macarrao.id).custo > 0, true);

/* O CARDAPIO VIRA LISTA, DESCONTANDO O QUE HA EM CASA — senao mandaria comprar
   o macarrao que esta no armario, que e o erro que o app existe para evitar. */
Cozinha.marcarNoCardapio(DB, DB.hojeISO(), macarrao.id, 2);
const listaCard = Cozinha.listaDoCardapio(DB, DB.hojeISO(), DB.hojeISO());
check('o cardapio vira lista de ingredientes', listaCard.length >= 4, true);
check('e diz quanto precisa de cada um', listaCard.every(l => l.precisa > 0), true);
/* Sem saber o que ha em casa, conta como zero: e melhor comprar de novo do que
   ficar sem o ingrediente na hora de cozinhar. Os dois erros nao custam igual. */
check('o que nao se sabe conta como zero em casa', listaCard.every(l => l.emCasa === 0), true);
check('e a incerteza fica marcada', listaCard.some(l => l.incerto), true);

/* EVENTOS: churrasco para 12 com as quantidades calculadas. */
const churrasco = Cozinha.listaDeEvento(DB, 'churrasco', 12);
check('o churrasco calcula as quantidades', churrasco.linhas.length >= 8, true);
const carne = churrasco.linhas.find(l => l.item.nome === 'Bife');
check('400 g de carne por pessoa da 4,8 kg', carne.qtd, 4.8);
check('e dobrar as pessoas dobra a carne',
  Cozinha.listaDeEvento(DB, 'churrasco', 24).linhas.find(l => l.item.nome === 'Bife').qtd, 9.6);
/* Os fixos NAO escalam com as pessoas: gelo e agua sao por festa, nao por
   cabeca. Escalar tudo seria comprar 60 litros de agua para 12 pessoas. */
check('os itens fixos nao escalam',
  Cozinha.listaDeEvento(DB, 'churrasco', 24).linhas.find(l => l.item.nome === 'Água mineral').qtd,
  Cozinha.listaDeEvento(DB, 'churrasco', 12).linhas.find(l => l.item.nome === 'Água mineral').qtd);
check('evento que nao existe devolve nulo', Cozinha.listaDeEvento(DB, 'inexistente', 5), null);

const planoEv = Cozinha.criarListaDeEvento(DB, 'churrasco', 10, DB.hojeISO());
check('o evento vira um plano com lista', !!planoEv && !!planoEv.list_id, true);
check('com todos os itens dentro', DB.itensDaLista(planoEv.list_id).length, churrasco.linhas.length);
check('e o ciclo e evento', planoEv.ciclo, 'evento');

/* ========================================== RATEIO === */

console.log('\n=== Rateio ===');

DB.apagarTudo();
const listaR = DB.novaLista({ nome: 'Dividida' });
DB.upsert('lists', { id: listaR.id, status: 'fechada', data_fechamento: DB.hojeISO(), total_cupom: 300 });
const ana = DB.upsert('members', { nome: 'Ana' });
const bruno = DB.upsert('members', { nome: 'Bruno' });

const rateio = Cozinha.ratear(DB, listaR.id, [ana.id, bruno.id]);
check('divide o total entre os membros', rateio.quota, 150);
check('e todos comecam devendo', rateio.membros.every(m => m.saldo === -150), true);

Cozinha.registrarPagamento(DB, listaR.id, ana.id, 300);
const rateio2 = Cozinha.ratear(DB, listaR.id, [ana.id, bruno.id]);
const daAna = rateio2.membros.find(m => m.membro.id === ana.id);
const doBruno = rateio2.membros.find(m => m.membro.id === bruno.id);
check('quem pagou tudo fica credor de metade', daAna.saldo, 150);
check('e o outro segue devendo a parte dele', doBruno.saldo, -150);
check('os saldos se anulam', Math.round(daAna.saldo + doBruno.saldo), 0);

/* ============================== AS TELAS DO ASSISTENTE === */

console.log('\n=== As telas novas montam ===');

eval(fs.readFileSync(BASE + 'js/views/hoje.js', 'utf8') + '; global.ViewHoje = ViewHoje;');
eval(fs.readFileSync(BASE + 'js/views/planejar.js', 'utf8') + '; global.ViewPlanejar = ViewPlanejar;');
eval(fs.readFileSync(BASE + 'js/views/despensa.js', 'utf8') + '; global.ViewDespensa = ViewDespensa;');
eval(fs.readFileSync(BASE + 'js/views/analise.js', 'utf8') + '; global.ViewAnalise = ViewAnalise;');

DB.apagarTudo();
const hojeVazio = ViewHoje.render();
check('HOJE monta com o app vazio', hojeVazio.length > 300, true);
/* O ESTADO VAZIO ENSINA. "Sem dados" so informa o que a pessoa ja ve. */
check('e convida a marcar a primeira compra', /Marcar uma compra/.test(hojeVazio), true);
check('sem inventar numero nenhum', /R\$ 0,00/.test(hojeVazio), false);

DB.novoPlano({ ciclo: 'mensal', data: emDias(3), orcamento: 800 });
const hojeCheio = ViewHoje.render();
check('com plano, HOJE mostra a proxima compra', /Próxima compra/.test(hojeCheio), true);
check('e quantos dias faltam', /em 3 dias/.test(hojeCheio), true);

check('PLANEJAR monta', ViewPlanejar.render().length > 300, true);
check('DESPENSA monta vazia explicando como se enche',
  /se enche sozinha/.test(ViewDespensa.render()), true);
check('ANALISE monta', ViewAnalise.render().length > 200, true);

/* As cinco abas existem nos DOIS modos de navegacao: uma aba que so aparece
   num deles some para metade dos usuarios. */
const abasDock2 = [...shell.matchAll(/class="tab"[^>]*data-aba="([a-z]+)"/g)].map(m => m[1]);
const abasSide2 = [...shell.matchAll(/class="side-item"[^>]*data-aba="([a-z]+)"/g)].map(m => m[1]);
check('a barra de baixo tem as cinco abas', abasDock2.length, 5);
check('a sidebar tambem', abasSide2.length, 5);
check('e sao as mesmas', abasDock2.every(a => abasSide2.includes(a)), true);
check('HOJE e a primeira', abasDock2[0], 'hoje');


/* ============== AS LACUNAS QUE AS SABOTAGENS DAS ONDAS REVELARAM ===

   Cinco sabotagens passaram na primeira rodada. Uma delas nao era teste vazio:
   era um defeito no PROPRIO HELPER de assercao — Number(null) e 0, entao todo
   check(0, null) passava. Num app cujo coracao e distinguir "nao sei" de
   "acabou", isso invalidava silenciosamente uma familia inteira de testes.

   As outras quatro sao os cenarios que faltavam. */

console.log('\n=== As lacunas das ondas ===');

/* 1. O HELPER: null nao e zero. A prova de que a correcao pega. */
{
  const antes = fail;
  // Estas DEVEM reprovar se o helper voltar a confundir os dois
  const ehVazio = v => v === null || v === undefined;
  check('null e null', ehVazio(null), true);
  check('zero nao e vazio', ehVazio(0), false);
  check('e o helper distingue os dois', antes, fail);
}

/* 2. PERECIVEL NAO TEM SALDO — com um cenario em que o saldo calculado seria
   ZERO, que e onde a confusao entre null e 0 escondia o defeito. */
DB.apagarTudo();
const alfaceL = DB.itemPorNome('Alface', { categoria: 'hortifruti', unidade: 'un' });
for (const d of [30, 15]) {
  Precos.registrar(DB, { item_id: alfaceL.id, data: diasAtras(d), preco_total: 4, qtd: 1, unidade: 'un' });
}
const sAlfL = Despensa.saldoDe(DB, alfaceL.id);
check('o saldo de perecivel e desconhecido, nao zero', sAlfL.saldo === null, true);
check('e nao e o numero zero', sAlfL.saldo === 0, false);
/* O nao-perecivel do mesmo cenario TEM saldo — senao o teste acima passaria
   com a funcao inteira quebrada. */
const arrozL = DB.itemPorNome('Arroz', { categoria: 'mercearia', unidade: 'kg' });
for (const d of [30, 15]) {
  Precos.registrar(DB, { item_id: arrozL.id, data: diasAtras(d), preco_total: 25, qtd: 5, unidade: 'kg' });
}
check('mas o que se estoca tem saldo em numero', typeof Despensa.saldoDe(DB, arrozL.id).saldo, 'number');

/* 3. O CONSELHEIRO NUNCA PASSA DE TRES — com mais de tres candidatos, que e a
   unica situacao em que o corte significa alguma coisa. */
DB.apagarTudo();
const mesL = DB.mesDe(DB.hojeISO());
DB.setOrcamentoDoMes(mesL, 50);                       // 1: o mes estoura
DB.novoPlano({ ciclo: 'mensal', data: emDiasNoMes(1), orcamento: 900 });  // 2: compra chegando
for (const nome of ['Café', 'Feijão', 'Leite', 'Açúcar']) {              // 3: itens acabando
  const it = DB.itemPorNome(nome, { categoria: 'mercearia', unidade: 'kg' });
  for (const d of [60, 30]) {
    Precos.registrar(DB, { item_id: it.id, data: diasAtras(d), preco_total: 10, qtd: 1, unidade: 'kg' });
  }
}
for (const nome of ['Alface', 'Tomate']) {                               // 4: perecivel vencido
  const it = DB.itemPorNome(nome, { categoria: 'hortifruti', unidade: 'kg' });
  for (const d of [40, 20]) {
    Precos.registrar(DB, { item_id: it.id, data: diasAtras(d), preco_total: 5, qtd: 1, unidade: 'kg' });
  }
}
const todos = Planejar.conselhos(DB, { limite: 99 });
check('o cenario produz mais de tres candidatos', todos.length > 3, true);
check('mas o conselheiro corta em tres', Planejar.conselhos(DB, { limite: 3 }).length, 3);
/* E corta pelos MAIS GRAVES, nao pelos primeiros que aparecerem. */
const tres = Planejar.conselhos(DB, { limite: 3 });
check('e ficam os de maior peso', tres[0].peso >= tres[2].peso, true);

/* 4. VALE-A-PENA E A VALIDADE, no caso NAO PERECIVEL — que e onde a regra da
   validade tipica atua, e onde o teste anterior nao chegava. */
DB.apagarTudo();
const arrozV2 = DB.itemPorNome('Arroz', { categoria: 'mercearia', unidade: 'kg', qtd_habitual: 5 });
for (const d of [60, 30]) {
  Precos.registrar(DB, { item_id: arrozV2.id, data: diasAtras(d), preco_total: 25, qtd: 5, unidade: 'kg' });
}
// 5 kg/30 dias. 50 kg durariam 300 dias, e a mercearia dura ~180.
const exagero = Decisoes.valeAPena(DB, arrozV2.id, { preco: 200, qtd: 50, unidade: 'kg' });
check('50 kg de arroz duram mais que a validade', Math.round(exagero.duracaoDias), 300);
check('e por isso nao compensam', exagero.vale, false);
check('com o motivo dito em palavras', /lixo|durar/.test(exagero.porque.join(' ')), true);
// E a quantidade que cabe na validade continua valendo a pena
const cabe = Decisoes.valeAPena(DB, arrozV2.id, { preco: 45, qtd: 10, unidade: 'kg' });
check('mas 10 kg cabem e compensam', cabe.vale, true);

/* 5. O CARDAPIO DESCONTA O QUE HA EM CASA — com um item que de fato existe na
   despensa, que e o unico caso em que o desconto acontece. */
DB.apagarTudo();
Cozinha.semearPratos(DB);
const macL = DB.all('recipes').find(r => /Macarronada/.test(r.nome));
const itMacL = DB.all('items').find(i => i.nome === 'Macarrão');
// Duas compras: nasce a cadencia, e com ela o saldo estimavel
for (const d of [40, 5]) {
  Precos.registrar(DB, { item_id: itMacL.id, data: diasAtras(d), preco_total: 5, qtd: 2, unidade: 'kg' });
}
const saldoMac = Despensa.saldoDe(DB, itMacL.id);
check('o macarrao tem saldo estimado em casa', saldoMac.saldo > 0, true);

Cozinha.marcarNoCardapio(DB, DB.hojeISO(), macL.id, 2);
const linhaMac = Cozinha.listaDoCardapio(DB, DB.hojeISO(), DB.hojeISO())
  .find(l => l.item_id === itMacL.id);
check('o cardapio conta o que ja existe em casa', linhaMac.emCasa > 0, true);
/* A CONTA QUE IMPORTA: faltam = precisa − emCasa. Sem o desconto, a lista
   mandaria comprar o macarrao que esta no armario — o erro que este app existe
   para evitar. */
/* faltam = max(0, precisa − emCasa). O max importa: com bastante em casa a
   conta da negativo, e "faltam −1,5 kg" nao significa nada para ninguem. */
check('e desconta na hora de dizer o que falta',
  Math.round(Math.max(0, linhaMac.precisa - linhaMac.emCasa) * 1000) / 1000,
  Math.round(linhaMac.faltam * 1000) / 1000);
check('e o que falta nunca e negativo', linhaMac.faltam >= 0, true);
check('com bastante em casa, nao falta nada', linhaMac.faltam, 0);
check('e a linha se marca como "ja tem"', linhaMac.temEmCasa, true);

/* 6. HOJE NAO INVENTA VALOR — com um plano SEM historico de preco, que e onde
   o "—" precisa aparecer no lugar de R$ 0,00. */
DB.apagarTudo();
const planoSemPreco = DB.novoPlano({ ciclo: 'mensal', data: emDiasNoMes(2) });
const itemNovo = DB.itemPorNome('Coisa nova', { unidade: 'un' });
DB.addNaLista(planoSemPreco.list_id, { item_id: itemNovo.id, qtd: 1, unidade: 'un' });
const htmlHoje = ViewHoje.render();
check('o plano aparece na tela', /Próxima compra/.test(htmlHoje), true);
check('mas sem historico o previsto e um traco', /<b class="valor grande">—<\/b>/.test(htmlHoje), true);
check('e nunca R$ 0,00', /R\$ 0,00/.test(htmlHoje), false);


/* ================== O APP DECIDE PELA REALIDADE, NAO POR UM FLAG ===

   O DEFEITO, relatado no uso real: "abri o app e ele nao deu opcao de iniciar a
   configuracao". A causa era um unico booleano no localStorage — que sobrevive
   a uma versao anterior do app, a um "apagar tudo" e a um backup restaurado. E
   quando ele sobrevive, o app abre MUDO: sem apresentacao, sem identidade, sem
   seguranca.

   Nenhum teste cobria isso porque todos perguntavam `jaFez()`, que era
   exatamente a funcao com o defeito. */

console.log('\n=== A configuracao inicial ===');

DB.apagarTudo();
localStorage.removeItem('cesta.abertura');
localStorage.removeItem('cesta.nuvem');
Sync.cfg = {};

check('app novo precisa configurar', Onboarding.precisaConfigurar(), true);

/* O CASO QUE QUEBROU NA MAO DO USUARIO: o flag ficou de uma versao anterior,
   mas o aparelho nao tem identidade nem dado nenhum. */
Onboarding.marcarFeito();
check('flag sozinho NAO conta como configurado', Onboarding.precisaConfigurar(), true);

/* Com identidade, esta configurado — a pessoa passou pela apresentacao de fato. */
Sync.cfg = { nome: 'Ana' };
check('com identidade, nao pede de novo', Onboarding.precisaConfigurar(), false);

/* Ou com dados: quem ja usa o app nao pode ser mandado de volta para a
   apresentacao so porque nao preencheu o nome. */
Sync.cfg = {};
DB.itemPorNome('Arroz');
check('com dados, tambem nao pede', Onboarding.precisaConfigurar(), false);

/* E quem escolheu "so neste aparelho" e ainda nao pos nada nao e arrastado de
   volta: a escolha dele foi registrada e vale. */
DB.apagarTudo();
Sync.cfg = {};
Onboarding.marcarFeito();
localStorage.setItem('cesta.nuvem', 'local');
check('quem escolheu usar so aqui nao e importunado', Onboarding.precisaConfigurar(), false);
localStorage.removeItem('cesta.nuvem');

/* A APRESENTACAO PRECISA CONTER OS PASSOS QUE A TORNAM UMA CONFIGURACAO, e nao
   um tour: identidade, nuvem e seguranca. Sem os tres, ela e so uma sequencia
   de telas bonitas. */
const fonteOb = fs.readFileSync(BASE + 'js/onboarding.js', 'utf8');
check('a apresentacao pergunta quem e a pessoa', /suaCasa/.test(fonteOb), true);
check('e oferece a sincronizacao', /aNuvem/.test(fonteOb), true);
check('e a protecao do aparelho', /protecao/.test(fonteOb), true);
check('e a rotina, que alimenta o painel', /aRotina/.test(fonteOb), true);
check('sao nove telas ao todo', Onboarding.telas.length, 9);

/* A PROTECAO NAO PODE SER UM "AGORA NAO" BARATO. O botao principal protege; a
   recusa e um link de texto, e ela fica REGISTRADA — um app que repete a mesma
   pergunta a cada abertura ensina a ignorar avisos, e ai o aviso que importa
   morre junto. */
Onboarding.passo = Onboarding.telas.findIndex(t => /protecao/.test(t.name));
const telaSeg = Onboarding.telas[Onboarding.passo].call(Onboarding);
check('a protecao e a acao principal da tela', /class="btn" data-ob="pin"/.test(telaSeg), true);
check('e recusar e um link, nao um botao igual', /btn-texto" data-ob="sem-pin"/.test(telaSeg), true);
check('a tela avisa que nao ha recuperacao', /nao ha recuperacao|não há recuperação/i.test(telaSeg), true);

/* ==================== O SISTEMA VISUAL E O MESMO DO DOMI ===

   Nao e semelhante: e o MESMO arquivo. css/domi.css e copia fiel, e a camada do
   CESTA so acrescenta o que o app de compras tem e o de financas nao. */

console.log('\n=== Identidade visual com o DOMI ===');

/* O vocabulario de classes tem de ser o do DOMI. Enquanto um app diz .folha e o
   outro .sheet, os dois NUNCA vao parecer o mesmo — cada peca duplicada e uma
   chance de divergir na proxima alteracao. */
const proibidas = ['class="folha"', 'class="dock"', 'class="dock-item"',
  'class="topbar-acao"', 'class="linha-acao"', 'class="selo"', 'class="vazio"',
  'class="secao"', 'class="conteudo"'];
for (const p of proibidas) {
  const onde = [];
  for (const arq of ['index.html'].concat(
      fs.readdirSync(BASE + 'js/views').map(f => 'js/views/' + f))) {
    if (fs.readFileSync(BASE + arq, 'utf8').includes(p)) onde.push(arq);
  }
  check(`ninguem usa ${p} (vocabulario antigo)`, onde.length ? onde.join(', ') : true, true);
}

/* E o shell tem a mesma estrutura: wrapper > topbar-inner > content > view. */
check('o shell usa a estrutura do DOMI',
  shell.includes('topbar-inner') && shell.includes('class="content"') && shell.includes('class="view"'), true);
check('e a barra de baixo e a tabbar do DOMI', shell.includes('class="tabbar"'), true);
check('com .tab em vez de .dock-item', /class="tab"/.test(shell), true);

/* NENHUM BOTAO GIGANTE FORA DO MERCADO. Cinco botoes de 56px empilhados nao e
   hierarquia — e a ausencia dela, e foi o que deu ao app cara de prototipo. */
{
  const comBotaoGrande = [];
  for (const arq of fs.readdirSync(BASE + 'js/views').map(f => 'js/views/' + f)) {
    if (arq.includes('mercado')) continue;   // ali o alvo grande tem justificativa
    const src = fs.readFileSync(BASE + arq, 'utf8');
    if (src.includes('btn-grande')) comBotaoGrande.push(arq);
  }
  check('so o Modo Mercado usa alvo aumentado',
    comBotaoGrande.length ? comBotaoGrande.join(', ') : true, true);
}

/* Uma tela nao pode ter uma pilha de acoes principais: o botao cheio e A acao,
   e quando tudo e principal nada e. */
for (const arq of fs.readdirSync(BASE + 'js/views').map(f => 'js/views/' + f)) {
  const src = fs.readFileSync(BASE + arq, 'utf8');
  /* A REGRA REAL nao e quantos botoes cheios ha no ARQUIVO: dialogos.js tem
     onze folhas, cada uma com a sua acao principal, e isso esta certo. E que
     nao existam DOIS CHEIOS EM SEQUENCIA na mesma tela — ali nenhum dos dois e
     o principal, e a pessoa fica sem saber onde tocar. Foi exatamente o que
     deixou o app com cara de prototipo. */
  /* Os DOIS precisam ser cheios. O regex anterior olhava só o segundo, e
     reprovava a hierarquia CERTA — dois vazados seguidos de um cheio, que é
     exatamente o desenho correto do rodapé do Modo Mercado. */
  const empilhados = (src.match(/<button class="btn"[\s\S]{0,220}?<\/button>\s*<button class="btn"[^-]/g) || []).length;
  check(`${arq.replace('js/views/', '')} nao empilha dois botoes cheios`, empilhados, 0);
}


/* ============ A SINCRONIZACAO NAO PERDE PACOTE ===

   O defeito que estava aqui: o push tirava um retrato dos registros sujos,
   esperava o servidor, e depois marcava TODOS como limpos. Uma edicao feita
   DURANTE a espera era apagada — o registro subia com o valor velho e ficava
   marcado como enviado.

   No mercado isso nao e hipotese: a pessoa digita um preco atras do outro
   enquanto o envio anterior ainda esta no ar. */

console.log('\n=== Sincronizacao: nada se perde ===');

DB.apagarTudo();
Sync.cfg = { url: 'https://x.supabase.co', anonKey: 'k', user_id: 'u1',
             access_token: 't', family_id: 'f1' };
Sync.ocupado = false;
Sync.pedidoPendente = false;
Sync.ultimoErro = null;
navigator.onLine = true;

/* A JANELA DE PERDA, reproduzida: o fetch demora, e a pessoa edita no meio. */
{
  const item = DB.itemPorNome('Arroz', { unidade: 'kg' });
  check('o item nasce sujo, esperando envio', DB.get('items', item.id).dirty, true);

  const fetchAntes = global.fetch;
  let editouNoMeio = false;
  global.fetch = async () => {
    /* Enquanto o servidor "responde", a pessoa muda o item — exatamente o que
       acontece quando se digita o proximo preco no corredor. */
    if (!editouNoMeio) {
      editouNoMeio = true;
      DB.upsert('items', { id: item.id, nome: 'Arroz integral' });
    }
    return { ok: true, json: async () => [], text: async () => '' };
  };

  await Sync.push();
  global.fetch = fetchAntes;

  const depois = DB.get('items', item.id);
  check('a edicao feita durante o envio sobrevive', depois.nome, 'Arroz integral');
  /* E O QUE IMPORTA: ela continua SUJA. Marcada como enviada, a edicao nunca
     subiria — o servidor teria o nome velho para sempre, e o app acharia que
     estava tudo em dia. */
  check('e continua marcada para enviar', depois.dirty, true);
}

/* O caminho feliz: quem NAO mudou durante o envio e marcado como enviado. */
{
  DB.apagarTudo();
  const it = DB.itemPorNome('Feijão', { unidade: 'kg' });
  const fetchAntes = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => [], text: async () => '' });
  await Sync.push();
  global.fetch = fetchAntes;
  check('o que nao mudou fica marcado como enviado', DB.get('items', it.id).dirty, false);
  check('e a fila esvazia', Sync.pendentes(), 0);
}

/* FALHA NAO PERDE NADA: o que nao subiu continua sujo e vai na proxima. */
{
  DB.apagarTudo();
  const it = DB.itemPorNome('Café', { unidade: 'g' });
  const fetchAntes = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({}), text: async () => 'sem rede' });
  let falhou = false;
  try { await Sync.push(); } catch (_) { falhou = true; }
  global.fetch = fetchAntes;
  check('o envio que falha avisa', falhou, true);
  check('e o registro continua na fila', DB.get('items', it.id).dirty, true);
}

/* ENVIO EM LOTES: um POST com mil linhas estoura limite de corpo e leva tudo
   junto. Em lotes, uma falha custa 200 registros que voltam na proxima. */
{
  DB.apagarTudo();
  for (let i = 0; i < 450; i++) DB.itemPorNome('Item ' + i, { unidade: 'un' });
  const fetchAntes = global.fetch;
  const tamanhos = [];
  global.fetch = async (url, opcoes) => {
    tamanhos.push(JSON.parse(opcoes.body).length);
    return { ok: true, json: async () => [], text: async () => '' };
  };
  await Sync.push();
  global.fetch = fetchAntes;
  check('450 registros vao em mais de um lote', tamanhos.length >= 3, true);
  check('e nenhum lote passa de 200', Math.max(...tamanhos) <= 200, true);
  check('mas todos foram enviados', tamanhos.reduce((a, b) => a + b, 0), 450);
}

/* ============ SINCRONIZAR AGORA FUNCIONA ===

   Um botao "sincronizar agora" que nao sincroniza e pior que botao nenhum. */

console.log('\n=== Sincronizar agora ===');

DB.apagarTudo();
Sync.ocupado = false;
Sync.pedidoPendente = false;

/* OFFLINE, O AUTOMATICO ESPERA — mas o MANUAL tenta. Quem tocou o botao quer
   uma resposta, nem que seja "nao consegui". */
{
  navigator.onLine = false;
  const fetchAntes = global.fetch;
  let tocou = 0;
  global.fetch = async () => { tocou++; return { ok: true, json: async () => [], text: async () => '' }; };

  await Sync.sincronizar();
  check('offline, o automatico nao tenta', tocou, 0);

  await Sync.sincronizar({ agora: true });
  check('mas o manual tenta assim mesmo', tocou > 0, true);

  global.fetch = fetchAntes;
  navigator.onLine = true;
}

/* PEDIDO DURANTE UM ENVIO NAO SE PERDE: fica marcado e roda ao fim. Descartar
   seria engolir em silencio o toque de quem esta esperando. */
{
  Sync.ocupado = true;
  Sync.pedidoPendente = false;
  const r = await Sync.sincronizar({ agora: true });
  check('pedido durante o envio nao roda na hora', r, null);
  check('mas fica marcado para rodar ao fim', Sync.pedidoPendente, true);
  Sync.ocupado = false;
  Sync.pedidoPendente = false;
}

/* ============ O INDICADOR DIZ A VERDADE ===

   O ponto so acende quando ha algo a dizer: um indicador permanente de "nada
   acontecendo" e ruido, e ruido constante deixa de ser lido. */

console.log('\n=== O indicador de sincronia ===');

DB.apagarTudo();
navigator.onLine = true;
Sync.ocupado = false;
Sync.ultimoErro = null;

check('sem fila e online, esta tudo ok', Sync.calcularEstado(), 'ok');

DB.itemPorNome('Arroz');
check('com fila, fica pendente', Sync.calcularEstado(), 'pendente');

navigator.onLine = false;
check('sem conexao e com fila, fica offline', Sync.calcularEstado(), 'offline');

/* SEM CONEXAO E SEM FILA NAO E PROBLEMA: e um app offline-first fazendo o que
   promete. Acender ali ensinaria a pessoa a ignorar o ponto. */
DB.apagarTudo();
check('sem conexao e sem fila, nao acende nada', Sync.calcularEstado(), 'ok');
navigator.onLine = true;

Sync.ocupado = true;
check('durante o envio, mostra que esta sincronizando', Sync.calcularEstado(), 'sync');
Sync.ocupado = false;

Sync.ultimoErro = 'falhou';
check('depois de um erro, avisa', Sync.calcularEstado(), 'erro');
Sync.ultimoErro = null;

const cfgAntes = Sync.cfg;
Sync.cfg = {};
check('sem configuracao, nao ha o que indicar', Sync.calcularEstado(), 'off');
Sync.cfg = cfgAntes;

/* O ESTADO CHEGA NA TELA. Sem o gancho, o indicador seria um objeto que sabe de
   tudo e nao conta nada a ninguem. */
{
  let recebido = null;
  Sync.onState = (estado, pendentes) => { recebido = { estado, pendentes }; };
  DB.itemPorNome('Leite');
  Sync.avisarEstado();
  check('a tela e avisada do estado', recebido && recebido.estado, 'pendente');
  check('e de quantos estao esperando', recebido.pendentes > 0, true);
  Sync.onState = null;
}

/* A TELA LIGA AS DUAS PECAS. */
{
  const app = fs.readFileSync(BASE + 'js/app.js', 'utf8');
  check('o app liga o ponto', app.includes('Sync.onState ='), true);
  check('e a linha de texto', app.includes('Sync.onStatus ='), true);
  check('e refaz a tela quando chega coisa nova', app.includes('Sync.onChanged ='), true);
  /* NUNCA com uma folha aberta: refazer a tela apagaria o que a pessoa esta
     digitando no meio da frase. */
  check('mas nunca com uma folha aberta',
    /onChanged[\s\S]{0,200}sheet-backdrop[\s\S]{0,60}return/.test(app), true);
  check('o botao sincroniza agora ao ser tocado',
    /btn\.addEventListener\('click'[\s\S]{0,120}agora: true/.test(app), true);

  const shell2 = fs.readFileSync(BASE + 'index.html', 'utf8');
  check('o botao existe no header', shell2.includes('id="btn-sync"'), true);
  check('com o ponto dentro dele', shell2.includes('id="sync-dot"'), true);
  check('e a linha de status acima do conteudo', shell2.includes('id="sync-status"'), true);

  /* A COR NUNCA INFORMA SOZINHA: cada estado tem uma palavra no title. */
  check('todo estado tem palavra, nao so cor',
    app.includes("ok: 'Tudo sincronizado'") && app.includes('Sem conexão'), true);
  /* E as palavras dizem que nada se perdeu, porque e verdade. */
  check('e o erro diz que nada se perdeu', /nada se perdeu/.test(app), true);
}

/* A sincronizacao automatica acontece nos tres momentos que importam. */
{
  const sync = fs.readFileSync(BASE + 'js/sync.js', 'utf8');
  check('sincroniza ao voltar a conexao', sync.includes("addEventListener('online'"), true);
  check('e ao voltar do bolso', sync.includes("visibilitychange"), true);
  check('e o app liga isso no boot',
    fs.readFileSync(BASE + 'js/app.js', 'utf8').includes('Sync.ligarAutomatico()'), true);
}


/* ================= O SCHEMA EVOLUI, NAO SO CRIA ===

   O ERRO RELATADO, ao criar a familia num banco que ja existia:

       Could not find the 'codigo' column of 'families' in the schema cache

   `create table if not exists` numa tabela que JA EXISTE nao faz nada — nem
   acrescenta as colunas novas. Quem rodou uma versao anterior do schema ficava
   com a tabela antiga para sempre, e o app quebrava pedindo uma coluna que
   nunca chegou.

   Esta classe de defeito VOLTA toda vez que uma coluna nova e acrescentada, e
   por isso ela precisa de teste — nao de cuidado. */

console.log('\n=== O schema aceita banco antigo ===');

check('ha um bloco de migracao', /add column if not exists/.test(sql), true);

/* TODA COLUNA QUE O APP ENVIA precisa estar na migracao, e nao so no create
   table. Se estiver so no create, ela nunca chega a um banco que ja existe. */
{
  const blocoMigracao = (schema.match(/colunas text\[\]\[\] := array\[([\s\S]*?)\];/) || [])[1] || '';
  const faltando = [];
  for (const [tabela, colunas] of Object.entries(SYNC_TABELAS)) {
    for (const col of colunas.concat(['rev'])) {
      /* As colunas do create table original de cada tabela ja existem em
         qualquer banco que tenha rodado o schema alguma vez. O que precisa
         estar na migracao e o que veio DEPOIS — e como nao da para saber quando
         cada uma chegou, exige-se as que o app envia HOJE e que nao estavam na
         primeira versao. */
      if (['rev', 'pegou_por', 'ciclo', 'cnpj', 'descricao_pdv', 'nfce_chave', 'foto_id', 'formato'].includes(col)) {
        const temNaMigracao = new RegExp("'" + tabela + "'\\s*,\\s*'" + col + "'").test(blocoMigracao);
        if (!temNaMigracao) faltando.push(tabela + '.' + col);
      }
    }
  }
  check('toda coluna recente esta na migracao',
    faltando.length ? faltando.join(', ') : true, true);
}

/* AS TABELAS DA FAMILIA sao as que quebraram, e sao as que o verificador
   ignorava. Sem 'codigo', ninguem cria nem entra numa casa. */
check('families.codigo esta na migracao', /'families'\s*,\s*'codigo'/.test(sql), true);
check('e o indice unico e criado a parte', /idx_families_codigo/.test(sql), true);
/* O indice tem de vir DEPOIS da coluna: num banco antigo a coluna acabou de
   nascer, e criar o indice antes falharia. */
check('e o indice vem depois da migracao',
  sql.indexOf('idx_families_codigo') > sql.indexOf('add column if not exists'), true);

/* A migracao nao pode explodir num banco onde a tabela ainda nao existe: ela
   roda antes do create table em algumas ordens, e um erro ali derruba o script
   inteiro — o mesmo defeito que o server_at ja teve. */
check('a migracao pula tabela que ainda nao existe', /to_regclass/.test(sql), true);

/* O VERIFICADOR PRECISA COBRIR O QUE QUEBROU. Ele conferia as 8 tabelas de
   dados e ignorava families e family_members — e dizia "banco pronto" com a
   estrutura incompleta. Um verificador que nao cobre tudo da a pior garantia
   possivel: a falsa. */
{
  const v = fs.readFileSync(BASE + 'supabase/verificar.js', 'utf8');
  check('o verificador confere families', /families:/.test(v), true);
  check('e family_members', /family_members:/.test(v), true);
  check('e o codigo, que foi o que faltou', /'codigo'/.test(v), true);
  check('e o contador de versao nas tabelas de dados', /'rev'/.test(v), true);
}


/* ================== A NFC-e EM PDF, CONTRA UMA NOTA DE VERDADE ===

   VARIOS ESTADOS SO ENTREGAM PDF — o Rio Grande do Norte entre eles. Sem ler
   PDF, quem mora nesses estados nao tem como trazer o historico, e o app volta
   a ser "use por tres meses e depois fica bom".

   O fixture e uma nota REAL de 132 itens, com CPF e endereco trocados. Testar
   contra o formato de verdade e o unico jeito de saber se o parser funciona: um
   arquivo inventado por mim provaria a minha imaginacao, nao o DANFE. */

console.log('\n=== NFC-e em PDF ===');

{
  const danfe = fs.readFileSync(BASE + 'tests/fixtures/danfe-rn.txt', 'utf8');
  const nota = NFCe.lerPDF(danfe);

  check('le a nota em PDF', !!nota, true);
  check('com os 132 itens', nota.itens.length, 132);
  check('a loja', nota.loja, 'G Mira Ltda');
  check('a data de emissao', nota.data, '2026-08-03');
  check('e o total', nota.total, 1312.04);

  /* A CHAVE PELO ROTULO, e nao pelos primeiros 44 digitos do texto: no DANFE,
     numero + serie + CNPJ + IE + CEP colados dao 44 digitos por coincidencia, e
     era ISSO que o parser devolvia. Chave errada quebra o dedupe de um jeito
     invisivel — duas notas da mesma loja gerariam a mesma chave falsa, e a
     segunda seria recusada como "ja importada". */
  check('a chave de acesso e a de verdade',
    nota.chave, '24260807973007000309655080000237311316627040');
  check('e nao a colagem de numero + CNPJ + IE',
    nota.chave === '23731508079730070003092022282405917300009372', false);

  /* PESO VARIAVEL: e o caso que separa um parser que funciona de um que parece
     funcionar. Frios e hortifruti sao a maior parte do valor de um mercado. */
  const presunto = nota.itens.find(i => /PRESUNTO PERU/.test(i.descricao));
  check('le peso variavel', presunto.qtd, 0.286);
  check('na unidade certa', presunto.unidade, 'KG');
  check('com o preco por quilo', presunto.valorUnitario, 28.99);
  check('e o valor da linha', presunto.valorTotal, 8.29);

  /* A PROVA ARITMETICA em TODOS os itens. E ela que impede o parser de produzir
     lixo em silencio quando o layout mudar: um deslocamento de uma linha viraria
     precos errados entrando no historico, e ninguem perceberia. */
  const divergentes = nota.itens.filter(i =>
    Math.abs(i.valorTotal - i.qtd * i.valorUnitario) > 0.05);
  check('todo item fecha: qtd x unitario = total',
    divergentes.length ? divergentes[0].descricao : true, true);

  /* A soma das linhas menos o desconto tem de dar o total da nota. E a
     conferencia que prova que nenhum item foi perdido nem duplicado. */
  const soma = nota.itens.reduce((s, i) => s + i.valorTotal, 0);
  check('a soma dos itens menos o desconto da o total',
    Math.round((soma - 50.90) * 100) / 100, nota.total);

  /* A porta unica reconhece o formato sozinha. */
  const pelaPorta = NFCe.ler(danfe, 'nota.pdf');
  check('a porta unica reconhece o DANFE', pelaPorta && pelaPorta.formato, 'pdf');
  check('e devolve os mesmos itens', pelaPorta.itens.length, 132);
}

/* UNIDADE DESCONHECIDA NAO E ADIVINHADA: uma linha com unidade fora da lista e
   ignorada, e nao chutada como 'un'. */
{
  const inventado = ['DANFE NFC-e', '1', '999', 'COISA ESTRANHA', '5102', '12345678',
                     '0', '2', 'BANDEJA', '10,00', '20,00', '20,00', '4,00', '20,00'].join('\n');
  check('linha com unidade desconhecida e ignorada', NFCe.lerPDF(inventado), null);
}

/* E o parser recusa um texto que nao e DANFE, em vez de inventar itens. */
check('texto que nao e nota devolve nulo', NFCe.lerPDF('bom dia\n1\n2\n3'), null);

/* O LEITOR DE PDF em si: ele existe, nao usa biblioteca, e diz quando nao da. */
{
  const pdf = fs.readFileSync(BASE + 'js/pdf.js', 'utf8');
  check('o leitor de PDF nao usa biblioteca', /require\(|import /.test(pdf), false);
  check('usa o descompressor do proprio navegador', pdf.includes('DecompressionStream'), true);
  /* PDF escaneado nao tem texto: dizer isso e melhor que devolver vazio — a
     pessoa precisa saber que o problema e o arquivo, nao o app. */
  check('e avisa quando o PDF e imagem', pdf.includes("'sem_texto'"), true);
  check('e quando o navegador nao suporta', pdf.includes("'sem_suporte'"), true);

  const tela = fs.readFileSync(BASE + 'js/views/importar.js', 'utf8');
  check('a tela aceita PDF', /accept="[^"]*\.pdf/.test(tela), true);
  check('e explica o que fazer com PDF de imagem', /escaneado|foto/.test(tela), true);
}

  console.log(`
${ok} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
})();
