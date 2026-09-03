/* CESTA — bloqueio por PIN, digital e criptografia dos dados no aparelho.

   O QUE ISTO PROTEGE. O histórico de compras diz onde a família faz mercado,
   quanto gasta, quando viaja (pelas semanas sem compra) e o que consome. Num
   celular perdido, isso fica legível para quem abrir o navegador — a menos que
   os dados estejam cifrados em repouso.

   COMO FUNCIONA. O PIN não é comparado: ele DERIVA a chave (PBKDF2, 150 mil
   iterações) que abre os dados (AES-256-GCM). Não existe "senha certa" guardada
   em lugar nenhum — PIN errado simplesmente não decifra. Por isso esquecer o PIN
   significa perder os dados locais, e a tela avisa isso antes de ativar.

   A DIGITAL não substitui a chave: ela guarda a MESMA chave, cifrada por um
   segredo que só o leitor biométrico devolve (extensão PRF do WebAuthn). Quem
   copiar o armazenamento não abre nada sem a digital ou o PIN.

   Portado do DOMI, onde já foi usado no dia a dia. */
'use strict';

const Auth = {
  KEY: 'cesta.auth',
  SESSAO_KEY: 'cesta.sessao',
  MINUTOS_SESSAO: 15,

  cfg: null,
  chave: null,          // CryptoKey ativa enquanto o app está aberto

  load() {
    try { this.cfg = JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch (_) { this.cfg = {}; }
    return this.cfg;
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.cfg)); } catch (_) {}
  },

  /* Há bloqueio quando existe a configuração do PIN — ou quando os DADOS
     estão cifrados. O segundo caso importa porque os dois fatos moram em
     chaves separadas do localStorage: perder o `cesta.auth` (uma limpeza
     parcial do site, uma gravação que falhou) deixava dados cifrados e um app
     convencido de que não havia PIN. Ele abria e morria. */
  ligado() {
    if (this.cfg && this.cfg.salt) return true;
    return DB.cifradoNoDisco();
  },

  /* -------------------------------------------------------- derivação --- */

  b64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },

  unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); },

  /* extraivel: necessário só para guardar a chave na sessão da aba e para
     cifrá-la com o segredo da digital. */
  async derivar(pin, saltB64, extraivel = false) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: this.unb64(saltB64), iterations: 150000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, extraivel, ['encrypt', 'decrypt']);
  },

  /* ---------------------------------------------------------- sessão --- */

  /* A chave fica na sessão DA ABA (sessionStorage) por alguns minutos: sem isso
     o app pediria o PIN a cada recarga de página, e quem usa no desktop recarrega
     o tempo todo. sessionStorage morre ao fechar a aba, que é o comportamento
     que se espera de uma sessão. */
  async guardarSessao(chave) {
    try {
      const bruta = await crypto.subtle.exportKey('raw', chave);
      sessionStorage.setItem(this.SESSAO_KEY, JSON.stringify({
        k: this.b64(bruta), ate: Date.now() + this.MINUTOS_SESSAO * 60000,
      }));
    } catch (_) {}
  },

  async lerSessao() {
    try {
      const s = JSON.parse(sessionStorage.getItem(this.SESSAO_KEY) || 'null');
      if (!s || s.ate < Date.now()) { this.limparSessao(); return null; }
      return crypto.subtle.importKey('raw', this.unb64(s.k), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    } catch (_) { return null; }
  },

  limparSessao() { try { sessionStorage.removeItem(this.SESSAO_KEY); } catch (_) {} },

  /* ------------------------------------------------ tentativas erradas --- */

  /* Bloqueio progressivo: 5 erros travam por 30s, e dobra a cada rodada. Um PIN
     de 4 dígitos tem 10 mil combinações — sem isso, quem tem o aparelho na mão
     tenta todas em minutos. */
  bloqueadoPor() {
    const ate = this.cfg.bloqueadoAte || 0;
    return ate > Date.now() ? Math.ceil((ate - Date.now()) / 1000) : 0;
  },

  registrarErro() {
    this.cfg.erros = (this.cfg.erros || 0) + 1;
    if (this.cfg.erros >= 5) {
      const rodadas = Math.floor(this.cfg.erros / 5);
      this.cfg.bloqueadoAte = Date.now() + 30000 * Math.pow(2, rodadas - 1);
    }
    this.save();
  },

  registrarAcerto() {
    this.cfg.erros = 0;
    delete this.cfg.bloqueadoAte;
    this.save();
  },

  /* ---------------------------------------------------------- ativar --- */

  async ativar(pin) {
    const salt = this.b64(crypto.getRandomValues(new Uint8Array(16)));
    const chave = await this.derivar(pin, salt, true);
    this.cfg.salt = salt;
    this.cfg.criadoEm = new Date().toISOString();
    this.save();
    this.chave = chave;
    DB.setChave(chave);
    await this.guardarSessao(chave);
    return chave;
  },

  async desativar(pin) {
    const chave = await this.derivar(pin, this.cfg.salt, true);
    // Prova que o PIN é o certo ANTES de desligar: sem isso, um PIN errado
    // desligaria a proteção e deixaria os dados em claro para quem tentou.
    if (!(await this.conferir(chave))) return false;
    DB.setChave(null);
    this.cfg = {};
    this.save();
    this.limparSessao();
    this.chave = null;
    return true;
  },

  /* Confere a chave tentando decifrar de verdade. Guardar um "hash do PIN" para
     comparar seria guardar justamente o que não se quer guardar. */
  async conferir(chave) {
    try { await DB.abrirCom(chave); return true; }
    catch (_) { return false; }
  },

  async trocarPin(pinAtual, pinNovo) {
    const atual = await this.derivar(pinAtual, this.cfg.salt, true);
    if (!(await this.conferir(atual))) return false;
    const salt = this.b64(crypto.getRandomValues(new Uint8Array(16)));
    const nova = await this.derivar(pinNovo, salt, true);
    this.cfg.salt = salt;
    // A digital guardava a chave ANTIGA cifrada: ela precisa ser refeita, senão
    // desbloquearia com uma chave que não abre mais nada.
    delete this.cfg.bioId; delete this.cfg.bioChave; delete this.cfg.bioSalt;
    this.save();
    this.chave = nova;
    DB.setChave(nova);
    await this.guardarSessao(nova);
    return true;
  },

  /* -------------------------------------------------------- biometria --- */

  bioDisponivel() {
    return !!(typeof window !== 'undefined' && window.PublicKeyCredential &&
      navigator.credentials && window.isSecureContext);
  },

  bioAtiva() { return !!(this.cfg.bioId && this.cfg.bioChave && this.cfg.bioSalt); },

  async bioSuportada() {
    if (!this.bioDisponivel()) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch (_) { return false; }
  },

  /* Ativa a digital. Exige o PIN antes: a digital é um ATALHO para a chave, e
     quem não prova ter a chave não pode criar um atalho para ela. */
  async ativarBio(pin) {
    if (!(await this.bioSuportada())) {
      throw new Error('Este aparelho não oferece leitor de digital ao navegador.');
    }
    const chave = await this.derivar(pin, this.cfg.salt, true);
    if (!(await this.conferir(chave))) throw new Error('PIN incorreto.');

    const prfSalt = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'CESTA' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: 'cesta', displayName: 'CESTA',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        extensions: { prf: { eval: { first: prfSalt } } },
        timeout: 60000,
      },
    });
    if (!cred) throw new Error('Não foi possível registrar a digital.');

    const ext = cred.getClientExtensionResults();
    if (!ext || !ext.prf || !ext.prf.enabled) {
      throw new Error('Este navegador ainda não permite usar a digital para proteger dados. Continue com o PIN.');
    }

    const segredo = await this.lerPrf(cred.rawId, prfSalt);
    const chaveEnvelope = await crypto.subtle.importKey('raw', segredo, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const bruta = await crypto.subtle.exportKey('raw', chave);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cifrada = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chaveEnvelope, bruta);

    this.cfg.bioId = this.b64(cred.rawId);
    this.cfg.bioSalt = this.b64(prfSalt);
    this.cfg.bioChave = { iv: this.b64(iv), ct: this.b64(cifrada) };
    this.save();
    return true;
  },

  async lerPrf(rawId, prfSalt) {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: rawId }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: prfSalt } } },
        timeout: 60000,
      },
    });
    const ext = assertion && assertion.getClientExtensionResults();
    if (!ext || !ext.prf || !ext.prf.results || !ext.prf.results.first) {
      throw new Error('O leitor não devolveu o segredo esperado.');
    }
    return ext.prf.results.first;
  },

  desativarBio() {
    delete this.cfg.bioId; delete this.cfg.bioChave; delete this.cfg.bioSalt;
    this.save();
  },

  /* Desbloqueia pela digital: devolve exatamente a mesma CryptoKey que o PIN
     produziria — a digital abre o cofre, não substitui a fechadura. */
  async abrirComBio() {
    const segredo = await this.lerPrf(this.unb64(this.cfg.bioId), this.unb64(this.cfg.bioSalt));
    const chaveEnvelope = await crypto.subtle.importKey('raw', segredo, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const bruta = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.unb64(this.cfg.bioChave.iv) }, chaveEnvelope, this.unb64(this.cfg.bioChave.ct));
    return crypto.subtle.importKey('raw', bruta, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  },

  /* ------------------------------------------------------------ boot --- */

  /* Chamado antes de qualquer tela. Decide entre: nada a fazer, abrir com a
     sessão viva, ou mostrar a tela de bloqueio. */
  async iniciar(aoLiberar) {
    this.load();
    if (!this.ligado()) { aoLiberar(); return; }

    const daSessao = await this.lerSessao();
    if (daSessao && await this.conferir(daSessao)) {
      this.chave = daSessao;
      DB.setChave(daSessao);
      aoLiberar();
      return;
    }
    Bloqueio.mostrar(aoLiberar);
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Auth };
