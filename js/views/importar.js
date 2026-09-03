/* CESTA — a tela de importação de NFC-e: o arquivo entra, a pessoa confere. */
'use strict';

let _notaEmRevisao = null;
let _linhasEmRevisao = null;
let _lojaEmRevisao = null;

function abrirImportacao() {
  UI.folha(`
    <h2 class="titulo">Importar nota fiscal</h2>
    <p class="sub">Enche o seu histórico de uma vez, em vez de esperar meses de uso.</p>

    <div class="passos">
      <p><b>1.</b> Abra a nota no portal do seu estado — pelo QR Code do cupom ou
         digitando a chave de 44 dígitos.</p>
      <p><b>2.</b> Baixe ou salve o que o portal oferecer: <b>PDF</b>, <b>XML</b>
         ou a página salva. Os três funcionam.</p>
      <p><b>3.</b> Escolha o arquivo aqui embaixo.</p>
    </div>

    <p class="sub nota-cors">O app não consulta o portal sozinho: cada estado tem
      um site diferente, vários pedem captcha e o navegador bloqueia a leitura de
      outro domínio. Por isso é o arquivo que entra — e assim funciona offline.
      Em vários estados, como o Rio Grande do Norte, o PDF é o <b>único</b>
      formato oferecido; ele é lido aqui mesmo, sem enviar nada para lugar
      nenhum.</p>

    <input type="file" id="arq-nfce" accept=".pdf,.xml,.html,.htm,.csv,.txt,application/pdf,text/*"
           style="margin-top:var(--e4)">
    <div id="imp-resultado" style="margin-top:var(--e3)"></div>`);

  const arq = document.querySelector('#arq-nfce');
  const area = document.querySelector('#imp-resultado');

  arq.addEventListener('change', async () => {
    const f = arq.files && arq.files[0];
    if (!f) return;

    /* O PDF é lido como BYTES e descomprimido antes de virar texto — é trabalho
       de outra natureza, e por isso mora em js/pdf.js. Daqui em diante todos os
       formatos seguem o mesmo caminho. */
    const ehPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    if (ehPdf) {
      area.innerHTML = '<p class="sub">Lendo o PDF…</p>';
      const r = await PDF.texto(f);
      if (r.erro) {
        area.innerHTML = `<div class="diag b-red"><span>🔴 ${
          r.erro === 'sem_texto' ? 'Este PDF é uma imagem'
          : r.erro === 'sem_suporte' ? 'Este navegador não abre PDF'
          : 'Não consegui ler este PDF'}</span></div>
          <p class="diag-nota">${
            r.erro === 'sem_texto'
              ? 'Ele foi escaneado ou gerado como foto, e não tem texto para extrair. Baixe o PDF direto do portal da nota, ou use o XML.'
              : r.erro === 'sem_suporte'
              ? 'Atualize o navegador, ou traga a nota em XML, HTML salvo ou planilha.'
              : 'Tente baixar o arquivo de novo pelo portal.'}</p>`;
        return;
      }
      processar(NFCe.ler(r.texto, f.name));
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => {
      processar(NFCe.ler(String(leitor.result || ''), f.name));
    };
    leitor.readAsText(f, 'utf-8');
  });

  /* Daqui para baixo é igual para todos os formatos: o parser já entregou a
     estrutura canônica, e o resto do caminho é um só. */
  function processar(nota) {
    {
      if (!nota) {
        area.innerHTML = `<div class="diag b-red"><span>🔴 Não consegui ler este arquivo</span></div>
          <p class="diag-nota">Tente salvar a página completa da nota, ou exporte
          uma planilha com as colunas <b>descrição, quantidade, unidade e valor</b>.</p>`;
        return;
      }
      if (Importar.jaImportada(nota.chave)) {
        area.innerHTML = `<div class="diag b-amber"><span>🟡 Esta nota já foi importada</span></div>
          <p class="diag-nota">Nada foi duplicado — a chave de acesso já está no seu histórico.</p>`;
        return;
      }
      _notaEmRevisao = nota;
      _lojaEmRevisao = Importar.lojaDaNota(nota);
      _linhasEmRevisao = Importar.preparar(nota, _lojaEmRevisao ? _lojaEmRevisao.id : null);
      abrirRevisao();
    }
  }
}

/* A TELA DE REVISÃO. O casamento por texto SUGERE; quem aplica é a pessoa.
   Vem marcado só o que tem identidade exata (EAN) ou já foi confirmado antes. */
function abrirRevisao() {
  const nota = _notaEmRevisao;
  const linhas = _linhasEmRevisao;
  const marcadas = linhas.filter(l => l.incluir).length;
  const comProblema = linhas.filter(l => l.problema).length;

  const fechar = UI.folha(`
    <h2 class="titulo">Conferir antes de importar</h2>
    <p class="sub">
      ${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'}${
        nota.data ? ' · ' + nota.data.split('-').reverse().join('/') : ''}${
        _lojaEmRevisao ? ' · ' + UI.esc(_lojaEmRevisao.nome) : ''}
    </p>

    <div class="linha-resumo">
      <div><span class="rotulo">Vão entrar</span><b class="valor grande" id="imp-conta">${marcadas}</b></div>
      <button class="btn" id="imp-todos">Marcar todos</button>
    </div>

    ${comProblema ? `<p class="sub aviso-fora">${comProblema} ${comProblema === 1
      ? 'item ficou de fora: unidade que não sei converter'
      : 'itens ficaram de fora: unidade que não sei converter'}. Um palpite aqui
      estragaria a média daquele produto para sempre.</p>` : ''}

    <div class="revisao">
      ${linhas.map(l => linhaDeRevisao(l)).join('')}
    </div>

    <button class="btn" id="imp-ok" style="margin-top:var(--e4)">
      Importar os marcados
    </button>`);

  const atualizarConta = () => {
    const n = _linhasEmRevisao.filter(l => l.incluir).length;
    const el = document.querySelector('#imp-conta');
    if (el) el.textContent = n;
  };

  for (const cb of document.querySelectorAll('.rev-check')) {
    cb.addEventListener('change', () => {
      const l = _linhasEmRevisao[Number(cb.dataset.i)];
      l.incluir = cb.checked;
      atualizarConta();
    });
  }

  document.querySelector('#imp-todos').addEventListener('click', () => {
    const ligar = _linhasEmRevisao.some(l => !l.incluir && !l.problema);
    for (const l of _linhasEmRevisao) if (!l.problema) l.incluir = ligar;
    for (const cb of document.querySelectorAll('.rev-check')) {
      const l = _linhasEmRevisao[Number(cb.dataset.i)];
      cb.checked = !!l.incluir;
    }
    atualizarConta();
  });

  document.querySelector('#imp-ok').addEventListener('click', () => {
    const r = Importar.gravar(nota, _linhasEmRevisao, _lojaEmRevisao ? _lojaEmRevisao.id : null);
    fechar();
    if (r.erro === 'ja_importada') { UI.toast('Esta nota já estava no histórico'); return; }
    UI.toast(`${r.gravadas} ${r.gravadas === 1 ? 'preço importado' : 'preços importados'}` +
      (r.ignoradas ? ` · ${r.ignoradas} de fora` : ''), 5000);
    _notaEmRevisao = _linhasEmRevisao = _lojaEmRevisao = null;
    irPara('historico');
  });
}

function linhaDeRevisao(l) {
  const selo = l.problema ? 'b-slate'
    : l.confianca === 'ean' ? 'b-green'
    : l.confianca === 'aprendido' ? 'b-blue'
    : l.confianca === 'nome' ? 'b-amber' : 'b-slate';
  const rotulo = l.problema ? l.problema
    : l.confianca === 'ean' ? 'código de barras'
    : l.confianca === 'aprendido' ? 'já vinculado antes'
    : l.confianca === 'nome' ? 'nome parecido — confira'
    : 'produto novo';

  return `<label class="rev-linha ${l.problema ? 'com-problema' : ''}">
    <input type="checkbox" class="rev-check" data-i="${l.i}"
           ${l.incluir ? 'checked' : ''} ${l.problema ? 'disabled' : ''}>
    <div class="rev-corpo">
      <b>${UI.esc(l.descricao)}</b>
      <span class="sub">
        ${l.qtd != null && l.unidade ? `${Number(l.qtd.toFixed(3))} ${l.unidade}` : `${l.qtdNota || '?'} ${UI.esc(l.unidadeNota || '?')}`}
        ${l.valorTotal != null ? ' · ' + UI.fmt(l.valorTotal) : ''}
        ${l.qtd && l.unidade && l.valorTotal ? ' · ' + UI.fmtBase(l.valorTotal / l.qtd, l.unidade) : ''}
      </span>
    </div>
    <span class="badge ${selo}">${rotulo}</span>
  </label>`;
}

/* ================================================== ONDE SAI MAIS BARATO === */

/* A comparação entre lojas usa CESTA FECHADA, como a inflação pessoal: só
   entram produtos observados nas duas lojas. Comparar o total gasto em cada
   mercado responderia "onde eu gastei mais", que não é a mesma pergunta —
   quem vai ao atacado uma vez por mês gasta mais lá e paga menos por quilo. */
function abrirEntreLojas() {
  const lojas = DB.all('stores');
  if (lojas.length < 2) {
    UI.folha(`<h2 class="titulo">Onde sai mais barato</h2>
      <p class="sub">É preciso ter registrado preços em pelo menos dois mercados.
        Hoje há ${lojas.length}.</p>`);
    return;
  }

  const porLoja = {};
  for (const o of DB.all('price_obs')) {
    if (!o.store_id || !o.product_id || !isFinite(o.preco_base)) continue;
    ((porLoja[o.store_id] || (porLoja[o.store_id] = {}))[o.product_id] ||= []).push(o.preco_base);
  }

  const ids = Object.keys(porLoja);
  const comuns = ids.length
    ? Object.keys(porLoja[ids[0]]).filter(pid => ids.every(id => porLoja[id][pid]))
    : [];

  if (comuns.length < 2) {
    UI.folha(`<h2 class="titulo">Onde sai mais barato</h2>
      <p class="sub">Ainda não há produtos suficientes comprados nos mesmos mercados
        para uma comparação honesta. Foram encontrados ${comuns.length}.</p>
      <p class="sub">Comparar o total gasto em cada loja responderia outra pergunta —
        quem vai ao atacado uma vez por mês gasta mais lá e paga menos por quilo.</p>`);
    return;
  }

  const ranking = ids.map(id => ({
    loja: DB.get('stores', id),
    custo: comuns.reduce((s, pid) => s + Precos.mediana(porLoja[id][pid]), 0),
  })).filter(r => r.loja).sort((a, b) => a.custo - b.custo);

  const melhor = ranking[0];
  UI.folha(`
    <h2 class="titulo">Onde sai mais barato</h2>
    <p class="sub">Comparando os <b>${comuns.length} produtos</b> que você compra
      em todos esses mercados — a mesma cesta, nos dois lugares.</p>
    <div class="revisao" style="margin-top:var(--e3)">
      ${ranking.map((r, i) => {
        const dif = melhor.custo > 0 ? (r.custo - melhor.custo) / melhor.custo : 0;
        return `<div class="rev-linha">
          <div class="rev-corpo">
            <b>${i === 0 ? '🏆 ' : ''}${UI.esc(r.loja.nome)}</b>
            <span class="sub">cesta comparável: ${UI.fmt(r.custo)}</span>
          </div>
          <span class="badge ${i === 0 ? 'b-green' : dif > 0.1 ? 'b-red' : 'b-amber'}">
            ${i === 0 ? 'mais barato' : '+' + (dif * 100).toFixed(0) + '%'}
          </span>
        </div>`;
      }).join('')}
    </div>`);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirImportacao, abrirEntreLojas };
