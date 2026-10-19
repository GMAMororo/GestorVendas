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

