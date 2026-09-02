/* CESTA — roteamento e boot.

   Este arquivo faz três coisas e só três: liga o app, troca de aba e registra o
   service worker. As telas moram em js/views/*.js — o app.js do DOMI chegou a
   607 KB por não ter tido essa regra desde o começo, e mexer nele ficou caro.
   Teto deste projeto: 1.500 linhas por arquivo. */
'use strict';

const state = {
  aba: 'lista',
};

/* ----------------------------------------------------------------- tema --- */

/* auto → dark → light → auto. "Auto" existe e é o padrão: quem não escolheu
   nada segue o sistema, e trocar o tema do celular à noite deve levar o app
   junto sem ninguém precisar vir aqui. */
function proximoTema(atual) {
  return atual === 'auto' ? 'dark' : atual === 'dark' ? 'light' : 'auto';
}

function aplicarTema(tema) {
  if (tema === 'dark' || tema === 'light') document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('cesta.tema', tema); } catch (_) {}
}

function temaAtual() {
  try { return localStorage.getItem('cesta.tema') || 'auto'; } catch (_) { return 'auto'; }
}

/* ----------------------------------------------------------------- abas --- */

function irPara(aba) {
  const abas = ['lista', 'mercado', 'historico'];
  if (!abas.includes(aba)) aba = 'lista';

  /* Sair do Modo Mercado por outra aba tem de DESLIGAR o modo: senão a classe
     no body sobrevive, o alvo de toque continua grande na tela errada e o
     wakeLock segue segurando a tela acesa com o app no bolso. */
  if (state.aba === 'mercado' && aba !== 'mercado') Mercado.fechar();

  state.aba = aba;
  const tela = document.getElementById('tela');
  const recarregar = () => irPara(aba);

  if (aba === 'lista') {
    tela.innerHTML = ViewLista.render();
    ViewLista.ligar(tela, recarregar);
  } else if (aba === 'mercado') {
    const lista = DB.listaEmCurso();
    if (!lista) {
      tela.innerHTML = `<h1 class="titulo">Modo Mercado</h1>
        <p class="sub">O preço é bom? A resposta no corredor.</p>
        <div class="card"><div class="vazio">
          <b>Você não está em uma compra</b>
          Monte a lista e toque em “Estou no mercado” para começar.
        </div>
        <button class="btn btn-principal btn-largo btn-grande" id="ir-lista">Ir para a lista</button></div>`;
      const b = tela.querySelector('#ir-lista');
      if (b) b.addEventListener('click', () => irPara('lista'));
    } else {
      Mercado.listaId = lista.id;
      document.body.classList.add('modo-mercado');
      tela.innerHTML = Mercado.render();
      Mercado.ligar(tela, recarregar);
    }
  } else {
    tela.innerHTML = ViewHistorico.render();
    ViewHistorico.ligar(tela);
  }

  pintarIcones(tela);
  for (const b of document.querySelectorAll('.dock-item')) {
    if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}

/* Entrar no Modo Mercado a partir da lista: escolhe a loja antes, porque preço
   sem loja é um número que não se pode explicar depois. */
function abrirMercado() {
  let lista = DB.listaEmCurso() || DB.listasPlanejadas()[0];
  if (!lista) { UI.toast('Monte a lista primeiro'); return; }
  if (lista.store_id) { entrarNoMercado(lista); return; }

  const lojas = DB.all('stores');
  const fechar = UI.folha(`
    <h2 class="titulo">Onde você está?</h2>
    <p class="sub">O preço só significa alguma coisa junto com o lugar.</p>
    ${lojas.length ? `<div class="lojas">${lojas.map(l =>
      `<button class="btn btn-largo btn-grande loja-op" data-loja="${l.id}">${UI.esc(l.nome)}</button>`).join('')}</div>` : ''}
    <input class="campo" id="nova-loja" placeholder="Nome do mercado" autocomplete="off"
           enterkeyhint="done" style="margin-top:var(--e3)">
    <button class="btn btn-principal btn-largo btn-grande" id="ok-loja" style="margin-top:var(--e2)">Começar</button>`);

  const começar = idLoja => {
    DB.upsert('lists', { id: lista.id, store_id: idLoja });
    fechar();
    entrarNoMercado(DB.get('lists', lista.id));
  };
  for (const b of document.querySelectorAll('.loja-op')) {
    b.addEventListener('click', () => começar(b.dataset.loja));
  }
  const campo = document.querySelector('#nova-loja');
  const criar = () => {
    const nome = String(campo.value || '').trim();
    if (!nome) { UI.toast('Diga o nome do mercado'); return; }
    começar(DB.upsert('stores', { nome }).id);
  };
  document.querySelector('#ok-loja').addEventListener('click', criar);
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); criar(); } });
}

async function entrarNoMercado(lista) {
  await Mercado.abrir(lista);
  irPara('mercado');
}

/* ----------------------------------------------------------------- boot --- */

function boot() {
  DB.load();
  UI.ligarTeclado();

  for (const b of document.querySelectorAll('.dock-item')) {
    b.addEventListener('click', () => irPara(b.dataset.aba));
  }

  const btnTema = document.getElementById('btn-tema');
  if (btnTema) btnTema.addEventListener('click', () => {
    const novo = proximoTema(temaAtual());
    aplicarTema(novo);
    UI.toast(novo === 'auto' ? 'Tema: segue o sistema' : novo === 'dark' ? 'Tema escuro' : 'Tema claro');
  });

  const btnAjustes = document.getElementById('btn-ajustes');
  if (btnAjustes) btnAjustes.addEventListener('click', abrirAjustes);

  /* Gravação que falha é o pior desfecho no meio de uma compra: a pessoa
     continua registrando preços que não estão sendo guardados. Fala alto. */
  window.avisarFalhaDeGravacao = () => {
    UI.toast('Não foi possível salvar neste aparelho. Libere espaço antes de continuar.', 8000);
  };

  pintarIcones(document);
  /* Abre onde a pessoa parou: quem está no meio de uma compra volta ao corredor,
     não à tela de montar lista. */
  irPara(DB.listaEmCurso() ? 'mercado' : 'lista');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
