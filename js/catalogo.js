/* CESTA — o catálogo semente: o que uma casa brasileira compra.

   POR QUE ISTO EXISTE. Um campo de texto em branco é a pior primeira tela
   possível: a pessoa não sabe o que digitar, não sabe se o app entende "arroz"
   ou "Arroz Tio João 5kg", e desiste antes de montar a primeira lista.

   Com o catálogo, o primeiro uso vira TOCAR, não digitar. E cada item já nasce
   com a unidade certa — o que faz o diagnóstico de preço funcionar direito
   desde a primeira compra, em vez de acumular meses de dados em unidade errada.

   A ORDEM DAS CATEGORIAS É A ORDEM DO MERCADO, não o alfabeto: hortifrúti na
   entrada, limpeza no fundo, frios perto do caixa. É assim que a lista deixa de
   fazer a pessoa andar em ziguezague — e é o ganho de tempo mais concreto que
   um app de lista pode dar. */
'use strict';

const CORREDORES = [
  { id: 'hortifruti', nome: 'Hortifrúti', icone: '🥬', ordem: 1 },
  { id: 'padaria',    nome: 'Padaria',    icone: '🥖', ordem: 2 },
  { id: 'acougue',    nome: 'Açougue e peixaria', icone: '🥩', ordem: 3 },
  { id: 'frios',      nome: 'Frios e laticínios', icone: '🧀', ordem: 4 },
  { id: 'mercearia',  nome: 'Mercearia',  icone: '🍚', ordem: 5 },
  { id: 'bebidas',    nome: 'Bebidas',    icone: '🧃', ordem: 6 },
  { id: 'congelados', nome: 'Congelados', icone: '🧊', ordem: 7 },
  { id: 'limpeza',    nome: 'Limpeza',    icone: '🧽', ordem: 8 },
  { id: 'higiene',    nome: 'Higiene',    icone: '🧴', ordem: 9 },
  { id: 'outros',     nome: 'Outros',     icone: '🛒', ordem: 10 },
];

/* [nome, corredor, unidade, quantidade habitual]

   A unidade é a que a etiqueta usa, não a que soa mais bonita: arroz se compra
   em pacote de 5 kg, leite em caixa de 1 L, ovos em dúzia. Errar isso aqui faz
   o app comparar R$/kg com R$/pacote lá na frente. */
const ITENS_COMUNS = [
  ['Arroz', 'mercearia', 'kg', 5],
  ['Feijão', 'mercearia', 'kg', 1],
  ['Açúcar', 'mercearia', 'kg', 1],
  ['Café', 'mercearia', 'g', 500],
  ['Óleo de soja', 'mercearia', 'ml', 900],
  ['Macarrão', 'mercearia', 'g', 500],
  ['Farinha de trigo', 'mercearia', 'kg', 1],
  ['Sal', 'mercearia', 'kg', 1],
  ['Molho de tomate', 'mercearia', 'g', 340],
  ['Biscoito', 'mercearia', 'g', 200],

  ['Leite', 'frios', 'l', 1],
  ['Manteiga', 'frios', 'g', 200],
  ['Queijo mussarela', 'frios', 'kg', 0.3],
  ['Presunto', 'frios', 'kg', 0.2],
  ['Iogurte', 'frios', 'un', 6],
  ['Ovos', 'frios', 'un', 12],
  ['Requeijão', 'frios', 'g', 200],

  ['Banana', 'hortifruti', 'kg', 1],
  ['Maçã', 'hortifruti', 'kg', 1],
  ['Tomate', 'hortifruti', 'kg', 1],
  ['Cebola', 'hortifruti', 'kg', 1],
  ['Batata', 'hortifruti', 'kg', 2],
  ['Alho', 'hortifruti', 'g', 200],
  ['Alface', 'hortifruti', 'un', 1],
  ['Cenoura', 'hortifruti', 'kg', 1],
  ['Limão', 'hortifruti', 'kg', 0.5],

  ['Pão francês', 'padaria', 'kg', 0.5],
  ['Pão de forma', 'padaria', 'un', 1],
  ['Bolo', 'padaria', 'un', 1],

  ['Frango', 'acougue', 'kg', 1],
  ['Carne moída', 'acougue', 'kg', 1],
  ['Bife', 'acougue', 'kg', 1],
  ['Linguiça', 'acougue', 'kg', 0.5],
  ['Peixe', 'acougue', 'kg', 0.5],

  ['Refrigerante', 'bebidas', 'l', 2],
  ['Suco', 'bebidas', 'l', 1],
  ['Água mineral', 'bebidas', 'l', 5],
  ['Cerveja', 'bebidas', 'un', 6],

  ['Detergente', 'limpeza', 'ml', 500],
  ['Sabão em pó', 'limpeza', 'kg', 1],
  ['Amaciante', 'limpeza', 'l', 2],
  ['Desinfetante', 'limpeza', 'l', 1],
  ['Papel toalha', 'limpeza', 'un', 2],
  ['Esponja', 'limpeza', 'un', 3],
  ['Água sanitária', 'limpeza', 'l', 1],
  ['Saco de lixo', 'limpeza', 'un', 30],

  ['Papel higiênico', 'higiene', 'un', 12],
  ['Sabonete', 'higiene', 'un', 4],
  ['Shampoo', 'higiene', 'ml', 350],
  ['Creme dental', 'higiene', 'g', 90],
  ['Desodorante', 'higiene', 'un', 1],

  ['Pizza congelada', 'congelados', 'un', 1],
  ['Sorvete', 'congelados', 'l', 2],
];

const Catalogo = {
  CORREDORES,
  ITENS_COMUNS,

  corredor(id) { return CORREDORES.find(c => c.id === id) || CORREDORES[CORREDORES.length - 1]; },

  /* Os itens mais comuns de cada corredor, para a tela de montagem rápida.
     Não é o catálogo inteiro de uma vez: cinquenta e tantos botões numa tela é
     o mesmo problema do campo em branco, com outra roupa. */
  sugestoesPorCorredor() {
    const mapa = {};
    for (const [nome, corredor, unidade, qtd] of ITENS_COMUNS) {
      (mapa[corredor] || (mapa[corredor] = [])).push({ nome, unidade, qtd });
    }
    return CORREDORES.filter(c => mapa[c.id]).map(c => ({ ...c, itens: mapa[c.id] }));
  },

  /* Descobre o corredor e a unidade de um nome digitado. É PALPITE, e por isso
     só preenche o formulário — a pessoa corrige antes de salvar. Um palpite
     silencioso na unidade envenenaria a mediana do produto para sempre. */
  palpitar(nome) {
    const limpo = String(nome || '').trim().toLowerCase();
    if (!limpo) return null;
    for (const [n, corredor, unidade, qtd] of ITENS_COMUNS) {
      if (n.toLowerCase() === limpo) return { corredor, unidade, qtd, exato: true };
    }
    // Sem casar o nome inteiro, tenta a primeira palavra ("leite integral" → "leite")
    const primeira = limpo.split(/\s+/)[0];
    for (const [n, corredor, unidade, qtd] of ITENS_COMUNS) {
      if (n.toLowerCase().split(/\s+/)[0] === primeira) return { corredor, unidade, qtd, exato: false };
    }
    return null;
  },

  /* Ordena os itens de uma lista pela ORDEM DO MERCADO. É o recurso que faz a
     pessoa parar de andar em ziguezague: tudo do hortifrúti junto, depois a
     padaria, e assim por diante até o fundo da loja. */
  ordemDoMercado(a, b) {
    const oa = this.corredor(a).ordem, ob = this.corredor(b).ordem;
    return oa - ob;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = { Catalogo, CORREDORES, ITENS_COMUNS };
