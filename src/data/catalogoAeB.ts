export type CategoriaAeB =
  | 'Águas'
  | 'Cafés/Chás/Achocolatados'
  | 'Cervejas'
  | 'Diversos e Guloseimas'
  | 'Refrigerantes'
  | 'Sucos';

export interface ProdutoAeB {
  id: string;
  nome: string;
  preco: number;
  categoria: CategoriaAeB;
}

/**
 * Catálogo Oficial do Sistema Volux para o módulo de Alimentos e Bebidas (AeB)
 * Contém todos os produtos e seus respectivos preços padrão.
 */
export const CATALOGO_AEB_PRODUTOS: ProdutoAeB[] = [
  // Águas
  {
    id: 'agua-sgas-350',
    nome: 'Agua Mineral S/Gas Lata 350ml',
    preco: 9.90,
    categoria: 'Águas',
  },
  {
    id: 'agua-cgas-350',
    nome: 'Agua Mineral C/Gas Lata 350ml',
    preco: 9.90,
    categoria: 'Águas',
  },
  {
    id: 'agua-sgas-269',
    nome: 'Agua Mineral S/Gas Lata 269ml',
    preco: 9.00,
    categoria: 'Águas',
  },
  {
    id: 'agua-cgas-269',
    nome: 'Agua Mineral C/Gas Lata 269ml',
    preco: 9.00,
    categoria: 'Águas',
  },

  // Cafés/Chás/Achocolatados
  {
    id: 'cafe-expresso',
    nome: 'Café Expresso',
    preco: 8.00,
    categoria: 'Cafés/Chás/Achocolatados',
  },

  // Cervejas
  {
    id: 'cerveja-amstel-sem-gluten',
    nome: 'Cerveja Amstel Sem Gluten',
    preco: 14.90,
    categoria: 'Cervejas',
  },
  {
    id: 'cerveja-heineken-lata',
    nome: 'Cerveja Heineken Lata',
    preco: 15.90,
    categoria: 'Cervejas',
  },
  {
    id: 'cerveja-heineken-ln',
    nome: 'Cerveja Heineken Long Neck',
    preco: 17.90,
    categoria: 'Cervejas',
  },
  {
    id: 'cerveja-amstel-350',
    nome: 'Cerveja Amstel 350Ml',
    preco: 13.00,
    categoria: 'Cervejas',
  },
  {
    id: 'cerveja-eisenbahn-p-lata-350',
    nome: 'Cerveja Eisenbahn P Lata 350Ml',
    preco: 14.00,
    categoria: 'Cervejas',
  },
  {
    id: 'cerveja-heineken-zero-350',
    nome: 'Cerveja Heineken Zero 350ml',
    preco: 15.90,
    categoria: 'Cervejas',
  },

  // Diversos e Guloseimas
  {
    id: 'kit-kat',
    nome: 'Chocolate Kit Kat',
    preco: 8.50,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'trident',
    nome: 'Chicletes Trident',
    preco: 4.50,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'doritos',
    nome: 'Salgadinho Doritos',
    preco: 10.90,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'amendoim-japones-45',
    nome: 'Amendoim Japones 45 Gr',
    preco: 8.90,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'cheetos-lua-33',
    nome: 'Salgadinho Cheetos Lua 33g',
    preco: 10.90,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'cebolitos-33',
    nome: 'Salgadinho Cebolitos 33Gr',
    preco: 10.90,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'baconzitos-31',
    nome: 'Salgadinho Baconzitos 31Gr',
    preco: 10.90,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'ovinhos-amendoim-65',
    nome: 'Ovinhos De Amendoim 65G',
    preco: 10.90,
    categoria: 'Diversos e Guloseimas',
  },
  {
    id: 'balas-fini',
    nome: 'Balas Fini',
    preco: 3.00,
    categoria: 'Diversos e Guloseimas',
  },

  // Refrigerantes
  {
    id: 'red-bull',
    nome: 'Energetico Red Bull',
    preco: 19.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'coca-cola-350',
    nome: 'Coca Cola Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'coca-zero-350',
    nome: 'Coca Cola Zero Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'schweppes-citrus-350',
    nome: 'Schweppes Citrus Lata 350Ml',
    preco: 12.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'fanta-laranja-350',
    nome: 'Fanta Laranja Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'guarana-antartica-350',
    nome: 'Guarana Antartica Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'sprite-350',
    nome: 'Sprite Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'sprite-zero-350',
    nome: 'Sprite Zero Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'guarana-zero-350',
    nome: 'Guarana Zero Lata 350Ml',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'tonica-350',
    nome: 'Tonica Lata 350 ML',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },
  {
    id: 'tonica-zero',
    nome: 'Tonica Zero',
    preco: 11.90,
    categoria: 'Refrigerantes',
  },

  // Sucos
  {
    id: 'del-valle-uva-290',
    nome: 'Suco Del Valle Lata Uva 290Ml',
    preco: 14.00,
    categoria: 'Sucos',
  },
];

/**
 * Busca item no catálogo por nome (insensível a maiúsculas e acentos)
 */
export function buscarProdutoNoCatalogo(termo: string): ProdutoAeB | undefined {
  if (!termo || !termo.trim()) return undefined;
  const normalizado = termo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return CATALOGO_AEB_PRODUTOS.find((p) => {
    const nomeNorm = p.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    return nomeNorm === normalizado;
  });
}
