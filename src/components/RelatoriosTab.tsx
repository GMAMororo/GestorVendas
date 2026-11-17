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
  Award,
  Calendar,
  Clock,
  CircleDot,
  Trophy,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
  UtensilsCrossed,
  Gift,
  Wrench,
  FileSpreadsheet,
  Ticket,
  FileDown,
  CheckCircle2,
  Coins,
} from 'lucide-react';
import {
  VendaComanda,
  VendaAeB,
  FechamentoTurnoFichas,
  TurnoAtivoCaixa,
  ModoRelatorioPDF,
} from '../types/venda';
import {
  formatCurrencyBRL,
  isRegistroCortesia,
  isRegistroManutencao,
  isRegistroConta3000,
  isRegistroVoucher,
  getValorMonetarioEfetivo,
  getValorNaoMonetarioVoucher,
  getTodayLocalISO,
  recordDateToISO,
} from '../utils/formatters';
import {
  buildOperationalReportPayload,
  downloadOperationalReportPDF,
} from '../utils/pdfReportGenerator';

interface RelatoriosTabProps {
  vendas: VendaComanda[];
  aebSales: VendaAeB[];
  fechamentos?: FechamentoTurnoFichas[];
  turnoAtivo?: TurnoAtivoCaixa | null;
}

// Cores Modernas Executivas (incluindo Amber para Cortesia e Slate/Cyan para Manutenção)
const BOLICHE_COLORS = ['#3b82f6', '#1d4ed8', '#f59e0b'];
const TOP_AEB_COLORS = ['#2563eb', '#0284c7', '#0d9488', '#16a34a', '#d97706'];

export const RelatoriosTab: React.FC<RelatoriosTabProps> = ({
  vendas,
  aebSales,
  fechamentos = [],
  turnoAtivo = null,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Todos os Tempos');

  // Datas disponíveis com vendas para facilitar seleção rápida no Gerador de PDF
  const availableISODates = useMemo(() => {
    const set = new Set<string>();
    vendas.forEach((v) => {
      if (!v.cancelado && v.status !== 'Cancelado' && v.data) {
        const iso = recordDateToISO(v.data);
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) set.add(iso);
      }
    });
    aebSales.forEach((a) => {
      if (!a.cancelado && a.status !== 'Cancelado' && a.data) {
        const iso = recordDateToISO(a.data);
        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) set.add(iso);
      }
    });
    return Array.from(set).sort();
  }, [vendas, aebSales]);

  // Estado do Gerador de Relatório Operacional em PDF
  const [reportDateISO, setReportDateISO] = useState<string>(() => {
    const today = getTodayLocalISO();
    return today;
  });
  const [reportModo, setReportModo] = useState<ModoRelatorioPDF>('DIA_COMPLETO');

  // Sincroniza a data do relatório com a última data com vendas caso hoje não tenha vendas
  React.useEffect(() => {
    if (availableISODates.length > 0 && !availableISODates.includes(reportDateISO)) {
      setReportDateISO(availableISODates[availableISODates.length - 1]);
    }
  }, [availableISODates.length]);

  const reportPayload = useMemo(
    () =>
      buildOperationalReportPayload(
        reportDateISO,
        reportModo,
        vendas,
        aebSales,
        fechamentos,
        turnoAtivo
      ),
    [reportDateISO, reportModo, vendas, aebSales, fechamentos, turnoAtivo]
  );

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

  // Filtragem dos dados ativos (inclui vendas normais, Conta 3000 com valor real, Cortesias R$ 0,00 e Manutenções R$ 0,00)
  const filteredVendas = useMemo(() => {
    return vendas.filter(
      (v) =>
        !v.cancelado &&
        v.status !== 'Cancelado' &&
        matchesPeriod(v.data)
    );
  }, [vendas, selectedPeriod]);

  const filteredAeb = useMemo(() => {
    return aebSales.filter(
      (a) =>
        !a.cancelado &&
        a.status !== 'Cancelado' &&
        matchesPeriod(a.data)
    );
  }, [aebSales, selectedPeriod]);

  // Total combinado de faturamento monetário no período (Vouchers não somam no caixa em dinheiro)
  const totalFaturamento = useMemo(() => {
    const sumVendas = filteredVendas.reduce(
      (acc, curr) => acc + getValorMonetarioEfetivo(curr),
      0
    );
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const sumAeb = filteredAeb
      .filter((a) => !vendasIds.has(a.id))
      .reduce((acc, curr) => acc + getValorMonetarioEfetivo(curr), 0);
    return sumVendas + sumAeb;
  }, [filteredVendas, filteredAeb]);

  const totalVouchersPeriodo = useMemo(() => {
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const all = [
      ...filteredVendas,
      ...filteredAeb.filter((a) => !vendasIds.has(a.id)),
    ].filter((r) => isRegistroVoucher(r));
    const qtd = all.reduce((acc, r) => acc + Math.max(1, Number(r.qtde) || 1), 0);
    const valor = all.reduce((acc, r) => acc + getValorNaoMonetarioVoucher(r), 0);
    return { qtd, valor };
  }, [filteredVendas, filteredAeb]);

  const totalTransacoes = useMemo(() => {
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const sumVendasQtde = filteredVendas.reduce(
      (acc, v) => acc + Math.max(1, Number(v.qtde) || 1),
      0
    );
    const sumUniqueAebQtde = filteredAeb
      .filter((a) => !vendasIds.has(a.id))
      .reduce((acc, a) => acc + Math.max(1, Number(a.qtde) || 1), 0);
    return sumVendasQtde + sumUniqueAebQtde;
  }, [filteredVendas, filteredAeb]);

  const totalCortesiasPeriodo = useMemo(() => {
    const cVendas = filteredVendas
      .filter((v) => isRegistroCortesia(v))
      .reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0);
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const cAeb = filteredAeb
      .filter((a) => !vendasIds.has(a.id) && isRegistroCortesia(a))
      .reduce((acc, a) => acc + Math.max(1, Number(a.qtde) || 1), 0);
    return cVendas + cAeb;
  }, [filteredVendas, filteredAeb]);

  const totalManutencoesPeriodo = useMemo(() => {
    return filteredVendas
      .filter((v) => isRegistroManutencao(v))
      .reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0);
  }, [filteredVendas]);

  // =========================================================================
  // RESUMO CONTA 3000 (ADM = S / CORTESIAS VOLUX) PARA FECHAMENTO MENSAL
  // =========================================================================
  const conta3000Metrics = useMemo(() => {
    const boliche3000 = filteredVendas.filter(
      (v) => v.tipo_venda === 'Boliche' && isRegistroConta3000(v)
    );
    const fichas3000 = filteredVendas.filter(
      (v) => v.tipo_venda === 'Fichas' && isRegistroConta3000(v)
    );

    // Dedup AeB entre filteredAeb e filteredVendas (caso lançado pela Aba 1)
    const aeb3000Map = new Map<string, VendaAeB | VendaComanda>();
    filteredAeb.forEach((a) => {
      if (isRegistroConta3000(a)) {
        aeb3000Map.set(a.id, a);
      }
    });
    filteredVendas.forEach((v) => {
      if (v.tipo_venda === 'AeB' && isRegistroConta3000(v) && !aeb3000Map.has(v.id)) {
        aeb3000Map.set(v.id, v);
      }
    });
    const aeb3000 = Array.from(aeb3000Map.values());

    const sumUnidades = (arr: Array<{ qtde?: number }>) =>
      arr.reduce((acc, item) => acc + Math.max(1, Number(item.qtde) || 1), 0);
    const sumFinanceiro = (arr: Array<{ preco: number }>) =>
      arr.reduce((acc, item) => acc + item.preco, 0);

    const bolicheComandas = boliche3000.length;
    const bolicheUnidades = sumUnidades(boliche3000);
    const bolicheValor = sumFinanceiro(boliche3000);

    const fichasComandas = fichas3000.length;
    const fichasUnidades = sumUnidades(fichas3000);
    const fichasValor = sumFinanceiro(fichas3000);

    const aebComandas = aeb3000.length;
    const aebUnidades = sumUnidades(aeb3000);
    const aebValor = sumFinanceiro(aeb3000);

    const totalComandas = bolicheComandas + fichasComandas + aebComandas;
    const totalUnidades = bolicheUnidades + fichasUnidades + aebUnidades;
    const totalValor = bolicheValor + fichasValor + aebValor;

    return {
      boliche: {
        comandas: bolicheComandas,
        unidades: bolicheUnidades,
        valor: bolicheValor,
      },
      fichas: {
        comandas: fichasComandas,
        unidades: fichasUnidades,
        valor: fichasValor,
      },
      aeb: {
        comandas: aebComandas,
        unidades: aebUnidades,
        valor: aebValor,
      },
      totalComandas,
      totalUnidades,
      totalValor,
    };
  }, [filteredVendas, filteredAeb]);

  // =========================================================================
  // SEÇÃO 1: RANKING DE OPERADORES & CARDS DE DESTAQUE (KPIS)
  // =========================================================================

  // 1.1 Ranking Geral de Operadores (Boliche + Fichas + AeB)
  const rankingOperadores = useMemo(() => {
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const allWithResp = [
      ...filteredVendas.filter((v) => v.responsavel && v.responsavel.trim() !== ''),
      ...filteredAeb.filter(
        (a) => !vendasIds.has(a.id) && a.responsavel && a.responsavel.trim() !== ''
      ),
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
          cortesiasCount: number;
          manutencoesCount: number;
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
          cortesiasCount: 0,
          manutencoesCount: 0,
        };
      }
      const isCort = isRegistroCortesia(curr);
      const isManut = 'tipo_venda' in curr && isRegistroManutencao(curr);
      const valor = getValorMonetarioEfetivo(curr);
      const qtde = Math.max(1, Number(curr.qtde) || 1);

      acc[nome].totalVendido += valor;
      acc[nome].quantidadeVendas += qtde;
      if (isCort) acc[nome].cortesiasCount += qtde;
      if (isManut) acc[nome].manutencoesCount += qtde;

      if ('tipo_venda' in curr) {
        if (curr.tipo_venda === 'Boliche') acc[nome].bolicheTotal += valor;
        else if (curr.tipo_venda === 'Fichas') acc[nome].fichasTotal += valor;
        else if (curr.tipo_venda === 'AeB') acc[nome].aebTotal += valor;
      } else {
        acc[nome].aebTotal += valor;
      }

      return acc;
    }, {});

    return Object.values(map).sort(
      (a, b) => b.totalVendido - a.totalVendido || b.quantidadeVendas - a.quantidadeVendas
    );
  }, [filteredVendas, filteredAeb]);

  // 1.2 Dia de Pico (maior faturamento somado, desempate por volume de unidades)
  const diaDePico = useMemo(() => {
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const allSales = [
      ...filteredVendas,
      ...filteredAeb.filter((a) => !vendasIds.has(a.id)),
    ];
    if (allSales.length === 0) return null;

    const map = allSales.reduce<Record<string, { data: string; total: number; qtd: number }>>(
      (acc, curr) => {
        const d = curr.data.trim();
        const qtde = Math.max(1, Number(curr.qtde) || 1);
        if (!acc[d]) acc[d] = { data: d, total: 0, qtd: 0 };
        acc[d].total += getValorMonetarioEfetivo(curr);
        acc[d].qtd += qtde;
        return acc;
      },
      {}
    );

    const sorted = Object.values(map).sort((a, b) => b.total - a.total || b.qtd - a.qtd);
    return sorted[0] || null;
  }, [filteredVendas, filteredAeb]);

  // 1.3 Horário de Pico (faixa com maior volume de vendas)
  const horarioDePico = useMemo(() => {
    const vendasIds = new Set(filteredVendas.map((v) => v.id));
    const allSales = [
      ...filteredVendas,
      ...filteredAeb.filter((a) => !vendasIds.has(a.id)),
    ];
    if (allSales.length === 0) return null;

    const map = allSales.reduce<
      Record<string, { faixa: string; total: number; qtd: number }>
    >((acc, curr) => {
      const match = (curr.hora || '').match(/^(\d{1,2})/);
      const h = match ? parseInt(match[1], 10) : 0;
      const faixa = `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`;
      const qtde = Math.max(1, Number(curr.qtde) || 1);
      if (!acc[faixa]) acc[faixa] = { faixa, total: 0, qtd: 0 };
      acc[faixa].total += getValorMonetarioEfetivo(curr);
      acc[faixa].qtd += qtde;
      return acc;
    }, {});

    const sorted = Object.values(map).sort((a, b) => b.qtd - a.qtd || b.total - a.total);
    return sorted[0] || null;
  }, [filteredVendas, filteredAeb]);

  // =========================================================================
  // SEÇÃO 2: DESEMPENHO DO BOLICHE (CONTA 3000 MANTÉM VALOR REAL DO PDF)
  // =========================================================================
  const bolicheMetrics = useMemo(() => {
    const bolicheSales = filteredVendas.filter((v) => v.tipo_venda === 'Boliche');
    const totalBoliche = bolicheSales.reduce((acc, curr) => acc + getValorMonetarioEfetivo(curr), 0);
    const totalCortesiasBoliche = bolicheSales
      .filter((v) => isRegistroCortesia(v))
      .reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0);

    // Agrupamento por tipo/item
    const map = bolicheSales.reduce<Record<string, { nome: string; qtd: number; total: number }>>(
      (acc, curr) => {
        const isCort = isRegistroCortesia(curr);
        const nome = isCort
          ? curr.item.toLowerCase().includes('cortesia')
            ? curr.item.trim()
            : `${curr.item.trim()} (Cortesia)`
          : curr.item.trim();
        const qtde = Math.max(1, Number(curr.qtde) || 1);
        if (!acc[nome]) acc[nome] = { nome, qtd: 0, total: 0 };
        acc[nome].qtd += qtde;
        acc[nome].total += getValorMonetarioEfetivo(curr);
        return acc;
      },
      {}
    );

    const list = Object.values(map).sort((a, b) => b.qtd - a.qtd);
    const maisVendido = list[0] || null;
    const menosVendido = list.length > 1 ? list[list.length - 1] : null;

    // Gráfico de Pizza: Proporção Meia Hora vs Uma Hora vs Cortesia
    const meiaHoraPagas = bolicheSales.filter(
      (v) =>
        !isRegistroCortesia(v) &&
        (v.item.toLowerCase().includes('meia') || v.item.toLowerCase().includes('30'))
    );
    const countMeia = meiaHoraPagas.reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0);
    const totalMeia = meiaHoraPagas.reduce((a, c) => a + getValorMonetarioEfetivo(c), 0);

    const umaHoraPagas = bolicheSales.filter(
      (v) =>
        !isRegistroCortesia(v) &&
        (v.item.toLowerCase().includes('uma') || v.item.toLowerCase().includes('1 hora'))
    );
    const countUma = umaHoraPagas.reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0);
    const totalUma = umaHoraPagas.reduce((a, c) => a + getValorMonetarioEfetivo(c), 0);

    const cortesiasBolicheList = bolicheSales.filter((v) => isRegistroCortesia(v));
    const countCortesiaBoliche = cortesiasBolicheList.reduce(
      (acc, v) => acc + Math.max(1, Number(v.qtde) || 1),
      0
    );
    const totalCortesiaBolicheValor = cortesiasBolicheList.reduce((a, c) => a + c.preco, 0);

    const pieData = [
      { name: 'Meia Hora de Boliche', value: countMeia, valorTotal: totalMeia },
      { name: 'Uma Hora de Boliche', value: countUma, valorTotal: totalUma },
      { name: 'Cortesia / ADM 3000-3030 (Boliche)', value: countCortesiaBoliche, valorTotal: totalCortesiaBolicheValor },
    ].filter((item) => item.value > 0);

    return {
      totalBoliche,
      totalLocacoes: bolicheSales.reduce((acc, v) => acc + Math.max(1, Number(v.qtde) || 1), 0),
      totalCortesiasBoliche,
      totalCortesiaBolicheValor,
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
    const totalFichasReceita = fichasSales.reduce(
      (acc, curr) => acc + getValorMonetarioEfetivo(curr),
      0
    );

    const vendasPagasFichas = fichasSales.filter(
      (v) => (!isRegistroCortesia(v) || isRegistroConta3000(v)) && !isRegistroManutencao(v)
    );
    const vendasCortesiaFichas = fichasSales.filter((v) => isRegistroCortesia(v));
    const vendasManutencaoFichas = fichasSales.filter((v) => isRegistroManutencao(v));

    const sumQtde = (arr: VendaComanda[]) =>
      arr.reduce((acc, curr) => acc + Math.max(1, Number(curr.qtde) || 1), 0);
    const sumTotal = (arr: VendaComanda[]) =>
      arr.reduce((acc, curr) => acc + getValorMonetarioEfetivo(curr), 0);

    const fichasIndividuaisPagas = vendasPagasFichas.filter((v) =>
      /fichas? eletr[oô]nicas?|ficha individual|ficha de jogos/i.test(v.item)
    );
    const miniComboPagos = vendasPagasFichas.filter((v) => /mini\s*combo/i.test(v.item));
    const bigComboPagos = vendasPagasFichas.filter((v) => /big\s*combo/i.test(v.item));
    const megaComboPagos = vendasPagasFichas.filter((v) => /mega\s*combo/i.test(v.item));

    // Agrupamento completo no BI
    const barData = [
      {
        name: 'Fichas Individuais',
        qtd: sumQtde(fichasIndividuaisPagas),
        total: sumTotal(fichasIndividuaisPagas),
        fill: '#10b981',
      },
      {
        name: 'Mini Combo',
        qtd: sumQtde(miniComboPagos),
        total: sumTotal(miniComboPagos),
        fill: '#06b6d4',
      },
      {
        name: 'Big Combo',
        qtd: sumQtde(bigComboPagos),
        total: sumTotal(bigComboPagos),
        fill: '#3b82f6',
      },
      {
        name: 'Mega Combo',
        qtd: sumQtde(megaComboPagos),
        total: sumTotal(megaComboPagos),
        fill: '#8b5cf6',
      },
      {
        name: 'Cortesia',
        qtd: sumQtde(vendasCortesiaFichas),
        total: sumTotal(vendasCortesiaFichas),
        fill: '#f59e0b',
      },
      {
        name: 'Manutenção',
        qtd: sumQtde(vendasManutencaoFichas),
        total: 0,
        fill: '#64748b',
      },
    ];

    // Combos Mais e Menos Vendidos (analisa Mini, Big e Mega)
    const combosApenas = barData.filter((b) => b.name.includes('Combo'));
    const combosOrdenados = [...combosApenas].sort((a, b) => b.qtd - a.qtd);
    const comboMaisVendido =
      combosOrdenados[0] && combosOrdenados[0].qtd > 0 ? combosOrdenados[0] : null;
    const comboMenosVendido =
      combosOrdenados.length > 1 && combosOrdenados[combosOrdenados.length - 1].qtd > 0
        ? combosOrdenados[combosOrdenados.length - 1]
        : null;

    return {
      totalFichasReceita,
      totalUnidades: sumQtde(fichasSales),
      totalCortesiasFichas: sumQtde(vendasCortesiaFichas),
      totalCortesiasFichasValor: sumTotal(vendasCortesiaFichas),
      totalManutencoesFichas: sumQtde(vendasManutencaoFichas),
      comboMaisVendido,
      comboMenosVendido,
      barData,
    };
  }, [filteredVendas]);

  // =========================================================================
  // SEÇÃO 4: DESEMPENHO DE AEB (ALIMENTOS E BEBIDAS)
  // =========================================================================
  const aebMetrics = useMemo(() => {
    const totalAebReceita = filteredAeb.reduce(
      (acc, curr) => acc + getValorMonetarioEfetivo(curr),
      0
    );
    const totalCortesiasAeb = filteredAeb
      .filter((a) => isRegistroCortesia(a))
      .reduce((acc, a) => acc + Math.max(1, Number(a.qtde) || 1), 0);

    const map = filteredAeb.reduce<
      Record<string, { nome: string; qtd: number; total: number }>
    >((acc, curr) => {
      const isCort = isRegistroCortesia(curr);
      const nome = isCort
        ? curr.item.toLowerCase().includes('cortesia')
          ? curr.item.trim()
          : `${curr.item.trim()} (Cortesia)`
        : curr.item.trim();
      const qtde = Math.max(1, Number(curr.qtde) || 1);
      if (!acc[nome]) acc[nome] = { nome, qtd: 0, total: 0 };
      acc[nome].qtd += qtde;
      acc[nome].total += getValorMonetarioEfetivo(curr);
      return acc;
    }, {});

    const listPorQtd = Object.values(map).sort((a, b) => b.qtd - a.qtd);
    const maisVendido = listPorQtd[0] || null;
    const menosVendido = listPorQtd.length > 1 ? listPorQtd[listPorQtd.length - 1] : null;

    // Top 5 Produtos (ordena por receita e, em caso de R$ 0,00 / empate, por quantidade)
    const top5Receita = Object.values(map)
      .sort((a, b) => b.total - a.total || b.qtd - a.qtd)
      .slice(0, 5)
      .map((item, idx) => ({
        name: item.nome.length > 18 ? item.nome.slice(0, 16) + '...' : item.nome,
        fullName: item.nome,
        receita: item.total,
        qtd: item.qtd,
        fill: TOP_AEB_COLORS[idx] || '#2563eb',
      }));

    const totalUnidadesAeb = filteredAeb.reduce(
      (acc, a) => acc + Math.max(1, Number(a.qtde) || 1),
      0
    );

    return {
      totalAebReceita,
      totalItens: totalUnidadesAeb,
      totalCortesiasAeb,
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
              Análise estratégica, Relatório Operacional em PDF por Turno, Contas ADM (3000 / 3030), Vouchers, Cortesias e Manutenção.
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

      {/* ========================================================================= */}
      {/* SEÇÃO ESPECIAL: 📄 GERAR RELATÓRIO OPERACIONAL EM PDF POR TURNO           */}
      {/* ========================================================================= */}
      <div className="bg-white border-2 border-neutral-900/15 rounded-xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                📄 Gerar Relatório Operacional em PDF
              </h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Consolidado · Sem Repetição · Com Gráficos
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Selecione a data e o modo do relatório (Manhã 09:00–15:59, Noite 16:00–23:00 ou Dia Completo) para conferir e baixar o PDF executivo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor de Data */}
            <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              <label htmlFor="pdf-report-date" className="text-xs font-semibold text-neutral-700">
                Data:
              </label>
              <input
                id="pdf-report-date"
                type="date"
                value={reportDateISO}
                onChange={(e) => setReportDateISO(e.target.value)}
                className="bg-white border border-neutral-200 rounded px-2 py-1 text-xs font-mono-tabular font-semibold text-neutral-900 focus:outline-none focus:border-neutral-900"
              />
            </div>

            {/* Seletor de Modo do Relatório */}
            <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <label htmlFor="pdf-report-modo" className="text-xs font-semibold text-neutral-700">
                Modo:
              </label>
              <select
                id="pdf-report-modo"
                value={reportModo}
                onChange={(e) => setReportModo(e.target.value as ModoRelatorioPDF)}
                className="bg-white border border-neutral-200 rounded px-2 py-1 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-neutral-900 cursor-pointer"
              >
                <option value="MANHA">Turno Manhã (09:00 às 15:59)</option>
                <option value="NOITE">Turno Noite (16:00 às 23:00)</option>
                <option value="DIA_COMPLETO">
                  Dia Completo (Manhã + Noite comparados lado a lado)
                </option>
              </select>
            </div>

            {/* Botão Baixar PDF */}
            <button
              type="button"
              onClick={() => downloadOperationalReportPDF(reportPayload)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Baixar PDF Executivo</span>
            </button>
          </div>
        </div>

        {/* Atalhos Rápidos de Datas com Vendas */}
        {availableISODates.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-neutral-500 font-medium">Datas com registros:</span>
            {availableISODates.map((iso) => {
              const [, mm, dd] = iso.split('-');
              const isSelected = reportDateISO === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setReportDateISO(iso)}
                  className={`px-2 py-0.5 rounded font-mono-tabular text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-900 text-white font-bold'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {dd}/{mm}
                </button>
              );
            })}
          </div>
        )}

        {/* Prévia Consolidada da Estrutura Obrigatória do PDF */}
        <div className="space-y-4 bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-4">
          {/* 1. Resumo Executivo do Turno */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-white border border-emerald-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase text-emerald-800">
                Caixa Efetivo
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-neutral-900 mt-0.5">
                {formatCurrencyBRL(reportPayload.primary.faturamentoEfetivoCaixa)}
              </div>
              <div className="text-[10px] text-neutral-500">S/ Vouchers</div>
            </div>

            <div className="bg-white border border-indigo-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase text-indigo-800">
                Total Serviços
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-neutral-900 mt-0.5">
                {formatCurrencyBRL(reportPayload.primary.totalServicosCaixa)}
              </div>
              <div className="text-[10px] text-neutral-500">
                Bol: {formatCurrencyBRL(reportPayload.primary.totalBolicheCaixa)} | Fic: {formatCurrencyBRL(reportPayload.primary.totalFichasCaixa)}
              </div>
            </div>

            <div className="bg-white border border-blue-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase text-blue-800">
                Total A&B
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-neutral-900 mt-0.5">
                {formatCurrencyBRL(reportPayload.primary.totalAeBCaixa)}
              </div>
              <div className="text-[10px] text-neutral-500">
                {reportPayload.primary.aebRows.reduce((a, r) => a + r.qtdeTotal, 0)} un. vendidas
              </div>
            </div>

            <div className="bg-white border border-purple-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase text-purple-800">
                🎟️ Vouchers
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-purple-900 mt-0.5">
                {reportPayload.primary.vouchersQtd} un.
              </div>
              <div className="text-[10px] text-purple-700 font-medium">
                {formatCurrencyBRL(reportPayload.primary.vouchersValorNaoMonetario)} não monetário
              </div>
            </div>

            <div className="bg-white border border-amber-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase text-amber-800">
                ADM (3000/3030)
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-amber-900 mt-0.5">
                {reportPayload.primary.cortesias3000Qtd} un.
              </div>
              <div className="text-[10px] text-amber-700">
                {formatCurrencyBRL(reportPayload.primary.cortesias3000Valor)} (Manuais: {reportPayload.primary.cortesiasManuaisQtd})
              </div>
            </div>

            <div className="bg-white border border-cyan-200 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase text-cyan-800">
                Manutenções
              </div>
              <div className="text-sm sm:text-base font-bold font-mono-tabular text-cyan-900 mt-0.5">
                {reportPayload.primary.manutencoesQtd} un.
              </div>
              <div className="text-[10px] text-cyan-700">R$ 0,00 (Testes)</div>
            </div>
          </div>

          {/* Se Modo for DIA_COMPLETO: Comparativo Manhã vs Noite lado a lado */}
          {reportModo === 'DIA_COMPLETO' && reportPayload.manha && reportPayload.noite && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'Turno Manhã (09:00 às 15:59)', data: reportPayload.manha, badgeClass: 'bg-amber-100 text-amber-900 border-amber-300' },
                { label: 'Turno Noite (16:00 às 23:00)', data: reportPayload.noite, badgeClass: 'bg-blue-100 text-blue-900 border-blue-300' },
              ].map(({ label, data, badgeClass }) => (
                <div key={label} className="bg-white border border-neutral-200 rounded-lg p-3.5 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                      {label}
                    </span>
                    <span className="text-sm font-bold font-mono-tabular text-neutral-900">
                      Caixa: {formatCurrencyBRL(data.faturamentoEfetivoCaixa)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular text-neutral-600 pt-1 border-t border-neutral-100">
                    <span>Boliche: <strong>{formatCurrencyBRL(data.totalBolicheCaixa)}</strong></span>
                    <span>Fichas: <strong>{formatCurrencyBRL(data.totalFichasCaixa)}</strong></span>
                    <span>A&B: <strong>{formatCurrencyBRL(data.totalAeBCaixa)}</strong></span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-500">
                    <span>🎟️ Vouchers: {data.vouchersQtd} un. ({formatCurrencyBRL(data.vouchersValorNaoMonetario)})</span>
                    <span>Saída Fichas: {data.auditoriaFichas.saidaSistemaPrata}P / {data.auditoriaFichas.saidaSistemaDourada}D</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabelas Consolidadas Lado a Lado (Serviços Sem Repetição + A&B Sem Repetição) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tabela 3: Serviços Consolidados */}
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="px-3.5 py-2.5 bg-neutral-100/80 border-b border-neutral-200 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  3. Serviços Consolidados (Boliche & Fichas) — Sem Repetição
                </span>
                <span className="text-[11px] font-mono-tabular text-neutral-500">
                  {reportPayload.primary.servicosRows.length} tipos
                </span>
              </div>
              {reportPayload.primary.servicosRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400">
                  Nenhum serviço vendido neste turno.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-semibold uppercase text-neutral-500">
                      <th className="py-2 px-3">Serviço</th>
                      <th className="py-2 px-2 text-center">Qtde Total</th>
                      <th className="py-2 px-2 text-center">Vouchers / Cort.</th>
                      <th className="py-2 px-3 text-right">Total Efetivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {reportPayload.primary.servicosRows.map((row) => (
                      <tr key={`${row.categoria}-${row.item}`} className="hover:bg-neutral-50">
                        <td className="py-2 px-3 font-medium text-neutral-900">
                          {row.item}
                        </td>
                        <td className="py-2 px-2 text-center font-mono-tabular font-bold text-neutral-800">
                          {row.qtdeTotal}x
                        </td>
                        <td className="py-2 px-2 text-center text-[11px] text-purple-700 font-medium">
                          {row.vouchersQtd > 0 || row.cortesiasQtd > 0 || row.manutencoesQtd > 0
                            ? [
                                row.vouchersQtd > 0 ? `${row.vouchersQtd} Vouch.` : '',
                                row.cortesiasQtd > 0 ? `${row.cortesiasQtd} Cort.` : '',
                                row.manutencoesQtd > 0 ? `${row.manutencoesQtd} Manut.` : '',
                              ]
                                .filter(Boolean)
                                .join(' / ')
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-neutral-900">
                          {formatCurrencyBRL(row.totalEfetivoCaixa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Tabela 4: Alimentos e Bebidas Consolidados */}
            <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <div className="px-3.5 py-2.5 bg-neutral-100/80 border-b border-neutral-200 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                  4. Alimentos e Bebidas (A&B) — Sem Repetição
                </span>
                <span className="text-[11px] font-mono-tabular text-neutral-500">
                  {reportPayload.primary.aebRows.length} produtos
                </span>
              </div>
              {reportPayload.primary.aebRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  <span>Sem vendas de A&B no turno (R$ 0,00)</span>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-semibold uppercase text-neutral-500">
                      <th className="py-2 px-3">Produto (A&B)</th>
                      <th className="py-2 px-2 text-center">Qtde Total</th>
                      <th className="py-2 px-2 text-center">Vouchers / Cort.</th>
                      <th className="py-2 px-3 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {reportPayload.primary.aebRows.map((row) => (
                      <tr key={row.item} className="hover:bg-neutral-50">
                        <td className="py-2 px-3 font-medium text-neutral-900">
                          {row.item}
                        </td>
                        <td className="py-2 px-2 text-center font-mono-tabular font-bold text-neutral-800">
                          {row.qtdeTotal}x
                        </td>
                        <td className="py-2 px-2 text-center text-[11px] text-purple-700 font-medium">
                          {row.vouchersQtd > 0 || row.cortesiasQtd > 0
                            ? [
                                row.vouchersQtd > 0 ? `${row.vouchersQtd} Vouch.` : '',
                                row.cortesiasQtd > 0 ? `${row.cortesiasQtd} Cort.` : '',
                              ]
                                .filter(Boolean)
                                .join(' / ')
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-neutral-900">
                          {formatCurrencyBRL(row.valorTotalEfetivo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 5. Auditoria Física de Fichas do Turno + Ocorrências */}
          <div className="bg-white border border-neutral-200 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-neutral-900">
                  5. Auditoria Física de Fichas ({reportPayload.primary.auditoriaFichas.statusLabel}):
                </span>
                <div className="text-neutral-600 font-mono-tabular mt-0.5">
                  Pratas: Ini {reportPayload.primary.auditoriaFichas.inicialPrata} + Rep {reportPayload.primary.auditoriaFichas.reposicaoPrata} - Saída {reportPayload.primary.auditoriaFichas.saidaSistemaPrata} = Esp <strong>{reportPayload.primary.auditoriaFichas.esperadoPrata}</strong>
                  {'  |  '}
                  Douradas: Ini {reportPayload.primary.auditoriaFichas.inicialDourada} + Rep {reportPayload.primary.auditoriaFichas.reposicaoDourada} - Saída {reportPayload.primary.auditoriaFichas.saidaSistemaDourada} = Esp <strong>{reportPayload.primary.auditoriaFichas.esperadoDourada}</strong>
                </div>
              </div>
            </div>
            <div className="text-neutral-500 font-mono-tabular">
              Ocorrências/Obs no turno: <strong>{reportPayload.primary.ocorrencias.length}</strong>
            </div>
          </div>
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
            Importe relatórios Volux em PDF ou adicione vendas manuais para gerar relatórios, gráficos e rankings consolidados.
          </p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* QUADRO DE FECHAMENTO MENSAL: RESUMO CONTAS ADM (3000 / 3030) */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 border border-amber-300/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/70">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                      Resumo Contas ADM (3000 / 3030)
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                      ADM = S · Espaços 3000 e 3030
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Quadro consolidado para fechamento mensal: quantidade de comandas/itens lançados nas Contas ADM 3000 e 3030 e soma financeira real extraída do Volux.
                  </p>
                </div>
              </div>

              <div className="bg-white/90 border border-amber-300 rounded-xl px-4 py-2.5 text-right shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Soma Financeira Contas ADM 3000 / 3030 ({selectedPeriod})
                </div>
                <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-amber-950">
                  {formatCurrencyBRL(conta3000Metrics.totalValor)}
                </div>
                <div className="text-[11px] font-mono-tabular text-amber-800">
                  {conta3000Metrics.totalComandas} {conta3000Metrics.totalComandas === 1 ? 'registro' : 'registros'} · {conta3000Metrics.totalUnidades} unid.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Contas ADM 3000 / 3030: Boliche */}
              <div className="bg-white rounded-xl border border-amber-200/80 p-4 flex items-center justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 uppercase tracking-wider">
                    <CircleDot className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Boliche (ADM 3000 / 3030)</span>
                  </div>
                  <div className="mt-1.5 text-lg font-bold text-neutral-900 font-mono-tabular">
                    {formatCurrencyBRL(conta3000Metrics.boliche.valor)}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 font-mono-tabular">
                    {conta3000Metrics.boliche.comandas} {conta3000Metrics.boliche.comandas === 1 ? 'comanda' : 'comandas'} ({conta3000Metrics.boliche.unidades} unid.)
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono-tabular bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {conta3000Metrics.boliche.unidades}x
                </span>
              </div>

              {/* Contas ADM 3000 / 3030: Fichas */}
              <div className="bg-white rounded-xl border border-amber-200/80 p-4 flex items-center justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wider">
                    <Ticket className="w-3.5 h-3.5 text-amber-600" />
                    <span>Fichas (ADM 3000 / 3030)</span>
                  </div>
                  <div className="mt-1.5 text-lg font-bold text-neutral-900 font-mono-tabular">
                    {formatCurrencyBRL(conta3000Metrics.fichas.valor)}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 font-mono-tabular">
                    {conta3000Metrics.fichas.comandas} {conta3000Metrics.fichas.comandas === 1 ? 'comanda' : 'comandas'} ({conta3000Metrics.fichas.unidades} unid.)
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono-tabular bg-amber-50 text-amber-800 border border-amber-200">
                  {conta3000Metrics.fichas.unidades}x
                </span>
              </div>

              {/* Contas ADM 3000 / 3030: AeB */}
              <div className="bg-white rounded-xl border border-amber-200/80 p-4 flex items-center justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 uppercase tracking-wider">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-blue-600" />
                    <span>AeB (ADM 3000 / 3030)</span>
                  </div>
                  <div className="mt-1.5 text-lg font-bold text-neutral-900 font-mono-tabular">
                    {formatCurrencyBRL(conta3000Metrics.aeb.valor)}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 font-mono-tabular">
                    {conta3000Metrics.aeb.comandas} {conta3000Metrics.aeb.comandas === 1 ? 'comanda' : 'comandas'} ({conta3000Metrics.aeb.unidades} unid.)
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono-tabular bg-blue-50 text-blue-700 border border-blue-200">
                  {conta3000Metrics.aeb.unidades}x
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEÇÃO 1: VISÃO GERAL & RANKING DE OPERADORES */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider text-xs">
                  Seção 1 · Visão Geral & Ranking de Operadores
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-neutral-500">
                <span>
                  Faturamento Efetivo Caixa: <strong className="text-neutral-900">{formatCurrencyBRL(totalFaturamento)}</strong> ({totalTransacoes} registros)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                  🎟️ Vouchers: {totalVouchersPeriodo.qtd} un. ({formatCurrencyBRL(totalVouchersPeriodo.valor)} não monetário)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  <Gift className="w-3 h-3 text-amber-600" />
                  Cortesias: {totalCortesiasPeriodo}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold">
                  <Wrench className="w-3 h-3 text-cyan-600" />
                  Manutenção: {totalManutencoesPeriodo}
                </span>
              </div>
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
                      {formatCurrencyBRL(diaDePico.total)} · {diaDePico.qtd} registros
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
                      {formatCurrencyBRL(horarioDePico.total)} · {horarioDePico.qtd} registros
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
                    bolicheMetrics.totalBoliche + fichasMetrics.totalFichasReceita
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Cortesias: {bolicheMetrics.totalCortesiasBoliche + fichasMetrics.totalCortesiasFichas} | Manutenção: {fichasMetrics.totalManutencoesFichas}
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
                    {aebMetrics.totalItens} unid.
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-neutral-900 font-mono-tabular">
                  {formatCurrencyBRL(aebMetrics.totalAebReceita)}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Cortesias AeB: {aebMetrics.totalCortesiasAeb}
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
                  {rankingOperadores.length} {rankingOperadores.length === 1 ? 'operador identificado' : 'operadores identificados'}
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
                              <span>{op.quantidadeVendas} registros</span>
                              <span>•</span>
                              <span className="font-mono-tabular">Boliche: {formatCurrencyBRL(op.bolicheTotal)}</span>
                              <span>•</span>
                              <span className="font-mono-tabular">Fichas: {formatCurrencyBRL(op.fichasTotal)}</span>
                              <span>•</span>
                              <span className="font-mono-tabular">AeB: {formatCurrencyBRL(op.aebTotal)}</span>
                              {op.cortesiasCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-700 font-semibold">
                                    Cortesias: {op.cortesiasCount}
                                  </span>
                                </>
                              )}
                              {op.manutencoesCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-cyan-700 font-semibold">
                                    Manutenção: {op.manutencoesCount}
                                  </span>
                                </>
                              )}
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
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-neutral-500">
                <span>
                  Receita Boliche: <strong className="text-neutral-900">{formatCurrencyBRL(bolicheMetrics.totalBoliche)}</strong> ({bolicheMetrics.totalLocacoes} locações)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  <Gift className="w-3 h-3 text-amber-600" />
                  Cortesias / ADM 3000: {bolicheMetrics.totalCortesiasBoliche}
                </span>
              </div>
            </div>

            {/* KPIs: Mais Vendido, Menos Vendido e Cortesias do Boliche */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    Item Mais Registrado
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
                    Item Menos Registrado
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

              <div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    Cortesias / ADM 3000 (Boliche)
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {bolicheMetrics.totalCortesiasBoliche}{' '}
                    {bolicheMetrics.totalCortesiasBoliche === 1 ? 'locação' : 'locações'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-700 font-mono-tabular">
                    {formatCurrencyBRL(bolicheMetrics.totalCortesiaBolicheValor)}
                  </div>
                  <div className="text-[11px] text-neutral-500">Valor Volux</div>
                </div>
              </div>
            </div>

            {/* Gráfico de Pizza: Proporção Meia Hora vs Uma Hora vs Cortesia */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-neutral-700 mb-2">
                Proporção de Locações: Meia Hora vs Uma Hora vs Cortesia / ADM 3000 (Boliche)
              </h4>

              {bolicheMetrics.pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400">
                  Nenhum registro de boliche no período selecionado.
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
                            key={`cell-${entry.name}-${index}`}
                            fill={
                              entry.name.includes('Cortesia')
                                ? '#f59e0b'
                                : BOLICHE_COLORS[index % BOLICHE_COLORS.length]
                            }
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
          {/* SEÇÃO 3: DESEMPENHO DE FICHAS (INCLUINDO CORTESIA E MANUTENÇÃO) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider text-xs">
                  Seção 3 · Desempenho de Fichas
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-neutral-500">
                <span>
                  Receita Fichas: <strong className="text-neutral-900">{formatCurrencyBRL(fichasMetrics.totalFichasReceita)}</strong> ({fichasMetrics.totalUnidades} unid.)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  <Gift className="w-3 h-3 text-amber-600" />
                  Cortesias: {fichasMetrics.totalCortesiasFichas}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 font-semibold">
                  <Wrench className="w-3 h-3 text-cyan-600" />
                  Manutenção: {fichasMetrics.totalManutencoesFichas}
                </span>
              </div>
            </div>

            {/* KPIs: Combo Mais Vendido, Combo Menos Vendido, Cortesias e Manutenção */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200/70 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                    Combo Mais Vendido
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {fichasMetrics.comboMaisVendido ? fichasMetrics.comboMaisVendido.name : 'Nenhum combo'}
                  </div>
                </div>
                {fichasMetrics.comboMaisVendido && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-700 font-mono-tabular">
                      {fichasMetrics.comboMaisVendido.qtd} un.
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
                      {fichasMetrics.comboMenosVendido.qtd} un.
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono-tabular">
                      {formatCurrencyBRL(fichasMetrics.comboMenosVendido.total)}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    Fichas Cortesia
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {fichasMetrics.totalCortesiasFichas} un.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-700 font-mono-tabular">
                    {formatCurrencyBRL(fichasMetrics.totalCortesiasFichasValor)}
                  </div>
                  <div className="text-[11px] text-neutral-500">Cortesia / 3000</div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-cyan-50/50 border border-cyan-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-cyan-800 uppercase tracking-wider flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                    Fichas Manutenção
                  </span>
                  <div className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                    {fichasMetrics.totalManutencoesFichas} un.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-cyan-700 font-mono-tabular">
                    {formatCurrencyBRL(0)}
                  </div>
                  <div className="text-[11px] text-neutral-500">Unitárias</div>
                </div>
              </div>
            </div>

            {/* Gráfico de Colunas: Quantidade de Cada Tipo de Ficha (incluindo Cortesia e Manutenção) */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-neutral-700 mb-2">
                Quantidade por Tipo de Ficha (Individuais, Combos, Cortesia e Manutenção)
              </h4>

              {fichasMetrics.barData.every((b) => b.qtd === 0) ? (
                <div className="h-64 flex items-center justify-center text-xs text-neutral-400">
                  Nenhum registro de fichas no período selecionado.
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
                        formatter={(val: any, _name: any, item: any) => [
                          `${val} unidades (${formatCurrencyBRL(item.payload.total)})`,
                          'Quantidade',
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
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular text-neutral-500">
                <span>
                  Receita AeB: <strong className="text-neutral-900">{formatCurrencyBRL(aebMetrics.totalAebReceita)}</strong> ({aebMetrics.totalItens} unid.)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  <Gift className="w-3 h-3 text-amber-600" />
                  Cortesias: {aebMetrics.totalCortesiasAeb}
                </span>
              </div>
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
                      />
                      <YAxis
                        stroke="#737373"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e5e5' }}
                        tickFormatter={(v) => `R$ ${v}`}
                      />
                      <Tooltip
                        formatter={(val: any, _name: any, item: any) => [
                          `${formatCurrencyBRL(Number(val))} (${item.payload.qtd} un. vendidas)`,
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
                          <Cell key={`aeb-bar-${index}`} fill={entry.fill} />
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
