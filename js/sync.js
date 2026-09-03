/* CESTA — sincronização opcional via Supabase (PostgREST, sem SDK).

   O APP FUNCIONA INTEIRO SEM ISTO. A sincronização existe para quem usa dois
   aparelhos ou divide a lista com alguém; quem não configurar nada não perde
   nada, e nenhuma tela espera por rede em momento algum.

   ============================ AS TRÊS GARANTIAS ============================

   1. NADA SE PERDE NO ENVIO.

      A versão anterior tinha uma janela real de perda: ela tirava um retrato dos
      registros sujos, esperava o servidor, e depois marcava TODOS como limpos.
      Uma edição feita DURANTE a espera era apagada — o registro subia com o
      valor velho e ficava marcado como enviado.

      No mercado isso não é hipótese: a pessoa digita um preço atrás do outro
      enquanto o envio anterior ainda está no ar. Agora o retrato guarda o
      `updated_at` de cada linha, e só é marcado como enviado quem NÃO mudou
      desde então. O que mudou continua sujo e vai no envio seguinte.

   2. NADA SE PERDE NO RECEBIMENTO.

      O marcador do pull é o carimbo do SERVIDOR (`server_at`), nunca o relógio
      do cliente. No app de finanças, usar o relógio do cliente causou perda
      silenciosa: um aparelho que ficou offline gravava com o horário dele, o
      outro pedia "o que mudou desde X" pelo horário próprio, e o que caía entre
      os dois relógios nunca mais era buscado. Não dava erro — sumia.

   3. QUEM QUISER SINCRONIZAR AGORA, CONSEGUE.

      `sincronizar({ agora: true })` não desiste por estar offline: tenta, e o
      erro vira mensagem em vez de silêncio. E um pedido feito durante um envio
      em curso não é descartado — fica marcado e roda ao fim, porque um botão
      "sincronizar agora" que não sincroniza é pior que botão nenhum.
   ========================================================================= */
'use strict';

const SYNC_TABELAS = {
  stores:     ['nome', 'apelido', 'bairro', 'cnpj'],
  items:      ['nome', 'categoria', 'unidade', 'qtd_habitual'],
  products:   ['item_id', 'marca', 'embalagem_qtd', 'embalagem_unidade', 'ean', 'descricao_pdv'],
  lists:      ['nome', 'status', 'store_id', 'orcamento', 'data_abertura', 'data_fechamento', 'total_cupom'],
  list_items: ['list_id', 'item_id', 'product_id', 'qtd', 'unidade', 'comprado', 'nao_tinha', 'preco_total', 'obs_id', 'pegou_por'],
  price_obs:  ['product_id', 'item_id', 'store_id', 'data', 'preco_total', 'qtd', 'unidade',
               'qtd_canonica', 'unidade_base', 'preco_base', 'origem', 'foto_id', 'nfce_chave'],
  nfce_docs:  ['chave', 'store_id', 'data', 'total', 'itens_importados', 'formato'],
  aliases:    ['store_id', 'texto_pdv', 'product_id'],
};

/* Um POST com mil linhas estoura limite de corpo e leva tudo junto quando falha.
   Em lotes, uma falha custa 200 registros que continuam sujos — e voltam no
   próximo envio — em vez da sincronização inteira. */
const TAMANHO_DO_LOTE = 200;

const Sync = {
  cfg: null,
  ocupado: false,
  pedidoPendente: false,
  estado: 'off',          // off | ok | sync | pendente | offline | erro
  ultimoErro: null,

  /* Os ganchos que a tela liga. Nascem vazios para o sync rodar igual em teste,
     sem DOM nenhum. */
  onState: null,          // (estado, pendentes) — o ponto no header
  onStatus: null,         // (mensagem, ok) — a linha de texto temporária
  onChanged: null,        // (quantidade) — chegou coisa nova, a tela se refaz

  /* ------------------------------------------------------ configuração --- */

  load() {
    try { this.cfg = JSON.parse(localStorage.getItem('cesta.sync')) || {}; }
    catch (_) { this.cfg = {}; }
    if (typeof CONFIG !== 'undefined') {
      if (!this.cfg.url && CONFIG.url) this.cfg.url = CONFIG.url;
      if (!this.cfg.anonKey && CONFIG.anonKey) this.cfg.anonKey = CONFIG.anonKey;
    }
    this.avisarEstado();
    return this.cfg;
  },

  saveCfg() {
    try { localStorage.setItem('cesta.sync', JSON.stringify(this.cfg || {})); } catch (_) {}
  },

  configurado() { return !!(this.cfg && this.cfg.url && this.cfg.anonKey); },
  logado() { return !!(this.cfg && this.cfg.access_token); },
  temFamilia() { return !!(this.cfg && this.cfg.family_id); },
  meuNome() { return (this.cfg && this.cfg.nome) || 'Eu'; },

  /* --------------------------------------------------------- o estado --- */

  /* O estado em uma palavra. É o que o ponto no header pinta e o que o `title`
     diz por extenso — a cor nunca informa sozinha. */
  calcularEstado() {
    if (!this.configurado() || !this.logado() || !this.temFamilia()) return 'off';
    if (this.ocupado) return 'sync';
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      /* Sem conexão e sem fila não é problema nenhum: é um app offline-first
         fazendo o que promete. Só acende quando há algo esperando. */
      return this.pendentes() ? 'offline' : 'ok';
    }
    if (this.ultimoErro) return 'erro';
    return this.pendentes() ? 'pendente' : 'ok';
  },

  avisarEstado() {
    this.estado = this.calcularEstado();
    if (this.onState) {
      try { this.onState(this.estado, this.pendentes()); } catch (_) {}
    }
  },

  avisar(msg, ok = true) {
    if (this.onStatus) { try { this.onStatus(msg, ok); } catch (_) {} }
  },

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
    this.avisarEstado();
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
    this.avisarEstado();
  },

  /* ------------------------------------------------------------ família --- */

  /* O CÓDIGO DA FAMÍLIA é o que liga dois aparelhos. Seis caracteres, sem as
     letras e números que se confundem quando alguém dita por telefone: sem
     O/0, I/1/L, S/5. Um código ambíguo vira suporte técnico. */
  gerarCodigo() {
    const alfabeto = 'BCDFGHJKMNPQRTVWXYZ23467894';
    let saida = '';
    for (const n of crypto.getRandomValues(new Uint8Array(6))) saida += alfabeto[n % alfabeto.length];
    return saida;
  },

  async criarFamilia(nome, meuNome) {
    const codigo = this.gerarCodigo();
    const r = await fetch(`${this.cfg.url}/rest/v1/families`, {
      method: 'POST',
      headers: this.cabecalhos({ Prefer: 'return=representation' }),
      body: JSON.stringify({ nome: nome || 'Minha casa', codigo, criada_por: this.cfg.user_id }),
    });
    if (!r.ok) throw new Error(await r.text());
    const familia = (await r.json())[0];
    await this.entrarNaFamilia(familia.id, familia.codigo, familia.nome, meuNome);
    return familia;
  },

  async entrarPorCodigo(codigo, meuNome) {
    const limpo = String(codigo || '').trim().toUpperCase().replace(/\s/g, '');
    const url = `${this.cfg.url}/rest/v1/families?codigo=eq.${encodeURIComponent(limpo)}&select=*`;
    const r = await fetch(url, { headers: this.cabecalhos() });
    if (!r.ok) throw new Error(await r.text());
    const achadas = await r.json();
    if (!achadas.length) throw new Error('Código não encontrado. Confira as seis letras.');
    await this.entrarNaFamilia(achadas[0].id, achadas[0].codigo, achadas[0].nome, meuNome);
    return achadas[0];
  },

  async entrarNaFamilia(familyId, codigo, nome, meuNome) {
    const r = await fetch(`${this.cfg.url}/rest/v1/family_members?on_conflict=user_id`, {
      method: 'POST',
      headers: this.cabecalhos({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        user_id: this.cfg.user_id,
        family_id: familyId,
        nome: meuNome || this.meuNome(),
      }),
    });
    if (!r.ok) throw new Error(await r.text());

    this.cfg.family_id = familyId;
    this.cfg.family_codigo = codigo;
    this.cfg.family_nome = nome;
    if (meuNome) this.cfg.nome = meuNome;
    this.saveCfg();

    /* O family_id entra em TODO registro local que ainda não tem. Sem isso, o
       que foi criado antes de entrar na família nunca subiria — e a pessoa
       concluiria que a sincronização perdeu os dados dela, que é o pior que uma
       sincronização pode fazer com a confiança de alguém. */
    for (const tabela of Object.keys(SYNC_TABELAS)) {
      for (const reg of DB.data[tabela] || []) {
        if (!reg.family_id) { reg.family_id = familyId; reg.dirty = true; }
      }
    }
    DB.setCfg({ familia_nome: nome });
    DB.save();
    this.avisarEstado();
  },

  sairDaFamilia() {
    delete this.cfg.family_id;
    delete this.cfg.family_codigo;
    delete this.cfg.family_nome;
    this.saveCfg();
    DB.setCfg({ familia_nome: null });
    this.avisarEstado();
  },

  async membros() {
    if (!this.temFamilia()) return [];
    const url = `${this.cfg.url}/rest/v1/family_members?family_id=eq.${this.cfg.family_id}&select=*`;
    const r = await fetch(url, { headers: this.cabecalhos() });
    return r.ok ? r.json() : [];
  },

  /* --------------------------------------------------------------- push --- */

  /* A linha que vai para o banco: apenas as colunas declaradas. Mandar um campo
     que o banco não tem faz o Postgres recusar o LOTE INTEIRO, e aí nada mais
     sincroniza — sem erro visível na tela. */
  linhaDe(tabela, r) {
    const linha = {
      id: r.id,
      family_id: this.cfg.family_id,
      updated_at: r.updated_at,
      rev: r.rev || 1,
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

      /* O RETRATO GUARDA O CONTADOR. É ele que impede a perda: quando o envio
         voltar, só é marcado como enviado quem continuar na mesma versão. Quem
         mudou no meio do caminho segue sujo e vai na próxima — a edição da
         pessoa vence o retrato antigo, sempre.

         O contador, e não o carimbo de tempo: duas edições no mesmo
         milissegundo têm o MESMO updated_at, e no mercado o app grava a cada
         tecla. Comparar o relógio deixaria passar exatamente o caso mais
         frequente. */
      const retrato = sujos.map(r => ({ id: r.id, rev: r.rev || 0 }));

      for (let i = 0; i < retrato.length; i += TAMANHO_DO_LOTE) {
        const lote = retrato.slice(i, i + TAMANHO_DO_LOTE);
        const corpo = lote.map(x => this.linhaDe(tabela, (DB.data[tabela] || []).find(r => r.id === x.id)));

        const r = await fetch(`${this.cfg.url}/rest/v1/${tabela}?on_conflict=id`, {
          method: 'POST',
          headers: this.cabecalhos({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify(corpo),
        });
        if (!r.ok) throw new Error(`${tabela}: ${await r.text()}`);

        /* Desmarca DEPOIS de o servidor aceitar, e só o que não mudou desde o
           retrato. Desmarcar antes perderia o registro se a resposta falhasse;
           desmarcar tudo perderia a edição feita durante a espera. */
        for (const { id, rev } of lote) {
          /* REENCONTRA PELO ID. Guardar a referência não bastava: `upsert`
             SUBSTITUI o objeto dentro do array, e a referência antiga virava um
             órfão — marcar dirty nela não mexia em nada, e a proteção nunca era
             exercitada. Pelo id, funciona tanto quando o registro é substituído
             quanto quando é mutado no lugar (DB.remove faz assim). */
          const atual = (DB.data[tabela] || []).find(r => r.id === id);
          if (atual && (atual.rev || 0) === rev) atual.dirty = false;
        }
        enviados += lote.length;
      }
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
      /* server_at, e não updated_at: ver a garantia 2, no topo do arquivo. */
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
        delete registro.family_id;
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

  /* `agora: true` é o botão "sincronizar agora": ele não desiste por estar
     offline — tenta, e o erro vira mensagem em vez de silêncio. */
  async sincronizar({ agora = false } = {}) {
    if (!this.configurado() || !this.logado() || !this.temFamilia()) return null;

    /* PEDIDO DURANTE UM ENVIO NÃO SE PERDE. Ele fica marcado e roda ao fim —
       senão "sincronizar agora" tocado no meio de um envio automático seria
       engolido em silêncio, e a pessoa concluiria que o botão não funciona. */
    if (this.ocupado) {
      this.pedidoPendente = true;
      if (agora) this.avisar('Já estou sincronizando…');
      return null;
    }

    if (!agora && typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.avisarEstado();
      return null;
    }

    this.ocupado = true;
    this.ultimoErro = null;
    this.avisarEstado();
    if (agora) this.avisar('Sincronizando…');

    try {
      const enviados = await this.push();
      const recebidos = await this.pull();

      this.ocupado = false;
      this.avisarEstado();

      if (agora || enviados || recebidos) {
        this.avisar(enviados || recebidos
          ? `${enviados} ${enviados === 1 ? 'enviado' : 'enviados'} · ${recebidos} ${recebidos === 1 ? 'recebido' : 'recebidos'}`
          : 'Tudo sincronizado');
      }
      if (recebidos && this.onChanged) { try { this.onChanged(recebidos); } catch (_) {} }

      /* O pedido que chegou durante o envio roda agora, com o que ele tinha a
         mandar ainda sujo — nada foi descartado no caminho. */
      if (this.pedidoPendente) {
        this.pedidoPendente = false;
        return this.sincronizar({ agora });
      }
      return { enviados, recebidos };

    } catch (e) {
      this.ocupado = false;

      // Token vencido: renova uma vez e tenta de novo. Sessões duram meses, e
      // pedir a senha a cada expiração seria pedir sem motivo.
      if (String(e.message).includes('JWT') && await this.renovar()) {
        return this.sincronizar({ agora });
      }

      this.ultimoErro = e.message;
      this.avisarEstado();
      /* O ERRO NÃO PERDE NADA: o que falhou continua sujo e sobe na próxima
         tentativa. Por isso a mensagem fala em espera, e não em perda — dizer
         "falhou" sobre um dado que está a salvo assusta sem motivo. */
      if (agora) this.avisar('Não consegui agora. Nada se perdeu — vai quando a conexão voltar.', false);
      throw e;
    }
  },

  /* Liga a sincronização automática: ao abrir, ao voltar do bolso e ao voltar a
     conexão. Nenhuma delas segura a tela — o app desenha primeiro e conversa
     com a rede depois. */
  ligarAutomatico() {
    if (typeof window === 'undefined') return;
    const tentar = () => { this.sincronizar().catch(() => {}); };

    /* VOLTOU A CONEXÃO é o momento mais importante, e o único em que a fila
       existe com certeza: tudo o que foi feito no mercado está esperando. */
    window.addEventListener('online', () => { this.avisarEstado(); tentar(); });
    window.addEventListener('offline', () => this.avisarEstado());

    // Voltou do bolso: pode ter mudado coisa no outro aparelho
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tentar();
    });

    tentar();
  },

  /* SO O QUE DE FATO VAI SUBIR. DB.pendentes() conta todas as stores, e
     'settings' nao esta em SYNC_TABELAS — ela e configuracao do aparelho, nao
     dado da familia. Contando-a, o indicador ficaria ambar para sempre,
     anunciando uma alteracao que nunca sai: um ponto que nunca resolve ensina a
     pessoa a ignorar o ponto, e ai o aviso de verdade morre junto. */
  pendentes() {
    let n = 0;
    for (const tabela of Object.keys(SYNC_TABELAS)) {
      n += (DB.data && DB.data[tabela] || []).filter(r => r.dirty).length;
    }
    return n;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Sync, SYNC_TABELAS };
