/* CESTA — ajustes: orçamento, segurança, família, dados e backup. */
'use strict';

function abrirAjustes() {
  const cfg = DB.cfg() || {};
  const obs = DB.all('price_obs').length;
  const itens = DB.all('items').length;
  const lojas = DB.all('stores').length;

  const fechar = UI.folha(`
    <h2 class="sheet-title">Ajustes</h2>

    <p class="section-title">Orçamento padrão</p>
    <input class="amount-input" id="cfg-orcamento" type="text" inputmode="numeric" autocomplete="off"
           placeholder="R$ 0,00">
    <p class="sub">Vira o limite de cada compra nova, e o app avisa quando o
      carrinho chega perto. Em branco, ele não cobra nada.</p>

    <p class="section-title">Compartilhar</p>
    <button class="btn ghost" id="cfg-familia">
      <span data-ico="compartilhar"></span>
      ${Sync.temFamilia() ? UI.esc(Sync.cfg.family_nome || 'Minha casa') : 'Compartilhar a lista'}
    </button>
    <p class="sub">${Sync.temFamilia()
      ? 'Quem está na casa vê a mesma lista e o mesmo histórico.'
      : 'Divida a lista com quem faz as compras com você.'}</p>

    <p class="section-title">Segurança</p>
    <button class="btn ghost" id="cfg-seguranca">
      <span data-ico="digital"></span>
      ${Auth.ligado() ? 'PIN ativo — gerenciar' : 'Proteger com PIN'}
    </button>
    <p class="sub">${Auth.ligado()
      ? 'Seus dados estão criptografados neste aparelho.'
      : 'Criptografa o histórico no aparelho. Sem o PIN, ninguém lê nada.'}</p>

    <p class="section-title">Seus dados</p>
    <div class="kpi" style="margin-top:0">
      <div><span class="kpi-label">Preços</span><b class="tx-amount">${obs}</b></div>
      <div><span class="kpi-label">Produtos</span><b class="tx-amount">${itens}</b></div>
      <div class="direita"><span class="kpi-label">Mercados</span><b class="tx-amount">${lojas}</b></div>
    </div>

    <button class="btn ghost" id="cfg-importar" style="margin-top:var(--e3)">
      Importar nota fiscal (NFC-e)
    </button>
    <button class="btn ghost" id="cfg-backup" style="margin-top:var(--e2)">
      Baixar backup
    </button>
    <label class="btn ghost" style="margin-top:var(--e2)">
      Restaurar backup
      <input type="file" id="cfg-restaurar" accept=".json" hidden>
    </label>

    <p class="section-title">Sincronização</p>
    <p class="sub">${Sync.logado()
      ? `Conectado · ${Sync.pendentes()} ${Sync.pendentes() === 1 ? 'registro não enviado' : 'registros não enviados'}`
      : 'O app funciona inteiro sem conta e sem internet. A sincronização é opcional.'}</p>
    <button class="btn ghost" id="cfg-sync" style="margin-top:var(--e2)">
      ${Sync.logado() ? 'Gerenciar sincronização' : 'Configurar sincronização'}
    </button>

    <p class="section-title">Sobre</p>
    <button class="btn ghost" id="cfg-ajuda">Ajuda e apresentação</button>

    <button class="btn ghost" id="cfg-apagar" style="margin-top:var(--e5); color:var(--red-ink)">
      Apagar tudo deste aparelho
    </button>`);

  pintarIcones(document.querySelector('.sheet'));

  const campo = document.querySelector('#cfg-orcamento');
  const mascara = UI.mascaraMoeda(campo, cfg.orcamento_padrao);
  campo.addEventListener('input', () => {
    mascara();
    DB.setCfg({ orcamento_padrao: UI.lerMoeda(campo) || null });
  });

  const irPara2 = (fn) => () => { fechar(); fn(); };
  document.querySelector('#cfg-familia').addEventListener('click', irPara2(abrirFamilia));
  document.querySelector('#cfg-seguranca').addEventListener('click', irPara2(abrirSeguranca));
  document.querySelector('#cfg-importar').addEventListener('click', irPara2(abrirImportacao));
  document.querySelector('#cfg-sync').addEventListener('click', irPara2(abrirSync));
  document.querySelector('#cfg-ajuda').addEventListener('click', irPara2(abrirAjuda));

  /* O backup sai como arquivo. Num app local-first ele não é um extra: é a
     única cópia que existe, porque não há servidor guardando nada. */
  document.querySelector('#cfg-backup').addEventListener('click', () => {
    const blob = new Blob([DB.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cesta-backup-${DB.hojeISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    UI.toast('Backup baixado');
  });

  document.querySelector('#cfg-restaurar').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        DB.importJSON(String(leitor.result));
        fechar();
        irPara('lista');
        UI.toast('Backup restaurado');
      } catch (_) { UI.toast('Arquivo de backup inválido'); }
    };
    leitor.readAsText(f);
  });

  /* Apagar tudo é o único lugar do app com confirmação — e ela é dupla, porque
     não há desfazer depois. A regra "sem diálogo" vale para o corredor, onde
     tudo é reversível; aqui não é. */
  document.querySelector('#cfg-apagar').addEventListener('click', () => {
    const f2 = UI.folha(`
      <h2 class="sheet-title">Apagar tudo?</h2>
      <p class="sub">Isto remove ${obs} preços, ${itens} produtos, todas as compras,
        as fotos de etiqueta, o seu PIN e a configuração de sincronização.
        O app volta a ser como no primeiro dia.</p>
      <p class="sub"><b>Não há como desfazer.</b> Se ainda não baixou um backup,
        feche isto e baixe primeiro.</p>
      ${Sync.temFamilia() ? '<p class="sub">O que está na nuvem continua com as outras pessoas da casa.</p>' : ''}
      <button class="btn ghost" id="ap-nao" style="margin-top:var(--e4)">Cancelar</button>
      <button class="btn ghost" id="ap-sim" style="margin-top:var(--e2); color:var(--red-ink)">
        Sim, apagar tudo
      </button>`);
    document.querySelector('#ap-nao').addEventListener('click', f2);
    document.querySelector('#ap-sim').addEventListener('click', () => {
      DB.apagarTudo();
      /* RECARREGA A PÁGINA. Sem isto, o app continua rodando com Sync.cfg, Auth.cfg
         e o estado das telas ainda em memória — apagado no armazenamento e vivo
         na tela, que é o pior dos dois mundos: a próxima gravação ressuscitaria
         parte do que a pessoa acabou de mandar apagar. */
      location.reload();
    });
  });
}

/* ==================================================== SEGURANÇA === */

function abrirSeguranca() {
  Auth.load();
  const ligado = Auth.ligado();

  const fechar = UI.folha(`
    <h2 class="sheet-title">Segurança</h2>
    <p class="sub">O histórico de compras diz onde você faz mercado, quanto
      gasta e o que consome. Num aparelho perdido, isso fica legível para quem
      abrir o navegador — a menos que esteja criptografado.</p>

    ${ligado ? `
      <div class="diag b-green" style="margin-top:var(--e3)">
        <span>🟢 Dados criptografados neste aparelho</span>
      </div>

      <p class="section-title">Digital</p>
      <p class="sub">${Auth.bioAtiva()
        ? 'Ativa. Você entra com a digital, e o PIN continua funcionando como saída.'
        : 'Entre com a digital em vez de digitar o PIN toda vez.'}</p>
      <button class="btn ghost" id="sg-bio" style="margin-top:var(--e2)">
        ${Auth.bioAtiva() ? 'Desativar digital' : 'Ativar digital'}
      </button>

      <p class="section-title">PIN</p>
      <button class="btn ghost" id="sg-trocar">Trocar o PIN</button>
      <button class="btn ghost" id="sg-desligar" style="margin-top:var(--e2); color:var(--red-ink)">
        Desligar a proteção
      </button>
    ` : `
      <p class="section-title">Como funciona</p>
      <div class="passos">
        <p><b>O PIN não é uma senha guardada.</b> Ele gera a chave que abre os
          dados. Não existe "PIN correto" em lugar nenhum do aparelho — o errado
          simplesmente não decifra.</p>
        <p><b>Por isso não há recuperação.</b> Esquecer o PIN significa perder o
          histórico deste aparelho. Baixe um backup antes, ou ligue a
          sincronização.</p>
        <p><b>A digital vem depois</b>, se o aparelho tiver leitor: ela guarda a
          mesma chave, e o PIN fica como saída.</p>
      </div>
      <button class="btn" id="sg-ligar" style="margin-top:var(--e3)">
        Criar PIN
      </button>
    `}
    <p class="sub" id="sg-erro" style="color:var(--red-ink); min-height:20px"></p>`);

  const erro = () => document.querySelector('#sg-erro');

  const ligar = document.querySelector('#sg-ligar');
  if (ligar) ligar.addEventListener('click', () => {
    fechar();
    Bloqueio.criarPin({
      aoTerminar: async pin => {
        await Auth.ativar(pin);
        UI.toast('Pronto. Seus dados estão criptografados neste aparelho.', 5000);
        abrirSeguranca();
      },
    });
  });

  const trocar = document.querySelector('#sg-trocar');
  if (trocar) trocar.addEventListener('click', () => {
    fechar();
    Bloqueio.tecladoPin({
      titulo: 'PIN atual',
      texto: 'Digite o PIN de hoje para poder trocá-lo.',
      aoConfirmar: async (atual, mostrarErro) => {
        const chave = await Auth.derivar(atual, Auth.cfg.salt, true);
        if (!(await Auth.conferir(chave))) { mostrarErro('PIN incorreto.'); return false; }
        Bloqueio.criarPin({
          trocar: true,
          aoTerminar: async novo => {
            await Auth.trocarPin(atual, novo);
            UI.toast(Auth.bioAtiva() ? 'PIN trocado' : 'PIN trocado. Ative a digital de novo se quiser.', 5000);
            abrirSeguranca();
          },
        });
        return true;
      },
    });
  });

  const bio = document.querySelector('#sg-bio');
  if (bio) bio.addEventListener('click', async () => {
    if (Auth.bioAtiva()) {
      Auth.desativarBio();
      fechar(); abrirSeguranca();
      UI.toast('Digital desativada. O PIN continua valendo.');
      return;
    }
    if (!(await Auth.bioSuportada())) {
      erro().textContent = 'Este aparelho não oferece leitor de digital ao navegador.';
      return;
    }
    fechar();
    Bloqueio.tecladoPin({
      titulo: 'Confirme o PIN',
      texto: 'A digital é um atalho para a mesma chave — por isso o PIN vem antes.',
      aoConfirmar: async (pin, mostrarErro) => {
        try {
          await Auth.ativarBio(pin);
          Bloqueio.esconder();
          UI.toast('Digital ativada');
          abrirSeguranca();
          return true;
        } catch (e) { mostrarErro(e.message); return false; }
      },
    });
  });

  const desligar = document.querySelector('#sg-desligar');
  if (desligar) desligar.addEventListener('click', () => {
    fechar();
    Bloqueio.tecladoPin({
      titulo: 'Desligar a proteção',
      texto: 'Digite o PIN. Os dados voltam a ficar legíveis neste aparelho.',
      aoConfirmar: async (pin, mostrarErro) => {
        if (!(await Auth.desativar(pin))) { mostrarErro('PIN incorreto.'); return false; }
        Bloqueio.esconder();
        UI.toast('Proteção desligada');
        abrirSeguranca();
        return true;
      },
    });
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirAjustes, abrirSeguranca };
