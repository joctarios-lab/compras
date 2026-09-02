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
- **F0 entregue.** Versão 1 (sw.js VERSAO + as tags ?v= do index.html andam
  JUNTAS a cada entrega — há teste travando isso).
- 165 testes em tests/smoke.js, todos passando: `node tests/smoke.js`
- A suíte em 9 datas de calendário: `node tests/tempo.js` — 9/9 verdes
- 16/16 sabotagens pegas na última rodada
- Próxima fase: **F1** — Lista + Modo Mercado + total do carrinho + Mais por Menos

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

## O que já está construído (F0)
```
index.html                 shell: topbar, main, dock de 3 abas; tema antes da 1ª pintura
css/styles.css             o sistema visual: 3 camadas de tema, tokens, componentes
js/config.js               vazio de propósito (repo público)
js/icons.js                ícones SVG inline — sem CDN, porque não há rede no mercado
js/ui.js                   moeda, máscara, folhas, toast, --teclado, wakeLock
js/db.js                   localStorage, envelope de sync, 9 stores, backup
js/app.js                  boot, troca de aba, tema, registro do service worker
sw.js                      app shell offline-first
manifest.webmanifest       id fixo, ícones, standalone
icons/                     icon.svg + os 3 PNGs (gerar-icones.ps1 os refaz)
tests/smoke.js             a suíte, com o relógio congelado
tests/tempo.js             a suíte em 9 datas de calendário
```

## O que a F0 já trava com teste (não quebre sem perceber)
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
- Depois de corrigir, **SABOTE o código e confirme que o teste reprova.** O
  script vive em `$CLAUDE_JOB_DIR/tmp/sabota-*.js`; restaure sempre num
  `finally` e confirme a restauração relendo o arquivo.
- **Sabotagem que passa é aviso, não alívio.** Na rodada da F0, a única que
  passou era teste vazio: nenhuma entrada do `esc()` tinha um `&`, então trocar
  split/join por replace não mudava nada. Investigue toda sabotagem não pega.
- **Teste tem de REPROVAR, não morrer.** Um `bruto.deleted` sem guarda derrubava
  a suíte na linha 150 e os cem testes seguintes nunca rodavam.
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
