/* CESTA — confere se o banco foi criado direito.

   Rodar o schema.sql no painel e achar que deu certo é o jeito mais fácil de
   descobrir, semanas depois, que uma tabela ficou de fora e nada daquele tipo
   nunca sincronizou — sem erro nenhum na tela.

       node supabase/verificar.js

   As credenciais NÃO ficam aqui nem no repositório. O script lê de variáveis de
   ambiente ou de um arquivo .env local (que o .gitignore já ignora):

       SUPABASE_URL=https://xxxx.supabase.co
       SUPABASE_ANON_KEY=...

   Usa só a chave ANÔNIMA, que é pública por natureza — este script lê, nunca
   escreve, e não tem como criar nada. Criar tabela é DDL e exige o SQL Editor
   do painel ou uma conexão Postgres direta; nenhuma chave de API faz isso. */
'use strict';

const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------- credenciais --- */

function lerEnv() {
  const cfg = {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  };
  // Um .env local vence o ambiente: é onde a pessoa põe o projeto dela
  const arquivo = process.env.ENV_FILE || path.join(__dirname, '..', '.env');
  if (fs.existsSync(arquivo)) {
    for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const valor = m[2].replace(/^["']|["']$/g, '');
      if (m[1] === 'SUPABASE_URL') cfg.url = valor;
      if (m[1] === 'SUPABASE_ANON_KEY') cfg.anonKey = valor;
    }
  }
  cfg.url = cfg.url.replace(/\/$/, '');
  return cfg;
}

/* As mesmas tabelas e colunas que js/sync.js envia. Divergir daqui é o defeito
   que este script existe para pegar. */
const ESPERADO = {
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

// Colunas que TODA tabela sincronizada precisa ter
const COMUNS = ['id', 'family_id', 'updated_at', 'rev', 'deleted', 'server_at'];

/* A ESTRUTURA DA FAMÍLIA, conferida à parte: ela tem colunas próprias e não
   carrega o envelope de sincronização — é o que LIGA os aparelhos, não o que
   trafega entre eles.

   Ela ficava de fora, e foi exatamente onde o banco quebrou: `create table if
   not exists` numa tabela que já existe não acrescenta coluna, e o app pedia
   um 'codigo' que nunca chegou. */
const ESTRUTURA = {
  families: ['id', 'nome', 'codigo', 'criada_por', 'criada_em'],
  family_members: ['user_id', 'family_id', 'nome', 'entrou_em'],
};

/* --------------------------------------------------------- verificação --- */

(async () => {
  const cfg = lerEnv();
  if (!cfg.url || !cfg.anonKey) {
    console.log('Faltam as credenciais.\n');
    console.log('Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente, ou crie um');
    console.log('arquivo .env na raiz do projeto (ele já está no .gitignore):\n');
    console.log('  SUPABASE_URL=https://xxxx.supabase.co');
    console.log('  SUPABASE_ANON_KEY=...\n');
    console.log('Os dois ficam em Settings → API, no painel do Supabase.');
    process.exit(2);
  }

  console.log(`Projeto: ${cfg.url}\n`);

  let faltando = 0, ok = 0;
  const semTabela = [];

  /* A estrutura vem PRIMEIRO: sem ela, nada mais funciona — nem entrar numa
     casa, nem sincronizar uma linha. */
  for (const [tabela, colunas] of Object.entries(ESTRUTURA)) {
    const r = await fetch(`${cfg.url}/rest/v1/${tabela}?select=${colunas.join(',')}&limit=1`, {
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
    });
    if (r.ok) {
      console.log(`  OK    | ${tabela.padEnd(15)} existe, com as ${colunas.length} colunas da estrutura`);
      ok++;
      continue;
    }
    let detalhe = '';
    try { const d = await r.json(); detalhe = d.message || ''; } catch (_) {}
    console.log(` FALTA | ${tabela.padEnd(15)} ${detalhe || 'HTTP ' + r.status}`);
    faltando++;
  }

  for (const [tabela, colunas] of Object.entries(ESPERADO)) {
    /* Pede UMA linha só, com todas as colunas nomeadas. O PostgREST responde:
         404/PGRST205 → a tabela não existe
         400/42703    → a tabela existe, mas falta alguma coluna (e diz qual)
         200          → tudo certo (mesmo vazia, e o RLS filtrando tudo)
       Pedir as colunas pelo nome é o que transforma "a tabela existe" em "a
       tabela tem o que o app manda" — que é a pergunta que importa. */
    const campos = COMUNS.concat(colunas).join(',');
    const r = await fetch(`${cfg.url}/rest/v1/${tabela}?select=${campos}&limit=1`, {
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
    });

    if (r.ok) {
      console.log(`  OK    | ${tabela.padEnd(12)} existe, com as ${colunas.length + COMUNS.length} colunas que o app envia`);
      ok++;
      continue;
    }

    let detalhe = '';
    try { const d = await r.json(); detalhe = d.message || d.hint || ''; } catch (_) {}

    if (r.status === 404 || /PGRST205|does not exist|not find the table/i.test(detalhe)) {
      console.log(` FALTA | ${tabela.padEnd(12)} a tabela não existe`);
      semTabela.push(tabela);
    } else {
      console.log(` FALTA | ${tabela.padEnd(12)} ${detalhe || 'HTTP ' + r.status}`);
    }
    faltando++;
  }

  const total = Object.keys(ESPERADO).length + Object.keys(ESTRUTURA).length;
  console.log(`\n${ok}/${total} tabelas prontas.`);

  if (faltando) {
    console.log('\nO QUE FAZER:');
    console.log('  1. Abra o painel do Supabase → SQL Editor');
    console.log('  2. Cole o conteúdo de supabase/schema.sql');
    console.log('  3. Run');
    console.log('\nO schema é idempotente: rodar de novo não apaga nada, e é o jeito');
    console.log('certo de aplicar uma atualização — inclusive quando a tabela JÁ EXISTE');
    console.log('mas está sem uma coluna nova. Depois, rode este script outra vez.');
    process.exit(1);
  }

  /* A tabela existir não prova que o RLS está ligado. Uma tabela sem RLS deixa
     QUALQUER pessoa com a chave anônima (que é pública) ler a base inteira — e
     nada na tela do app denunciaria isso. */
  console.log('\nConferindo a proteção das linhas (RLS)…');
  const r = await fetch(`${cfg.url}/rest/v1/price_obs?select=id&limit=1`, {
    headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey },
  });
  const linhas = r.ok ? await r.json() : null;
  if (Array.isArray(linhas) && linhas.length > 0) {
    console.log('  ATENÇÃO: sem estar logado, a chave anônima devolveu dados.');
    console.log('  Isso significa RLS desligado em price_obs. Rode o schema.sql de novo.');
    process.exit(1);
  }
  console.log('  OK    | anônimo não lê nada — o RLS está fazendo o trabalho dele');
  console.log('\nBanco pronto. Configure no app em Ajustes → Sincronização.');
})();
