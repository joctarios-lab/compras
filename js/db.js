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

/* Criptografia em repouso: AES-256-GCM com a chave derivada do PIN.
   Quem manda no ciclo é js/auth.js; aqui ficam só a leitura e a escrita. */
const Cofre = {
  b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },
  async cifrar(chave, texto) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto));
    return { cifrado: true, iv: this.b64(iv), ct: this.b64(ct) };
  },
  async decifrar(chave, blob) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(blob.iv) }, chave, this.unb64(blob.ct));
    return new TextDecoder().decode(pt);
  },
};

const DB = {
  data: null,
  chave: null,          // CryptoKey ativa (criptografia em repouso ligada)
  trancado: false,      // true quando os dados estão cifrados esperando o PIN
  _blob: null,
  _fila: Promise.resolve(),

  /* ------------------------------------------------------------ ciclo --- */

  load() {
    let lido = null;
    try { lido = JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (_) { lido = null; }

    /* Dados cifrados: NÃO seguir adiante. Criar uma base vazia aqui faria o app
       parecer novo em folha e, na primeira gravação, apagaria por cima do que
       estava cifrado — perda total e silenciosa. */
    if (lido && lido.cifrado === true) {
      this._blob = lido;
      this.trancado = true;
      this.data = null;
      return null;
    }

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

  /* Abre a base cifrada com a chave dada. Lança se a chave for errada — e é
     esse "lançar" que serve de prova do PIN, sem guardar hash nenhum. */
  async abrirCom(chave) {
    if (!this.trancado) {
      // Já aberta: a chave ainda precisa ser provada contra o que está gravado
      if (this._blob) {
        const texto = await Cofre.decifrar(chave, this._blob);
        JSON.parse(texto);
      }
      return this.data;
    }
    const texto = await Cofre.decifrar(chave, this._blob);
    this.data = JSON.parse(texto);
    for (const s of STORES) if (!this.data[s]) this.data[s] = [];
    this.chave = chave;
    this.trancado = false;
    return this.data;
  },

  /* Liga (chave) ou desliga (null) a criptografia em repouso e regrava. */
  setChave(chave) {
    this.chave = chave || null;
    this.save();
  },

  save() {
    try {
      const texto = JSON.stringify(this.data);
      if (this.chave) {
        /* A gravação cifrada é ASSÍNCRONA e a fila mantém a ordem: duas
           gravações rápidas (digitar preço no mercado) podem terminar fora de
           ordem e a segunda gravaria por cima da primeira, perdendo o item. */
        this._fila = this._fila
          .then(() => Cofre.cifrar(this.chave, texto))
          .then(blob => { this._blob = blob; localStorage.setItem(DB_KEY, JSON.stringify(blob)); })
          .catch(e => {
            console.error('CESTA: falha ao cifrar', e);
            if (typeof window !== 'undefined' && window.avisarFalhaDeGravacao) window.avisarFalhaDeGravacao(e);
          });
        return true;
      }
      localStorage.setItem(DB_KEY, texto);
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

  /* -------------------------------------------------- catálogo (F1) --- */

  /* Busca no catálogo pessoal, ordenada por FREQUÊNCIA de compra. O que a
     pessoa compra toda semana tem de estar no topo da primeira letra digitada —
     ordenar por nome deixaria "abacaxi" na frente de "arroz" para sempre. */
  buscarItens(termo, limite = 8) {
    const t = String(termo || '').trim().toLowerCase();
    const usos = {};
    for (const o of this.all('price_obs')) if (o.item_id) usos[o.item_id] = (usos[o.item_id] || 0) + 1;
    return this.all('items')
      .filter(i => !t || String(i.nome).toLowerCase().includes(t))
      .sort((a, b) => (usos[b.id] || 0) - (usos[a.id] || 0) || String(a.nome).localeCompare(b.nome))
      .slice(0, limite);
  },

  /* Acha o item pelo nome ou cria. O nome é a identidade do item no catálogo:
     "Arroz" e "arroz" são a mesma coisa, e deixar os dois nascerem partiria o
     histórico do produto em dois pela metade — sem ninguém perceber. */
  itemPorNome(nome, extra = {}) {
    const limpo = String(nome || '').trim();
    if (!limpo) return null;
    const achado = this.all('items').find(i => String(i.nome).toLowerCase() === limpo.toLowerCase());
    if (achado) return achado;
    return this.upsert('items', { nome: limpo, categoria: extra.categoria || 'Outros', unidade: extra.unidade || 'un', qtd_habitual: extra.qtd_habitual || 1 });
  },

  /* ----------------------------------------------------- listas (F1) --- */

  novaLista({ nome, store_id, orcamento } = {}) {
    return this.upsert('lists', {
      nome: nome || 'Compra de ' + this.hojeISO().split('-').reverse().slice(0, 2).join('/'),
      status: 'planejada',
      store_id: store_id || null,
      orcamento: orcamento == null ? null : Number(orcamento),
      data_abertura: this.hojeISO(),
      data_fechamento: null,
      total_cupom: null,
    });
  },

  /* A compra EM CURSO é uma só. Duas listas em curso ao mesmo tempo fariam o
     preço registrado cair na compra errada, e isso é invisível até o mês virar. */
  listaEmCurso() { return this.all('lists').find(l => l.status === 'em_curso') || null; },

  listasPlanejadas() { return this.all('lists').filter(l => l.status === 'planejada'); },

  listasFechadas() {
    return this.all('lists').filter(l => l.status === 'fechada')
      .sort((a, b) => String(b.data_fechamento).localeCompare(String(a.data_fechamento)));
  },

  itensDaLista(list_id) {
    return this.all('list_items').filter(li => li.list_id === list_id);
  },

  addNaLista(list_id, { item_id, product_id, qtd, unidade }) {
    const item = this.get('items', item_id);
    return this.upsert('list_items', {
      list_id,
      item_id,
      product_id: product_id || null,
      qtd: qtd == null ? (item && item.qtd_habitual) || 1 : Number(qtd),
      unidade: unidade || (item && item.unidade) || 'un',
      comprado: false,
      nao_tinha: false,
      preco_total: null,
      obs_id: null,
    });
  },

  /* O TOTAL DO CARRINHO. Soma o que já foi precificado e ESTIMA o que falta
     pela mediana de cada item — separados, sempre: misturar o que já custa com
     o que talvez custe num número só faria a pessoa confiar numa estimativa
     como se fosse o valor do caixa. */
  totalDoCarrinho(list_id, estimarItem) {
    const itens = this.itensDaLista(list_id);
    let firme = 0, estimado = 0, comprados = 0, aEstimar = 0;
    for (const li of itens) {
      if (li.nao_tinha) continue;
      if (li.comprado && isFinite(li.preco_total)) { firme += Number(li.preco_total); comprados++; continue; }
      if (li.comprado) { comprados++; continue; }
      const e = estimarItem ? estimarItem(li) : null;
      if (isFinite(e) && e > 0) { estimado += e; aEstimar++; }
    }
    return {
      firme, estimado, total: firme + estimado,
      comprados, aEstimar,
      itens: itens.filter(li => !li.nao_tinha).length,
      pendentes: itens.filter(li => !li.comprado && !li.nao_tinha).length,
    };
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
