# Criar o banco do CESTA

**Antes de tudo: o app não precisa disto para funcionar.** Ele é local-first e
roda inteiro, offline, sem conta nenhuma. O banco existe só para sincronizar o
histórico entre dois aparelhos — se você usa um celular só, pode pular esta
pasta inteira e continuar usando o app normalmente.

O banco vai num **projeto Supabase próprio**, separado do app de finanças.

## Por que um projeto separado

As oito tabelas do CESTA (`stores`, `items`, `products`, `lists`, `list_items`,
`price_obs`, `nfce_docs`, `aliases`) não colidem com as vinte e uma do DOMI —
isso foi conferido. Tecnicamente caberiam no mesmo projeto.

Separar mesmo assim vale por três motivos: apagar, restaurar ou migrar uma base
nunca põe a outra em risco; as chaves de API são distintas, então vazar uma não
expõe a outra; e o escopo é diferente — o DOMI é **familiar** (`family_id`,
todos veem tudo) e o CESTA é **pessoal** (`auth.uid()`, cada um vê o seu
histórico). Misturar dois modelos de permissão na mesma base é onde nascem os
vazamentos difíceis de enxergar.

## Passo a passo (uma vez, ~10 minutos)

**1. Crie o projeto.** Em [supabase.com](https://supabase.com) → **New project**.
Escolha a região mais próxima (São Paulo, se houver) e guarde a senha do banco
que ele pedir — ela não é usada pelo app, mas é a única forma de acessar o
Postgres direto depois.

**2. Rode o schema.** No painel: **SQL Editor** → **New query** → cole o conteúdo
inteiro de [`schema.sql`](schema.sql) → **Run**.

Deve terminar com *Success*. Se aparecer erro, copie a mensagem — o script é
idempotente e pode ser rodado de novo depois de corrigido, sem perder nada.

**3. Pegue as credenciais.** **Settings → API**, e copie:
- **Project URL** (`https://xxxx.supabase.co`)
- a chave **anon public** — é ela que vai no app, e é pública por natureza: quem
  protege os dados é o RLS, não o segredo da chave.

> Nunca use a chave **service_role** no app. Ela ignora o RLS por completo e daria
> a qualquer pessoa acesso à base inteira.

**4. Confira que ficou tudo certo:**

```bash
# na raiz do projeto, crie um .env (o .gitignore já o ignora)
#   SUPABASE_URL=https://xxxx.supabase.co
#   SUPABASE_ANON_KEY=...
node supabase/verificar.js
```

Ele confere as oito tabelas, **coluna por coluna**, contra o que o app realmente
envia — e testa se o RLS está mesmo bloqueando leitura anônima. Rodar o SQL e
supor que deu certo é o jeito fácil de descobrir semanas depois que uma tabela
ficou de fora e nada daquele tipo nunca sincronizou, sem erro nenhum na tela.

**5. Ligue no app.** Abra o CESTA → **⚙︎ Ajustes → Configurar sincronização** →
cole a URL e a chave → **Salvar** → crie a conta com e-mail e senha.

No segundo aparelho, os mesmos passos e **o mesmo login** — é a conta que liga os
dois. Em *Authentication → Providers → Email*, desligar "Confirm email" simplifica
o primeiro acesso.

## Como o banco é protegido

Cada tabela tem **RLS** com a política `user_id = auth.uid()`, na leitura e na
escrita: cada pessoa só enxerga as próprias linhas. É o que torna seguro publicar
a chave anônima.

## O carimbo do servidor

Toda tabela tem `server_at`, preenchido por gatilho a cada escrita, e é ele — não
o relógio do aparelho — que marca até onde a sincronização já leu.

No app de finanças, usar o relógio do cliente causou **perda silenciosa de
registros**: um aparelho que ficou offline gravava com o horário dele, o outro
pedia "o que mudou desde X" pelo horário próprio, e o que caía entre os dois
relógios nunca mais era buscado. Não dava erro nenhum — os dados apenas sumiam.

`updated_at` continua existindo, mas serve só para resolver conflito quando os
dois aparelhos editam a mesma linha (vence o mais recente).

## Atualizações futuras

Quando o app ganhar campos novos, rode o `schema.sql` de novo: ele é idempotente
— `create table if not exists`, `add column if not exists`, gatilhos e políticas
derrubados antes de recriados. Nada é apagado. Depois, `node supabase/verificar.js`
para confirmar.
