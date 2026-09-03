/* CESTA — leitura de código de barras (F6) e do badge de preço (F7).

   AS DUAS SÃO CONVENIÊNCIA, NUNCA DEPENDÊNCIA. Digitar o preço sempre funciona,
   em qualquer aparelho, offline. Tudo aqui é um atalho para quem o aparelho
   permitir — e falha em silêncio, voltando ao teclado, onde não permitir.

   O QUE A PESQUISA MOSTROU (docs/pesquisa-mercado.md): a `BarcodeDetector`
   nativa existe no Chrome/Android e NÃO EXISTE NO SAFARI — logo, em nenhum
   navegador do iPhone, que são todos WebKit por baixo. Um recurso que falha em
   silêncio no iPhone é pior que um recurso ausente, então o app DIZ quando não
   dá, em vez de mostrar um botão que não faz nada. */
'use strict';

const Leitura = {

  /* ------------------------------------------- código de barras (F6) --- */

  suportaBarras() {
    return typeof BarcodeDetector !== 'undefined';
  },

  /* Lê o EAN da câmera. O EAN é a identidade EXATA do produto: com ele, o
     casamento na importação e a comparação de histórico deixam de depender de
     texto de PDV, que é onde nascem os erros. */
  async lerBarras(video) {
    if (!this.suportaBarras()) return null;
    try {
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });
      const achados = await detector.detect(video);
      if (!achados || !achados.length) return null;
      const b = achados[0];
      return { valor: b.rawValue, formato: b.format };
    } catch (_) { return null; }
  },

  /* O QR da NFC-e carrega a CHAVE DE ACESSO de 44 dígitos — e só ela. Ler o QR
     identifica a nota; NÃO devolve os itens. Para os itens continua sendo
     preciso o arquivo (ver js/nfce.js). Isto aqui poupa digitar 44 dígitos, que
     já é bastante. */
  chaveDeQR(texto) {
    return NFCe.extrairChave(texto);
  },

  async abrirCamera(destino) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
    destino.srcObject = stream;
    await destino.play();
    return stream;
  },

  pararCamera(stream) {
    if (stream) for (const t of stream.getTracks()) t.stop();
  },

  /* ------------------------------------------------- o badge (F7/OCR) --- */

  /* O OCR do badge é OPCIONAL E DESLIGADO POR PADRÃO, e usa a chave do próprio
     usuário — o mesmo padrão do assistente do app de finanças. Duas razões:

       1. Não embutir megabytes de modelo no shell offline de TODO MUNDO por um
          recurso que boa parte nunca vai ligar. O shell precisa ser leve porque
          ele é o que abre dentro do mercado.
       2. Quem paga é quem usa. Não há chave do app embutida, e nada é cobrado
          de quem não ligou.

     E, principalmente: o OCR PROPÕE, a pessoa confirma. Um preço lido errado e
     gravado em silêncio envenena a mediana do produto — o app passaria a errar
     com confiança, que é o pior defeito possível aqui. */
  ocrLigado() {
    try { return !!localStorage.getItem('cesta.ocr.chave'); } catch (_) { return false; }
  },

  configurarOCR(chave, provedor = 'anthropic') {
    try {
      if (chave) {
        localStorage.setItem('cesta.ocr.chave', chave);
        localStorage.setItem('cesta.ocr.provedor', provedor);
      } else {
        localStorage.removeItem('cesta.ocr.chave');
      }
      return true;
    } catch (_) { return false; }
  },

  async blobParaBase64(blob) {
    return new Promise((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = () => erro(r.error);
      r.readAsDataURL(blob);
    });
  },

  /* Manda a foto do badge e pede de volta preço, quantidade e unidade.
     Devolve SEMPRE uma proposta a confirmar, nunca um dado gravado. */
  async lerSelo(blob) {
    if (!this.ocrLigado()) return { erro: 'ocr_desligado' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { erro: 'sem_rede' };
    }
    const chave = localStorage.getItem('cesta.ocr.chave');
    const base64 = await this.blobParaBase64(blob);

    const corpo = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text:
            'Esta é a etiqueta de preço de um produto num supermercado brasileiro. ' +
            'Responda SÓ com JSON, sem texto em volta: ' +
            '{"preco": number, "qtd": number|null, "unidade": "kg"|"g"|"l"|"ml"|"un"|null, ' +
            '"descricao": string|null, "promocao": boolean}. ' +
            'preco é o valor à vista em reais. Se houver "de/por", use o POR. ' +
            'Se algum campo não estiver legível, use null — não invente.' },
        ],
      }],
    };

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': chave,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) return { erro: 'falhou', detalhe: await r.text() };
      const d = await r.json();
      const texto = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      const json = (texto.match(/\{[\s\S]*\}/) || [])[0];
      if (!json) return { erro: 'resposta_ilegivel' };
      const lido = JSON.parse(json);
      return {
        proposta: {
          preco: isFinite(lido.preco) ? Number(lido.preco) : null,
          qtd: isFinite(lido.qtd) ? Number(lido.qtd) : null,
          unidade: Precos.normalizarUnidade(lido.unidade),
          descricao: lido.descricao || null,
          promocao: !!lido.promocao,
        },
      };
    } catch (e) {
      return { erro: 'falhou', detalhe: String(e.message || e) };
    }
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Leitura };
