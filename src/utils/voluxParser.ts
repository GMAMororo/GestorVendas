import * as pdfjsLib from 'pdfjs-dist';
import { VendaComanda, TipoVenda, VendaAeB } from '../types/venda';

// Configure pdf.js worker using unpkg / cdnjs fallback
try {
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Erro ao configurar worker do pdfjs-dist:', e);
}

/**
 * Gera identificador absolutamente único (UUID) para cada linha da tabela.
 * Evita colisões de chave no React e falhas de deleção quando a comanda contém múltiplos itens.
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
 * 
 * Garante anti-duplicação se o mesmo PDF for enviado múltiplas vezes e previne
 * colisão de IDs quando múltiplos itens idênticos são registrados na mesma comanda/minuto.
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
 * Identifica se a linha lida do relatório Volux representa um pedido cancelado ou estornado.
 * No sistema Volux, o cancelamento é indicado nas últimas colunas (geralmente com Data/Hora
 * do Cancelamento, flag "S" na coluna Cancelado, ou status CANCELADO / ESTORNO).
 */
export function isLinhaCanceladaVolux(line: string): boolean {
  if (!line || !line.trim()) return false;
  const upper = line.toUpperCase();

  // 1. Termos explícitos de cancelamento ou estorno
  if (
    upper.includes('CANCELAD') ||
    upper.includes('CANC.') ||
    upper.includes('ESTORN') ||
    upper.includes('ANULAD')
  ) {
    return true;
  }

  // 2. Coluna "Cancelado" preenchida com 'S', 'SIM' ou data/hora de cancelamento
  if (
    /\b(?:CANCELADO|CANCELADA|CANC)\b/i.test(line) ||
    /\|\s*S\s*\|/i.test(line) ||
    /\[(?:CANCELADO|CANCELADA|CANC|S)\]/i.test(line) ||
    /\s+S\s*(?:\d{2}\/\d{2}|\d{2}:\d{2}|$)/i.test(line) ||
    /(?:canc(?:elado)?|dt\.?\s*canc)\s*[:=]?\s*\d{2}\/\d{2}/i.test(line)
  ) {
    return true;
  }

  return false;
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
      sinonimos: ['meia hora de boliche', 'meia hora boliche', '1/2 hora boliche', '30 min boliche', '30 minutos de boliche'],
    },
    {
      nome: 'Uma Hora de Boliche',
      precoReferencia: 120.0,
      tipo: 'Boliche' as TipoVenda,
      sinonimos: ['uma hora de boliche', 'uma hora boliche', '1 hora boliche', '1h boliche', '60 min boliche', '60 minutos boliche'],
    },
  ],
  fichas: [
    {
      nome: 'Fichas Eletronicas',
      precoReferencia: 12.0,
      tipo: 'Fichas' as TipoVenda,
      desc: 'Fichas individuais / R$ 12,00',
      sinonimos: ['fichas eletronicas', 'ficha eletronica', 'fichas eletrônicas', 'ficha eletrônica', 'ficha individual'],
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
  // Mega Combo
  const mega = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Mega Combo')!;
  if (mega.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: mega.nome, tipoVenda: 'Fichas', precoReferencia: mega.precoReferencia };
  }

  // Big Combo
  const big = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Big Combo')!;
  if (big.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: big.nome, tipoVenda: 'Fichas', precoReferencia: big.precoReferencia };
  }

  // Mini Combo
  const mini = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Mini Combo')!;
  if (mini.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: mini.nome, tipoVenda: 'Fichas', precoReferencia: mini.precoReferencia };
  }

  // Fichas Eletronicas
  const fichas = CATALOGO_VOLUX.fichas.find((f) => f.nome === 'Fichas Eletronicas')!;
  if (fichas.sinonimos.some((s) => norm.includes(normalizeText(s)))) {
    return { itemOficial: fichas.nome, tipoVenda: 'Fichas', precoReferencia: fichas.precoReferencia };
  }

  // Fallbacks contextuais se contiver termos-chave
  if (norm.includes('boliche') || norm.includes('pista')) {
    if (norm.includes('meia') || norm.includes('30')) {
      return { itemOficial: 'Meia Hora de Boliche', tipoVenda: 'Boliche', precoReferencia: 70.0 };
    }
    return { itemOficial: 'Uma Hora de Boliche', tipoVenda: 'Boliche', precoReferencia: 120.0 };
  }

  if (norm.includes('ficha') || norm.includes('arcade') || norm.includes('eletronica')) {
    return { itemOficial: 'Fichas Eletronicas', tipoVenda: 'Fichas', precoReferencia: 12.0 };
  }

  // Se não coincidir exatamente, preserva o nome limpo e infere categoria
  const ehBoliche = /boliche|pista|calçado|calcado/i.test(itemRaw);
  return {
    itemOficial: itemRaw.trim(),
    tipoVenda: ehBoliche ? 'Boliche' : 'Fichas',
  };
}

/**
 * Converte string de preço (ex: "49,00", "120.00", "R$ 49,00") para número decimal
 */
export function parsePrecoVolux(precoRaw: string): number {
  if (!precoRaw) return 0;
  // Limpa R$, espaços e caracteres estranhos
  const clean = precoRaw
    .replace(/[R$\s]/gi, '')
    .trim();

  // Se tiver vírgula como decimal (padrão brasileiro: "49,00" ou "1.250,00")
  if (clean.includes(',')) {
    const semMilhar = clean.replace(/\./g, '');
    const comPonto = semMilhar.replace(',', '.');
    const valor = parseFloat(comPonto);
    return isNaN(valor) ? 0 : valor;
  }

  // Se já for com ponto decimal (ex: "49.00")
  const valor = parseFloat(clean);
  return isNaN(valor) ? 0 : valor;
}

/**
 * Formata data extraída para o padrão "DD/MM"
 */
export function formatDataVolux(dataRaw: string): string {
  if (!dataRaw) return '05/10';
  const clean = dataRaw.trim();
  // Se vier com ano: "05/10/2026" ou "05/10/26"
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
 * Normaliza o ID da Comanda (ex: "13402402" -> "13.402.402")
 */
export function formatComandaId(idRaw: string): string {
  const clean = idRaw.replace(/[^\d.]/g, '').trim();
  if (clean.includes('.')) {
    return clean;
  }
  // Se veio sem pontos e tem 8 dígitos: "13402402" -> "13.402.402"
  if (clean.length === 8) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  }
  return clean;
}

/**
 * Parser de Texto Bruto do Volux:
 * Suporta múltiplos formatos gerados pelo Volux (bloco, tabular, linha única)
 */
export function parseVoluxText(text: string): VendaComanda[] {
  const vendas: VendaComanda[] = [];
  if (!text || !text.trim()) return vendas;

  // Lista de itens conhecidos para busca com regex
  // Mapa de controle temporário para contar ocorrências de IDs idênticos no mesmo relatório
  // Evita colisão quando múltiplos itens idênticos ocorrem na mesma comanda/minuto (ex: 2x Meia Hora)
  const occurrences: Record<string, number> = {};

  const itensConhecidos = [
    'Meia Hora de Boliche',
    'Uma Hora de Boliche',
    'Mega Combo',
    'Big Combo',
    'Mini Combo',
    'Fichas Eletronicas',
    'Fichas Eletrônicas',
  ];

  // =========================================================================
  // ESTRATÉGIA 1: Linhas ou blocos que contenham Comanda + Data + Hora + Item + Preço
  // Ex: "13.402.402 05/10/2026 15:03:00 Meia Hora de Boliche 1 49,00"
  // Ex: "Comanda: 13.402.402 Data: 05/10 Hora: 15:03 Item: Mini Combo Valor: 65,00"
  // =========================================================================

  // Quebra por linhas limpas
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Procura comanda com formato xx.xxx.xxx ou similar
    const comandaMatch = line.match(/(?:Comanda[:\s#]*)?(\d{2}\.\d{3}\.\d{3}|\b\d{7,8}\b)/i);
    // Procura data DD/MM ou DD/MM/AAAA
    const dataMatch = line.match(/\b(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/);
    // Procura hora HH:MM ou HH:MM:SS
    const horaMatch = line.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
    // Procura preço no final ou com R$ (ex: 49,00 ou 120.00)
    const precoMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,4}[.,]\d{2})/g)];

    if (comandaMatch && (dataMatch || horaMatch) && precoMatches.length > 0) {
      // Identifica o item presente na linha
      let matchedItem = '';
      for (const itemNome of itensConhecidos) {
        if (normalizeText(line).includes(normalizeText(itemNome))) {
          matchedItem = itemNome;
          break;
        }
      }

      // Se não achou pelos conhecidos, tenta extrair o trecho entre a hora e o preço
      if (!matchedItem && horaMatch) {
        const horaIdx = line.indexOf(horaMatch[0]);
        const posHora = line.slice(horaIdx + horaMatch[0].length);
        const precoUltimo = precoMatches[precoMatches.length - 1][0];
        const precoIdx = posHora.lastIndexOf(precoUltimo);
        if (precoIdx > 0) {
          matchedItem = posHora.slice(0, precoIdx).replace(/[-|:]/g, ' ').trim();
        }
      }

      if (matchedItem) {
        // Pega o último preço da linha (geralmente é o Total Líquido / Preço Praticado)
        const precoStr = precoMatches[precoMatches.length - 1][1];
        const precoFinal = parsePrecoVolux(precoStr);
        const { itemOficial, tipoVenda } = identificarItemECategoria(matchedItem);
        const comandaCode = formatComandaId(comandaMatch[1]);
        const dataStr = dataMatch ? formatDataVolux(dataMatch[1]) : '05/10';
        const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : '15:00';
        const isCancelado = isLinhaCanceladaVolux(line);

        // Gera ID determinístico com contador de ocorrências sequencial (_1, _2, etc.)
        const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);
        occurrences[baseId] = (occurrences[baseId] || 0) + 1;
        const idDeterministico = `${baseId}_${occurrences[baseId]}`;

        vendas.push({
          id: idDeterministico,
          comanda: comandaCode,
          data: dataStr,
          hora: horaStr,
          tipo_venda: tipoVenda,
          item: itemOficial,
          preco: precoFinal, // REGRA DE OURO: Preço exato lido no relatório
          responsavel: '',
          cancelado: isCancelado,
        });
      }
    }
  }

  // =========================================================================
  // ESTRATÉGIA 2: Blocos estruturados com quebras de linha entre os campos
  // Ocorre comumente quando pdfjs extrai cada campo em uma linha diferente
  // =========================================================================
  if (vendas.length === 0) {
    // Regex global procurando padrões com grupos
    const blockPattern = /(?:Comanda[:\s#]*)?(\d{2}\.\d{3}\.\d{3}|\b\d{7,8}\b)[\s\S]*?(\d{2}\/\d{2}(?:\/\d{2,4})?)[\s\S]*?(\d{2}:\d{2}(?::\d{2})?)[\s\S]*?(Meia Hora de Boliche|Uma Hora de Boliche|Mega Combo|Big Combo|Mini Combo|Fichas? Eletr[oô]nicas?)[\s\S]*?(?:R\$\s*)?(\d{1,4}[.,]\d{2})/gi;

    let match: RegExpExecArray | null;
    while ((match = blockPattern.exec(text)) !== null) {
      const comandaRaw = match[1];
      const dataRaw = match[2];
      const horaRaw = match[3];
      const itemRaw = match[4];
      const precoRaw = match[5];

      const { itemOficial, tipoVenda } = identificarItemECategoria(itemRaw);
      const precoFinal = parsePrecoVolux(precoRaw);
      const comandaCode = formatComandaId(comandaRaw);
      const dataStr = formatDataVolux(dataRaw);
      const horaStr = formatHoraVolux(horaRaw);
      const isCancelado = isLinhaCanceladaVolux(match[0]);

      const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);
      occurrences[baseId] = (occurrences[baseId] || 0) + 1;
      const idDeterministico = `${baseId}_${occurrences[baseId]}`;

      vendas.push({
        id: idDeterministico,
        comanda: comandaCode,
        data: dataStr,
        hora: horaStr,
        tipo_venda: tipoVenda,
        item: itemOficial,
        preco: precoFinal, // REGRA DE OURO
        responsavel: '',
        cancelado: isCancelado,
      });
    }
  }

  // =========================================================================
  // ESTRATÉGIA 3: Parser por varredura de itens e busca contextual de comanda/preço
  // =========================================================================
  if (vendas.length === 0) {
    // Procura cada menção aos itens do catálogo no texto
    const itemRegex = /(Meia Hora de Boliche|Uma Hora de Boliche|Mega Combo|Big Combo|Mini Combo|Fichas? Eletr[oô]nicas?)/gi;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(text)) !== null) {
      const startIdx = Math.max(0, itemMatch.index - 120);
      const endIdx = Math.min(text.length, itemMatch.index + 120);
      const snippet = text.slice(startIdx, endIdx);

      const comandaMatch = snippet.match(/(\d{2}\.\d{3}\.\d{3}|\b\d{7,8}\b)/);
      const dataMatch = snippet.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)/);
      const horaMatch = snippet.match(/(\d{2}:\d{2}(?::\d{2})?)/);
      const precoMatch = snippet.match(/(?:R\$\s*)?(\d{1,4}[.,]\d{2})/);

      if (comandaMatch && precoMatch) {
        const { itemOficial, tipoVenda } = identificarItemECategoria(itemMatch[0]);
        const precoFinal = parsePrecoVolux(precoMatch[1]);
        const comandaCode = formatComandaId(comandaMatch[1]);
        const dataStr = dataMatch ? formatDataVolux(dataMatch[1]) : '05/10';
        const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : '15:00';
        const isCancelado = isLinhaCanceladaVolux(snippet);

        const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemOficial);
        occurrences[baseId] = (occurrences[baseId] || 0) + 1;
        const idDeterministico = `${baseId}_${occurrences[baseId]}`;

        vendas.push({
          id: idDeterministico,
          comanda: comandaCode,
          data: dataStr,
          hora: horaStr,
          tipo_venda: tipoVenda,
          item: itemOficial,
          preco: precoFinal,
          responsavel: '',
          cancelado: isCancelado,
        });
      }
    }
  }

  // Deduplica usando o ID determinístico como chave absoluta
  const mapUnique = new Map<string, VendaComanda>();
  for (const v of vendas) {
    if (!mapUnique.has(v.id)) {
      mapUnique.set(v.id, v);
    } else if (v.cancelado) {
      // Se houver múltiplas ocorrências e uma estiver cancelada, prevalece o cancelamento
      mapUnique.set(v.id, v);
    }
  }

  return Array.from(mapUnique.values());
}

/**
 * Extrai texto completo de um arquivo PDF utilizando pdfjs-dist
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Carrega o documento PDF
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Concatena os fragmentos de texto respeitando quebras aproximadas
    let lastY: number | null = null;
    let pageText = '';

    for (const item of content.items as any[]) {
      if ('str' in item) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }

    fullText += pageText + '\n\n';
  }

  return fullText;
}

/**
 * Amostra realística de relatório do sistema Volux para testes rápidos
 * Inclui linha com cancelamento para validação do sistema anti-duplicação e cancelamentos
 */
export const SAMPLE_VOLUX_REPORT_TEXT = `SISTEMA VOLUX - RELATÓRIO OPERACIONAL DE VENDAS POR COMANDA
Unidade: StrikeZone Bowling Center  Data Emissão: 06/10/2026 23:45
Filtro: Vendas de Pistas e Fichas Eletrônicas

========================================================================================================
COMANDA       DATA       HORA     ITEM VENDIDO               QTD   REF (R$)   PREÇO FINAL (R$)  STATUS
--------------------------------------------------------------------------------------------------------
13.402.402    05/10/2026 15:03    Meia Hora de Boliche        1     70,00           49,00       PAGO [Promoção Happy Hour]
13.402.403    05/10/2026 15:20    Mini Combo                  1     65,00           65,00       PAGO
13.402.404    05/10/2026 15:45    Uma Hora de Boliche         1    120,00          120,00       PAGO
13.402.405    05/10/2026 16:15    Fichas Eletronicas          2     12,00           24,00       PAGO
13.402.406    05/10/2026 17:00    Big Combo                   1    120,00          120,00       PAGO
13.402.407    05/10/2026 17:40    Mega Combo                  1    250,00          250,00       PAGO
13.402.408    05/10/2026 18:10    Uma Hora de Boliche         1    120,00          110,00       PAGO [Desconto Fidelidade]
13.402.409    06/10/2026 14:15    Meia Hora de Boliche        1     70,00           70,00       PAGO
13.402.410    06/10/2026 14:50    Mini Combo                  1     65,00           65,00       PAGO
13.402.411    06/10/2026 15:30    Uma Hora de Boliche         2    120,00          240,00       PAGO
13.402.412    06/10/2026 16:05    Fichas Eletronicas          1     12,00           12,00       PAGO
13.402.413    06/10/2026 16:45    Big Combo                   1    120,00          120,00       PAGO
13.402.414    06/10/2026 17:25    Mega Combo                  1    250,00          250,00       PAGO
13.402.415    06/10/2026 18:00    Meia Hora de Boliche        1     70,00           55,00       PAGO [Cupom Parceria]
13.402.416    06/10/2026 18:30    Uma Hora de Boliche         1    120,00          120,00       CANCELADO [Cliente desistiu]
13.402.417    06/10/2026 19:15    Meia Hora de Boliche        1     70,00           70,00       PAGO
13.402.417    06/10/2026 19:15    Meia Hora de Boliche        1     70,00           70,00       PAGO
========================================================================================================
FIM DO RELATÓRIO VOLUX
`;

import { CATALOGO_AEB_PRODUTOS, buscarProdutoNoCatalogo } from '../data/catalogoAeB';
export { CATALOGO_AEB_PRODUTOS, buscarProdutoNoCatalogo };

/**
 * Sugestões comuns de itens para o módulo Alimentos e Bebidas (AeB) baseadas no catálogo oficial Volux
 */
export const SUGESTOES_AEB = CATALOGO_AEB_PRODUTOS.map((p) => p.nome);

/**
 * Parser exclusivo para relatórios Volux Alimentos e Bebidas (AeB)
 * Extrai Comanda, Data, Hora, Item e Preço Total com ID determinístico e detecção de cancelamentos
 */
export function parseVoluxAeBText(text: string): VendaAeB[] {
  const vendas: VendaAeB[] = [];

  if (!text || !text.trim()) return vendas;

  // Mapa de controle temporário para contar ocorrências de IDs idênticos no relatório AeB
  const occurrences: Record<string, number> = {};

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Detecta padrão de comanda: "13.402.501" ou 7-8 dígitos
    const comandaMatch = line.match(/(?:Comanda[:\s#]*)?(\d{2}\.\d{3}\.\d{3}|\b\d{7,8}\b)/i);
    const dataMatch = line.match(/\b(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/);
    const horaMatch = line.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
    const precoMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,4}[.,]\d{2})/g)];

    if (comandaMatch && (dataMatch || horaMatch) && precoMatches.length > 0) {
      // Extrai o trecho do Item: entre a hora (ou data) e o preço
      let itemNome = '';
      if (horaMatch) {
        const horaIdx = line.indexOf(horaMatch[0]);
        const posHora = line.slice(horaIdx + horaMatch[0].length);
        const precoUltimo = precoMatches[precoMatches.length - 1][0];
        const precoIdx = posHora.lastIndexOf(precoUltimo);
        if (precoIdx > 0) {
          itemNome = posHora
            .slice(0, precoIdx)
            .replace(/\b\d+\b/g, '') // remove quantidade numérica isolada (ex: " 1 ")
            .replace(/[-|:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }

      // Se não conseguiu extrair por posição, procura por palavras-chave comuns de bebidas e alimentos
      if (!itemNome) {
        for (const sug of SUGESTOES_AEB) {
          if (normalizeText(line).includes(normalizeText(sug))) {
            itemNome = sug;
            break;
          }
        }
      }

      // Se ainda não achou, fallback com nome limpo
      if (!itemNome) {
        const matches = line.match(/(?:Água|Agua|Refrigerante|Cerveja|Chopp|Suco|Energetico|Energético|Salgadinho|Chocolate|Chiclete|Café|Bebida|Alimento)[^,\n\r0-9]*/i);
        if (matches) {
          itemNome = matches[0].trim();
        } else {
          itemNome = 'Item AeB';
        }
      }

      const precoStr = precoMatches[precoMatches.length - 1][1];
      const precoFinal = parsePrecoVolux(precoStr);
      const comandaCode = formatComandaId(comandaMatch[1]);
      const dataStr = dataMatch ? formatDataVolux(dataMatch[1]) : '05/10';
      const horaStr = horaMatch ? formatHoraVolux(horaMatch[1]) : '15:00';
      const isCancelado = isLinhaCanceladaVolux(line);

      const baseId = generateBaseDeterministicPdfId(comandaCode, dataStr, horaStr, itemNome);
      occurrences[baseId] = (occurrences[baseId] || 0) + 1;
      const idDeterministico = `${baseId}_${occurrences[baseId]}`;

      vendas.push({
        id: idDeterministico,
        comanda: comandaCode,
        data: dataStr,
        hora: horaStr,
        item: itemNome,
        preco: precoFinal, // REGRA DE OURO: Preço absoluto lido no PDF
        responsavel: '',
        cancelado: isCancelado,
      });
    }
  }

  // Deduplica usando o ID determinístico como chave absoluta
  const mapUnique = new Map<string, VendaAeB>();
  for (const v of vendas) {
    if (!mapUnique.has(v.id)) {
      mapUnique.set(v.id, v);
    } else if (v.cancelado) {
      mapUnique.set(v.id, v);
    }
  }

  return Array.from(mapUnique.values());
}

/**
 * Relatório exemplo para testes de Alimentos e Bebidas (AeB)
 * Inclui linha com cancelamento para validação do sistema anti-duplicação e estornos
 */
export const SAMPLE_VOLUX_AEB_REPORT_TEXT = `SISTEMA VOLUX - RELATÓRIO DE VENDAS · ALIMENTOS E BEBIDAS (AeB)
Unidade: StrikeZone Bowling Center  Data Emissão: 06/10/2026 23:50
Filtro: Setor Bar & Conveniência · Alimentos e Bebidas (AeB)

========================================================================================================
COMANDA       DATA       HORA     ITEM PRODUTO               QTD   PREÇO UNIT  PREÇO TOTAL (R$)  STATUS
--------------------------------------------------------------------------------------------------------
13.402.501    05/10/2026 15:10    Agua Mineral S/Gas Lata 350ml 1    9,90            9,90       PAGO
13.402.502    05/10/2026 15:25    Coca Cola Lata 350Ml        2     11,90           23,80       PAGO
13.402.503    05/10/2026 15:40    Cerveja Heineken Long Neck  1     17,90           17,90       PAGO
13.402.504    05/10/2026 16:00    Suco Del Valle Lata Uva 290Ml 1   14,00           14,00       PAGO
13.402.505    05/10/2026 16:30    Energetico Red Bull         1     19,90           19,90       PAGO
13.402.506    05/10/2026 17:15    Salgadinho Doritos          1     10,90           10,90       PAGO
13.402.507    05/10/2026 17:50    Cerveja Amstel 350Ml        2     13,00           26,00       PAGO
13.402.508    06/10/2026 14:20    Chocolate Kit Kat           1      8,50            8,50       PAGO
13.402.509    06/10/2026 14:55    Guarana Antartica Lata 350Ml 1   11,90           11,90       PAGO
13.402.510    06/10/2026 15:35    Café Expresso               2      8,00           16,00       PAGO
13.402.511    06/10/2026 16:10    Cerveja Heineken Lata       2     15,90           31,80       PAGO
13.402.512    06/10/2026 17:00    Chicletes Trident           1      4,50            4,50       PAGO
13.402.513    06/10/2026 17:30    Cerveja Heineken Lata       1     15,90           15,90       CANCELADO [Estorno Solicitado]
========================================================================================================
FIM DO RELATÓRIO VOLUX AeB
`;

