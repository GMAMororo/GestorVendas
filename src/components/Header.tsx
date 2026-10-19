import React from 'react';
import {
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Receipt,
  Ticket,
  GlassWater,
  BarChart3,
} from 'lucide-react';
import { AppTab } from '../types/venda';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  totalRecords: number;
  filteredRecords: number;
  fechamentosCount: number;
  aebCount: number;
  onOpenNewSaleModal: () => void;
  onOpenNewAeBSaleModal?: () => void;
  onExportCSV: () => void;
  onOpenBackupModal: () => void;
  onClearAllData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  totalRecords,
  filteredRecords,
  fechamentosCount,
  aebCount,
  onOpenNewSaleModal,
  onOpenNewAeBSaleModal,
  onExportCSV,
  onOpenBackupModal,
  onClearAllData,
}) => {
  return (
    <header className="border-b border-neutral-200/80 bg-white sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar Row */}
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm shrink-0">
              SZ
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-semibold text-neutral-900 tracking-tight truncate">
                  Gestor de Vendas & Comandas
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/60">
                  Volux POS
                </span>
              </div>
              <p className="text-xs text-neutral-500 truncate hidden md:block">
                Painel integrado de relatórios operacionais e fechamento de fichas
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Backup Button (JSON/CSV) */}
            <button
              type="button"
              onClick={onOpenBackupModal}
              title="Exportar ou restaurar cópia de segurança dos dados"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:text-neutral-900 active:bg-neutral-100 transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
              <span>Backup (JSON/CSV)</span>
            </button>

            {activeTab === 'comandas' && (
              <>
                <button
                  type="button"
                  onClick={onExportCSV}
                  disabled={filteredRecords === 0}
                  title="Exportar lista visível para arquivo CSV"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 border border-neutral-200/80 rounded-lg hover:bg-neutral-200/70 hover:text-neutral-900 active:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-500" />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenNewSaleModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 active:bg-neutral-950 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Venda</span>
                </button>
              </>
            )}
            {activeTab === 'aeb' && (
              <button
                type="button"
                onClick={onOpenNewAeBSaleModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Venda (AeB)</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. Sistema de Abas (Navegação Principal) */}
        <div className="flex items-center gap-1 border-t border-neutral-100 pt-1 -mb-px overflow-x-auto no-scrollbar">
          {/* Aba 1: Comandas & Vendas */}
          <button
            type="button"
            onClick={() => onTabChange('comandas')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'comandas'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Comandas & Vendas</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono-tabular ${
              activeTab === 'comandas' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {totalRecords}
            </span>
          </button>

          {/* Aba 2: Controle Físico de Fichas */}
          <button
            type="button"
            onClick={() => onTabChange('controle_fichas')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'controle_fichas'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Controle Físico de Fichas</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono-tabular ${
              activeTab === 'controle_fichas' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {fechamentosCount}
            </span>
          </button>

          {/* Aba 3: Alimentos e Bebidas (AeB) */}
          <button
            type="button"
            onClick={() => onTabChange('aeb')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'aeb'
                ? 'border-blue-600 text-blue-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
            }`}
          >
            <GlassWater className={`w-4 h-4 ${activeTab === 'aeb' ? 'text-blue-600' : 'text-neutral-400'}`} />
            <span>Alimentos e Bebidas (AeB)</span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono-tabular ${
              activeTab === 'aeb' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {aebCount}
            </span>
          </button>

          {/* Aba 4: Relatórios */}
          <button
            type="button"
            onClick={() => onTabChange('relatorios')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'relatorios'
                ? 'border-purple-600 text-purple-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300'
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === 'relatorios' ? 'text-purple-600' : 'text-neutral-400'}`} />
            <span>Relatórios</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
              activeTab === 'relatorios' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}>
              BI
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
