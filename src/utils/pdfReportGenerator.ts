import { jsPDF } from 'jspdf';
import {
  VendaComanda,
  VendaAeB,
  FechamentoTurnoFichas,
  TurnoAtivoCaixa,
  ModoRelatorioPDF,
} from '../types/venda';
import {
  formatCurrencyBRL,
  getShiftFromHora,
  isRegistroCortesia,
  isRegistroManutencao,
  isRegistroConta3000,
  isRegistroVoucher,
  getValorMonetarioEfetivo,
  getValorNaoMonetarioVoucher,
  recordDateToISO,
} from './formatters';
import { calcularSaidaFichasPorTurno } from '../components/ControleFichasTab';

export interface ConsolidatedServiceRow {
  item: string;
  categoria: 'Boliche' | 'Fichas';
  qtdeTotal: number;
  vouchersQtd: number;
  cortesiasQtd: number;
  manutencoesQtd: number;
  totalEfetivoCaixa: number;
  valorNaoMonetarioVouchers: number;
}

export interface ConsolidatedAeBRow {
  item: string;
  qtdeTotal: number;
  vouchersQtd: number;
  cortesiasQtd: number;
  valorTotalEfetivo: number;
  valorNaoMonetarioVouchers: number;
}

export interface ShiftAuditSummary {
  hasClosedOrActiveRecord: boolean;
  statusLabel: string;
  responsavel: string;
  inicialPrata: number;
  reposicaoPrata: number;
  saidaSistemaPrata: number;
  esperadoPrata: number;
  finalManualPrata: number | null;
  diferencaPrata: number | null;
  inicialDourada: number;
  reposicaoDourada: number;
  saidaSistemaDourada: number;
  esperadoDourada: number;
  finalManualDourada: number | null;
  diferencaDourada: number | null;
}

export interface ShiftConsolidatedData {
  shiftKey: 'MANHA' | 'NOITE' | 'DIA_COMPLETO';
  shiftTitle: string;
  faturamentoEfetivoCaixa: number;
  totalBolicheCaixa: number;
  totalFichasCaixa: number;
  totalServicosCaixa: number;
  totalAeBCaixa: number;
  vouchersQtd: number;
  vouchersValorNaoMonetario: number;
  cortesias3000Qtd: number;
  cortesias3000Valor: number;
  cortesiasManuaisQtd: number;
  manutencoesQtd: number;
  servicosRows: ConsolidatedServiceRow[];
  aebRows: ConsolidatedAeBRow[];
  auditoriaFichas: ShiftAuditSummary;
  ocorrencias: Array<{
    hora: string;
    item: string;
    responsavel: string;
    observacao: string;
  }>;
  responsaveisTurno: string[];
}

export interface OperationalReportPayload {
  dateISO: string;
  dateFormatted: string;
  modo: ModoRelatorioPDF;
  primary: ShiftConsolidatedData;
  manha?: ShiftConsolidatedData;
  noite?: ShiftConsolidatedData;
}

function formatISOToBR(dateISO: string): string {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return dateISO || '';
  const [yyyy, mm, dd] = dateISO.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function extractDDMM(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}`;
  }
  const parts = trimmed.split('/');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}`;
  }
  return trimmed;
}

function normalizeServiceDisplayName(rawItem: string, tipoVenda: string): string {
  const lower = (rawItem || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (tipoVenda === 'Boliche') {
    if (lower.includes('meia') || lower.includes('30')) return 'Meia Hora de Boliche';
    if (lower.includes('uma') || lower.includes('1 hora')) return 'Uma Hora de Boliche';
    return rawItem.trim() || 'Boliche';
  }

  if (lower.includes('mega combo')) return 'Mega Combo Fichas';
  if (lower.includes('big combo')) return 'Big Combo Fichas';
  if (lower.includes('mini combo')) return 'Mini Combo Fichas';
  if (
    lower.includes('ficha de jogos') ||
    lower.includes('fichas eletronicas') ||
    lower.includes('ficha eletronica') ||
    lower.includes('ficha individual')
  ) {
    return 'Ficha de Jogos Eletronicos';
  }
  if (lower.includes('manutencao')) return 'Ficha Manutenção Técnica';
  if (lower.includes('cortesia')) return 'Ficha Cortesia';
  return rawItem.trim() || 'Ficha de Jogos Eletronicos';
}

function buildShiftAudit(
  dateISO: string,
  shiftFilter: 'MANHA' | 'NOITE' | 'ALL',
  allVendas: VendaComanda[],
  fechamentos: FechamentoTurnoFichas[],
  turnoAtivo: TurnoAtivoCaixa | null
): ShiftAuditSummary {
  const targetDDMM = extractDDMM(dateISO);

  // Calcula saída do sistema via função oficial da Aba 2
  const saidaManha = calcularSaidaFichasPorTurno(
    dateISO,
    'Manhã (09:00 às 15:59)',
    allVendas
  );
  const saidaNoite = calcularSaidaFichasPorTurno(
    dateISO,
    'Noite (16:00 às 23:00)',
    allVendas
  );

  const saidaSistemaPrata =
    shiftFilter === 'MANHA'
      ? saidaManha.pratasVendidas
      : shiftFilter === 'NOITE'
      ? saidaNoite.pratasVendidas
      : saidaManha.pratasVendidas + saidaNoite.pratasVendidas;

  const saidaSistemaDourada =
    shiftFilter === 'MANHA'
      ? saidaManha.douradasVendidas
      : shiftFilter === 'NOITE'
      ? saidaNoite.douradasVendidas
      : saidaManha.douradasVendidas + saidaNoite.douradasVendidas;

  // Busca fechamentos salvos para a data
  const matchingFechamentos = fechamentos.filter((f) => {
    const fDDMM = extractDDMM(f.data);
    if (fDDMM !== targetDDMM) return false;
    if (shiftFilter === 'ALL') return true;
    const isManha =
      f.turno.toLowerCase().includes('manhã') || f.turno.toLowerCase().includes('manha');
    return shiftFilter === 'MANHA' ? isManha : !isManha;
  });

  if (matchingFechamentos.length > 0) {
    // Se for ALL e houver Manhã e Noite fechados, consolida ou pega os valores
    const first = matchingFechamentos[matchingFechamentos.length - 1]; // mais antigo (abertura)
    const last = matchingFechamentos[0]; // mais recente (fechamento)
    const sumRepPrata = matchingFechamentos.reduce(
      (acc, f) => acc + Math.max(0, Number(f.reposicaoPrata ?? 0) || 0),
      0
    );
    const sumRepDourada = matchingFechamentos.reduce(
      (acc, f) => acc + Math.max(0, Number(f.reposicaoDourada ?? 0) || 0),
      0
    );

    const iniPrata =
      typeof first.inicialPrata === 'number'
        ? first.inicialPrata
        : first.contagemInicial ?? 0;
    const iniDourada =
      typeof first.inicialDourada === 'number' ? first.inicialDourada : 0;

    const espPrata = iniPrata + sumRepPrata - saidaSistemaPrata;
    const espDourada = iniDourada + sumRepDourada - saidaSistemaDourada;

    const finPrata =
      typeof last.finalPrata === 'number' ? last.finalPrata : last.contagemFinal ?? 0;
    const finDourada = typeof last.finalDourada === 'number' ? last.finalDourada : 0;

    const responsaveis = Array.from(
      new Set(matchingFechamentos.map((f) => f.responsavel).filter(Boolean))
    ).join(' / ');

    return {
      hasClosedOrActiveRecord: true,
      statusLabel: 'Turno Fechado e Auditado',
      responsavel: responsaveis || 'Operador',
      inicialPrata: iniPrata,
      reposicaoPrata: sumRepPrata,
      saidaSistemaPrata,
      esperadoPrata: espPrata,
      finalManualPrata: finPrata,
      diferencaPrata: finPrata - espPrata,
      inicialDourada: iniDourada,
      reposicaoDourada: sumRepDourada,
      saidaSistemaDourada,
      esperadoDourada: espDourada,
      finalManualDourada: finDourada,
      diferencaDourada: finDourada - espDourada,
    };
  }

  // Verifica se o turnoAtivo corresponde a esta data e turno
  if (turnoAtivo && turnoAtivo.aberto) {
    const ativoDDMM = extractDDMM(turnoAtivo.data || turnoAtivo.dataExibicao || '');
    const isAtivoManha =
      turnoAtivo.turno.toLowerCase().includes('manhã') ||
      turnoAtivo.turno.toLowerCase().includes('manha');
    const matchesShift =
      shiftFilter === 'ALL' ||
      (shiftFilter === 'MANHA' && isAtivoManha) ||
      (shiftFilter === 'NOITE' && !isAtivoManha);

    if (ativoDDMM === targetDDMM && matchesShift) {
      const iniP = turnoAtivo.inicialPrata || 0;
      const iniD = turnoAtivo.inicialDourada || 0;
      const repP = Math.max(0, Number(turnoAtivo.reposicaoPrata ?? 0) || 0);
      const repD = Math.max(0, Number(turnoAtivo.reposicaoDourada ?? 0) || 0);
      const espP = iniP + repP - saidaSistemaPrata;
      const espD = iniD + repD - saidaSistemaDourada;

      return {
        hasClosedOrActiveRecord: true,
        statusLabel: 'Turno Aberto em Andamento',
        responsavel: turnoAtivo.responsavel || 'Operador',
        inicialPrata: iniP,
        reposicaoPrata: repP,
        saidaSistemaPrata,
        esperadoPrata: espP,
        finalManualPrata: null,
        diferencaPrata: null,
        inicialDourada: iniD,
        reposicaoDourada: repD,
        saidaSistemaDourada,
        esperadoDourada: espD,
        finalManualDourada: null,
        diferencaDourada: null,
      };
    }
  }

  return {
    hasClosedOrActiveRecord: false,
    statusLabel: 'Apenas Saída do Sistema (Sem abertura/fechamento físico salvo)',
    responsavel: '-',
    inicialPrata: 0,
    reposicaoPrata: 0,
    saidaSistemaPrata,
    esperadoPrata: -saidaSistemaPrata,
    finalManualPrata: null,
    diferencaPrata: null,
    inicialDourada: 0,
    reposicaoDourada: 0,
    saidaSistemaDourada,
    esperadoDourada: -saidaSistemaDourada,
    finalManualDourada: null,
    diferencaDourada: null,
  };
}

function buildSingleShiftConsolidatedData(
  dateISO: string,
  shiftFilter: 'MANHA' | 'NOITE' | 'ALL',
  allVendas: VendaComanda[],
  allAeB: VendaAeB[],
  fechamentos: FechamentoTurnoFichas[],
  turnoAtivo: TurnoAtivoCaixa | null
): ShiftConsolidatedData {
  const shiftKey =
    shiftFilter === 'MANHA'
      ? 'MANHA'
      : shiftFilter === 'NOITE'
      ? 'NOITE'
      : 'DIA_COMPLETO';

  const shiftTitle =
    shiftFilter === 'MANHA'
      ? 'Turno Manhã (09:00 às 15:59)'
      : shiftFilter === 'NOITE'
      ? 'Turno Noite (16:00 às 23:00)'
      : 'Dia Completo (Manhã + Noite)';

  const matchesDateAndShift = (dataStr: string, horaStr: string) => {
    const recISO = recordDateToISO(dataStr);
    if (recISO !== dateISO) return false;
    if (shiftFilter === 'ALL') return true;
    return getShiftFromHora(horaStr) === shiftFilter;
  };

  const activeVendas = allVendas.filter(
    (v) =>
      !v.cancelado &&
      v.status !== 'Cancelado' &&
      matchesDateAndShift(v.data, v.hora)
  );

  const activeVendasIds = new Set(activeVendas.map((v) => v.id));

  // Separa Serviços (Boliche e Fichas) e AeB (sem duplicar ID entre coleções)
  const servicosVendas = activeVendas.filter(
    (v) => v.tipo_venda === 'Boliche' || v.tipo_venda === 'Fichas'
  );

  const aebCombined: Array<VendaAeB | VendaComanda> = [
    ...activeVendas.filter((v) => v.tipo_venda === 'AeB'),
    ...allAeB.filter(
      (a) =>
        !a.cancelado &&
        a.status !== 'Cancelado' &&
        !activeVendasIds.has(a.id) &&
        matchesDateAndShift(a.data, a.hora)
    ),
  ];

  // Totais executivos
  let totalBolicheCaixa = 0;
  let totalFichasCaixa = 0;
  let totalAeBCaixa = 0;

  let vouchersQtd = 0;
  let vouchersValorNaoMonetario = 0;
  let cortesias3000Qtd = 0;
  let cortesias3000Valor = 0;
  let cortesiasManuaisQtd = 0;
  let manutencoesQtd = 0;

  const responsaveisSet = new Set<string>();
  const ocorrencias: Array<{
    hora: string;
    item: string;
    responsavel: string;
    observacao: string;
  }> = [];

  // Consolidação de Serviços (Zero repetição de linhas!)
  const servicosMap = new Map<string, ConsolidatedServiceRow>();

  for (const v of servicosVendas) {
    const qtde = Math.max(1, Number(v.qtde) || 1);
    const isVoucher = isRegistroVoucher(v);
    const is3000 = isRegistroConta3000(v);
    const isCort = isRegistroCortesia(v);
    const isManut = isRegistroManutencao(v);
    const valorCaixa = getValorMonetarioEfetivo(v);
    const valorVoucher = isVoucher ? getValorNaoMonetarioVoucher(v) : 0;

    if (v.tipo_venda === 'Boliche') {
      totalBolicheCaixa += valorCaixa;
    } else {
      totalFichasCaixa += valorCaixa;
    }

    if (isVoucher) {
      vouchersQtd += qtde;
      vouchersValorNaoMonetario += valorVoucher;
    }
    if (is3000) {
      cortesias3000Qtd += qtde;
      cortesias3000Valor += v.preco;
    } else if (isCort) {
      cortesiasManuaisQtd += qtde;
    }
    if (isManut) {
      manutencoesQtd += qtde;
    }

    if (v.responsavel && v.responsavel.trim()) {
      responsaveisSet.add(v.responsavel.trim());
    }
    if (v.observacao && v.observacao.trim()) {
      ocorrencias.push({
        hora: v.hora,
        item: v.item,
        responsavel: v.responsavel || '-',
        observacao: v.observacao.trim(),
      });
    }

    const displayItem = normalizeServiceDisplayName(v.item, v.tipo_venda);
    const key = `${v.tipo_venda}::${displayItem}`;
    const existing = servicosMap.get(key) || {
      item: displayItem,
      categoria: v.tipo_venda === 'Boliche' ? 'Boliche' : 'Fichas',
      qtdeTotal: 0,
      vouchersQtd: 0,
      cortesiasQtd: 0,
      manutencoesQtd: 0,
      totalEfetivoCaixa: 0,
      valorNaoMonetarioVouchers: 0,
    };

    existing.qtdeTotal += qtde;
    if (isVoucher) {
      existing.vouchersQtd += qtde;
      existing.valorNaoMonetarioVouchers += valorVoucher;
    }
    if (isCort || is3000) {
      existing.cortesiasQtd += qtde;
    }
    if (isManut) {
      existing.manutencoesQtd += qtde;
    }
    existing.totalEfetivoCaixa += valorCaixa;

    servicosMap.set(key, existing);
  }

  // Consolidação de A&B (Zero repetição de linhas!)
  const aebMap = new Map<string, ConsolidatedAeBRow>();

  for (const a of aebCombined) {
    const qtde = Math.max(1, Number(a.qtde) || 1);
    const isVoucher = isRegistroVoucher(a);
    const is3000 = isRegistroConta3000(a);
    const isCort = isRegistroCortesia(a);
    const valorCaixa = getValorMonetarioEfetivo(a);
    const valorVoucher = isVoucher ? getValorNaoMonetarioVoucher(a) : 0;

    totalAeBCaixa += valorCaixa;

    if (isVoucher) {
      vouchersQtd += qtde;
      vouchersValorNaoMonetario += valorVoucher;
    }
    if (is3000) {
      cortesias3000Qtd += qtde;
      cortesias3000Valor += a.preco;
    } else if (isCort) {
      cortesiasManuaisQtd += qtde;
    }

    if (a.responsavel && a.responsavel.trim()) {
      responsaveisSet.add(a.responsavel.trim());
    }
    if (a.observacao && a.observacao.trim()) {
      ocorrencias.push({
        hora: a.hora,
        item: a.item,
        responsavel: a.responsavel || '-',
        observacao: a.observacao.trim(),
      });
    }

    const cleanName = a.item.replace(/\s*\(Cortesia\)\s*/i, '').trim() || 'Item A&B';
    const key = cleanName.toLowerCase();
    const existing = aebMap.get(key) || {
      item: cleanName,
      qtdeTotal: 0,
      vouchersQtd: 0,
      cortesiasQtd: 0,
      valorTotalEfetivo: 0,
      valorNaoMonetarioVouchers: 0,
    };

    existing.qtdeTotal += qtde;
    if (isVoucher) {
      existing.vouchersQtd += qtde;
      existing.valorNaoMonetarioVouchers += valorVoucher;
    }
    if (isCort || is3000) {
      existing.cortesiasQtd += qtde;
    }
    existing.valorTotalEfetivo += valorCaixa;

    aebMap.set(key, existing);
  }

  // Ordena Serviços: Boliche primeiro, depois Fichas por volume
  const servicosRows = Array.from(servicosMap.values()).sort((a, b) => {
    if (a.categoria !== b.categoria) {
      return a.categoria === 'Boliche' ? -1 : 1;
    }
    return b.qtdeTotal - a.qtdeTotal;
  });

  // Ordena A&B por quantidade decrescente
  const aebRows = Array.from(aebMap.values()).sort(
    (a, b) => b.qtdeTotal - a.qtdeTotal || b.valorTotalEfetivo - a.valorTotalEfetivo
  );

  // Auditoria de fichas
  const auditoriaFichas = buildShiftAudit(
    dateISO,
    shiftFilter,
    allVendas,
    fechamentos,
    turnoAtivo
  );

  // Inclui observação do fechamento de fichas se houver
  const targetDDMM = extractDDMM(dateISO);
  fechamentos.forEach((f) => {
    if (extractDDMM(f.data) === targetDDMM && f.observacao && f.observacao.trim()) {
      const isManha =
        f.turno.toLowerCase().includes('manhã') || f.turno.toLowerCase().includes('manha');
      const matches =
        shiftFilter === 'ALL' ||
        (shiftFilter === 'MANHA' && isManha) ||
        (shiftFilter === 'NOITE' && !isManha);
      if (matches) {
        ocorrencias.push({
          hora: f.timestamp || 'Fechamento',
          item: `Fechamento de Fichas (${f.turno})`,
          responsavel: f.responsavel || '-',
          observacao: f.observacao.trim(),
        });
      }
    }
  });

  const totalServicosCaixa = totalBolicheCaixa + totalFichasCaixa;
  const faturamentoEfetivoCaixa = totalServicosCaixa + totalAeBCaixa;

  return {
    shiftKey,
    shiftTitle,
    faturamentoEfetivoCaixa,
    totalBolicheCaixa,
    totalFichasCaixa,
    totalServicosCaixa,
    totalAeBCaixa,
    vouchersQtd,
    vouchersValorNaoMonetario,
    cortesias3000Qtd,
    cortesias3000Valor,
    cortesiasManuaisQtd,
    manutencoesQtd,
    servicosRows,
    aebRows,
    auditoriaFichas,
    ocorrencias,
    responsaveisTurno: Array.from(responsaveisSet),
  };
}

export function buildOperationalReportPayload(
  dateISO: string,
  modo: ModoRelatorioPDF,
  allVendas: VendaComanda[],
  allAeB: VendaAeB[],
  fechamentos: FechamentoTurnoFichas[],
  turnoAtivo: TurnoAtivoCaixa | null
): OperationalReportPayload {
  const dateFormatted = formatISOToBR(dateISO);

  if (modo === 'MANHA') {
    const manha = buildSingleShiftConsolidatedData(
      dateISO,
      'MANHA',
      allVendas,
      allAeB,
      fechamentos,
      turnoAtivo
    );
    return {
      dateISO,
      dateFormatted,
      modo,
      primary: manha,
      manha,
    };
  }

  if (modo === 'NOITE') {
    const noite = buildSingleShiftConsolidatedData(
      dateISO,
      'NOITE',
      allVendas,
      allAeB,
      fechamentos,
      turnoAtivo
    );
    return {
      dateISO,
      dateFormatted,
      modo,
      primary: noite,
      noite,
    };
  }

  // DIA_COMPLETO: Calcula Manhã, Noite e Consolidado do Dia
  const manha = buildSingleShiftConsolidatedData(
    dateISO,
    'MANHA',
    allVendas,
    allAeB,
    fechamentos,
    turnoAtivo
  );
  const noite = buildSingleShiftConsolidatedData(
    dateISO,
    'NOITE',
    allVendas,
    allAeB,
    fechamentos,
    turnoAtivo
  );
  const diaCompleto = buildSingleShiftConsolidatedData(
    dateISO,
    'ALL',
    allVendas,
    allAeB,
    fechamentos,
    turnoAtivo
  );

  return {
    dateISO,
    dateFormatted,
    modo,
    primary: diaCompleto,
    manha,
    noite,
  };
}

/**
 * Gera e faz o download do PDF Executivo Consolidado (Sem Repetição de Produtos + Gráficos Visuais)
 */
export function downloadOperationalReportPDF(payload: OperationalReportPayload): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 14) {
      doc.addPage();
      y = 14;
    }
  };

  const { primary, manha, noite, modo, dateFormatted } = payload;

  // =========================================================================
  // CABEÇALHO EXECUTIVO
  // =========================================================================
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.roundedRect(margin, y, contentWidth, 22, 2.5, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATORIO OPERACIONAL EXECUTIVO - VOLUX', margin + 5, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Data: ${dateFormatted}   |   Modo: ${primary.shiftTitle}`,
    margin + 5,
    y + 14.5
  );

  const opsText =
    primary.responsaveisTurno.length > 0
      ? `Operadores: ${primary.responsaveisTurno.join(', ')}`
      : `Auditoria Fichas: ${primary.auditoriaFichas.responsavel}`;
  doc.setFontSize(8);
  doc.text(opsText.slice(0, 95), margin + 5, y + 19.5);

  y += 27;

  // =========================================================================
  // 1. RESUMO EXECUTIVO DO TURNO
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RESUMO EXECUTIVO DO TURNO', margin, y);
  y += 3;

  const cardGap = 3;
  const cardW = (contentWidth - cardGap * 2) / 3;
  const cardH = 16;

  const summaryBoxes = [
    {
      label: 'FATURAMENTO EFETIVO EM CAIXA',
      value: formatCurrencyBRL(primary.faturamentoEfetivoCaixa),
      sub: 'Dinheiro/Cartao/Pix liquido (s/ Vouchers)',
      bg: [236, 253, 245] as [number, number, number],
      border: [167, 243, 208] as [number, number, number],
      text: [6, 95, 70] as [number, number, number],
    },
    {
      label: 'TOTAL SERVICOS (BOLICHE + FICHAS)',
      value: formatCurrencyBRL(primary.totalServicosCaixa),
      sub: `Boliche: ${formatCurrencyBRL(primary.totalBolicheCaixa)} | Fichas: ${formatCurrencyBRL(primary.totalFichasCaixa)}`,
      bg: [238, 242, 255] as [number, number, number],
      border: [199, 210, 254] as [number, number, number],
      text: [49, 46, 129] as [number, number, number],
    },
    {
      label: 'TOTAL ALIMENTOS E BEBIDAS (A&B)',
      value: formatCurrencyBRL(primary.totalAeBCaixa),
      sub: `${primary.aebRows.reduce((a, r) => a + r.qtdeTotal, 0)} un. vendidas no periodo`,
      bg: [239, 246, 255] as [number, number, number],
      border: [191, 219, 254] as [number, number, number],
      text: [30, 64, 175] as [number, number, number],
    },
    {
      label: 'VOUCHERS (NAO MONETARIO)',
      value: `${primary.vouchersQtd} un. (${formatCurrencyBRL(primary.vouchersValorNaoMonetario)})`,
      sub: 'Abate ficha fisica | Nao soma no caixa',
      bg: [250, 245, 255] as [number, number, number],
      border: [233, 213, 255] as [number, number, number],
      text: [107, 33, 168] as [number, number, number],
    },
    {
      label: 'CORTESIAS CONTAS ADM (3000 / 3030)',
      value: `${primary.cortesias3000Qtd} un. (${formatCurrencyBRL(primary.cortesias3000Valor)})`,
      sub: `Cortesias manuais R$ 0: ${primary.cortesiasManuaisQtd} un.`,
      bg: [255, 251, 235] as [number, number, number],
      border: [253, 230, 138] as [number, number, number],
      text: [146, 64, 14] as [number, number, number],
    },
    {
      label: 'MANUTENCOES TECNICAS',
      value: `${primary.manutencoesQtd} un. (R$ 0,00)`,
      sub: 'Testes de pista / maquinas arcade',
      bg: [236, 254, 255] as [number, number, number],
      border: [165, 243, 252] as [number, number, number],
      text: [21, 94, 117] as [number, number, number],
    },
  ];

  summaryBoxes.forEach((box, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const bx = margin + col * (cardW + cardGap);
    const by = y + row * (cardH + 2.5);

    doc.setFillColor(...box.bg);
    doc.setDrawColor(...box.border);
    doc.roundedRect(bx, by, cardW, cardH, 1.8, 1.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...box.text);
    doc.text(box.label, bx + 3, by + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(box.value, bx + 3, by + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(box.sub, bx + 3, by + 14.2);
  });

  y += cardH * 2 + 8;

  // Se for DIA_COMPLETO, exibe quadro comparativo lado a lado (Manhã vs Noite)
  if (modo === 'DIA_COMPLETO' && manha && noite) {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('COMPARATIVO LADO A LADO: TURNO MANHA (09:00-15:59) vs TURNO NOITE (16:00-23:00)', margin, y);
    y += 2.5;

    const halfW = (contentWidth - 4) / 2;
    const compH = 19;

    [
      { data: manha, x: margin, title: 'MANHA (09:00 as 15:59)', color: [245, 158, 11] as [number, number, number] },
      { data: noite, x: margin + halfW + 4, title: 'NOITE (16:00 as 23:00)', color: [59, 130, 246] as [number, number, number] },
    ].forEach(({ data, x, title, color }) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, y, halfW, compH, 1.8, 1.8, 'FD');

      doc.setFillColor(...color);
      doc.rect(x, y, 2.2, compH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${title}  -  Caixa: ${formatCurrencyBRL(data.faturamentoEfetivoCaixa)}`, x + 5, y + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Boliche: ${formatCurrencyBRL(data.totalBolicheCaixa)}  |  Fichas: ${formatCurrencyBRL(data.totalFichasCaixa)}  |  A&B: ${formatCurrencyBRL(data.totalAeBCaixa)}`,
        x + 5,
        y + 10.5
      );
      doc.text(
        `Vouchers: ${data.vouchersQtd} un. (${formatCurrencyBRL(data.vouchersValorNaoMonetario)})  |  ADM 3000/3030: ${data.cortesias3000Qtd} un.  |  Saida Fichas: ${data.auditoriaFichas.saidaSistemaPrata}P / ${data.auditoriaFichas.saidaSistemaDourada}D`,
        x + 5,
        y + 15.5
      );
    });

    y += compH + 6;
  }

  // =========================================================================
  // 2. GRÁFICOS VISUAIS NO PDF
  // =========================================================================
  ensureSpace(46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. GRAFICOS VISUAIS CONSOLIDADOS', margin, y);
  y += 3;

  const chartBoxW = (contentWidth - 4) / 2;
  const chartBoxH = 38;

  // Gráfico 2.1: Faturamento por Categoria (Boliche vs Fichas vs A&B)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, chartBoxW, chartBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Faturamento Efetivo por Categoria (R$)', margin + 4, y + 5.5);

  const catData = [
    { label: 'Boliche', val: primary.totalBolicheCaixa, color: [79, 70, 229] as [number, number, number] },
    { label: 'Fichas', val: primary.totalFichasCaixa, color: [245, 158, 11] as [number, number, number] },
    { label: 'A&B', val: primary.totalAeBCaixa, color: [37, 99, 235] as [number, number, number] },
  ];
  const maxCatVal = Math.max(1, ...catData.map((c) => c.val));

  catData.forEach((cat, i) => {
    const rowY = y + 11 + i * 8.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(cat.label, margin + 4, rowY + 3.5);

    const barMaxW = chartBoxW - 48;
    const barW = Math.max(1.5, (cat.val / maxCatVal) * barMaxW);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 20, rowY, barMaxW, 4.8, 1, 1, 'F');

    doc.setFillColor(...cat.color);
    doc.roundedRect(margin + 20, rowY, barW, 4.8, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrencyBRL(cat.val), margin + 22 + barMaxW, rowY + 3.6);
  });

  // Gráfico 2.2: Quantidade Consolidada por Item (Top 5)
  const rightChartX = margin + chartBoxW + 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightChartX, y, chartBoxW, chartBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Quantidade Consolidada por Item (Unid.)', rightChartX + 4, y + 5.5);

  const allItemsConsolidated = [
    ...primary.servicosRows.map((s) => ({
      name: s.item,
      qtde: s.qtdeTotal,
      color: (s.categoria === 'Boliche' ? [79, 70, 229] : [16, 185, 129]) as [number, number, number],
    })),
    ...primary.aebRows.map((a) => ({
      name: a.item,
      qtde: a.qtdeTotal,
      color: [37, 99, 235] as [number, number, number],
    })),
  ]
    .sort((a, b) => b.qtde - a.qtde)
    .slice(0, 5);

  if (allItemsConsolidated.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Nenhum item vendido no periodo', rightChartX + 4, y + 20);
  } else {
    const maxItemQtd = Math.max(1, ...allItemsConsolidated.map((it) => it.qtde));
    allItemsConsolidated.forEach((it, i) => {
      const rowY = y + 10 + i * 5.4;
      const shortName = it.name.length > 20 ? it.name.slice(0, 19) + '.' : it.name;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      doc.text(shortName, rightChartX + 4, rowY + 3);

      const barMaxW = chartBoxW - 48;
      const barW = Math.max(1.5, (it.qtde / maxItemQtd) * barMaxW);

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(rightChartX + 34, rowY, barMaxW, 3.6, 0.8, 0.8, 'F');

      doc.setFillColor(...it.color);
      doc.roundedRect(rightChartX + 34, rowY, barW, 3.6, 0.8, 0.8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${it.qtde} un.`, rightChartX + 35.5 + barMaxW, rowY + 3);
    });
  }

  y += chartBoxH + 6;

  // =========================================================================
  // 3. TABELA CONSOLIDADA DE SERVIÇOS (BOLICHE & FICHAS) — SEM REPETIÇÃO
  // =========================================================================
  ensureSpace(32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TABELA CONSOLIDADA DE SERVICOS (BOLICHE & FICHAS) - SEM REPETICAO', margin, y);
  y += 2.5;

  // Cabeçalho da Tabela 3
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 6.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('SERVICO / PRODUTO', margin + 3, y + 4.4);
  doc.text('CATEGORIA', margin + 76, y + 4.4);
  doc.text('QTDE TOTAL', margin + 105, y + 4.4);
  doc.text('VOUCHERS / CORT.', margin + 132, y + 4.4);
  doc.text('TOTAL EFETIVO (R$)', margin + contentWidth - 3, y + 4.4, { align: 'right' });
  y += 6.5;

  if (primary.servicosRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.rect(margin, y, contentWidth, 7, 'D');
    doc.text('Nenhum servico de Boliche ou Fichas registrado neste turno.', margin + 3, y + 4.8);
    y += 7;
  } else {
    primary.servicosRows.forEach((row, idx) => {
      ensureSpace(7);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.2, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 6.2, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(row.item, margin + 3, y + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(row.categoria, margin + 76, y + 4.2);

      doc.setFont('helvetica', 'bold');
      doc.text(`${row.qtdeTotal} un.`, margin + 105, y + 4.2);

      const tags: string[] = [];
      if (row.vouchersQtd > 0) tags.push(`${row.vouchersQtd} Vouch.`);
      if (row.cortesiasQtd > 0) tags.push(`${row.cortesiasQtd} Cort.`);
      if (row.manutencoesQtd > 0) tags.push(`${row.manutencoesQtd} Manut.`);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 33, 168);
      doc.text(tags.length > 0 ? tags.join(' / ') : '-', margin + 132, y + 4.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(
        formatCurrencyBRL(row.totalEfetivoCaixa),
        margin + contentWidth - 3,
        y + 4.2,
        { align: 'right' }
      );
      y += 6.2;
    });

    // Linha de Subtotal Serviços
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const totalServQtd = primary.servicosRows.reduce((a, r) => a + r.qtdeTotal, 0);
    doc.text(`SUBTOTAL SERVICOS (${totalServQtd} un.)`, margin + 3, y + 4.5);
    doc.text(
      formatCurrencyBRL(primary.totalServicosCaixa),
      margin + contentWidth - 3,
      y + 4.5,
      { align: 'right' }
    );
    y += 6.5;
  }

  y += 5;

  // =========================================================================
  // 4. TABELA CONSOLIDADA DE ALIMENTOS E BEBIDAS (A&B) — SEM REPETIÇÃO
  // =========================================================================
  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('4. TABELA CONSOLIDADA DE ALIMENTOS E BEBIDAS (A&B) - SEM REPETICAO', margin, y);
  y += 2.5;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 6.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('PRODUTO (A&B)', margin + 3, y + 4.4);
  doc.text('QTDE TOTAL', margin + 105, y + 4.4);
  doc.text('VOUCHERS / CORT.', margin + 132, y + 4.4);
  doc.text('VALOR TOTAL (R$)', margin + contentWidth - 3, y + 4.4, { align: 'right' });
  y += 6.5;

  if (primary.aebRows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.rect(margin, y, contentWidth, 7, 'D');
    doc.text('Sem vendas de A&B no turno (R$ 0,00).', margin + 3, y + 4.8);
    y += 7;
  } else {
    primary.aebRows.forEach((row, idx) => {
      ensureSpace(6.5);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 6, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(row.item, margin + 3, y + 4.1);

      doc.text(`${row.qtdeTotal} un.`, margin + 105, y + 4.1);

      const tags: string[] = [];
      if (row.vouchersQtd > 0) tags.push(`${row.vouchersQtd} Vouch.`);
      if (row.cortesiasQtd > 0) tags.push(`${row.cortesiasQtd} Cort.`);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 33, 168);
      doc.text(tags.length > 0 ? tags.join(' / ') : '-', margin + 132, y + 4.1);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(
        formatCurrencyBRL(row.valorTotalEfetivo),
        margin + contentWidth - 3,
        y + 4.1,
        { align: 'right' }
      );
      y += 6;
    });

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const totalAeBQtd = primary.aebRows.reduce((a, r) => a + r.qtdeTotal, 0);
    doc.text(`SUBTOTAL A&B (${totalAeBQtd} un.)`, margin + 3, y + 4.5);
    doc.text(
      formatCurrencyBRL(primary.totalAeBCaixa),
      margin + contentWidth - 3,
      y + 4.5,
      { align: 'right' }
    );
    y += 6.5;
  }

  y += 5;

  // =========================================================================
  // 5. AUDITORIA FÍSICA DE FICHAS DO TURNO + OCORRÊNCIAS
  // =========================================================================
  ensureSpace(38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('5. AUDITORIA FISICA DE FICHAS DO TURNO + OCORRENCIAS', margin, y);
  y += 2.5;

  const aud = primary.auditoriaFichas;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Status: ${aud.statusLabel}   |   Responsavel: ${aud.responsavel}`, margin + 4, y + 4.8);

  const formatAuditLine = (
    label: string,
    ini: number,
    rep: number,
    saida: number,
    esp: number,
    fin: number | null,
    dif: number | null
  ) => {
    const finStr = fin !== null ? `${fin}` : 'Em aberto';
    const difStr =
      dif === null
        ? '-'
        : dif === 0
        ? '0 (Caixa Exato)'
        : dif > 0
        ? `+${dif} (Sobra)`
        : `${dif} (Falta)`;
    return `${label}:  Inicial (${ini}) + Reposicao (+${rep}) - Saida Sistema (-${saida}) = Esperado (${esp})   |   Final Manual: ${finStr}   |   Diferenca: ${difStr}`;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    formatAuditLine(
      'FICHAS PRATAS  ',
      aud.inicialPrata,
      aud.reposicaoPrata,
      aud.saidaSistemaPrata,
      aud.esperadoPrata,
      aud.finalManualPrata,
      aud.diferencaPrata
    ),
    margin + 4,
    y + 11
  );

  doc.setTextColor(146, 64, 14);
  doc.text(
    formatAuditLine(
      'FICHAS DOURADAS',
      aud.inicialDourada,
      aud.reposicaoDourada,
      aud.saidaSistemaDourada,
      aud.esperadoDourada,
      aud.finalManualDourada,
      aud.diferencaDourada
    ),
    margin + 4,
    y + 16.5
  );

  y += 23;

  // Lista de Observações / Ocorrências
  ensureSpace(16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Ocorrencias e Observacoes Registradas no Turno (${primary.ocorrencias.length}):`, margin, y);
  y += 3.5;

  if (primary.ocorrencias.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma observacao ou ocorrencia registrada neste turno.', margin + 2, y + 3);
  } else {
    primary.ocorrencias.forEach((oc) => {
      ensureSpace(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const line = `• [${oc.hora}] ${oc.item} (${oc.responsavel}): ${oc.observacao}`;
      doc.text(line.slice(0, 118), margin + 2, y + 3.5);
      y += 4.8;
    });
  }

  const safeDate = payload.dateISO || 'data';
  const fileName = `relatorio-volux-${safeDate}-${modo.toLowerCase()}.pdf`;
  doc.save(fileName);
}
