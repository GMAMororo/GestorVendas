import { FiltroTurno } from '../types/venda';

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
 * Ordenação Cronológica Real para datas no formato "DD/MM" (ou "DD/MM/YYYY").
 * Dá split('/') na string, converte dia e mês em números e compara mês primeiro e dia depois.
 * Exemplo: "19/09" -> "05/10" -> "06/10" -> "19/10".
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
 * Regra de Filtragem por Turno:
 * - "Todos os Turnos": todos os horários
 * - "Manhã (08:00 às 15:59)": hora >= "08:00" e < "16:00"
 * - "Tarde/Noite (16:00 em diante)": hora >= "16:00" (ou < "08:00" para cobrir a madrugada, se houver)
 */
export function matchesTurnoFilter(horaRaw: string, turno: FiltroTurno): boolean {
  if (!turno || turno === 'Todos os Turnos') {
    return true;
  }

  const hora = normalizeHoraHHMM(horaRaw);

  if (turno === 'Manhã (08:00 às 15:59)') {
    return hora >= '08:00' && hora < '16:00';
  }

  if (turno === 'Tarde/Noite (16:00 em diante)') {
    return hora >= '16:00' || hora < '08:00';
  }

  return true;
}

/**
 * Export array of sales to CSV file
 */
export function exportToCSV(data: Array<{
  id: string;
  data: string;
  hora: string;
  tipo_venda: string;
  item: string;
  preco: number;
  responsavel: string;
}>, filename = 'relatorio-comandas.csv') {
  const headers = ['ID Comanda', 'Data', 'Hora', 'Tipo de Venda', 'Item', 'Preço (R$)', 'Responsável'];
  const rows = data.map((item) => [
    `"${item.id}"`,
    `"${item.data}"`,
    `"${item.hora}"`,
    `"${item.tipo_venda}"`,
    `"${item.item.replace(/"/g, '""')}"`,
    `"${item.preco.toFixed(2).replace('.', ',')}"`,
    `"${(item.responsavel || '').replace(/"/g, '""')}"`,
  ]);

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
export function exportBackupJSON(backupData: {
  versao: string;
  dataExportacao: string;
  totalComandas: number;
  totalFechamentos: number;
  vendas: any[];
  fechamentos: any[];
}, filename?: string) {
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

