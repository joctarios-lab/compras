# Prompt de retomada

Cole o bloco abaixo ao abrir uma sessão nova. Ele existe para que o assistente
não precise redescobrir nada — e, principalmente, para que não repita erros que
já custaram tempo aqui.

No app de finanças este arquivo nasceu tarde e houve redescoberta cara. Aqui ele
nasce na F0.

---

```
Vamos continuar o CESTA, o PWA de compras de mercado, em
D:\Projetos\meus-projetos\compras (repo: github.com/joctarios-lab/compras, main).

Leia primeiro, nesta ordem:
  docs/PROMPT-INICIAL.md    ← o plano inteiro; a seção 13 lista o que não se reverte
  docs/pesquisa-mercado.md  ← concorrentes e por que a NFC-e é importada por arquivo
  este arquivo              ← o estado atual e as decisões já tomadas

## Estado atual
- **F0 a F9 entregues.** Versão 2 (sw.js VERSAO + as tags ?v= do index.html andam
  JUNTAS a cada entrega — há teste travando isso).
- 426 testes em tests/smoke.js, todos passando: `node tests/smoke.js`
- A suíte em 9 datas de calendário: `node tests/tempo.js` — 9/9 verdes
- **45/45 sabotagens pegas**: `node tests/sabotagem.js` — agora VERSIONADO, em vez
  de viver num script temporário que se perde entre sessões, como no DOMI.
- O que falta não é código: é **usar no mercado de verdade**. Ver "O que só o uso
  vai dizer", no fim deste arquivo.

## O que cada fase entregou
| | |
|---|---|
| F1 | Lista com catálogo por frequência, Modo Mercado, total do carrinho, orçamento, Mais por Menos |
| F2 | `js/precos.js`: unidade canônica, mediana em 6 meses, diagnóstico, encolhimento de embalagem |
| F3 | `js/nfce.js` + `js/importar.js`: XML/HTML/CSV → canônico, dedupe por chave, casamento assistido, vínculo aprendido |
| F4 | Fechamento, conferidor de caixa, histórico, cesta comparável, o que mais subiu, cadência |
| F5 | `js/fotos.js`: IndexedDB, compressão, faxina de órfãs |
| F6 | `js/leitura.js`: BarcodeDetector com limitação declarada, QR da nota |
| F7 | OCR opcional do selo, desligado por padrão, chave do usuário |
| F8 | `js/sync.js` + `supabase/schema.sql`: push/pull por `server_at`, RLS por dono |
| F9 | Onde a cesta sai mais barata (cesta fechada entre lojas) |

## Decisões já tomadas (não reabrir sem conversa)
- **O nome é CESTA**, e o `id` do manifest é `/compras/?app=cesta`. Trocar o id
  cria um app novo em vez de atualizar o que está na tela inicial de quem usa.
- **Repositório público** → `js/config.js` fica vazio, sempre. Credencial se
  digita no app.
- **Limiar do diagnóstico: 7%.** Constante única, lida por todo mundo.
- **Janela da referência: 6 meses.**
- **Tema: o Modo Mercado herda o tema do app** (escuro por padrão), decisão do
  usuário contra a recomendação de forçar claro lá. A mitigação combinada é o
  reforço de contraste: `.modo-mercado .diag` tem fonte maior e borda de 2px.
  **Se o app for testado no mercado e o selo ficar lavado sob luz fluorescente,
  a conversa se reabre** — a informação estará no uso real, não aqui.
- **NFC-e: o formato se decide na F3**, contra uma nota real do usuário. O
  parser se escreve contra o arquivo de verdade, não contra a especificação.

## O que está construído
```
index.html                 shell: topbar, conteúdo, dock de 3 abas; tema antes da 1ª pintura
css/styles.css             o sistema visual: 3 camadas de tema, tokens, telas
js/config.js               vazio de propósito (repo público)
js/icons.js                ícones SVG inline — sem CDN, porque não há rede no mercado
js/ui.js                   moeda, máscara, folhas, toast, --teclado, wakeLock
js/db.js                   localStorage, envelope de sync, 9 stores, catálogo, carrinho
js/precos.js               O MOTOR: unidade canônica, mediana, diagnóstico, cesta, cadência
js/nfce.js                 leitura de NFC-e: XML, HTML e CSV → uma estrutura só
js/importar.js             dedupe, casamento assistido e o vínculo aprendido
js/fotos.js                IndexedDB, compressão, faxina de fotos órfãs
js/leitura.js              código de barras (com a limitação do iOS declarada) e OCR
js/sync.js                 push/pull incremental por server_at
js/views/*.js              lista, mercado, ferramentas, histórico, importar, ajustes, sync, câmera
js/app.js                  boot, troca de aba, entrada no Modo Mercado
sw.js                      app shell offline-first
manifest.webmanifest       id fixo, ícones, standalone
supabase/schema.sql        tabelas, server_at e RLS por dono
tests/smoke.js             a suíte (426), com o relógio congelado
tests/tempo.js             a suíte em 9 datas de calendário
tests/sabotagem.js         as 45 quebras propositais que provam a suíte
```

## O que já está travado com teste (não quebre sem perceber)
- O envelope de sync existe em TODA store, desde o primeiro registro.
- Apagar é marcar apagado (soft delete); remover a linha faria o registro
  ressuscitar no primeiro pull da F8.
- Store nova numa base antiga vira lista vazia, nunca undefined.
- A VERSAO do sw.js e todas as tags `?v=` do index andam juntas.
- Todo arquivo listado no SHELL existe (addAll falha inteiro por um 404 — e aí
  o app fica sem cache nenhum, offline, dentro do mercado).
- Todo script do index está no cache do shell.
- Todo `data-ico` do shell tem verbete em icons.js.
- Todo ícone declarado no manifest existe.
- Nenhum token de cor tem definição única dentro de um media query.
- As duas camadas claras (auto e explícita) cobrem os mesmos tokens.
- Toda tinta tem os cinco tokens: `--x`, `--x-ink`, `--x-soft`, `--x-borda`,
  `--x-contraste`.
- O cinza do "primeiro registro" existe e **não é a cor do "na média"**.
- O alvo de toque do mercado é maior que o do resto do app.
- A folha se apoia acima do teclado (`margin-bottom: var(--teclado)`).
- Não há gradiente no sistema visual.

## Como trabalhamos aqui (siga)
- Diagnostique medindo, não supondo. Reproduza o defeito antes de corrigir.
- **NUNCA escreva data absoluta em teste.** Escreva a relação ("faz 60 dias", "o
  último dia deste mês"). Antes de dar por bom, rode `node tests/tempo.js` —
  verde num dia só não é verde.
- Depois de corrigir, **SABOTE o código e confirme que o teste reprova**:
  `node tests/sabotagem.js`. Acrescente um caso para cada regra nova.
- **Sabotagem que passa é aviso, não alívio.** Já aconteceu sete vezes aqui, e
  as sete eram TESTE VAZIO — o teste existia, rodava, e não exercitava a regra:
    · o `esc()` sem nenhum `&` na entrada (F0);
    · a cesta comparável testada só pelo lado que o laço nunca percorre;
    · a recusa de unidade testada na tela, não na porta de entrada;
    · o casamento por nome testado numa linha de confiança "nenhuma";
    · o pull sem teste nenhum — o que existia olhava o schema;
    · o RLS conferido por substring que aparecia noutro lugar do arquivo.
  Investigue TODA sabotagem não pega, sem exceção.
- **Teste tem de REPROVAR, não morrer.** Um `bruto.deleted` sem guarda derrubava
  a suíte na linha 150 e os cem testes seguintes nunca rodavam. O mesmo modo de
  falhar atingiu o próprio `tests/sabotagem.js`: um buraco no array de casos
  lançava, e o `process.exit` do `finally` engolia o erro — ele anunciava
  "16/46 pegas" sem ninguém notar que 30 casos jamais rodaram.
- Comentários e mensagens de commit em português, explicando o PORQUÊ.
- Confirme o push consultando o servidor (`git ls-remote`), não só o git status.
- Módulos pequenos: **teto de 1.500 linhas por arquivo**. As telas vão para
  `js/views/*.js`. O app.js do DOMI chegou a 607 KB por não ter tido essa regra.

## Armadilhas de ferramenta
- `$` numa string de substituição do `replace()` é padrão especial: `'R$'`
  corrompe o arquivo. Use `split`/`join`.
- No Node 20+, `crypto` e `navigator` são **getters** no global e não aceitam
  atribuição: use `Object.defineProperty` nos stubs da suíte, senão ela nem
  carrega.
- Heredoc no bash quebra com aspas e acentos: escreva o script num arquivo.
- Não há `gh` nesta máquina; o push HTTPS usa o credential manager do Windows.
- Comentário HTML dentro de template literal: a crase quebra o arquivo, e o
  texto do comentário É renderizado — um teste que procura um literal casa com
  o comentário e passa sem testar nada.

## Decisões de arquitetura que não devem ser revertidas
- `price_obs` é a **fonte única** de toda comparação; o diagnóstico é derivado,
  nunca gravado.
- A comparação é sempre em **unidade canônica** (R$/kg, R$/L, R$/un).
- Referência = **mediana** em janela de 6 meses. Não média, não histórico inteiro.
- **n = 0 é ⚪ "primeiro registro", nunca 🟡 "na média".**
- **Cesta comparável ≠ total gasto.** Dois números, dois nomes.
- Casamento de descrição de PDV **sugere, nunca aplica sozinho**; unidade
  desconhecida fica de fora, não vira `un` por omissão.
- Dedupe de NFC-e **pela chave de acesso**, sempre.
- Fotos vivem no **IndexedDB**, comprimidas. Nunca no localStorage.
- O **Modo Mercado não abre diálogo** para nada, e não mostra spinner.
- **A cor nunca informa sozinha.**
- **Nada dentro do mercado pode depender de rede.**

## O que eu quero fazer agora
[escreva aqui]
```

---

## O que só o uso vai dizer

O código está completo e testado, mas três coisas não se resolvem por teste — só
por uma ida ao mercado com o app na mão. Estão anotadas para não se perderem:

1. **O selo sob luz fluorescente.** O Modo Mercado herda o tema escuro, decisão
   do usuário contra a recomendação de forçar o claro lá. A mitigação foi
   reforçar contraste (`.modo-mercado .diag`: 16px, borda de 2px). Se o selo
   lavar no corredor, a conversa se reabre — e a saída pronta é o tema claro só
   nesse modo.
2. **O parser de HTML da NFC-e.** Ele foi escrito contra o formato COMUM dos
   portais, não contra uma nota real do usuário. A primeira nota de verdade vai
   apontar o que falta — é esperado, e é por isso que o CSV existe como saída.
3. **A fricção real do painel de preço.** Três campos (preço, quantidade,
   unidade) é o mínimo teórico. Se na prática a quantidade quase nunca muda,
   ela deve virar um toque secundário e sair do caminho.

## Sabotagens a reescrever quando o código andar

`tests/sabotagem.js` casa trechos literais do código. Quando um trecho mudar, o
caso aparece como **ERRO — sabotagem a reescrever**, e isso NÃO é defeito do app:
é a sabotagem envelhecendo. Reescreva-a apontando para o novo trecho, nunca
apague o caso.

---

## v3 — o app passou a se apresentar (setembro/2026)

O retorno do primeiro uso real foi: *"acessei pela primeira vez e não entendi
nada do que tem que ser feito"*. Estava certo. O que mudou:

- **`js/onboarding.js`** — cinco telas que ensinam FAZENDO: o que a pessoa
  escolhe vira a lista dela. Pulável sempre. Mais a Ajuda, com as perguntas que
  as pessoas fazem de verdade.
- **`js/catalogo.js`** — ~55 itens de casa brasileira com a unidade da etiqueta,
  e os corredores em **ordem de mercado**. A lista se organiza como a loja.
- **Desktop** — sidebar acima de 900px. Teste exige que toda aba exista nos dois
  modos.
- **`js/views/produtos.js`** — "Meus produtos": o que faz alguém abrir o app
  fora do mercado.
- **`js/auth.js` + `js/bloqueio.js`** — PIN que deriva a chave, AES-256-GCM,
  digital por WebAuthn/PRF, bloqueio progressivo.
- **`js/views/familia.js`** — código de seis caracteres, `pegou_por` em cada
  item, e o **escopo do banco virou familiar** (`family_id`).

### A mudança de escopo, e por quê

Era pessoal (`auth.uid()`), virou familiar (`family_id`). **Não reverta sem
conversa:** se a lista é compartilhada, o histórico de preços também precisa
ser — senão quem está no mercado não vê o diagnóstico construído pelas compras
da outra pessoa da casa, e o app perde metade do valor para quem divide as
compras.

### Pendente: o banco

O projeto **domi-compras** foi criado no Supabase, mas o `schema.sql` ainda
**não foi executado** e as credenciais ainda não estão no `.env` local. Sem
isso, o app funciona inteiro offline — só não sincroniza. Ver
[`supabase/README.md`](../supabase/README.md).

### Armadilhas que voltaram a morder nesta rodada

- **`$` no `replace()`**: `'R$'` numa string de substituição corrompeu
  `tests/smoke.js` no meio do caminho. Use `split`/`join`, sempre.
- **Bash comendo template literal**: `${...}` dentro de `node -e` no shell vira
  expansão. Escreva o script num arquivo — como o RETOMADA já mandava.
- **Teste vazio, de novo**: com `navigator.onLine = false`, o sync devolvia null
  antes de checar a família, e a asserção passava sem exercitar a guarda. Mede-se
  se o **fetch aconteceu**, não o valor devolvido.
