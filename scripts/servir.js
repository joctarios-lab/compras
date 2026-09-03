/* CESTA — servidor estático local, para testar sem instalar nada.

       node scripts/servir.js          (porta 8080)
       node scripts/servir.js 3000     (outra porta)

   Existe porque `npx serve` baixa um pacote a cada máquina nova, e este projeto
   tem por regra não depender de nada para rodar.

   localhost conta como CONTEXTO SEGURO nos navegadores: o service worker
   registra e a digital funciona, mesmo sem HTTPS. Em qualquer outro endereço
   (o IP da rede local, por exemplo) os dois ficam desligados — por isso o teste
   no celular pede uma URL https de verdade. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = Number(process.argv[2]) || 8080;
const RAIZ = path.join(__dirname, '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const servidor = http.createServer((req, res) => {
  let caminho = decodeURIComponent(String(req.url).split('?')[0]);
  if (caminho === '/') caminho = '/index.html';

  /* Não deixa sair da pasta do projeto: `../` numa URL leria arquivos do resto
     do computador, e este servidor às vezes fica aberto por horas. */
  const alvo = path.normalize(path.join(RAIZ, caminho));
  if (!alvo.startsWith(RAIZ)) { res.writeHead(403); res.end('fora do projeto'); return; }

  fs.readFile(alvo, (erro, dados) => {
    if (erro) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('não encontrado: ' + caminho); return; }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream',
      /* Sem cache no servidor de teste: o navegador já guarda o app inteiro no
         service worker, e um arquivo velho em cache faria você testar a versão
         de ontem sem perceber. */
      'Cache-Control': 'no-store',
    });
    res.end(dados);
  });
});

servidor.listen(PORTA, () => {
  console.log(`\n  CESTA rodando em  http://localhost:${PORTA}\n`);
  console.log('  Ctrl+C para parar.\n');
});
