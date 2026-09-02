/* CESTA — a câmera: foto do selo, código de barras e o QR da nota.

   Tudo aqui é atalho. Se a câmera não abrir, se o navegador não tiver o leitor,
   se o OCR estiver desligado — o teclado continua ali, e é ele que sempre
   funciona. Nenhum fluxo depende desta tela. */
'use strict';

function abrirCamera(liId, recarregar) {
  const suporta = Leitura.suportaBarras();

  const fechar = UI.folha(`
    <h2 class="titulo">Câmera</h2>
    <p class="sub">Guarde a etiqueta como comprovante${suporta ? ', ou leia o código de barras' : ''}.</p>

    <video id="cam-video" playsinline muted class="cam-video"></video>
    <div id="cam-aviso" class="sub" style="margin-top:var(--e2)"></div>

    <div class="cam-botoes">
      ${suporta ? `<button class="btn btn-largo" id="cam-barras">Ler código de barras</button>` : ''}
      <button class="btn btn-principal btn-largo btn-grande" id="cam-foto">Fotografar etiqueta</button>
    </div>

    ${!suporta ? `<p class="sub" style="margin-top:var(--e3)">
      Este navegador não lê código de barras — no iPhone, nenhum lê, porque todos
      usam o mesmo motor do Safari. A foto e a digitação funcionam normalmente.
    </p>` : ''}`, { aoFechar: () => Leitura.pararCamera(stream) });

  const video = document.querySelector('#cam-video');
  const aviso = document.querySelector('#cam-aviso');
  let stream = null;

  Leitura.abrirCamera(video).then(s => { stream = s; })
    .catch(() => { aviso.textContent = 'Não consegui abrir a câmera. Digitar o preço continua funcionando.'; });

  const botaoBarras = document.querySelector('#cam-barras');
  if (botaoBarras) botaoBarras.addEventListener('click', async () => {
    const r = await Leitura.lerBarras(video);
    if (!r) { aviso.textContent = 'Não achei um código. Aproxime e segure firme.'; return; }
    /* Um QR na câmera quase sempre é o cupom fiscal, não o produto. Tratar a
       chave de 44 dígitos como se fosse um EAN criaria um produto fantasma. */
    const chave = Leitura.chaveDeQR(r.valor);
    if (chave) {
      aviso.innerHTML = `Isto é o QR de uma nota fiscal. A chave foi copiada —
        use <b>Importar nota fiscal</b> para trazer os itens.`;
      try { await navigator.clipboard.writeText(chave); } catch (_) {}
      return;
    }
    vincularEAN(liId, r.valor, recarregar, fechar);
  });

  document.querySelector('#cam-foto').addEventListener('click', async () => {
    if (!stream) { aviso.textContent = 'A câmera não está aberta.'; return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob) { aviso.textContent = 'Não consegui capturar a imagem.'; return; }

    let foto = null;
    try { foto = await Fotos.guardar(blob); }
    catch (_) { aviso.textContent = 'Sem espaço para guardar a foto neste aparelho.'; return; }

    const li = DB.get('list_items', liId);
    if (li) DB.upsert('list_items', { id: liId, foto_id: foto.id });

    /* O OCR PROPÕE, a pessoa confirma. Preencher o campo é ajuda; gravar
       sozinho seria envenenar a mediana com um número que ninguém conferiu. */
    if (Leitura.ocrLigado()) {
      aviso.textContent = 'Lendo a etiqueta…';
      const r = await Leitura.lerSelo(blob);
      if (r.proposta && r.proposta.preco) {
        const campo = document.querySelector('#preco-' + liId);
        if (campo) {
          campo.value = String(Math.round(r.proposta.preco * 100));
          campo.dispatchEvent(new Event('input'));
        }
        fechar();
        UI.toast('Preço proposto pela foto — confira antes de guardar', 5000);
        return;
      }
      aviso.textContent = r.erro === 'sem_rede'
        ? 'Sem internet para ler a etiqueta. A foto ficou guardada; digite o preço.'
        : 'Não consegui ler o preço na foto. Ela ficou guardada como comprovante.';
      return;
    }

    fechar();
    UI.toast('Foto guardada como comprovante');
    if (recarregar) recarregar();
  });
}

/* Vincula um EAN lido ao item da lista: a identidade exata do produto, que
   dispensa casar texto de PDV para sempre daqui em diante. */
function vincularEAN(liId, ean, recarregar, fechar) {
  const li = DB.get('list_items', liId);
  if (!li) return;
  let produto = DB.all('products').find(p => p.ean === ean);
  if (!produto) {
    produto = DB.upsert('products', {
      item_id: li.item_id,
      ean,
      marca: null,
      embalagem_qtd: li.qtd,
      embalagem_unidade: li.unidade,
    });
  }
  DB.upsert('list_items', { id: liId, product_id: produto.id });
  if (fechar) fechar();
  UI.toast('Produto identificado pelo código de barras');
  if (recarregar) recarregar();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { abrirCamera, vincularEAN };
