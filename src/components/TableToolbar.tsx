import React, { useRef } from 'react';
import {
  Search,
  Filter,
  X,
  UserCheck,
  Calendar,
  Download,
  Clock,
  Upload,
  Layers,
} from 'lucide-react';
import {
  FiltroTipo,
  FiltroStatusResponsavel,
  FiltroTurno,
  FiltroSubItem,
} from '../types/venda';
import { getTodayLocalISO } from '../utils/formatters';

interface TableToolbarProps {
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  selectedTurno: FiltroTurno;
  onSelectTurno: (turno: FiltroTurno) => void;
  selectedTipo: FiltroTipo;
  onSelectTipo: (tipo: FiltroTipo) => void;
  selectedSubItem: FiltroSubItem;
  onSelectSubItem: (subItem: FiltroSubItem) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusResponsavel: FiltroStatusResponsavel;
  onSelectStatusResponsavel: (status: FiltroStatusResponsavel) => void;
  totalCount: number;
  filteredCount: number;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  onOpenQuickAssign: () => void;
  pendingAssignCount: number;
  onOpenBackupModal: () => void;
  onImportBackupJSON?: (file: File) => void;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  selectedTurno,
  onSelectTurno,
  selectedTipo,
  onSelectTipo,
  selectedSubItem,
  onSelectSubItem,
  searchTerm,
  onSearchChange,
  statusResponsavel,
  onSelectStatusResponsavel,
  totalCount,
  filteredCount,
  onClearFilters,
  hasActiveFilters,
  onOpenQuickAssign,
  pendingAssignCount,
  onOpenBackupModal,
  onImportBackupJSON,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Opções em cascata do Sub-filtro de "Item Específico" conforme Categoria selecionada
  const subItemOptions = React.useMemo(() => {
    if (selectedTipo === 'Boliche') {
      return [
        { value: 'Meia Hora' as FiltroSubItem, label: 'Meia Hora' },
        { value: 'Uma Hora' as FiltroSubItem, label: 'Uma Hora' },
        { value: 'Voucher' as FiltroSubItem, label: '🎟️ Voucher' },
      ];
    }
    if (selectedTipo === 'Fichas') {
      return [
        { value: 'Avulsa/Eletrônica' as FiltroSubItem, label: 'Avulsa/Eletrônica' },
        { value: 'Mini Combo' as FiltroSubItem, label: 'Mini Combo' },
        { value: 'Big Combo' as FiltroSubItem, label: 'Big Combo' },
        { value: 'Mega Combo' as FiltroSubItem, label: 'Mega Combo' },
        { value: 'Manutenção' as FiltroSubItem, label: 'Manutenção' },
        { value: 'Cortesia' as FiltroSubItem, label: 'Cortesia' },
        { value: 'Voucher' as FiltroSubItem, label: '🎟️ Voucher' },
      ];
    }
    if (selectedTipo === 'AeB') {
      return [
        { value: 'Cortesia' as FiltroSubItem, label: 'Cortesia' },
        { value: 'Voucher' as FiltroSubItem, label: '🎟️ Voucher' },
      ];
    }
    // Quando "Todos os Tipos" estiver selecionado, disponibiliza todas as opções
    return [
      { value: 'Meia Hora' as FiltroSubItem, label: 'Boliche: Meia Hora' },
      { value: 'Uma Hora' as FiltroSubItem, label: 'Boliche: Uma Hora' },
      { value: 'Avulsa/Eletrônica' as FiltroSubItem, label: 'Fichas: Avulsa/Eletrônica' },
      { value: 'Mini Combo' as FiltroSubItem, label: 'Fichas: Mini Combo' },
      { value: 'Big Combo' as FiltroSubItem, label: 'Fichas: Big Combo' },
      { value: 'Mega Combo' as FiltroSubItem, label: 'Fichas: Mega Combo' },
      { value: 'Manutenção' as FiltroSubItem, label: 'Fichas: Manutenção' },
      { value: 'Cortesia' as FiltroSubItem, label: 'Cortesia (Todos)' },
      { value: 'Voucher' as FiltroSubItem, label: '🎟️ Voucher (Todos)' },
    ];
  }, [selectedTipo]);

  const todayISO = getTodayLocalISO();
  const isAllDates = !startDate && !endDate;
  const isTodaySelected = startDate === todayISO && endDate === todayISO;

  return (
    <div className="bg-white rounded-t-xl border border-b-0 border-neutral-200/80 p-4 space-y-3">
      {/* Row 1: Primary Filters (Date Range, Turno, Search & Backup Actions) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 flex-1 flex-wrap">
          {/* 1. Calendário de Período (Date Range): Data Inicial e Data Final */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-neutral-50 border border-neutral-200/90 rounded-lg p-1.5">
            <div className="flex items-center gap-1.5 px-1.5 text-xs font-semibold text-neutral-600">
              <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span>Período:</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
              <div className="flex items-center gap-1">
                <label
                  htmlFor="comandas-start-date"
                  className="text-[11px] font-medium text-neutral-500 whitespace-nowrap pl-1"
                >
                  De:
                </label>
                <input
                  id="comandas-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  aria-label="Data Inicial"
                  className="w-full sm:w-auto bg-white border border-neutral-200 text-neutral-900 text-xs font-medium rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
                />
              </div>

              <div className="flex items-center gap-1">
                <label
                  htmlFor="comandas-end-date"
                  className="text-[11px] font-medium text-neutral-500 whitespace-nowrap pl-1"
                >
                  Até:
                </label>
                <input
                  id="comandas-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  aria-label="Data Final"
                  className="w-full sm:w-auto bg-white border border-neutral-200 text-neutral-900 text-xs font-medium rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
                />
              </div>

              {/* Atalhos Rápidos: Hoje / Todas as Datas */}
              <div className="flex items-center gap-1 pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    const today = getTodayLocalISO();
                    onStartDateChange(today);
                    onEndDateChange(today);
                  }}
                  title="Filtrar apenas vendas de hoje"
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    isTodaySelected
                      ? 'bg-neutral-900 text-white'
                      : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartDateChange('');
                    onEndDateChange('');
                  }}
                  title="Exibir registros de todas as datas"
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    isAllDates
                      ? 'bg-neutral-900 text-white'
                      : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}
                >
                  Todas
                </button>
              </div>
            </div>
          </div>

          {/* 2. Filtro de Turno Oficial (Manhã: 09:00 às 15:59 | Noite: 16:00 às 23:00) */}
          <div className="relative w-full md:w-auto md:min-w-[215px]">
            <Clock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedTurno}
              onChange={(e) => onSelectTurno(e.target.value as FiltroTurno)}
              aria-label="Filtrar por turno"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-medium bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all cursor-pointer"
            >
              <option value="Todos os Turnos">Todos os Turnos</option>
              <option value="Manhã (09:00 às 15:59)">Manhã (09:00 às 15:59)</option>
              <option value="Noite (16:00 às 23:00)">
                Noite (16:00 às 23:00)
              </option>
            </select>
          </div>

          {/* 3. Campo de Busca Textual */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por comanda, item ou responsável..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions: Atribuir Caixa, Backup (JSON) e Importar Backup */}
        <div className="flex flex-wrap items-center gap-2">
          {pendingAssignCount > 0 && (
            <button
              type="button"
              onClick={onOpenQuickAssign}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Atribuir Caixa ({pendingAssignCount} sem nome)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenBackupModal}
            title="Fazer download de backup ou restaurar dados salvos"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>Backup (JSON)</span>
          </button>

          {/* Botão Importar Backup */}
          {onImportBackupJSON && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportBackupJSON(file);
                    e.target.value = '';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Selecionar arquivo .json de backup para sincronizar dados"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Importar Backup</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Secondary Filters (Categoria, Sub-filtro Item Específico em Cascata, Status Responsável & Contadores) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-neutral-100">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Refinar:</span>
          </div>

          {/* 2. Filtro Principal de Categoria ("Todos os Tipos", "Boliche", "Fichas", "AeB") */}
          <select
            value={selectedTipo}
            onChange={(e) => {
              const newTipo = e.target.value as FiltroTipo;
              onSelectTipo(newTipo);
              onSelectSubItem('Todos');
            }}
            aria-label="Filtrar por Categoria"
            className="w-full md:w-auto px-2.5 py-1.5 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 focus:outline-none focus:border-neutral-400 cursor-pointer"
          >
            <option value="Todos">Todos os Tipos</option>
            <option value="Boliche">Boliche</option>
            <option value="Fichas">Fichas</option>
            <option value="AeB">AeB</option>
          </select>

          {/* 2. Sub-filtro em Cascata: "Item Específico" */}
          <div className="relative w-full md:w-auto">
            <Layers className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedSubItem}
              onChange={(e) => onSelectSubItem(e.target.value as FiltroSubItem)}
              aria-label="Filtrar por Item Específico"
              className="w-full md:w-auto pl-7 pr-6 py-1.5 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 focus:outline-none focus:border-neutral-400 cursor-pointer"
            >
              <option value="Todos">
                {selectedTipo === 'Boliche'
                  ? 'Item Específico (Todos Boliche)'
                  : selectedTipo === 'Fichas'
                  ? 'Item Específico (Todas Fichas)'
                  : selectedTipo === 'AeB'
                  ? 'Item Específico (Todos AeB)'
                  : 'Item Específico (Todos)'}
              </option>
              {subItemOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Status do Responsável */}
          <select
            value={statusResponsavel}
            onChange={(e) =>
              onSelectStatusResponsavel(e.target.value as FiltroStatusResponsavel)
            }
            aria-label="Filtrar por preenchimento do responsável"
            className="w-full md:w-auto px-2.5 py-1.5 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 focus:outline-none focus:border-neutral-400 cursor-pointer"
          >
            <option value="todos">Todos os Responsáveis</option>
            <option value="pendentes">Sem Responsável (Pendentes)</option>
            <option value="preenchidos">Com Responsável Preenchido</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/70 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>

        <div className="text-xs text-neutral-500 font-mono-tabular">
          Mostrando <strong className="text-neutral-900">{filteredCount}</strong> de{' '}
          <strong className="text-neutral-900">{totalCount}</strong> registros
        </div>
      </div>
    </div>
  );
};
