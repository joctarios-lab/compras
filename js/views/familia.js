/* CESTA — a família: quem divide a lista e as compras da casa.

   O GANHO CONCRETO, e não a funcionalidade em si: duas pessoas no mesmo mercado,
   uma no hortifrúti e outra na limpeza, riscando itens da MESMA lista sem pegar
   a mesma coisa duas vezes. E, mais importante, o histórico de preços passa a
   ser da casa — quem vai ao mercado hoje vê o diagnóstico construído pelas
   compras de quem foi na semana passada.

   Por isso o escopo do banco é familiar, e não pessoal: um histórico pessoal
   deixaria metade da casa sem o veredito que o app existe para dar. */
'use strict';

function abrirFamilia(opcoes = {}) {
  Sync.load();

  if (!Sync.configurado() || !Sync.logado()) {
    UI.folha(`
      <h2 class="titulo">Compartilhar a lista</h2>
      <p class="sub">Para dividir a lista com outra pessoa, o app precisa de um
        lugar onde os dois aparelhos se encontrem — a sincronização.</p>
      <p class="sub">Ela é opcional: sem ela o app funciona inteiro, só que num
        aparelho só.</p>
      <button class="btn" id="fam-sync" style="margin-top:var(--e4)">
        Configurar sincronização
      </button>`);
    document.querySelector('#fam-sync').addEventListener('click', () => {
      document.querySelector('.sheet-backdrop').remove();
      abrirSync();
    });
    return;
  }

  if (!Sync.temFamilia()) { telaCriarOuEntrar(opcoes); return; }
  if (opcoes.aoTerminar) { opcoes.aoTerminar(); return; }
  telaDaFamilia();
}

/* Primeira vez: criar a casa ou entrar na de alguém. As duas opções aparecem
   lado a lado porque quem recebeu um código não pode ter de procurar onde
   digitá-lo. */
function telaCriarOuEntrar(opcoes = {}) {
  const fechar = UI.folha(`
    <h2 class="titulo">Compartilhar a lista</h2>
    <p class="sub">Quem divide as compras vê a mesma lista, e o histórico de
      preços passa a ser da casa inteira.</p>

    <p class="section-title">Começar uma casa</p>
    <input  id="fam-nome" placeholder="Nome da casa (ex.: Família Silva)"
           autocomplete="off">
    <input  id="fam-eu" placeholder="Seu nome" autocomplete="given-name"
           style="margin-top:var(--e2)" value="${UI.esc(Sync.meuNome() === 'Eu' ? '' : Sync.meuNome())}">
    <button class="btn" id="fam-criar" style="margin-top:var(--e2)">
      Criar e convidar depois
    </button>

    <p class="section-title">Ou entrar numa que já existe</p>
    <p class="sub">Peça o código de seis letras a quem já usa.</p>
    <input  id="fam-codigo" placeholder="Código (ex.: BQTM49)"
           autocomplete="off" maxlength="8"
           style="margin-top:var(--e2); text-transform:uppercase; letter-spacing:3px; font-family:var(--font-num)">
    <input  id="fam-eu2" placeholder="Seu nome" autocomplete="given-name"
           style="margin-top:var(--e2)">
    <button class="btn btn-vazado" id="fam-entrar" style="margin-top:var(--e2)">
      Entrar na casa
    </button>

    <p class="sub" id="fam-erro" style="color:var(--red-ink); min-height:20px"></p>`);

  const erro = document.querySelector('#fam-erro');

  document.querySelector('#fam-criar').addEventListener('click', async () => {
    const nome = document.querySelector('#fam-nome').value.trim();
    const eu = document.querySelector('#fam-eu').value.trim();
    if (!eu) { erro.textContent = 'Diga o seu nome — é como as outras pessoas vão te ver.'; return; }
    erro.textContent = '';
    try {
      await Sync.criarFamilia(nome || 'Minha casa', eu);
      fechar();
      pintarIdentidade();
      UI.toast('Casa criada. Agora é só convidar.');
      if (opcoes.aoTerminar) opcoes.aoTerminar();
      else abrirFamilia();
    } catch (e) { erro.textContent = e.message; }
  });

  document.querySelector('#fam-entrar').addEventListener('click', async () => {
    const codigo = document.querySelector('#fam-codigo').value.trim();
    const eu = document.querySelector('#fam-eu2').value.trim();
    if (!codigo) { erro.textContent = 'Digite o código de seis letras.'; return; }
    if (!eu) { erro.textContent = 'Diga o seu nome.'; return; }
    erro.textContent = '';
    try {
      await Sync.entrarPorCodigo(codigo, eu);
      const r = await Sync.sincronizar({ agora: true });
      fechar();
      pintarIdentidade();
      UI.toast(r ? `Entrou na casa · ${r.recebidos} itens recebidos` : 'Entrou na casa');
      if (opcoes.aoTerminar) opcoes.aoTerminar();
      else irPara('hoje');
    } catch (e) { erro.textContent = e.message; }
  });
}

async function telaDaFamilia() {
  const cfg = Sync.cfg;
  const fechar = UI.folha(`
    <h2 class="titulo">${UI.esc(cfg.family_nome || 'Minha casa')}</h2>
    <p class="sub">Todos aqui veem a mesma lista e o mesmo histórico de preços.</p>

    <p class="section-title">Convidar alguém</p>
    <p class="sub">Peça para a pessoa instalar o CESTA, ir em
      <b>Ajustes → Compartilhar a lista</b> e digitar este código:</p>
    <div class="codigo-familia" id="fam-cod">${UI.esc(cfg.family_codigo || '—')}</div>
    <button class="btn btn-vazado" id="fam-copiar">Copiar código</button>
    <button class="btn btn-vazado" id="fam-convite" style="margin-top:var(--e2)">
      Enviar convite
    </button>

    <p class="section-title">Quem está na casa</p>
    <div id="fam-membros"><p class="sub">Carregando…</p></div>

    <button class="btn btn-vazado" id="fam-sair" style="margin-top:var(--e5); color:var(--red-ink)">
      Sair desta casa
    </button>`);

  document.querySelector('#fam-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cfg.family_codigo); UI.toast('Código copiado'); }
    catch (_) { UI.toast('Copie o código da tela'); }
  });

  /* O convite vai como TEXTO com o passo a passo, não só o código: "BQTM49"
     sozinho não diz a ninguém o que fazer com aquilo. */
  document.querySelector('#fam-convite').addEventListener('click', async () => {
    const texto = `Vamos dividir a lista de compras no CESTA?\n\n` +
      `1. Abra o app\n2. Ajustes → Compartilhar a lista\n` +
      `3. Digite o código: ${cfg.family_codigo}\n\n` +
      `Aí a gente vê a mesma lista no mercado.`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else { await navigator.clipboard.writeText(texto); UI.toast('Convite copiado — é só colar'); }
    } catch (_) {}
  });

  document.querySelector('#fam-sair').addEventListener('click', () => {
    const f2 = UI.folha(`
      <h2 class="titulo">Sair da casa?</h2>
      <p class="sub">Este aparelho para de receber e enviar mudanças. O que já
        está aqui continua, e o que está na nuvem continua com as outras
        pessoas. Dá para entrar de novo com o mesmo código.</p>
      <button class="btn btn-vazado" id="sair-nao" style="margin-top:var(--e4)">Cancelar</button>
      <button class="btn btn-vazado" id="sair-sim" style="margin-top:var(--e2); color:var(--red-ink)">
        Sair da casa
      </button>`);
    document.querySelector('#sair-nao').addEventListener('click', f2);
    document.querySelector('#sair-sim').addEventListener('click', () => {
      Sync.sairDaFamilia();
      f2(); fechar();
      pintarIdentidade();
      UI.toast('Você saiu da casa');
    });
  });

  const caixa = document.querySelector('#fam-membros');
  try {
    const membros = await Sync.membros();
    caixa.innerHTML = membros.length
      ? membros.map(m => `<div class="membro">
          <span class="membro-avatar">${UI.esc(String(m.nome || '?').trim().charAt(0).toUpperCase())}</span>
          <div class="item-corpo">
            <b>${UI.esc(m.nome)}${m.user_id === Sync.cfg.user_id ? ' (você)' : ''}</b>
            <span class="sub">desde ${String(m.entrou_em || '').slice(0, 10).split('-').reverse().join('/')}</span>
          </div>
        </div>`).join('')
      : '<p class="sub">Ninguém ainda. Envie o convite acima.</p>';
  } catch (_) {
    caixa.innerHTML = '<p class="sub">Não consegui carregar agora — sem conexão.</p>';
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirFamilia };
