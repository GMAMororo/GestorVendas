import { FiltroTurno, FiltroTipo, VendaComanda, VendaAeB } from '../types/venda';
import { CATALOGO_AEB_PRODUTOS } from '../data/catalogoAeB';

/**
 * Format currency to Brazilian Real (R$)
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format decimal value
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

/**
 * Retorna a data de hoje no formato "YYYY-MM-DD" utilizando o timezone local do usuário.
 */
export function getTodayLocalISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte uma string de data do banco ("DD/MM", "DD/MM/YYYY" ou "YYYY-MM-DD")
 * para o formato ISO comparável "YYYY-MM-DD".
 */
export function recordDateToISO(recordDateStr: string, referenceYear?: number): string {
  if (!recordDateStr || !recordDateStr.trim()) return '';
  const trimmed = recordDateStr.trim();

  // Já está em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split('/');
  if (parts.length >= 2) {
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    let yyyy = referenceYear || new Date().getFullYear();
    if (parts[2]) {
      const parsedYear = parseInt(parts[2], 10);
      if (!isNaN(parsedYear)) {
        yyyy = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
      }
    }
    return `${yyyy}-${mm}-${dd}`;
  }

  return trimmed;
}

/**
 * Formata uma string ISO "YYYY-MM-DD" para "DD/MM/YYYY" para exibição amigável.
 */
export function formatISOToBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Verifica se a data do registro ("DD/MM" ou "DD/MM/YYYY") está dentro do intervalo [startDate, endDate] ("YYYY-MM-DD").
 * Se startDate e endDate estiverem vazios, retorna true (sem filtro de data).
 */
export function isDateWithinRange(
  recordDateStr: string,
  startDateISO: string,
  endDateISO: string
): boolean {
  if (!startDateISO && !endDateISO) return true;
  if (!recordDateStr || !recordDateStr.trim()) return false;

  const refYearStr = (startDateISO || endDateISO).slice(0, 4);
  const refYear = parseInt(refYearStr, 10) || new Date().getFullYear();

  const normalizedRecordISO = recordDateToISO(recordDateStr, refYear);
  if (!normalizedRecordISO) return false;

  let minISO = startDateISO || '0000-01-01';
  let maxISO = endDateISO || '9999-12-31';
  if (startDateISO && endDateISO && startDateISO > endDateISO) {
    minISO = endDateISO;
    maxISO = startDateISO;
  }

  return normalizedRecordISO >= minISO && normalizedRecordISO <= maxISO;
}

/**
 * Retorna qual conta ADM ("3000" ou "3030") foi utilizada no registro, ou null se não for conta ADM.
 */
export function getContaAdmCode(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): '3000' | '3030' | null {
  if (!v) return null;
  if (v.cancelado || v.status === 'Cancelado') return null;

  const contaAdmClean = String(v.contaAdm || '').trim();
  if (contaAdmClean === '3000' || contaAdmClean === '3030') {
    return contaAdmClean;
  }

  const espacoClean = String(v.espaco || '').trim();
  if (espacoClean === '3000' || espacoClean === '3030') {
    return espacoClean;
  }

  const comandaClean = String(v.comanda || '').trim();
  if (
    comandaClean === '3030' ||
    comandaClean.startsWith('3030_') ||
    comandaClean.startsWith('3030-') ||
    /\b3030\b/.test(comandaClean)
  ) {
    return '3030';
  }
  if (
    comandaClean === '3000' ||
    comandaClean.startsWith('3000_') ||
    comandaClean.startsWith('3000-') ||
    /\b3000\b/.test(comandaClean)
  ) {
    return '3000';
  }

  if (v.conta3000) {
    return '3000';
  }

  return null;
}

/**
 * Identifica se um registro pertence às Contas ADM 3000 ou 3030 (ADM = S / Espaço 3000 ou 3030 no Volux).
 */
export function isRegistroConta3000(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): boolean {
  return getContaAdmCode(v) !== null;
}

/**
 * Identifica se um registro é um Voucher (isVoucher: true, motivoOperacional: 'Voucher' ou observação/item contendo 'voucher').
 * Regra de Negócio:
 * - NÃO é cancelamento (entra na contagem de itens vendidos e desconta fichas físicas normalmente na Aba 2).
 * - NÃO é pagamento em dinheiro (não soma no Total Arrecadado em Dinheiro/Caixa).
 */
export function isRegistroVoucher(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): boolean {
  if (!v) return false;
  if (v.cancelado || v.status === 'Cancelado') return false;
  const itemNorm = String(v.item || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const obsNorm = String(v.observacao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (
    Boolean(v.isVoucher) ||
    v.motivoOperacional === 'Voucher' ||
    itemNorm.includes('voucher') ||
    obsNorm.includes('voucher')
  );
}

/**
 * Identifica se um registro (VendaComanda ou VendaAeB) é uma Cortesia
 * (seja lançado manualmente como Cortesia ou extraído das Contas ADM 3000 / 3030 do Volux).
 */
export function isRegistroCortesia(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): boolean {
  if (!v) return false;
  if (v.cancelado || v.status === 'Cancelado') return false;
  if (isRegistroVoucher(v) && !isRegistroConta3000(v)) return false;
  const itemNorm = String(v.item || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (
    Boolean(v.isCortesia) ||
    isRegistroConta3000(v) ||
    v.motivoOperacional === 'Cortesia' ||
    itemNorm.includes('cortesia')
  );
}

/**
 * Identifica se um registro é uma Manutenção de Fichas.
 */
export function isRegistroManutencao(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): boolean {
  if (!v) return false;
  if (v.cancelado || v.status === 'Cancelado') return false;
  const itemNorm = String(v.item || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (
    Boolean((v as Partial<VendaComanda>).isManutencao) ||
    v.motivoOperacional === 'Manutenção' ||
    itemNorm.includes('manutencao')
  );
}

/**
 * Retorna o preço de referência unitário do catálogo para um item.
 */
export function getPrecoReferenciaItem(itemName: string): number {
  const norm = (itemName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (norm.includes('meia hora') || norm.includes('30 min') || norm.includes('1/2 hora')) {
    return 70.0;
  }
  if (norm.includes('uma hora') || norm.includes('1 hora') || norm.includes('60 min')) {
    return 120.0;
  }
  if (norm.includes('mega combo')) {
    return 250.0;
  }
  if (norm.includes('big combo')) {
    return 120.0;
  }
  if (norm.includes('mini combo')) {
    return 65.0;
  }
  if (norm.includes('ficha')) {
    return 12.0;
  }

  for (const prod of CATALOGO_AEB_PRODUTOS) {
    const prodNorm = prod.nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (norm === prodNorm || norm.includes(prodNorm)) {
      return prod.preco;
    }
  }

  return 0;
}

/**
 * Retorna o valor não monetário de um registro pago com Voucher (ex: R$ 12,00, R$ 65,00, R$ 120,00).
 * Se o registro tiver preco > 0 salvo, usa esse valor; caso tenha sido zerado (R$ 0,00), usa o preço de referência do catálogo.
 */
export function getValorNaoMonetarioVoucher(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): number {
  if (!v || !isRegistroVoucher(v)) return 0;
  const qtde = Math.max(1, Number(v.qtde) || 1);
  const preco = Number(v.preco) || 0;
  if (preco > 0) return preco;
  const ref = getPrecoReferenciaItem(v.item || '');
  return Number((ref * qtde).toFixed(2));
}

/**
 * Retorna o valor monetário efetivo em dinheiro/caixa de uma venda:
 * - Cancelados: R$ 0,00
 * - Manutenção: R$ 0,00
 * - Vouchers: R$ 0,00 (não é pagamento em dinheiro; contabilizado separadamente como não monetário)
 * - Cortesia manual (sem Conta 3000): R$ 0,00
 * - Vendas Normais e Conta 3000 (ADM = S): soma o valor real do registro
 */
export function getValorMonetarioEfetivo(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): number {
  if (!v) return 0;
  if (v.cancelado || v.status === 'Cancelado') return 0;
  if (isRegistroManutencao(v)) return 0;
  if (isRegistroVoucher(v)) return 0;
  if (isRegistroCortesia(v) && !isRegistroConta3000(v) && (Number(v.preco) || 0) === 0) {
    return 0;
  }
  return Math.max(0, Number(v.preco) || 0);
}

/**
 * Filtra em cascata pelo Sub-filtro de "Item Específico" conforme a Categoria selecionada
 */
export function matchesSubItemFilter(
  venda: VendaComanda,
  _selectedTipo: FiltroTipo,
  selectedSubItem: string
): boolean {
  if (!selectedSubItem || selectedSubItem === 'Todos') {
    return true;
  }

  const itemNorm = (venda.item || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  switch (selectedSubItem) {
    case 'Meia Hora':
      return (
        itemNorm.includes('meia hora') ||
        itemNorm.includes('30 min') ||
        itemNorm.includes('1/2 hora')
      );
    case 'Uma Hora':
      return (
        itemNorm.includes('uma hora') ||
        itemNorm.includes('1 hora') ||
        itemNorm.includes('1h') ||
        itemNorm.includes('60 min')
      );

    case 'Avulsa/Eletrônica':
      return (
        (itemNorm.includes('ficha') &&
          (itemNorm.includes('eletronica') ||
            itemNorm.includes('avulsa') ||
            itemNorm.includes('individual') ||
            itemNorm.includes('jogos'))) &&
        !isRegistroManutencao(venda) &&
        !isRegistroCortesia(venda)
      );
    case 'Mini Combo':
      return itemNorm.includes('mini combo');
    case 'Big Combo':
      return itemNorm.includes('big combo');
    case 'Mega Combo':
      return itemNorm.includes('mega combo');
    case 'Voucher':
      return isRegistroVoucher(venda);
    case 'Manutenção':
      return isRegistroManutencao(venda);
    case 'Cortesia':
      return isRegistroCortesia(venda);

    default:
      return itemNorm.includes(
        selectedSubItem
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
      );
  }
}

/**
 * Ordenação Cronológica Real para datas no formato "DD/MM" (ou "DD/MM/YYYY").
 */
export function compareDatesChronologically(dateA: string, dateB: string): number {
  const partsA = (dateA || '').trim().split('/');
  const partsB = (dateB || '').trim().split('/');

  const dayA = parseInt(partsA[0], 10);
  const monthA = parseInt(partsA[1], 10);
  const yearA = partsA[2] ? parseInt(partsA[2], 10) : 0;

  const dayB = parseInt(partsB[0], 10);
  const monthB = parseInt(partsB[1], 10);
  const yearB = partsB[2] ? parseInt(partsB[2], 10) : 0;

  if (!isNaN(yearA) && !isNaN(yearB) && yearA !== yearB && yearA > 0 && yearB > 0) {
    return yearA - yearB;
  }

  if (!isNaN(monthA) && !isNaN(monthB) && monthA !== monthB) {
    return monthA - monthB;
  }

  if (!isNaN(dayA) && !isNaN(dayB) && dayA !== dayB) {
    return dayA - dayB;
  }

  return (dateA || '').localeCompare(dateB || '');
}

/**
 * Normaliza horário para o formato "HH:MM" com 2 dígitos (ex: "8:05" -> "08:05")
 */
export function normalizeHoraHHMM(horaRaw: string): string {
  if (!horaRaw) return '00:00';
  const match = horaRaw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return horaRaw.trim();
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  return `${hh}:${mm}`;
}

/**
 * Converte string de horário "HH:MM" para total de minutos desde 00:00 (0 a 1439)
 * para cálculo de proximidade temporal Math.abs(minutosPDF - minutosManual).
 */
export function horaToMinutes(horaRaw: string): number {
  if (!horaRaw) return 0;
  const match = horaRaw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (isNaN(hh) || isNaN(mm)) return 0;
  return hh * 60 + mm;
}

/**
 * REGRA OFICIAL DE TURNOS:
 * - Turno Manhã (09:00 às 15:59): todas as vendas registradas até 15:59 (incluindo aberturas às 08:xx / 06:00+).
 * - Turno Noite (16:00 às 23:00): todas as vendas registradas a partir de 16:00 até o fechamento da noite (aceitando até 23:59 ou < 06:00).
 */
export function getShiftFromHora(horaRaw: string): 'MANHA' | 'NOITE' {
  const hora = normalizeHoraHHMM(horaRaw);
  if (hora >= '06:00' && hora < '16:00') {
    return 'MANHA';
  }
  return 'NOITE';
}

/**
 * Verifica se duas datas ("DD/MM" ou "DD/MM/YYYY") representam o mesmo dia.
 */
export function areSameDateRecords(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  const partsA = dateA.trim().split('/');
  const partsB = dateB.trim().split('/');
  if (partsA.length < 2 || partsB.length < 2) {
    return dateA.trim() === dateB.trim();
  }
  const ddA = parseInt(partsA[0], 10);
  const mmA = parseInt(partsA[1], 10);
  const ddB = parseInt(partsB[0], 10);
  const mmB = parseInt(partsB[1], 10);
  if (ddA !== ddB || mmA !== mmB) return false;

  if (partsA[2] && partsB[2]) {
    const yyA = parseInt(partsA[2], 10);
    const yyB = parseInt(partsB[2], 10);
    const fullA = yyA < 100 ? 2000 + yyA : yyA;
    const fullB = yyB < 100 ? 2000 + yyB : yyB;
    return fullA === fullB;
  }
  return true;
}

/**
 * Identifica se o registro é de origem MANUAL (ou legado MANUAL-).
 */
export function isManualSaleRecord(
  v: Partial<VendaComanda> | Partial<VendaAeB>
): boolean {
  if (!v) return false;
  if (v.origem === 'MANUAL') return true;
  if (v.origem === 'PDF') return false;
  const idStr = String(v.id || '').trim();
  const comandaStr = String(v.comanda || '').trim();
  return idStr.startsWith('MANUAL-') || comandaStr.startsWith('MANUAL-');
}

/**
 * Compara dois registros por Data (cronológica real) e Hora ("HH:MM")
 */
export function compareDateTimeChronologically(
  a: { data: string; hora: string },
  b: { data: string; hora: string }
): number {
  const dateDiff = compareDatesChronologically(a.data, b.data);
  if (dateDiff !== 0) return dateDiff;
  return normalizeHoraHHMM(a.hora).localeCompare(normalizeHoraHHMM(b.hora));
}

/**
 * Regra Oficial de Filtragem por Turno:
 * - "Todos os Turnos": todos os horários
 * - "Manhã (09:00 às 15:59)" (ou legado "Manhã (08:00 às 15:59)"): getShiftFromHora(hora) === 'MANHA'
 * - "Noite (16:00 às 23:00)" (ou legado "Tarde/Noite (16:00 em diante)"): getShiftFromHora(hora) === 'NOITE'
 */
export function matchesTurnoFilter(horaRaw: string, turno: FiltroTurno | string): boolean {
  if (!turno || turno === 'Todos os Turnos') {
    return true;
  }

  const normTurno = turno
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const shift = getShiftFromHora(horaRaw);

  if (normTurno.includes('manha')) {
    return shift === 'MANHA';
  }

  if (normTurno.includes('noite') || normTurno.includes('tarde')) {
    return shift === 'NOITE';
  }

  return true;
}

/**
 * Export array of sales to CSV file
 */
export function exportToCSV(
  data: Array<{
    id: string;
    comanda?: string;
    data: string;
    hora: string;
    tipo_venda: string;
    item: string;
    qtde?: number;
    preco: number;
    responsavel: string;
    observacao?: string;
    conta3000?: boolean;
    contaAdm?: string;
    espaco?: string;
    isVoucher?: boolean;
    isCortesia?: boolean;
    isManutencao?: boolean;
  }>,
  filename = 'relatorio-comandas.csv'
) {
  const headers = [
    'ID / Comanda',
    'Conta ADM',
    'Data',
    'Hora',
    'Turno',
    'Tipo de Venda',
    'Item',
    'Qtde',
    'Modalidade',
    'Preço Efetivo Caixa (R$)',
    'Valor Face / Voucher (R$)',
    'Responsável',
    'Observação',
  ];
  const rows = data.map((item) => {
    const admCode = getContaAdmCode(item as any);
    const conta3000 = admCode ? `ADM ${admCode}` : 'Normal';
    const modalidade = isRegistroManutencao(item as any)
      ? 'Manutenção'
      : isRegistroVoucher(item as any)
      ? 'Voucher'
      : isRegistroCortesia(item as any)
      ? 'Cortesia'
      : 'Normal';
    const turno =
      getShiftFromHora(item.hora) === 'MANHA'
        ? 'Manhã (09:00 às 15:59)'
        : 'Noite (16:00 às 23:00)';
    const qtde = Math.max(1, Number(item.qtde) || 1);
    const valorCaixa = getValorMonetarioEfetivo(item as any);
    const valorFace = isRegistroVoucher(item as any)
      ? getValorNaoMonetarioVoucher(item as any)
      : item.preco;

    return [
      `"${item.comanda || item.id}"`,
      `"${conta3000}"`,
      `"${item.data}"`,
      `"${item.hora}"`,
      `"${turno}"`,
      `"${item.tipo_venda}"`,
      `"${item.item.replace(/"/g, '""')}"`,
      `"${qtde}"`,
      `"${modalidade}"`,
      `"${valorCaixa.toFixed(2).replace('.', ',')}"`,
      `"${valorFace.toFixed(2).replace('.', ',')}"`,
      `"${(item.responsavel || '').replace(/"/g, '""')}"`,
      `"${(item.observacao || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export full backup containing all current sales and shift closings in JSON format
 */
export function exportBackupJSON(
  backupData: {
    versao: string;
    dataExportacao: string;
    totalComandas: number;
    totalFechamentos: number;
    vendas: any[];
    fechamentos: any[];
  },
  filename?: string
) {
  const dateStr = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `backup-gestor-comandas-${dateStr}.json`;
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', finalFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
