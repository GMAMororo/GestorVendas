import React, { useState, useMemo, useRef } from 'react';
import {
  GlassWater,
  DollarSign,
  ShoppingBag,
  Award,
  Search,
  Calendar,
  Clock,
  User,
  Pencil,
  Trash2,
  FileSearch,
  Upload,
  Plus,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ban,
  Gift,
  CalendarRange,
  MessageSquareText,
} from 'lucide-react';
import { VendaAeB, FiltroTurno } from '../types/venda';
import {
  formatCurrencyBRL,
  matchesTurnoFilter,
  getTodayLocalISO,
  isDateWithinRange,
  isRegistroCortesia,
  isRegistroConta3000,
  getContaAdmCode,
  isRegistroVoucher,
  getValorMonetarioEfetivo,
  getValorNaoMonetarioVoucher,
  recordDateToISO,
} from '../utils/formatters';
import {
  extractTextFromPdf,
  parseVoluxAeBTextWithReconciliation,
} from '../utils/voluxParser';

interface AeBTabProps {
  vendas: VendaAeB[];
  onUpdateResponsavel: (id: string, responsavel: string) => void;
  onUpdateObservacao: (id: string, observacao: string) => void;
  onEditVenda: (venda: VendaAeB) => void;
  onDeleteVenda: (id: string) => void;
  onDataLoaded: (
    extracted: VendaAeB[],
    sourceName: string
  ) => {
    addedCount: number;
    updatedCount?: number;
    addedValor: number;
    ignoredDuplicateCount: number;
    cancelledRemovedCount?: number;
  };
  onOpenNewSaleModal: () => void;
  onExportCSV: () => void;
}

export const AeBTab: React.FC<AeBTabProps> = ({
  vendas,
  onUpdateResponsavel,
  onUpdateObservacao,
  onEditVenda,
  onDeleteVenda,
  onDataLoaded,
  onOpenNewSaleModal,
  onExportCSV,
}) => {
  // Filtros da Aba AeB (Data Inicial e Data Final com default Hoje no timezone local)
  const [startDate, setStartDate] = useState<string>(() => getTodayLocalISO());
  const [endDate, setEndDate] = useState<string>(() => getTodayLocalISO());
  const [selectedTurno, setSelectedTurno] = useState<FiltroTurno>('Todos os Turnos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Upload PDF State
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [emptyReportNotice, setEmptyReportNotice] = useState<string | null>(null);
  const [lastUploadSummary, setLastUploadSummary] = useState<{
    sourceName: string;
    addedCount: number;
    updatedCount: number;
    addedValor: number;
    cancelledRemovedCount: number;
  } | null>(null);
  const [reconciliationAlert, setReconciliationAlert] = useState<{
    totalExtraido: number;
    totalEsperado: number;
    diferenca: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayISO = getTodayLocalISO();
  const isAllDates = !startDate && !endDate;
  const isTodaySelected = startDate === todayISO && endDate === todayISO;

  // Filtragem cumulativa
  const filteredVendas = useMemo(() => {
    return vendas.filter((v) => {
      if (!isDateWithinRange(v.data, startDate, endDate)) return false;
      if (!matchesTurnoFilter(v.hora, selectedTurno)) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchItem = v.item.toLowerCase().includes(q);
        const matchComanda = (v.comanda || '').toLowerCase().includes(q);
        const matchId = v.id.toLowerCase().includes(q);
        const matchResp = (v.responsavel || '').toLowerCase().includes(q);
        const matchObs = (v.observacao || '').toLowerCase().includes(q);
        if (!matchItem && !matchComanda && !matchId && !matchResp && !matchObs) return false;
      }

      return true;
    });
  }, [vendas, startDate, endDate, selectedTurno, searchTerm]);

  const hasActiveFilters =
    !isTodaySelected || selectedTurno !== 'Todos os Turnos' || searchTerm.trim() !== '';

  // 1. Cálculos para os 3 Cards de Resumo (Baseados nas vendas ativas filtradas)
  const vendasAtivas = useMemo(
    () => filteredVendas.filter((v) => !v.cancelado && v.status !== 'Cancelado'),
    [filteredVendas]
  );

  const vendasPagas = useMemo(
    () =>
      vendasAtivas.filter(
        (v) => getValorMonetarioEfetivo(v) > 0 || isRegistroVoucher(v) || !isRegistroCortesia(v)
      ),
    [vendasAtivas]
  );

  const cortesiasAeB = useMemo(
    () =>
      vendasAtivas
        .filter((v) => isRegistroCortesia(v))
        .reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0),
    [vendasAtivas]
  );

  const vouchersAeBStats = useMemo(() => {
    const list = vendasAtivas.filter((v) => isRegistroVoucher(v));
    const qtd = list.reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0);
    const valor = list.reduce((acc, v) => acc + getValorNaoMonetarioVoucher(v), 0);
    return { qtd, valor };
  }, [vendasAtivas]);

  const totalArrecadado = useMemo(
    () => vendasAtivas.reduce((sum, item) => sum + getValorMonetarioEfetivo(item), 0),
    [vendasAtivas]
  );

  const quantidadeItensVendidos = useMemo(
    () => vendasAtivas.reduce((sum, item) => sum + Math.max(1, Number(item.qtde) || 1), 0),
    [vendasAtivas]
  );

  const produtoMaisVendido = useMemo(() => {
    if (vendasPagas.length === 0) return { nome: 'Nenhum item', qtd: 0 };
    const counts: Record<string, number> = {};
    for (const v of vendasPagas) {
      const qtde = Math.max(1, Number(v.qtde) || 1);
      counts[v.item] = (counts[v.item] || 0) + qtde;
    }
    let topNome = '';
    let topQtd = 0;
    for (const [nome, qtd] of Object.entries(counts)) {
      if (qtd > topQtd) {
        topNome = nome;
        topQtd = qtd;
      }
    }
    return { nome: topNome, qtd: topQtd };
  }, [vendasPagas]);

  // Processamento de PDF de Bebidas
  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setEmptyReportNotice(null);
    setReconciliationAlert(null);
    setIsProcessing(true);

    try {
      const rawText = await extractTextFromPdf(file);
      const reconciliation = parseVoluxAeBTextWithReconciliation(rawText);

      if (reconciliation.vendas.length === 0) {
        setEmptyReportNotice(
          'PDF lido com sucesso: Nenhuma comanda de A&B lançada neste período (R$ 0,00).'
        );
        onDataLoaded([], file.name);
      } else {
        if (reconciliation.hasDiscrepancy && reconciliation.totalEsperado !== null) {
          setReconciliationAlert({
            totalExtraido: reconciliation.totalExtraido,
            totalEsperado: reconciliation.totalEsperado,
            diferenca: reconciliation.diferenca,
          });
        }
        const summary = onDataLoaded(reconciliation.vendas, file.name);
        const extractedISODates = reconciliation.vendas
          .map((v) => recordDateToISO(v.data))
          .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
          .sort();
        if (extractedISODates.length > 0) {
          setStartDate(extractedISODates[0]);
          setEndDate(extractedISODates[extractedISODates.length - 1]);
        }
        setLastUploadSummary({
          sourceName: file.name,
          addedCount: summary.addedCount,
          updatedCount: summary.updatedCount ?? summary.ignoredDuplicateCount,
          addedValor: summary.addedValor,
          cancelledRemovedCount: summary.cancelledRemovedCount ?? 0,
        });
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Erro ao ler o arquivo PDF. Tente novamente.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Banner de Boas-vindas e Upload */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <GlassWater className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-semibold text-neutral-900">
                  Módulo de Alimentos e Bebidas (AeB)
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70">
                  Conciliação 1 para 1 por Turno
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Importe o PDF do Volux com vendas de bebidas/salgadinhos ou adicione lançamentos
                manuais e vouchers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  handleFileUpload(f);
                  e.target.value = '';
                }
              }}
            />

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Importar PDF (AeB)</span>
            </button>

            <button
              type="button"
              onClick={onExportCSV}
              disabled={vendas.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 border border-neutral-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-500" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewSaleModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Venda (AeB)</span>
            </button>
          </div>
        </div>

        {/* Feedback amigável de PDF de A&B Vazio */}
        {emptyReportNotice && !errorMsg && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-blue-900 bg-blue-50/80 px-3.5 py-2.5 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-medium">{emptyReportNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setEmptyReportNotice(null)}
              className="text-blue-700 hover:text-blue-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Feedback de Upload */}
        {lastUploadSummary && !errorMsg && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50/70 px-3 py-2 rounded-lg border border-emerald-200/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Relatório <strong>{lastUploadSummary.sourceName}</strong> processado:{' '}
                <strong>{lastUploadSummary.addedCount}</strong> novos itens adicionados (
                {formatCurrencyBRL(lastUploadSummary.addedValor)}).
                {lastUploadSummary.updatedCount > 0 &&
                  ` (${lastUploadSummary.updatedCount} itens já existentes conciliados).`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLastUploadSummary(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {reconciliationAlert && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-start justify-between gap-2 text-xs text-amber-900 bg-amber-50 px-3.5 py-2.5 rounded-lg border border-amber-300">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Atenção: O valor extraído ({formatCurrencyBRL(reconciliationAlert.totalExtraido)}) é
                  diferente do Total do PDF ({formatCurrencyBRL(reconciliationAlert.totalEsperado)}).
                  Alguma linha pode ter falhado.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReconciliationAlert(null)}
              className="text-amber-700 hover:text-amber-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-red-700 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-red-600 hover:text-red-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 3 Cards de Resumo de AeB */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Arrecadado (AeB) com Cortesias e Vouchers */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total Arrecadado em Caixa (AeB)
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900 font-mono-tabular tracking-tight">
                {formatCurrencyBRL(totalArrecadado)}
              </h2>
              <p className="mt-1.5 text-xs font-semibold text-purple-700">
                🎟️ Vouchers: {vouchersAeBStats.qtd} un. ({formatCurrencyBRL(vouchersAeBStats.valor)} não monetário)
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Receita monetária de bebidas & conveniência</span>
            <span className="font-mono-tabular text-blue-700 font-medium">100% AeB</span>
          </div>
        </div>

        {/* Card 2: Quantidade de Itens Vendidos */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Quantidade de Itens Vendidos
                </p>
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900 font-mono-tabular tracking-tight">
                {quantidadeItensVendidos}{' '}
                <span className="text-sm font-medium text-neutral-400">unid.</span>
              </h2>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-700 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Unidades registradas no filtro atual</span>
            <span className="font-mono-tabular text-sky-700 font-medium">
              {vendasAtivas.length} {vendasAtivas.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
        </div>

        {/* Card 3: Produto Mais Vendido */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 truncate">
                  Produto Mais Vendido
                </p>
              </div>
              <h2
                title={produtoMaisVendido.nome}
                className="mt-2 text-base sm:text-lg font-bold text-neutral-900 truncate"
              >
                {produtoMaisVendido.nome}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-700 shrink-0">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span>Líder em volume de saída</span>
            <span className="font-mono-tabular text-indigo-700 font-semibold">
              {produtoMaisVendido.qtd}{' '}
              {produtoMaisVendido.qtd === 1 ? 'unidade' : 'unidades'}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros + Tabela */}
      <div className="space-y-0">
        {/* Toolbar de Filtros com Calendário de Período (Date Range) */}
        <div className="bg-white rounded-t-xl border border-b-0 border-neutral-200/80 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 flex-1 flex-wrap">
            {/* Calendário de Período (Data Inicial e Data Final) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-neutral-50 border border-neutral-200/90 rounded-lg p-1.5">
              <div className="flex items-center gap-1.5 px-1.5 text-xs font-semibold text-neutral-600">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Período:</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-medium text-neutral-500 whitespace-nowrap pl-1">
                    De:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-label="Data Inicial AeB"
                    className="w-full sm:w-auto bg-white border border-neutral-200 text-neutral-900 text-xs font-medium rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-medium text-neutral-500 whitespace-nowrap pl-1">
                    Até:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-label="Data Final AeB"
                    className="w-full sm:w-auto bg-white border border-neutral-200 text-neutral-900 text-xs font-medium rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex items-center gap-1 pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayLocalISO();
                      setStartDate(today);
                      setEndDate(today);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      isTodaySelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      isAllDates
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    Todas
                  </button>
                </div>
              </div>
            </div>

            {/* Filtro por Turno Oficial (Manhã: 09:00 às 15:59 | Noite: 16:00 às 23:00) */}
            <div className="relative w-full md:w-auto md:min-w-[215px]">
              <Clock className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedTurno}
                onChange={(e) => setSelectedTurno(e.target.value as FiltroTurno)}
                aria-label="Filtrar por turno"
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-medium bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="Todos os Turnos">Todos os Turnos</option>
                <option value="Manhã (09:00 às 15:59)">Manhã (09:00 às 15:59)</option>
                <option value="Noite (16:00 às 23:00)">
                  Noite (16:00 às 23:00)
                </option>
              </select>
            </div>

            {/* Busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por bebida, observação ou responsável..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  const today = getTodayLocalISO();
                  setStartDate(today);
                  setEndDate(today);
                  setSelectedTurno('Todos os Turnos');
                  setSearchTerm('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/70 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Limpar filtros</span>
              </button>
            )}
            <span className="text-xs text-neutral-500 font-mono-tabular">
              Mostrando <strong className="text-neutral-900">{filteredVendas.length}</strong> de{' '}
              <strong className="text-neutral-900">{vendas.length}</strong> itens
            </span>
          </div>
        </div>

        {/* Tabela de Vendas AeB */}
        {filteredVendas.length === 0 ? (
          <div className="bg-white rounded-b-xl border border-neutral-200/80 p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3">
              <FileSearch className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Nenhuma venda de Alimentos e Bebidas encontrada no período
            </h3>
            <p className="mt-1 text-xs text-neutral-500 max-w-md mx-auto">
              Importe o relatório PDF de vendas de bebidas do Volux, ajuste o período de datas acima
              ou clique em "Nova Venda (AeB)".
            </p>
            {vendas.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                >
                  <CalendarRange className="w-4 h-4 text-blue-600" />
                  <span>
                    Exibir todas as datas ({vendas.length} registros AeB no banco)
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-b-xl border border-neutral-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="py-3 px-3 w-24">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Data</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 w-24">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Hora</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[260px]">Item (Produto AeB)</th>
                    <th className="py-3 px-3 w-20 text-center">Qtde</th>
                    <th className="py-3 px-4 w-36 text-right">Preço</th>
                    <th className="py-3 px-4 w-52">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Responsável</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 w-56">
                      <div className="flex items-center gap-1.5">
                        <MessageSquareText className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Observação</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 w-24 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 text-sm">
                  {filteredVendas.map((venda, idx) => {
                    const hasResponsavel =
                      venda.responsavel && venda.responsavel.trim().length > 0;
                    const hasObservacao =
                      venda.observacao && venda.observacao.trim().length > 0;
                    const numeroComandaExibicao = venda.comanda || venda.id;
                    const isCancelado = Boolean(
                      venda.cancelado || venda.status === 'Cancelado'
                    );
                    const contaAdmCode = getContaAdmCode(venda);
                    const isConta3000 = isRegistroConta3000(venda);
                    const isVoucher = isRegistroVoucher(venda);
                    const isCortesia = isRegistroCortesia(venda);
                    const qtdeExibicao = Math.max(1, Number(venda.qtde) || 1);
                    const valorEfetivo = getValorMonetarioEfetivo(venda);
                    const valorVoucherRef = isVoucher ? getValorNaoMonetarioVoucher(venda) : 0;

                    return (
                      <tr
                        key={`${venda.id}-${idx}`}
                        className={`transition-colors group ${
                          isCancelado
                            ? 'bg-red-50/40 hover:bg-red-50/70 opacity-75'
                            : isVoucher
                            ? 'bg-purple-50/35 hover:bg-purple-50/60'
                            : isCortesia
                            ? 'bg-amber-50/35 hover:bg-amber-50/60'
                            : 'hover:bg-blue-50/30'
                        }`}
                      >
                        <td
                          className={`py-3 px-3 font-mono-tabular text-xs whitespace-nowrap ${
                            isCancelado
                              ? 'text-red-600/80 line-through'
                              : 'text-neutral-600'
                          }`}
                        >
                          {venda.data}
                        </td>
                        <td
                          className={`py-3 px-3 font-mono-tabular text-xs whitespace-nowrap ${
                            isCancelado
                              ? 'text-red-600/80 line-through'
                              : 'text-neutral-600'
                          }`}
                        >
                          {venda.hora}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <div className="flex items-center gap-2 flex-nowrap">
                            <GlassWater
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isCancelado ? 'text-red-400' : 'text-blue-600'
                              }`}
                            />
                            <span
                              title={`Comanda / ID Interno: #${numeroComandaExibicao}`}
                              className={`whitespace-nowrap ${
                                isCancelado
                                  ? 'text-red-700/80 line-through'
                                  : 'text-neutral-900'
                              }`}
                            >
                              {venda.item}
                            </span>

                            {venda.faltouNoManual && !isCancelado && (
                              <span
                                title="Faltou no manual, adicionado via PDF"
                                className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-900 border border-amber-300"
                              >
                                ⚠️ Só PDF
                              </span>
                            )}

                            {venda.sobraNoManual && !venda.conciliado && !isCancelado && (
                              <span
                                title="Este item foi lançado manualmente, mas não consta na comanda oficial do PDF Volux"
                                className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-900 border border-rose-300"
                              >
                                ❗ Só Manual (Fora do PDF)
                              </span>
                            )}

                            {contaAdmCode && !isCancelado && (
                              <span
                                title={`Conta ${contaAdmCode} (ADM = S / Cortesia Volux)`}
                                className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300"
                              >
                                ADM {contaAdmCode}
                              </span>
                            )}

                            {isVoucher && !isCancelado && (
                              <span
                                title="Pago com Voucher (Não soma no caixa em dinheiro)"
                                className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-900 border border-purple-300"
                              >
                                🎟️ Voucher
                              </span>
                            )}

                            {isCortesia && !isConta3000 && !isCancelado && (
                              <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                                <Gift className="w-3 h-3 text-amber-700" />
                                Cortesia
                              </span>
                            )}

                            {venda.conciliado && venda.origem === 'MANUAL' && !venda.faltouNoManual && !isCancelado && (
                              <span
                                title="Lançamento manual conciliado 1 para 1 com o relatório PDF do Volux"
                                className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              >
                                ✓ Conciliado
                              </span>
                            )}

                            {isCancelado && (
                              <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 inline-flex items-center gap-1">
                                <Ban className="w-3 h-3" />
                                Cancelado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono-tabular text-xs font-bold whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md border ${
                              isCancelado
                                ? 'bg-red-50 text-red-600 border-red-200 line-through'
                                : qtdeExibicao > 1
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-neutral-100 text-neutral-700 border-neutral-200/80'
                            }`}
                          >
                            {qtdeExibicao}x
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap">
                          {isCancelado ? (
                            <span className="text-red-600 line-through">
                              {formatCurrencyBRL(0)}
                            </span>
                          ) : isVoucher ? (
                            <div className="flex flex-col items-end leading-tight">
                              <span className="text-purple-800 font-bold">
                                {formatCurrencyBRL(0)}
                              </span>
                              <span className="text-[10px] font-medium text-purple-600">
                                (Voucher {formatCurrencyBRL(valorVoucherRef)})
                              </span>
                            </div>
                          ) : isCortesia ? (
                            <span className="text-amber-800">
                              {formatCurrencyBRL(valorEfetivo)}
                            </span>
                          ) : (
                            <span className="text-neutral-900">
                              {formatCurrencyBRL(valorEfetivo)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative">
                            <input
                              type="text"
                              value={venda.responsavel}
                              onChange={(e) =>
                                onUpdateResponsavel(venda.id, e.target.value)
                              }
                              placeholder="Nome do caixa..."
                              className={`w-full px-3 py-1.5 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                                hasResponsavel
                                  ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950 font-medium focus:bg-white focus:ring-emerald-500/20 focus:border-emerald-500'
                                  : 'bg-neutral-50/70 border-neutral-200 text-neutral-800 placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:ring-blue-500/15 focus:border-blue-500'
                              }`}
                            />
                            {hasResponsavel && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                title="Salvo automaticamente"
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="relative">
                            <input
                              type="text"
                              value={venda.observacao || ''}
                              onChange={(e) =>
                                onUpdateObservacao(venda.id, e.target.value)
                              }
                              placeholder="Adicionar observação..."
                              aria-label={`Observação da venda ${numeroComandaExibicao}`}
                              className={`w-full px-3 py-1.5 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                                hasObservacao
                                  ? 'bg-amber-50/60 border-amber-200/90 text-amber-950 font-medium focus:bg-white focus:ring-amber-500/20 focus:border-amber-500'
                                  : 'bg-neutral-50/70 border-neutral-200 text-neutral-800 placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:ring-blue-500/15 focus:border-blue-500'
                              }`}
                            />
                            {hasObservacao && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                title="Observação salva"
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditVenda(venda)}
                              title={`Editar item (#${numeroComandaExibicao})`}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteVenda(venda.id)}
                              title={`Excluir item (#${numeroComandaExibicao})`}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50/90 border-t border-neutral-200/80 text-xs font-semibold text-neutral-700">
                    <td
                      colSpan={4}
                      className="py-3 px-4 text-right uppercase tracking-wider text-neutral-500"
                    >
                      Subtotal Efetivo em Caixa AeB ({quantidadeItensVendidos}{' '}
                      {quantidadeItensVendidos === 1 ? 'unidade' : 'unidades'}):
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-sm font-bold text-neutral-900">
                      {formatCurrencyBRL(totalArrecadado)}
                    </td>
                    <td colSpan={3} className="py-3 px-4 text-neutral-400 font-normal">
                      Salvo instantaneamente no LocalStorage
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
