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
 * Monta a string base do ID determinístico do PDF:
 * pdf_${comanda}_${data}_${hora}_${nomeDoItem}
 */
export function generateBaseDeterministicPdfId(
  comanda: string,
  data: string,
  hora: string,
  item: string
): string {
  const cleanComanda = (comanda || '00.000.000').trim();
  const cleanData = (data || '00/00').trim();
  const cleanHora = (hora || '00:00').trim();
  const cleanItem = formatItemForDeterministicId(item);

  return `pdf_${cleanComanda}_${cleanData}_${cleanHora}_${cleanItem}`;
}

/**
 * Gera ID determinístico baseado estritamente nos dados da linha extraída do PDF e no contador de ocorrências.
 * Formato padrão: ${baseId}_${occurrenceIndex}
 * Exemplo: pdf_13.402.402_05/10_15:03_UmaHoraDeBoliche_1
 */
export function generateDeterministicPdfId(
  comanda: string,
  data: string,
  hora: string,
  item: string,
  occurrenceIndex: number = 1
): string {
  const baseId = generateBaseDeterministicPdfId(comanda, data, hora, item);
  return `${baseId}_${occurrenceIndex}`;
}

/**
 * Remove a coluna "ADM" ("S" ou "N") do final da linha do relatório Volux.
 * No Volux, "S" ou "N" no final da linha indica apenas se a conta é ADM e NÃO indica cancelamento.
 * Esses caracteres são tratados apenas como texto irrelevante e descartados.
 */
export function stripTrailingAdmFlag(line: string): string {
  if (!line) return '';
  return line
    .replace(/(?:\s+|\s*\|\s*)[SNsn](?:\s*\|\s*)?$/, '')
    .trim();
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

/**
 * Catálogo Oficial de Itens Volux e Preços de Referência
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
      nome: 'Fichas Eletronicas',
      precoReferencia: 12.0,
      tipo: 'Fichas' as TipoVenda,
      desc: 'Fichas individuais / R$ 12,00',
      sinonimos: [
        'fichas eletronicas',
        'ficha eletronica',
        'fichas eletrônicas',
        'ficha eletrônica',
        'ficha individual',
        'fichas individuais',
      ],
    },
    {
      nome: 'Mini Combo',
      precoReferencia: 65.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '5 Fichas Eletronicas + 1 Dourada / R$ 65,00',
      sinonimos: ['mini combo', 'mini-combo', 'mini combo 5 fichas', 'combo mini'],
    },
    {
      nome: 'Big Combo',
      precoReferencia: 120.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '10 Fichas Eletronicas + 2 Douradas / R$ 120,00',
      sinonimos: ['big combo', 'big-combo', 'big combo 10 fichas', 'combo big'],
    },
    {
      nome: 'Mega Combo',
      precoReferencia: 250.0,
      tipo: 'Fichas' as TipoVenda,
      desc: '20 Fichas Eletronicas + 5 Douradas / R$ 250,00',
      sinonimos: ['mega combo', 'mega-combo', 'mega combo 20 fichas', 'combo mega'],
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
 * Identifica o Item Oficial e o Tipo de Venda baseado nas regras do catálogo
 */
export function identificarItemECategoria(itemRaw: string): {
  itemOficial: string;
  tipoVenda: TipoVenda;
  precoReferencia?: number;
} {
  const norm = normalizeText(itemRaw);

  // 1. Checa Boliche
  for (const cat of CATALOGO_VOLUX.boliche) {
    if (cat.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
      return { itemOficial: cat.nome, tipoVenda: 'Boliche', precoReferencia: cat.precoReferencia };
    }
  }

  // 2. Checa Fichas (combos primeiro para evitar colisão com "fichas eletronicas")
  const mega = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Mega Combo')!;
  if (mega.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: mega.nome, tipoVenda: 'Fichas', precoReferencia: mega.precoReferencia };
  }

  const big = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Big Combo')!;
  if (big.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: big.nome, tipoVenda: 'Fichas', precoReferencia: big.precoReferencia };
  }

  const mini = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Mini Combo')!;
  if (mini.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: mini.nome, tipoVenda: 'Fichas', precoReferencia: mini.precoReferencia };
  }

  const fichas = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Fichas Eletronicas')!;
  if (fichas.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: fichas.nome, tipoVenda: 'Fichas', precoReferencia: fichas.precoReferencia };
  }

  // Fallbacks contextuais se contiver termos-chave
  if (norm.includes('boliche') || norm.includes('pista')) {
    if (norm.includes('meia') || norm.includes('30') || norm.includes('1/2')) {
      return { itemOficial: 'Meia Hora de Boliche', tipoVenda: 'Boliche', precoReferencia: 70.0 };
    }
    return { itemOficial: 'Uma Hora de Boliche', tipoVenda: 'Boliche', precoReferencia: 120.0 };
  }

  if (norm.includes('ficha') || norm.includes('arcade') || norm.includes('eletronica')) {
    return { itemOficial: 'Fichas Eletronicas', tipoVenda: 'Fichas', precoReferencia: 12.0 };
  }

  const ehBoliche = /boliche|pista|calçado|calcado/i.test(itemRaw);
  const cleanItemName = stripTrailingAdmFlag(itemRaw.trim());
  return {
    itemOficial: cleanItemName || itemRaw.trim(),
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
  // Se tiver vírgula como decimal (padrão brasileiro: "49,00", "-17,90" ou "3.035,00")
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
 * Formata data extraída para o padrão "DD/MM"
 */
export function formatDataVolux(dataRaw: string): string {
  if (!dataRaw) return '05/10';
  const clean = dataRaw.trim();
  const match = clean.match(/(\d{2})\/(\d{2})(?:\/\d{2,4})?/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return clean;
}

/**
 * Formata hora extraída para o padrão "HH:MM"
 */
export function formatHoraVolux(horaRaw: string): string {
  if (!horaRaw) return '15:00';
  const clean = horaRaw.trim();
  const match = clean.match(/(\d{2}:\d{2})(?::\d{2})?/);
  if (match) {
    return match[1];
  }
  return clean;
}

/**
 * Normaliza o ID da Comanda (suporta códigos alfanuméricos do Volux como "A8126" e numéricos como "13.402.402")
 */
export function formatComandaId(idRaw: string): string {
  if (!idRaw) return '';
  const trimmed = idRaw.trim();
  const alphaMatch = trimmed.match(/^([A-Za-z]{1,3}\d{3,8})$/);
  if (alphaMatch) {
    return alphaMatch[1].toUpperCase();
  }

  const clean = trimmed.replace(/[^\d.]/g, '').trim();
  if (clean.includes('.')) {
    return clean;
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
 * Extrai o código da Comanda de uma linha do relatório Volux.
 * Suporta:
 * - Alfanumérico (ex: "A8126", "A8125", "B1020")
 * - Pontuado (ex: "13.402.402")
 * - Numérico de 6 a 9 dígitos ou numérico de 4 a 5 dígitos no início da linha
 */
export function extractComandaFromLine(line: string): string | null {
  if (!line) return null;
  const mainMatch = line.match(
    /(?:Comanda[:\s#]*)?(\b[A-Za-z]{1,3}\d{3,8}\b|\b\d{1,3}\.\d{3}\.\d{3}\b|\b\d{6,9}\b)/i
  );
  if (mainMatch) {
    return formatComandaId(mainMatch[1]);
  }
  const startNumMatch = line.match(/^\s*(?:Comanda[:\s#]*)?(\d{4,5})(?=\s)/i);
  if (startNumMatch) {
    return formatComandaId(startNumMatch[1]);
  }
  return null;
}

/**
 * Regex seguro para capturar valores monetários POSITIVOS e NEGATIVOS em formato brasileiro ou decimal.
 * Suporta valores negativos na coluna Total (ex: "-17,90", "-31,80", "R$ -17,90", "-R$ 17,90")
 * e separador de milhar (ex: "3.035,00") sem colidir com números de comanda ("13.402.402").
 */
const MONEY_GLOBAL_REGEX =
  /(?<![0-9.])((?:-\s*R\$\s*|R\$\s*-\s*|-|R\$\s*)?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,6}[.,]\d{2}))(?![0-9.,])/g;

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
    const line = lines[i];
    const norm = normalizeText(line);

    if (line === 'Comandas Canceladas' || /\bcomandas\s+canceladas\b/i.test(norm)) {
      isReadingCancelledSection = true;
      continue;
    }
    if (line === 'Comandas lançadas' || /\bcomandas\s+lancadas\b/i.test(norm)) {
      isReadingCancelledSection = false;
      continue;
    }

    // Ignora linhas de subtotal de cancelados ou descontos isolados
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

    // Ignora linhas que são itens normais de comanda
    const hasComandaAndTime =
      Boolean(extractComandaFromLine(line)) && /\b\d{2}:\d{2}\b/.test(line);
    if (hasComandaAndTime && !norm.includes('total') && !norm.includes('resumo')) {
      continue;
    }

    // 1. Alta prioridade: Total Líquido, Total Geral, Valor Total, Total do Relatório, Total Final, Total Esperado
    const isHighPriorityLabel =
      /(?:total\s+l[ií]quido|valor\s+l[ií]quido|total\s+geral|valor\s+total|total\s+do\s+relat[oó]rio|total\s+de\s+vendas|total\s+final|total\s+arrecadado|total\s+esperado|total\s+ativo)/i.test(
        line
      );

    // 2. Prioridade padrão: Linha de Total / Resumo no final do arquivo
    const isGenericTotalLabel =
      /^(?:resumo|total|totais|soma\s+total|valor\s+do\s+per[ií]odo|totalizador)\b/i.test(line) ||
      /\b(?:total\s*:|total\s+r\$)/i.test(line);

    if (isHighPriorityLabel || isGenericTotalLabel) {
      // Se for apenas um "Total:" genérico dentro da seção "Comandas Canceladas", ignora para não sobrescrever o total de lançadas
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
 * Extrai a Quantidade (Qtde) e o Valor Unitário real de uma linha do relatório Volux.
 * - Se a quantidade for >= 2 (ex: A8126 com Qtde 6), garante que o valor retornado seja o valor UNITÁRIO
 *   de cada item, para que o loop insira N itens somando o valor exato da linha.
 * - Se a coluna Total possuir valor negativo (ex: -17,90 ou -31,80), preserva o sinal negativo em `precoUnitario`
 *   para acionar a regra de estorno.
 */
export function extractQuantityAndUnitPrice(
  line: string,
  itemMatchText: string,
  precoReferencia?: number
): { quantidade: number; precoUnitario: number } {
  const lineWithoutAdm = stripTrailingAdmFlag(line);
  const { beforeItemText, afterItemText } = findItemSliceInLine(lineWithoutAdm, itemMatchText);

  // Remove eventuais datas/horas e códigos de comanda no trecho pós-item para não confundir com números
  const cleanAfterItem = stripTrailingAdmFlag(afterItemText)
    .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b[A-Za-z]{1,3}\d{3,8}\b/g, ' ');

  // Captura todos os valores com centavos (positivos ou negativos) no trecho após o item
  const afterMoneyMatches = [...cleanAfterItem.matchAll(MONEY_GLOBAL_REGEX)];
  let rawMoneyMatches = afterMoneyMatches.map((m) => parsePrecoVolux(m[1]));
  if (rawMoneyMatches.length === 0) {
    rawMoneyMatches = [...lineWithoutAdm.matchAll(MONEY_GLOBAL_REGEX)].map((m) =>
      parsePrecoVolux(m[1])
    );
  }

  if (rawMoneyMatches.length === 0) {
    return { quantidade: 1, precoUnitario: precoReferencia || 0 };
  }

  // Identifica se a linha possui valor monetário negativo (ex: -17,90, -31,80)
  const hasNegativeValue = rawMoneyMatches.some((v) => v < 0);
  // Trabalha com valores absolutos para cálculo preciso de razão/quantidade e aplica o sinal no retorno
  let prices = rawMoneyMatches.map((v) => Math.abs(v));

  // Trecho entre o nome do item e o último preço da linha (onde a coluna Qtde fica posicionada)
  const lastMoneyMatch =
    afterMoneyMatches.length > 0 ? afterMoneyMatches[afterMoneyMatches.length - 1] : null;
  const textBeforeLastPrice =
    lastMoneyMatch && lastMoneyMatch.index !== undefined
      ? cleanAfterItem.slice(0, lastMoneyMatch.index)
      : cleanAfterItem;

  // 1. Procura número inteiro isolado representando a coluna "Qtde" entre o Item e o Preço
  // Ex: "Cerveja Heineken Lata   6   15,90   95,40" ou "Cerveja Heineken Lata   2   -31,80" -> captura 6 ou 2
  const segmentWithoutMoney = textBeforeLastPrice.replace(MONEY_GLOBAL_REGEX, ' ');
  const intMatchesBeforePrice = [...segmentWithoutMoney.matchAll(/(?:^|\s)(-?\d{1,3})(?=\s|$)/g)]
    .map((m) => Math.abs(parseInt(m[1], 10)))
    .filter((n) => n >= 1 && n <= 100);

  let quantidade = 1;
  let foundExplicitQty = false;

  if (intMatchesBeforePrice.length > 0) {
    // Se houver mais de um inteiro, prioriza aquele que multiplicado pelo preço unitário bate com o total,
    // ou o último inteiro (imediatamente anterior à coluna de preço)
    if (intMatchesBeforePrice.length > 1 && prices.length >= 2) {
      const pLast = prices[prices.length - 1];
      const pPrev = prices[prices.length - 2];
      const matchingQty = intMatchesBeforePrice.find(
        (n) => Math.abs(n * pPrev - pLast) < 0.25
      );
      quantidade =
        matchingQty !== undefined
          ? matchingQty
          : intMatchesBeforePrice[intMatchesBeforePrice.length - 1];
    } else {
      quantidade = intMatchesBeforePrice[intMatchesBeforePrice.length - 1];
    }
    foundExplicitQty = true;
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
    // Ex: "6,00   95,40" onde 6,00 é a quantidade e 95,40 é o preço total ou unitário
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

  // 3. Caso a coluna Qtde esteja posicionada ANTES do nome do item (entre a Hora/Comanda e o Item)
  if (!foundExplicitQty && beforeItemText) {
    const cleanBefore = beforeItemText
      .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
      .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/\b[A-Za-z]{1,3}\d{3,8}\b/g, ' ')
      .replace(/\b\d{1,3}\.\d{3}\.\d{3}\b/g, ' ')
      .replace(/\b\d{4,9}\b/g, ' ');
    const intBefore = [...cleanBefore.matchAll(/(?:^|\s)(-?\d{1,2})(?=\s|$)/g)]
      .map((m) => Math.abs(parseInt(m[1], 10)))
      .filter((n) => n >= 1 && n <= 50);
    if (intBefore.length > 0) {
      quantidade = intBefore[intBefore.length - 1];
      foundExplicitQty = true;
    }
  }

  // 4. Se não encontrou inteiro explícito, mas há 2 preços (Unitário e Total) onde Total é múltiplo exato >= 2 do Unitário
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

  // Determina o Valor Unitário exato
  if (quantidade <= 1) {
    const precoUnitario = prices[prices.length - 1];
    return { quantidade: 1, precoUnitario: applySign(precoUnitario) };
  }

  // Quando quantidade >= 2:
  if (prices.length >= 2) {
    const pLast = prices[prices.length - 1];
    const pPrev = prices[prices.length - 2];

    // Se a última coluna for o Total da Linha (pPrev * quantidade == pLast, ex: 6 | 15,90 | 95,40 ou 2 | 15,90 | -31,80)
    if (Math.abs(pPrev * quantidade - pLast) < 0.25) {
      return { quantidade, precoUnitario: applySign(pPrev) };
    }

    // Se a última coluna for um total com desconto e pPrev for o preço de tabela (ex: 2 | 70,00 | 110,00 -> 2 de 55,00)
    if (
      (precoReferencia && pLast > precoReferencia * 1.15 && Math.abs(pPrev - precoReferencia) < 0.25) ||
      pLast > pPrev * 1.2
    ) {
      return { quantidade, precoUnitario: applySign(Number((pLast / quantidade).toFixed(2))) };
    }

    // Caso contrário, pLast já é o próprio Valor Unitário
    return { quantidade, precoUnitario: applySign(pLast) };
  }

  // Apenas 1 preço na linha (prices.length === 1, ex: coluna Total "95,40" para Qtde 6, ou "-31,80" para Qtde 2)
  const pOnly = prices[0];
  if (precoReferencia && Math.abs(pOnly - precoReferencia) < 0.05) {
    // Se o preço único já é exatamente o preço unitário de referência
    return { quantidade, precoUnitario: applySign(pOnly) };
  }

  // Quando há apenas a coluna Total na linha do PDF e Qtde >= 2, divide o Total pela quantidade para obter o unitário
  return { quantidade, precoUnitario: applySign(Number((pOnly / quantidade).toFixed(2))) };
}

export interface VoluxReconciliationResult {
  vendas: VendaComanda[];
  totalExtraido: number;
  totalEsperado: number | null;
  hasDiscrepancy: boolean;
  diferenca: number;
  unmatchedLines: string[];
}

export interface VoluxAeBReconciliationResult {
  vendas: VendaAeB[];
  totalExtraido: number;
  totalEsperado: number | null;
  hasDiscrepancy: boolean;
  diferenca: number;
  unmatchedLines: string[];
}

/**
 * Divide uma linha caso o PDF tenha concatenado duas comandas na mesma linha horizontal
 */
function splitMergedComandaLines(rawLines: string[]): string[] {
  const result: string[] = [];
  const multiComandaPattern =
    /(?=(\b(?:[A-Za-z]{1,3}\d{3,8}|\d{1,3}\.\d{3}\.\d{3})\b\s+\d{2}\/\d{2}))/g;

  for (const line of rawLines) {
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
 * Extrai posicionalmente o nome do item a partir do trecho anterior ao primeiro preço,
 * removendo comanda, datas, horários, quantidade isolada e flags ADM.
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
    .replace(/(?:Comanda[:\s#]*)?\b(?:[A-Za-z]{1,3}\d{3,8}|\d{1,3}\.\d{3}\.\d{3}|\d{6,9})\b/gi, ' ')
    .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\s+-?\d{1,3}\s*$/, ' ') // remove coluna Qtde no final do nome do item
    .replace(/^\s*-?\d{1,3}\s+/, ' ') // remove coluna Qtde se estiver no início
    .replace(/[-|:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripTrailingAdmFlag(segment);
}

/**
 * Parser completo com Sistema de Conciliação e Auditoria para Comandas (Boliche & Fichas)
 * Implementa:
 * 1. Identificação estrutural de seções ("Comandas lançadas" vs "Comandas Canceladas" via isReadingCancelledSection)
 * 2. Captura de valores monetários negativos na coluna Total (ex: -17,90, -31,80)
 * 3. Limpeza da falsa flag "ADM" ("S" ou "N" no final da linha)
 * 4. Multiplicação de itens com Qtde >= 2 (ex: A8126 com quantidade 6) via .push() múltiplo
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
    };
  }

  // Mapa de controle temporário para contar ocorrências de IDs idênticos por seção
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
  let lastData = '05/10';
  let lastHora = '15:00';
  let inSummarySection = false;
  // 1. Flag estrutural de leitura da seção "Comandas Canceladas"
  let isReadingCancelledSection = false;

  let totalLancado = 0;
  let totalCanceladoPdf = 0;

  for (const rawLine of lines) {
    const trimmedRaw = rawLine.trim();
    const normRaw = normalizeText(trimmedRaw);

    // 1. Identificação Estrutural de Cancelamentos ("Comandas lançadas" vs "Comandas Canceladas")
    if (
      trimmedRaw === 'Comandas Canceladas' ||
      /^comandas\s+canceladas\b/i.test(trimmedRaw) ||
      (!/^(?:total|subtotal|resumo)/i.test(normRaw) && /\bcomandas\s+canceladas\b/i.test(normRaw))
    ) {
      isReadingCancelledSection = true;
      inSummarySection = false;
      lastComanda = '';
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
      continue;
    }

    // 4. Limpeza da Falsa Flag "ADM" ("S" ou "N" no final da linha)
    const line = stripTrailingAdmFlag(trimmedRaw);
    const normLine = normalizeText(line);

    // Detecta início de bloco de Resumo/Totalizador no rodapé
    if (
      /^(?:resumo|total\s+geral|total\s+por\s+produto|total\s+por\s+item|totalizador|fim\s+do\s+relatorio)/i.test(
        normLine
      )
    ) {
      inSummarySection = true;
      continue;
    }

    // Ignora cabeçalhos de tabela e divisores
    if (
      /^[-=_*]{4,}$/.test(line) ||
      (/comanda/i.test(line) && /item|produto|descri/i.test(line) && /pre[cç]o|valor|total/i.test(line)) ||
      /^(?:sistema\s+volux|unidade:|filtro:|pagina\s+\d)/i.test(normLine)
    ) {
      continue;
    }

    const comandaExtracted = extractComandaFromLine(line);
    const dataMatch = line.match(/\b(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/);
    const horaMatch = line.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
    const precoMatches = [...line.matchAll(MONEY_GLOBAL_REGEX)];

    if (comandaExtracted) {
      lastComanda = comandaExtracted;
      inSummarySection = false;
    }
    if (dataMatch) {
      lastData = formatDataVolux(dataMatch[1]);
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
      const dataStr = dataMatch ? formatDataVolux(dataMatch[1]) : lastData;
      const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : lastHora;

      const { quantidade, precoUnitario } = extractQuantityAndUnitPrice(
        line,
        matchedItemText,
        precoReferencia
      );

      // Cancelamento determinado ESTRITAMENTE pela seção "Comandas Canceladas", valor negativo ou palavra explícita CANCELADO
      const isCancelado =
        isReadingCancelledSection || precoUnitario < 0 || isLinhaCanceladaVolux(line);

      const precoAbsoluto = Math.abs(precoUnitario);
      const precoEfetivo = isCancelado ? 0 : precoAbsoluto;

      if (isCancelado) {
        totalCanceladoPdf = Number((totalCanceladoPdf + precoAbsoluto * quantidade).toFixed(2));
      } else {
        totalLancado = Number((totalLancado + precoAbsoluto * quantidade).toFixed(2));
      }

      const occMap = isCancelado ? cancelledOccurrences : launchedOccurrences;

      // REGRA DE QUANTIDADE (Qtde >= 2, ex: A8126 com Qtde 6): Faz loop inserindo N vezes cada unidade
      for (let q = 0; q < quantidade; q++) {
        const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);
        occMap[baseId] = (occMap[baseId] || 0) + 1;
        const idDeterministico = `${baseId}_${occMap[baseId]}`;

        vendas.push({
          id: idDeterministico,
          comanda: comandaCode,
          data: dataStr,
          hora: horaStr,
          tipo_venda: tipoVenda,
          item: itemOficial,
          preco: precoEfetivo,
          responsavel: '',
          cancelado: isCancelado,
          status: isCancelado ? 'Cancelado' : 'Ativo',
        });
      }
    } else if (precoMatches.length > 0 && !isTotalLine) {
      unmatchedLines.push(line);
    }
  }

  // =========================================================================
  // ESTRATÉGIA 2 (Fallback Multilinha): Caso pdfjs tenha quebrado cada coluna em uma linha separada
  // =========================================================================
  if (vendas.length === 0) {
    const blockPattern =
      /(?:Comanda[:\s#]*)?(\b[A-Za-z]{1,3}\d{3,8}\b|\b\d{1,3}\.\d{3}\.\d{3}\b|\b\d{6,9}\b)[\s\S]{1,120}?(\d{2}\/\d{2}(?:\/\d{2,4})?)[\s\S]{1,80}?(\d{2}:\d{2}(?::\d{2})?)[\s\S]{1,120}?(Meia Hora de Boliche|Uma Hora de Boliche|Mega Combo|Big Combo|Mini Combo|Fichas? Eletr[oô]nicas?)([\s\S]{1,80}?)(?:R\$\s*)?(-?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,6}[.,]\d{2}))/gi;

    const cancelledHeaderIdx = text.search(/\bComandas\s+Canceladas\b/i);
    let match: RegExpExecArray | null;
    while ((match = blockPattern.exec(text)) !== null) {
      const comandaRaw = match[1];
      const dataRaw = match[2];
      const horaRaw = match[3];
      const itemRaw = match[4];
      const fullSnippet = stripTrailingAdmFlag(match[0]);

      const { itemOficial, tipoVenda, precoReferencia } = identificarItemECategoria(itemRaw);
      const comandaCode = formatComandaId(comandaRaw);
      const dataStr = formatDataVolux(dataRaw);
      const horaStr = formatHoraVolux(horaRaw);

      const { quantidade, precoUnitario } = extractQuantityAndUnitPrice(
        fullSnippet,
        itemRaw,
        precoReferencia
      );

      const inCancelledPart =
        cancelledHeaderIdx !== -1 && (match.index || 0) >= cancelledHeaderIdx;
      const isCancelado =
        inCancelledPart || precoUnitario < 0 || isLinhaCanceladaVolux(fullSnippet);
      const precoAbsoluto = Math.abs(precoUnitario);
      const precoEfetivo = isCancelado ? 0 : precoAbsoluto;

      if (isCancelado) {
        totalCanceladoPdf = Number((totalCanceladoPdf + precoAbsoluto * quantidade).toFixed(2));
      } else {
        totalLancado = Number((totalLancado + precoAbsoluto * quantidade).toFixed(2));
      }

      const occMap = isCancelado ? cancelledOccurrences : launchedOccurrences;

      for (let q = 0; q < quantidade; q++) {
        const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);
        occMap[baseId] = (occMap[baseId] || 0) + 1;
        const idDeterministico = `${baseId}_${occMap[baseId]}`;

        vendas.push({
          id: idDeterministico,
          comanda: comandaCode,
          data: dataStr,
          hora: horaStr,
          tipo_venda: tipoVenda,
          item: itemOficial,
          preco: precoEfetivo,
          responsavel: '',
          cancelado: isCancelado,
          status: isCancelado ? 'Cancelado' : 'Ativo',
        });
      }
    }
  }

  // Cálculo de Conciliação Financeira
  // Considera tanto o Total Lançado quanto o Total Líquido (Lançado - Cancelado no PDF)
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
  // Validação de conciliação: if (totalExtraido !== totalEsperado)
  const hasDiscrepancy =
    totalEsperado !== null && totalExtraido !== totalEsperado && diferenca > 0.05;

  // Log Detalhado no console para Auditoria do Desenvolvedor
  console.log('================================================================');
  console.log('[VOLUX AUDITORIA & CONCILIAÇÃO - COMANDAS / BOLICHE / FICHAS]');
  console.log(`Total de Registros Extraídos: ${vendas.length}`);
  console.log(`Total Comandas Lançadas: R$ ${totalLancado.toFixed(2)}`);
  console.log(`Total Comandas Canceladas (Estornos no PDF): R$ ${totalCanceladoPdf.toFixed(2)}`);
  console.log(`Valor Total Extraído (Conciliado): R$ ${totalExtraido.toFixed(2)}`);
  console.log(
    `Valor Total Esperado (Rodapé PDF): ${
      totalEsperado !== null ? `R$ ${totalEsperado.toFixed(2)}` : 'Não informado no rodapé'
    }`
  );
  if (hasDiscrepancy) {
    console.warn(
      `⚠️ DISCREPÂNCIA DETECTADA! Esperado: R$ ${totalEsperado?.toFixed(2)} | Extraído: R$ ${totalExtraido.toFixed(2)} | Diferença: R$ ${diferenca.toFixed(2)}`
    );
  }
  if (typeof console.table === 'function' && vendas.length > 0) {
    console.table(
      vendas.map((v, i) => ({
        '#': i + 1,
        Comanda: v.comanda,
        Data: v.data,
        Hora: v.hora,
        Item: v.item,
        'Preço (R$)': v.preco,
        Status: v.cancelado ? 'Cancelado (Estorno)' : 'Ativo',
        ID: v.id,
      }))
    );
  }
  if (unmatchedLines.length > 0) {
    console.log('Linhas com valores não associadas a vendas (para conferência):', unmatchedLines);
  }
  console.log('================================================================');

  return {
    vendas,
    totalExtraido,
    totalEsperado,
    hasDiscrepancy,
    diferenca,
    unmatchedLines,
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
 * horizontalmente (X) da esquerda para a direita para evitar fusão ou embaralhamento de linhas.
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

    // Agrupa os fragmentos em linhas pela coordenada Y (tolerância de 3 pontos para nunca fundir duas linhas)
    const rows: { y: number; items: TextFragment[] }[] = [];
    for (const frag of fragments) {
      let matchedRow = rows.find((r) => Math.abs(r.y - frag.y) <= 3);
      if (!matchedRow) {
        matchedRow = { y: frag.y, items: [] };
        rows.push(matchedRow);
      }
      matchedRow.items.push(frag);
    }

    // Ordena as linhas de cima para baixo (no PDF, Y cresce de baixo para cima)
    rows.sort((a, b) => b.y - a.y);

    // Dentro de cada linha, ordena as colunas da esquerda para a direita (X crescente)
    const pageLines = rows.map((row) => {
      row.items.sort((a, b) => a.x - b.x);
      return row.items.map((i) => i.str).join(' ');
    });

    fullText += pageLines.join('\n') + '\n\n';
  }

  return fullText;
}

/**
 * Amostra realística de relatório do sistema Volux para testes rápidos
 * Estrutura fiel com seções "Comandas lançadas" e "Comandas Canceladas", coluna ADM ("S"/"N"),
 * valores negativos na coluna Total e múltiplos itens na seção de lançadas.
 */
export const SAMPLE_VOLUX_REPORT_TEXT = `SISTEMA VOLUX - RELATÓRIO OPERACIONAL DE VENDAS POR COMANDA
Unidade: StrikeZone Bowling Center  Data Emissão: 06/10/2026 23:45
Filtro: Vendas de Pistas e Fichas Eletrônicas

Comandas lançadas
========================================================================================================
COMANDA       DATA       HORA     ITEM VENDIDO               Qtde  UNIT (R$)   TOTAL (R$)   ADM
--------------------------------------------------------------------------------------------------------
13.402.402    05/10/2026 15:03    Meia Hora de Boliche        1     70,00        49,00       N
13.402.403    05/10/2026 15:20    Mini Combo                  1     65,00        65,00       N
13.402.404    05/10/2026 15:45    Uma Hora de Boliche         1    120,00       120,00       S
13.402.405    05/10/2026 16:15    Fichas Eletronicas          2     12,00        24,00       N
13.402.406    05/10/2026 17:00    Big Combo                   1    120,00       120,00       N
13.402.407    05/10/2026 17:40    Mega Combo                  1    250,00       250,00       S
13.402.408    05/10/2026 18:10    Uma Hora de Boliche         1    120,00       110,00       N
13.402.409    06/10/2026 14:15    Meia Hora de Boliche        1     70,00        70,00       N
13.402.410    06/10/2026 14:50    Mini Combo                  1     65,00        65,00       N
13.402.411    06/10/2026 15:30    Uma Hora de Boliche         2    120,00       240,00       N
13.402.412    06/10/2026 16:05    Fichas Eletronicas          1     12,00        12,00       S
13.402.413    06/10/2026 16:45    Big Combo                   1    120,00       120,00       N
13.402.414    06/10/2026 17:25    Mega Combo                  1    250,00       250,00       N
13.402.415    06/10/2026 18:00    Meia Hora de Boliche        1     70,00        55,00       N
13.402.416    06/10/2026 18:30    Uma Hora de Boliche         1    120,00       120,00       N
13.402.417    06/10/2026 19:15    Meia Hora de Boliche        2     70,00       140,00       S

Comandas Canceladas
--------------------------------------------------------------------------------------------------------
13.402.416    06/10/2026 18:45    Uma Hora de Boliche         1    120,00      -120,00       N
========================================================================================================
RESUMO DO RELATÓRIO VOLUX
Total Cancelado: R$ -120,00
Valor Total Líquido: R$ 1.690,00
========================================================================================================
FIM DO RELATÓRIO VOLUX
`;

/**
 * Sugestões comuns de itens para o módulo Alimentos e Bebidas (AeB) baseadas no catálogo oficial Volux
 */
export const SUGESTOES_AEB = CATALOGO_AEB_PRODUTOS.map((p) => p.nome);

/**
 * Parser exclusivo com Sistema de Conciliação e Auditoria para relatórios Volux Alimentos e Bebidas (AeB).
 * Implementa:
 * 1. Identificação estrutural de seções ("Comandas lançadas" vs "Comandas Canceladas" via isReadingCancelledSection)
 * 2. Captura de valores monetários negativos na coluna Total (ex: -17,90, -31,80)
 * 3. Limpeza da falsa flag "ADM" ("S" ou "N" no final da linha)
 * 4. Multiplicação de itens com Qtde >= 2 (ex: A8126 com quantidade 6) via .push() múltiplo
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
    };
  }

  const launchedOccurrences: Record<string, number> = {};
  const cancelledOccurrences: Record<string, number> = {};
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = splitMergedComandaLines(rawLines);

  // Ordena produtos do catálogo do nome mais longo para o mais curto para match preciso
  const catalogoOrdenado = [...CATALOGO_AEB_PRODUTOS].sort(
    (a, b) => b.nome.length - a.nome.length
  );

  let lastComanda = '';
  let lastData = '05/10';
  let lastHora = '15:00';
  let inSummarySection = false;
  // 1. Flag estrutural de leitura da seção "Comandas Canceladas"
  let isReadingCancelledSection = false;

  let totalLancado = 0;
  let totalCanceladoPdf = 0;

  for (const rawLine of lines) {
    const trimmedRaw = rawLine.trim();
    const normRaw = normalizeText(trimmedRaw);

    // 1. Identificação Estrutural de Cancelamentos ("Comandas lançadas" vs "Comandas Canceladas")
    if (
      trimmedRaw === 'Comandas Canceladas' ||
      /^comandas\s+canceladas\b/i.test(trimmedRaw) ||
      (!/^(?:total|subtotal|resumo)/i.test(normRaw) && /\bcomandas\s+canceladas\b/i.test(normRaw))
    ) {
      isReadingCancelledSection = true;
      inSummarySection = false;
      lastComanda = '';
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
      continue;
    }

    // 4. Limpeza da Falsa Flag "ADM" ("S" ou "N" no final da linha)
    const line = stripTrailingAdmFlag(trimmedRaw);
    const normLine = normalizeText(line);

    if (
      /^(?:resumo|total\s+geral|total\s+por\s+produto|total\s+por\s+item|totalizador|fim\s+do\s+relatorio)/i.test(
        normLine
      )
    ) {
      inSummarySection = true;
      continue;
    }

    if (
      /^[-=_*]{4,}$/.test(line) ||
      (/comanda/i.test(line) && /item|produto|descri/i.test(line) && /pre[cç]o|valor|total/i.test(line)) ||
      /^(?:sistema\s+volux|unidade:|filtro:|pagina\s+\d)/i.test(normLine)
    ) {
      continue;
    }

    const comandaExtracted = extractComandaFromLine(line);
    const dataMatch = line.match(/\b(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/);
    const horaMatch = line.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
    const precoMatches = [...line.matchAll(MONEY_GLOBAL_REGEX)];

    if (comandaExtracted) {
      lastComanda = comandaExtracted;
      inSummarySection = false;
    }
    if (dataMatch) {
      lastData = formatDataVolux(dataMatch[1]);
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

    // 2. Se não está no catálogo padrão, extrai posicionalmente antes do primeiro preço
    if (
      !itemNome &&
      (Boolean(comandaExtracted) || Boolean(lastComanda)) &&
      precoMatches.length > 0
    ) {
      const candidate = extractPositionalItemName(line, precoMatches[0][0], comandaExtracted);
      if (candidate.length >= 2) {
        itemNome = candidate;
      }
    }

    if (
      itemNome &&
      precoMatches.length > 0 &&
      (Boolean(comandaExtracted) || Boolean(lastComanda))
    ) {
      const comandaCode = comandaExtracted || lastComanda;
      const dataStr = dataMatch ? formatDataVolux(dataMatch[1]) : lastData;
      const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : lastHora;

      const { quantidade, precoUnitario } = extractQuantityAndUnitPrice(
        line,
        itemNome,
        precoReferencia
      );

      // Cancelamento determinado ESTRITAMENTE pela seção "Comandas Canceladas", valor negativo ou palavra explícita CANCELADO
      const isCancelado =
        isReadingCancelledSection || precoUnitario < 0 || isLinhaCanceladaVolux(line);

      const precoAbsoluto = Math.abs(precoUnitario);
      const precoEfetivo = isCancelado ? 0 : precoAbsoluto;

      if (isCancelado) {
        totalCanceladoPdf = Number((totalCanceladoPdf + precoAbsoluto * quantidade).toFixed(2));
      } else {
        totalLancado = Number((totalLancado + precoAbsoluto * quantidade).toFixed(2));
      }

      const occMap = isCancelado ? cancelledOccurrences : launchedOccurrences;

      // REGRA DE QUANTIDADE (Qtde >= 2, como o A8126 com quantidade 6): loop para dar .push() múltiplo
      for (let q = 0; q < quantidade; q++) {
        const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemNome);
        occMap[baseId] = (occMap[baseId] || 0) + 1;
        const idDeterministico = `${baseId}_${occMap[baseId]}`;

        vendas.push({
          id: idDeterministico,
          comanda: comandaCode,
          data: dataStr,
          hora: horaStr,
          item: itemNome,
          preco: precoEfetivo,
          responsavel: '',
          cancelado: isCancelado,
          status: isCancelado ? 'Cancelado' : 'Ativo',
        });
      }
    } else if (precoMatches.length > 0 && !isTotalLine) {
      unmatchedLines.push(line);
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
  // Validação de conciliação: if (totalExtraido !== totalEsperado)
  const hasDiscrepancy =
    totalEsperado !== null && totalExtraido !== totalEsperado && diferenca > 0.05;

  console.log('================================================================');
  console.log('[VOLUX AUDITORIA & CONCILIAÇÃO - ALIMENTOS E BEBIDAS (AeB)]');
  console.log(`Total de Registros Extraídos: ${vendas.length}`);
  console.log(`Total Comandas Lançadas: R$ ${totalLancado.toFixed(2)}`);
  console.log(`Total Comandas Canceladas (Estornos no PDF): R$ ${totalCanceladoPdf.toFixed(2)}`);
  console.log(`Valor Total Extraído (Conciliado): R$ ${totalExtraido.toFixed(2)}`);
  console.log(
    `Valor Total Esperado (Rodapé PDF): ${
      totalEsperado !== null ? `R$ ${totalEsperado.toFixed(2)}` : 'Não informado no rodapé'
    }`
  );
  if (hasDiscrepancy) {
    console.warn(
      `⚠️ DISCREPÂNCIA DETECTADA EM AeB! Esperado: R$ ${totalEsperado?.toFixed(2)} | Extraído: R$ ${totalExtraido.toFixed(2)} | Diferença: R$ ${diferenca.toFixed(2)}`
    );
  }
  console.log('Lista completa de comandas e itens AeB extraídos:', vendas);
  if (typeof console.table === 'function' && vendas.length > 0) {
    console.table(
      vendas.map((v, i) => ({
        '#': i + 1,
        Comanda: v.comanda,
        Data: v.data,
        Hora: v.hora,
        Produto: v.item,
        'Preço Unit. (R$)': v.preco,
        Status: v.cancelado ? 'Cancelado (Estorno)' : 'Ativo',
        ID: v.id,
      }))
    );
  }
  if (unmatchedLines.length > 0) {
    console.log('Linhas não associadas (para conferência):', unmatchedLines);
  }
  console.log('================================================================');

  return {
    vendas,
    totalExtraido,
    totalEsperado,
    hasDiscrepancy,
    diferenca,
    unmatchedLines,
  };
}

export function parseVoluxAeBText(text: string): VendaAeB[] {
  return parseVoluxAeBTextWithReconciliation(text).vendas;
}

/**
 * Relatório exemplo para testes de Alimentos e Bebidas (AeB)
 * Inclui seções "Comandas lançadas" (ex: A8126 com Qtde = 6, coluna ADM "S"/"N")
 * e "Comandas Canceladas" com valores negativos (-17,90, -31,80).
 */
export const SAMPLE_VOLUX_AEB_REPORT_TEXT = `SISTEMA VOLUX - RELATÓRIO DE VENDAS · ALIMENTOS E BEBIDAS (AeB)
Unidade: StrikeZone Bowling Center  Data Emissão: 06/10/2026 23:50
Filtro: Setor Bar & Conveniência · Alimentos e Bebidas (AeB)

Comandas lançadas
========================================================================================================
COMANDA       DATA       HORA     ITEM PRODUTO                  Qtde  UNIT (R$)  TOTAL (R$)   ADM
--------------------------------------------------------------------------------------------------------
A8120         05/10/2026 15:10    Agua Mineral S/Gas Lata 350ml   1     9,90        9,90       N
A8121         05/10/2026 15:25    Coca Cola Lata 350Ml            2    11,90       23,80       N
A8122         05/10/2026 15:40    Cerveja Heineken Long Neck      1    17,90       17,90       S
A8123         05/10/2026 16:00    Suco Del Valle Lata Uva 290Ml   1    14,00       14,00       N
A8124         05/10/2026 16:30    Energetico Red Bull             1    19,90       19,90       N
A8125         05/10/2026 17:15    Salgadinho Doritos              1    10,90       10,90       N
A8126         06/10/2026 18:10    Cerveja Heineken Lata           6    15,90       95,40       S
A8127         06/10/2026 18:55    Guarana Antartica Lata 350Ml    1    11,90       11,90       N
A8128         06/10/2026 19:35    Café Expresso                   2     8,00       16,00       N

Comandas Canceladas
--------------------------------------------------------------------------------------------------------
A8122         05/10/2026 16:05    Cerveja Heineken Long Neck      1    17,90      -17,90       N
A8126         06/10/2026 18:40    Cerveja Heineken Lata           2    15,90      -31,80       N
A7990         01/10/2026 21:00    Energetico Red Bull             1    19,90      -19,90       N
========================================================================================================
RESUMO DO RELATÓRIO VOLUX AeB
Valor Total Lançado: R$ 219,70
========================================================================================================
FIM DO RELATÓRIO VOLUX AeB
`;

