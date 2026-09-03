/* CESTA — a primeira vez.

   O APP TEM DE SE APRESENTAR. Sem isto, quem abre pela primeira vez encontra um
   campo de texto vazio e três abas, sem saber o que o app faz, para que serve,
   nem por onde começar — e fecha. Foi exatamente o que aconteceu no primeiro
   teste real, e é o defeito mais caro que um app pode ter: ele não chega a ser
   usado errado, ele não chega a ser usado.

   TRÊS REGRAS DESTE ARQUIVO:

     1. ENSINAR FAZENDO, não lendo. Ninguém lê tutorial. Cada passo produz algo
        que fica: ao fim da abertura existe uma lista de verdade, montada pela
        pessoa, pronta para levar ao mercado.
     2. PULÁVEL SEMPRE. Quem já entendeu não pode ser obrigado a assistir.
     3. UMA IDEIA POR TELA. O app tem um argumento central — "compare o preço
        com o que VOCÊ já pagou" — e ele precisa caber numa frase. */
'use strict';

const Onboarding = {

  CHAVE: 'cesta.abertura',

  jaFez() {
    try { return localStorage.getItem(this.CHAVE) === 'ok'; } catch (_) { return false; }
  },

  marcarFeito() {
    try { localStorage.setItem(this.CHAVE, 'ok'); } catch (_) {}
  },

  /* Reabre a apresentação a partir da Ajuda: quem quis rever tem de conseguir,
     e quem chegou aqui por outra pessoa (a lista compartilhada) precisa. */
  refazer() { this.passo = 0; this.escolhidos = new Set(); this.abrir(); },

  passo: 0,
  escolhidos: new Set(),

  /* ------------------------------------------------------------ telas --- */

  abrir() {
    const tela = document.getElementById('tela');
    if (!tela) return;
    document.body.classList.add('em-abertura');
    this.desenhar();
  },

  fechar(concluiu) {
    document.body.classList.remove('em-abertura');
    if (concluiu) {
      this.marcarFeito();
      /* A PRIMEIRA COMPRA JÁ NASCE MARCADA quando a pessoa disse o dia. É o que
         faz a página HOJE abrir com algo a dizer em vez de um convite vazio —
         ninguém deve terminar a apresentação e encontrar um app sem nada. */
      const cfg = DB.cfg() || {};
      if (!DB.planosAbertos().length && cfg.dia_da_compra_grande) {
        const hoje = new Date(DB.hojeISO() + 'T12:00:00');
        const dia = Number(cfg.dia_da_compra_grande);
        if (hoje.getDate() >= dia) hoje.setMonth(hoje.getMonth() + 1);
        const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        hoje.setDate(Math.min(dia, ultimo));
        const p = n => String(n).padStart(2, '0');
        DB.novoPlano({
          ciclo: 'mensal',
          data: `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`,
          orcamento: cfg.gasto_mensal_esperado || null,
        });
      }
    }
    irPara('hoje');
  },

  desenhar() {
    const tela = document.getElementById('tela');
    tela.innerHTML = this.telas[this.passo].call(this);
    pintarIcones(tela);
    this.ligar(tela);
    window.scrollTo(0, 0);
  },

  avancar() {
    this.passo++;
    if (this.passo >= this.telas.length) { this.fechar(true); return; }
    this.desenhar();
  },

  voltar() {
    if (this.passo === 0) return;
    this.passo--;
    this.desenhar();
  },

  pontos() {
    return `<div class="ob-pontos" aria-hidden="true">${
      this.telas.map((_, i) => `<span class="${i === this.passo ? 'ativo' : ''}"></span>`).join('')
    }</div>`;
  },

  telas: [

    /* TELA 1 — O QUE É O APP, numa frase que cabe na cabeça.
       Não é uma lista de recursos: é a pergunta que a pessoa tem no corredor,
       que é o motivo de ela estar aqui. */
    function boasVindas() {
      return `<div class="ob">
        <div class="ob-marca"><img src="icons/icon.svg" alt=""><b>CESTA</b></div>

        <h1 class="ob-titulo">Esse preço tá bom?</h1>
        <p class="ob-texto">
          No mercado, com o produto na mão, é difícil lembrar quanto custava mês
          passado. O CESTA responde isso <b>na hora</b> — comparando com o que
          <b>você mesmo</b> já pagou.
        </p>

        <div class="ob-exemplo">
          <div class="ob-linha-ex">
            <div><b>Arroz 5 kg</b><span class="sub">Você digita: R$ 24,90</span></div>
          </div>
          <div class="diag s-green">
            <span>🟢 Excelente</span><span class="pct">−12%</span>
          </div>
          <p class="diag-nota">R$ 4,98/kg · mediana R$ 5,66/kg (6 meses, 4 registros)</p>
        </div>

        <p class="ob-texto pequeno">
          Funciona <b>sem internet</b> — o sinal do mercado não atrapalha. E os
          seus preços ficam no seu aparelho, não são vendidos nem publicados.
        </p>

        ${this.pontos()}
        <button class="btn btn-principal btn-largo btn-grande" data-ob="avancar">Como funciona</button>
        <button class="btn-texto" data-ob="pular">Já entendi, quero usar</button>
      </div>`;
    },

    /* TELA 2 — COMO SE USA, em três momentos. A dúvida real de quem abriu o app
       não é "quais são os recursos", é "o que eu faço agora". */
    function comoFunciona() {
      return `<div class="ob">
        <h1 class="ob-titulo">São três momentos</h1>

        <div class="ob-passo">
          <span class="ob-num">1</span>
          <div>
            <b>Em casa</b>
            <p>Monte a lista do que falta. Leva dois minutos e o app já mostra
               uma <b>estimativa do total</b>, quando tiver histórico.</p>
          </div>
        </div>

        <div class="ob-passo">
          <span class="ob-num">2</span>
          <div>
            <b>No mercado</b>
            <p>Toque no item, digite o preço da etiqueta. O app diz na hora se
               está <b>🟢 bom, 🟡 normal ou 🔴 caro</b> — e vai somando o carrinho
               para você não levar susto no caixa.</p>
          </div>
        </div>

        <div class="ob-passo">
          <span class="ob-num">3</span>
          <div>
            <b>Depois</b>
            <p>O app guarda tudo e mostra o que subiu, quanto a <b>sua</b> cesta
               encareceu e em qual mercado ela sai mais barata.</p>
          </div>
        </div>

        <p class="ob-texto pequeno">
          Quanto mais você usa, melhor ele fica — porque a comparação é com o seu
          próprio histórico.
        </p>

        ${this.pontos()}
        <button class="btn btn-principal btn-largo btn-grande" data-ob="avancar">Começar minha lista</button>
        <button class="btn-texto" data-ob="voltar">Voltar</button>
      </div>`;
    },

    /* TELA 3 — QUEM É VOCÊ, E COMO A CASA SE CHAMA.

       Perguntado agora porque o passo seguinte (a nuvem) precisa do nome, e
       porque o app passa a te chamar pelo nome na página HOJE. Só o primeiro
       nome é obrigatório — e mesmo ele é pulável. */
    function suaCasa() {
      const cfg = DB.cfg() || {};
      return `<div class="ob">
        <h1 class="ob-titulo">Como te chamamos?</h1>
        <p class="ob-texto">O app fala com você, e fica melhor sabendo o seu nome.</p>

        <input class="campo" id="ob-nome" placeholder="Seu nome" autocomplete="given-name"
               value="${UI.esc((Sync.cfg && Sync.cfg.nome) || '')}">
        <input class="campo" id="ob-casa" placeholder="Nome da casa (ex.: Casa da Ana)"
               autocomplete="off" style="margin-top:var(--e2)"
               value="${UI.esc(cfg.familia_nome || '')}">
        <p class="ob-texto pequeno">O nome da casa aparece quando você dividir a
          lista com outra pessoa. Dá para mudar depois.</p>

        ${this.pontos()}
        <button class="btn btn-principal btn-largo btn-grande" data-ob="avancar">Continuar</button>
        <button class="btn-texto" data-ob="voltar">Voltar</button>
      </div>`;
    },

    /* TELA 4 — A NUVEM.

       É AQUI QUE O APP ANTIGO FALHAVA: a sincronização existia, mas escondida
       nos ajustes, e quem instalava no segundo aparelho não descobria que era
       possível. Perguntar na abertura é o que transforma "recurso que existe"
       em "recurso que se usa".

       As duas opções são legítimas e ficam lado a lado. "Só neste aparelho"
       não é a opção do preguiçoso: é a escolha certa para quem usa um celular
       só, e o app funciona inteiro assim. */
    function aNuvem() {
      return `<div class="ob">
        <h1 class="ob-titulo">Usar em quantos aparelhos?</h1>
        <p class="ob-texto">Dá para usar só aqui, ou dividir a lista e o
          histórico com quem faz as compras com você.</p>

        <button class="escolha" data-ob="local">
          <b>📱 Só neste aparelho</b>
          <span>Tudo fica guardado aqui. Funciona sem internet e sem conta —
            é a escolha certa para quem usa um celular só.</span>
        </button>

        <button class="escolha" data-ob="nuvem">
          <b>☁️ Sincronizar entre aparelhos</b>
          <span>A mesma lista no seu celular e no de casa. Precisa de uma conta
            gratuita no Supabase — leva uns 10 minutos, uma vez só.</span>
        </button>

        <p class="ob-texto pequeno">Escolher agora não fecha porta nenhuma: dá
          para ligar a sincronização depois, em Ajustes.</p>

        ${this.pontos()}
        <button class="btn-texto" data-ob="voltar">Voltar</button>
      </div>`;
    },

    /* TELA 5 — PROTEÇÃO. Pulável, e com o aviso que precisa ser lido ANTES:
       o PIN deriva a chave, então esquecê-lo custa os dados do aparelho. */
    function protecao() {
      return `<div class="ob">
        <h1 class="ob-titulo">Proteger o aparelho?</h1>
        <p class="ob-texto">O histórico diz onde você faz mercado, quanto gasta
          e o que consome. Um PIN <b>criptografa tudo isso</b> aqui dentro.</p>

        <div class="ob-exemplo">
          <b>Antes de decidir:</b>
          <p class="sub">O PIN não fica guardado em lugar nenhum — ele
            <b>gera a chave</b> que abre os dados. Por isso não há recuperação:
            esquecer o PIN significa perder o histórico deste aparelho.</p>
        </div>

        <button class="btn btn-principal btn-largo btn-grande" data-ob="pin">Criar um PIN</button>
        <button class="btn btn-largo btn-grande" data-ob="avancar" style="margin-top:var(--e2)">
          Agora não
        </button>
        ${this.pontos()}
        <button class="btn-texto" data-ob="voltar">Voltar</button>
      </div>`;
    },

    /* TELA 3 — MONTAR A PRIMEIRA LISTA TOCANDO.

       Aqui o tutorial vira trabalho de verdade: o que a pessoa escolher fica.
       Um campo de texto em branco seria a pior tela possível para quem ainda
       não sabe se o app entende "arroz" ou "Arroz Tio João 5kg". */
    function primeiraLista() {
      const grupos = Catalogo.sugestoesPorCorredor();
      return `<div class="ob">
        <h1 class="ob-titulo">O que costuma comprar?</h1>
        <p class="ob-texto">
          Toque no que você leva com frequência. Dá para mudar tudo depois — isto
          é só para o app não começar vazio.
        </p>

        <div class="ob-sugestoes">
          ${grupos.map(g => `
            <p class="secao">${g.icone} ${g.nome}</p>
            <div class="ob-chips">
              ${g.itens.map(i => `
                <button class="chip" data-item="${UI.esc(i.nome)}"
                        data-un="${i.unidade}" data-qtd="${i.qtd}"
                        aria-pressed="false">${UI.esc(i.nome)}</button>`).join('')}
            </div>`).join('')}
        </div>

        ${this.pontos()}
        <div class="ob-rodape">
          <span class="ob-conta" id="ob-conta">nenhum item escolhido</span>
          <button class="btn btn-principal btn-largo btn-grande" data-ob="avancar">Continuar</button>
          <button class="btn-texto" data-ob="voltar">Voltar</button>
        </div>
      </div>`;
    },

    /* TELA — A ROTINA DA CASA.

       Não é burocracia: as duas respostas alimentam o calendário de compras e
       a projeção do mês. Sem elas, a página HOJE abre sem nada a dizer no
       primeiro dia — e um assistente que não tem o que dizer não parece um
       assistente. */
    function aRotina() {
      const cfg = DB.cfg() || {};
      return `<div class="ob">
        <h1 class="ob-titulo">Como é a rotina da casa?</h1>
        <p class="ob-texto">Duas respostas rápidas, e o app já consegue se
          organizar com você.</p>

        <p class="secao">Que dia costuma ser a compra grande?</p>
        <select class="campo" id="ob-dia">
          <option value="">Não tenho dia fixo</option>
          ${Array.from({ length: 28 }, (_, i) => i + 1).map(d =>
            `<option value="${d}" ${cfg.dia_da_compra_grande == d ? 'selected' : ''}>dia ${d}</option>`).join('')}
        </select>

        <p class="secao">Quanto costuma gastar por mês com mercado?</p>
        <input class="campo campo-preco" id="ob-gasto" inputmode="decimal"
               placeholder="R$ 0,00" value="${cfg.gasto_mensal_esperado ? UI.fmt(cfg.gasto_mensal_esperado) : ''}">
        <p class="ob-texto pequeno">Serve para o app avisar <b>antes</b> de
          estourar, não para cobrar você. Pode ser um chute — dá para mudar depois.</p>

        ${this.pontos()}
        <button class="btn btn-principal btn-largo btn-grande" data-ob="avancar">Continuar</button>
        <button class="btn-texto" data-ob="voltar">Voltar</button>
      </div>`;
    },

    /* TELA 4 — O ATALHO QUE MUDA O JOGO: a nota fiscal.

       Sem histórico, o comparador não tem o que dizer por semanas. Importar
       notas que a pessoa já tem resolve isso numa tarde. Esta tela existe para
       que ela SAIBA que esse atalho existe — sem isso, ela viveria o vazio
       inicial achando que o app não funciona. */
    function semear() {
      return `<div class="ob">
        <h1 class="ob-titulo">Quer começar com histórico?</h1>
        <p class="ob-texto">
          O app compara com as <b>suas</b> compras anteriores. No começo ele
          ainda não tem nenhuma — então mostra
          <span class="selo s-slate">⚪ primeiro registro</span> em vez de
          inventar um veredito.
        </p>

        <div class="ob-exemplo">
          <b>O atalho:</b>
          <p class="sub">Se você tem notas fiscais de mercado (aquele cupom com
            QR Code), dá para importar. <b>Uma nota vira dezenas de preços de
            uma vez</b> — e o app já começa comparando.</p>
        </div>

        <p class="ob-texto pequeno">
          Também dá para simplesmente usar: depois de duas ou três compras, o
          diagnóstico começa a aparecer sozinho.
        </p>

        ${this.pontos()}
        <button class="btn btn-principal btn-largo btn-grande" data-ob="importar">
          Importar uma nota agora
        </button>
        <button class="btn btn-largo btn-grande" data-ob="avancar">Deixar para depois</button>
      </div>`;
    },

    /* TELA 5 — PRONTO, E O QUE FAZER AGORA. Fechar sem dizer o próximo passo
       devolveria a pessoa ao mesmo "e agora?" do começo. */
    function pronto() {
      const n = this.escolhidos.size;
      return `<div class="ob">
        <div class="ob-check">✓</div>
        <h1 class="ob-titulo">Tudo pronto</h1>
        <p class="ob-texto">
          ${n ? `Sua lista começou com <b>${n} ${n === 1 ? 'item' : 'itens'}</b>.`
              : 'Sua lista está pronta para receber o primeiro item.'}
        </p>

        <div class="ob-proximo">
          <b>No mercado, faça assim:</b>
          <p>1. Toque em <b>“Estou no mercado”</b> e escolha a loja.</p>
          <p>2. Toque no item e digite o preço da etiqueta.</p>
          <p>3. O veredito aparece enquanto você digita. Toque em ✓ e siga.</p>
        </div>

        <p class="ob-texto pequeno">
          Perdeu alguma coisa? O botão <b>?</b> no topo abre a ajuda a qualquer
          momento.
        </p>

        ${this.pontos()}
        <button class="btn btn-principal btn-largo btn-grande" data-ob="avancar">Ver minha lista</button>
      </div>`;
    },
  ],

  /* ---------------------------------------------------------- eventos --- */

  ligar(tela) {
    for (const b of tela.querySelectorAll('[data-ob]')) {
      b.addEventListener('click', () => {
        const acao = b.dataset.ob;
        if (acao === 'avancar') { this.guardarRespostas(); this.aplicarEscolhas(); this.avancar(); }
        else if (acao === 'local') {
          /* "Só neste aparelho" é uma escolha, não uma desistência: fica
             registrada para o app não voltar a perguntar. */
          this.guardarRespostas();
          try { localStorage.setItem('cesta.nuvem', 'local'); } catch (_) {}
          this.avancar();
        }
        else if (acao === 'nuvem') {
          this.guardarRespostas();
          this.marcarFeito();
          document.body.classList.remove('em-abertura');
          /* Manda para a configuração real, com o app já montado por trás: se a
             pessoa desistir no meio, ela cai num app funcionando, não num vazio. */
          irPara('hoje');
          abrirSync();
        }
        else if (acao === 'pin') {
          this.guardarRespostas();
          const seguir = () => { this.avancar(); };
          Bloqueio.criarPin({ aoTerminar: async pin => {
            await Auth.ativar(pin);
            UI.toast('Pronto. Seus dados estão criptografados neste aparelho.', 5000);
            document.body.classList.add('em-abertura');
            seguir();
          } });
        }
        else if (acao === 'voltar') this.voltar();
        else if (acao === 'pular') { this.aplicarEscolhas(); this.fechar(true); }
        else if (acao === 'importar') { this.aplicarEscolhas(); this.marcarFeito(); this.fechar(true); abrirImportacao(); }
      });
    }

    for (const chip of tela.querySelectorAll('.chip[data-item]')) {
      chip.addEventListener('click', () => {
        const nome = chip.dataset.item;
        if (this.escolhidos.has(nome)) this.escolhidos.delete(nome);
        else this.escolhidos.add(nome);
        chip.setAttribute('aria-pressed', this.escolhidos.has(nome) ? 'true' : 'false');
        chip.classList.toggle('ativo', this.escolhidos.has(nome));
        const conta = document.getElementById('ob-conta');
        if (conta) {
          const n = this.escolhidos.size;
          conta.textContent = n === 0 ? 'nenhum item escolhido'
            : n === 1 ? '1 item escolhido' : `${n} itens escolhidos`;
        }
      });
    }
  },

  /* Grava as respostas das telas de texto a cada transição. Sem isto, voltar
     uma tela apagaria o que a pessoa acabou de escrever — e ela não voltaria a
     escrever de novo. */
  guardarRespostas() {
    const nome = document.querySelector('#ob-nome');
    if (nome && nome.value.trim()) {
      Sync.load();
      Sync.cfg.nome = nome.value.trim();
      Sync.saveCfg();
    }
    const casa = document.querySelector('#ob-casa');
    if (casa && casa.value.trim()) DB.setCfg({ familia_nome: casa.value.trim() });

    const dia = document.querySelector('#ob-dia');
    if (dia) DB.setCfg({ dia_da_compra_grande: dia.value ? Number(dia.value) : null });

    const gasto = document.querySelector('#ob-gasto');
    if (gasto && gasto.value) {
      const v = UI.lerMoeda(gasto);
      DB.setCfg({ gasto_mensal_esperado: v || null });
      if (v) DB.setOrcamentoDoMes(DB.mesDe(DB.hojeISO()), v);
    }
  },

  /* Grava o que foi escolhido. Roda em toda transição para que voltar e
     avançar não perca nada — e é idempotente: o item já criado não duplica. */
  aplicarEscolhas() {
    if (!this.escolhidos.size) return;
    let lista = DB.listaEmCurso() || DB.listasPlanejadas()[0] || DB.novaLista({});
    const jaNaLista = new Set(DB.itensDaLista(lista.id).map(li => li.item_id));

    for (const nome of this.escolhidos) {
      const def = Catalogo.ITENS_COMUNS.find(i => i[0] === nome);
      const item = DB.itemPorNome(nome, {
        categoria: def ? def[1] : 'outros',
        unidade: def ? def[2] : 'un',
        qtd_habitual: def ? def[3] : 1,
      });
      if (jaNaLista.has(item.id)) continue;
      DB.addNaLista(lista.id, { item_id: item.id, qtd: item.qtd_habitual, unidade: item.unidade });
      jaNaLista.add(item.id);
    }
  },
};

/* ======================================================== A AJUDA === */

/* A ajuda existe porque nenhuma apresentação cobre tudo, e porque a dúvida
   aparece DEPOIS — no corredor, na frente do produto. Ela responde as perguntas
   que as pessoas fazem de verdade, na linguagem delas. */
function abrirAjuda() {
  UI.folha(`
    <h2 class="titulo">Ajuda</h2>

    <div class="ajuda">
      <details open>
        <summary>Para que serve o CESTA?</summary>
        <p>Para você saber, dentro do mercado, se o preço na etiqueta está bom —
          comparando com o que <b>você</b> já pagou em outras compras.</p>
      </details>

      <details>
        <summary>O que significam as cores?</summary>
        <p><span class="selo s-green">🟢 Excelente</span> pelo menos 7% mais
          barato que o normal para você.</p>
        <p><span class="selo s-amber">🟡 Na média</span> perto do que costuma
          custar.</p>
        <p><span class="selo s-red">🔴 Caro</span> pelo menos 7% acima do
          normal. O app mostra junto o melhor preço que você já viu, para
          decidir se leva ou espera.</p>
        <p><span class="selo s-slate">⚪ Primeiro registro</span> ainda não há
          com o que comparar. O app <b>não inventa</b> um veredito.</p>
      </details>

      <details>
        <summary>De onde vem essa comparação?</summary>
        <p>Da <b>mediana</b> dos seus últimos 6 meses para aquele produto — e
          sempre por unidade: reais por quilo, por litro ou por unidade. É o que
          permite comparar um pacote de 5 kg com um de 1 kg.</p>
        <p>Mediana e não média: uma promoção isolada não pode fazer o app achar
          que o preço normal ficou caro.</p>
      </details>

      <details>
        <summary>Por que meu app não mostra nada ainda?</summary>
        <p>Porque ele compara com o seu histórico, e ele começa vazio. Duas
          saídas: usar por duas ou três compras, ou <b>importar notas fiscais</b>
          que você já tem — cada nota vira dezenas de preços de uma vez.</p>
      </details>

      <details>
        <summary>O “Mais por Menos” serve para quê?</summary>
        <p>Para decidir entre duas embalagens na hora: o refil de 1 L a R$ 5,90
          compensa contra o frasco de 500 ml a R$ 3,20? Ele responde na hora, e
          <b>não precisa de histórico nenhum</b>.</p>
      </details>

      <details>
        <summary>Funciona sem internet?</summary>
        <p>Sim, inteiro. É de propósito: o sinal dentro do mercado costuma ser
          ruim, e é justamente lá que o app precisa funcionar. A sincronização
          entre aparelhos é opcional.</p>
      </details>

      <details>
        <summary>Meus dados vão para algum lugar?</summary>
        <p>Não. Eles ficam no seu aparelho. Se você ligar a sincronização, vão
          para um banco de dados <b>seu</b>, que só você e quem você convidar
          acessam. Nada é vendido, publicado ou compartilhado.</p>
      </details>

      <details>
        <summary>O que é “cesta comparável”?</summary>
        <p>A sua inflação de verdade. Ela olha só os produtos que você comprou
          <b>nos dois meses</b> — assim, comprar um churrasco num mês não vira
          “inflação”. É diferente de “você gastou”, que sobe quando você
          simplesmente compra mais coisas.</p>
      </details>
    </div>

    <button class="btn btn-largo btn-grande" id="ajuda-tour" style="margin-top:var(--e4)">
      Ver a apresentação de novo
    </button>`);

  document.querySelector('#ajuda-tour').addEventListener('click', () => {
    document.querySelector('.folha-fundo').remove();
    Onboarding.refazer();
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { Onboarding, abrirAjuda };
