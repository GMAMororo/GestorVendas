import * as pdfjsLib from 'pdfjs-dist';
import { VendaComanda, TipoVenda, VendaAeB } from '../types/venda';
import { CATALOGO_AEB_PRODUTOS, buscarProdutoNoCatalogo } from '../data/catalogoAeB';

export { CATALOGO_AEB_PRODUTOS, buscarProdutoNoCatalogo };

// Configure pdf.js worker using unpkg / cdnjs fallback
try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Erro ao configurar worker do pdfjs-dist:', e);
}

/**
 * Gera identificador absolutamente único (UUID) para vendas manuais.
 */
export function generateUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // continua para fallback seguro
    }
  }
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).substring(2, 10) +
    '-' +
    Math.random().toString(36).substring(2, 6)
  );
}

/**
 * Normaliza e formata o nome do item para compor o ID determinístico do PDF.
 * Remove acentos, pontuações e espaços, gerando Camel/PascalCase conforme especificação.
 * Exemplo: "Uma Hora de Boliche" -> "UmaHoraDeBoliche"
 */
export function formatItemForDeterministicId(item: string): string {
  if (!item || !item.trim()) return 'Item';
  return item
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9]/g, '') // remove espaços e caracteres especiais
    .trim();
}

/**
 * Normaliza qualquer ID para um ID limpo ([a-zA-Z0-9_-]).
 */
export function toFirestoreDocId(rawId: string): string {
  if (!rawId || !rawId.trim()) return generateUniqueId();
  const sanitized = rawId
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return sanitized || generateUniqueId();
}

/**
 * Monta a string base do ID determinístico do PDF:
 * pdf_${comanda}_${data}_${hora}_${nomeDoItem}
 */
export function generateBaseDeterministicPdfId(
  comanda: string,
  data: string,
  hora: string,
  item: string
): string {
  const cleanComanda = (comanda || '00-000-000').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const cleanData = (data || '00-00').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const cleanHora = (hora || '00-00').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const cleanItem = formatItemForDeterministicId(item);

  return toFirestoreDocId(`pdf_${cleanComanda}_${cleanData}_${cleanHora}_${cleanItem}`);
}

/**
 * Gera ID determinístico baseado estritamente nos dados da linha extraída do PDF e no contador de ocorrências.
 * Formato padrão: ${baseId}_${occurrenceIndex}
 * Exemplo: pdf_13-536-039_05-10-2026_15-03_UmaHoraDeBoliche_1
 */
export function generateDeterministicPdfId(
  comanda: string,
  data: string,
  hora: string,
  item: string,
  occurrenceIndex: number = 1
): string {
  const baseId = generateBaseDeterministicPdfId(comanda, data, hora, item);
  return toFirestoreDocId(`${baseId}_${occurrenceIndex}`);
}

/**
 * Remove a coluna "ADM" ("/ N", "/ S", "S" ou "N") e códigos técnicos do final da linha do relatório Volux.
 * No Volux, "S" ou "N" (ou "/ N", "/ S") no final da linha indica apenas se a conta é ADM e NÃO indica cancelamento.
 */
export function stripTrailingAdmFlag(line: string): string {
  if (!line) return '';
  return line
    .replace(/(?:\s+|\s*[/|]\s*)[SNsn](?:\s*[/|]\s*)?$/, '')
    .trim();
}

/**
 * Normaliza números de comanda pontuados que possam ter recebido espaço no PDF (ex: "13. 536. 039" -> "13.536.039")
 */
export function normalizeSpacedDottedComanda(line: string): string {
  if (!line) return '';
  return line
    .replace(/\b(\d{1,3})\s*\.\s*(\d{3})\s*\.\s*(\d{3})\b/g, '$1.$2.$3')
    .replace(/\b(\d{1,3})\s*\.\s*(\d{3})\b(?!\s*,\d{2})/g, '$1.$2');
}

/**
 * Verifica apenas se a linha contém a palavra explícita "CANCELADO" / "CANCELADA"
 * (para compatibilidade com textos manuais).
 * IMPORTANTE: NUNCA utiliza "S" ou "N" do final da linha (coluna ADM) nem múltiplas datas.
 */
export function isLinhaCanceladaVolux(line: string): boolean {
  if (!line || !line.trim()) return false;
  return /\b(?:CANCELADO|CANCELADA)\b/i.test(line);
}

export function isLinhaVoucherVolux(line: string): boolean {
  if (!line || !line.trim()) return false;
  return /\b(?:voucher|vale[- ]?brinde)\b/i.test(line);
}

export function isValidVoluxReportHeader(text: string): boolean {
  if (!text || !text.trim()) return false;
  return /comandas\s*x\s*itens|comandas\s+lan[cç]adas|comandas\s+canceladas|sistema\s+volux|relat[oó]rio|resumo\s+do\s+per[ií]odo|pdv/i.test(
    text
  );
}

/**
 * Extrai a Conta ADM ("3000" ou "3030") da linha do relatório PDF do Volux
 * (seja como Espaço/Quarto 3000 ou 3030, ou Comanda 3000 ou 3030, onde ADM = S).
 */
export function extractContaAdmFromLine(
  rawLine: string,
  comandaCode?: string | null
): '3000' | '3030' | null {
  if (comandaCode) {
    const cmdTrim = comandaCode.trim();
    if (cmdTrim === '3000' || cmdTrim === '3030') {
      return cmdTrim;
    }
  }
  if (!rawLine) return null;
  const withoutOsAndMoney = rawLine
    .replace(/\bOS\s*[-:]?\s*\d+\b/gi, ' ')
    .replace(MONEY_GLOBAL_REGEX, ' ')
    .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ');
  if (/\b3030\b/.test(withoutOsAndMoney)) return '3030';
  if (/\b3000\b/.test(withoutOsAndMoney)) return '3000';
  return null;
}

/**
 * Identifica se a linha do relatório PDF pertence às Contas ADM 3000 ou 3030 (ADM = S).
 */
export function isLinhaConta3000(rawLine: string, comandaCode?: string | null): boolean {
  return extractContaAdmFromLine(rawLine, comandaCode) !== null;
}

/**
 * Catálogo Oficial de Itens Volux e Preços de Referência com os nomes comerciais limpos exatos:
 * - "Meia Hora de Boliche"
 * - "Uma Hora de Boliche"
 * - "Ficha de Jogos Eletronicos"
 * - "Mini Combo Fichas"
 * - "Big Combo Fichas"
 * - "Mega Combo Fichas"
 */
export const CATALOGO_VOLUX = {
  boliche: [
    {
      nome: 'Meia Hora de Boliche',
      precoReferencia: 70.0,
      tipo: 'Boliche' as TipoVenda,
      sinonimos: [
        'meia hora de boliche',
        'meia hora boliche',
        '1/2 hora de boliche',
        '1/2 hora boliche',
        '30 min de boliche',
        '30 min boliche',
        '30 minutos de boliche',
        '30 minutos boliche',
        'boliche 30 min',
        'boliche meia hora',
      ],
    },
    {
      nome: 'Uma Hora de Boliche',
      precoReferencia: 120.0,
      tipo: 'Boliche' as TipoVenda,
      sinonimos: [
        'uma hora de boliche',
        'uma hora boliche',
        '1 hora de boliche',
        '1 hora boliche',
        '1h de boliche',
        '1h boliche',
        '60 min de boliche',
        '60 min boliche',
        '60 minutos de boliche',
        '60 minutos boliche',
        'boliche 1 hora',
        'boliche uma hora',
      ],
    },
  ],
  fichas: [
    {
      nome: 'Ficha de Jogos Eletronicos',
      precoReferencia: 12.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '1 Ficha Prata + 0 Dourada / R$ 12,00',
      sinonimos: [
        'ficha de jogos eletronicos',
        'fichas de jogos eletronicos',
        'ficha jogos eletronicos',
        'fichas jogos eletronicos',
        'fichas eletronicas',
        'ficha eletronica',
        'fichas eletrônicas',
        'ficha eletrônica',
        'ficha individual',
        'fichas individuais',
      ],
    },
    {
      nome: 'Mini Combo Fichas',
      precoReferencia: 65.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '5 Fichas Pratas + 1 Dourada / R$ 65,00',
      sinonimos: [
        'mini combo fichas',
        'mini combo de fichas',
        'mini combo',
        'mini-combo',
        'mini combo 5 fichas',
        'combo mini',
      ],
    },
    {
      nome: 'Big Combo Fichas',
      precoReferencia: 120.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '10 Fichas Pratas + 2 Douradas / R$ 120,00',
      sinonimos: [
        'big combo fichas',
        'big combo de fichas',
        'big combo',
        'big-combo',
        'big combo 10 fichas',
        'combo big',
      ],
    },
    {
      nome: 'Mega Combo Fichas',
      precoReferencia: 250.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '20 Fichas Pratas + 5 Douradas / R$ 250,00',
      sinonimos: [
        'mega combo fichas',
        'mega combo de fichas',
        'mega combo',
        'mega-combo',
        'mega combo 20 fichas',
        'combo mega',
      ],
    },
  ],
};

/**
 * Remove diacritics and normalize spaces
 */
export function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpa códigos operacionais do Volux (ex: "OS2213", "boliche26", "ivolux6", "/ N", "/ S")
 * deixando APENAS o nome comercial limpo do produto.
 */
export function cleanCommercialItemName(rawItem: string): string {
  if (!rawItem) return '';
  let cleaned = stripTrailingAdmFlag(rawItem);

  // Remove códigos de OS (ex: OS2213, OS 2213, OS-2213), logins de terminal/operador (ex: boliche26, ivolux6, volux1) e flags "/ N" ou "/ S"
  cleaned = cleaned
    .replace(/\bOS\s*[-:]?\s*\d+\b/gi, ' ')
    .replace(/\b(?:boliche\d+|ivolux\d*|volux\d*|pdv\d*|terminal\d*|caixa\d*)\b/gi, ' ')
    .replace(/\b(?:voucher|vale[- ]?brinde)\b/gi, ' ')
    .replace(/\b(?:3000|3030)\b/g, ' ')
    .replace(/(?:^|\s)\/\s*[NSns]\b/g, ' ')
    .replace(/(?:^|\s)[/|]\s*[NSns]\s*$/g, ' ')
    .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ')
    .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/^[\s\-|:/.,]+|[\s\-|:/.,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return stripTrailingAdmFlag(cleaned);
}

/**
 * Identifica o Item Oficial e o Tipo de Venda baseado nas regras do catálogo,
 * retornando SEMPRE apenas o nome comercial limpo do produto.
 */
export function identificarItemECategoria(itemRaw: string): {
  itemOficial: string;
  tipoVenda: TipoVenda;
  precoReferencia?: number;
} {
  const cleanedRaw = cleanCommercialItemName(itemRaw);
  const norm = normalizeText(cleanedRaw || itemRaw);

  // 1. Checa Boliche ("Meia Hora de Boliche", "Uma Hora de Boliche")
  for (const cat of CATALOGO_VOLUX.boliche) {
    if (cat.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
      return { itemOficial: cat.nome, tipoVenda: 'Boliche', precoReferencia: cat.precoReferencia };
    }
  }

  // 2. Checa Fichas (combos primeiro para evitar colisão com "ficha")
  const mega = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Mega Combo Fichas')!;
  if (mega.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: mega.nome, tipoVenda: 'Fichas', precoReferencia: mega.precoReferencia };
  }

  const big = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Big Combo Fichas')!;
  if (big.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: big.nome, tipoVenda: 'Fichas', precoReferencia: big.precoReferencia };
  }

  const mini = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Mini Combo Fichas')!;
  if (mini.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: mini.nome, tipoVenda: 'Fichas', precoReferencia: mini.precoReferencia };
  }

  const fichas = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Ficha de Jogos Eletronicos')!;
  if (fichas.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: fichas.nome, tipoVenda: 'Fichas', precoReferencia: fichas.precoReferencia };
  }

  // 3. Checa se é um produto do catálogo de Bebidas (AeB)
  const catalogoAeBOrdenado = [...CATALOGO_AEB_PRODUTOS].sort(
    (a, b) => b.nome.length - a.nome.length
  );
  for (const prod of catalogoAeBOrdenado) {
    if (norm.includes(normalizeText(prod.nome))) {
      return { itemOficial: prod.nome, tipoVenda: 'AeB', precoReferencia: prod.preco };
    }
  }

  // Fallbacks contextuais se contiver termos-chave
  if (norm.includes('boliche') || norm.includes('pista')) {
    if (norm.includes('meia') || norm.includes('30') || norm.includes('1/2')) {
      return { itemOficial: 'Meia Hora de Boliche', tipoVenda: 'Boliche', precoReferencia: 70.0 };
    }
    return { itemOficial: 'Uma Hora de Boliche', tipoVenda: 'Boliche', precoReferencia: 120.0 };
  }

  if (norm.includes('ficha') || norm.includes('arcade') || norm.includes('eletronica') || norm.includes('eletronicos')) {
    return { itemOficial: 'Ficha de Jogos Eletronicos', tipoVenda: 'Fichas', precoReferencia: 12.0 };
  }

  const ehBoliche = /boliche|pista|calçado|calcado/i.test(cleanedRaw);
  return {
    itemOficial: cleanedRaw || 'Item Avulso',
    tipoVenda: ehBoliche ? 'Boliche' : 'Fichas',
  };
}

/**
 * Converte string de preço (ex: "49,00", "-17,90", "-31,80", "3.035,00", "R$ -17,90") para número decimal,
 * preservando o sinal negativo quando presente.
 */
export function parsePrecoVolux(precoRaw: string): number {
  if (!precoRaw) return 0;
  const isNegative = precoRaw.includes('-');
  const clean = precoRaw.replace(/[R$\s-]/gi, '').trim();

  let valor = 0;
  if (clean.includes(',')) {
    const semMilhar = clean.replace(/\./g, '');
    const comPonto = semMilhar.replace(',', '.');
    valor = parseFloat(comPonto);
  } else {
    valor = parseFloat(clean);
  }

  if (isNaN(valor)) return 0;
  return isNegative ? -Math.abs(valor) : valor;
}

/**
 * Extrai o ano (YYYY) e a primeira data de referência do cabeçalho do relatório PDF Volux.
 * Procura padrões como "Período: 05/10/2025", "Data: 15/11/2025", "Emissão: 06/10/2026" ou qualquer "DD/MM/YYYY" no texto.
 */
export function extractHeaderDateContextFromVoluxText(text: string): {
  headerYear: string;
  headerFirstDate: string;
} {
  if (!text) {
    return { headerYear: '', headerFirstDate: '' };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerSlice = lines.slice(0, 35).join('\n');

  // 1. Procura data completa com ano de 4 dígitos no cabeçalho (priorizando Período / Data / Referência)
  const periodMatch = headerSlice.match(
    /(?:per[ií]odo|data\s+de\s+refer[eê]ncia|data\s+movimento|movimento|data)\s*[:\-]?\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})/i
  );
  if (periodMatch) {
    const dd = periodMatch[1].padStart(2, '0');
    const mm = periodMatch[2].padStart(2, '0');
    const yyyy = periodMatch[3];
    return { headerYear: yyyy, headerFirstDate: `${dd}/${mm}/${yyyy}` };
  }

  // 2. Qualquer data DD/MM/20YY no cabeçalho ou no documento
  const fullDateMatch =
    headerSlice.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/) ||
    text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (fullDateMatch) {
    const dd = fullDateMatch[1].padStart(2, '0');
    const mm = fullDateMatch[2].padStart(2, '0');
    const yyyy = fullDateMatch[3];
    return { headerYear: yyyy, headerFirstDate: `${dd}/${mm}/${yyyy}` };
  }

  // 3. Data com ano de 2 dígitos no cabeçalho (ex: 15/11/25)
  const shortYearMatch = headerSlice.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
  if (shortYearMatch) {
    const dd = shortYearMatch[1].padStart(2, '0');
    const mm = shortYearMatch[2].padStart(2, '0');
    const yyyy = `20${shortYearMatch[3]}`;
    return { headerYear: yyyy, headerFirstDate: `${dd}/${mm}/${yyyy}` };
  }

  // 4. Ano de 4 dígitos isolado no cabeçalho (ex: "2025" ou "2026")
  const yearOnlyMatch = headerSlice.match(/\b(202\d)\b/);
  const headerYear = yearOnlyMatch ? yearOnlyMatch[1] : '';

  // 5. Primeira data DD/MM encontrada no documento
  const anyDDMMMatch = text.match(/\b(\d{2})\/(\d{2})\b/);
  if (anyDDMMMatch) {
    const dd = anyDDMMMatch[1];
    const mm = anyDDMMMatch[2];
    return {
      headerYear,
      headerFirstDate: headerYear ? `${dd}/${mm}/${headerYear}` : `${dd}/${mm}`,
    };
  }

  return { headerYear, headerFirstDate: '' };
}

/**
 * Formata a data extraída da linha do PDF ("DD/MM" ou "DD/MM/YYYY") combinada com o ano do cabeçalho,
 * NUNCA substituindo pela data de hoje.
 */
export function formatDataVolux(dataRaw: string, headerYear?: string): string {
  if (!dataRaw) return '';
  const clean = dataRaw.trim();
  const match = clean.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (match) {
    const dd = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    const rawYear = match[3];
    if (rawYear) {
      const yyyy = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      return `${dd}/${mm}/${yyyy}`;
    }
    if (headerYear) {
      return `${dd}/${mm}/${headerYear}`;
    }
    return `${dd}/${mm}`;
  }
  return clean;
}

/**
 * Formata hora extraída para o padrão "HH:MM"
 */
export function formatHoraVolux(horaRaw: string): string {
  if (!horaRaw) return '15:00';
  const clean = horaRaw.trim();
  const match = clean.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  return clean;
}

/**
 * Normaliza o ID da Comanda preservando números completos com pontos (ex: "13.536.039", "13.402.402")
 * sem cortar no primeiro ponto.
 */
export function formatComandaId(idRaw: string): string {
  if (!idRaw) return '';
  const trimmed = normalizeSpacedDottedComanda(idRaw.trim());

  // Se já for pontuado (ex: "13.536.039" ou "1.234.567"), preserva todos os grupos com pontos!
  const dottedMatch = trimmed.match(/^(\d{1,3}(?:\.\d{3})+)$/);
  if (dottedMatch) {
    return dottedMatch[1];
  }

  const alphaMatch = trimmed.match(/^([A-Za-z]{1,3}\d{3,8})$/);
  if (alphaMatch) {
    return alphaMatch[1].toUpperCase();
  }

  const clean = trimmed.replace(/[^\d.]/g, '').trim();
  if (clean.includes('.')) {
    return clean.replace(/^\.+|\.+$/g, '');
  }
  if (clean.length === 8) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  }
  if (clean.length === 7) {
    return `${clean.slice(0, 1)}.${clean.slice(1, 4)}.${clean.slice(4)}`;
  }
  return clean || trimmed;
}

/**
 * Extrai o código completo da Comanda de uma linha do relatório Volux.
 * - Captura o número completo da comanda com pontos (ex: "13.536.039"), sem cortar no primeiro ponto.
 * - Ignora códigos de OS/produto ("OS2213") e logins ("boliche26", "ivolux6").
 * - Suporta Data e Hora tanto na ordem "DD/MM HH:MM" quanto invertidas "HH:MM DD/MM".
 */
export function extractComandaFromLine(rawLine: string): string | null {
  if (!rawLine) return null;
  const line = normalizeSpacedDottedComanda(rawLine);

  // 1. Prioridade Máxima: Número de comanda completo com pontos (ex: "13.536.039", "13.402.402", "1.234.567")
  const dottedMatch = line.match(/(?:Comanda[:\s#]*)?\b(\d{1,3}(?:\.\d{3}){2}|\d{1,3}\.\d{3}\.\d{3})\b/i);
  if (dottedMatch) {
    return formatComandaId(dottedMatch[1]);
  }

  // 2. Número ou código no início da linha antes da data ou hora (ex: "3000  15/11", "3000  14:22", "A8126  06/10")
  const startMatch = line.match(
    /^\s*(?:Comanda[:\s#]*)?(\d{1,3}(?:\.\d{3})+|\d{4,9}|[A-Za-z]{1,3}\d{3,8})(?=\s)/i
  );
  if (startMatch) {
    const candidate = startMatch[1];
    // Nunca confunde código de OS (OS2213) com comanda
    if (!/^OS\d+$/i.test(candidate)) {
      return formatComandaId(candidate);
    }
  }

  // 3. Comanda imediatamente antes de uma data DD/MM ou horário HH:MM na linha (suporta data/hora invertidas)
  const beforeDateOrTimeMatch = line.match(
    /\b(\d{1,3}(?:\.\d{3})+|\d{4,9}|[A-Za-z]{1,3}\d{3,8})\b(?=\s+(?:\d{1,2}\/\d{2}|\d{1,2}:\d{2}))/
  );
  if (beforeDateOrTimeMatch) {
    const candidate = beforeDateOrTimeMatch[1];
    if (!/^OS\d+$/i.test(candidate)) {
      return formatComandaId(candidate);
    }
  }

  // 4. Comanda alfanumérica ou de 6-9 dígitos (exceto códigos OS/boliche/ivolux e datas/preços)
  const genericMatches = [
    ...line.matchAll(/\b([A-Za-z]{1,3}\d{3,8}|\d{6,9})\b/g),
  ];
  for (const m of genericMatches) {
    const token = m[1];
    if (/^(?:OS|boliche|ivolux|volux|pdv)\d+$/i.test(token)) {
      continue;
    }
    return formatComandaId(token);
  }

  return null;
}

/**
 * Regex seguro para capturar valores monetários POSITIVOS e NEGATIVOS em formato brasileiro ou decimal.
 * Suporta valores negativos na coluna Total (ex: "-17,90", "-31,80", "R$ -17,90", "-R$ 17,90")
 * e separador de milhar (ex: "3.035,00") sem colidir com números de comanda ("13.536.039").
 */
const MONEY_GLOBAL_REGEX =
  /(?<![0-9.])((?:-\s*R\$\s*|R\$\s*-\s*|-|R\$\s*)?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,6},\d{2}))(?![0-9.,])/g;

/**
 * Extrai o "Valor Total Esperado" da seção de Resumo ou Rodapé do relatório PDF do Volux.
 * Retorna `null` caso o documento não possua rodapé/totalizador explícito.
 */
export function extractExpectedTotalFromVoluxText(text: string): number | null {
  if (!text || !text.trim()) return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let candidateTotal: number | null = null;
  let highPriorityTotal: number | null = null;
  let isReadingCancelledSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeSpacedDottedComanda(lines[i]);
    const norm = normalizeText(line);

    if (line === 'Comandas Canceladas' || /\bcomandas\s+canceladas\b/i.test(norm)) {
      isReadingCancelledSection = true;
      continue;
    }
    if (line === 'Comandas lançadas' || /\bcomandas\s+lancadas\b/i.test(norm)) {
      isReadingCancelledSection = false;
      continue;
    }

    if (
      (norm.includes('cancelad') ||
        norm.includes('desconto') ||
        norm.includes('estorn') ||
        norm.includes('abatimento')) &&
      !norm.includes('liquido') &&
      !norm.includes('geral')
    ) {
      continue;
    }

    const hasComandaAndTime =
      Boolean(extractComandaFromLine(line)) && /\b\d{1,2}:\d{2}\b/.test(line);
    if (hasComandaAndTime && !norm.includes('total') && !norm.includes('resumo')) {
      continue;
    }

    const isHighPriorityLabel =
      /(?:total\s+l[ií]quido|valor\s+l[ií]quido|total\s+geral|valor\s+total|total\s+do\s+relat[oó]rio|total\s+de\s+vendas|total\s+final|total\s+arrecadado|total\s+esperado|total\s+ativo)/i.test(
        line
      );

    const isGenericTotalLabel =
      /^(?:resumo|total|totais|soma\s+total|valor\s+do\s+per[ií]odo|totalizador)\b/i.test(line) ||
      /\b(?:total\s*:|total\s+r\$)/i.test(line);

    if (isHighPriorityLabel || isGenericTotalLabel) {
      if (isReadingCancelledSection && !isHighPriorityLabel) {
        continue;
      }

      const moneyMatches = [...line.matchAll(MONEY_GLOBAL_REGEX)];
      if (moneyMatches.length > 0) {
        const val = parsePrecoVolux(moneyMatches[moneyMatches.length - 1][1]);
        if (val > 0) {
          if (isHighPriorityLabel) {
            highPriorityTotal = val;
          } else {
            candidateTotal = val;
          }
        }
      } else if (i + 1 < lines.length) {
        const nextLineMatches = [...lines[i + 1].matchAll(MONEY_GLOBAL_REGEX)];
        if (nextLineMatches.length > 0 && !extractComandaFromLine(lines[i + 1])) {
          const val = parsePrecoVolux(nextLineMatches[nextLineMatches.length - 1][1]);
          if (val > 0) {
            if (isHighPriorityLabel) {
              highPriorityTotal = val;
            } else {
              candidateTotal = val;
            }
          }
        }
      }
    }
  }

  return highPriorityTotal !== null ? highPriorityTotal : candidateTotal;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Localiza onde o nome do item termina na linha, mesmo quando há diferença de acentuação
 * ou múltiplos espaços no PDF extraído pelo pdfjs.
 */
function findItemSliceInLine(
  line: string,
  itemMatchText: string
): { beforeItemText: string; afterItemText: string } {
  const asciiLine = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const asciiItem = itemMatchText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (asciiItem.length > 0) {
    const words = asciiItem.split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (words.length > 0) {
      const regex = new RegExp(words.join('[\\s\\-|:/]*'), 'i');
      const match = regex.exec(asciiLine);
      if (match && match.index !== undefined) {
        return {
          beforeItemText: line.slice(0, match.index),
          afterItemText: line.slice(match.index + match[0].length),
        };
      }
    }
  }

  const normLine = line.toLowerCase();
  const normItem = itemMatchText.toLowerCase();
  const itemIdx = normLine.indexOf(normItem);
  if (itemIdx >= 0) {
    return {
      beforeItemText: line.slice(0, itemIdx),
      afterItemText: line.slice(itemIdx + itemMatchText.length),
    };
  }

  return { beforeItemText: '', afterItemText: line };
}

/**
 * Extrai a Quantidade (Qtde), o Valor Unitário e o Valor Total real de uma linha do relatório Volux.
 * Remove códigos como OS2213, boliche26, ivolux6 e "/ N" antes de analisar a quantidade.
 */
export function extractQuantityAndUnitPrice(
  line: string,
  itemMatchText: string,
  precoReferencia?: number
): { quantidade: number; precoUnitario: number; valorTotal?: number } {
  const sanitizedLine = stripTrailingAdmFlag(normalizeSpacedDottedComanda(line))
    .replace(/\bOS\s*[-:]?\s*\d+\b/gi, ' ')
    .replace(/\b(?:boliche\d+|ivolux\d*|volux\d*|pdv\d*|terminal\d*|caixa\d*)\b/gi, ' ')
    .replace(/(?:^|\s)\/\s*[NSns]\b/g, ' ');

  const { beforeItemText, afterItemText } = findItemSliceInLine(sanitizedLine, itemMatchText);

  const cleanAfterItem = stripTrailingAdmFlag(afterItemText)
    .replace(/\b\d{1,2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b[A-Za-z]{1,3}\d{3,8}\b/g, ' ');

  const afterMoneyMatches = [...cleanAfterItem.matchAll(MONEY_GLOBAL_REGEX)];
  let rawMoneyMatches = afterMoneyMatches.map((m) => parsePrecoVolux(m[1]));
  if (rawMoneyMatches.length === 0) {
    rawMoneyMatches = [...sanitizedLine.matchAll(MONEY_GLOBAL_REGEX)].map((m) =>
      parsePrecoVolux(m[1])
    );
  }

  if (rawMoneyMatches.length === 0) {
    const fallback = precoReferencia || 0;
    return { quantidade: 1, precoUnitario: fallback, valorTotal: fallback };
  }

  const hasNegativeValue = rawMoneyMatches.some((v) => v < 0);
  let prices = rawMoneyMatches.map((v) => Math.abs(v));

  const lastMoneyMatch =
    afterMoneyMatches.length > 0 ? afterMoneyMatches[afterMoneyMatches.length - 1] : null;
  const textBeforeLastPrice =
    lastMoneyMatch && lastMoneyMatch.index !== undefined
      ? cleanAfterItem.slice(0, lastMoneyMatch.index)
      : cleanAfterItem;

  const segmentWithoutMoney = textBeforeLastPrice.replace(MONEY_GLOBAL_REGEX, ' ');
  const intMatchesBeforePrice = [...segmentWithoutMoney.matchAll(/(?:^|\s)(-?\d{1,3})(?=\s|$)/g)]
    .map((m) => Math.abs(parseInt(m[1], 10)))
    .filter((n) => n >= 1 && n <= 100);

  let quantidade = 1;
  let foundExplicitQty = false;

  if (intMatchesBeforePrice.length > 0) {
    if (prices.length >= 2) {
      const pLast = prices[prices.length - 1];
      const pPrev = prices[prices.length - 2];
      const matchingQty = intMatchesBeforePrice.find(
        (n) => Math.abs(n * pPrev - pLast) < 0.25
      );
      if (matchingQty !== undefined) {
        quantidade = matchingQty;
        foundExplicitQty = true;
      } else if (pPrev > 0 && Math.abs(pLast - pPrev) < 0.05) {
        quantidade = 1;
        foundExplicitQty = true;
      } else {
        quantidade = intMatchesBeforePrice[intMatchesBeforePrice.length - 1];
        foundExplicitQty = true;
      }
    } else {
      quantidade = intMatchesBeforePrice[intMatchesBeforePrice.length - 1];
      foundExplicitQty = true;
    }
  }

  // 2. Caso a coluna Qtde venha formatada com casas decimais (ex: "6,00   15,90   95,40" ou "6,00   95,40")
  if (!foundExplicitQty && prices.length >= 3) {
    const first = prices[0];
    const second = prices[1];
    const last = prices[prices.length - 1];
    if (
      Number.isInteger(first) &&
      first >= 1 &&
      first <= 100 &&
      Math.abs(first * second - last) < 0.25
    ) {
      quantidade = first;
      foundExplicitQty = true;
      prices = prices.slice(1);
    }
  } else if (!foundExplicitQty && prices.length === 2) {
    const first = prices[0];
    const second = prices[1];
    const matchesRefTotal =
      Boolean(precoReferencia) && Math.abs(first * precoReferencia! - second) < 0.25;
    const isLikelyDecimalQty =
      Number.isInteger(first) &&
      first >= 1 &&
      first <= 50 &&
      second >= 2 &&
      first < second * 0.5 &&
      (!precoReferencia || Math.abs(first - precoReferencia) > 0.5);

    if (matchesRefTotal || isLikelyDecimalQty) {
      quantidade = first;
      foundExplicitQty = true;
      prices = [second];
    }
  }

  // 3. Caso a coluna Qtde esteja posicionada ANTES do nome do item
  if (!foundExplicitQty && beforeItemText) {
    const cleanBefore = beforeItemText
      .replace(/\b\d{1,2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/\b[A-Za-z]{1,3}\d{3,8}\b/g, ' ')
      .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ')
      .replace(/\b\d{4,9}\b/g, ' ');
    const intBefore = [...cleanBefore.matchAll(/(?:^|\s)(-?\d{1,2})(?=\s|$)/g)]
      .map((m) => Math.abs(parseInt(m[1], 10)))
      .filter((n) => n >= 1 && n <= 50);
    if (intBefore.length > 0) {
      quantidade = intBefore[intBefore.length - 1];
      foundExplicitQty = true;
    }
  }

  // 4. Se não encontrou inteiro explícito, mas há 2 preços (Unitário e Total)
  if (!foundExplicitQty && prices.length >= 2) {
    const pLast = prices[prices.length - 1];
    const pPrev = prices[prices.length - 2];
    if (pPrev > 0 && pLast > pPrev * 1.5) {
      const ratio = pLast / pPrev;
      const roundedRatio = Math.round(ratio);
      if (
        roundedRatio >= 2 &&
        roundedRatio <= 50 &&
        Math.abs(ratio - roundedRatio) < 0.02 &&
        (!precoReferencia || Math.abs(pPrev - precoReferencia) < 0.5)
      ) {
        quantidade = roundedRatio;
        foundExplicitQty = true;
      }
    }
  }

  const applySign = (val: number) => (hasNegativeValue ? -Math.abs(val) : Math.abs(val));

  if (quantidade <= 1) {
    const precoFinal = prices[prices.length - 1];
    return {
      quantidade: 1,
      precoUnitario: applySign(precoFinal),
      valorTotal: applySign(precoFinal),
    };
  }

  if (prices.length >= 2) {
    const pLast = prices[prices.length - 1];
    const pPrev = prices[prices.length - 2];

    if (Math.abs(pPrev * quantidade - pLast) < 0.25) {
      return {
        quantidade,
        precoUnitario: applySign(pPrev),
        valorTotal: applySign(pLast),
      };
    }

    if (
      (precoReferencia && pLast > precoReferencia * 1.15 && Math.abs(pPrev - precoReferencia) < 0.25) ||
      pLast > pPrev * 1.2
    ) {
      return {
        quantidade,
        precoUnitario: applySign(Number((pLast / quantidade).toFixed(2))),
        valorTotal: applySign(pLast),
      };
    }

    const totalCalc = Number((pLast * quantidade).toFixed(2));
    return {
      quantidade,
      precoUnitario: applySign(pLast),
      valorTotal: applySign(totalCalc),
    };
  }

  const pOnly = prices[0];
  if (precoReferencia && Math.abs(pOnly - precoReferencia) < 0.05) {
    const totalCalc = Number((pOnly * quantidade).toFixed(2));
    return {
      quantidade,
      precoUnitario: applySign(pOnly),
      valorTotal: applySign(totalCalc),
    };
  }

  return {
    quantidade,
    precoUnitario: applySign(Number((pOnly / quantidade).toFixed(2))),
    valorTotal: applySign(pOnly),
  };
}

export interface VoluxReconciliationResult {
  vendas: VendaComanda[];
  totalExtraido: number;
  totalEsperado: number | null;
  hasDiscrepancy: boolean;
  diferenca: number;
  unmatchedLines: string[];
  isEmptyReport?: boolean;
}

export interface VoluxAeBReconciliationResult {
  vendas: VendaAeB[];
  totalExtraido: number;
  totalEsperado: number | null;
  hasDiscrepancy: boolean;
  diferenca: number;
  unmatchedLines: string[];
  isEmptyReport?: boolean;
}

/**
 * Divide uma linha caso o PDF tenha concatenado duas comandas na mesma linha horizontal
 * (Suporta data DD/MM ou hora HH:MM logo após o número da comanda)
 */
function splitMergedComandaLines(rawLines: string[]): string[] {
  const result: string[] = [];
  const multiComandaPattern =
    /(?=(\b(?:\d{1,3}(?:\.\d{3}){2}|[A-NP-Za-np-z]\d{3,8})\b\s+(?:\d{1,2}\/\d{2}|\d{1,2}:\d{2})))/g;

  for (const rawLine of rawLines) {
    const line = normalizeSpacedDottedComanda(rawLine);
    const matches = [...line.matchAll(multiComandaPattern)];
    if (matches.length > 1) {
      let lastIdx = 0;
      for (let i = 1; i < matches.length; i++) {
        const idx = matches[i].index!;
        result.push(line.slice(lastIdx, idx).trim());
        lastIdx = idx;
      }
      result.push(line.slice(lastIdx).trim());
    } else {
      result.push(line);
    }
  }
  return result.filter(Boolean);
}

/**
 * Extrai posicionalmente o nome comercial limpo do item a partir do trecho anterior ao primeiro preço,
 * removendo comanda, datas, horários, códigos (OS2213, boliche26, ivolux6), quantidade isolada e flags ADM (/ N).
 */
function extractPositionalItemName(
  cleanLine: string,
  firstPriceText: string,
  comandaCode?: string | null
): string {
  const precoIdx = cleanLine.indexOf(firstPriceText);
  if (precoIdx <= 0) return '';

  let segment = cleanLine.slice(0, precoIdx);
  if (comandaCode) {
    const escapedComanda = escapeRegExp(comandaCode);
    segment = segment.replace(new RegExp(`\\b${escapedComanda}\\b`, 'gi'), ' ');
  }

  segment = segment
    .replace(/(?:Comanda[:\s#]*)?\b(?:\d{1,3}(?:\.\d{3})+|[A-Za-z]{1,3}\d{3,8}|\d{4,9})\b/gi, ' ')
    .replace(/\b\d{1,2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\bOS\s*[-:]?\s*\d+\b/gi, ' ')
    .replace(/\b(?:boliche\d+|ivolux\d*|volux\d*|pdv\d*|terminal\d*|caixa\d*)\b/gi, ' ')
    .replace(/\s+-?\d{1,3}\s*$/, ' ')
    .replace(/^\s*-?\d{1,3}\s+/, ' ')
    .replace(/[-|:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanCommercialItemName(segment);
}

/**
 * Parser completo com Sistema de Conciliação e Auditoria para Comandas (Boliche & Fichas)
 * Implementa:
 * 1. Parada imediata na seção "Resumo do Período" (evita duplicar linhas de resumo da pág. 2)
 * 2. Extração da data real (DD/MM) e hora (HH:MM) mesmo quando invertidas na linha
 * 3. Captura completa do número da comanda com pontos (ex: 13.536.039)
 * 4. Limpeza total do nome comercial do produto (removendo OS2213, boliche26, ivolux6, / N)
 * 5. Leitura da conta 3000 marcando isCortesia: true com o valor real do PDF e suporte a Voucher
 */
export function parseVoluxTextWithReconciliation(text: string): VoluxReconciliationResult {
  const vendas: VendaComanda[] = [];
  const unmatchedLines: string[] = [];

  if (!text || !text.trim()) {
    return {
      vendas,
      totalExtraido: 0,
      totalEsperado: null,
      hasDiscrepancy: false,
      diferenca: 0,
      unmatchedLines,
      isEmptyReport: false,
    };
  }

  const { headerYear, headerFirstDate } = extractHeaderDateContextFromVoluxText(text);

  const launchedOccurrences: Record<string, number> = {};
  const cancelledOccurrences: Record<string, number> = {};

  const todosSinonimos = [
    ...CATALOGO_VOLUX.boliche.flatMap((b) =>
      b.sinonimos.map((s) => ({ termo: s, oficial: b.nome }))
    ),
    ...CATALOGO_VOLUX.fichas.flatMap((f) =>
      f.sinonimos.map((s) => ({ termo: s, oficial: f.nome }))
    ),
  ].sort((a, b) => b.termo.length - a.termo.length);

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = splitMergedComandaLines(rawLines);

  let lastComanda = '';
  let lastContaAdm: '3000' | '3030' | null = null;
  let pendingHeaderContaAdm: '3000' | '3030' | null = null;
  let lastData = headerFirstDate || (headerYear ? `05/10/${headerYear}` : '05/10');
  let lastHora = '15:00';
  let inSummarySection = false;
  let isReadingCancelledSection = false;

  let totalLancado = 0;
  let totalCanceladoPdf = 0;

  for (const rawLine of lines) {
    const trimmedRaw = normalizeSpacedDottedComanda(rawLine.trim());
    const normRaw = normalizeText(trimmedRaw);

    // PARADA IMEDIATA NO "Resumo do Período": nunca lê nem duplica linhas da seção de resumo
    if (
      /\bresumo\s+do\s+periodo\b/i.test(normRaw) ||
      /^resumo\s+do\s+relatorio\b/i.test(normRaw) ||
      /^fim\s+do\s+relatorio\b/i.test(normRaw)
    ) {
      break;
    }

    if (
      trimmedRaw === 'Comandas Canceladas' ||
      /^comandas\s+canceladas\b/i.test(trimmedRaw) ||
      (!/^(?:total|subtotal|resumo)/i.test(normRaw) && /\bcomandas\s+canceladas\b/i.test(normRaw))
    ) {
      isReadingCancelledSection = true;
      inSummarySection = false;
      lastComanda = '';
      lastContaAdm = null;
      pendingHeaderContaAdm = null;
      continue;
    }

    if (
      trimmedRaw === 'Comandas lançadas' ||
      /^comandas\s+lan[cç]adas\b/i.test(trimmedRaw) ||
      (!/^(?:total|subtotal|resumo)/i.test(normRaw) && /\bcomandas\s+lancadas\b/i.test(normRaw))
    ) {
      isReadingCancelledSection = false;
      inSummarySection = false;
      lastComanda = '';
      lastContaAdm = null;
      pendingHeaderContaAdm = null;
      continue;
    }

    const line = stripTrailingAdmFlag(trimmedRaw);
    const normLine = normalizeText(line);

    if (
      /\bresumo\s+do\s+periodo\b/i.test(normLine) ||
      /^resumo\s+do\s+relatorio\b/i.test(normLine) ||
      /^fim\s+do\s+relatorio\b/i.test(normLine)
    ) {
      break;
    }

    if (
      /^(?:resumo|total\s+geral|total\s+por\s+produto|total\s+por\s+item|totalizador)/i.test(
        normLine
      )
    ) {
      inSummarySection = true;
      continue;
    }

    if (
      /^[-=_*]{4,}$/.test(line) ||
      (/comanda/i.test(line) && /item|produto|descri/i.test(line) && /pre[cç]o|valor|total/i.test(line)) ||
      /^(?:sistema\s+volux|unidade:|filtro:|pagina\s+\d|per[ií]odo:|data\s+emiss|comandas\s*x\s*itens)/i.test(normLine)
    ) {
      continue;
    }

    const comandaExtracted = extractComandaFromLine(line);
    const lineContaAdm = extractContaAdmFromLine(trimmedRaw, comandaExtracted);
    const hasExplicitAdmNo = /(?:\s+|\s*[/|]\s*)[Nn](?:\s*[/|]\s*)?$/.test(trimmedRaw);
    const hasExplicitAdmYes = /(?:\s+|\s*[/|]\s*)[Ss](?:\s*[/|]\s*)?$/.test(trimmedRaw);

    // Captura DD/MM e HH:MM independentemente da ordem na linha ("16/11 10:49" ou "14:22 16/11")
    const dataMatch = line.match(/\b(\d{1,2}\/\d{2}(?:\/\d{2,4})?)\b/);
    const horaMatch = line.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    const precoMatches = [...line.matchAll(MONEY_GLOBAL_REGEX)];

    const previousComanda = lastComanda;
    if (comandaExtracted) {
      lastComanda = comandaExtracted;
      inSummarySection = false;
    }
    if (dataMatch) {
      lastData = formatDataVolux(dataMatch[1], headerYear);
    }
    if (horaMatch) {
      lastHora = formatHoraVolux(horaMatch[1]);
    }

    if (inSummarySection && !comandaExtracted) {
      continue;
    }

    const isTotalLine = /^(?:total|subtotal|soma|media|resumo)\b/i.test(normLine);
    if (isTotalLine) {
      continue;
    }

    // Verifica se há um item conhecido do catálogo na linha
    let matchedItemText = '';
    for (const sin of todosSinonimos) {
      if (normLine.includes(normalizeText(sin.termo))) {
        matchedItemText = sin.termo;
        break;
      }
    }

    // Fallback posicional caso o item não bata nos sinônimos padrão
    if (
      !matchedItemText &&
      (Boolean(comandaExtracted) || Boolean(lastComanda)) &&
      precoMatches.length > 0
    ) {
      const candidate = extractPositionalItemName(line, precoMatches[0][0], comandaExtracted);
      if (candidate.length >= 3) {
        matchedItemText = candidate;
      }
    }

    const canUseContextComanda =
      Boolean(lastComanda) && Boolean(matchedItemText) && precoMatches.length > 0 && !isTotalLine;

    if (
      matchedItemText &&
      precoMatches.length > 0 &&
      (Boolean(comandaExtracted) || canUseContextComanda)
    ) {
      const { itemOficial, tipoVenda, precoReferencia } = identificarItemECategoria(matchedItemText);
      const comandaCode = comandaExtracted || lastComanda;
      const dataStr = dataMatch ? formatDataVolux(dataMatch[1], headerYear) : lastData;
      const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : lastHora;

      const { quantidade, precoUnitario, valorTotal } = extractQuantityAndUnitPrice(
        line,
        matchedItemText,
        precoReferencia
      );

      const isCancelado =
        isReadingCancelledSection || precoUnitario < 0 || isLinhaCanceladaVolux(line);

      // Regra Contas ADM 3000 e 3030 (extraída da linha ou herdada da linha anterior) e Regra de Voucher
      let contaAdmCode: '3000' | '3030' | null = null;
      if (lineContaAdm) {
        contaAdmCode = lineContaAdm;
        lastContaAdm = lineContaAdm;
      } else if (pendingHeaderContaAdm && !hasExplicitAdmNo) {
        contaAdmCode = pendingHeaderContaAdm;
        lastContaAdm = pendingHeaderContaAdm;
      } else if (
        lastContaAdm &&
        !hasExplicitAdmNo &&
        (!comandaExtracted || comandaExtracted === previousComanda || hasExplicitAdmYes)
      ) {
        contaAdmCode = lastContaAdm;
      } else {
        lastContaAdm = null;
      }
      pendingHeaderContaAdm = null;

      const isContaAdm = contaAdmCode !== null;
      const isVoucher = !isCancelado && !isContaAdm && isLinhaVoucherVolux(trimmedRaw);

      const precoAbsoluto = Math.abs(precoUnitario);
      const valorTotalLinha =
        valorTotal !== undefined
          ? Math.abs(valorTotal)
          : Number((precoAbsoluto * quantidade).toFixed(2));

      if (isCancelado) {
        totalCanceladoPdf = Number((totalCanceladoPdf + valorTotalLinha).toFixed(2));
      } else {
        totalLancado = Number((totalLancado + valorTotalLinha).toFixed(2));
      }

      const occMap = isCancelado ? cancelledOccurrences : launchedOccurrences;
      const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);

      // Mantém a venda agrupada na mesma linha (1 registro por linha do PDF com qtde e valorTotalLinha)
      occMap[baseId] = (occMap[baseId] || 0) + 1;
      const idDeterministico = `${baseId}_${occMap[baseId]}`;
      const precoEfetivoLinha = isCancelado ? -valorTotalLinha : valorTotalLinha;

      vendas.push({
        id: idDeterministico,
        pdfId: idDeterministico,
        origem: 'PDF',
        comanda: comandaCode,
        data: dataStr,
        hora: horaStr,
        tipo_venda: tipoVenda,
        item: itemOficial,
        qtde: quantidade,
        preco: precoEfetivoLinha,
        responsavel: '',
        cancelado: isCancelado,
        status: isCancelado ? 'Cancelado' : 'Ativo',
        ...(contaAdmCode
          ? {
              conta3000: true,
              contaAdm: contaAdmCode,
              espaco: contaAdmCode,
              isCortesia: true,
              motivoOperacional: 'Cortesia',
            }
          : isVoucher
            ? {
                isVoucher: true,
                motivoOperacional: 'Voucher',
              }
            : {}),
      });
    } else {
      if (lineContaAdm) {
        pendingHeaderContaAdm = lineContaAdm;
        lastContaAdm = lineContaAdm;
      } else if (comandaExtracted && hasExplicitAdmNo) {
        pendingHeaderContaAdm = null;
        lastContaAdm = null;
      }
      if (precoMatches.length > 0 && !isTotalLine) {
        unmatchedLines.push(line);
      }
    }
  }

  // ESTRATÉGIA 2 (Fallback Multilinha - truncado antes de "Resumo do Período")
  if (vendas.length === 0) {
    const textBeforeSummary =
      text.split(/resumo\s+do\s+per[ií]odo|resumo\s+do\s+relat[oó]rio|fim\s+do\s+relat[oó]rio/i)[0] ||
      text;

    const blockPattern =
      /(?:Comanda[:\s#]*)?(\b\d{1,3}(?:\.\d{3}){2}\b|\b[A-NP-Za-np-z]\d{3,8}\b|\b\d{4,9}\b)[\s\S]{1,120}?(?:(\d{1,2}\/\d{2}(?:\/\d{2,4})?)[\s\S]{1,80}?(\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}:\d{2}(?::\d{2})?)[\s\S]{1,80}?(\d{1,2}\/\d{2}(?:\/\d{2,4})?))[\s\S]{1,120}?(Meia Hora de Boliche|Uma Hora de Boliche|Mega Combo(?:\s+Fichas)?|Big Combo(?:\s+Fichas)?|Mini Combo(?:\s+Fichas)?|Fichas?\s+(?:de\s+Jogos\s+)?Eletr[oô]nic[ao]s?)([\s\S]{1,80}?)(?:R\$\s*)?(-?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,6},\d{2}))/gi;

    const cancelledHeaderIdx = textBeforeSummary.search(/\bComandas\s+Canceladas\b/i);
    let match: RegExpExecArray | null;
    while ((match = blockPattern.exec(textBeforeSummary)) !== null) {
      const comandaRaw = match[1];
      const dataRaw = match[2] || match[5];
      const horaRaw = match[3] || match[4];
      const itemRaw = match[6];
      const fullSnippet = stripTrailingAdmFlag(match[0]);

      const { itemOficial, tipoVenda, precoReferencia } = identificarItemECategoria(itemRaw);
      const comandaCode = formatComandaId(comandaRaw);
      const dataStr = formatDataVolux(dataRaw, headerYear);
      const horaStr = formatHoraVolux(horaRaw);

      const { quantidade, precoUnitario, valorTotal } = extractQuantityAndUnitPrice(
        fullSnippet,
        itemRaw,
        precoReferencia
      );

      const inCancelledPart =
        cancelledHeaderIdx !== -1 && (match.index || 0) >= cancelledHeaderIdx;
      const isCancelado =
        inCancelledPart || precoUnitario < 0 || isLinhaCanceladaVolux(fullSnippet);
      const contaAdmCode = extractContaAdmFromLine(match[0], comandaCode);
      const isVoucher = !isCancelado && !contaAdmCode && isLinhaVoucherVolux(match[0]);
      const precoAbsoluto = Math.abs(precoUnitario);
      const valorTotalLinha =
        valorTotal !== undefined
          ? Math.abs(valorTotal)
          : Number((precoAbsoluto * quantidade).toFixed(2));

      if (isCancelado) {
        totalCanceladoPdf = Number((totalCanceladoPdf + valorTotalLinha).toFixed(2));
      } else {
        totalLancado = Number((totalLancado + valorTotalLinha).toFixed(2));
      }

      const occMap = isCancelado ? cancelledOccurrences : launchedOccurrences;
      const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);

      occMap[baseId] = (occMap[baseId] || 0) + 1;
      const idDeterministico = `${baseId}_${occMap[baseId]}`;
      const precoEfetivoLinha = isCancelado ? -valorTotalLinha : valorTotalLinha;

      vendas.push({
        id: idDeterministico,
        pdfId: idDeterministico,
        origem: 'PDF',
        comanda: comandaCode,
        data: dataStr,
        hora: horaStr,
        tipo_venda: tipoVenda,
        item: itemOficial,
        qtde: quantidade,
        preco: precoEfetivoLinha,
        responsavel: '',
        cancelado: isCancelado,
        status: isCancelado ? 'Cancelado' : 'Ativo',
        ...(contaAdmCode
          ? {
              conta3000: true,
              contaAdm: contaAdmCode,
              espaco: contaAdmCode,
              isCortesia: true,
              motivoOperacional: 'Cortesia',
            }
          : isVoucher
            ? {
                isVoucher: true,
                motivoOperacional: 'Voucher',
              }
            : {}),
      });
    }
  }

  const totalLiquidoPdf = Number(Math.max(0, totalLancado - totalCanceladoPdf).toFixed(2));
  const totalEsperado = extractExpectedTotalFromVoluxText(text);

  let totalExtraido = totalLancado;
  if (totalEsperado !== null) {
    if (Math.abs(totalEsperado - totalLiquidoPdf) <= 0.05) {
      totalExtraido = totalLiquidoPdf;
    } else if (Math.abs(totalEsperado - totalLancado) <= 0.05) {
      totalExtraido = totalLancado;
    } else {
      totalExtraido =
        Math.abs(totalEsperado - totalLiquidoPdf) < Math.abs(totalEsperado - totalLancado)
          ? totalLiquidoPdf
          : totalLancado;
    }
  }

  const diferenca =
    totalEsperado !== null ? Number(Math.abs(totalEsperado - totalExtraido).toFixed(2)) : 0;
  const hasDiscrepancy =
    totalEsperado !== null && totalExtraido !== totalEsperado && diferenca > 0.05;

  return {
    vendas,
    totalExtraido,
    totalEsperado,
    hasDiscrepancy,
    diferenca,
    unmatchedLines,
    isEmptyReport: vendas.length === 0 && isValidVoluxReportHeader(text),
  };
}

/**
 * Mantém assinatura compatível retornando diretamente o array de vendas extraídas
 */
export function parseVoluxText(text: string): VendaComanda[] {
  return parseVoluxTextWithReconciliation(text).vendas;
}

/**
 * Extrai texto completo de um arquivo PDF utilizando pdfjs-dist.
 * Agrupa fragmentos por coordenada vertical (Y) com tolerância fina (3pt) e ordena
 * horizontalmente (X) da esquerda para a direita, preservando comandas pontuadas completas (ex: 13.536.039).
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    interface TextFragment {
      str: string;
      x: number;
      y: number;
    }

    const fragments: TextFragment[] = [];
    for (const item of content.items as any[]) {
      if ('str' in item && item.str.trim().length > 0 && Array.isArray(item.transform)) {
        fragments.push({
          str: item.str,
          x: Number(item.transform[4]) || 0,
          y: Number(item.transform[5]) || 0,
        });
      }
    }

    const rows: { y: number; items: TextFragment[] }[] = [];
    for (const frag of fragments) {
      let matchedRow = rows.find((r) => Math.abs(r.y - frag.y) <= 3);
      if (!matchedRow) {
        matchedRow = { y: frag.y, items: [] };
        rows.push(matchedRow);
      }
      matchedRow.items.push(frag);
    }

    rows.sort((a, b) => b.y - a.y);

    const pageLines = rows.map((row) => {
      row.items.sort((a, b) => a.x - b.x);
      return normalizeSpacedDottedComanda(row.items.map((i) => i.str).join(' '));
    });

    fullText += pageLines.join('\n') + '\n\n';
  }

  return fullText;
}

/**
 * Sugestões comuns de itens para o módulo Alimentos e Bebidas (AeB) baseadas no catálogo oficial Volux
 */
export const SUGESTOES_AEB = CATALOGO_AEB_PRODUTOS.map((p) => p.nome);

/**
 * Parser exclusivo com Sistema de Conciliação e Auditoria para relatórios Volux Alimentos e Bebidas (AeB).
 * - Para imediatamente em "Resumo do Período"
 * - Captura data e hora mesmo invertidas ("16/11 10:49" ou "14:22 16/11")
 * - Reconhece PDF de A&B vazio ("Comandas X Itens por PDV" sem linhas de venda) sem acusar erro
 * - Suporta Contas ADM 3000 e 3030 (extraídas ou herdadas da linha anterior) mantendo o valor real
 */
export function parseVoluxAeBTextWithReconciliation(text: string): VoluxAeBReconciliationResult {
  const vendas: VendaAeB[] = [];
  const unmatchedLines: string[] = [];

  if (!text || !text.trim()) {
    return {
      vendas,
      totalExtraido: 0,
      totalEsperado: null,
      hasDiscrepancy: false,
      diferenca: 0,
      unmatchedLines,
      isEmptyReport: false,
    };
  }

  const { headerYear, headerFirstDate } = extractHeaderDateContextFromVoluxText(text);

  const launchedOccurrences: Record<string, number> = {};
  const cancelledOccurrences: Record<string, number> = {};
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = splitMergedComandaLines(rawLines);

  const catalogoOrdenado = [...CATALOGO_AEB_PRODUTOS].sort(
    (a, b) => b.nome.length - a.nome.length
  );

  let lastComanda = '';
  let lastContaAdm: '3000' | '3030' | null = null;
  let pendingHeaderContaAdm: '3000' | '3030' | null = null;
  let lastData = headerFirstDate || (headerYear ? `05/10/${headerYear}` : '05/10');
  let lastHora = '15:00';
  let inSummarySection = false;
  let isReadingCancelledSection = false;

  let totalLancado = 0;
  let totalCanceladoPdf = 0;

  for (const rawLine of lines) {
    const trimmedRaw = normalizeSpacedDottedComanda(rawLine.trim());
    const normRaw = normalizeText(trimmedRaw);

    // PARADA IMEDIATA NO "Resumo do Período": nunca lê nem duplica linhas da seção de resumo
    if (
      /\bresumo\s+do\s+periodo\b/i.test(normRaw) ||
      /^resumo\s+do\s+relatorio\b/i.test(normRaw) ||
      /^fim\s+do\s+relatorio\b/i.test(normRaw)
    ) {
      break;
    }

    if (
      trimmedRaw === 'Comandas Canceladas' ||
      /^comandas\s+canceladas\b/i.test(trimmedRaw) ||
      (!/^(?:total|subtotal|resumo)/i.test(normRaw) && /\bcomandas\s+canceladas\b/i.test(normRaw))
    ) {
      isReadingCancelledSection = true;
      inSummarySection = false;
      lastComanda = '';
      lastContaAdm = null;
      pendingHeaderContaAdm = null;
      continue;
    }

    if (
      trimmedRaw === 'Comandas lançadas' ||
      /^comandas\s+lan[cç]adas\b/i.test(trimmedRaw) ||
      (!/^(?:total|subtotal|resumo)/i.test(normRaw) && /\bcomandas\s+lancadas\b/i.test(normRaw))
    ) {
      isReadingCancelledSection = false;
      inSummarySection = false;
      lastComanda = '';
      lastContaAdm = null;
      pendingHeaderContaAdm = null;
      continue;
    }

    const line = stripTrailingAdmFlag(trimmedRaw);
    const normLine = normalizeText(line);

    if (
      /\bresumo\s+do\s+periodo\b/i.test(normLine) ||
      /^resumo\s+do\s+relatorio\b/i.test(normLine) ||
      /^fim\s+do\s+relatorio\b/i.test(normLine)
    ) {
      break;
    }

    if (
      /^(?:resumo|total\s+geral|total\s+por\s+produto|total\s+por\s+item|totalizador)/i.test(
        normLine
      )
    ) {
      inSummarySection = true;
      continue;
    }

    if (
      /^[-=_*]{4,}$/.test(line) ||
      (/comanda/i.test(line) && /item|produto|descri/i.test(line) && /pre[cç]o|valor|total/i.test(line)) ||
      /^(?:sistema\s+volux|unidade:|filtro:|pagina\s+\d|per[ií]odo:|data\s+emiss|comandas\s*x\s*itens)/i.test(normLine)
    ) {
      continue;
    }

    const comandaExtracted = extractComandaFromLine(line);
    const lineContaAdm = extractContaAdmFromLine(trimmedRaw, comandaExtracted);
    const hasExplicitAdmNo = /(?:\s+|\s*[/|]\s*)[Nn](?:\s*[/|]\s*)?$/.test(trimmedRaw);
    const hasExplicitAdmYes = /(?:\s+|\s*[/|]\s*)[Ss](?:\s*[/|]\s*)?$/.test(trimmedRaw);

    // Captura DD/MM e HH:MM independentemente da ordem na linha ("16/11 10:49" ou "14:22 16/11")
    const dataMatch = line.match(/\b(\d{1,2}\/\d{2}(?:\/\d{2,4})?)\b/);
    const horaMatch = line.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    const precoMatches = [...line.matchAll(MONEY_GLOBAL_REGEX)];

    const previousComanda = lastComanda;
    if (comandaExtracted) {
      lastComanda = comandaExtracted;
      inSummarySection = false;
    }
    if (dataMatch) {
      lastData = formatDataVolux(dataMatch[1], headerYear);
    }
    if (horaMatch) {
      lastHora = formatHoraVolux(horaMatch[1]);
    }

    if (inSummarySection && !comandaExtracted) {
      continue;
    }

    const isTotalLine = /^(?:total|subtotal|soma|media|resumo)\b/i.test(normLine);
    if (isTotalLine) continue;

    // 1. Procura produto no catálogo oficial de AeB
    let itemNome = '';
    let precoReferencia: number | undefined;

    for (const prod of catalogoOrdenado) {
      if (normLine.includes(normalizeText(prod.nome))) {
        itemNome = prod.nome;
        precoReferencia = prod.preco;
        break;
      }
    }

    // 2. Se não está no catálogo padrão, extrai posicionalmente e limpa códigos OS/boliche/ivolux
    if (
      !itemNome &&
      (Boolean(comandaExtracted) || Boolean(lastComanda)) &&
      precoMatches.length > 0
    ) {
      const candidate = extractPositionalItemName(line, precoMatches[0][0], comandaExtracted);
      if (candidate.length >= 2) {
        itemNome = cleanCommercialItemName(candidate);
      }
    }

    if (
      itemNome &&
      precoMatches.length > 0 &&
      (Boolean(comandaExtracted) || Boolean(lastComanda))
    ) {
      const comandaCode = comandaExtracted || lastComanda;
      const dataStr = dataMatch ? formatDataVolux(dataMatch[1], headerYear) : lastData;
      const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : lastHora;
      const cleanItemNome = cleanCommercialItemName(itemNome) || itemNome;

      const { quantidade, precoUnitario, valorTotal } = extractQuantityAndUnitPrice(
        line,
        cleanItemNome,
        precoReferencia
      );

      const isCancelado =
        isReadingCancelledSection || precoUnitario < 0 || isLinhaCanceladaVolux(line);

      let contaAdmCode: '3000' | '3030' | null = null;
      if (lineContaAdm) {
        contaAdmCode = lineContaAdm;
        lastContaAdm = lineContaAdm;
      } else if (pendingHeaderContaAdm && !hasExplicitAdmNo) {
        contaAdmCode = pendingHeaderContaAdm;
        lastContaAdm = pendingHeaderContaAdm;
      } else if (
        lastContaAdm &&
        !hasExplicitAdmNo &&
        (!comandaExtracted || comandaExtracted === previousComanda || hasExplicitAdmYes)
      ) {
        contaAdmCode = lastContaAdm;
      } else {
        lastContaAdm = null;
      }
      pendingHeaderContaAdm = null;

      const isContaAdm = contaAdmCode !== null;
      const isVoucher = !isCancelado && !isContaAdm && isLinhaVoucherVolux(trimmedRaw);

      const precoAbsoluto = Math.abs(precoUnitario);
      const valorTotalLinha =
        valorTotal !== undefined
          ? Math.abs(valorTotal)
          : Number((precoAbsoluto * quantidade).toFixed(2));

      if (isCancelado) {
        totalCanceladoPdf = Number((totalCanceladoPdf + valorTotalLinha).toFixed(2));
      } else {
        totalLancado = Number((totalLancado + valorTotalLinha).toFixed(2));
      }

      const occMap = isCancelado ? cancelledOccurrences : launchedOccurrences;
      const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, cleanItemNome);

      // Mantém a venda de AeB agrupada na mesma linha (1 registro por linha do PDF com qtde e valorTotalLinha)
      occMap[baseId] = (occMap[baseId] || 0) + 1;
      const idDeterministico = `${baseId}_${occMap[baseId]}`;
      const precoEfetivoLinha = isCancelado ? -valorTotalLinha : valorTotalLinha;

      vendas.push({
        id: idDeterministico,
        pdfId: idDeterministico,
        origem: 'PDF',
        comanda: comandaCode,
        data: dataStr,
        hora: horaStr,
        item: cleanItemNome,
        qtde: quantidade,
        preco: precoEfetivoLinha,
        responsavel: '',
        cancelado: isCancelado,
        status: isCancelado ? 'Cancelado' : 'Ativo',
        ...(contaAdmCode
          ? {
              conta3000: true,
              contaAdm: contaAdmCode,
              espaco: contaAdmCode,
              isCortesia: true,
              motivoOperacional: 'Cortesia',
            }
          : isVoucher
            ? {
                isVoucher: true,
                motivoOperacional: 'Voucher',
              }
            : {}),
      });
    } else {
      if (lineContaAdm) {
        pendingHeaderContaAdm = lineContaAdm;
        lastContaAdm = lineContaAdm;
      } else if (comandaExtracted && hasExplicitAdmNo) {
        pendingHeaderContaAdm = null;
        lastContaAdm = null;
      }
      if (precoMatches.length > 0 && !isTotalLine) {
        unmatchedLines.push(line);
      }
    }
  }

  const totalLiquidoPdf = Number(Math.max(0, totalLancado - totalCanceladoPdf).toFixed(2));
  const totalEsperado = extractExpectedTotalFromVoluxText(text);

  let totalExtraido = totalLancado;
  if (totalEsperado !== null) {
    if (Math.abs(totalEsperado - totalLiquidoPdf) <= 0.05) {
      totalExtraido = totalLiquidoPdf;
    } else if (Math.abs(totalEsperado - totalLancado) <= 0.05) {
      totalExtraido = totalLancado;
    } else {
      totalExtraido =
        Math.abs(totalEsperado - totalLiquidoPdf) < Math.abs(totalEsperado - totalLancado)
          ? totalLiquidoPdf
          : totalLancado;
    }
  }

  const diferenca =
    totalEsperado !== null ? Number(Math.abs(totalEsperado - totalExtraido).toFixed(2)) : 0;
  const hasDiscrepancy =
    totalEsperado !== null && totalExtraido !== totalEsperado && diferenca > 0.05;

  return {
    vendas,
    totalExtraido,
    totalEsperado,
    hasDiscrepancy,
    diferenca,
    unmatchedLines,
    isEmptyReport: vendas.length === 0 && isValidVoluxReportHeader(text),
  };
}

export function parseVoluxAeBText(text: string): VendaAeB[] {
  return parseVoluxAeBTextWithReconciliation(text).vendas;
}
