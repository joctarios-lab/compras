-- CESTA — banco e segurança para a sincronização opcional.
--
-- ESTE SCHEMA VAI NUM PROJETO SUPABASE PRÓPRIO (domi-compras), separado do app
-- de finanças. As tabelas daqui não colidem com as do DOMI, mas separar mantém
-- as bases independentes: apagar, restaurar ou migrar uma nunca põe a outra em
-- risco, e as chaves de API são distintas.
--
-- Rode uma vez no SQL Editor do projeto. É IDEMPOTENTE: pode rodar de novo
-- depois de uma atualização do app, sem perder nada.
--
-- Depois de rodar, confira com:  node supabase/verificar.js
-- Ele diz se alguma tabela ficou de fora e se o RLS está mesmo ligado — rodar o
-- SQL e supor que deu certo é o jeito fácil de descobrir semanas depois que
-- algo nunca sincronizou.
--
-- O ESCOPO É FAMILIAR, não pessoal. Se a lista é compartilhada, o histórico de
-- preços também precisa ser: senão quem está no mercado não veria o diagnóstico
-- baseado nas compras que a outra pessoa da casa fez, e o app perderia metade do
-- valor justamente para quem divide as compras.

-- ------------------------------------------------------------- família ---

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- O código que se dita por telefone. Único: dois códigos iguais fariam
  -- alguém entrar na casa errada.
  codigo text not null unique,
  criada_por uuid references auth.users(id),
  criada_em timestamptz not null default now()
);

create table if not exists public.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  nome text not null,
  entrou_em timestamptz not null default now()
);

create index if not exists idx_membros_familia on public.family_members (family_id);

-- A família de quem está pedindo. SECURITY DEFINER e search_path fixo: sem
-- isso, a própria política de RLS de family_members consultaria a tabela que
-- ela protege, e o Postgres entra em recursão infinita.
create or replace function public.minha_familia()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid()
$$;

-- ------------------------------------------------------------- tabelas ---

create table if not exists public.stores (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  nome text not null,
  apelido text,
  bairro text,
  cnpj text,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

create table if not exists public.items (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  nome text not null,
  categoria text,
  unidade text,
  qtd_habitual numeric,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

create table if not exists public.products (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  item_id uuid,
  marca text,
  embalagem_qtd numeric,
  embalagem_unidade text,
  ean text,
  descricao_pdv text,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

create table if not exists public.lists (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  nome text,
  status text,
  store_id uuid,
  orcamento numeric,
  data_abertura date,
  data_fechamento date,
  total_cupom numeric,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

create table if not exists public.list_items (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  list_id uuid,
  item_id uuid,
  product_id uuid,
  qtd numeric,
  unidade text,
  comprado boolean default false,
  nao_tinha boolean default false,
  preco_total numeric,
  obs_id uuid,
  -- Quem pegou o item. É o que faz duas pessoas no mesmo mercado não pegarem a
  -- mesma coisa duas vezes — o ganho concreto da lista compartilhada.
  pegou_por text,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

-- A FONTE ÚNICA de toda comparação. O diagnóstico NÃO é gravado: ele é sempre
-- derivado daqui, para não existirem dois números que discordam quando a regra
-- mudar.
create table if not exists public.price_obs (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  product_id uuid,
  item_id uuid,
  store_id uuid,
  data date not null,
  preco_total numeric not null,
  qtd numeric,
  unidade text,
  qtd_canonica numeric,
  unidade_base text,
  preco_base numeric,
  origem text,
  foto_id text,
  nfce_chave text,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

create table if not exists public.nfce_docs (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  chave text not null,
  store_id uuid,
  data date,
  total numeric,
  itens_importados int,
  formato text,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

-- Uma nota por família, nunca duas: é o dedupe do lado do servidor, para dois
-- aparelhos importando a mesma nota ao mesmo tempo não a duplicarem.
create unique index if not exists idx_nfce_chave_por_familia
  on public.nfce_docs (family_id, chave) where deleted = false;

create table if not exists public.aliases (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  store_id uuid,
  texto_pdv text not null,
  product_id uuid,
  updated_at timestamptz not null default now(),
  rev int not null default 1,
  deleted boolean not null default false
);

-- ----------------------------------------------------------- migração ---
--
-- TODA COLUNA QUE O APP USA, GARANTIDA UMA A UMA.
--
-- `create table if not exists` numa tabela que já existe não faz NADA — nem
-- acrescenta as colunas novas. Quem rodou uma versão anterior deste arquivo
-- ficava com a tabela antiga para sempre, e o app quebrava pedindo uma coluna
-- que nunca chegou:
--
--     Could not find the 'codigo' column of 'families' in the schema cache
--
-- Este bloco resolve isso e é o que torna o schema realmente idempotente: num
-- banco vazio ele não faz nada (o create table já criou tudo), e num banco
-- antigo ele acrescenta exatamente o que falta.
--
-- REGRA: toda coluna nova que o app passar a enviar entra AQUI também, e não só
-- no create table acima. Senão o defeito volta na próxima atualização.

do $
declare
  c record;
  colunas text[][] := array[
    -- família
    ['families', 'nome', 'text'],
    ['families', 'codigo', 'text'],
    ['families', 'criada_por', 'uuid'],
    ['families', 'criada_em', 'timestamptz not null default now()'],
    ['family_members', 'nome', 'text'],
    ['family_members', 'entrou_em', 'timestamptz not null default now()'],

    -- o contador de versão, que protege o envio contra perda: ele é comparado
    -- antes de marcar um registro como enviado
    ['stores', 'rev', 'int not null default 1'],
    ['items', 'rev', 'int not null default 1'],
    ['products', 'rev', 'int not null default 1'],
    ['lists', 'rev', 'int not null default 1'],
    ['list_items', 'rev', 'int not null default 1'],
    ['price_obs', 'rev', 'int not null default 1'],
    ['nfce_docs', 'rev', 'int not null default 1'],
    ['aliases', 'rev', 'int not null default 1'],

    -- quem pegou o item, na lista compartilhada
    ['list_items', 'pegou_por', 'text'],

    -- o ciclo da compra: mensal, semanal, do dia, evento
    ['lists', 'ciclo', 'text'],

    -- campos que chegaram depois da primeira versão
    ['stores', 'cnpj', 'text'],
    ['products', 'descricao_pdv', 'text'],
    ['price_obs', 'nfce_chave', 'text'],
    ['price_obs', 'foto_id', 'text'],
    ['nfce_docs', 'formato', 'text']
  ];
begin
  for i in 1 .. array_length(colunas, 1) loop
    -- to_regclass devolve nulo quando a tabela ainda não existe: pular é o
    -- certo, porque o create table acima cuidará dela na ordem natural
    if to_regclass('public.' || colunas[i][1]) is not null then
      execute format('alter table public.%I add column if not exists %I %s',
                     colunas[i][1], colunas[i][2], colunas[i][3]);
    end if;
  end loop;
end $;

-- O código só pode ser único DEPOIS de a coluna existir — num banco antigo, o
-- índice criado junto do create table nunca chegou a ser feito.
create unique index if not exists idx_families_codigo on public.families (codigo);

-- ------------------------------------------------- carimbo do servidor ---
-- DEPOIS das tabelas, e não antes: numa base nova o `alter table if exists`
-- passa em silêncio, mas o `create index` da linha seguinte aborta com
-- "relation does not exist" e derruba o script inteiro — nenhuma tabela seria
-- criada, e o único sinal seria o erro no painel.
--
-- server_at é O CARIMBO DO SERVIDOR e o marcador do pull. Sem ele, um aparelho
-- que ficou offline grava com o próprio relógio, o outro pergunta "o que mudou
-- desde X" pelo relógio dele, e o que cai entre os dois relógios SOME sem erro.

create or replace function public.marcar_server_at()
returns trigger language plpgsql as $$
begin
  new.server_at = now();
  return new;
end $$;

do $$
declare
  t text;
  tabelas text[] := array['stores','items','products','lists','list_items',
                          'price_obs','nfce_docs','aliases'];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I
                    add column if not exists server_at timestamptz not null default now()', t);
    execute format('create index if not exists %I on public.%I (family_id, server_at)',
                   'idx_' || t || '_familia_server', t);
    execute format('drop trigger if exists trg_server_at on public.%I', t);
    execute format('create trigger trg_server_at before insert or update on public.%I
                    for each row execute function public.marcar_server_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------- RLS ---
-- Cada família só enxerga e escreve as próprias linhas. Sem isto, a chave anon
-- (que é pública por natureza) daria a qualquer um acesso à base inteira.

alter table public.families enable row level security;
drop policy if exists families_ler on public.families;
-- Ler pelo código é o que permite ENTRAR numa família: quem tem o código entra,
-- e é por isso que o código tem seis caracteres aleatórios em vez de um número
-- sequencial. Só leitura — ninguém altera a família de outra pessoa.
create policy families_ler on public.families for select using (true);
drop policy if exists families_criar on public.families;
create policy families_criar on public.families for insert with check (auth.uid() = criada_por);

alter table public.family_members enable row level security;
drop policy if exists membros_ler on public.family_members;
create policy membros_ler on public.family_members
  for select using (family_id = public.minha_familia());
drop policy if exists membros_entrar on public.family_members;
create policy membros_entrar on public.family_members
  for insert with check (user_id = auth.uid());
drop policy if exists membros_editar on public.family_members;
create policy membros_editar on public.family_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists membros_sair on public.family_members;
create policy membros_sair on public.family_members
  for delete using (user_id = auth.uid());

do $$
declare
  t text;
  tabelas text[] := array['stores','items','products','lists','list_items',
                          'price_obs','nfce_docs','aliases'];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_da_familia', t);
    execute format('create policy %I on public.%I
                    for all using (family_id = public.minha_familia())
                    with check (family_id = public.minha_familia())',
                   t || '_da_familia', t);
  end loop;
end $$;
