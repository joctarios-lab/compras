/* CESTA — sincronização opcional via Supabase (PostgREST, sem SDK).

   O APP FUNCIONA INTEIRO SEM ISTO. A sincronização existe para quem usa dois
   aparelhos; quem não configurar nada não perde nada, e nenhuma tela espera por
   rede em momento algum.

   O MARCADOR DO PULL É O CARIMBO DO SERVIDOR (`server_at`), NUNCA O RELÓGIO DO
   CLIENTE. No app de finanças, usar o relógio do cliente causou PERDA SILENCIOSA
   de registros: um aparelho que ficou offline gravava com o horário dele, o
   outro pedia "o que mudou desde X" pelo horário próprio, e o que caiu entre os
   dois relógios nunca mais foi buscado. Não dava erro nenhum — só sumia.
   `updated_at` continua existindo, mas serve só para resolver conflito. */
'use strict';

const SYNC_TABELAS = {
  stores:     ['nome', 'apelido', 'bairro', 'cnpj'],
  items:      ['nome', 'categoria', 'unidade', 'qtd_habitual'],
  products:   ['item_id', 'marca', 'embalagem_qtd', 'embalagem_unidade', 'ean', 'descricao_pdv'],
  lists:      ['nome', 'status', 'store_id', 'orcamento', 'data_abertura', 'data_fechamento', 'total_cupom'],
  list_items: ['list_id', 'item_id', 'product_id', 'qtd', 'unidade', 'comprado', 'nao_tinha', 'preco_total', 'obs_id'],
  price_obs:  ['product_id', 'item_id', 'store_id', 'data', 'preco_total', 'qtd', 'unidade',
               'qtd_canonica', 'unidade_base', 'preco_base', 'origem', 'foto_id', 'nfce_chave'],
  nfce_docs:  ['chave', 'store_id', 'data', 'total', 'itens_importados', 'formato'],
  aliases:    ['store_id', 'texto_pdv', 'product_id'],
};

const Sync = {
  cfg: null,
  ocupado: false,

  /* ------------------------------------------------------ configuração --- */

  load() {
    try { this.cfg = JSON.parse(localStorage.getItem('cesta.sync')) || {}; }
    catch (_) { this.cfg = {}; }
    if (typeof CONFIG !== 'undefined') {
      if (!this.cfg.url && CONFIG.url) this.cfg.url = CONFIG.url;
      if (!this.cfg.anonKey && CONFIG.anonKey) this.cfg.anonKey = CONFIG.anonKey;
    }
    return this.cfg;
  },

  saveCfg() {
    try { localStorage.setItem('cesta.sync', JSON.stringify(this.cfg || {})); } catch (_) {}
  },

  configurado() { return !!(this.cfg && this.cfg.url && this.cfg.anonKey); },
  logado() { return !!(this.cfg && this.cfg.access_token); },

  /* ------------------------------------------------------------- rede --- */

  cabecalhos(extra = {}) {
    return {
      apikey: this.cfg.anonKey,
      Authorization: 'Bearer ' + (this.cfg.access_token || this.cfg.anonKey),
      'Content-Type': 'application/json',
      ...extra,
    };
  },

  async entrar(email, senha, criar = false) {
    const rota = criar ? 'signup' : 'token?grant_type=password';
    const r = await fetch(`${this.cfg.url}/auth/v1/${rota}`, {
      method: 'POST',
      headers: { apikey: this.cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.msg || d.message || 'falha ao entrar');
    if (!d.access_token) throw new Error('confirme o e-mail antes de entrar');
    this.cfg.access_token = d.access_token;
    this.cfg.refresh_token = d.refresh_token;
    this.cfg.user_id = d.user && d.user.id;
    this.saveCfg();
    return d;
  },

  async renovar() {
    if (!this.cfg.refresh_token) return false;
    const r = await fetch(`${this.cfg.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: this.cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.cfg.refresh_token }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    this.cfg.access_token = d.access_token;
    this.cfg.refresh_token = d.refresh_token || this.cfg.refresh_token;
    this.saveCfg();
    return true;
  },

  sair() {
    this.cfg.access_token = null;
    this.cfg.refresh_token = null;
    this.cfg.user_id = null;
    this.saveCfg();
  },

  /* --------------------------------------------------------------- push --- */

  /* Envia o que está sujo. A linha vai com apenas as colunas declaradas acima:
     mandar um campo que o banco não tem faz o Postgres recusar o LOTE INTEIRO,
     e aí nada mais sincroniza — sem erro visível na tela. */
  linhaDe(tabela, r) {
    const linha = {
      id: r.id,
      user_id: this.cfg.user_id,
      updated_at: r.updated_at,
      deleted: !!r.deleted,
    };
    for (const c of SYNC_TABELAS[tabela]) if (r[c] !== undefined) linha[c] = r[c];
    return linha;
  },

  async push() {
    let enviados = 0;
    for (const tabela of Object.keys(SYNC_TABELAS)) {
      const sujos = (DB.data[tabela] || []).filter(r => r.dirty);
      if (!sujos.length) continue;
      const corpo = sujos.map(r => this.linhaDe(tabela, r));
      const r = await fetch(`${this.cfg.url}/rest/v1/${tabela}?on_conflict=id`, {
        method: 'POST',
        headers: this.cabecalhos({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error(`${tabela}: ${await r.text()}`);
      // Só desmarca depois de o servidor aceitar: desmarcar antes perderia o
      // registro para sempre se a resposta falhasse.
      for (const s of sujos) s.dirty = false;
      enviados += sujos.length;
    }
    if (enviados) DB.save();
    return enviados;
  },

  /* --------------------------------------------------------------- pull --- */

  async pull() {
    const desde = DB.data.meta.lastSync;
    let recebidos = 0;
    let maiorCarimbo = desde;

    for (const tabela of Object.keys(SYNC_TABELAS)) {
      /* server_at, e não updated_at: ver o comentário do topo. */
      const filtro = desde ? `&server_at=gt.${encodeURIComponent(desde)}` : '';
      const r = await fetch(
        `${this.cfg.url}/rest/v1/${tabela}?select=*${filtro}&order=server_at.asc`,
        { headers: this.cabecalhos() });
      if (!r.ok) throw new Error(`${tabela}: ${await r.text()}`);
      const linhas = await r.json();

      for (const linha of linhas) {
        if (linha.server_at && (!maiorCarimbo || linha.server_at > maiorCarimbo)) maiorCarimbo = linha.server_at;
        const local = (DB.data[tabela] || []).find(x => x.id === linha.id);
        /* LAST-WRITE-WINS por updated_at. Se o local é mais novo E ainda está
           sujo, ele vence e será enviado no próximo push — descartá-lo aqui
           apagaria uma edição que a pessoa acabou de fazer no aparelho. */
        if (local && local.dirty && local.updated_at > linha.updated_at) continue;

        const registro = { ...linha, dirty: false };
        delete registro.user_id;
        delete registro.server_at;
        if (local) Object.assign(local, registro);
        else DB.data[tabela].push(registro);
        recebidos++;
      }
    }

    DB.data.meta.lastSync = maiorCarimbo || DB.data.meta.lastSync;
    DB.save();
    return recebidos;
  },

  /* ------------------------------------------------------------ ciclo --- */

  async sincronizar() {
    if (!this.configurado() || !this.logado() || this.ocupado) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    this.ocupado = true;
    try {
      const enviados = await this.push();
      const recebidos = await this.pull();
      return { enviados, recebidos };
    } catch (e) {
      // Token vencido: renova uma vez e tenta de novo. Sessões duram meses, e
      // exigir novo login a cada expiração seria pedir senha sem motivo.
      if (String(e.message).includes('JWT') && await this.renovar()) {
        this.ocupado = false;
        return this.sincronizar();
      }
      throw e;
    } finally {
      this.ocupado = false;
    }
  },

  pendentes() { return DB.pendentes(); },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Sync, SYNC_TABELAS };
