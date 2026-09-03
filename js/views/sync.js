/* CESTA — a tela de sincronização. */
'use strict';

/* `aoTerminar` existe para a apresentação: ela precisa CONTINUAR quando a
   sincronização fica pronta, em vez de largar a pessoa na tela onde estava.
   Sem ele, configurar a nuvem no meio do cadastro parecia um beco. */
function abrirSync(opcoes = {}) {
  Sync.load();
  const cfg = Sync.cfg;

  if (!Sync.configurado()) {
    const fechar = UI.folha(`
      <h2 class="sheet-title">Sincronização</h2>
      <p class="sub">Opcional. O app já funciona inteiro sem isto — a
        sincronização serve para usar o mesmo histórico em dois aparelhos.</p>

      <p class="section-title">Como ligar (uma vez, ~10 min)</p>
      <div class="passos">
        <p><b>1.</b> Crie um projeto gratuito em <b>supabase.com</b>.</p>
        <p><b>2.</b> No painel: <b>SQL Editor</b> → cole o conteúdo de
           <code>supabase/schema.sql</code> → <b>Run</b>.</p>
        <p><b>3.</b> Em <b>Settings → API</b>, copie a Project URL e a chave
           <b>anon public</b>, e cole abaixo.</p>
      </div>

      <input  id="sy-url" placeholder="https://xxxx.supabase.co"
             value="${UI.esc(cfg.url || '')}" style="margin-top:var(--e3)">
      <input  id="sy-key" placeholder="chave anon public"
             value="${UI.esc(cfg.anonKey || '')}" style="margin-top:var(--e2)">
      <button class="btn" id="sy-salvar" style="margin-top:var(--e3)">
        Salvar
      </button>
      <p class="sub" style="margin-top:var(--e3)">A chave fica só neste aparelho.
        Ela nunca entra no repositório do app.</p>`);

    document.querySelector('#sy-salvar').addEventListener('click', () => {
      Sync.cfg.url = String(document.querySelector('#sy-url').value || '').trim().replace(/\/$/, '');
      Sync.cfg.anonKey = String(document.querySelector('#sy-key').value || '').trim();
      Sync.saveCfg();
      fechar();
      // Leva a continuação adiante: o próximo passo é a conta
      abrirSync(opcoes);
    });
    return;
  }

  if (!Sync.logado()) {
    const fechar = UI.folha(`
      <h2 class="sheet-title">Entrar</h2>
      <p class="sub">Use a mesma conta nos dois aparelhos.</p>
      <input  id="sy-mail" type="email" placeholder="e-mail"
             autocomplete="email" style="margin-top:var(--e3)">
      <input  id="sy-senha" type="password" placeholder="senha"
             autocomplete="current-password" style="margin-top:var(--e2)">
      <div id="sy-erro" class="sub" style="color:var(--red-ink)"></div>
      <button class="btn" id="sy-entrar" style="margin-top:var(--e3)">Entrar</button>
      <button class="btn ghost" id="sy-criar" style="margin-top:var(--e2)">Criar conta</button>`);

    const tentar = async criar => {
      const mail = document.querySelector('#sy-mail').value.trim();
      const senha = document.querySelector('#sy-senha').value;
      const erro = document.querySelector('#sy-erro');
      erro.textContent = '';
      if (!mail || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }
      try {
        await Sync.entrar(mail, senha, criar);
        fechar();
        /* A CASA É O PASSO QUE FALTAVA. Sem família não há o que sincronizar —
           o RLS do banco filtra por ela — e terminar aqui deixava a pessoa com
           a conta criada, o app mudo, e nenhuma pista do que faltava. */
        if (!Sync.temFamilia()) { abrirFamilia(opcoes); return; }
        const r = await Sync.sincronizar({ agora: true });
        if (opcoes.aoTerminar) opcoes.aoTerminar();
        else irPara('hoje');
      } catch (e) { erro.textContent = e.message; }
    };
    document.querySelector('#sy-entrar').addEventListener('click', () => tentar(false));
    document.querySelector('#sy-criar').addEventListener('click', () => tentar(true));
    return;
  }

  /* Já configurado e vindo da apresentação: não há o que perguntar, segue. */
  if (opcoes.aoTerminar && Sync.temFamilia()) { opcoes.aoTerminar(); return; }

  const fechar = UI.folha(`
    <h2 class="sheet-title">Sincronização</h2>
    <p class="sub">Conectado. ${Sync.pendentes()} ${Sync.pendentes() === 1
      ? 'registro ainda não enviado' : 'registros ainda não enviados'}.</p>
    <p class="sub">Último recebimento: ${DB.data.meta.lastSync
      ? String(DB.data.meta.lastSync).slice(0, 16).replace('T', ' ') : 'nunca'}</p>
    <button class="btn" id="sy-agora" style="margin-top:var(--e3)">
      Sincronizar agora
    </button>
    <button class="btn ghost" id="sy-sair" style="margin-top:var(--e2)">Sair desta conta</button>`);

  document.querySelector('#sy-agora').addEventListener('click', async () => {
    try {
      await Sync.sincronizar({ agora: true });
      fechar();
      if (opcoes.aoTerminar) opcoes.aoTerminar();
    } catch (_) { /* a linha de status já disse o que houve */ }
  });
  document.querySelector('#sy-sair').addEventListener('click', () => {
    Sync.sair(); fechar(); UI.toast('Desconectado deste aparelho');
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirSync };
