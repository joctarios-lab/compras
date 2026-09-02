# Pesquisa de mercado e viabilidade técnica — setembro/2026

O que foi verificado antes de escrever o `PROMPT-INICIAL.md`, para que as
decisões de escopo não fossem tomadas por suposição.

## 1. Concorrência

**Apps de lista, sem inteligência de preço:** Listonic, Bring!, Out of Milk.
Fortes em montar e compartilhar; não guardam quanto se pagou nem comparam.

**Apps de preço, dependentes de rede:**

- **Menor Preço Brasil** — aplicativo oficial do CONFAZ, resultado de acordo de
  cooperação técnica entre 21 estados e o DF; substituiu os apps estaduais
  próprios (o ES, por exemplo, adotou-o como único). Alimenta-se em tempo real
  das NF-e e NFC-e emitidas e mostra o menor preço perto do usuário. Em 2026 a
  cobertura citada inclui RS, SC, PR, BA, PA, PE, RJ, RO, RR, SE, TO, AC, AL, ES,
  PI e DF. **Exige internet e GPS, não conhece o histórico do usuário e não tem
  lista de compras.**
- **ClickSuper** — o mais próximo do nosso escopo: compara preços na região, cria
  listas e acompanha histórico de preços. Dependente de rede e de cobertura.
- **Preço Fresco** — ofertas consolidadas e leitura de código de barras.
- **Super Save** — preços de supermercado (iOS).
- **MercadoCompare** e similares — leem o QR da NFC-e **após** a compra.

**Conclusão de posicionamento:** ninguém ocupa o cruzamento "meu próprio
histórico + veredito no corredor + 100% offline + sem anúncio". Os apps de preço
falham exatamente onde o app precisa funcionar — dentro do mercado, com sinal
ruim. Não competimos com o Menor Preço Brasil: ele responde "quanto custa lá
fora", nós respondemos "quanto isso custa pra mim".

## 2. Viabilidade da NFC-e

O que a consulta apurou, e que definiu a arquitetura em camadas da importação:

- **Não há API pública nacional de consulta.** Cada estado mantém seu portal com
  URL própria — e elas mudam: MG e PB já trocaram as URLs do QR Code, com prazo
  de transição. SC, ES, PB e PI publicam endereços distintos entre si.
- **Captcha é exigido em vários estados** na consulta por chave de acesso.
- **CORS impede o fetch direto do navegador.** Um PWA não busca a página do SEFAZ
  por conta própria; qualquer promessa de "escaneou e importou" sem servidor é
  falsa na plataforma.
- **O QR Code carrega a chave de acesso de 44 dígitos** e parâmetros de
  validação — identifica a nota, mas não devolve os itens.
- Parsear NF-e/NFC-e programaticamente é reconhecidamente não trivial, sobretudo
  pela variação de portal entre estados.

**Decisão:** importar **arquivo** (XML, HTML salvo, CSV) com parse 100% local é o
caminho principal — sem CORS, sem captcha, funciona offline, e replica o padrão
do importador OFX que já provou ser sólido no app de finanças. Proxy via Edge
Function fica como camada opcional e *best-effort*, nunca como único caminho.

## 3. Código de barras no navegador

A `BarcodeDetector` nativa tem suporte no Chrome/Edge/Opera e **não é
implementada pelo Safari** — logo, por nenhum navegador do iPhone, todos sobre
WebKit. O caminho multiplataforma é WebAssembly (ZBar compilado) carregado sob
demanda. Portanto: nativa onde houver, fallback WASM onde não houver, digitação
sempre disponível. Um recurso que falha em silêncio no iPhone é pior que um
recurso ausente.

## Fontes

- [Menor Preço Brasil passa a ser único aplicativo oficial — SEFAZ/ES](https://sefaz.es.gov.br/menor-preco-brasil-passa-ser-unico-aplicativo)
- [CONFAZ lança o aplicativo Menor Preço Brasil](https://www.confaz.fazenda.gov.br/noticias-do-confaz/confaz-lanca-aplicativo-menor-preco-brasil-destinado-a-ajudar-o-cidadao-a-encontrar-os-melhores-valores-no-comercio)
- [Sefaz-PE — aplicativo de pesquisa de preços ao consumidor](https://www.sefaz.pe.gov.br/Noticias/Paginas/Sefaz-PE-disponibiliza-aplicativo-de-pesquisa-de-pre%C3%A7os-ao-consumidor.aspx)
- [ClickSuper](https://www.clicksuper.com.br/)
- [Mobills — aplicativos de lista de compras para 2026](https://www.mobills.com.br/blog/aplicativos/aplicativo-de-lista-de-compras/)
- [InfoPrice — apps e sites para comparar preços](https://www.infoprice.co/blog/6-sites-apps-para-comparar-precos/)
- [Portal NFC-e SEFAZ-AM — consulte sua nota](https://portalnfce.sefaz.am.gov.br/consumidor/consulte-sua-nota/)
- [NFC-e — Manual de Padrões Técnicos (Portal Nacional da NF-e)](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=p4adPc9Q0bA%3D)
- [SEFAZ-ES — QR Code da NFC-e](https://sefaz.es.gov.br/qr-code)
- [SEFAZ-SC — webservice da NFC-e, URL do QR Code e da consulta](https://www.sef.sc.gov.br/api-portal/Documento/ver/1398)
- [SEFAZ-PB — novo endereço do QR Code da NFC-e](https://www.sefaz.pb.gov.br/announcements/8996-sefaz-tem-novo-endereco-do-qr-code-da-nfc-e)
- [SEFAZ-MG — troca da URL de consulta a NFC-e via QR Code](https://ndd.tech/blog/compliance-fiscal/sefaz-mg-veja-as-novas-urls-para-consulta-e-autorizacao-de-nfc-e-via-qrcode/)
- [Consultar NFC-e: guia de consulta fiscal](https://cidesp.com.br/v2/consultar-nfce)
- [Como parsear NF-e e NFC-e em JavaScript (e por que é mais complexo do que parece)](https://www.tabnews.com.br/shoc/como-parsear-nf-e-e-nfc-e-em-javascript-e-por-que-e-mais-complexo-do-que-parece)
- [MDN — Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API)
- [Can I use — BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector)
- [Barcode Scanning on iOS: The Missing Web API and a WebAssembly Solution](https://dev.to/ilhannegis/barcode-scanning-on-ios-the-missing-web-api-and-a-webassembly-solution-2in2)
