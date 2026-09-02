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

const VIEWS = {
  /* As telas de verdade chegam na F1. Até lá cada aba se anuncia pelo que vai
     fazer — um estado vazio que diz o PRÓXIMO PASSO vale mais que um "sem
     dados", que só informa o que a pessoa já vê. */
  lista: () => `
    <h1 class="titulo">Sua lista</h1>
    <p class="sub">Monte a lista antes de sair de casa.</p>
    <div class="card" style="margin-top:var(--e4)">
      <div class="vazio">
        <b>Nenhuma lista ainda</b>
        Comece pela lista da próxima compra: dá para despejar tudo de uma vez,
        sem tirar a mão do teclado.
      </div>
    </div>`,

  mercado: () => `
    <h1 class="titulo">Modo Mercado</h1>
    <p class="sub">O preço é bom? A resposta no corredor.</p>
    <div class="card" style="margin-top:var(--e4)">
      <div class="vazio">
        <b>Você não está em uma compra</b>
        Abra uma lista e toque em “Estou no mercado” para começar.
      </div>
    </div>`,

  historico: () => `
    <h1 class="titulo">Histórico</h1>
    <p class="sub">O que subiu, o que caiu e quanto a sua cesta variou.</p>
    <div class="card" style="margin-top:var(--e4)">
      <div class="vazio">
        <b>Ainda não há compras registradas</b>
        Depois da primeira ida ao mercado, esta tela mostra a evolução de cada
        produto — e quais foram os que mais pesaram.
      </div>
    </div>`,
};

function irPara(aba) {
  if (!VIEWS[aba]) aba = 'lista';
  state.aba = aba;
  const tela = document.getElementById('tela');
  tela.innerHTML = VIEWS[aba]();
  pintarIcones(tela);
  for (const b of document.querySelectorAll('.dock-item')) {
    if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  // Trocar de aba com a página rolada deixaria a nova tela começando no meio.
  window.scrollTo(0, 0);
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
  if (btnAjustes) btnAjustes.addEventListener('click', () => {
    UI.folha(`<h2 class="titulo">Ajustes</h2>
      <p class="sub">A tela de ajustes chega junto com a primeira versão da lista.</p>`);
  });

  /* Gravação que falha é o pior desfecho no meio de uma compra: a pessoa
     continua registrando preços que não estão sendo guardados. Fala alto. */
  window.avisarFalhaDeGravacao = () => {
    UI.toast('Não foi possível salvar neste aparelho. Libere espaço antes de continuar.', 8000);
  };

  pintarIcones(document);
  irPara('lista');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
