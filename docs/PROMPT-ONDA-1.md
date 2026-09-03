# Prompt — Onda 1: o assistente nasce

Cole o bloco ao abrir a sessão da Onda 1. A visão inteira está em
[`VISAO-ASSISTENTE.md`](VISAO-ASSISTENTE.md); aqui está o que se constrói agora.

---

```
Vamos transformar o CESTA de comparador de preços em ASSISTENTE DE GESTÃO DE
COMPRAS DA CASA, em D:\Projetos\meus-projetos\compras
(repo: github.com/joctarios-lab/compras · publicado em
joctarios-lab.github.io/compras).

Leia primeiro:
  docs/VISAO-ASSISTENTE.md   ← a tese nova, as páginas e as quatro ondas
  docs/RETOMADA.md           ← estado atual, decisões e armadilhas
  docs/PROMPT-INICIAL.md §13 ← as invioláveis, que continuam valendo

## A MUDANÇA DE TESE, em uma frase

O corredor é 20 minutos de um processo que dura o mês. O app resolve bem os 20
minutos e ignora o mês — e é no mês que a família perde dinheiro e tempo.

A promessa passa a ser: "você nunca mais vai ao mercado sem saber o que precisa,
quanto vai custar e se o preço está bom".

## O PRINCÍPIO QUE NÃO SE NEGOCIA

**Todo recurso que exige manutenção manual precisa se pagar sozinho. Prefira
DERIVAR a PERGUNTAR.**

É o que separa este app de todo app de despensa que já morreu: ninguém mantém
inventário. O que a pessoa compra ENTRA sozinho; o consumo é estimado pela
cadência que o app já calcula; ela só corrige o que estiver errado.

E o corolário: **quando o app não souber, ele cala a boca.** A previsão só
aparece com histórico que a sustente — do mesmo jeito que o diagnóstico mostra
⚪ em vez de inventar um veredito. Um assistente que chuta é pior que nenhum.

=============================================================
O QUE SE CONSTRÓI NESTA ONDA
=============================================================

### 1. A página HOJE (nova página inicial)

Responde "o que eu preciso saber agora?". É a única tela que se abre sem uma
tarefa em mente, e é o que dá ao app um motivo para ser aberto fora do mercado.

Blocos, nesta ordem:
  a) A PRÓXIMA COMPRA — tipo, data, loja, orçamento, nº de itens. Botões:
     revisar a lista · entrar no mercado.
  b) ESTÁ ACABANDO — até 6 itens que devem faltar antes da próxima compra.
     Um toque põe na lista. Cada um DIZ POR QUÊ ("comprou 5 kg em 12/09,
     você consome ~1,2 kg por semana").
  c) O MÊS ATÉ AGORA — gasto, orçamento, projeção de fechamento, selo de
     situação. A projeção usa o RITMO do mês, não regra de três sobre o total:
     no DOMI, o run-rate ingênuo projetou R$ 162.807 num mês de R$ 17.981.
  d) O CONSELHEIRO — no máximo 3 avisos, e SÓ os que têm ação. Mais que isso
     vira ruído e a pessoa para de ler.
  e) ATALHOS — item de emergência · foto de etiqueta · Mais por Menos.

Estado vazio: cada bloco que ainda não tem dado explica o que fazer para
ganhá-lo, em vez de sumir ou mostrar zero.

### 2. A DESPENSA DERIVADA (js/despensa.js)

O coração do assistente. Nunca é digitada:

  ENTRADA   fechar uma compra ou importar uma NFC-e põe o item na despensa,
            com data e quantidade.
  SAÍDA     o consumo é estimado pela cadência (Precos.cadencia já existe):
            se você compra 5 kg de arroz a cada 30 dias, consome ~1,2 kg/semana.
  CORREÇÃO  um toque ajusta a quantidade. A correção ENSINA: ela vira um ponto
            de consumo real, e a estimativa melhora.

Regras:
  - A despensa é DERIVADA e recalculável do zero a partir de price_obs e das
    correções. Ela nunca é a verdade — é um resumo dela.
  - Item sem histórico suficiente NÃO entra na previsão. Silêncio, não chute.
  - Todo número mostra a conta que o produziu, em uma linha.
  - Produto que não se estoca (pão, hortifrúti que estraga em dias) tem
    tratamento próprio: não vira "tem em casa", vira "compra toda semana".

### 3. A LISTA QUE SE MONTA SOZINHA

Ao criar uma compra planejada, o app já propõe a lista:
  - o que a despensa diz que vai faltar até lá;
  - os recorrentes (o que entra em toda compra do tipo);
  - o que a cadência diz que está na hora.

Tudo vem MARCADO PARA REVISÃO, nunca aplicado sozinho — a mesma regra do
casamento da NFC-e, que já custou 19 erros no DOMI. A pessoa desmarca o que não
quer e a lista está pronta em 30 segundos, em vez de 5 minutos.

### 4. O CALENDÁRIO DE COMPRAS (planos)

Transforma "algum dia eu vou" em "sábado, no Atacadão, com R$ 1.200".

  - Tipos de ciclo: MENSAL (o rancho), SEMANAL (reposição), DIA A DIA
    (emergência) e EVENTO (fica para a Onda 3).
  - Cada plano tem data, loja prevista, orçamento e a lista.
  - O app conta os dias e avisa: "faltam 3 dias — revise a lista".
  - Ao chegar o dia, HOJE mostra o plano em primeiro lugar.
  - Uma compra fechada vira MODELO para a próxima do mesmo tipo.

### 5. ORÇAMENTO DO MÊS, não só da compra

Hoje o orçamento é por compra. Passa a existir também o do mês, e ele é a base
da projeção. Quem estoura não estoura numa compra — estoura no mês, e só
descobre no extrato.

### 6. O NOVO PRIMEIRO ACESSO, com a nuvem

A apresentação passa a deixar o app PRONTO, como no DOMI:

  1. Bem-vindo · 2. Como funciona · 3. Sua casa (nome seu e da casa)
  4. A NUVEM — "só neste aparelho" OU "sincronizar", com URL, chave, conta e
     casa (criar ou entrar por código), tudo guiado
  5. Proteção (PIN e digital, pulável)
  6. O que você compra (itens para tocar)
  7. Sua rotina — que dia é a compra grande? quanto costuma gastar?
  8. Comece com dados — importar nota fiscal
  9. Pronto — a primeira lista montada e o próximo passo

Pulável em qualquer ponto. Nada obrigatório além do nome. E cada passo produz
algo que fica: ninguém termina com um app vazio.

O passo 7 não é burocracia: é o que alimenta o calendário e o orçamento, e é o
que faz a página HOJE ter o que dizer no primeiro dia.

=============================================================
NAVEGAÇÃO
=============================================================

Cinco abas: HOJE · PLANEJAR · MERCADO · DESPENSA · ANÁLISE.
No topo: ajuda, tema, ajustes. No desktop, tudo na sidebar.

MERCADO só fica em destaque quando há compra em curso — nas outras horas ele é
uma tela de "você não está comprando", e ocupar uma aba fixa com isso é
desperdiçar o lugar mais valioso da tela.

"Meus produtos" e "Histórico" passam a viver dentro de ANÁLISE.

=============================================================
COMO ENTREGAR
=============================================================

Fase a fase, cada uma fechando verde:
  1. Modelo de dados + despensa derivada + testes
  2. Calendário de planos + lista automática + testes
  3. Página HOJE + conselheiro + projeção + testes
  4. Onboarding novo com sincronização + testes
  5. Navegação de 5 abas, mobile e desktop + testes

Definição de pronto (a de sempre): node --check → tests/smoke.js →
tests/tempo.js → tests/sabotagem.js (com casos novos para cada regra nova) →
VERSAO e tags ?v= juntas → docs atualizados → commit em português.

=============================================================
AS REGRAS NOVAS QUE PRECISAM DE TESTE E SABOTAGEM
=============================================================

- A despensa é recalculável do zero e dá o mesmo resultado.
- Item sem histórico suficiente NÃO gera previsão (silêncio, não chute).
- A lista automática PROPÕE, nunca aplica sozinha.
- A projeção do mês usa ritmo, não regra de três.
- O conselheiro mostra no máximo 3 avisos, e só com ação.
- Uma compra fechada não pode entrar duas vezes na despensa (a compra e a nota
  fiscal da mesma ida ao mercado são o mesmo evento).
- Produto perecível não vira "tem em casa" por semanas.
- O orçamento do mês e o da compra são números diferentes, com nomes diferentes.

=============================================================
COMECE POR
=============================================================

Antes de escrever código, me diga em até 10 linhas o que você mudaria neste
plano — como Especialista de Produto. Depois comece pela fase 1.
```
