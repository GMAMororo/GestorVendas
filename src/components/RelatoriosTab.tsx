import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Calendar,
  Clock,
  CircleDot,
  Trophy,
  Filter,
  DollarSign,
  ShoppingBag,
  Sparkles,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Medal,
  Activity,
  Layers,
  UtensilsCrossed,
} from 'lucide-react';
import { VendaComanda, VendaAeB } from '../types/venda';
import { formatCurrencyBRL, formatNumber } from '../utils/formatters';

interface RelatoriosTabProps {
  vendas: VendaComanda[];
  aebSales: VendaAeB[];
}

// Cores Modernas Executivas
const BOLICHE_COLORS = ['#3b82f6', '#1d4ed8'];
const FICHAS_COLORS = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6'];
const TOP_AEB_COLORS = ['#2563eb', '#0284c7', '#0d9488', '#16a34a', '#d97706'];

export const RelatoriosTab: React.FC<RelatoriosTabProps> = ({
  vendas,
  aebSales,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Todos os Tempos');

  // Extrai meses únicos das datas das vendas para o filtro de Mês/Período
  const availablePeriods = useMemo(() => {
    const periodSet = new Set<string>();
    const mesesNomes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const extrairPeriodo = (dataStr: string) => {
      if (!dataStr) return;
      const match = dataStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
      if (match) {
        const mesNum = parseInt(match[2], 10);
        const anoStr = match[3] || '';
        if (mesNum >= 1 && mesNum <= 12) {
          const nome = mesesNomes[mesNum - 1];
          periodSet.add(anoStr ? `${nome}/${anoStr}` : nome);
        }
      }
    };

    vendas.forEach((v) => extrairPeriodo(v.data));
    aebSales.forEach((a) => extrairPeriodo(a.data));

    return ['Todos os Tempos', ...Array.from(periodSet)];
  }, [vendas, aebSales]);

  // Função auxiliar para verificar se uma data bate com o período selecionado
  const matchesPeriod = (dataStr: string) => {
    if (selectedPeriod === 'Todos os Tempos') return true;
    if (!dataStr) return false;
    const match = dataStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (!match) return false;
    const mesNum = parseInt(match[2], 10);
    const anoStr = match[3] || '';
    const mesesNomes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    if (mesNum >= 1 && mesNum <= 12) {
      const nome = mesesNomes[mesNum - 1];
      const formatado = anoStr ? `${nome}/${anoStr}` : nome;
      return formatado === selectedPeriod || nome === selectedPeriod;
    }
    return false;
  };

  // Filtragem dos dados (exclui itens cancelados e aplica o filtro de período)
  const filteredVendas = useMemo(() => {
    return vendas.filter(
      (v) => !v.cancelado && v.status !== 'Cancelado' && matchesPeriod(v.data)
    );
  }, [vendas, selectedPeriod]);

  const filteredAeb = useMemo(() => {
    return aebSales.filter(
      (a) => !a.cancelado && a.status !== 'Cancelado' && matchesPeriod(a.data)
    );
  }, [aebSales, selectedPeriod]);

  // Total combinado de faturamento no período
  const totalFaturamento = useMemo(() => {
    const sumVendas = filteredVendas.reduce((acc, curr) => acc + curr.preco, 0);
    const sumAeb = filteredAeb.reduce((acc, curr) => acc + curr.preco, 0);
    return sumVendas + sumAeb;
  }, [filteredVendas, filteredAeb]);

  const totalTransacoes = filteredVendas.length + filteredAeb.length;

  // =========================================================================
  // SEÇÃO 1: RANKING DE OPERADORES & CARDS DE DESTAQUE (KPIS)
  // =========================================================================

  // 1.1 Ranking Geral de Operadores (Boliche + Fichas + AeB)
  const rankingOperadores = useMemo(() => {
    const allWithResp = [
      ...filteredVendas.filter((v) => v.responsavel && v.responsavel.trim() !== ''),
      ...filteredAeb.filter((a) => a.responsavel && a.responsavel.trim() !== ''),
    ];

    const map = allWithResp.reduce<
      Record<
        string,
        {
          nome: string;
          totalVendido: number;
          quantidadeVendas: number;
          bolicheTotal: number;
          fichasTotal: number;
          aebTotal: number;
        }
      >
    >((acc, curr) => {
      const nome = curr.responsavel.trim();
      if (!acc[nome]) {
        acc[nome] = {
          nome,
          totalVendido: 0,
          quantidadeVendas: 0,
          bolicheTotal: 0,
          fichasTotal: 0,
          aebTotal: 0,
        };
      }
      acc[nome].totalVendido += curr.preco;
      acc[nome].quantidadeVendas += 1;

      if ('tipo_venda' in curr) {
        if (curr.tipo_venda === 'Boliche') acc[nome].bolicheTotal += curr.preco;
        else if (curr.tipo_venda === 'Fichas') acc[nome].fichasTotal += curr.preco;
      } else {
        acc[nome].aebTotal += curr.preco;
      }

      return acc;
    }, {});

    return Object.values(map).sort((a, b) => b.totalVendido - a.totalVendido);
  }, [filteredVendas, filteredAeb]);

  // 1.2 Dia de Pico (maior faturamento somado)
  const diaDePico = useMemo(() => {
    const allSales = [...filteredVendas, ...filteredAeb];
    if (allSales.length === 0) return null;

    const map = allSales.reduce<Record<string, { data: string; total: number; qtd: number }>>(
      (acc, curr) => {
        const d = curr.data.trim();
        if (!acc[d]) acc[d] = { data: d, total: 0, qtd: 0 };
        acc[d].total += curr.preco;
        acc[d].qtd += 1;
        return acc;
      },
      {}
    );

    const sorted = Object.values(map).sort((a, b) => b.total - a.total);
    return sorted[0] || null;
  }, [filteredVendas, filteredAeb]);

  // 1.3 Horário de Pico (faixa com maior volume de vendas)
  const horarioDePico = useMemo(() => {
    const allSales = [...filteredVendas, ...filteredAeb];
    if (allSales.length === 0) return null;

    const map = allSales.reduce<
      Record<string, { faixa: string; total: number; qtd: number }>
    >((acc, curr) => {
      const match = (curr.hora || '').match(/^(\d{1,2})/);
      const h = match ? parseInt(match[1], 10) : 0;
      const faixa = `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`;
      if (!acc[faixa]) acc[faixa] = { faixa, total: 0, qtd: 0 };
      acc[faixa].total += curr.preco;
      acc[faixa].qtd += 1;
      return acc;
    }, {});

    const sorted = Object.values(map).sort((a, b) => b.qtd - a.qtd || b.total - a.total);
    return sorted[0] || null;
  }, [filteredVendas, filteredAeb]);

  // =========================================================================
  // SEÇÃO 2: DESEMPENHO DO BOLICHE
  // =========================================================================
  const bolicheMetrics = useMemo(() => {
    const bolicheSales = filteredVendas.filter((v) => v.tipo_venda === 'Boliche');
    const totalBoliche = bolicheSales.reduce((acc, curr) => acc + curr.preco, 0);

    const map = bolicheSales.reduce<Record<string, { nome: string; qtd: number; total: number }>>(
      (acc, curr) => {
        const nome = curr.item.trim();
        if (!acc[nome]) acc[nome] = { nome, qtd: 0, total: 0 };
        acc[nome].qtd += 1;
        acc[nome].total += curr.preco;
        return acc;
      },
      {}
    );

    const list = Object.values(map).sort((a, b) => b.qtd - a.qtd);
    const maisVendido = list[0] || null;
    const menosVendido = list.length > 1 ? list[list.length - 1] : null;

    // Gráfico de Pizza: Proporção Meia Hora vs Uma Hora
    const countMeia = bolicheSales.filter((v) =>
      v.item.toLowerCase().includes('meia') || v.item.toLowerCase().includes('30')
    ).length;
    const totalMeia = bolicheSales
      .filter((v) => v.item.toLowerCase().includes('meia') || v.item.toLowerCase().includes('30'))
      .reduce((a, c) => a + c.preco, 0);

    const countUma = bolicheSales.filter((v) =>
      v.item.toLowerCase().includes('uma') || v.item.toLowerCase().includes('1 hora')
    ).length;
    const totalUma = bolicheSales
      .filter((v) => v.item.toLowerCase().includes('uma') || v.item.toLowerCase().includes('1 hora'))
      .reduce((a, c) => a + c.preco, 0);

    const pieData = [
      { name: 'Meia Hora de Boliche', value: countMeia, valorTotal: totalMeia },
      { name: 'Uma Hora de Boliche', value: countUma, valorTotal: totalUma },
    ].filter((item) => item.value > 0);

    return {
      totalBoliche,
      totalLocacoes: bolicheSales.length,
      maisVendido,
      menosVendido,
      pieData,
    };
  }, [filteredVendas]);

  // =========================================================================
  // SEÇÃO 3: DESEMPENHO DE FICHAS
  // =========================================================================
  const fichasMetrics = useMemo(() => {
    const fichasSales = filteredVendas.filter((v) => v.tipo_venda === 'Fichas');
    const totalFichasReceita = fichasSales.reduce((acc, curr) => acc + curr.preco, 0);

    // Tipos de Fichas/Combos normalizados
    const tipos = [
      { id: 'fichas', label: 'Fichas Individuais', regex: /fichas? eletr[oô]nicas?|ficha individual/i, color: '#10b981' },
      { id: 'mini', label: 'Mini Combo', regex: /mini\s*combo/i, color: '#06b6d4' },
      { id: 'big', label: 'Big Combo', regex: /big\s*combo/i, color: '#3b82f6' },
      { id: 'mega', label: 'Mega Combo', regex: /mega\s*combo/i, color: '#8b5cf6' },
    ];

    const barData = tipos.map((t) => {
      const matchVendas = fichasSales.filter((v) => t.regex.test(v.item));
      const qtd = matchVendas.length;
      const total = matchVendas.reduce((acc, curr) => acc + curr.preco, 0);
      return {
        name: t.label,
        qtd,
        total,
        fill: t.color,
      };
    });

    // Combos Mais e Menos Vendidos (analisa Mini, Big e Mega)
    const combosApenas = barData.filter((b) => b.name.includes('Combo'));
    const combosOrdenados = [...combosApenas].sort((a, b) => b.qtd - a.qtd);
    const comboMaisVendido = combosOrdenados[0] && combosOrdenados[0].qtd > 0 ? combosOrdenados[0] : null;
    const comboMenosVendido =
      combosOrdenados.length > 1 && combosOrdenados[combosOrdenados.length - 1].qtd > 0
        ? combosOrdenados[combosOrdenados.length - 1]
        : null;

    return {
      totalFichasReceita,
      totalUnidades: fichasSales.length,
      comboMaisVendido,
      comboMenosVendido,
      barData,
    };
  }, [filteredVendas]);

  // =========================================================================
  // SEÇÃO 4: DESEMPENHO DE AEB (ALIMENTOS E BEBIDAS)
  // =========================================================================
  const aebMetrics = useMemo(() => {
    const totalAebReceita = filteredAeb.reduce((acc, curr) => acc + curr.preco, 0);

    const map = filteredAeb.reduce<
      Record<string, { nome: string; qtd: number; total: number }>
    >((acc, curr) => {
      const nome = curr.item.trim();
      if (!acc[nome]) acc[nome] = { nome, qtd: 0, total: 0 };
      acc[nome].qtd += 1;
      acc[nome].total += curr.preco;
      return acc;
    }, {});

    const listPorQtd = Object.values(map).sort((a, b) => b.qtd - a.qtd);
    const maisVendido = listPorQtd[0] || null;
    const menosVendido = listPorQtd.length > 1 ? listPorQtd[listPorQtd.length - 1] : null;

    // Top 5 Produtos que mais geraram receita em Reais (R$)
    const top5Receita = Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((item, idx) => ({
        name: item.nome.length > 18 ? item.nome.slice(0, 16) + '...' : item.nome,
        fullName: item.nome,
        receita: item.total,
        qtd: item.qtd,
        fill: TOP_AEB_COLORS[idx] || '#2563eb',
      }));

    return {
      totalAebReceita,
      totalItens: filteredAeb.length,
      maisVendido,
      menosVendido,
      top5Receita,
    };
  }, [filteredAeb]);

  const hasAnyData = vendas.length > 0 || aebSales.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Executivo & Filtro Global de Período */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-neutral-200/80 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900 tracking-tight">
                Módulo de Business Intelligence (BI) & Estatísticas
              </h2>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Dashboard Executivo
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Análise estratégica e consolidação inteligente de Boliche, Fichas e Alimentos & Bebidas (AeB).
            </p>
          </div>
        </div>

        {/* Seletor Global de Mês/Período */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-neutral-50 border border-neutral-200/90 rounded-lg p-1.5">
          <Filter className="w-3.5 h-3.5 text-neutral-500 ml-1.5 shrink-0" />
          <span className="text-xs font-semibold text-neutral-700">Período:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="text-xs font-medium bg-white border border-neutral-200 rounded-md px-2.5 py-1 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 cursor-pointer"
          >
            {availablePeriods.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!hasAnyData ? (
        /* Empty State */
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center mb-4">
            <Activity className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900">
            Nenhum dado disponível para análise estatística
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
            Importe relatórios Volux em PDF nas abas de Comandas ou Alimentos e Bebidas (AeB) para gerar relatórios, gráficos e rankings consolidados de vendas.
          </p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* SEÇÃO 1: VISÃO GERAL & RANKING DE OPERADORES */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider text-xs">
                  Seção 1 · Visão Geral & Ranking de Operadores
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-neutral-500">
                Faturamento Total: <strong className="text-neutral-900">{formatCurrencyBRL(totalFaturamento)}</strong> ({totalTransacoes} transações)
              </span>
            </div>

            {/* KPIs Destaque: Dia de Pico & Horário de Pico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card: Dia de Pico */}
              <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    Dia de Pico
                  </span>
                  <span className="text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200/60">
                    Maior Receita
                  </span>
                </div>
                {diaDePico ? (
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono-tabular">
                      Dia {diaDePico.data}
                    </div>
                    <div className="text-xs text-emerald-600 font-medium font-mono-tabular mt-0.5">
                      {formatCurrencyBRL(diaDePico.total)} · {diaDePico.qtd} vendas
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 py-1">Sem registros</div>
                )}
              </div>

              {/* Card: Horário de Pico */}
              <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Horário de Pico
                  </span>
                  <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200/60">
                    Maior Movimento
                  </span>
                </div>
                {horarioDePico ? (
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono-tabular">
                      {horarioDePico.faixa}
                    </div>
                    <div className="text-xs text-blue-600 font-medium font-mono-tabular mt-0.5">
                      {formatCurrencyBRL(horarioDePico.total)} · {horarioDePico.qtd} vendas
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 py-1">Sem registros</div>
                )}
              </div>

              {/* Card: Total Boliche & Fichas */}
              <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-neutral-500" />
                    Boliche & Fichas
                  </span>
                  <span className="text-[10px] font-mono-tabular text-neutral-500">
                    {filteredVendas.length} comandas
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono-tabular">
                  {formatCurrencyBRL(
                    filteredVendas.reduce((acc, curr) => acc + curr.preco, 0)
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Receita total de locações e fichas
                </div>
              </div>

              {/* Card: Total Alimentos e Bebidas */}
              <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-blue-600" />
                    Alimentos & Bebidas
                  </span>
                  <span className="text-[10px] font-mono-tabular text-neutral-500">
                    {filteredAeb.length} itens
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono-tabular">
                  {formatCurrencyBRL(aebMetrics.totalAebReceita)}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Receita consolidada do bar/conveniência
                </div>
              </div>
            </div>

            {/* Ranking Geral de Vendas por Responsável */}
            <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Ranking Geral de Vendas por Operador (Boliche + Fichas + AeB)
                  </h4>
                </div>
                <span className="text-xs text-neutral-500">
                  {rankingOperadores.length} {rankingOperadores.length === 1 ? 'operador com vendas' : 'operadores com vendas'}
                </span>
              </div>

              {rankingOperadores.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400">
                  Nenhum operador com vendas identificadas no período selecionado.
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Preencha o campo &quot;Responsável&quot; nas tabelas de Comandas ou AeB para visualizar o ranking.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rankingOperadores.map((op, index) => {
                    const medalhas = ['🥇', '🥈', '🥉'];
                    const medalha = medalhas[index] || null;
                    const percentualTotal =
                      totalFaturamento > 0 ? (op.totalVendido / totalFaturamento) * 100 : 0;

                    return (
                      <div
                        key={op.nome}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          index === 0
                            ? 'bg-amber-50/40 border-amber-200/80'
                            : index === 1
                            ? 'bg-neutral-50/70 border-neutral-200'
                            : index === 2
                            ? 'bg-orange-50/30 border-orange-200/60'
                            : 'bg-white border-neutral-200/70 hover:bg-neutral-50/50'
                        }`}
                      >
                        {/* Lado Esquerdo: Posição, Nome e Badges */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              index === 0
                                ? 'bg-amber-500 text-white shadow-xs'
                                : index === 1
                                ? 'bg-neutral-700 text-white'
                                : index === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            {medalha || `${index + 1}º`}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-900 truncate flex items-center gap-2">
                              <span>{index + 1}º Lugar: {op.nome} - {formatCurrencyBRL(op.totalVendido)}</span>
                              {index === 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  Top Performer
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                              <span>{op.quantidadeVendas} vendas</span>
                              <span>•</span>
                              <span className="font-mono-tabular">Boliche: {formatCurrencyBRL(op.bolicheTotal)}</span>
                              <span>•</span>
                              <span className="font-mono-tabular">Fichas: {formatCurrencyBRL(op.fichasTotal)}</span>
                              <span>•</span>
                              <span className="font-mono-tabular">AeB: {formatCurrencyBRL(op.aebTotal)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Lado Direito: Total em Reais e Barra de Participação */}
                        <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0">
                          <div className="text-base sm:text-lg font-bold text-neutral-900 font-mono-tabular">
                            {formatCurrencyBRL(op.totalVendido)}
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono-tabular">
                            {percentualTotal.toFixed(1)}% do total
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 2: DESEMPENHO DO BOLICHE */}
          {/* ========================================================================= */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider text-xs">
                  Seção 2 · Desempenho do Boliche
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-neutral-500">
                Receita Boliche: <strong className="text-neutral-900">{formatCurrencyBRL(bolicheMetrics.totalBoliche)}</strong> ({bolicheMetrics.totalLocacoes} locações)
              </span>
            </div>

            {/* KPIs: Mais e Menos Vendido do Boliche */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    Item Mais Vendido
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {bolicheMetrics.maisVendido ? bolicheMetrics.maisVendido.nome : 'Nenhum'}
                  </div>
                </div>
                {bolicheMetrics.maisVendido && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-700 font-mono-tabular">
                      {bolicheMetrics.maisVendido.qtd} locações
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(bolicheMetrics.maisVendido.total)}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-neutral-500" />
                    Item Menos Vendido
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-800 mt-1">
                    {bolicheMetrics.menosVendido ? bolicheMetrics.menosVendido.nome : bolicheMetrics.maisVendido?.nome || 'Nenhum'}
                  </div>
                </div>
                {bolicheMetrics.menosVendido && (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-neutral-700 font-mono-tabular">
                      {bolicheMetrics.menosVendido.qtd} locações
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(bolicheMetrics.menosVendido.total)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico de Pizza: Proporção Meia Hora vs Uma Hora */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-neutral-700 mb-2">
                Proporção de Locações: Meia Hora de Boliche vs Uma Hora de Boliche
              </h4>

              {bolicheMetrics.pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400">
                  Nenhuma venda de boliche no período selecionado.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={bolicheMetrics.pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={50}
                        paddingAngle={4}
                        label={({ name, percent }) =>
                          `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                        }
                      >
                        {bolicheMetrics.pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={BOLICHE_COLORS[index % BOLICHE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any, item: any) => [
                          `${value} locações (${formatCurrencyBRL(item.payload.valorTotal)})`,
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e5e5e5',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 3: DESEMPENHO DE FICHAS */}
          {/* ========================================================================= */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider text-xs">
                  Seção 3 · Desempenho de Fichas
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-neutral-500">
                Receita Fichas: <strong className="text-neutral-900">{formatCurrencyBRL(fichasMetrics.totalFichasReceita)}</strong> ({fichasMetrics.totalUnidades} registros)
              </span>
            </div>

            {/* KPIs: Combo Mais e Menos Vendido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                    Combo Mais Vendido
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {fichasMetrics.comboMaisVendido ? fichasMetrics.comboMaisVendido.name : 'Nenhum combo vendido'}
                  </div>
                </div>
                {fichasMetrics.comboMaisVendido && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-700 font-mono-tabular">
                      {fichasMetrics.comboMaisVendido.qtd} unidades
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(fichasMetrics.comboMaisVendido.total)}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-neutral-500" />
                    Combo Menos Vendido
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-800 mt-1">
                    {fichasMetrics.comboMenosVendido
                      ? fichasMetrics.comboMenosVendido.name
                      : fichasMetrics.comboMaisVendido?.name || 'Nenhum'}
                  </div>
                </div>
                {fichasMetrics.comboMenosVendido && (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-neutral-700 font-mono-tabular">
                      {fichasMetrics.comboMenosVendido.qtd} unidades
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(fichasMetrics.comboMenosVendido.total)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico de Colunas: Quantidade Vendida de Cada Tipo de Ficha */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-neutral-700 mb-2">
                Quantidade Vendida por Tipo de Ficha (Fichas Individuais, Mini Combo, Big Combo, Mega Combo)
              </h4>

              {fichasMetrics.barData.every((b) => b.qtd === 0) ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400">
                  Nenhuma venda de fichas no período selecionado.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={fichasMetrics.barData}
                      margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        stroke="#737373"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e5e5' }}
                      />
                      <YAxis
                        stroke="#737373"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e5e5' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${val} unidades (${formatCurrencyBRL(item.payload.total)})`,
                          'Vendido',
                        ]}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e5e5e5',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                        {fichasMetrics.barData.map((entry, index) => (
                          <Cell key={`bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 4: DESEMPENHO DE AEB (ALIMENTOS E BEBIDAS) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider text-xs">
                  Seção 4 · Desempenho de AeB (Alimentos e Bebidas)
                </h3>
              </div>
              <span className="text-xs font-mono-tabular text-neutral-500">
                Receita AeB: <strong className="text-neutral-900">{formatCurrencyBRL(aebMetrics.totalAebReceita)}</strong> ({aebMetrics.totalItens} itens vendidos)
              </span>
            </div>

            {/* KPIs: Produto Mais e Menos Vendido de AeB */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    Produto Mais Vendido (Volume)
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {aebMetrics.maisVendido ? aebMetrics.maisVendido.nome : 'Nenhum'}
                  </div>
                </div>
                {aebMetrics.maisVendido && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-blue-700 font-mono-tabular">
                      {aebMetrics.maisVendido.qtd} un.
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(aebMetrics.maisVendido.total)}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-neutral-500" />
                    Produto Menos Vendido (Volume)
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-800 mt-1">
                    {aebMetrics.menosVendido ? aebMetrics.menosVendido.nome : aebMetrics.maisVendido?.nome || 'Nenhum'}
                  </div>
                </div>
                {aebMetrics.menosVendido && (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-neutral-700 font-mono-tabular">
                      {aebMetrics.menosVendido.qtd} un.
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(aebMetrics.menosVendido.total)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Gráfico de Colunas: Top 5 Produtos com Maior Receita em Reais (R$) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-neutral-700">
                  Top 5 Produtos de Maior Receita Financeira (R$) · Lucratividade
                </h4>
                <span className="text-[11px] text-neutral-400">
                  Identificação dos itens que mais geraram faturamento
                </span>
              </div>

              {aebMetrics.top5Receita.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400">
                  Nenhum registro de AeB no período selecionado.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={aebMetrics.top5Receita}
                      margin={{ top: 20, right: 20, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis
                        dataKey="name"
                        stroke="#737373"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e5e5' }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis
                        stroke="#737373"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e5e5' }}
                        tickFormatter={(val) => `R$ ${val}`}
                      />
                      <Tooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${formatCurrencyBRL(Number(val))} (${item.payload.qtd} unidades vendidas)`,
                          item.payload.fullName,
                        ]}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e5e5e5',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                        {aebMetrics.top5Receita.map((entry, index) => (
                          <Cell key={`top-aeb-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
