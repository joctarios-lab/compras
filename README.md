# 🧺 CESTA — Compras de Mercado

**O preço é bom?** A resposta no corredor, em menos de um segundo, comparando com
o que **você** já pagou — sem rede, sem anúncio e sem mandar o seu consumo para
ninguém.

Aplicativo de compras de mercado: **offline-first**, instalável no celular, zero
dependências e zero build — HTML/CSS/JS puros, hospedável em qualquer host
estático.

## Por que existe

Dentro do mercado, com o carrinho na mão, ninguém sabe se R$ 24,90 no arroz de
5 kg é bom. Os apps que respondem isso dependem de internet e GPS — e falham
exatamente onde precisariam funcionar, no corredor com sinal ruim. Os apps de
lista, por sua vez, não guardam quanto você pagou.

O CESTA fica no cruzamento vazio: **o seu histórico, o veredito na hora, 100%
offline.**

## O que ele faz

- **🟢🟡🔴 Diagnóstico na hora** — o preço digitado comparado com a **mediana dos
  seus últimos 6 meses**, sempre em unidade canônica (R$/kg, R$/L, R$/un), com a
  base à vista: *"🔴 Caro · +14% · mediana R$ 5,66/kg (6 meses, 4 registros)"*.
  Sem histórico, o selo é ⚪ **primeiro registro** — nunca 🟡 "na média".
- **🛒 Total do carrinho em tempo real**, contra o orçamento, com estimativa do
  que ainda falta.
- **⚖️ Mais por Menos** — o refil de 1 L a R$ 5,90 compensa contra o frasco de
  500 ml a R$ 3,20? Aritmética de gôndola, funciona sem nenhum histórico.
- **📉 Encolhimento de embalagem** — quando o pacote vai de 150 g para 120 g com o
  mesmo preço, o app diz quanto isso é de aumento real por quilo.
- **🧾 Importação de NFC-e** — as notas que você já tem enchem a base com meses de
  histórico de uma vez, em vez de esperar 90 dias de uso.
- **📊 Cesta comparável** — a sua inflação pessoal medida por **cesta fechada**
  (só o que existe nos dois períodos), separada do "você gastou mais".

## Estado

**F0 entregue** — a fundação: shell, sistema visual nos dois temas, camada de
dados com envelope de sincronização, service worker offline e a suíte de testes.

Próxima: **F1** — lista, Modo Mercado e total do carrinho. O roteiro completo das
fases está em [`docs/PROMPT-INICIAL.md`](docs/PROMPT-INICIAL.md), seção 10.

## Como rodar localmente

Qualquer servidor estático serve:

```bash
npx serve .          # ou: python -m http.server 8080
```

Abra `http://localhost:8080`. Para instalar no celular, o PWA precisa de
**HTTPS** — GitHub Pages, Netlify, Vercel ou Cloudflare Pages servem, de graça.
Depois é abrir o endereço no celular → menu do navegador → **"Adicionar à tela de
início"** (no iPhone, pelo Safari).

## Testes

```bash
node tests/smoke.js     # a suíte, na âncora de tempo
node tests/tempo.js     # a mesma suíte em 9 datas de calendário
```

A suíte roda o app **sem navegador** e com o **relógio congelado**. O motivo está
em [`docs/PROMPT-INICIAL.md`](docs/PROMPT-INICIAL.md), seção 11.2: no app de
finanças que deu origem a este, uma suíte com datas absolutas foi entregue verde e
reprovava 13 testes no dia 31 — sem que uma linha do app tivesse mudado. Uma rede
que reprova sem regressão para de ser lida.

Por isso `tests/tempo.js` existe: congelar o relógio não pode virar desculpa para
nunca mais olhar o calendário. **Verde num dia só não é verde.**

## Estrutura

```
index.html                 shell: topbar, conteúdo, barra de 3 abas
css/styles.css             sistema visual: 3 camadas de tema, tokens, componentes
js/config.js               credenciais do Supabase — VAZIO de propósito (repo público)
js/icons.js                ícones SVG inline (offline, sem CDN)
js/ui.js                   moeda, máscara, folhas, avisos e a altura do teclado
js/db.js                   dados locais e o envelope de sincronização
js/app.js                  boot, abas e registro do service worker
sw.js                      service worker (app shell offline-first)
manifest.webmanifest       identidade do app instalado
tests/                     a suíte e o rodízio de datas
docs/                      o plano, a pesquisa de mercado e a retomada
```

## Modelo de dados

`price_obs` é a **fonte única** de toda comparação — o diagnóstico é sempre
derivado dela, nunca gravado. Em volta: `items` (o que eu quero: "arroz") →
`products` (marca e embalagem: "Tio João 5 kg") · `stores` (mercados) · `lists` +
`list_items` (as compras) · `nfce_docs` (notas importadas, sem duplicar) ·
`aliases` (o texto do PDV que já foi vinculado a um produto).

Toda tabela carrega `updated_at` / `deleted` / `dirty` **desde o primeiro
registro gravado**, mesmo antes de a sincronização existir: acrescentar isso
depois obrigaria a migrar a base de quem já usa.

## Documentação

- [`docs/PROMPT-INICIAL.md`](docs/PROMPT-INICIAL.md) — o plano completo: produto,
  motor de preços, arquitetura, fases e método de teste
- [`docs/pesquisa-mercado.md`](docs/pesquisa-mercado.md) — concorrentes e a
  viabilidade técnica da NFC-e
- [`docs/RETOMADA.md`](docs/RETOMADA.md) — o estado atual e as decisões tomadas
- [`docs/ABRIR-SESSAO.md`](docs/ABRIR-SESSAO.md) — o prompt curto de abertura

---

Irmão do [DOMI](https://github.com/joctarios-lab/finances), o app de finanças da
família — de onde vêm a arquitetura, o sistema visual e as lições que este
projeto não precisou aprender de novo.
