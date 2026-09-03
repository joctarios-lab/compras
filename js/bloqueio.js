/* CESTA — a tela de bloqueio: teclado de PIN e digital.

   Ela cobre o app inteiro e vive fora do #app: enquanto os dados estão cifrados,
   nada pode ser desenhado por baixo. */
'use strict';

const Bloqueio = {

  el() { return document.getElementById('lock'); },

  esconder() {
    const el = this.el();
    if (!el) return;
    el.hidden = true;
    el.innerHTML = '';
    document.onkeydown = null;
  },

  /* Com a digital configurada, ela é o caminho principal e o PIN fica como
     saída — é o inverso do que parece: a digital falha mais (dedo molhado,
     leitor sujo), então o PIN nunca pode sumir da tela. */
  mostrar(aoLiberar) {
    if (Auth.bioAtiva()) this.telaDigital(aoLiberar);
    else this.telaPin(aoLiberar);
  },

  telaDigital(aoLiberar) {
    const el = this.el();
    el.hidden = false;
    el.innerHTML = `
      <div class="lock-card">
        <img src="icons/icon.svg" alt="" class="lock-ico">
        <h1>CESTA</h1>
        <p class="lock-txt">Confirme sua digital para entrar.</p>
        <button type="button" class="bio-alvo" id="lk-bio" aria-label="Usar a digital">
          <span data-ico="digital"></span>
        </button>
        <p class="lock-err" id="lk-erro" role="alert"></p>
        <button class="btn-texto" id="lk-pin">Usar o PIN</button>
      </div>`;
    pintarIcones(el);

    const erro = document.getElementById('lk-erro');
    const tentar = async () => {
      erro.textContent = '';
      try {
        const chave = await Auth.abrirComBio();
        if (!(await Auth.conferir(chave))) throw new Error('A digital não abriu os dados.');
        Auth.chave = chave;
        DB.setChave(chave);
        await Auth.guardarSessao(chave);
        Auth.registrarAcerto();
        this.esconder();
        aoLiberar();
      } catch (e) {
        // Cancelar a digital não é erro: é a pessoa escolhendo o PIN
        erro.textContent = /NotAllowed|abort/i.test(String(e.name || e.message))
          ? '' : (e.message || 'Não consegui ler a digital.');
      }
    };

    document.getElementById('lk-bio').addEventListener('click', tentar);
    document.getElementById('lk-pin').addEventListener('click', () => this.telaPin(aoLiberar));
    // Pede a digital já na abertura: um toque a menos, e é o fluxo esperado
    setTimeout(tentar, 350);
  },

  telaPin(aoLiberar) {
    this.tecladoPin({
      titulo: 'CESTA',
      texto: 'Digite seu PIN para entrar.',
      rodape: Auth.bioAtiva()
        ? '<button class="btn-texto" id="lk-volta-bio">Voltar para a digital</button>' : '',
      aoConfirmar: async (pin, mostrarErro) => {
        const espera = Auth.bloqueadoPor();
        if (espera) { mostrarErro(`Muitas tentativas. Espere ${espera}s.`); return false; }
        const chave = await Auth.derivar(pin, Auth.cfg.salt, true);
        if (!(await Auth.conferir(chave))) {
          Auth.registrarErro();
          const agora = Auth.bloqueadoPor();
          mostrarErro(agora ? `PIN incorreto. Bloqueado por ${agora}s.` : 'PIN incorreto.');
          return false;
        }
        Auth.chave = chave;
        DB.setChave(chave);
        await Auth.guardarSessao(chave);
        Auth.registrarAcerto();
        this.esconder();
        aoLiberar();
        return true;
      },
    });

    const voltar = document.getElementById('lk-volta-bio');
    if (voltar) voltar.addEventListener('click', () => this.telaDigital(aoLiberar));
  },

  /* O teclado numérico é DESENHADO, não é um <input>: teclado do sistema em
     campo de PIN abre previsão de texto, autocorreção e, em alguns aparelhos,
     sugere o próprio PIN digitado antes. */
  tecladoPin({ titulo, texto, rodape = '', aoConfirmar, min = 4, max = 8 }) {
    const el = this.el();
    el.hidden = false;
    let pin = '';

    el.innerHTML = `
      <div class="lock-card">
        <img src="icons/icon.svg" alt="" class="lock-ico">
        <h1>${UI.esc(titulo)}</h1>
        <p class="lock-txt">${texto}</p>
        <div class="pin-dots" id="lk-bolas" role="status" aria-label="dígitos informados"></div>
        <p class="lock-err" id="lk-erro" role="alert"></p>
        <div class="pin-pad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="pin-key" data-k="${n}">${n}</button>`).join('')}
          <button type="button" class="pin-key pin-aux" data-k="del" aria-label="Apagar">⌫</button>
          <button type="button" class="pin-key" data-k="0">0</button>
          <button type="button" class="pin-key pin-ok" data-k="ok" aria-label="Confirmar">✓</button>
        </div>
        ${rodape}
      </div>`;

    const bolas = document.getElementById('lk-bolas');
    const erro = document.getElementById('lk-erro');
    const ok = el.querySelector('.pin-ok');

    const pintar = () => {
      /* <i> com .on: é o que o CSS do DOMI desenha. Com <span class="cheia">
         as bolinhas existiam e nunca acendiam — o seletor não casava. */
      bolas.innerHTML = Array.from({ length: Math.max(min, pin.length) },
        (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
      ok.disabled = pin.length < min;
    };

    const confirmar = async () => {
      if (pin.length < min) return;
      ok.disabled = true;
      const deu = await aoConfirmar(pin, m => { erro.textContent = m; });
      if (!deu) { pin = ''; pintar(); }
    };

    /* UMA regra para todas as teclas, como no DOMI: dígito, apagar e confirmar
       saem do mesmo data-k. Tratar o confirmar à parte foi o que o deixou fora
       do teclado, num botão solto embaixo. */
    for (const t of el.querySelectorAll('.pin-key')) {
      t.addEventListener('click', () => {
        const k = t.dataset.k;
        erro.textContent = '';
        if (k === 'del') pin = pin.slice(0, -1);
        else if (k === 'ok') { confirmar(); return; }
        else if (pin.length < max) pin += k;
        pintar();
      });
    }

    // Teclado físico: no desktop ninguém vai clicar em nove botões com o mouse
    document.onkeydown = e => {
      if (/^\d$/.test(e.key) && pin.length < max) { pin += e.key; erro.textContent = ''; pintar(); }
      else if (e.key === 'Backspace') { pin = pin.slice(0, -1); pintar(); }
      else if (e.key === 'Enter') confirmar();
    };

    pintar();
  },

  /* Fluxo de criação e troca de PIN, com a confirmação — e o aviso que a pessoa
     PRECISA ler antes de cifrar os próprios dados. */
  criarPin({ trocar = false, aoTerminar }) {
    let primeiro = null;
    const passo = () => {
      this.tecladoPin({
        titulo: primeiro ? 'Repita o PIN' : (trocar ? 'Novo PIN' : 'Criar PIN'),
        texto: primeiro
          ? 'Digite o mesmo PIN de novo para confirmar.'
          : 'Escolha de 4 a 8 dígitos. <b>Não há como recuperar:</b> esquecer o PIN significa perder os dados deste aparelho.',
        aoConfirmar: async (pin, mostrarErro) => {
          if (!primeiro) { primeiro = pin; passo(); return true; }
          if (pin !== primeiro) {
            primeiro = null;
            mostrarErro('Os dois não bateram. Vamos de novo.');
            setTimeout(passo, 900);
            return false;
          }
          this.esconder();
          await aoTerminar(pin);
          return true;
        },
      });
    };
    passo();
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Bloqueio };
