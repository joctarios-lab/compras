# CESTA — Assistente de Gestão de Compras da Família

Documento de visão e arquitetura. Substitui o escopo do `PROMPT-INICIAL.md`,
que resolvia uma pergunta ("esse preço está bom?") e não o **ciclo inteiro** de
compras de uma casa.

---

## 1. A mudança de tese

O app entregue responde bem a uma pergunta, no corredor. Mas o corredor é **20
minutos de um processo que dura o mês inteiro** — e o resto do processo é onde o
dinheiro e o tempo realmente se perdem:

| Onde a família perde | O app hoje | O que falta |
|---|---|---|
| Compra o que já tinha em casa | não sabe o que há em casa | despensa |
| Esquece item e volta ao mercado | lista manual | sugestão do que falta |
| Acaba o leite na quarta e paga caro no mercadinho | nada | previsão de consumo |
| Não sabe se vai a A ou B | histórico por loja | simulação da cesta antes de sair |
| Estoura o mês sem perceber | orçamento por compra | orçamento do ciclo e projeção |
| Compra atacado que estraga | nada | consumo × validade × capital parado |
| Churrasco de sábado sem lista | lista em branco | listas por evento com quantidades |
| Cozinha o que dá, compra sem plano | nada | cardápio → lista |

**A tese nova:** o CESTA é o **assistente que conduz o ciclo de compras da
casa** — planejar, decidir onde ir, executar, conferir e aprender. O
comparador de preço deixa de ser o produto e passa a ser um dos motores.

**A promessa, em uma frase:**
> Você nunca mais vai ao mercado sem saber o que precisa, quanto vai custar e se
> o preço está bom.

---

## 2. Como a família brasileira compra de verdade

Cinco ciclos, com gatilhos, lugares e comportamentos diferentes. Um app que só
conhece "lista" atende mal os cinco.

| Ciclo | Quando | Onde | Ticket | O que a pessoa quer |
|---|---|---|---|---|
| **Rancho mensal** | dia do salário, fim/início do mês | atacarejo | R$ 600–1.500 | não esquecer nada, não estourar, aproveitar o atacado |
| **Reposição semanal** | sábado ou domingo | mercado de bairro | R$ 150–400 | rápido, hortifrúti fresco |
| **Emergência** | acabou agora | mercadinho, padaria | R$ 20–60 | resolver, e não pagar caro por isso |
| **Ocasião** | churrasco, Natal, aniversário, volta às aulas | varia | picos | quantidade certa para N pessoas |
| **Durável** | quebrou, ou é hora de trocar | lojas online e físicas | R$ 500–5.000 | achar o melhor preço e condição |

O app precisa **reconhecer em qual ciclo você está** e se comportar de acordo. O
rancho pede planejamento e orçamento; a emergência pede três toques.

---

## 3. O princípio que impede o inchaço

Um canivete suíço vira gaveta bagunçada quando cada lâmina exige manutenção.
A regra deste projeto:

> **Todo recurso que exige manutenção manual precisa se pagar sozinho.
> Prefira DERIVAR a PERGUNTAR.**

Aplicado:
- A **despensa** não é inventário: o que você compra entra sozinho, e o consumo é
  estimado pela sua própria cadência. Você só corrige o que estiver errado.
- A **validade** não é digitada: é estimada por tipo de produto, e só se pede
  confirmação no que estraga rápido.
- O **cardápio** não obriga a cadastrar receitas: começa com um catálogo pronto de
  pratos brasileiros comuns.

Onde não der para derivar, o recurso **nasce desligado** e se apresenta quando o
dado já existir para sustentá-lo.

---

## 4. As páginas do app

Sete áreas. Cinco na navegação principal; duas no topo.

### 🏠 HOJE — o painel (a página inicial)

Responde **"o que eu preciso saber agora?"**, e é a única tela que a pessoa abre
sem ter uma tarefa em mente. Blocos, na ordem em que importam:

1. **A próxima compra** — "Rancho do mês · sábado, 05/10 · Atacadão · orçamento
   R$ 1.200 · 34 itens na lista". Com botão para revisar ou já entrar no mercado.
2. **Está acabando** — 6 itens que a cadência diz que vão faltar antes da próxima
   compra. Um toque põe na lista.
3. **O mês até agora** — gasto, orçamento, projeção de fechamento e o selo de
   situação. O mesmo hero do DOMI, adaptado.
4. **O conselheiro** — 1 a 3 avisos acionáveis: "o café subiu 18% em dois meses",
   "sua cesta está 6% mais barata no Assaí", "3 itens vencem esta semana".
5. **Atalhos rápidos** — item de emergência, foto de etiqueta, Mais por Menos.

### 📅 PLANEJAR

O ciclo antes do mercado. Sub-áreas:

- **Listas** — as listas ativas, por tipo (mensal, semanal, evento).
- **Calendário de compras** — as compras agendadas do mês. É o que transforma
  "algum dia eu vou" em "sábado, com orçamento".
- **Modelos** — a lista do rancho, a da semana. Nascem da sua compra anterior.
- **Cardápio da semana** — escolha os jantares, o app soma os ingredientes e
  desconta o que já tem em casa.
- **Eventos** — "churrasco para 12" calcula carne, bebida, carvão, pão de alho.

### 🛒 COMPRAR — o Modo Mercado

A execução. Já existe e continua sendo a melhor parte do app. Ganha:

- **Dois carrinhos** — divide a lista entre duas pessoas no mesmo mercado, por
  corredor, com quem-pegou-o-quê em tempo real.
- **Substituição** — "não tinha a marca de sempre" mostra o que você já comprou
  no lugar, com preço.
- **Modo emergência** — três toques: item, preço, pronto. Sem lista, sem plano.

### 🥫 DESPENSA

O que existe em casa. **Derivada, não digitada.**

- Entra sozinha quando você fecha a compra ou importa a nota.
- Sai pelo consumo estimado da sua cadência.
- Mostra o que está acabando, o que vence primeiro e o que você costuma jogar
  fora — o desperdício é dinheiro que ninguém contabiliza.

### 📊 ANÁLISE

Onde o histórico vira decisão:

- **Meus produtos** (já existe) — quanto custa cada coisa, onde estava mais barato.
- **Onde comprar** — simulação da lista atual em cada mercado, pelo seu histórico.
- **A sua inflação** — cesta comparável, o que mais subiu, encolhimento de embalagem.
- **Para onde vai o dinheiro** — curva ABC: os 20% de produtos que são 80% da conta.
- **Vale a pena?** — a calculadora do atacado, com consumo, validade e capital parado.
- **Preços-alvo** — "me avise quando o café cair de R$ 18/kg".
- **Pesquisador de duráveis** (futuro) — TV, geladeira: busca em lojas online.

### 👨‍👩‍👧 A CASA

Membros, quem paga o quê, rateio, preferências e restrições alimentares
(alergia, dieta, "não come pimentão") — que passam a filtrar sugestões e
cardápio.

### ⚙️ AJUSTES

Sincronização, segurança, orçamentos, backup, ajuda.

---

## 5. Os recursos, por camada de valor

### Camada 1 — Saber o que comprar *(o coração do assistente)*
| Recurso | O que resolve |
|---|---|
| Despensa derivada | comprar o que já tem / faltar o que acabou |
| Previsão de falta | "o arroz acaba em 4 dias" |
| Lista automática | a lista se monta sozinha; você confirma |
| Cardápio → lista | cozinhar com plano, comprar o que o plano pede |
| Listas por evento | churrasco, Natal, volta às aulas |
| Recorrentes | o que entra em toda compra |

### Camada 2 — Planejar
Calendário de compras · orçamento por ciclo e categoria · modelos de lista ·
rateio entre membros · lista compartilhada (já existe).

### Camada 3 — Executar
Modo Mercado (existe) · roteiro por corredor (existe) · dois carrinhos ·
substituição inteligente · modo emergência · código de barras e OCR (existem).

### Camada 4 — Conferir
Conferidor de caixa (existe) · NFC-e (existe) · **entrada automática na
despensa** · rateio da conta · comprovante por foto (existe).

### Camada 5 — Entender
Inflação pessoal (existe) · o que subiu (existe) · encolhimento (existe) ·
curva ABC · projeção do mês · desperdício · sazonalidade e safra.

### Camada 6 — Decidir melhor
Mais por Menos (existe) · **onde comprar (simulação da cesta)** · vale a pena o
atacado · preços-alvo · pesquisador de duráveis · assistente conversacional.

---

## 6. Os oito recursos que fazem alguém indicar o app

Se só oito puderem existir além do que já há, seriam estes — escolhidos por
"quanto isso muda o mês da pessoa", não por dificuldade:

1. **A lista que se monta sozinha.** Despensa + cadência + recorrentes. A pessoa
   abre o app e a lista do rancho já está lá, esperando confirmação. É a
   diferença entre ferramenta e assistente.
2. **Onde comprar.** "Sua lista: R$ 1.180 no Atacadão, R$ 1.310 no Assaí." Decide
   a viagem inteira, e só o seu histórico pode responder isso.
3. **Calendário de compras com orçamento.** Transforma intenção em plano, e é o
   que dá ao app um motivo para ser aberto fora do mercado.
4. **Cardápio da semana.** Resolve "o que vou fazer de janta" e "o que preciso
   comprar" de uma vez. Nenhum app brasileiro faz isso bem.
5. **Vale a pena o atacado?** A conta honesta: 5 kg a R$ 24,90 só compensa se
   você consumir antes de estragar. Ninguém faz essa conta sozinho.
6. **Projeção do mês.** "No seu ritmo, você fecha em R$ 1.430 — R$ 230 acima do
   planejado." Igual ao DOMI, e é o que evita o susto.
7. **Listas por evento com quantidade calculada.** Churrasco para 12: 4,8 kg de
   carne, 24 pães, 3 kg de carvão. Puro Brasil, e vira indicação boca a boca.
8. **O assistente que conversa.** "Monte a lista do churrasco de sábado", "quanto
   gastei com carne esse mês?", "vale a pena comprar arroz agora?". Opcional, com
   a chave do próprio usuário — o mesmo padrão do DOMI.

---

## 7. O que eu recomendo NÃO construir

Como especialista, dizer não faz parte do desenho:

| Proposta | Por que não |
|---|---|
| Inventário manual completo da despensa | ninguém mantém; o dado apodrece e o app passa a mentir. A despensa derivada entrega 80% sem manutenção |
| Scraping de supermercado para preço de mercado | quebra toda semana, e trai o local-first |
| Feed social / comparar com outras famílias | outro produto, outro custo, e expõe consumo |
| Integração com delivery/compra online de mercado | é um marketplace, não um assistente |
| Leitor de cupom em tempo real no caixa | a NFC-e já resolve, depois |
| Metas de "economia" gamificadas | vira ruído; o número real já é motivador |

---

## 8. O primeiro acesso, do zero ao app configurado

Como no DOMI: a apresentação **já deixa o app pronto**, incluindo a nuvem.

```
1. Bem-vindo          o que é o app, em uma frase e um exemplo
2. Como funciona      os três momentos (planejar · comprar · entender)
3. Sua casa           seu nome e o nome da casa
4. A nuvem            ← NOVO, e é aqui que hoje o app falha
                      · "Usar só neste aparelho" (segue offline, sempre)
                      · "Sincronizar entre aparelhos" → URL + chave,
                        criar conta, criar casa OU entrar por código
                      · com um caminho guiado para criar o projeto Supabase
5. Proteção           PIN e digital (pode pular)
6. O que você compra  itens comuns, para tocar
7. Sua rotina         quando você faz a compra grande? (dia do mês)
                      quanto costuma gastar por mês?
8. Comece com dados   importar nota fiscal (o atalho) ou seguir
9. Pronto             a primeira lista já montada, e o próximo passo
```

**Regras:** pulável em qualquer ponto; nada obrigatório além do nome; e cada
passo **produz algo que fica**. Ninguém deve terminar a apresentação com um app
vazio.

---

## 9. Roadmap — quatro ondas

Cada onda entrega valor sozinha e fecha verde (suíte, datas, sabotagens).

### Onda 1 — O assistente nasce *(a maior mudança percebida)*
- Página **HOJE** com painel, conselheiro e projeção
- **Despensa derivada** + previsão de falta
- **Lista que se monta sozinha**
- **Calendário de compras** e tipos de ciclo (mensal, semanal, dia a dia)
- **Orçamento do mês** por ciclo
- Onboarding novo, com **sincronização no primeiro acesso**

### Onda 2 — Decidir melhor
- **Onde comprar** (simulação da cesta por loja)
- **Vale a pena o atacado?**
- **Preços-alvo** com alerta no mercado
- **Curva ABC** e para onde vai o dinheiro
- **Modelos de lista** e recorrentes

### Onda 3 — A vida da casa
- **Cardápio da semana** → lista, com catálogo de pratos brasileiros
- **Listas por evento** com quantidade por pessoa
- **Rateio** entre membros
- **Dois carrinhos** no mercado
- **Desperdício e validade**

### Onda 4 — Inteligência
- **Assistente conversacional** (chave do usuário, como no DOMI)
- **Pesquisador de duráveis** (TV, geladeira) — exige backend, entra por último
- **Sazonalidade e safra**
- Substituição inteligente

---

## 10. O que muda no modelo de dados

Novas entidades (todas com o envelope de sync que já existe):

```
plans          compra planejada: data, tipo (mensal|semanal|dia|evento),
               store_id, orcamento, status
pantry         despensa: item_id, qtd, unidade, validade?, atualizado_em, origem
consumption    consumo estimado por item (derivado, recalculável)
recipes        receitas: nome, porções, tempo
recipe_items   ingredientes: recipe_id, item_id, qtd, unidade
menu           cardápio: data, refeição, recipe_id
events         evento: tipo, pessoas, data → gera lista com quantidades
price_targets  preço-alvo: product_id/item_id, valor, unidade, ativo
budgets        orçamento: mês, ciclo, categoria, valor
members        membros da casa: nome, restrições, cor
splits          rateio: list_id, member_id, valor
```

`price_obs` continua sendo a **fonte única** de tudo que é preço. A despensa e a
previsão são **derivadas** e podem ser recalculadas do zero — nunca são a
verdade, sempre um resumo dela.

---

## 11. Riscos, e como não cair neles

| Risco | Mitigação |
|---|---|
| O app vira formulário de manutenção | tudo derivado; o que exige digitação nasce desligado |
| Sete áreas confundem no celular | 5 abas; sub-áreas dentro de PLANEJAR e ANÁLISE |
| A despensa erra e some a confiança | ela sempre mostra **por que** acha isso ("comprou 5 kg em 12/09, consome ~1,2 kg/semana") e é corrigível em um toque |
| A previsão erra no começo | só aparece com histórico suficiente; até lá, silêncio — como o ⚪ do diagnóstico |
| Excesso de avisos | o conselheiro mostra **no máximo 3**, e só o que tem ação |
| Arquivos gigantes | teto de 1.500 linhas segue valendo; cada área em seu módulo |
| Escopo sem fim | quatro ondas, cada uma fechando verde antes da seguinte |

---

## 12. O que continua valendo do que já existe

Nada do que está construído é jogado fora. O que muda é o **entorno**:

- `js/precos.js` continua o motor, e ganha clientes novos (simulação de cesta,
  vale-a-pena, preços-alvo).
- O Modo Mercado continua a melhor tela do app.
- A NFC-e passa a alimentar **também** a despensa.
- As invioláveis do `PROMPT-INICIAL.md` §13 seguem valendo, todas.
