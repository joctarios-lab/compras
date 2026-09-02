/* CESTA — ajustes: orçamento, backup e o que mais não cabe no corredor. */
'use strict';

function abrirAjustes() {
  const cfg = DB.cfg() || {};
  const obs = DB.all('price_obs').length;
  const itens = DB.all('items').length;
  const lojas = DB.all('stores').length;

  const fechar = UI.folha(`
    <h2 class="titulo">Ajustes</h2>

    <p class="secao">Orçamento padrão</p>
    <input class="campo campo-preco" id="cfg-orcamento" inputmode="decimal"
           placeholder="R$ 0,00" value="${cfg.orcamento_padrao ? UI.fmt(cfg.orcamento_padrao) : ''}">
    <p class="sub">Vira o limite de cada compra nova. Em branco, o app não cobra nada.</p>

    <p class="secao">Seus dados</p>
    <div class="linha-resumo" style="margin-top:0">
      <div><span class="rotulo">Preços</span><b class="valor">${obs}</b></div>
      <div><span class="rotulo">Itens</span><b class="valor">${itens}</b></div>
      <div class="direita"><span class="rotulo">Mercados</span><b class="valor">${lojas}</b></div>
    </div>

    <button class="btn btn-largo" id="cfg-importar" style="margin-top:var(--e3)">
      Importar nota fiscal (NFC-e)
    </button>
    <button class="btn btn-largo" id="cfg-backup" style="margin-top:var(--e2)">
      Baixar backup
    </button>
    <label class="btn btn-largo" style="margin-top:var(--e2)">
      Restaurar backup
      <input type="file" id="cfg-restaurar" accept=".json" hidden>
    </label>

    <p class="secao">Sincronização</p>
    <p class="sub">O app funciona inteiro sem conta e sem internet. A
      sincronização entre aparelhos é opcional e se configura aqui.</p>
    <button class="btn btn-largo" id="cfg-sync" style="margin-top:var(--e2)">
      Configurar sincronização
    </button>

    <button class="btn btn-largo" id="cfg-apagar" style="margin-top:var(--e5); color:var(--red-ink)">
      Apagar tudo deste aparelho
    </button>`);

  const campo = document.querySelector('#cfg-orcamento');
  const mascara = UI.mascaraMoeda(campo);
  campo.addEventListener('input', () => {
    mascara();
    DB.setCfg({ orcamento_padrao: UI.lerMoeda(campo) || null });
  });

  document.querySelector('#cfg-importar').addEventListener('click', () => { fechar(); abrirImportacao(); });
  document.querySelector('#cfg-sync').addEventListener('click', () => { fechar(); abrirSync(); });

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
     não há desfazer possível depois. A regra "sem diálogo" vale para o corredor,
     onde tudo é reversível; aqui não é. */
  document.querySelector('#cfg-apagar').addEventListener('click', () => {
    const fechar2 = UI.folha(`
      <h2 class="titulo">Apagar tudo?</h2>
      <p class="sub">Isto remove ${obs} preços, ${itens} itens e todas as compras
        deste aparelho. <b>Não há como desfazer.</b> Se ainda não baixou um
        backup, feche isto e baixe primeiro.</p>
      <button class="btn btn-largo btn-grande" id="ap-nao" style="margin-top:var(--e4)">Cancelar</button>
      <button class="btn btn-largo" id="ap-sim" style="margin-top:var(--e2); color:var(--red-ink)">
        Sim, apagar tudo
      </button>`);
    document.querySelector('#ap-nao').addEventListener('click', fechar2);
    document.querySelector('#ap-sim').addEventListener('click', () => {
      DB.apagarTudo();
      fechar2(); fechar();
      irPara('lista');
      UI.toast('Tudo apagado deste aparelho');
    });
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirAjustes };
