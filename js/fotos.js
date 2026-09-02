/* CESTA — a foto do selo: IndexedDB, compressão e ciclo de vida.

   POR QUE NÃO NO localStorage: ele acaba em ~5 MB, e uma foto de selo
   comprimida tem 80–200 KB. Vinte fotos estourariam a base inteira — e a base
   inteira inclui o histórico de preços, que é a única coisa insubstituível do
   app. Metadado no localStorage, blob aqui.

   A FOTO É COMPROVANTE, NÃO ENTRADA DE DADO. O preço quem digita é a pessoa (na
   F7 o OCR pode propor, e ela confirma). A foto serve para conferir depois o
   que a etiqueta dizia — inclusive o "de/por" das promoções, que some da
   gôndola no dia seguinte. */
'use strict';

const Fotos = {
  BANCO: 'cesta-fotos',
  LOJA: 'fotos',
  _db: null,

  disponivel() { return typeof indexedDB !== 'undefined'; },

  abrir() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((ok, erro) => {
      if (!this.disponivel()) return erro(new Error('sem IndexedDB'));
      const req = indexedDB.open(this.BANCO, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.LOJA)) db.createObjectStore(this.LOJA, { keyPath: 'id' });
      };
      req.onsuccess = () => { this._db = req.result; ok(this._db); };
      req.onerror = () => erro(req.error);
    });
  },

  /* COMPRIME ANTES DE GRAVAR. Uma foto de celular moderno tem 3–8 MB; guardar
     isso a cada preço encheria o aparelho em uma compra. 1280px e qualidade
     0,6 mantêm o texto do selo perfeitamente legível — que é a única coisa que
     a foto precisa entregar. */
  async comprimir(arquivo, { maxLado = 1280, qualidade = 0.6 } = {}) {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const l = Math.round(bitmap.width * escala);
    const a = Math.round(bitmap.height * escala);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(l, a)
      : Object.assign(document.createElement('canvas'), { width: l, height: a });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, l, a);
    bitmap.close && bitmap.close();
    return canvas.convertToBlob
      ? canvas.convertToBlob({ type: 'image/jpeg', quality: qualidade })
      : new Promise(ok => canvas.toBlob(ok, 'image/jpeg', qualidade));
  },

  async guardar(arquivo) {
    const blob = await this.comprimir(arquivo);
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    const db = await this.abrir();
    await new Promise((ok, erro) => {
      const tx = db.transaction(this.LOJA, 'readwrite');
      tx.objectStore(this.LOJA).put({ id, blob, criada: new Date().toISOString(), bytes: blob.size });
      tx.oncomplete = ok;
      tx.onerror = () => erro(tx.error);
    });
    return { id, bytes: blob.size };
  },

  async ler(id) {
    const db = await this.abrir();
    return new Promise((ok, erro) => {
      const req = db.transaction(this.LOJA, 'readonly').objectStore(this.LOJA).get(id);
      req.onsuccess = () => ok(req.result || null);
      req.onerror = () => erro(req.error);
    });
  },

  async url(id) {
    const r = await this.ler(id);
    return r ? URL.createObjectURL(r.blob) : null;
  },

  async apagar(id) {
    const db = await this.abrir();
    return new Promise((ok, erro) => {
      const tx = db.transaction(this.LOJA, 'readwrite');
      tx.objectStore(this.LOJA).delete(id);
      tx.oncomplete = () => ok(true);
      tx.onerror = () => erro(tx.error);
    });
  },

  async listar() {
    const db = await this.abrir();
    return new Promise((ok, erro) => {
      const req = db.transaction(this.LOJA, 'readonly').objectStore(this.LOJA).getAll();
      req.onsuccess = () => ok((req.result || []).map(r => ({ id: r.id, bytes: r.bytes, criada: r.criada })));
      req.onerror = () => erro(req.error);
    });
  },

  /* FAXINA: apaga foto que nenhuma observação referencia mais. Sem isto, cada
     "desfazer" no mercado deixaria um blob órfão ocupando espaço para sempre —
     e o aparelho enche sem que ninguém entenda por quê. */
  async faxina() {
    const usadas = new Set(DB.all('price_obs').map(o => o.foto_id).filter(Boolean));
    const todas = await this.listar();
    let apagadas = 0;
    for (const f of todas) if (!usadas.has(f.id)) { await this.apagar(f.id); apagadas++; }
    return apagadas;
  },

  async espacoUsado() {
    const todas = await this.listar();
    return { fotos: todas.length, bytes: todas.reduce((s, f) => s + (f.bytes || 0), 0) };
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Fotos };
