import React, { useState } from 'react';
import {
  Ticket,
  Clock,
  User,
  Calendar,
  Calculator,
  Save,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  TrendingUp,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { FechamentoTurnoFichas, TurnoOpcao } from '../types/venda';
import { formatNumber } from '../utils/formatters';
import { generateUniqueId } from '../utils/voluxParser';

interface ControleFichasTabProps {
  fechamentos: FechamentoTurnoFichas[];
  onAddFechamento: (fechamento: FechamentoTurnoFichas) => void;
  onDeleteFechamento: (id: string) => void;
  onResetFechamentos: () => void;
}

export const ControleFichasTab: React.FC<ControleFichasTabProps> = ({
  fechamentos,
  onAddFechamento,
  onDeleteFechamento,
  onResetFechamentos,
}) => {
  // Data atual formatada para input type="date" (YYYY-MM-DD)
  const getTodayDateInput = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [dataFechamento, setDataFechamento] = useState(getTodayDateInput());
  const [turno, setTurno] = useState<TurnoOpcao>('Manhã (08:00 às 16:00)');
  const [responsavel, setResponsavel] = useState('');
  const [contagemInicial, setContagemInicial] = useState<string>('500');
  const [contagemFinal, setContagemFinal] = useState<string>('360');
  const [observacao, setObservacao] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Cálculo em tempo real: Fichas Vendidas = Contagem Inicial - Contagem Final
  const numInicial = parseInt(contagemInicial, 10) || 0;
  const numFinal = parseInt(contagemFinal, 10) || 0;
  const fichasVendidas = numInicial - numFinal;
  const hasInconsistency = numFinal > numInicial && contagemInicial !== '' && contagemFinal !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!dataFechamento) {
      setFormError('Por favor, informe a data do fechamento.');
      return;
    }

    if (!responsavel.trim()) {
      setFormError('Por favor, informe o nome do responsável pelo turno.');
      return;
    }

    if (contagemInicial === '' || isNaN(numInicial) || numInicial < 0) {
      setFormError('A contagem inicial de fichas deve ser um número válido maior ou igual a zero.');
      return;
    }

    if (contagemFinal === '' || isNaN(numFinal) || numFinal < 0) {
      setFormError('A contagem final de fichas deve ser um número válido maior ou igual a zero.');
      return;
    }

    // Formata data para exibição (DD/MM/AAAA)
    const [yyyy, mm, dd] = dataFechamento.split('-');
    const dataFormatada = `${dd}/${mm}/${yyyy}`;

    const novoFechamento: FechamentoTurnoFichas = {
      id: generateUniqueId(),
      data: dataFormatada,
      turno,
      responsavel: responsavel.trim(),
      contagemInicial: numInicial,
      contagemFinal: numFinal,
      fichasVendidas,
      observacao: observacao.trim() || undefined,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    onAddFechamento(novoFechamento);

    // Limpa / reseta campos para próximo lançamento
    setResponsavel('');
    setContagemInicial('400');
    setContagemFinal('300');
    setObservacao('');
    setFormError(null);
  };

  // Exportar histórico para CSV
  const handleExportHistoryCSV = () => {
    if (fechamentos.length === 0) return;
    const headers = ['ID', 'Data', 'Turno', 'Responsável', 'Contagem Inicial', 'Contagem Final', 'Fichas Vendidas', 'Observação'];
    const rows = fechamentos.map((f) => [
      `"${f.id}"`,
      `"${f.data}"`,
      `"${f.turno}"`,
      `"${f.responsavel}"`,
      `"${f.contagemInicial}"`,
      `"${f.contagemFinal}"`,
      `"${f.fichasVendidas}"`,
      `"${(f.observacao || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historico-fechamento-fichas.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Totais agregados do histórico
  const totalFichasVendidas = fechamentos.reduce((acc, curr) => acc + (curr.fichasVendidas > 0 ? curr.fichasVendidas : 0), 0);
  const mediaPorTurno = fechamentos.length > 0 ? Math.round(totalFichasVendidas / fechamentos.length) : 0;

  const filteredFechamentos = fechamentos.filter((f) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      f.data.toLowerCase().includes(q) ||
      f.responsavel.toLowerCase().includes(q) ||
      f.turno.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cards de Resumo do Controle de Fichas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Total Fichas Físicas Vendidas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {formatNumber(totalFichasVendidas)} <span className="text-base font-normal text-neutral-500">fichas</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Total acumulado nos {fechamentos.length} turnos registrados
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Média por Turno
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {formatNumber(mediaPorTurno)} <span className="text-base font-normal text-neutral-500">fichas/turno</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Consumo médio por período operacional
          </div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Último Fechamento
            </span>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-semibold text-neutral-900 tracking-tight truncate">
            {fechamentos[0] ? fechamentos[0].responsavel : 'Nenhum'}
          </div>
          <div className="text-xs text-neutral-500 mt-1 truncate">
            {fechamentos[0]
              ? `${fechamentos[0].data} · ${fechamentos[0].fichasVendidas} fichas vendidas`
              : 'Aguardando primeiro fechamento'}
          </div>
        </div>
      </div>

      {/* Formulário de Fechamento de Turno & Card de Cálculo em Tempo Real */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-neutral-100 mb-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Formulário de Fechamento de Turno de Fichas
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Informe a contagem inicial e final das fichas do cofre/caixa para apurar a saída exata
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 font-medium border border-neutral-200">
            Conferência Física
          </span>
        </div>

        {formError && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Linha 1: Data, Turno e Responsável */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Data do Fechamento */}
            <div>
              <label htmlFor="data-fechamento" className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <span>Data do Fechamento *</span>
              </label>
              <input
                id="data-fechamento"
                type="date"
                required
                value={dataFechamento}
                onChange={(e) => setDataFechamento(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>

            {/* Turno (Dropdown Obrigatório) */}
            <div>
              <label htmlFor="select-turno" className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>Turno *</span>
              </label>
              <div className="relative">
                <select
                  id="select-turno"
                  required
                  value={turno}
                  onChange={(e) => setTurno(e.target.value as TurnoOpcao)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 appearance-none focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 cursor-pointer font-medium"
                >
                  <option value="Manhã (08:00 às 16:00)">Manhã (08:00 às 16:00)</option>
                  <option value="Tarde/Noite (16:00 às 23:20)">Tarde/Noite (16:00 às 23:20)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Responsável (Operador) */}
            <div>
              <label htmlFor="input-responsavel" className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-500" />
                <span>Responsável (Operador) *</span>
              </label>
              <input
                id="input-responsavel"
                type="text"
                required
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="ex: Carlos Lima"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          </div>

          {/* Linha 2: Contagens Inicial e Final */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contagem-inicial" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Contagem Inicial (Fichas no Início do Turno) *
              </label>
              <input
                id="contagem-inicial"
                type="number"
                min="0"
                step="1"
                required
                value={contagemInicial}
                onChange={(e) => setContagemInicial(e.target.value)}
                placeholder="ex: 500"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 text-base font-semibold"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Saldo de fichas conferido na abertura do caixa
              </p>
            </div>

            <div>
              <label htmlFor="contagem-final" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Contagem Final (Fichas Restantes no Fim do Turno) *
              </label>
              <input
                id="contagem-final"
                type="number"
                min="0"
                step="1"
                required
                value={contagemFinal}
                onChange={(e) => setContagemFinal(e.target.value)}
                placeholder="ex: 360"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 text-base font-semibold"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Saldo físico restante apurado no fechamento
              </p>
            </div>
          </div>

          {/* Card de Resultado (Cálculo em Tempo Real da Equação) */}
          <div className="p-4 sm:p-5 rounded-xl bg-neutral-50 border border-neutral-200/90 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                    Resultado da Apuração em Tempo Real
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono-tabular">
                  Fórmula: Contagem Inicial ({numInicial}) - Contagem Final ({numFinal})
                </div>

                {hasInconsistency && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Atenção: A contagem final é maior que a inicial (possível reposição de estoque durante o turno).</span>
                  </div>
                )}
              </div>

              {/* Fichas Vendidas Badge / Number */}
              <div className="text-left sm:text-right">
                <div className="text-xs font-medium text-neutral-500">
                  Fichas Vendidas no Turno:
                </div>
                <div className={`text-3xl sm:text-4xl font-bold font-mono-tabular tracking-tight ${
                  fichasVendidas < 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {fichasVendidas} <span className="text-base font-medium text-neutral-600">fichas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Salvar Fechamento de Turno */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 active:bg-neutral-950 transition-all shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Fechamento de Turno</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tabela de Histórico dos Fechamentos Registrados */}
      <div className="bg-white border border-neutral-200/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Histórico dos Fechamentos de Turno
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Registros arquivados de conferência física de estoque de fichas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar por data, operador ou turno..."
              className="px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 w-full sm:w-64"
            />

            <button
              type="button"
              onClick={handleExportHistoryCSV}
              disabled={fechamentos.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-500" />
              <span>Exportar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (fechamentos.length > 0 && window.confirm('Deseja realmente limpar todo o histórico de fechamentos salvos?')) {
                  onResetFechamentos();
                }
              }}
              disabled={fechamentos.length === 0}
              title="Limpar histórico de fechamentos de turno"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:text-red-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {filteredFechamentos.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-neutral-100 mx-auto flex items-center justify-center text-neutral-400 mb-2">
              <Ticket className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-neutral-900">
              Nenhum fechamento encontrado
            </h4>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Preencha o formulário acima e clique em &ldquo;Salvar Fechamento de Turno&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/75 text-xs font-semibold text-neutral-600">
                  <th scope="col" className="py-3 px-4">Data</th>
                  <th scope="col" className="py-3 px-4">Turno</th>
                  <th scope="col" className="py-3 px-4">Responsável</th>
                  <th scope="col" className="py-3 px-4 text-right">Inicial</th>
                  <th scope="col" className="py-3 px-4 text-right">Final</th>
                  <th scope="col" className="py-3 px-4 text-right font-bold text-neutral-900">Fichas Vendidas</th>
                  <th scope="col" className="py-3 px-4 text-right w-[60px]">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredFechamentos.map((f) => (
                  <tr key={f.id} className="hover:bg-neutral-50/80 transition-colors group">
                    <td className="py-3.5 px-4 font-mono-tabular font-medium text-neutral-900 whitespace-nowrap">
                      {f.data}
                      {f.timestamp && (
                        <span className="block text-[11px] text-neutral-400 font-normal">
                          às {f.timestamp}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/70">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {f.turno}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-neutral-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{f.responsavel}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-neutral-700 whitespace-nowrap">
                      {f.contagemInicial}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-neutral-700 whitespace-nowrap">
                      {f.contagemFinal}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {f.fichasVendidas} fichas
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteFechamento(f.id)}
                        title="Remover fechamento"
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 bg-neutral-50/75 border-t border-neutral-200 text-xs text-neutral-500 flex items-center justify-between">
          <span>Total de {fechamentos.length} fechamentos arquivados no banco local.</span>
          <span className="font-mono-tabular font-medium text-neutral-700">
            {totalFichasVendidas} fichas vendidas no total
          </span>
        </div>
      </div>
    </div>
  );
};
