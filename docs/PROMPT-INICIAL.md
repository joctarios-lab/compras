# Prompt inicial — PWA de Compras de Mercado

Cole o bloco abaixo ao abrir a primeira sessão do projeto. Ele foi escrito por
quem já construiu o PWA de finanças em `D:\Projetos\meus-projetos\financas` e
carrega as lições que **já custaram retrabalho lá** — para que não custem aqui.

Depois da primeira entrega, este arquivo dá lugar a `docs/RETOMADA.md`, que passa
a ser o prompt de retomada de todas as sessões seguintes.

---

```
Vamos criar um PWA de Gestão Inteligente e Comparativa de Compras de Mercado em
D:\Projetos\meus-projetos\compras.

Você atua como Especialista de Produto E Arquiteto. Não é para executar o que eu
peço ao pé da letra se você enxergar um defeito de produto: aponte em duas linhas
e siga, entregando com a premissa declarada.

=============================================================
1. O PROBLEMA, ANTES DA SOLUÇÃO
=============================================================

Dentro do mercado, com o carrinho na mão, a pessoa não sabe se R$ 24,90 no arroz
de 5 kg é bom. Ela lembra vagamente que "estava mais barato mês passado" e não
tem como conferir em três segundos. O app existe para responder ESSA pergunta,
naquele instante, com o polegar de uma mão só.

Três coisas o app entrega, nesta ordem de valor:
  1. **Diagnóstico na hora** — este preço é bom, comum ou caro, e em quanto por
     cento, comparado com o que EU já paguei.
  2. **Controle do carrinho** — quanto já tem no carrinho contra o que planejei
     gastar, atualizado a cada item.
  3. **Memória de longo prazo** — o que subiu, quanto a minha cesta encareceu,
     onde estava mais barato.

O que o app NÃO é: não é uma base colaborativa de preços, não busca preço na
internet, não faz scraping de supermercado, não promete cobrir produto que a
pessoa nunca comprou. Ele compara a pessoa com ela mesma. Isso é decisão de
escopo — respeitá-la é o que mantém o app honesto, offline e sem servidor.

=============================================================
2. CONCORRÊNCIA E POSICIONAMENTO (pesquisado, não suposto)
=============================================================

O mercado está partido em duas metades que não se tocam:

**Metade A — apps de LISTA, sem inteligência de preço.**
Listonic, Bring!, Out of Milk. Ótimos em montar e compartilhar lista por
categoria. Não guardam quanto você pagou, não comparam mês a mês, não têm nada a
dizer dentro do corredor.

**Metade B — apps de PREÇO, sem lista, sem offline e sem privacidade.**
- **Menor Preço Brasil** (CONFAZ, oficial, ~16 estados) é o concorrente indireto
  mais forte e o mais mal-entendido: ele mostra o preço que OUTRAS pessoas
  pagaram perto de você, alimentado pelas NFC-e emitidas na região, em tempo
  real. Exige internet e GPS, tem defasagem e cobertura irregular, não conhece o
  SEU histórico e não tem lista de compras.
- **ClickSuper** é o mais próximo do nosso escopo: lista + histórico de preços +
  comparação regional — e depende de rede e da cobertura da região.
- **Preço Fresco**, **Super Save**: ofertas e leitura de código de barras.
- **MercadoCompare** e similares leem o QR da NFC-e **depois** da compra. O
  alerta chega quando o dinheiro já saiu.

**O espaço vazio, que é o nosso:** o *seu* histórico, dando um veredito *no
corredor*, *sem rede*, *sem anúncio* e *sem mandar seu consumo para ninguém*.
Ninguém ocupa esse lugar. Não competimos com o Menor Preço Brasil — ele responde
"quanto custa lá fora" e nós respondemos "quanto ISSO custa PRA MIM". São
perguntas diferentes, e a segunda é a que decide a mão que pega o produto.

**A consequência estratégica:** todo recurso que exija rede dentro do mercado é
uma aposta contra a nossa única vantagem estrutural. O 4G do supermercado é ruim
— é por isso que a Metade B falha no corredor. Não repita o erro deles.

=============================================================
3. A ARMADILHA CENTRAL DO PRODUTO (leia antes de desenhar qualquer tela)
=============================================================

**O app não tem histórico no primeiro dia.** Um comparador de preços sem
histórico é uma tela vazia. Se a primeira experiência for "registre por três
meses e depois isso fica útil", o app é desinstalado antes de ficar útil.

Há **quatro** respostas a isso, e as quatro entram no produto:

a) **Valor que não depende de histórico nenhum, já na F1:**
   - lista de compras boa e rápida;
   - total do carrinho em tempo real contra o orçamento;
   - **"Mais por Menos"** — o comparador de embalagens. Detergente 500 ml a
     R$ 3,20 contra o refil de 1 L a R$ 5,90: o app responde qual compensa **sem
     precisar de um único dado histórico**, porque é aritmética de gôndola.
     Funciona no minuto zero de uso e resolve uma dúvida que a pessoa tem em toda
     compra. Isto sozinho já justifica a instalação.

b) **Semeadura pela NFC-e** — importar notas fiscais que a pessoa já tem enche a
   base com meses de histórico real de uma vez. É a diferença entre "volte em 90
   dias" e "o app é útil hoje à tarde". Ver seção 6.

c) **Semeadura declarada.** Ao criar um item, o app pode perguntar "quanto você
   costuma pagar?" — vira observação de origem `estimado`, referência fraca,
   substituída pela primeira medição real.

d) **Nunca inventar diagnóstico sem base.** Com nenhuma observação anterior o
   selo é ⚪ "primeiro registro", **nunca** 🟡 "na média". Dizer "na média"
   quando não há média é a mentira que destrói a confiança no app inteiro — e é
   o mesmo tipo de defeito que no app de finanças aparecia como "o número da tela
   não bate com outro número da própria tela".

**Todo diagnóstico mostra a base.** Nunca só "🔴 Caro". Sempre:
`🔴 Caro · +14% · mediana R$ 5,66/kg (6 meses, 4 registros)`. Se a pessoa não
pode auditar o número, ela não confia nele na segunda vez que ele a surpreender.

=============================================================
4. COMO O APP FUNCIONA NA PRÁTICA (as três jornadas)
=============================================================

**Jornada A — Em casa, montando a lista (2 min)**
Abre em "Lista". Campo único no topo: digita "arroz" e o app sugere do catálogo
pessoal (ordenado por frequência), com a quantidade habitual preenchida. Enter
adiciona e o campo continua focado — dá para despejar a lista inteira sem tirar a
mão do teclado. O app mostra a **estimativa da lista** pela mediana de cada item:
"estimado R$ 312 · seu último mercado R$ 340".

**Sugestão por cadência (a despensa digital, pelo caminho barato).** Não
construa controle de estoque na v1 — é um app inteiro, com inventário que a
pessoa precisa manter atualizado, e ninguém mantém. O histórico já entrega 80%
disso de graça: se você compra arroz a cada ~34 dias e faz 40 que não compra, o
app sugere "provavelmente está acabando". Zero manutenção, nasce dos dados que já
temos, e chega junto com a F4.

**Jornada B — No mercado (zero fricção; é aqui que o app se ganha ou se perde)**
Um botão grande: "Estou no mercado" → escolhe a loja (a última pré-marcada) →
entra no **Modo Mercado**.

Uma tela só, sem menu, sem aba, sem navegação:
  - Itens pendentes, cada linha com alvo de toque de 56px.
  - Tocar na linha traz o item para o rodapé (zona do polegar) com o teclado
    numérico aberto (`inputmode="decimal"`) e máscara de moeda igual à do app de
    finanças: digita `498` → `R$ 4,98`.
  - **O diagnóstico aparece enquanto digita**, sem confirmar nada. Digitou o
    último dígito, já leu 🟢/🟡/🔴 com a porcentagem e a mediana.
  - Um toque em ✓ marca comprado, soma ao carrinho e pula para o próximo.
    Nenhum diálogo, nenhum "salvar".
  - Barra fixa no topo: `R$ 187,40 · 12 de 23 itens · orçamento R$ 250`, com a
    estimativa do que falta: `+ 11 itens ≈ R$ 62`. Muda de cor ao passar do
    orçamento — e diz em palavras, não só em cor.
  - **"Mais por Menos" a um toque**: dois campos, duas embalagens, resposta
    imediata em R$/unidade canônica, com quanto se economiza de fato ("o refil
    sai 8% mais barato por litro — R$ 0,49 de diferença").
  - Botão de câmera na linha: fotografa o selo (comprovante na v1; leitura
    automática vem depois — ver Fase 7).
  - `navigator.wakeLock` mantém a tela acesa.
  - **Grava a cada tecla.** O app pode morrer no meio do mercado (bateria, aba
    descartada pelo iOS). Perder um carrinho de 40 itens é imperdoável.
  - Item fora da lista: campo "adicionar aqui" no rodapé, mesma fricção do resto.
  - Item que não tinha na loja: um toque marca "não tinha" — é dado, não lixo.

**Jornada C — O caixa e o fechamento (30s, e é onde a confiança se cimenta)**
  - **Conferidor de caixa.** O total do app contra o total do cupom. Bateu, o app
    diz que bateu; não bateu, ele mostra a diferença e ajuda a achar o item.
    Preço de gôndola divergindo do preço do caixa é uma dor real e frequente, e
    ser o app que **pega o erro do mercado** vale mais em confiança do que dez
    telas de gráfico.
  - **Cuidado factual: no Brasil o preço de etiqueta já inclui os impostos.** Não
    existe "somar imposto ao final". O que faz o total do app divergir do caixa é
    outra coisa: item de peso variável (hortifrúti, frios) que só fecha na
    balança, promoção do tipo leve-3-pague-2, e item ainda não precificado. É
    isso que o totalizador precisa modelar — imposto, não.
  - Fechamento: total, comparação com as últimas compras nesta loja, e três
    destaques honestos — o que você pegou muito bem, o que estava caro, e quanto
    a sua cesta comparável variou.

=============================================================
5. O MOTOR DE PREÇOS — as regras exatas (js/precos.js)
=============================================================

Este é o coração. Módulo próprio, testável sem tela, e **nenhuma view recalcula
nada disto por fora**. (No app de finanças, três dos defeitos corrigidos nasceram
exatamente de a regra ser copiada dentro da view.)

**5.1 — Unidade canônica.** Toda observação grava preço total, quantidade e
unidade; a base é derivada, nunca digitada:
    kg  ← g (÷1000), kg
    L   ← ml (÷1000), L
    un  ← un, e "pacote com N" vira N unidades
    precoBase = precoTotal / quantidadeCanonica
Comparar R$ 24,90 (5 kg) com R$ 5,90 (1 kg) sem isso dá o diagnóstico oposto ao
correto. Item sem unidade declarada é `un`.

**5.2 — A redução de embalagem (o "encolhimento").** Esta é a regra que nenhum
concorrente entrega e que sai quase de graça de 5.1, porque já gravamos
quantidade por observação: quando o MESMO produto (mesmo EAN, ou mesma marca e
nome) aparece com embalagem menor, o app diz em palavras:
    "O pacote encolheu de 150 g para 120 g. O preço da etiqueta não mudou,
     mas você está pagando 25% mais por quilo."
É o aumento que o consumidor não enxerga, e o app enxerga porque compara em
unidade canônica. Trate como evento de primeira classe: ele merece destaque no
fechamento da compra e no histórico, não uma nota de rodapé.

**5.3 — Três níveis de identidade.** Entidades diferentes; confundi-las é o erro
estrutural mais caro deste app:
    item     = o que eu quero ("arroz")            → é o que entra na lista
    produto  = marca + embalagem ("Tio João 5 kg") → é o que tem preço comparável
    obs      = preço de um produto, numa loja, numa data
Comparar produto com produto é preciso; comparar item com item (R$/kg do arroz,
qualquer marca) é útil e mais ruidoso. O app faz os dois, **em cascata**, e diz
qual usou:
    1. mesmo produto → "comparado com o mesmo Tio João 5 kg"
    2. mesmo item, normalizado por unidade → "comparado com arroz em geral"
    3. nada → ⚪ primeiro registro
Quando houver EAN, ele é a identidade do produto — é exato e dispensa casar
texto. Sem EAN, a identidade é (item + marca + embalagem).

**5.4 — A referência.** `Precos.referencia(alvo, { janelaMeses: 6 })` devolve
`{ mediana, n, min, max, ultima, melhorLoja, melhorData, confianca, escopo }`.
  - **Mediana, não média.** Com 3 a 5 pontos, uma promoção de 40% arrasta a média
    e o app passa meses chamando preço normal de "caro".
  - **Janela de 6 meses, não o histórico inteiro.** Com inflação, comparar com
    2024 diz que tudo está caro — verdadeiro e inútil na gôndola. A tendência
    longa é assunto da tela de histórico, não do diagnóstico.
  - **Não descartar outlier.** A mediana já é robusta; descartar esconde a
    promoção real, que é o que a pessoa quer ver em "melhor preço".

**5.5 — O diagnóstico.** Um limiar, numa constante única, lido por todo mundo:
    LIMIAR = 0.07
    delta = (precoBase − mediana) / mediana
    delta ≤ −LIMIAR  → 🟢 Excelente
    |delta| < LIMIAR → 🟡 Na média
    delta ≥ +LIMIAR  → 🔴 Caro
    n = 0            → ⚪ Primeiro registro (NUNCA 🟡)
Confiança pelo n: n=1 "pouco histórico", n=2 "média", n≥3 "boa". O selo aparece
sempre acompanhado dela.

**5.6 — Acionável, não só diagnóstico.** O 🔴 sozinho deixa a pessoa sem saída.
Junto vem o que fazer: `melhor preço já visto: R$ 4,20/kg no Atacadão, 12/06` e,
havendo dado, "aqui costuma custar mais que na X".

**5.7 — A cesta comparável (índice pessoal de inflação).**
Comparar o total do mês com o do mês passado NÃO mede inflação: mede que você
comprou coisas diferentes. Mês com churrasco "inflaciona" 30%. A regra correta é
**cesta fechada**: só entram produtos com observação nos DOIS períodos, e o
índice é ponderado pela quantidade do período base. Dois números, dois nomes:
    "Sua cesta comparável: +4,1%"   (24 produtos nos dois meses)
    "Você gastou: +18%"             (comprou mais coisas)
Um único rótulo para os dois repetiria o defeito de "Disponível" versus "Saldo em
conta" no app de finanças.

**5.8 — O que mais subiu.** Ranking pela variação da mediana mensal, exigindo
n≥2 em ambos os meses. Produto com um preço em cada ponta é ruído, não
tendência, e ranquear ruído faz a tela mentir com números.

=============================================================
6. IMPORTAÇÃO DE NFC-e — como semear a base (avaliado tecnicamente)
=============================================================

Importar notas fiscais que o usuário já tem é o que faz o comparador nascer com
meses de histórico em vez de vazio. Uma NFC-e traz, por item: descrição, código
do produto (às vezes o GTIN/EAN), quantidade, unidade comercial, valor unitário e
valor total — mais data e CNPJ do emitente, que é a loja. É exatamente o formato
de `price_obs`.

**O que a pesquisa mostrou, e que muda o desenho:**
- **Não existe API pública nacional de consulta de NFC-e.** Cada estado tem seu
  portal, com URL própria — e essas URLs mudam (MG e PB já trocaram as suas).
- **Vários estados exigem captcha** na consulta por chave de acesso.
- **CORS bloqueia o fetch direto do navegador.** Um PWA não consegue, por conta
  própria, buscar a página do SEFAZ. Prometer "escaneou o QR, importou" sem
  servidor é prometer o que a plataforma não entrega.
- O QR Code da NFC-e carrega a **chave de acesso de 44 dígitos** e parâmetros —
  ou seja, ler o QR identifica a nota, mas **não devolve os itens**.

**Por isso a importação é em camadas, e a camada 1 já resolve o seu caso:**

  **N1 — Importar ARQUIVO (F3, 100% local, sem servidor, sem CORS, sem captcha)**
  O usuário abre a nota (pelo QR ou pela chave) no navegador e salva; ou obtém o
  XML da NFC-e. O app importa o **XML** ou o **HTML salvo** da página de consulta,
  e parseia localmente. Funciona offline, funciona hoje, e é o mesmo padrão que
  já provou ser sólido no app de finanças com o OFX: **arquivo entra, o app
  reconhece o que é novo, propõe, o usuário confirma.** Aceite também **CSV**,
  que é o formato de escape universal e a saída de qualquer planilha.

  **N2 — Ler o QR Code (F6)** para capturar a chave e abrir a consulta, poupando
  digitação de 44 dígitos. O parse continua sendo do arquivo que voltar.

  **N3 — Proxy opcional (F8, junto com o Supabase)** — uma Edge Function do
  projeto do próprio usuário busca a página do estado e devolve JSON, contornando
  o CORS. É *best-effort*: não vence captcha, quebra quando um estado muda o
  layout, e **jamais** pode ser o único caminho. N1 continua funcionando sempre.

**Um só caminho de ingestão.** Todo parser (XML, HTML, CSV) produz a **mesma
estrutura canônica** de linhas, e daí para a frente existe um único código de
importação — deduplicação, casamento e gravação. Três parsers e três caminhos de
gravação seria garantir que dois deles fiquem com defeito sem ninguém perceber.

**Deduplicação pela chave de acesso.** A chave de 44 dígitos é o identificador
único da nota, como o `fitid` do OFX: reimportar o mesmo arquivo não pode
duplicar nada, e o app tem de dizer "esta nota já foi importada".

**O casamento é o problema difícil — e a lição já foi paga.** A descrição vem do
PDV da loja, abreviada e sem padrão: `ARR TIO JOAO T1 5KG`, `REFRIG COCA 2L`,
`QJO MUSS FAT KG`. Cada rede escreve do seu jeito. No app de finanças, casar
descrição automaticamente **errou 19 lançamentos, R$ 5.322**, e a regra que ficou
foi: **casar só para SUGERIR, nunca para aplicar sozinho.** Aqui vale igual:
  - **EAN primeiro.** Quando a nota traz o GTIN, o casamento é exato e o problema
    desaparece. Priorize sempre.
  - Sem EAN, a importação **propõe** o vínculo e o usuário confirma em lote —
    uma tela de revisão, com desmarcar, igual à do OFX.
  - **O vínculo confirmado é aprendido**: `(loja, texto do PDV) → produto` fica
    guardado, e a próxima importação daquela rede é quase toda automática. O
    esforço é decrescente, e o usuário sente isso na segunda nota.
  - A quantidade também vem do PDV e vem torta: `UN`, `KG`, `PC`, `CX`, `LT`.
    Normalize com um mapa explícito e **deixe fora o que não souber traduzir**,
    em vez de chutar — uma unidade chutada envenena a mediana daquele produto
    para sempre, e é um defeito que ninguém consegue enxergar depois.

**Importação retroativa é histórico, não compra.** Uma nota de meses atrás gera
`price_obs` com a data da nota, e não pode aparecer como compra do mês corrente
nem mexer no orçamento de hoje.

=============================================================
7. ARQUITETURA (idêntica à do app de finanças, e por quê)
=============================================================

- **HTML5 + CSS puro + JS Vanilla ES2020.** Zero build, zero dependência, zero
  node_modules. Serve em qualquer host estático.
- **Local-first de verdade:** o app funciona inteiro sem rede e sem conta. O
  Supabase é opcional e chega tarde.
- **localStorage para dados; IndexedDB para fotos.** Não é detalhe: uma foto de
  selo comprimida tem 80–200 KB e o localStorage acaba em 5 MB. Metadados no
  localStorage, blobs no IndexedDB, foto comprimida no canvas antes de gravar
  (máx. 1280px, JPEG ~0,6). Descobrir isso na F5, com o modelo escrito, é
  reescrever o app.
- **Envelope de sync em toda entidade, desde o primeiro registro gravado:**
  `{ id, updated_at, deleted, dirty }`. Soft delete sempre. Acrescentar depois
  obriga a migrar a base de quem já usa.
- **Módulos pequenos desde o dia 1.** No app de finanças o `app.js` chegou a
  607 KB e o `db.js` a 184 KB, e mexer neles ficou caro. Aqui:
      js/config.js      credenciais opcionais — VAZIO no repo, sempre
      js/ui.js          primitivos de tela (folha, toast, máscara, ícones)
      js/db.js          persistência, envelope de sync, catálogo
      js/precos.js      SÓ o motor de preços (nada de DOM aqui)
      js/nfce.js        parsers XML/HTML/CSV → estrutura canônica
      js/importar.js    dedupe, casamento, aprendizado do vínculo
      js/fotos.js       IndexedDB, compressão, ciclo de vida da imagem
      js/views/lista.js js/views/mercado.js js/views/historico.js js/views/ajustes.js
      js/app.js         roteamento e boot, e só isso
  **Teto: 1.500 linhas por arquivo.** Passou disso, divide antes de continuar.
- **Versão única:** `VERSAO` no `sw.js` e todas as tags `?v=` do `index.html`
  andam JUNTAS a cada entrega. Esquecer entrega o app novo com o CSS velho em
  cache e parece defeito onde não há.
- **PWA:** manifest com `id` fixo (trocar o id cria um app novo em vez de
  atualizar o instalado), service worker com app shell, `display: standalone`,
  `theme-color` para os dois temas.
- **Código de barras (F6): declare a limitação antes de prometer.** A
  `BarcodeDetector` nativa existe no Chrome/Android e **não existe no Safari nem
  em nenhum navegador do iPhone** (todos usam WebKit). Então: usar a nativa onde
  houver, oferecer fallback WebAssembly onde não houver — carregado sob demanda,
  jamais no shell offline de todo mundo — e digitação sempre disponível. Um
  recurso que "falha em silêncio no iPhone" é pior que um recurso ausente.

=============================================================
8. MODELO DE DADOS
=============================================================

  stores       mercados: nome, apelido, bairro, cnpj (vem da NFC-e)
  items        catálogo pessoal: nome, categoria, unidade padrão, qtd habitual
  products     item_id, marca, embalagem_qtd, embalagem_unidade, ean opcional
  lists        nome, status (planejada|em_curso|fechada), store_id, orcamento,
               data_abertura, data_fechamento, total_cupom
  list_items   list_id, item_id, product_id?, qtd, unidade, comprado,
               nao_tinha, preco_total, obs_id
  price_obs    product_id, item_id, store_id, data, preco_total, qtd, unidade,
               preco_base, origem (digitado|foto|ocr|nfce|estimado),
               foto_id?, nfce_chave?
  nfce_docs    chave (44 díg.), loja, data, total, itens_importados  ← dedupe
  aliases      store_id, texto_pdv, product_id  ← o vínculo aprendido
  photos       (IndexedDB) blob comprimido + miniatura
  settings     orçamento padrão, tema, loja favorita, unidades preferidas

`price_obs` é a fonte única de toda comparação — a compra fechada não guarda
diagnóstico, ela é recalculada. Guardar o veredito congelado significa ter dois
números que discordam no dia em que a regra mudar.

=============================================================
9. UX/UI — as regras que valem mais que o layout
=============================================================

- **Uma mão, polegar, dentro do mercado.** Toda ação frequente vive na metade
  inferior da tela. Nada de menu hambúrguer, nada de nível 3 de navegação.
- **Alvo de toque ≥ 48px**, 56px no Modo Mercado.
- **A cor nunca informa sozinha.** Todo selo tem palavra e número junto —
  daltonismo, sol na tela, corredor mal iluminado. "🔴 Caro +14%".
- **A tela do mercado não pergunta nada.** Confirmar, salvar, escolher: fricção
  paga 40 vezes por compra. Ações são reversíveis por desfazer, não prevenidas
  por diálogo.
- **Zero spinner no corredor.** Se algo carrega, o app está errado: os dados são
  locais. Isto é a vantagem competitiva inteira em uma frase.
- **Tema duplo, com a paleta em três camadas**, nesta ordem: `:root` (escuro,
  sempre definido) → `@media (prefers-color-scheme: light)` com
  `:not([data-tema="dark"])` → `:root[data-tema="light"]`. **Nenhuma cor pode ter
  sua única definição dentro de um media query** — ela some no outro tema. Cada
  tinta tem quatro tokens: `--x`, `--x-soft`, `--x-ink`, `--x-borda`. Nunca
  `rgba()` solto numa regra: ele não acompanha a troca de tema.
- **O tema é aplicado por um bloco inline no topo do `index.html`**, antes de
  qualquer script — lido depois, o app abre no tema errado e pisca.
- **A cor é do dado.** Sem gradiente, halo ou sombra colorida decorativa.
  Verde/amarelo/vermelho no selo e no valor, nunca em enfeite.
- Acessibilidade: `aria-live` na barra do carrinho, foco visível, contraste AA
  nos dois temas.

=============================================================
10. FASES DE ENTREGA (cada uma fecha verde, com versão e commit)
=============================================================

  F0  Fundação: index.html, css/styles.css com os tokens dos dois temas, db.js
      com envelope de sync, sw.js, manifest, ícones, harness de teste rodando.
  F1  Lista + Modo Mercado + total do carrinho + orçamento + **Mais por Menos**.
      ← útil com histórico ZERO; é o que justifica a instalação
  F2  precos.js: unidade canônica, referência, diagnóstico, encolhimento de
      embalagem, semeadura declarada.
  F3  **Importação de NFC-e** (XML/HTML/CSV → canônico), dedupe por chave,
      casamento assistido e vínculo aprendido.  ← enche a base com meses de uma vez
  F4  Fechamento + conferidor de caixa + histórico mensal + cesta comparável +
      o que mais subiu + sugestão por cadência.
  F5  Foto do selo: câmera, compressão, IndexedDB, comprovante na observação.
  F6  Código de barras: `BarcodeDetector` onde existir, fallback sob demanda,
      digitação sempre. Leitura do QR da NFC-e para capturar a chave.
  F7  OCR do selo — opcional, desligado por padrão, carregado sob demanda. Não
      embuta megabytes de modelo no shell offline de todo mundo por um recurso
      que parte dos usuários nunca liga.
  F8  Sync Supabase: schema com RLS, push/pull incremental, e o proxy opcional de
      NFC-e. **O marcador do pull é o carimbo do SERVIDOR, não o relógio do
      cliente** — no app de finanças o relógio do cliente causou perda silenciosa
      de registros de aparelho que ficou offline, e demorou a ser notada porque
      nada dá erro.
  F9  Entre lojas: onde a minha cesta sai mais barata. Lista compartilhada em
      tempo real (dois carrinhos no mesmo mercado) — depende da F8.

Não comece a fase seguinte com a anterior sem teste.

**Fora de escopo, deliberadamente:** feed social e ofertas de terceiros; scraping
de sites de supermercado (instável, quebra sempre); substituição automática de
marca; controle de estoque com inventário manual (a cadência da F4 entrega o
valor sem a manutenção).

=============================================================
11. COMO TESTAMOS AQUI (copiado do que funcionou, incluindo o que doeu)
=============================================================

**11.1 — A suíte roda sem navegador.** `node tests/smoke.js` carrega os módulos
reais com `eval(fs.readFileSync(...))` sobre stubs mínimos de `localStorage`,
`document` e `crypto`, e exercita os FLUXOS, não só as funções puras. Asserção em
uma linha, com nome que descreve a regra em português:

    let ok = 0, fail = 0;
    const check = (nome, real, esperado) => {
      const bateu = Math.abs(Number(real) - Number(esperado)) < 0.01 || real === esperado;
      console.log(`${bateu ? '  OK  ' : ' FALHA'} | ${nome.padEnd(52)} ${bateu ? real : `obtido ${real}, esperado ${esperado}`}`);
      bateu ? ok++ : fail++;
    };

**11.2 — O relógio é congelado, e isso não é opcional.**

    const ANCORA = process.env.HOJE || '<data de hoje>T10:00:00-03:00';
    const DataReal = Date;
    const instante = new DataReal(ANCORA).getTime();
    class DataCongelada extends DataReal {
      constructor(...a) { if (a.length === 0) super(instante); else super(...a); }
      static now() { return instante; }
    }
    DataCongelada.parse = DataReal.parse; DataCongelada.UTC = DataReal.UTC;
    global.Date = DataCongelada;

Medido no app de finanças: a suíte foi entregue verde e, sem uma linha do app
mudar, reprovava 4 testes duas semanas depois e **13 no dia 31**. Nenhum era
defeito — eram datas absolutas envelhecendo. Uma rede que reprova sem regressão
deixa de ser lida, e no dia do defeito real a reprovação parece igual às outras.

**NUNCA escreva data absoluta em teste. Escreva a relação** — "faz 60 dias", "o
último dia deste mês", "min(hoje+3, fim do mês)".

**11.3 — `tests/tempo.js` roda a suíte inteira em várias datas.** Congelar sem
isso troca um defeito por outro: a suíte para de apodrecer e passa a nunca olhar
para o calendário. As datas são as bordas que quebram coisa de verdade: primeiro
dia do mês, meio, penúltimo, **último**, fevereiro, 29 de fevereiro, virada de
ano. Neste app importam também: mês sem nenhuma compra (a mediana não existe),
produto observado uma vez só, e nota importada com data retroativa atravessando a
virada de mês. **Verde num dia só não é verde.**

**11.4 — A SABOTAGEM: teste que não pega regressão não vale.** Depois de
corrigir, quebre o código de propósito e confirme que o teste reprova. O formato
é um script `node` em `$CLAUDE_JOB_DIR/tmp/sabota-*.js`:

    const { execSync } = require('child_process');
    const fs = require('fs');
    const RAIZ = 'D:/Projetos/meus-projetos/compras/';
    const rodar = () => {
      try { execSync('node tests/smoke.js', { cwd: RAIZ, encoding: 'utf8' }); return ''; }
      catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
    };
    // [nome, arquivo, trecho, troca, teste que TEM de reprovar]
    const casos = [ /* ... */ ];
    const original = {};
    try {
      for (const c of casos) { /* aplica uma, roda, confere que a reprovação cita o teste esperado */ }
    } finally {
      for (const [arq, src] of Object.entries(original)) fs.writeFileSync(arq, src);
      console.log(`restaurado. ${bons}/${casos.length} sabotagens foram pegas.`);
      console.log(rodar() ? 'ATENÇÃO: a suíte NÃO está verde após restaurar' : 'suíte verde ✓');
    }

Regras que vieram de erro cometido:
  - **Restaure sempre num `finally`, e CONFIRME a restauração** relendo o
    arquivo. Um script foi interrompido no meio e deixou a sabotagem no código.
  - **Sabotagem que passa é aviso, não alívio.** Nas rodadas do app de finanças a
    maioria das que "passaram" eram **testes vazios**: o cenário não tinha o dado
    que fazia o caminho rodar, o `if` nunca executava e o teste comparava 0 com
    0. Toda sabotagem não pega é investigada — ou o teste é vazio, ou é
    redundante e isso vai documentado, nunca deixado no ar.
  - **Teste comportamento, não o texto do fonte.** Cinco testes passaram na
    primeira rodada por conferirem a string do código em vez do resultado.
  - Sabotagens obrigatórias aqui: trocar mediana por média; remover a conversão
    de unidade; deixar n=0 cair no 🟡; abrir a cesta comparável para produtos de
    um período só; inverter o sinal do delta; ampliar a janela de 6 meses para o
    histórico inteiro; aceitar reimportação da mesma chave de NFC-e; fazer o
    casamento por texto aplicar sozinho em vez de sugerir; deixar uma unidade
    desconhecida do PDV virar `un` por omissão.

**11.5 — Definição de pronto,** por entrega, sem exceção:
  `node --check` em cada arquivo tocado → `node tests/smoke.js` verde →
  `node tests/tempo.js` verde → sabotagens pegas → `VERSAO` e as tags `?v=`
  subidas juntas → `docs/` atualizado → commit em português explicando o PORQUÊ.

=============================================================
12. COMO TRABALHAMOS AQUI
=============================================================

- Diagnostique medindo, não supondo. Reproduza o defeito antes de corrigir.
- **Quando um número da tela não fecha com outro número da mesma tela, é defeito
  até prova em contrário.** Os três piores bugs do app de finanças tinham essa
  assinatura.
- Comentários e mensagens de commit em **português, explicando o porquê** — o "o
  quê" o código já diz.
- Registre cada decisão de arquitetura em `docs/plano-*.md` **na hora**, e
  mantenha `docs/RETOMADA.md` desde a primeira entrega. No app de finanças ele
  nasceu tarde e houve redescoberta cara.
- `js/config.js` fica vazio de propósito. Credencial se digita no app, nunca no
  repositório.
- Ao acrescentar informação numa tela que já existe, **abra a linha existente** em
  vez de redesenhar o bloco ou trocar o número protagonista. Quem usa a tela todo
  dia conhece a forma dela de cor.
- Confirme o push consultando o servidor (`git ls-remote`), não só o git status.

**Armadilhas de ferramenta já conhecidas:**
- Cuide da consistência de fim de linha (CRLF × LF) por arquivo: casar padrão com
  o fim de linha errado falha em silêncio, e isso já custou três sabotagens que
  não casavam sem motivo aparente.
- `$` numa string de substituição do `replace()` é padrão especial: `'R$'`
  corrompe o arquivo. Use `split`/`join`.
- Heredoc no bash quebra com aspas e acentos: escreva o script num arquivo.
- Comentário HTML dentro de template literal: a crase ali quebra o arquivo, e o
  texto do comentário É renderizado — um teste que procura um literal casa com o
  comentário e passa sem testar nada.
- Bloco `async` novo dentro da IIFE da suíte precisa de `await`, senão ele apenas
  agenda e o `process.exit` do fim roda antes.
- O HTML da consulta de NFC-e vem com acentuação e codificação variando por
  estado; trate o encoding explicitamente, como o app de finanças faz com o
  Windows-1252 dos bancos no OFX.

=============================================================
13. DECISÕES QUE NÃO DEVEM SER REVERTIDAS SEM CONVERSA
=============================================================

- A comparação é sempre em **unidade canônica** (R$/kg, R$/L, R$/un). Preço de
  embalagem nunca é comparado com preço de embalagem diferente.
- A referência é **mediana em janela de 6 meses**, não média, não histórico
  inteiro.
- **n = 0 é ⚪, nunca 🟡.**
- **Cesta comparável ≠ total gasto.** Dois números, dois nomes, nunca o mesmo
  rótulo.
- `price_obs` é a **fonte única**; o diagnóstico é derivado, nunca gravado.
- **Casamento de descrição de PDV SUGERE, nunca aplica sozinho.** Unidade
  desconhecida fica de fora, não vira `un` por omissão.
- **Dedupe de NFC-e pela chave de acesso**, sempre.
- Fotos vivem no **IndexedDB**, comprimidas. Nunca no localStorage.
- O **Modo Mercado não abre diálogo** para nada, e não mostra spinner.
- **Envelope de sync desde o primeiro registro**, mesmo antes de existir sync.
- **A cor nunca informa sozinha.**
- **Nada dentro do mercado pode depender de rede.**

=============================================================
14. O QUE EU QUERO AGORA
=============================================================

Implemente todas as fases planejadas, com um popnto que deve sempre estar em mente o design sistem e identidade visual deve ser semelhante ao projeto de finanças e o foco é sempre tornar a ida ao mercado do usuario ser extremamente prazerosa e o mais eficiente possivel

Antes de escrever a Parte 1, me diga em no máximo 10 linhas o que você mudaria
neste plano — como Especialista de Produto, não como executor.
```

---

## Decisões pendentes (resolva antes da F0)

| # | Decisão | Recomendação | Reversível? |
|---|---|---|---|
| 1 | Nome/marca do app (vai para o `id` do manifest) | **CESTA** — curto, pt-BR, direto | **Não.** Trocar o `id` depois cria um app novo em vez de atualizar o instalado |
| 2 | Repositório público ou privado | Público, como o de finanças — com `config.js` vazio | Sim |
| 3 | Limiar do diagnóstico | 7% | Sim (constante única) |
| 4 | Janela da referência | 6 meses | Sim |
| 5 | Qual formato de NFC-e atacar primeiro na F3 | O que **você** conseguir extrair das suas notas: XML se houver, HTML salvo caso contrário. Traga uma nota real antes da F3 — o parser se escreve contra o arquivo de verdade, não contra a especificação | Sim |
| 6 | OCR na F7: WebAssembly local ou API de IA com chave do usuário | API com chave do usuário (mesmo padrão do assistente do app de finanças): zero peso no shell offline, e quem paga é quem usa | Sim |

## O que foi avaliado e recusado (e por quê)

| Proposta | Veredito |
|---|---|
| "Aponte a câmera para a etiqueta e leia em 2s" | O **diagnóstico** é o diferencial; o **OCR** é só um jeito de digitar. OCR de etiqueta offline em 2 s não é entregável com confiança, e errar o preço lido é pior que digitar. Digitação (2 toques) na F1; leitura vem na F6/F7 como conveniência, nunca como dependência |
| "Totalizador com soma projetada de impostos" | **Erro factual**: no Brasil a etiqueta já é com imposto. O que faz o total divergir do caixa é peso variável, promoção condicional e item sem preço — é isso que o totalizador modela. Virou o **conferidor de caixa**, que é mais valioso |
| Despensa/estoque com inventário | Exige manutenção manual que ninguém faz. Substituído pela **sugestão por cadência**, que sai do histórico de graça |
| Lista compartilhada em tempo real | Bom recurso, exige backend. F9, depois do sync |
| Scraping de supermercado / feed de ofertas | Fora de escopo, como você propôs. Instável e trai o local-first |
| Consumir API de preços regionais (Menor Preço Brasil) | Não há API pública nacional consumível; cobertura irregular, CORS, e nos colocaria a competir onde somos fracos em vez de onde somos únicos |

## Origem deste documento

Extraído de `D:\Projetos\meus-projetos\financas` — `README.md`, `docs/RETOMADA.md`,
`docs/plano-testes.md`, o harness de `tests/smoke.js`, a memória do projeto e os
transcripts das sessões anteriores (padrão dos scripts `sabota-*.js` e as lições
de cada entrega). A seção de concorrência e a viabilidade da NFC-e foram
pesquisadas em setembro de 2026; as fontes estão em `docs/pesquisa-mercado.md`.
