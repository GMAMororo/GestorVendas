import React, { useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  Filter,
  Search,
  X,
  UserX,
  HardDrive,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  FiltroTipo,
  FiltroStatusResponsavel,
  FiltroTurno,
  FILTRO_TURNO_OPCOES,
} from '../types/venda';
import { compareDatesChronologically } from '../utils/formatters';

interface TableToolbarProps {
  availableDays: string[];
  selectedDay: string;
  onSelectDay: (day: string) => void;
  selectedTurno: FiltroTurno;
  onSelectTurno: (turno: FiltroTurno) => void;
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
  onImportBackupJSON?: (file: File) => void;
  onDeleteFilteredVendas?: () => void;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  availableDays,
  selectedDay,
  onSelectDay,
  selectedTurno,
  onSelectTurno,
  selectedTipo,
  onSelectTipo,
  searchTerm,
  onSearchChange,
  statusResponsavel,
  onSelectStatusResponsavel,
  filteredCount,
  onClearFilters,
  hasActiveFilters,
  onOpenQuickAssign,
  pendingAssignCount,
  onOpenBackupModal,
  onImportBackupJSON,
  onDeleteFilteredVendas,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Garante ordenação cronológica real (mês menor -> dia menor) antes de renderizar no <select>
  const sortedDays = useMemo(() => {
    return [...availableDays].sort(compareDatesChronologically);
  }, [availableDays]);

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
            Visualize vendas, filtre por data, turno e categoria e edite os operadores diretamente na tabela.
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

          {/* Importar Backup (Sincronização Manual) */}
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
                title="Importar arquivo .json para sincronizar o caixa do PC para o celular"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>Importar Backup</span>
              </button>
            </>
          )}

          {onDeleteFilteredVendas && (
            <button
              type="button"
              disabled={filteredCount === 0}
              onClick={onDeleteFilteredVendas}
              title="Excluir do banco local apenas as vendas exibidas neste filtro atual"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100/90 active:bg-red-200/80 border border-red-200/90 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Apagar Vendas Filtradas</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Row: Empilhado no celular (flex-col) e lado a lado no desktop (md:flex-row) */}
      <div className="flex flex-col md:flex-row md:items-center md:flex-wrap lg:flex-nowrap gap-2.5 pt-1 w-full">
        {/* Search Input */}
        <div className="w-full md:flex-1 min-w-[180px] relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar item, comanda ou operador..."
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

        {/* Filter by Day (Select) - Ordenado Cronologicamente */}
        <div className="w-full md:w-auto md:min-w-[140px] relative">
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
              className="w-full pl-9 pr-7 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              <option value="Todos">Todos os Dias ({sortedDays.length})</option>
              {sortedDays.map((day) => (
                <option key={day} value={day}>
                  Dia {day}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter by Turno (Select) - Ao lado do filtro de Datas */}
        <div className="w-full md:w-auto md:min-w-[170px] relative">
          <div className="relative">
            <label htmlFor="filter-turno" className="sr-only">
              Turno
            </label>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <Clock className="w-4 h-4" />
            </div>
            <select
              id="filter-turno"
              aria-label="Turno"
              value={selectedTurno}
              onChange={(e) => onSelectTurno(e.target.value as FiltroTurno)}
              className="w-full pl-9 pr-7 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              {FILTRO_TURNO_OPCOES.map((turnoOpt) => (
                <option key={turnoOpt} value={turnoOpt}>
                  {turnoOpt}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter by Tipo de Venda (Select) */}
        <div className="w-full md:w-auto md:min-w-[130px] relative">
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
              className="w-full pl-9 pr-7 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              <option value="Todos">Todos os Tipos</option>
              <option value="Boliche">Boliche</option>
              <option value="Fichas">Fichas</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter by Responsible Status */}
        <div className="w-full md:w-auto md:min-w-[160px] relative">
          <div className="relative">
            <label htmlFor="filter-status-responsavel" className="sr-only">
              Status do Responsável
            </label>
            <select
              id="filter-status-responsavel"
              value={statusResponsavel}
              onChange={(e) => onSelectStatusResponsavel(e.target.value as FiltroStatusResponsavel)}
              className="w-full px-3 pr-7 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 focus:bg-white transition-all cursor-pointer font-medium"
            >
              <option value="todos">Responsável: Todos</option>
              <option value="pendentes">Sem Responsável</option>
              <option value="preenchidos">Com Responsável</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
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
          {selectedTurno !== 'Todos os Turnos' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200/80">
              Turno: {selectedTurno}
              <button
                type="button"
                onClick={() => onSelectTurno('Todos os Turnos')}
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
