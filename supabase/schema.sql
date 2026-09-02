-- CESTA — banco e segurança para a sincronização opcional.
--
-- Rode uma vez no SQL Editor do seu projeto Supabase. É IDEMPOTENTE: pode rodar
-- de novo depois de uma atualização do app, sem perder nada.
--
-- O ESCOPO É PESSOAL (auth.uid()), não familiar: um histórico de preços é de
-- quem o construiu, e compartilhá-lo por padrão mandaria o consumo de alguém
-- para a conta de outra pessoa sem que ninguém tivesse pedido.

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
    -- coluna de carimbo do servidor + índice, em toda tabela sincronizada
    execute format('alter table if exists public.%I
                    add column if not exists server_at timestamptz not null default now()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_at)',
                   'idx_' || t || '_user_server', t);
    -- o gatilho que mantém o carimbo em toda escrita
    execute format('drop trigger if exists trg_server_at on public.%I', t);
    execute format('create trigger trg_server_at before insert or update on public.%I
                    for each row execute function public.marcar_server_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- tabelas ---

create table if not exists public.stores (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  apelido text,
  bairro text,
  cnpj text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  categoria text,
  unidade text,
  qtd_habitual numeric,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.products (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid,
  marca text,
  embalagem_qtd numeric,
  embalagem_unidade text,
  ean text,
  descricao_pdv text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.lists (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text,
  status text,
  store_id uuid,
  orcamento numeric,
  data_abertura date,
  data_fechamento date,
  total_cupom numeric,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.list_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid,
  item_id uuid,
  product_id uuid,
  qtd numeric,
  unidade text,
  comprado boolean default false,
  nao_tinha boolean default false,
  preco_total numeric,
  obs_id uuid,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- A FONTE ÚNICA de toda comparação. O diagnóstico NÃO é gravado: ele é sempre
-- derivado daqui, para não existirem dois números que discordam quando a regra
-- mudar.
create table if not exists public.price_obs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  deleted boolean not null default false
);

create table if not exists public.nfce_docs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  store_id uuid,
  data date,
  total numeric,
  itens_importados int,
  formato text,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- Uma nota por pessoa, nunca duas: é o dedupe do lado do servidor, para dois
-- aparelhos importando a mesma nota ao mesmo tempo não a duplicarem.
create unique index if not exists idx_nfce_chave_por_user
  on public.nfce_docs (user_id, chave) where deleted = false;

create table if not exists public.aliases (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid,
  texto_pdv text not null,
  product_id uuid,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

-- ------------------------------------------------------------------- RLS ---
-- Cada pessoa só enxerga e escreve as próprias linhas. Sem isto, a chave anon
-- (que é pública por natureza) daria a qualquer um acesso à base inteira.

do $$
declare
  t text;
  tabelas text[] := array['stores','items','products','lists','list_items',
                          'price_obs','nfce_docs','aliases'];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_proprio', t);
    execute format('create policy %I on public.%I
                    for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
                   t || '_proprio', t);
  end loop;
end $$;
