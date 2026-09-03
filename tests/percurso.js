/* CESTA — O PERCURSO: o app inteiro, do zero até a primeira compra.

   POR QUE ESTE ARQUIVO EXISTE.

   O retorno do uso real foi: "totalmente confuso de utilizar", "de repente já
   to na tela inicial sem passar por nada", "sem saber o que fazer", "um modal
   sem botão de fechar". E as três suítes estavam verdes.

   Elas estavam certas no que testavam, e é isso que dói: `smoke` prova que as
   REGRAS estão certas, `ligacoes` prova que dá para CHEGAR até elas, e nenhuma
   das duas percorre o CAMINHO. Uma tela pode montar, ter todos os botões
   ligados, calcular tudo certo — e ainda assim largar a pessoa num beco.

   Aqui se anda pelo app como uma pessoa anda: um passo depois do outro, do
   primeiro toque até o primeiro preço registrado. O que se mede não é se cada
   peça funciona, é se o CAMINHO existe:

     · toda tela leva a alguma coisa
     · toda folha tem como sair
     · a apresentação TERMINA configurada, inclusive quem a pula
     · o app nunca larga a pessoa sem próximo passo

       node tests/percurso.js
   ========================================================================= */
'use strict';

const ANCORA = process.env.HOJE || '2026-09-03T10:00:00-03:00';
const DataReal = Date;
const instante = new DataReal(ANCORA).getTime();
class DataCongelada extends DataReal {
  constructor(...a) { if (a.length === 0) super(instante); else super(...a); }
  static now() { return instante; }
}
DataCongelada.parse = DataReal.parse;
DataCongelada.UTC = DataReal.UTC;
global.Date = DataCongelada;

const fs = require('fs');
const path = require('path');
const BASE = path.join(__dirname, '..') + path.sep;

const armazem = base => ({
  getItem: k => (k in base ? base[k] : null),
  setItem: (k, v) => { base[k] = String(v); },
  removeItem: k => { delete base[k]; },
  key: i => Object.keys(base)[i] ?? null,
  get length() { return Object.keys(base).length; },
});
const guardado = {};
global.localStorage = armazem(guardado);
global.sessionStorage = armazem({});

if (!global.crypto || !global.crypto.randomUUID) {
  Object.defineProperty(global, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      }),
      getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = Math.random() * 256 | 0; return a; },
    },
  });
}

/* O DOM falso guarda o HTML de verdade, para poder responder "esta tela tem
   botão de fechar?" — que é a pergunta deste arquivo. */
const criados = {};
function novoEl(tag) {
  const el = {
    tagName: tag, innerHTML: '', value: '', textContent: '', hidden: false,
    checked: false, dataset: {}, style: { setProperty() {} }, className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    _ouvintes: {},
    addEventListener(ev, fn) { (this._ouvintes[ev] || (this._ouvintes[ev] = [])).push(fn); },
    removeEventListener() {}, focus() {}, blur() {}, setSelectionRange() {},
    remove() { this._removido = true; },
    appendChild(f) { criados.ultimaFolha = f; return f; },
    querySelector(sel) { return buscarEm(this, sel); },
    querySelectorAll(sel) { return buscarTodos(this, sel); },
    closest: () => null,
    setAttribute() {}, getAttribute: () => null,
    click() { for (const f of this._ouvintes.click || []) f({ target: this, stopPropagation() {} }); },
  };
  return el;
}

/* Busca por id ou classe dentro do innerHTML — o suficiente para responder se
   um elemento foi GERADO, que é o que interessa a um teste de percurso. */
function buscarEm(el, sel) {
  const html = el.innerHTML || '';
  const id = sel.startsWith('#') ? sel.slice(1) : null;
  const cls = sel.startsWith('.') ? sel.slice(1) : null;
  if (id && !html.includes(`id="${id}"`)) return null;
  if (cls && !html.includes(cls)) return null;
  const achado = novoEl('div');
  achado._sel = sel;
  return achado;
}
function buscarTodos(el, sel) {
  const html = el.innerHTML || '';
  const cls = sel.replace(/^[.#]/, '').split('[')[0];
  const quantos = (html.match(new RegExp(cls, 'g')) || []).length;
  return Array.from({ length: quantos }, () => novoEl('div'));
}

const corpo = novoEl('body');
global.document = {
  documentElement: { dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } },
  body: corpo,
  readyState: 'complete',
  createElement: novoEl,
  querySelector: sel => (criados.ultimaFolha ? buscarEm(criados.ultimaFolha, sel) : null),
  querySelectorAll: sel => (criados.ultimaFolha ? buscarTodos(criados.ultimaFolha, sel) : []),
  getElementById: id => criados['#' + id] || (criados['#' + id] = novoEl('div')),
  addEventListener: () => {},
};
global.window = global;
Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: true } });
global.scrollTo = () => {};
global.addEventListener = () => {};

/* O eval exporta para o global explicitamente: `const` dentro de eval não
   vaza, e o módulo seguinte não enxergaria o anterior. */
const carregar = (arq, exporta) => eval(fs.readFileSync(BASE + arq, 'utf8') + ';' + exporta);
carregar('js/config.js', "global.CONFIG = CONFIG;");
carregar('js/icons.js', "global.pintarIcones = pintarIcones; global.ICONES = ICONES;");
carregar('js/ui.js', "global.UI = UI;");
carregar('js/catalogo.js', "global.Catalogo = Catalogo; global.CORREDORES = CORREDORES; global.ITENS_COMUNS = ITENS_COMUNS;");
carregar('js/db.js', "global.DB = DB; global.CICLOS = CICLOS; global.STORES = STORES;");
carregar('js/precos.js', "global.Precos = Precos;");
carregar('js/despensa.js', "global.Despensa = Despensa;");
carregar('js/decisoes.js', "global.Decisoes = Decisoes;");
carregar('js/cozinha.js', "global.Cozinha = Cozinha; global.PRATOS = PRATOS; global.EVENTOS = EVENTOS;");
carregar('js/sync.js', "global.Sync = Sync; global.SYNC_TABELAS = SYNC_TABELAS;");
carregar('js/views/historico.js', "global.ViewHistorico = ViewHistorico;");
carregar('js/planejar.js', "global.Planejar = Planejar; global.DB_CICLO_NOME = DB_CICLO_NOME;");
carregar('js/onboarding.js', "global.Onboarding = Onboarding; global.abrirAjuda = abrirAjuda;");
carregar('js/views/lista.js', "global.ViewLista = ViewLista;");
carregar('js/views/mercado.js', "global.Mercado = Mercado;");
carregar('js/views/hoje.js', "global.ViewHoje = ViewHoje;");
carregar('js/views/produtos.js', "global.ViewProdutos = ViewProdutos;");
carregar('js/views/despensa.js', "global.ViewDespensa = ViewDespensa;");
carregar('js/views/planejar.js', "global.ViewPlanejar = ViewPlanejar;");
carregar('js/views/analise.js', "global.ViewAnalise = ViewAnalise;");

let ok = 0, fail = 0;
const check = (nome, real, esperado) => {
  const vazio = v => v === null || v === undefined;
  const bateu = (vazio(real) && vazio(esperado)) ||
    (!vazio(real) && !vazio(esperado) &&
     (Math.abs(Number(real) - Number(esperado)) < 0.001 || real === esperado));
  console.log(`${bateu ? '  OK  ' : ' FALHA'} | ${nome.padEnd(58)} ${bateu ? '' : `obtido ${real}, esperado ${esperado}`}`);
  bateu ? ok++ : fail++;
};

/* ============================== PASSO 1: A PRIMEIRA ABERTURA === */

console.log('\n=== Passo 1: abro o app pela primeira vez ===');

DB.load();
Sync.cfg = {};
check('o app pede configuração', Onboarding.precisaConfigurar(), true);

/* CADA TELA DA APRESENTAÇÃO PRECISA LEVAR A ALGUM LUGAR. Uma tela sem saída é
   um beco, e o app tinha vários. */
for (let i = 0; i < Onboarding.telas.length; i++) {
  Onboarding.passo = i;
  const html = Onboarding.telas[i].call(Onboarding);
  const nome = Onboarding.telas[i].name || ('tela ' + i);
  const temSaida = /data-ob="(avancar|pular|local|nuvem|pin|sem-pin|importar)"/.test(html);
  check(`${nome}: leva a algum lugar`, temSaida, true);
}

/* ==================== PASSO 2: PULAR NÃO PODE PULAR A CONFIGURAÇÃO === */

console.log('\n=== Passo 2: "já conheço, quero pular" ===');

/* O RELATO: "se eu simplesmente selecionar por pular a introdução ele vai pra
   tela inicial sem configurar nada". Pular a EXPLICAÇÃO é legítimo; pular a
   CONFIGURAÇÃO deixa o app sem identidade, sem nuvem e sem proteção. */
{
  const ob = fs.readFileSync(BASE + 'js/onboarding.js', 'utf8');
  const trechoPular = (ob.match(/acao === 'pular'\)[\s\S]{0,900}?\n        \}/) || [''])[0];
  check('pular NÃO fecha a apresentação', /this\.fechar\(/.test(trechoPular), false);
  check('e leva para a tela de identidade', /suaCasa/.test(trechoPular), true);
}

/* A tela da nuvem também não pode abandonar o fluxo. */
{
  const ob = fs.readFileSync(BASE + 'js/onboarding.js', 'utf8');
  const trechoNuvem = (ob.match(/acao === 'nuvem'\)[\s\S]{0,1200}?\n        \}/) || [''])[0];
  check('a nuvem não manda para a tela inicial', /irPara\('hoje'\)/.test(trechoNuvem), false);
  check('ela configura e volta ao fluxo', /aoTerminar/.test(trechoNuvem), true);
}

/* ==================== PASSO 3: TODA FOLHA TEM COMO SAIR === */

console.log('\n=== Passo 3: consigo sair de qualquer tela ===');

/* O RELATO: "vem um modal na tela me falando que não vai sugerir nada, sem
   botão de fechar". Eram 33 folhas, e nenhuma tinha saída visível — dava para
   sair tocando no fundo escuro ou no Esc, duas coisas que ninguém descobre
   sozinho num celular. */
{
  const ui = fs.readFileSync(BASE + 'js/ui.js', 'utf8');
  check('toda folha nasce com o X', ui.includes('class="sheet-fechar"'), true);
  check('e o X fecha de verdade', /sheet-fechar[\s\S]{0,120}addEventListener\('click', fechar\)/.test(ui), true);

  const css = fs.readFileSync(BASE + 'css/cesta.css', 'utf8');
  check('o X tem alvo confortável', /\.sheet-fechar \{[\s\S]{0,200}width: 34px/.test(css), true);
  check('e não fica escondido atrás do título', /padding-right: 44px/.test(css), true);
}

/* A folha de "nada a sugerir" era o pior beco: não tinha saída E não tinha
   nada a oferecer. */
{
  const d = fs.readFileSync(BASE + 'js/views/dialogos.js', 'utf8');
  const trecho = (d.match(/if \(!sugestoes\.length\)[\s\S]{0,3000}?\n  \}/) || [''])[0];
  check('sem sugestão, a tela oferece um caminho', /ns-importar|ns-lista/.test(trecho), true);
  check('e explica POR QUE não sugeriu', /Por que não sugeri/.test(trecho), true);
}

/* ==================== PASSO 4: A TELA INICIAL ME DIZ O QUE FAZER === */

console.log('\n=== Passo 4: chego na tela inicial ===');

/* O RELATO: "sem saber o que fazer no app na tela inicial". A HOJE mostrava o
   ESTADO da casa — e estado é resposta para quem já usa. Quem chegou precisa de
   um próximo passo. */
DB.apagarTudo();
Sync.cfg = {};
{
  const html = ViewHoje.render();
  check('a tela inicial monta', html.length > 300, true);
  check('e diz qual é o próximo passo', /proximo-passo/.test(html), true);
  /* Sem preço nenhum, o passo mais valioso é o atalho da nota fiscal: é a
     diferença entre "volte em três meses" e "é útil hoje à tarde". */
  check('e o passo é o mais valioso para quem não tem nada',
    /Importar/.test(html), true);
}

/* Com uma lista pronta, o passo muda: marcar a compra. */
{
  const lista = DB.novaLista({ nome: 'Semana' });
  const item = DB.itemPorNome('Arroz', { unidade: 'kg' });
  DB.addNaLista(lista.id, { item_id: item.id, qtd: 5, unidade: 'kg' });
  const html = ViewHoje.render();
  check('com lista pronta, o passo é marcar a compra', /Marcar/.test(html), true);
}

/* No meio de uma compra, nada mais importa. */
{
  const lista = DB.listasPlanejadas()[0];
  DB.upsert('lists', { id: lista.id, status: 'em_curso' });
  const html = ViewHoje.render();
  check('comprando, o passo é voltar ao mercado', /Voltar ao mercado/.test(html), true);
  DB.upsert('lists', { id: lista.id, status: 'planejada' });
}

/* E quando está tudo encaminhado, a faixa SOME: insistir com quem já sabe o que
   faz é ruído, e ruído constante deixa de ser lido. */
{
  DB.apagarTudo();
  const it = DB.itemPorNome('Arroz', { unidade: 'kg' });
  Precos.registrar(DB, { item_id: it.id, data: DB.hojeISO(), preco_total: 25, qtd: 5, unidade: 'kg' });
  DB.novoPlano({ ciclo: 'mensal', data: DB.hojeISO() });
  check('com tudo encaminhado, a faixa some', /proximo-passo/.test(ViewHoje.render()), false);
}

/* ==================== PASSO 5: OS CAMPOS FUNCIONAM === */

console.log('\n=== Passo 5: preencho um formulário ===');

/* O RELATO: "o campo de data no formulário não tem o datepicker". Ele tinha —
   e o ícone do navegador é escuro por padrão, invisível sobre o tema escuro. */
{
  const css = fs.readFileSync(BASE + 'css/cesta.css', 'utf8');
  check('o ícone do calendário é clareado no escuro',
    /calendar-picker-indicator[\s\S]{0,120}invert\(1\)/.test(css), true);
  check('e escurecido de volta no claro',
    /data-tema="light"\] input\[type="date"\]/.test(css), true);

  const ui = fs.readFileSync(BASE + 'js/ui.js', 'utf8');
  check('o campo inteiro abre o seletor', ui.includes('showPicker'), true);
  check('e toda folha liga isso sozinha', ui.includes('this.ligarDatas(fundo)'), true);
}

/* ==================== PASSO 6: O CAMINHO ATÉ O PRIMEIRO PREÇO === */

console.log('\n=== Passo 6: da lista até o primeiro preço ===');

DB.apagarTudo();
{
  // monto a lista
  const item = DB.itemPorNome('Arroz', { categoria: 'mercearia', unidade: 'kg', qtd_habitual: 5 });
  const plano = DB.novoPlano({ ciclo: 'mensal', data: DB.hojeISO() });
  DB.addNaLista(plano.list_id, { item_id: item.id, qtd: 5, unidade: 'kg' });
  check('a compra marcada tem lista', DB.itensDaLista(plano.list_id).length, 1);

  // entro no mercado
  const loja = DB.upsert('stores', { nome: 'Atacadão' });
  DB.upsert('lists', { id: plano.list_id, status: 'em_curso', store_id: loja.id });
  check('e vira compra em curso', !!DB.listaEmCurso(), true);

  Mercado.listaId = plano.list_id;
  Mercado.focoId = null;
  const html = Mercado.render();
  check('o Modo Mercado mostra o item', /Arroz/.test(html), true);
  check('e tem como registrar o preço', /data-acao="focar"/.test(html), true);

  // registro o preço
  const li = DB.itensDaLista(plano.list_id)[0];
  Precos.registrar(DB, {
    item_id: item.id, store_id: loja.id, data: DB.hojeISO(),
    preco_total: 24.90, qtd: 5, unidade: 'kg', origem: 'digitado',
  });
  DB.upsert('list_items', { id: li.id, comprado: true, preco_total: 24.90 });

  check('o preço entra no histórico', DB.all('price_obs').length, 1);
  check('e o carrinho soma', DB.totalDoCarrinho(plano.list_id, () => null).firme, 24.90);

  /* O CICLO SE FECHA: o preço registrado vira despensa, e a despensa vira
     sugestão na próxima compra. É esse encadeamento que faz o app ser um
     assistente e não um caderno. */
  const naDespensa = Despensa.saldoDe(DB, item.id);
  check('o que foi comprado aparece na despensa', !!naDespensa, true);
  check('e o produto passa a existir na análise',
    /Arroz/.test(ViewProdutos.render(true)), true);
}

/* ==================== PASSO 7: NENHUMA TELA É UM BECO === */

console.log('\n=== Passo 7: nenhuma tela me prende ===');

/* Toda tela principal, no estado VAZIO, precisa oferecer alguma coisa. Uma tela
   que só diz "não há nada aqui" é onde a pessoa desiste. */
DB.apagarTudo();
Sync.cfg = {};
for (const [nome, render] of [
  ['Hoje', () => ViewHoje.render()],
  ['Planejar', () => ViewPlanejar.render()],
  ['Despensa', () => ViewDespensa.render()],
  ['Análise', () => ViewAnalise.render()],
  ['Lista', () => ViewLista.render()],
]) {
  const html = render();
  const temAcao = /<button/.test(html);
  check(`${nome} vazia oferece alguma ação`, temAcao, true);
  /* E o estado vazio precisa EXPLICAR, não só constatar: "sem dados" informa o
     que a pessoa já está vendo. */
  const explica = html.length > 400;
  check(`${nome} vazia explica o que fazer`, explica, true);
}

console.log(`\n${ok} passaram, ${fail} falharam`);
process.exit(fail ? 1 : 0);
