import React, { useState, useMemo } from 'react';
import {
  GlassWater,
  DollarSign,
  Calendar,
  Search,
  X,
  Plus,
  FileSpreadsheet,
  TrendingUp,
  Info,
} from 'lucide-react';
import { VendaAeB } from '../types/venda';
import { formatCurrencyBRL } from '../utils/formatters';
import { AeBUploadArea } from './AeBUploadArea';
import { AeBTable } from './AeBTable';

interface ImportResult {
  addedCount: number;
  addedValor: number;
  ignoredDuplicateCount: number;
  cancelledRemovedCount: number;
}

interface AeBTabProps {
  vendas: VendaAeB[];
  onUpdateResponsavel: (id: string, responsavel: string) => void;
  onEditVenda: (venda: VendaAeB) => void;
  onDeleteVenda: (id: string) => void;
  onDataLoaded: (novas: VendaAeB[], sourceName: string) => ImportResult | void;
  onOpenNewSaleModal: () => void;
  onExportCSV: () => void;
}

export const AeBTab: React.FC<AeBTabProps> = ({
  vendas,
  onUpdateResponsavel,
  onEditVenda,
  onDeleteVenda,
  onDataLoaded,
  onOpenNewSaleModal,
  onExportCSV,
}) => {
  const [selectedDay, setSelectedDay] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 5. Filtros da Aba AeB: Dropdown extraindo as datas únicas lançadas
  const availableDays = useMemo(() => {
    const daysSet = new Set<string>();
    vendas.forEach((v) => {
      if (v.data && v.data.trim()) {
        daysSet.add(v.data.trim());
      }
    });
    return Array.from(daysSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [vendas]);

  // Filtragem dos dados visíveis
  const filteredVendas = useMemo(() => {
    return vendas.filter((venda) => {
      if (selectedDay !== 'Todos' && venda.data !== selectedDay) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesItem = venda.item.toLowerCase().includes(query);
        const matchesId = venda.id.toLowerCase().includes(query);
        const matchesResp = (venda.responsavel || '').toLowerCase().includes(query);
        if (!matchesItem && !matchesId && !matchesResp) {
          return false;
        }
      }

      return true;
    });
  }, [vendas, selectedDay, searchTerm]);

  // 3. Cards de Resumo no topo desta aba: "Total Arrecadado (AeB)" e "Quantidade de Itens Vendidos"
  const totalArrecadado = useMemo(() => {
    return filteredVendas
      .filter((v) => !v.cancelado)
      .reduce((acc, curr) => acc + curr.preco, 0);
  }, [filteredVendas]);

  const quantidadeItens = filteredVendas.filter((v) => !v.cancelado).length;
  const ticketMedio = quantidadeItens > 0 ? totalArrecadado / quantidadeItens : 0;

  const hasActiveFilters = selectedDay !== 'Todos' || searchTerm.trim() !== '';

  const handleClearFilters = () => {
    setSelectedDay('Todos');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Context Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-neutral-200/80 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200/70">
            <GlassWater className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Módulo de Gestão · Alimentos e Bebidas (AeB)
            </h2>
            <p className="text-xs text-neutral-500">
              Controle isolado de vendas de bar, lanchonete, alimentos e bebidas com persistência própria.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto text-xs text-neutral-500">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Setor Bar & Lanchonete Ativo</span>
          <span className="text-neutral-300">|</span>
          <span className="font-mono-tabular">
            {vendas.length} {vendas.length === 1 ? 'item AeB registrado' : 'itens AeB registrados'}
          </span>
        </div>
      </div>

      {/* 2. Área de Upload de PDF exclusiva para AeB */}
      <AeBUploadArea onDataLoaded={onDataLoaded} />

      {/* 3. Cards de Resumo no topo desta aba */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Arrecadado AeB */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
              Total Arrecadado (AeB)
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
              {formatCurrencyBRL(totalArrecadado)}
            </div>
            <div className="text-xs text-neutral-500">
              Faturamento dos itens de AeB visíveis nos filtros atuais
            </div>
          </div>
        </div>

        {/* Card 2: Quantidade de Itens Vendidos */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-500 inline-block"></span>
              Quantidade de Itens Vendidos
            </span>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
              <GlassWater className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
              {quantidadeItens} <span className="text-base font-normal text-neutral-500">unidades</span>
            </div>
            <div className="text-xs text-neutral-500">
              {vendas.length !== quantidadeItens
                ? `(Filtrado de ${vendas.length} no total)`
                : 'Total de itens de AeB registrados'}
            </div>
          </div>
        </div>

        {/* Card 3: Ticket Médio por Item */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Preço Médio por Item (AeB)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
              {formatCurrencyBRL(ticketMedio)}
            </div>
            <div className="text-xs text-neutral-500">
              Média do valor cobrado por unidade vendida
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar com Filtros de Dia e Busca */}
      <div className="space-y-0">
        <div className="bg-white border border-neutral-200/90 rounded-t-xl p-4 sm:p-5 border-b-0 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">
                  Relatório de Alimentos e Bebidas (AeB)
                </h3>
                <span className="text-xs font-mono-tabular px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 font-medium">
                  {filteredVendas.length} {filteredVendas.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Altere o operador responsável diretamente ou utilize o botão de edição.
              </p>
            </div>

            {/* Ações da Toolbar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenNewSaleModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Venda (AeB)</span>
              </button>

              <button
                type="button"
                onClick={onExportCSV}
                disabled={filteredVendas.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-lg border border-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-500" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Filtros: Dia e Busca */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Campo de Busca */}
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome do produto, comanda ou operador..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 5. Filtro por Dia: Dropdown extraindo datas únicas */}
            <div className="sm:col-span-5 relative">
              <div className="relative">
                <label htmlFor="filter-aeb-day" className="sr-only">
                  Filtrar por Dia
                </label>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <select
                  id="filter-aeb-day"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50/70 border border-neutral-200 rounded-lg text-neutral-800 appearance-none focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 cursor-pointer font-medium"
                >
                  <option value="Todos">Todos os Dias ({availableDays.length} {availableDays.length === 1 ? 'dia' : 'dias'})</option>
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
          </div>

          {/* Tags de filtros ativos */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 text-xs">
              <span className="text-neutral-500 font-medium">Filtros:</span>
              {selectedDay !== 'Todos' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                  Dia: {selectedDay}
                  <button type="button" onClick={() => setSelectedDay('Todos')} className="p-0.5 hover:text-blue-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                  Busca: &ldquo;{searchTerm}&rdquo;
                  <button type="button" onClick={() => setSearchTerm('')} className="p-0.5 hover:text-neutral-950 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-blue-600 hover:text-blue-800 underline font-medium ml-1 cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Tabela de Vendas de AeB */}
        <AeBTable
          vendas={filteredVendas}
          onUpdateResponsavel={onUpdateResponsavel}
          onEditVenda={onEditVenda}
          onDeleteVenda={onDeleteVenda}
        />
      </div>
    </div>
  );
};
