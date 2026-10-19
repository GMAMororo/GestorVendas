import React from 'react';
import {
  Calendar,
  Filter,
  Search,
  X,
  UserCheck,
  UserX,
  SlidersHorizontal,
  HardDrive,
} from 'lucide-react';
import { FiltroTipo, FiltroStatusResponsavel } from '../types/venda';

interface TableToolbarProps {
  availableDays: string[];
  selectedDay: string;
  onSelectDay: (day: string) => void;
  selectedTipo: FiltroTipo;
  onSelectTipo: (tipo: FiltroTipo) => void;
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
  onOpenBackupModal?: () => void;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  availableDays,
  selectedDay,
  onSelectDay,
  selectedTipo,
  onSelectTipo,
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
}) => {
  return (
    <div className="bg-white border border-neutral-200/90 rounded-t-xl p-4 sm:p-5 border-b-0 space-y-3.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Side: Section heading & counts */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">
              Relatório Detalhado de Comandas
            </h2>
            <span className="text-xs font-mono-tabular px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/60 font-medium">
              {filteredCount} {filteredCount === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Visualize vendas, filtre por período/categoria e edite os operadores diretamente na tabela.
          </p>
        </div>

        {/* Right Side: Quick actions */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {pendingAssignCount > 0 && (
            <button
              type="button"
              onClick={onOpenQuickAssign}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100/80 transition-colors cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {pendingAssignCount} {pendingAssignCount === 1 ? 'pendente' : 'pendentes'} · Atribuir em lote
              </span>
            </button>
          )}

          {onOpenBackupModal && (
            <button
              type="button"
              onClick={onOpenBackupModal}
              title="Salvar ou restaurar cópia de segurança completa em JSON"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-neutral-600" />
              <span>Backup (JSON)</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-1">
        {/* Search Input */}
        <div className="lg:col-span-4 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por item, comanda ou responsável..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by Day (Select) - Mandatory requirement */}
        <div className="lg:col-span-3 relative">
          <div className="relative">
            <label htmlFor="filter-day" className="sr-only">
              Filtrar por Dia
            </label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <Calendar className="w-4 h-4" />
            </div>
            <select
              id="filter-day"
              value={selectedDay}
              onChange={(e) => onSelectDay(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              <option value="Todos">Todos os Dias ({availableDays.length} dias)</option>
              {availableDays.map((day) => (
                <option key={day} value={day}>
                  Dia {day}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter by Tipo de Venda (Select) - Mandatory requirement */}
        <div className="lg:col-span-3 relative">
          <div className="relative">
            <label htmlFor="filter-tipo" className="sr-only">
              Filtrar por Tipo de Venda
            </label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <Filter className="w-4 h-4" />
            </div>
            <select
              id="filter-tipo"
              value={selectedTipo}
              onChange={(e) => onSelectTipo(e.target.value as FiltroTipo)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              <option value="Todos">Todos os Tipos</option>
              <option value="Boliche">Boliche</option>
              <option value="Fichas">Fichas</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter by Responsible Status */}
        <div className="lg:col-span-2 relative">
          <div className="relative">
            <label htmlFor="filter-status-responsavel" className="sr-only">
              Status do Responsável
            </label>
            <select
              id="filter-status-responsavel"
              value={statusResponsavel}
              onChange={(e) => onSelectStatusResponsavel(e.target.value as FiltroStatusResponsavel)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              <option value="todos">Responsável: Todos</option>
              <option value="pendentes">Sem Responsável</option>
              <option value="preenchidos">Com Responsável</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Active filters badge / clear indicator */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-100 text-xs">
          <span className="text-neutral-500 font-medium">Filtros aplicados:</span>
          {selectedDay !== 'Todos' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200/80">
              Dia: {selectedDay}
              <button
                type="button"
                onClick={() => onSelectDay('Todos')}
                className="hover:text-neutral-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedTipo !== 'Todos' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200/80">
              Tipo: {selectedTipo}
              <button
                type="button"
                onClick={() => onSelectTipo('Todos')}
                className="hover:text-neutral-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {statusResponsavel !== 'todos' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200/80">
              {statusResponsavel === 'pendentes' ? 'Sem Responsável' : 'Com Responsável'}
              <button
                type="button"
                onClick={() => onSelectStatusResponsavel('todos')}
                className="hover:text-neutral-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchTerm && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200/80">
              Busca: &ldquo;{searchTerm}&rdquo;
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="hover:text-neutral-950 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={onClearFilters}
            className="text-neutral-500 hover:text-neutral-900 underline font-medium ml-1 cursor-pointer"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}
    </div>
  );
};
