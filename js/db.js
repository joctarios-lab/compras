/* CESTA — camada de dados local (localStorage, local-first)

   Todas as entidades carregam o envelope de sync desde o PRIMEIRO registro
   gravado: { id, updated_at, deleted, dirty }. A sincronização só chega na F8,
   mas acrescentar o envelope depois obrigaria a migrar a base de quem já usa —
   e migração de dados de usuário é o tipo de dívida que se paga com defeito.

   FOTOS NÃO MORAM AQUI. O localStorage acaba em ~5 MB e uma foto de selo
   comprimida tem 80–200 KB: vinte fotos estourariam a base inteira, levando
   junto o histórico de preços. Metadado aqui, blob no IndexedDB (js/fotos.js,
   F5). Ver docs/PROMPT-INICIAL.md, seção 7.

   O DIAGNÓSTICO NUNCA É GRAVADO. price_obs é a fonte única, e "🔴 Caro +14%" é
   sempre derivado dela por js/precos.js. Guardar o veredito congelado significa
   ter dois números que discordam no dia em que a regra mudar. */
'use strict';

const DB_KEY = 'cesta.v1';

const STORES = [
  'stores',      // mercados
  'items',       // catálogo pessoal: "arroz"
  'products',    // marca + embalagem: "Tio João 5 kg"
  'lists',       // as compras, planejadas ou fechadas
  'list_items',  // as linhas de cada compra
  'price_obs',   // A FONTE ÚNICA de toda comparação
  'nfce_docs',   // notas importadas — dedupe pela chave de 44 dígitos (F3)
  'aliases',     // (loja, texto do PDV) → produto: o vínculo aprendido (F3)
  'settings',
];

const DB = {
  data: null,
  _fila: Promise.resolve(),

  /* ------------------------------------------------------------ ciclo --- */

  load() {
    let lido = null;
    try { lido = JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (_) { lido = null; }
    this.data = lido;
    if (!this.data) {
      this.data = { meta: { criado_em: new Date().toISOString(), lastSync: null } };
      for (const s of STORES) this.data[s] = [];
      this.semear();
    }
    // Uma versão anterior pode não ter uma store nova: nunca deixe undefined
    // chegar às telas, ou toda leitura precisa de uma guarda contra nulo.
    for (const s of STORES) if (!this.data[s]) this.data[s] = [];
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      /* QuotaExceededError. No mercado isto seria perder o carrinho em curso, que
         é o pior desfecho possível deste app — quem avisa é a tela, e alto. */
      console.error('CESTA: não foi possível gravar', e);
      if (typeof window !== 'undefined' && window.avisarFalhaDeGravacao) window.avisarFalhaDeGravacao(e);
      return false;
    }
  },

  /* ------------------------------------------------- envelope de sync --- */

  uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  agora() { return new Date().toISOString(); },

  /* Grava (insere ou atualiza) e devolve o registro. `dirty` marca o que ainda
     não subiu; `updated_at` resolve conflito por last-write-wins. O marcador do
     PULL será o carimbo do servidor, nunca este — ver a seção 10, F8. */
  upsert(store, obj) {
    const lista = this.data[store];
    if (!lista) throw new Error('store desconhecida: ' + store);
    const agora = this.agora();
    if (obj.id) {
      const i = lista.findIndex(r => r.id === obj.id);
      if (i >= 0) {
        lista[i] = { ...lista[i], ...obj, updated_at: agora, dirty: true };
        this.save();
        return lista[i];
      }
    }
    const novo = { id: obj.id || this.uid(), ...obj, updated_at: agora, deleted: false, dirty: true };
    lista.push(novo);
    this.save();
    return novo;
  },

  /* Apagar é MARCAR apagado. Remover a linha faria o registro ressuscitar no
     próximo pull, vindo do outro aparelho que nunca soube da exclusão. */
  remove(store, id) {
    const r = this.get(store, id);
    if (!r) return false;
    r.deleted = true;
    r.updated_at = this.agora();
    r.dirty = true;
    this.save();
    return true;
  },

  get(store, id) { return (this.data[store] || []).find(r => r.id === id && !r.deleted) || null; },

  all(store) { return (this.data[store] || []).filter(r => !r.deleted); },

  pendentes() { return STORES.reduce((n, s) => n + (this.data[s] || []).filter(r => r.dirty).length, 0); },

  /* ---------------------------------------------------------- semente --- */

  /* O app não abre vazio: abre com as categorias que toda casa tem. Não são
     produtos nem preços — apenas as gavetas do catálogo, para a primeira lista
     não começar num campo de texto em branco. */
  semear() {
    const categorias = [
      'Hortifrúti', 'Açougue e peixaria', 'Frios e laticínios', 'Padaria',
      'Mercearia', 'Bebidas', 'Limpeza', 'Higiene', 'Outros',
    ];
    this.data.settings = [{
      id: this.uid(),
      categorias,
      orcamento_padrao: null,
      tema: 'auto',
      loja_favorita: null,
      updated_at: this.agora(),
      deleted: false,
      dirty: true,
    }];
  },

  cfg() { return this.data.settings[0] || null; },

  setCfg(patch) {
    const atual = this.cfg();
    if (!atual) return null;
    Object.assign(atual, patch, { updated_at: this.agora(), dirty: true });
    this.save();
    return atual;
  },

  /* -------------------------------------------------------- utilidades --- */

  /* O mês de referência do app é o mês civil. Diferente do DOMI, aqui não há
     "dia de início do mês": compra de mercado não tem fatura nem ciclo. */
  mesDe(iso) { return String(iso).slice(0, 7); },

  hojeISO() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  /* --------------------------------------------------------- backup --- */

  exportJSON() { return JSON.stringify(this.data, null, 2); },

  importJSON(texto) {
    const lido = JSON.parse(texto);
    if (!lido || typeof lido !== 'object') throw new Error('arquivo inválido');
    for (const s of STORES) if (!lido[s]) lido[s] = [];
    this.data = lido;
    this.save();
    return this.data;
  },

  apagarTudo() {
    localStorage.removeItem(DB_KEY);
    this.data = null;
    return this.load();
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { DB, STORES, DB_KEY };
