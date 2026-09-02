# Abrir sessão — o prompt curto

Este é o bloco que se cola no chat. Ele não repete o plano: **manda ler** o plano,
na ordem certa, e fixa as poucas coisas que não podem se perder no meio do
caminho. O documento longo é `docs/PROMPT-INICIAL.md`.

---

```
Projeto novo: PWA de Gestão Inteligente e Comparativa de Compras de Mercado, em
D:\Projetos\meus-projetos\compras.

Você atua como Especialista de Produto E Arquiteto — não só como executor. Se
enxergar um defeito no plano, aponte em duas linhas e siga, com a premissa
declarada.

## Leia primeiro, nesta ordem, antes de escrever qualquer linha

1. docs/PROMPT-INICIAL.md      ← o plano inteiro. É a fonte da verdade deste projeto.
                                 A seção 13 lista o que NÃO se reverte sem conversa.
2. docs/pesquisa-mercado.md    ← concorrentes, e por que a NFC-e é importada por
                                 arquivo (CORS e captcha impedem o resto)

E, no app de finanças em D:\Projetos\meus-projetos\financas — de onde vêm a
arquitetura, a identidade visual e as lições:

3. docs/RETOMADA.md            ← leia as seções "IDENTIDADE DOMI", "Como
                                 trabalhamos aqui", "Armadilhas de ferramenta" e
                                 "Decisões que não devem ser revertidas"
4. css/styles.css + index.html ← o design system: tokens, as três camadas de
                                 tema, tipografia, cards, selos, folhas
5. docs/plano-testes.md        ← por que o relógio da suíte é congelado
6. tests/smoke.js (primeiras   ← o harness: relógio congelado, stubs de navegador,
   ~160 linhas)                  o helper check()

## O que eu quero

Implementar o produto inteiro, da F0 à F9 (seção 10 do plano), entregando fase a
fase para eu revisar. Duas coisas valem mais que qualquer detalhe de escopo:

- **A identidade visual e o design system são os do app de finanças.** Mesma
  linguagem: tema duplo com a paleta em três camadas, quatro tokens por tinta,
  a cor pertencendo ao dado e não ao enfeite. Não invente um visual novo —
  herde aquele e adapte ao contexto de mercado.
- **O objetivo é a ida ao mercado ser prazerosa e eficiente.** Toda decisão de
  tela se julga por isso: menos toques, menos espera, menos dúvida, no corredor,
  com uma mão só. Zero spinner e zero dependência de rede lá dentro.

## Antes de escrever a Parte 1 — três coisas, nesta ordem

1. Confirme a leitura resumindo em até 10 linhas o que você entendeu como o
   núcleo do produto e o que mudaria no plano, como Especialista de Produto.
2. Resolva comigo as decisões pendentes da tabela ao fim do PROMPT-INICIAL.md.
   A #1 (o nome, que vira o `id` do manifest) é a única irreversível — não
   comece a F0 sem ela.
3. Proponha o plano da F0 e da F1 antes de codificar.

Depois disso, comece pela F0. Cada fase fecha do jeito descrito na seção 11.5:
`node --check` → suíte verde → tests/tempo.js verde → sabotagens pegas → VERSAO e
as tags ?v= subidas juntas → docs/ atualizado → commit em português.
```

---

## Como isto se encaixa

| Arquivo | Papel | Quando usar |
|---|---|---|
| `docs/ABRIR-SESSAO.md` | O bloco curto, colável | Na primeira sessão |
| `docs/PROMPT-INICIAL.md` | O plano completo | Lido pelo assistente, não colado |
| `docs/pesquisa-mercado.md` | Concorrência e viabilidade | Lido junto do plano |
| `docs/RETOMADA.md` | Substitui este arquivo | A partir da segunda sessão — escreva-o na entrega da F0 |

**Nota sobre a sua edição na seção 14:** ela agora pede as fases todas, mas a
frase seguinte ainda diz "antes de escrever a Parte 1", que era das três partes
do pedido antigo. O prompt acima resolve isso definindo os três passos de
abertura; se quiser, dá para apagar a frase órfã lá do documento longo.
