import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Download,
  Upload,
  ShieldCheck,
  FileText,
  AlertCircle,
  HardDrive,
  Database,
} from 'lucide-react';
import { VendaComanda, FechamentoTurnoFichas, VendaAeB } from '../types/venda';
import { exportBackupJSON, exportToCSV } from '../utils/formatters';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendas: VendaComanda[];
  fechamentos: FechamentoTurnoFichas[];
  aebSales?: VendaAeB[];
  onRestoreBackup: (
    vendas: VendaComanda[],
    fechamentos: FechamentoTurnoFichas[],
    aebSales?: VendaAeB[]
  ) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  vendas,
  fechamentos,
  aebSales = [],
  onRestoreBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const backupData = {
      versao: '2.1.0',
      dataExportacao: new Date().toISOString(),
      totalComandas: vendas.length,
      totalFechamentos: fechamentos.length,
      totalAeB: aebSales.length,
      vendas,
      fechamentos,
      aebSales,
    };
    exportBackupJSON(backupData);
  };

  const handleExportCSV = () => {
    exportToCSV(vendas, `backup-comandas-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let restoredVendas: VendaComanda[] = [];
        let restoredFechamentos: FechamentoTurnoFichas[] = [];
        let restoredAeB: VendaAeB[] = [];

        if (Array.isArray(parsed)) {
          // Arquivo contém apenas array de comandas
          restoredVendas = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.vendas)) {
            restoredVendas = parsed.vendas;
          }
          if (Array.isArray(parsed.fechamentos)) {
            restoredFechamentos = parsed.fechamentos;
          }
          if (Array.isArray(parsed.aebSales)) {
            restoredAeB = parsed.aebSales;
          }
        }

        if (
          restoredVendas.length === 0 &&
          restoredFechamentos.length === 0 &&
          restoredAeB.length === 0
        ) {
          throw new Error('O arquivo JSON não possui comandas, bebidas ou fechamentos válidos.');
        }

        onRestoreBackup(restoredVendas, restoredFechamentos, restoredAeB);
        onClose();
      } catch (err: any) {
        setErrorMsg(err.message || 'Arquivo de backup inválido. Certifique-se de usar um arquivo JSON gerado pelo sistema.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-lg border border-neutral-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Backup & Segurança dos Dados
              </h3>
              <p className="text-xs text-neutral-500">
                Garante que suas informações estejam seguras mesmo após limpar o navegador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* LocalStorage Status Card */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 shadow-2xs">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-900">
                  Armazenamento Local (LocalStorage Ativo)
                </div>
                <div className="text-[11px] text-neutral-500 font-mono-tabular">
                  {vendas.length} {vendas.length === 1 ? 'comanda salva' : 'comandas salvas'} · {fechamentos.length} {fechamentos.length === 1 ? 'fechamento' : 'fechamentos'} · {aebSales.length} {aebSales.length === 1 ? 'item Alimentos e Bebidas (AeB)' : 'itens Alimentos e Bebidas (AeB)'}
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              Sincronizado
            </span>
          </div>

          {/* Download Backup Section */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-semibold text-neutral-800">
              Exportar Cópia de Segurança (Recomendado ao fim do expediente)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Backup (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-500" />
                <span>Exportar Tabela (CSV)</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              O arquivo JSON contém a estrutura completa de comandas e fechamentos pronta para restauração.
            </p>
          </div>

          {/* Restore Backup Section */}
          <div className="space-y-2 pt-3 border-t border-neutral-100">
            <label className="block text-xs font-semibold text-neutral-800">
              Restaurar Dados a partir de um Backup (JSON)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-dashed border-neutral-300 hover:border-neutral-500 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-600" />
              <span>Selecionar Arquivo de Backup (.JSON)</span>
            </button>
            <p className="text-[11px] text-neutral-400">
              Restaura instantaneamente suas comandas e histórico salvos anteriormente.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
