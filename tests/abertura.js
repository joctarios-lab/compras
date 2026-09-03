/* CESTA — o app ABRE? Num navegador de verdade, em cada estado possível.

   POR QUE ESTA SUÍTE EXISTE.

   As outras cinco carregam os módulos por `eval` isolado e conferem regras de
   negócio. Nenhuma delas conseguiria pegar a falha que mais machucou este
   projeto: a TELA BRANCA. Ela não é um módulo errado — é o que sobra quando o
   boot morre antes do primeiro pixel. Do lado de fora não há mensagem, não há
   ícone, não há nada; e as suítes seguem verdes, porque cada módulo, sozinho,
   está mesmo correto.

   O defeito real era este: os dados cifrados moram no `cesta.v1` e a
   configuração do PIN no `cesta.auth`. Dois fatos, duas chaves, nada garantindo
   que concordassem. Quando divergiam, o app concluía "não tem PIN", abria
   direto, e o primeiro acesso aos dados batia em `null.settings`. Como o boot é
   assíncrono, o erro virava uma promessa rejeitada — que nem o tratador de
   `error` do shell pegava. Morria calado.

   Então aqui se abre o app do jeito que a pessoa abre, e se pergunta a única
   coisa que importa antes de qualquer outra: apareceu alguma coisa na tela?

   Precisa do Chrome instalado. Sem ele, a suíte avisa e sai sem reprovar —
   nunca se deve fingir que verificou. */
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const BASE = path.join(__dirname, '..');

/* PORTA ZERO: o sistema escolhe uma livre.

   Com uma porta fixa, uma execução anterior que não encerrou limpo tranca a
   seguinte — e a suíte que deveria testar o app passa a testar se a porta está
   livre. O número certo aqui é nenhum número. */
const PORTA = 0;

const CAMINHOS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const CHROME = CAMINHOS.find(c => fs.existsSync(c));
if (!CHROME) {
  console.log('Chrome não encontrado — a suíte de abertura foi PULADA.');
  console.log('Ela é a única que pega tela branca: rode-a antes de publicar.');
  process.exit(0);
}

/* Um servidor mínimo: o app precisa de origem http para o localStorage e o
   service worker se comportarem como no aparelho. */
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const servidor = http.createServer((q, r) => {
  let f = path.join(BASE, decodeURIComponent(q.url.split('?')[0]));
  if (q.url === '/') f = path.join(BASE, 'index.html');
  try {
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain' });
    r.end(fs.readFileSync(f));
  } catch (_) { r.writeHead(404); r.end('404'); }
});

/* Cada cenário é um aparelho num estado que ACONTECE na vida real. */
const CENARIOS = [
  {
    nome: 'aparelho novo, nunca usado',
    oQue: 'mostra a apresentação',
    seed: '',
    esperado: /class="ob"/,
  },
  {
    nome: 'já configurado, sem PIN',
    oQue: 'desenha uma tela com conteúdo',
    seed: `localStorage.setItem('cesta.v1', JSON.stringify({
      settings:[{id:'s1',familia_nome:'Casa',categorias:['Mercearia'],
        updated_at:'2026-01-01T00:00:00.000Z',rev:1,dirty:false}],
      meta:{criado_em:'2026-01-01T00:00:00.000Z',lastSync:null}}));
    localStorage.setItem('cesta.nuvem','local');`,
    esperado: /id="tela"[^>]*>\s*\S/,
  },
  {
    nome: 'dados cifrados, PIN configurado',
    oQue: 'pede o PIN',
    seed: `localStorage.setItem('cesta.v1', JSON.stringify({cifrado:true,iv:'x',dados:'y'}));
    localStorage.setItem('cesta.auth', JSON.stringify({salt:'abc',iter:150000}));`,
    esperado: /pin-pad/,
  },
  {
    /* O ESTADO QUE DEIXAVA A TELA EM BRANCO. Os dados ficaram cifrados e a
       configuração do PIN se perdeu — uma limpeza parcial do site basta.
       Nenhum PIN abre nada aqui, porque o `salt` que deriva a chave foi
       embora: pedir um seria prender a pessoa tentando senhas impossíveis. */
    nome: 'dados cifrados e a chave sumiu',
    oQue: 'explica e oferece saída',
    esperado: /a chave que os abre não está mais aqui/,
    seed: `localStorage.setItem('cesta.v1', JSON.stringify({cifrado:true,iv:'x',dados:'y'}));`,
  },
];

const SEED = path.join(BASE, '_seed.html');
let falhas = 0;

/* SUÍTE QUE NÃO SOBE O SERVIDOR TEM DE REPROVAR, não passar calada.

   Na primeira execução a porta ficou presa por um processo anterior, o listen
   estourou, e o processo terminou com código 0 — "nenhuma falha", porque
   nenhum teste rodou. Zero teste executado nunca é sucesso. */
servidor.on('error', e => {
  console.log('\nO SERVIDOR DE TESTE NÃO SUBIU: ' + e.code + ' na porta ' + PORTA);
  if (e.code === 'EADDRINUSE') {
    console.log('Uma execução anterior deixou a porta presa. Encerre o node que');
    console.log('a ocupa e rode de novo — nenhum cenário foi verificado.');
  }
  process.exit(1);
});

/* O CHROME RODA DE FORMA ASSÍNCRONA, e isto não é preferência de estilo.

   O servidor de teste vive NESTE processo. Um `execFileSync` bloqueia o event
   loop até o Chrome terminar — e o Chrome está esperando a resposta de um
   servidor que não pode responder, porque quem responderia está bloqueado
   esperando o Chrome. Impasse perfeito: os quatro cenários "reprovavam" por
   tempo esgotado, sem nunca ter carregado uma página.

   Foi a falha mais difícil de ver aqui, porque o sintoma — DOM vazio — é
   idêntico ao da tela branca que a suíte existe para pegar. */
function abrirNoChrome(url, perfil) {
  return new Promise(resolve => {
    const filho = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-networking', '--disable-sync', '--disable-component-update',
      '--virtual-time-budget=8000', '--dump-dom', '--user-data-dir=' + perfil, url]);

    let dom = '';
    filho.stdout.on('data', d => { dom += d; });
    /* O stderr do Chrome é ruído (GCM, TensorFlow, telemetria): descartado de
       propósito, para o relatório da suíte continuar legível. */
    filho.stderr.on('data', () => {});

    /* Rede de segurança: um Chrome que não devolve nada reprova o cenário, em
       vez de pendurar a suíte inteira. */
    const relogio = setTimeout(() => { try { filho.kill(); } catch (_) {} }, 60000);
    filho.on('close', () => { clearTimeout(relogio); resolve(dom); });
    filho.on('error', () => { clearTimeout(relogio); resolve(''); });
  });
}

servidor.listen(PORTA, async () => {
  /* A porta real, escolhida pelo sistema. */
  const porta = servidor.address().port;

  for (let i = 0; i < CENARIOS.length; i++) {
    const c = CENARIOS[i];

    /* O SEED LIMPA ANTES DE SEMEAR.

       É isto que permite reaproveitar o perfil do Chrome entre execuções — e
       reaproveitar importa: com perfil novo, o Chrome tenta registro de push e
       atualização de componentes antes de desenhar, o que é lento. */
    fs.writeFileSync(SEED,
      '<!doctype html><meta charset="utf-8"><script>\n'
      + 'try { localStorage.clear(); } catch (_) {}\n'
      + c.seed
      + "\nlocation.replace('index.html');\n</" + 'script>');

    /* UM PERFIL POR CENÁRIO, persistente, na pasta temporária do sistema.

       Persistente porque perfil frio é lento. Separado porque o Chrome TRANCA o
       diretório do perfil: compartilhar um só deixa o processo seguinte
       esperando pelo bloqueio. E fora do repositório porque um perfil do Chrome
       criado ali faz o antivírus varrer a árvore do projeto a cada cenário. */
    const perfil = path.join(os.tmpdir(), 'cesta-teste-chrome-' + i);
    const dom = await abrirNoChrome('http://localhost:' + porta + '/_seed.html', perfil);

    const ok = c.esperado.test(dom);
    /* Três desfechos, não dois. "Reprovou" não diz o suficiente:
         - DOM vazio  => o navegador não devolveu nada (problema do teste)
         - TELA BRANCA => o app carregou e não desenhou (o defeito de verdade)
         - abriu outra tela => o app desenhou, mas não o que se esperava
       Confundi-los custou horas: o sintoma do impasse do event loop era
       idêntico ao da tela branca. */
    let nota = '';
    if (!dom.length) nota = '   <<< o Chrome não devolveu DOM (problema do TESTE, não do app)';
    else if (!/class="lock-card"/.test(dom) && /id="tela"[^>]*>\s*<\/div>/.test(dom)) {
      nota = '   <<< TELA BRANCA';
    }
    if (!ok) falhas++;
    console.log((ok ? '   OK   | ' : ' FALHOU | ') + c.nome + ' — ' + c.oQue + nota);
  }

  fs.rmSync(SEED, { force: true });
  servidor.close();
  console.log(falhas
    ? '\n' + falhas + ' de ' + CENARIOS.length + ' FALHARAM'
    : '\n' + CENARIOS.length + ' cenários de abertura, todos desenham algo');
  process.exit(falhas ? 1 : 0);
});
