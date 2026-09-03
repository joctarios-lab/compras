/* CESTA — roteamento e boot.

   Este arquivo liga o app, troca de aba e registra o service worker. As telas
   moram em js/views/*.js — o app.js do DOMI chegou a 607 KB por não ter tido
   essa regra desde o começo, e mexer nele ficou caro. Teto: 1.500 linhas. */
'use strict';

const state = {
  aba: 'hoje',
};

/* ----------------------------------------------------------------- tema --- */

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

/* CINCO ABAS. Mercado não é aba fixa: ele só existe quando há compra em
   curso, e ocupar o lugar mais valioso da tela com "você não está comprando"
   seria desperdiçá-lo. Lista vive dentro de PLANEJAR; histórico e produtos,
   dentro de ANÁLISE. */
const ABAS = ['hoje', 'planejar', 'mercado', 'despensa', 'analise', 'lista'];

function irPara(aba) {
  if (!ABAS.includes(aba)) aba = 'hoje';

  /* Sair do Modo Mercado por outra aba tem de DESLIGAR o modo: senão a classe no
     body sobrevive, o alvo de toque continua grande na tela errada e o wakeLock
     segue segurando a tela acesa com o app no bolso. */
  if (state.aba === 'mercado' && aba !== 'mercado') Mercado.fechar();

  state.aba = aba;
  const tela = document.getElementById('tela');
  const recarregar = () => irPara(aba);

  if (aba === 'hoje') {
    tela.innerHTML = ViewHoje.render();
    ViewHoje.ligar(tela);
  } else if (aba === 'planejar') {
    tela.innerHTML = ViewPlanejar.render();
    ViewPlanejar.ligar(tela);
  } else if (aba === 'despensa') {
    tela.innerHTML = ViewDespensa.render();
    ViewDespensa.ligar(tela);
  } else if (aba === 'analise') {
    tela.innerHTML = ViewAnalise.render();
    ViewAnalise.ligar(tela);
  } else if (aba === 'lista') {
    tela.innerHTML = ViewLista.render();
    ViewLista.ligar(tela, recarregar);
  } else if (aba === 'mercado') {
    const lista = DB.listaEmCurso();
    if (!lista) {
      tela.innerHTML = `<h1 class="titulo">Modo Mercado</h1>
        <p class="sub">É aqui que o app responde se o preço está bom.</p>
        <div class="card"><div class="ui-empty">
          <b>Você não está numa compra</b>
          Monte a lista e toque em “Estou no mercado”. A partir daí é só ir
          digitando os preços das etiquetas.
        </div>
        <button class="btn" id="ir-lista">Ir para a lista</button></div>`;
      const b = tela.querySelector('#ir-lista');
      if (b) b.addEventListener('click', () => irPara('lista'));
    } else {
      Mercado.listaId = lista.id;
      document.body.classList.add('modo-mercado');
      tela.innerHTML = Mercado.render();
      Mercado.ligar(tela, recarregar);
    }
  }

  pintarIcones(tela);
  /* Os componentes do DOMI valem nas telas tambem, nao so nas folhas: a busca
     de produtos e os filtros de analise vivem fora de folha. */
  if (typeof UIForm !== 'undefined' && UIForm.enhance) {
    try { UIForm.enhance(tela); } catch (_) {}
  }
  for (const b of document.querySelectorAll('.tab, .side-item[data-aba]')) {
    if (b.dataset.aba === aba) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}

/* Entrar no Modo Mercado: escolhe a loja antes, porque preço sem loja é um
   número que não se consegue explicar depois. */
function abrirMercado(listaId) {
  const lista = (listaId && DB.get('lists', listaId)) || DB.listaEmCurso() || DB.listasPlanejadas()[0];
  if (!lista) { UI.toast('Monte a lista primeiro'); return; }
  if (lista.store_id) { entrarNoMercado(lista); return; }

  const lojas = DB.all('stores');
  const fechar = UI.folha(`
    <h2 class="titulo">Em qual mercado você está?</h2>
    <p class="sub">O preço só significa alguma coisa junto com o lugar — é o que
      permite o app dizer depois onde sua cesta sai mais barata.</p>
    ${lojas.length ? `<div class="lojas">${lojas.map(l =>
      `<button class="btn btn-vazado loja-op" data-loja="${l.id}">${UI.esc(l.nome)}</button>`).join('')}</div>
      <p class="section-title">Ou um novo</p>` : ''}
    <input  id="nova-loja" placeholder="Nome do mercado" autocomplete="off"
           enterkeyhint="done" style="margin-top:var(--e2)">
    <button class="btn" id="ok-loja" style="margin-top:var(--e2)">
      Começar a comprar
    </button>`);

  const comecar = idLoja => {
    DB.upsert('lists', { id: lista.id, store_id: idLoja });
    fechar();
    entrarNoMercado(DB.get('lists', lista.id));
  };
  for (const b of document.querySelectorAll('.loja-op')) {
    b.addEventListener('click', () => comecar(b.dataset.loja));
  }
  const campo = document.querySelector('#nova-loja');
  const criar = () => {
    const nome = String(campo.value || '').trim();
    if (!nome) { UI.toast('Diga o nome do mercado'); return; }
    comecar(DB.upsert('stores', { nome }).id);
  };
  document.querySelector('#ok-loja').addEventListener('click', criar);
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); criar(); } });
}

async function entrarNoMercado(lista) {
  await Mercado.abrir(lista);
  irPara('mercado');
}

/* ----------------------------------------------------------------- boot --- */

function ligarNavegacao() {
  for (const b of document.querySelectorAll('.tab, .side-item[data-aba]')) {
    b.addEventListener('click', () => irPara(b.dataset.aba));
  }

  const btnTema = document.getElementById('btn-tema');
  if (btnTema) btnTema.addEventListener('click', () => {
    const novo = proximoTema(temaAtual());
    aplicarTema(novo);
    UI.toast(novo === 'auto' ? 'Tema: segue o sistema' : novo === 'dark' ? 'Tema escuro' : 'Tema claro');
  });

  for (const id of ['btn-ajustes', 'side-ajustes']) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', abrirAjustes);
  }
  for (const id of ['btn-ajuda', 'side-ajuda']) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', abrirAjuda);
  }
}

/* ==================================== O INDICADOR DE SINCRONIA ===

   Duas peças com papéis diferentes: o PONTO responde "estou em dia?" de relance
   e o TEXTO responde "o que acabou de acontecer?". O botão que os carrega é uma
   ação — tocar sincroniza agora —, porque um indicador que só avisa obriga a
   pessoa a ir procurar onde se resolve o problema que ele anunciou. */
function ligarIndicadorDeSync() {
  const btn = document.getElementById('btn-sync');
  const linha = document.getElementById('sync-status');
  if (!btn || !linha) return;

  /* O ponto. 'ok' e 'off' não acendem nada: nos dois casos não há o que
     resolver agora, e um indicador permanente de "nada acontecendo" é ruído. */
  Sync.onState = (estado, pendentes) => {
    btn.hidden = estado === 'off';
    const acende = { sync: 'sync', pendente: 'pendente', offline: 'offline', erro: 'erro' }[estado];
    if (acende) btn.dataset.sync = acende;
    else delete btn.dataset.sync;

    /* A COR NUNCA INFORMA SOZINHA: o mesmo estado, em palavras, para quem passa
       o mouse e para leitor de tela. E as palavras dizem que NADA SE PERDEU,
       porque é verdade — o que não subiu continua guardado aqui. */
    const dito = {
      ok: 'Tudo sincronizado',
      sync: 'Sincronizando…',
      pendente: `${pendentes} ${pendentes === 1 ? 'alteração aguardando' : 'alterações aguardando'} envio`,
      offline: `Sem conexão · ${pendentes} ${pendentes === 1 ? 'alteração guardada' : 'alterações guardadas'} aqui`,
      erro: 'A última tentativa falhou — nada se perdeu',
      off: 'Sincronização não configurada',
    }[estado] || '';
    btn.title = dito ? `Sincronizar agora · ${dito}` : 'Sincronizar agora';
    btn.setAttribute('aria-label', dito || 'Sincronizar agora');
  };

  /* O texto: aparece, diz, e some. Erro fica mais tempo na tela porque exige
     leitura, não só um relance. */
  Sync.onStatus = (msg, ok = true) => {
    linha.textContent = msg;
    linha.hidden = false;
    linha.classList.toggle('err', !ok);
    clearTimeout(linha._t);
    linha._t = setTimeout(() => { linha.hidden = true; }, ok ? 2500 : 6000);
  };

  /* Chegou coisa do outro aparelho: a tela se refaz sozinha — mas NUNCA com uma
     folha aberta, senão o que a pessoa está digitando some no meio da frase. */
  Sync.onChanged = () => {
    if (document.querySelector('.sheet-backdrop')) return;
    irPara(state.aba);
  };

  /* TOCAR SINCRONIZA AGORA. `agora: true` não desiste por estar offline: tenta,
     e o erro vira mensagem em vez de silêncio. */
  btn.addEventListener('click', () => {
    Sync.sincronizar({ agora: true }).catch(() => {});
  });

  Sync.avisarEstado();
}

/* Mostra na sidebar quem está usando e com quem a lista é dividida. Sem isso, o
   app compartilhado não dá nenhum sinal de que é compartilhado. */
function pintarIdentidade() {
  const el = document.getElementById('side-familia');
  if (!el) return;
  const cfg = DB.cfg();
  const nome = cfg && cfg.familia_nome;
  el.textContent = nome ? nome : (Sync.logado() ? 'Sincronizado' : 'Suas compras');
}

function abrirApp() {
  DB.load();
  UI.ligarTeclado();
  Sync.load();
  ligarNavegacao();
  pintarIdentidade();
  pintarIcones(document);

  /* Gravação que falha é o pior desfecho no meio de uma compra: a pessoa
     continua registrando preços que não estão sendo guardados. Fala alto. */
  window.avisarFalhaDeGravacao = () => {
    UI.toast('Não foi possível salvar neste aparelho. Libere espaço antes de continuar.', 8000);
  };

  /* A PRIMEIRA VEZ É A APRESENTAÇÃO. Sem isto, quem abre encontra um campo
     ui-empty e três abas, sem saber o que o app faz nem por onde começar — e
     fecha. Foi o que aconteceu no primeiro teste real. */
  if (Onboarding.precisaConfigurar()) {
    Onboarding.abrir();
  } else {
    // Abre onde a pessoa parou: quem está no meio de uma compra volta ao corredor
    irPara(DB.listaEmCurso() ? 'mercado' : 'hoje');
  }

  ligarIndicadorDeSync();
  /* A sincronização automática cuida de si: ao abrir, ao voltar do bolso e ao
     voltar a conexão. Nenhuma delas segura a tela — o app desenha primeiro e
     conversa com a rede depois. */
  Sync.ligarAutomatico();

  /* O app avisa que montou: o tratador de erro do shell usa isto para não
     mostrar a tela de recuperação por um erro qualquer DEPOIS de o app já estar
     de pé — ali o erro é de uma tela, não do carregamento. */
  document.body.dataset.montado = '1';

  /* O registro do service worker mora no index.html, num script inline: ele
     precisa rodar mesmo quando este arquivo não carrega. Duplicar aqui criaria
     dois ouvintes de controllerchange — e dois reloads. */

}

function boot() {
  /* O BLOQUEIO VEM ANTES DE TUDO. Desenhar o app e só depois pedir o PIN
     mostraria os dados por um quadro — e um quadro basta para uma foto. */
  Auth.iniciar(abrirApp);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
