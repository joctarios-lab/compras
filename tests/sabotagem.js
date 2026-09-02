/* CESTA — a prova de que os testes pegam regressao.

   TESTE QUE NAO PEGA REGRESSAO NAO VALE. Este arquivo quebra o codigo de
   proposito, um caso por vez, roda a suite e confere que ela reprova NO TESTE
   ESPERADO — nao basta reprovar em qualquer lugar.

       node tests/sabotagem.js

   Rode depois de mexer em qualquer regra, e sobretudo antes de entregar.

   COMO LER O RESULTADO:
     OK      a sabotagem foi pega pelo teste certo
     PARCIAL reprovou, mas noutro teste — a cobertura esta no lugar errado
     PASSOU  NINGUEM PEGOU: investigue. Quase sempre e TESTE VAZIO — o teste
             existe, roda, e nao exercita a regra que diz proteger. Foi o que
             aconteceu com cinco casos na primeira rodada das fases F1-F9, e
             com o esc() na F0.
     ERRO    o trecho nao existe mais: a sabotagem envelheceu com o codigo e
             precisa ser reescrita (nao e defeito do app).

   O codigo e SEMPRE restaurado num finally, e a restauracao e conferida
   relendo o arquivo — no app de financas um script interrompido no meio deixou
   a sabotagem aplicada no codigo. */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..') + path.sep;

const rodar = () => {
  try { execSync('node tests/smoke.js', { cwd: RAIZ, encoding: 'utf8' }); return ''; }
  catch (e) { return String(e.stdout || '') + String(e.stderr || ''); }
};

// [nome, arquivo, trecho, troca, texto do teste que TEM de reprovar]
const casos = [
  ['apagar de verdade em vez de marcar apagado', 'js/db.js',
   `    r.deleted = true;`,
   `    this.data[store] = this.data[store].filter(x => x.id !== id);`,
   'marcado como apagado'],

  ['gravar sem marcar pendente de envio', 'js/db.js',
   `const novo = { id: obj.id || this.uid(), ...obj, updated_at: agora, deleted: false, dirty: true };`,
   `const novo = { id: obj.id || this.uid(), ...obj, updated_at: agora, deleted: false, dirty: false };`,
   'marcado como pendente de envio'],

  ['store nova numa base antiga fica undefined', 'js/db.js',
   `    for (const s of STORES) if (!this.data[s]) this.data[s] = [];
    return this.data;`,
   `    return this.data;`,
   'store ausente numa base antiga vira lista vazia'],

  ['preco com uma casa decimal', 'js/ui.js',
   `return 'R$ ' + n.toFixed(2).replace('.', ',')`,
   `return 'R$ ' + n.toFixed(1).replace('.', ',')`,
   'formata com duas casas'],

  ['valor pequeno perde a terceira casa', 'js/ui.js',
   `const casas = n < 1 ? 3 : 2;`,
   `const casas = 2;`,
   'valor pequeno ganha a terceira casa'],

  ['a mascara deixa entrar letra', 'js/ui.js',
   `const digitos = String(el.value).replace(/\\D/g, '').slice(0, 9);`,
   `const digitos = String(el.value).slice(0, 9);`,
   'letra nao entra'],

  ['esc() usando replace, que corrompe o R$', 'js/ui.js',
   `      .split('&').join('&amp;')`,
   `      .replace('&', '&amp;')`,
   'escapa html'],

  ['um token de cor so existe no tema claro', 'css/styles.css',
   `  --slate: #9AA4BC;
  --slate-ink: #9AA4BC;`,
   `  --slate: #9AA4BC;`,
   '--slate-ink definido no escuro'],

  ['o cinza do primeiro registro vira a cor do "na media"', 'css/styles.css',
   `  --slate: #9AA4BC;`,
   `  --slate: #E3B15C;`,
   'nao e a mesma cor do "na media"'],

  ['a folha deixa de se apoiar acima do teclado', 'css/styles.css',
   `  margin-bottom: var(--teclado);`,
   `  margin-bottom: 0;`,
   'a folha se apoia acima dele'],

  ['o alvo do mercado encolhe para o tamanho do app', 'css/styles.css',
   `  --toque-mercado: 56px;`,
   `  --toque-mercado: 48px;`,
   'o do mercado e maior ainda'],

  ['volta o gradiente decorativo', 'css/styles.css',
   `.card {
  background: var(--ink-2);`,
   `.card {
  background: linear-gradient(180deg, #161C2B, #1F2634);`,
   'nenhum gradiente'],

  ['a versao do sw anda sozinha, sem as tags do index', 'sw.js',
   `const VERSAO = '2';`,
   `const VERSAO = '9';`,
   'TODAS batem com a versao do sw.js'],

  ['o shell lista um arquivo que nao existe', 'sw.js',
   `  'icons/icon.svg',`,
   `  'icons/icon.svg',\n  'js/nao-existe.js',`,
   'e ele existe'],

  ['um script do index fica fora do cache offline', 'sw.js',
   `  'js/ui.js?v=' + VERSAO,`,
   ``,
   'js/ui.js esta no cache do shell'],

  ['um icone citado no shell deixa de existir', 'js/icons.js',
   `  historico: '<path d="M3 3v18h18"/>`,
   `  historico_: '<path d="M3 3v18h18"/>`,
   'icone "historico" existe'],

  // ---------------- o motor de preços ----------------
  ['a mediana vira media', 'js/precos.js',
   `    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;`,
   `    return v.reduce((a, b) => a + b, 0) / v.length;`,
   'a promocao nao arrasta a mediana'],

  ['grama deixa de virar quilo', 'js/precos.js',
   `    g:  { base: 'kg', fator: 0.001 },`,
   `    g:  { base: 'g', fator: 1 },`,
   'grama vira quilo'],

  ['a conversao de unidade some', 'js/precos.js',
   `    return { qtd: n * def.fator, unidade: def.base };`,
   `    return { qtd: n, unidade: def.base };`,
   '500 g por 4,50 sai a 9,00/kg'],

  ['unidade desconhecida vira "un" por omissao', 'js/precos.js',
   `    const sin = this.SINONIMOS[chave];
    return sin || (this.UNIDADES[chave] ? chave : null);`,
   `    const sin = this.SINONIMOS[chave];
    return sin || (this.UNIDADES[chave] ? chave : 'un');`,
   'unidade que nao conheco devolve nulo'],

  ['sem historico o selo vira "na media"', 'js/precos.js',
   `      return {
        selo: 'slate', rotulo: 'Primeiro registro', delta: null, n: 0, base: false,`,
   `      return {
        selo: 'amber', rotulo: 'Na média', delta: null, n: 0, base: false,`,
   'sem historico o selo e cinza'],

  ['o sinal do delta inverte', 'js/precos.js',
   `    const delta = (precoBase - ref.mediana) / ref.mediana;`,
   `    const delta = (ref.mediana - precoBase) / ref.mediana;`,
   'preco bem acima e vermelho'],

  ['a janela de 6 meses vira o historico inteiro', 'js/precos.js',
   `  JANELA_MESES: 6,`,
   `  JANELA_MESES: 999,`,
   'observacao de mais de um ano fica fora da janela'],

  ['a cascata deixa de dizer qual escopo usou', 'js/precos.js',
   `        escopo,
      };`,
   `        escopo: 'produto',
      };`,
   'sem o produto exato, compara pelo item'],

  ['a cesta comparavel aceita produto de um mes so', 'js/precos.js',
   `      if (!a) continue;                       // não está nos dois: fica de fora`,
   `      const a2 = a || base[pid]; if (!a2) continue;`,
   'so os produtos dos DOIS meses entram'],

  ['o ranking aceita uma observacao por mes', 'js/precos.js',
   `      if (!b[pid] || a[pid].length < minObs || b[pid].length < minObs) continue;`,
   `      if (!b[pid]) continue;`,
   'com uma observacao por mes, nada e ranqueado'],

  ['o encolhimento passa a acusar embalagem maior', 'js/precos.js',
   `    if (!anterior || anterior.qtd_canonica <= atual.qtd_canonica) return null;`,
   `    if (!anterior) return null;`,
   'embalagem maior nao vira aviso de encolhimento'],

  ['o Mais por Menos compara peso com volume', 'js/precos.js',
   `    if (pa.unidade !== pb.unidade) return { erro: 'unidades diferentes' };`,
   ``,
   'peso com volume recusa a comparacao'],

  ['registrar aceita unidade que nao sabe converter', 'js/precos.js',
   `    if (!pb) return null;   // unidade desconhecida fica de fora, não vira 'un'`,
   `    if (!pb) { qtd = 1; unidade = 'un'; }`,
   'linha com unidade desconhecida'],

  // ---------------- NFC-e e importação ----------------
  ['"SEM GTIN" passa a valer como EAN', 'js/nfce.js',
   `        ean: ean && /^\\d{8,14}$/.test(ean) ? ean : null,`,
   `        ean: ean || null,`,
   '"SEM GTIN" NAO vira um EAN'],

  ['a nota importada usa a data de hoje', 'js/importar.js',
   `    const data = nota.data || DB.hojeISO();`,
   `    const data = DB.hojeISO();`,
   'com a data da NOTA, nao a de hoje'],

  ['reimportar a mesma nota passa a duplicar', 'js/importar.js',
   `    if (this.jaImportada(nota.chave)) {
      return { erro: 'ja_importada', chave: nota.chave };
    }`,
   ``,
   'reimportar a mesma nota e recusado'],

  ['o casamento por texto passa a aplicar sozinho', 'js/importar.js',
   `    if (item) return { item_id: item.id, product_id: null, confianca: 'nome', auto: false };`,
   `    if (item) return { item_id: item.id, product_id: null, confianca: 'nome', auto: true };`,
   'produto novo entra DESMARCADO'],

  ['o casamento passa a aceitar pedaco do nome', 'js/importar.js',
   `    const item = DB.all('items').find(i => this.normalizar(i.nome) === chave);`,
   `    const item = DB.all('items').find(i => chave.includes(this.normalizar(i.nome)));`,
   'nao casa com o item'],

  ['o vinculo deixa de ser aprendido', 'js/importar.js',
   `        if (!ja) DB.upsert('aliases', { store_id, texto_pdv: chave, product_id });`,
   ``,
   'o texto ja visto volta reconhecido'],

  // ---------------- lista e carrinho ----------------
  ['o item duplica quando muda a caixa da letra', 'js/db.js',
   `    const achado = this.all('items').find(i => String(i.nome).toLowerCase() === limpo.toLowerCase());`,
   `    const achado = this.all('items').find(i => String(i.nome) === limpo);`,
   'o mesmo nome em outra caixa nao cria item novo'],

  ['o estimado se mistura com o que ja tem preco', 'js/db.js',
   `      if (isFinite(e) && e > 0) { estimado += e; aEstimar++; }`,
   `      if (isFinite(e) && e > 0) { firme += e; aEstimar++; }`,
   'o que falta fica estimado a parte'],

  ['item indisponivel volta a contar no carrinho', 'js/db.js',
   `      if (li.nao_tinha) continue;`,
   ``,
   'item indisponivel sai da estimativa'],

  ['a busca deixa de ordenar por frequencia', 'js/db.js',
   `      .sort((a, b) => (usos[b.id] || 0) - (usos[a.id] || 0) || String(a.nome).localeCompare(b.nome))`,
   `      .sort((a, b) => String(a.nome).localeCompare(b.nome))`,
   'o mais comprado vem primeiro na busca'],

  // ---------------- sync ----------------
  ['o controle local vaza para o banco', 'js/sync.js',
   `    for (const c of SYNC_TABELAS[tabela]) if (r[c] !== undefined) linha[c] = r[c];`,
   `    Object.assign(linha, r);`,
   'o controle local NAO e enviado'],

  ['uma tabela some da sincronizacao', 'js/sync.js',
   `  aliases:    ['store_id', 'texto_pdv', 'product_id'],`,
   ``,
   'aliases esta declarada para sincronizar'],

  ['o pull passa a usar o relogio do cliente', 'js/sync.js',
   `      const filtro = desde ? \`&server_at=gt.\${encodeURIComponent(desde)}\` : '';`,
   `      const filtro = desde ? \`&updated_at=gt.\${encodeURIComponent(desde)}\` : '';`,
   'o schema cria o carimbo do servidor'],

  ['o schema perde uma coluna que o app envia', 'supabase/schema.sql',
   `  preco_base numeric,`,
   ``,
   'o schema tem todas as colunas enviadas'],

  ['o schema perde o RLS', 'supabase/schema.sql',
   `                    for all using (user_id = auth.uid()) with check (user_id = auth.uid())',`,
   `                    for all using (true) with check (true)',`,
   'RLS por dono'],

  // ---------------- shell ----------------
  ['um modulo fica fora do cache offline', 'sw.js',
   `  'js/precos.js?v=' + VERSAO,`,
   ``,
   'js/precos.js esta no cache offline'],
];

const original = {};
let pegas = 0;
const passaram = [], parciais = [], obsoletos = [];

try {
  if (rodar()) {
    console.log('A suite JA ESTA VERMELHA. Corrija antes de sabotar — senao nada aqui significa nada.');
    process.exit(1);
  }
  console.log('Suite verde. Comecando.\n');

  for (const caso of casos) {
    /* Um buraco no array (uma virgula a mais) fazia o destructuring lançar, e o
       process.exit do finally ENGOLIA o erro: o script dizia "16/46 pegas" e
       ninguem via que 30 casos nunca rodaram. O mesmo modo de falhar que a
       suite ja teve. Agora um caso malformado se denuncia. */
    if (!Array.isArray(caso) || caso.length !== 5) {
      console.log(' ERRO   | caso malformado no indice ' + casos.indexOf(caso));
      obsoletos.push('caso malformado');
      continue;
    }
    const [nome, arq, de, para, esperado] = caso;
    const caminho = RAIZ + arq;
    if (original[caminho] === undefined) original[caminho] = fs.readFileSync(caminho, 'utf8');
    const src = original[caminho];

    if (!src.includes(de)) {
      obsoletos.push(nome);
      console.log(` ERRO   | ${nome}`);
      continue;
    }
    // split/join, nunca replace: '$' na string de substituicao e padrao especial
    fs.writeFileSync(caminho, src.split(de).join(para));

    const saida = rodar();
    const reprovou = saida.includes('FALHA') || saida.includes('Error');
    const citou = saida.includes(esperado);
    if (reprovou && citou) { pegas++; console.log(`  OK    | ${nome}`); }
    else if (reprovou) { parciais.push(nome); console.log(` PARCIAL| ${nome}`); }
    else { passaram.push(nome); console.log(` PASSOU | ${nome}   <<< NINGUEM PEGOU`); }

    fs.writeFileSync(caminho, src);
  }
} finally {
  for (const [caminho, src] of Object.entries(original)) {
    fs.writeFileSync(caminho, src);
    if (fs.readFileSync(caminho, 'utf8') !== src) console.log('!!! FALHA AO RESTAURAR ' + caminho);
  }
  console.log(`\n${pegas}/${casos.length} sabotagens foram pegas.`);
  if (passaram.length) console.log('INVESTIGAR (provavel teste vazio):\n  - ' + passaram.join('\n  - '));
  if (parciais.length) console.log('COBERTURA NO LUGAR ERRADO:\n  - ' + parciais.join('\n  - '));
  if (obsoletos.length) console.log('SABOTAGENS A REESCREVER (o codigo andou):\n  - ' + obsoletos.join('\n  - '));
  console.log(rodar() ? 'ATENCAO: a suite NAO esta verde apos restaurar' : 'suite verde apos restaurar');
  process.exit(passaram.length || parciais.length ? 1 : 0);
}
