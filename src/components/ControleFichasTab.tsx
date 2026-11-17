import React, { useState, useMemo, useEffect } from 'react';
import {
  Ticket,
  Clock,
  User,
  Calendar,
  Calculator,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Award,
  Layers,
  Lock,
  Unlock,
  PlayCircle,
  StopCircle,
  Cloud,
  Plus,
  X,
  PackagePlus,
} from 'lucide-react';
import {
  FechamentoTurnoFichas,
  TurnoOpcao,
  VendaComanda,
  TurnoAtivoCaixa,
} from '../types/venda';
import {
  formatNumber,
  compareDatesChronologically,
  getShiftFromHora,
  isRegistroConta3000,
} from '../utils/formatters';
import { generateUniqueId } from '../utils/voluxParser';

interface ControleFichasTabProps {
  vendas: VendaComanda[];
  fechamentos: FechamentoTurnoFichas[];
  turnoAtivo: TurnoAtivoCaixa | null;
  onAbrirTurno: (novoTurno: TurnoAtivoCaixa) => Promise<void> | void;
  onRegistrarReposicao: (
    pratasAdicionadas: number,
    douradasAdicionadas: number
  ) => Promise<void> | void;
  onEncerrarTurno: (fechamento: FechamentoTurnoFichas) => Promise<void> | void;
  onDeleteFechamento: (id: string) => void;
  onResetFechamentos: () => void;
}

export interface DesmembramentoFichasResult {
  pratasVendidas: number;
  douradasVendidas: number;
  qtdFichaAvulsa: number;
  qtdMiniCombo: number;
  qtdBigCombo: number;
  qtdMegaCombo: number;
  totalRegistrosFichas: number;
}

/**
 * Converte uma data de input ("YYYY-MM-DD") ou string "DD/MM/YYYY" para "DD/MM".
 */
function extractDDMM(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}`;
  }
  const parts = trimmed.split('/');
  if (parts.length >= 2) {
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    return `${dd}/${mm}`;
  }
  return trimmed;
}

/**
 * Verifica se o horário ("HH:MM") pertence ao turno oficial selecionado.
 * - Manhã (09:00 às 15:59): getShiftFromHora === 'MANHA'
 * - Noite (16:00 às 23:00): getShiftFromHora === 'NOITE'
 */
function matchesClosingTurno(horaRaw: string, turnoSelecionado: string): boolean {
  const shift = getShiftFromHora(horaRaw);
  const isManha =
    turnoSelecionado.toLowerCase().includes('manhã') ||
    turnoSelecionado.toLowerCase().includes('manha');
  if (isManha) {
    return shift === 'MANHA';
  }
  return shift === 'NOITE';
}

/**
 * 1. Lógica de Desmembramento de Combos (Sincronizado em Tempo Real com Firestore):
 * Recebe a Data e o Turno (do turno ativo ou selecionado), filtra as vendas da Aba 1 (comandas_boliche)
 * e calcula exatamente quantas fichas físicas (Pratas e Douradas) saíram do caixa.
 *
 * Regras de conversão:
 * - "Ficha de Jogos Eletronicos" (ou "Fichas Eletronicas"): 1 Prata / 0 Dourada
 * - "Mini Combo" ou "Mini Combo Fichas": 5 Pratas / 1 Dourada
 * - "Big Combo" ou "Big Combo Fichas": 10 Pratas / 2 Douradas
 * - "Mega Combo" ou "Mega Combo Fichas": 20 Pratas / 5 Douradas
 */
export function calcularSaidaFichasPorTurno(
  dataSelecionada: string,
  turnoSelecionado: string,
  listaVendas: VendaComanda[]
): DesmembramentoFichasResult {
  const targetDDMM = extractDDMM(dataSelecionada);

  let pratasVendidas = 0;
  let douradasVendidas = 0;
  let qtdFichaAvulsa = 0;
  let qtdMiniCombo = 0;
  let qtdBigCombo = 0;
  let qtdMegaCombo = 0;
  let totalRegistrosFichas = 0;

  if (!targetDDMM || !Array.isArray(listaVendas)) {
    return {
      pratasVendidas,
      douradasVendidas,
      qtdFichaAvulsa,
      qtdMiniCombo,
      qtdBigCombo,
      qtdMegaCombo,
      totalRegistrosFichas,
    };
  }

  for (const venda of listaVendas) {
    // Ignora vendas canceladas no Volux
    if (venda.cancelado || venda.status === 'Cancelado') {
      continue;
    }

    const vendaDDMM = extractDDMM(venda.data || '');
    if (vendaDDMM !== targetDDMM) {
      continue;
    }

    if (!matchesClosingTurno(venda.hora || '', turnoSelecionado)) {
      continue;
    }

    const rawQtde = (venda as any).qtde ?? (venda as any).Qtde ?? 1;
    const qtde =
      typeof rawQtde === 'number' && rawQtde > 0
        ? Math.floor(rawQtde)
        : Math.max(1, parseInt(String(rawQtde), 10) || 1);

    const itemNorm = (venda.item || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const isCortesiaManualOuManutencao =
      Boolean(venda.isManutencao) ||
      venda.motivoOperacional === 'Manutenção' ||
      itemNorm.includes('manutencao') ||
      itemNorm.includes('cortesia') ||
      ((Boolean(venda.isCortesia) || venda.motivoOperacional === 'Cortesia') &&
        !isRegistroConta3000(venda) &&
        !itemNorm.includes('combo') &&
        !itemNorm.includes('ficha de jogos'));

    // Desmembramento multiplicado por venda.qtde:
    // Ex: 1 linha de 2x Mega Combo = 40 Pratas e 10 Douradas
    // Ex: 1 linha de 2x Ficha de Jogos Eletronicos = 2 Pratas
    if (itemNorm.includes('mega combo')) {
      pratasVendidas += 20 * qtde;
      douradasVendidas += 5 * qtde;
      qtdMegaCombo += qtde;
      totalRegistrosFichas += qtde;
    } else if (itemNorm.includes('big combo')) {
      pratasVendidas += 10 * qtde;
      douradasVendidas += 2 * qtde;
      qtdBigCombo += qtde;
      totalRegistrosFichas += qtde;
    } else if (itemNorm.includes('mini combo')) {
      pratasVendidas += 5 * qtde;
      douradasVendidas += 1 * qtde;
      qtdMiniCombo += qtde;
      totalRegistrosFichas += qtde;
    } else if (isCortesiaManualOuManutencao && venda.tipo_venda === 'Fichas') {
      // Manutenção e Cortesia Manual de Fichas: 0 Prata / 1 Dourada por unidade
      pratasVendidas += 0;
      douradasVendidas += 1 * qtde;
      qtdFichaAvulsa += qtde;
      totalRegistrosFichas += qtde;
    } else if (
      itemNorm.includes('ficha de jogos eletronicos') ||
      itemNorm.includes('fichas eletronicas') ||
      itemNorm.includes('ficha eletronica') ||
      itemNorm.includes('ficha individual')
    ) {
      pratasVendidas += 1 * qtde;
      douradasVendidas += 0 * qtde;
      qtdFichaAvulsa += qtde;
      totalRegistrosFichas += qtde;
    }
  }

  return {
    pratasVendidas,
    douradasVendidas,
    qtdFichaAvulsa,
    qtdMiniCombo,
    qtdBigCombo,
    qtdMegaCombo,
    totalRegistrosFichas,
  };
}

export const ControleFichasTab: React.FC<ControleFichasTabProps> = ({
  vendas,
  fechamentos,
  turnoAtivo,
  onAbrirTurno,
  onRegistrarReposicao,
  onEncerrarTurno,
  onDeleteFechamento,
  onResetFechamentos,
}) => {
  const isCaixaAberto = Boolean(turnoAtivo && turnoAtivo.aberto);

  // Dias únicos disponíveis nas vendas da Aba 1 (ordenados cronologicamente)
  const availableSalesDays = useMemo(() => {
    const daysSet = new Set<string>();
    vendas.forEach((v) => {
      if (!v.cancelado && v.status !== 'Cancelado' && v.data) {
        daysSet.add(extractDDMM(v.data));
      }
    });
    return Array.from(daysSet).sort(compareDatesChronologically);
  }, [vendas]);

  const ddmmToDateInput = (ddmm: string): string => {
    const parts = ddmm.split('/');
    if (parts.length >= 2) {
      const yyyy = new Date().getFullYear();
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const getInitialDateInput = () => {
    if (availableSalesDays.length > 0) {
      return ddmmToDateInput(availableSalesDays[availableSalesDays.length - 1]);
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // --- ESTADOS DA TELA 1: ABERTURA DE TURNO (Caixa Fechado) ---
  const [dataAbertura, setDataAbertura] = useState(getInitialDateInput);
  const [turnoAbertura, setTurnoAbertura] = useState<TurnoOpcao>('Manhã (09:00 às 15:59)');
  const [responsavelAbertura, setResponsavelAbertura] = useState('');
  const [inicialPrataInput, setInicialPrataInput] = useState<string>('500');
  const [inicialDouradaInput, setInicialDouradaInput] = useState<string>('150');
  const [aberturaError, setAberturaError] = useState<string | null>(null);
  const [isSubmittingAbertura, setIsSubmittingAbertura] = useState(false);

  // --- ESTADOS DA TELA 2: FECHAMENTO DE TURNO (Caixa Aberto) ---
  const [finalPrataInput, setFinalPrataInput] = useState<string>('');
  const [finalDouradaInput, setFinalDouradaInput] = useState<string>('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');
  const [fechamentoError, setFechamentoError] = useState<string | null>(null);
  const [isSubmittingFechamento, setIsSubmittingFechamento] = useState(false);

  // --- ESTADOS DO MODAL DE REPOSIÇÃO (SUPRIMENTO) DURANTE TURNO ABERTO ---
  const [isReposicaoModalOpen, setIsReposicaoModalOpen] = useState(false);
  const [reposicaoPrataInput, setReposicaoPrataInput] = useState<string>('0');
  const [reposicaoDouradaInput, setReposicaoDouradaInput] = useState<string>('0');
  const [reposicaoError, setReposicaoError] = useState<string | null>(null);
  const [isSubmittingReposicao, setIsSubmittingReposicao] = useState(false);

  // Filtro da Tabela de Histórico
  const [searchFilter, setSearchFilter] = useState('');

  // Sincroniza data de abertura sugerida com o dia mais recente que possui vendas na Aba 1
  useEffect(() => {
    if (!isCaixaAberto && availableSalesDays.length > 0) {
      const currentDDMM = extractDDMM(dataAbertura);
      if (!availableSalesDays.includes(currentDDMM)) {
        setDataAbertura(ddmmToDateInput(availableSalesDays[availableSalesDays.length - 1]));
      }
    }
  }, [availableSalesDays.length, isCaixaAberto]);

  // Quando um turno é aberto (ou carregado do Firestore), calcula as vendas do período em tempo real
  const desmembramentoAtivo = useMemo(() => {
    if (isCaixaAberto && turnoAtivo) {
      return calcularSaidaFichasPorTurno(turnoAtivo.data, turnoAtivo.turno, vendas);
    }
    return calcularSaidaFichasPorTurno(dataAbertura, turnoAbertura, vendas);
  }, [isCaixaAberto, turnoAtivo, dataAbertura, turnoAbertura, vendas]);

  // Valores do Turno Ativo (Tela 2) incluindo Reposição (Suprimento)
  const ativoInicialPrata =
    isCaixaAberto && turnoAtivo ? turnoAtivo.inicialPrata : parseInt(inicialPrataInput, 10) || 0;
  const ativoInicialDourada =
    isCaixaAberto && turnoAtivo
      ? turnoAtivo.inicialDourada
      : parseInt(inicialDouradaInput, 10) || 0;

  const ativoReposicaoPrata =
    isCaixaAberto && turnoAtivo ? Math.max(0, Number(turnoAtivo.reposicaoPrata ?? 0) || 0) : 0;
  const ativoReposicaoDourada =
    isCaixaAberto && turnoAtivo ? Math.max(0, Number(turnoAtivo.reposicaoDourada ?? 0) || 0) : 0;

  // Matemática Refatorada da Auditoria:
  // Final Esperado Prata = (Inicial Prata) + (Reposição Prata) - (Saída Sistema Prata)
  // Final Esperado Dourada = (Inicial Dourada) + (Reposição Dourada) - (Saída Sistema Dourada)
  const esperadoPrata =
    ativoInicialPrata + ativoReposicaoPrata - desmembramentoAtivo.pratasVendidas;
  const esperadoDourada =
    ativoInicialDourada + ativoReposicaoDourada - desmembramentoAtivo.douradasVendidas;

  // Inicializa os inputs de Contagem Final Manual quando o turno abre
  useEffect(() => {
    if (isCaixaAberto && turnoAtivo) {
      setFinalPrataInput((prev) => (prev === '' ? String(Math.max(0, esperadoPrata)) : prev));
      setFinalDouradaInput((prev) => (prev === '' ? String(Math.max(0, esperadoDourada)) : prev));
    }
  }, [isCaixaAberto, turnoAtivo?.abertoEm]);

  // Fechar modal de Reposição ao pressionar ESC
  useEffect(() => {
    if (!isReposicaoModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsReposicaoModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReposicaoModalOpen]);

  const numFinalPrata = parseInt(finalPrataInput, 10) || 0;
  const numFinalDourada = parseInt(finalDouradaInput, 10) || 0;

  // Diferença em Tempo Real = Final Manual - Esperado pelo Sistema
  const diferencaPrata = numFinalPrata - esperadoPrata;
  const diferencaDourada = numFinalDourada - esperadoDourada;

  // Handler Tela 1 -> Abrir Turno no Firestore (status_caixa/atual)
  const handleAbrirTurnoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAberturaError(null);

    if (!dataAbertura) {
      setAberturaError('Por favor, selecione a data de abertura do turno.');
      return;
    }

    if (!responsavelAbertura.trim()) {
      setAberturaError('Por favor, informe o nome do operador responsável pela abertura.');
      return;
    }

    const numIniPrata = parseInt(inicialPrataInput, 10);
    const numIniDourada = parseInt(inicialDouradaInput, 10);

    if (inicialPrataInput === '' || isNaN(numIniPrata) || numIniPrata < 0) {
      setAberturaError('O estoque inicial de Fichas Pratas deve ser um número válido (>= 0).');
      return;
    }

    if (inicialDouradaInput === '' || isNaN(numIniDourada) || numIniDourada < 0) {
      setAberturaError('O estoque inicial de Fichas Douradas deve ser um número válido (>= 0).');
      return;
    }

    const [yyyy, mm, dd] = dataAbertura.split('-');
    const dataExibicao = `${dd}/${mm}/${yyyy}`;
    const horarioAbertura = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const novoTurnoAtivo: TurnoAtivoCaixa = {
      aberto: true,
      data: dataAbertura,
      dataExibicao,
      turno: turnoAbertura,
      responsavel: responsavelAbertura.trim(),
      inicialPrata: numIniPrata,
      inicialDourada: numIniDourada,
      reposicaoPrata: 0,
      reposicaoDourada: 0,
      abertoEm: horarioAbertura,
    };

    try {
      setIsSubmittingAbertura(true);
      // Prepara os campos finais sugeridos para a Tela 2
      const saidas = calcularSaidaFichasPorTurno(dataAbertura, turnoAbertura, vendas);
      setFinalPrataInput(String(Math.max(0, numIniPrata - saidas.pratasVendidas)));
      setFinalDouradaInput(String(Math.max(0, numIniDourada - saidas.douradasVendidas)));
      setObservacaoFechamento('');
      await onAbrirTurno(novoTurnoAtivo);
    } catch (err: any) {
      setAberturaError(err?.message || 'Erro ao abrir o turno no LocalStorage.');
    } finally {
      setIsSubmittingAbertura(false);
    }
  };

  // Handler Modal de Reposição (Suprimento) -> Atualiza status_caixa/atual somando os valores
  const handleOpenReposicaoModal = () => {
    setReposicaoError(null);
    setReposicaoPrataInput('0');
    setReposicaoDouradaInput('0');
    setIsReposicaoModalOpen(true);
  };

  const handleConfirmarReposicaoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReposicaoError(null);

    const addPrata = parseInt(reposicaoPrataInput, 10) || 0;
    const addDourada = parseInt(reposicaoDouradaInput, 10) || 0;

    if (addPrata < 0 || addDourada < 0) {
      setReposicaoError('As quantidades adicionadas não podem ser negativas.');
      return;
    }

    if (addPrata === 0 && addDourada === 0) {
      setReposicaoError('Informe pelo menos uma quantidade de Fichas Pratas ou Douradas (> 0) para repor.');
      return;
    }

    try {
      setIsSubmittingReposicao(true);
      const prevEsperadoPrata = esperadoPrata;
      const prevEsperadoDourada = esperadoDourada;

      await onRegistrarReposicao(addPrata, addDourada);

      // Se o campo de contagem final manual ainda estava sincronizado com o esperado anterior, acompanha a reposição
      setFinalPrataInput((prev) =>
        prev === String(Math.max(0, prevEsperadoPrata))
          ? String(Math.max(0, prevEsperadoPrata + addPrata))
          : prev
      );
      setFinalDouradaInput((prev) =>
        prev === String(Math.max(0, prevEsperadoDourada))
          ? String(Math.max(0, prevEsperadoDourada + addDourada))
          : prev
      );

      setIsReposicaoModalOpen(false);
    } catch (err: any) {
      setReposicaoError(err?.message || 'Erro ao registrar reposição no LocalStorage.');
    } finally {
      setIsSubmittingReposicao(false);
    }
  };

  // Handler Tela 2 -> Finalizar e Fechar Turno (grava em fechamentos_historico e limpa status_caixa/atual)
  const handleEncerrarTurnoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFechamentoError(null);

    if (!turnoAtivo) return;

    if (finalPrataInput === '' || isNaN(numFinalPrata) || numFinalPrata < 0) {
      setFechamentoError('Informe a contagem final manual de Fichas Pratas (>= 0).');
      return;
    }

    if (finalDouradaInput === '' || isNaN(numFinalDourada) || numFinalDourada < 0) {
      setFechamentoError('Informe a contagem final manual de Fichas Douradas (>= 0).');
      return;
    }

    const horarioFechamento = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const novoFechamento: FechamentoTurnoFichas = {
      id: generateUniqueId(),
      data: turnoAtivo.dataExibicao || turnoAtivo.data,
      turno: turnoAtivo.turno,
      responsavel: turnoAtivo.responsavel,
      inicialPrata: turnoAtivo.inicialPrata,
      reposicaoPrata: ativoReposicaoPrata,
      vendidasPrataSistema: desmembramentoAtivo.pratasVendidas,
      esperadoPrata,
      finalPrata: numFinalPrata,
      diferencaPrata,
      inicialDourada: turnoAtivo.inicialDourada,
      reposicaoDourada: ativoReposicaoDourada,
      vendidasDouradaSistema: desmembramentoAtivo.douradasVendidas,
      esperadoDourada,
      finalDourada: numFinalDourada,
      diferencaDourada,
      contagemInicial: turnoAtivo.inicialPrata + turnoAtivo.inicialDourada,
      contagemFinal: numFinalPrata + numFinalDourada,
      fichasVendidas: desmembramentoAtivo.pratasVendidas + desmembramentoAtivo.douradasVendidas,
      observacao: observacaoFechamento.trim() || undefined,
      abertoEm: turnoAtivo.abertoEm,
      timestamp: horarioFechamento,
    };

    try {
      setIsSubmittingFechamento(true);
      await onEncerrarTurno(novoFechamento);

      // Ao voltar para a Tela 1, sugere o saldo final contado como estoque inicial do próximo turno
      setInicialPrataInput(String(numFinalPrata));
      setInicialDouradaInput(String(numFinalDourada));
      setResponsavelAbertura('');
      setFinalPrataInput('');
      setFinalDouradaInput('');
      setObservacaoFechamento('');
    } catch (err: any) {
      setFechamentoError(err?.message || 'Erro ao encerrar o turno no LocalStorage.');
    } finally {
      setIsSubmittingFechamento(false);
    }
  };

  // Helpers para leitura segura do histórico (incluindo Reposição)
  const getHistInicialPrata = (f: FechamentoTurnoFichas) =>
    typeof f.inicialPrata === 'number' ? f.inicialPrata : f.contagemInicial ?? 0;
  const getHistInicialDourada = (f: FechamentoTurnoFichas) =>
    typeof f.inicialDourada === 'number' ? f.inicialDourada : 0;
  const getHistReposicaoPrata = (f: FechamentoTurnoFichas) =>
    typeof f.reposicaoPrata === 'number' ? Math.max(0, f.reposicaoPrata) : 0;
  const getHistReposicaoDourada = (f: FechamentoTurnoFichas) =>
    typeof f.reposicaoDourada === 'number' ? Math.max(0, f.reposicaoDourada) : 0;
  const getHistVendidasPrata = (f: FechamentoTurnoFichas) =>
    typeof f.vendidasPrataSistema === 'number' ? f.vendidasPrataSistema : f.fichasVendidas ?? 0;
  const getHistVendidasDourada = (f: FechamentoTurnoFichas) =>
    typeof f.vendidasDouradaSistema === 'number' ? f.vendidasDouradaSistema : 0;
  const getHistEsperadoPrata = (f: FechamentoTurnoFichas) =>
    typeof f.esperadoPrata === 'number'
      ? f.esperadoPrata
      : getHistInicialPrata(f) + getHistReposicaoPrata(f) - getHistVendidasPrata(f);
  const getHistEsperadoDourada = (f: FechamentoTurnoFichas) =>
    typeof f.esperadoDourada === 'number'
      ? f.esperadoDourada
      : getHistInicialDourada(f) + getHistReposicaoDourada(f) - getHistVendidasDourada(f);
  const getHistFinalPrata = (f: FechamentoTurnoFichas) =>
    typeof f.finalPrata === 'number' ? f.finalPrata : f.contagemFinal ?? 0;
  const getHistFinalDourada = (f: FechamentoTurnoFichas) =>
    typeof f.finalDourada === 'number' ? f.finalDourada : 0;
  const getHistDifPrata = (f: FechamentoTurnoFichas) =>
    typeof f.diferencaPrata === 'number'
      ? f.diferencaPrata
      : getHistFinalPrata(f) - getHistEsperadoPrata(f);
  const getHistDifDourada = (f: FechamentoTurnoFichas) =>
    typeof f.diferencaDourada === 'number'
      ? f.diferencaDourada
      : getHistFinalDourada(f) - getHistEsperadoDourada(f);

  // Exportar histórico para CSV (incluindo colunas de Reposição)
  const handleExportHistoryCSV = () => {
    if (fechamentos.length === 0) return;
    const headers = [
      'ID',
      'Data',
      'Turno',
      'Responsável',
      'Inicial Prata',
      'Inicial Dourada',
      'Reposição Prata',
      'Reposição Dourada',
      'Vendidas Prata (Sistema)',
      'Vendidas Dourada (Sistema)',
      'Esperado Prata',
      'Esperado Dourada',
      'Final Prata (Manual)',
      'Final Dourada (Manual)',
      'Diferença Prata',
      'Diferença Dourada',
      'Observação',
    ];
    const rows = fechamentos.map((f) => [
      `"${f.id}"`,
      `"${f.data}"`,
      `"${f.turno}"`,
      `"${f.responsavel}"`,
      `"${getHistInicialPrata(f)}"`,
      `"${getHistInicialDourada(f)}"`,
      `"${getHistReposicaoPrata(f)}"`,
      `"${getHistReposicaoDourada(f)}"`,
      `"${getHistVendidasPrata(f)}"`,
      `"${getHistVendidasDourada(f)}"`,
      `"${getHistEsperadoPrata(f)}"`,
      `"${getHistEsperadoDourada(f)}"`,
      `"${getHistFinalPrata(f)}"`,
      `"${getHistFinalDourada(f)}"`,
      `"${getHistDifPrata(f)}"`,
      `"${getHistDifDourada(f)}"`,
      `"${(f.observacao || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historico-auditoria-fichas-prata-dourada.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPratasVendidasHist = fechamentos.reduce(
    (acc, f) => acc + Math.max(0, getHistVendidasPrata(f)),
    0
  );
  const totalDouradasVendidasHist = fechamentos.reduce(
    (acc, f) => acc + Math.max(0, getHistVendidasDourada(f)),
    0
  );
  const turnosComQuebraCount = fechamentos.filter(
    (f) => getHistDifPrata(f) !== 0 || getHistDifDourada(f) !== 0
  ).length;

  const filteredFechamentos = fechamentos.filter((f) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      f.data.toLowerCase().includes(q) ||
      f.responsavel.toLowerCase().includes(q) ||
      f.turno.toLowerCase().includes(q)
    );
  });

  const formatDiffSign = (diff: number) => {
    if (diff === 0) return '0 (Exato)';
    return diff > 0 ? `+${diff} (Sobra)` : `${diff} (Falta)`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cards Superiores de Resumo Geral de Fichas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Status Atual do Caixa / Turno */}
        <div
          className={`rounded-xl p-5 border shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors ${
            isCaixaAberto
              ? 'bg-emerald-50/50 border-emerald-200/90'
              : 'bg-white border-neutral-200/90'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-neutral-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  isCaixaAberto ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                }`}
              />
              Status do Caixa (LocalStorage)
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                isCaixaAberto
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-neutral-100 text-neutral-600 border-neutral-200'
              }`}
            >
              {isCaixaAberto ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-neutral-900 tracking-tight">
            {isCaixaAberto ? 'Caixa Aberto · Em Turno' : 'Caixa Fechado'}
          </div>
          <div className="text-xs text-neutral-500 mt-1 truncate">
            {isCaixaAberto && turnoAtivo
              ? `${turnoAtivo.responsavel} · ${turnoAtivo.dataExibicao} (${turnoAtivo.turno.split(' ')[0]})`
              : 'Abra um novo turno abaixo para iniciar a contagem'}
          </div>
        </div>

        {/* Card 2: Acumulado de Fichas Pratas e Douradas */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Saída Acumulada (Histórico)
            </span>
            <div className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {formatNumber(totalPratasVendidasHist)} P{' '}
            <span className="text-neutral-300 font-normal">/</span>{' '}
            <span className="text-amber-700">{formatNumber(totalDouradasVendidasHist)} D</span>
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            Total em {fechamentos.length} {fechamentos.length === 1 ? 'turno fechado' : 'turnos fechados'} no LocalStorage
          </div>
        </div>

        {/* Card 3: Status de Auditoria de Caixa */}
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Auditoria de Fechamentos
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                turnosComQuebraCount === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                  : 'bg-red-50 text-red-700 border-red-200/70'
              }`}
            >
              {turnosComQuebraCount === 0 ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {fechamentos.length === 0
              ? 'Nenhum turno salvo'
              : turnosComQuebraCount === 0
              ? '100% Conciliado'
              : `${turnosComQuebraCount} ${turnosComQuebraCount === 1 ? 'turno c/ divergência' : 'turnos c/ divergência'}`}
          </div>
          <div className="text-xs text-neutral-500 mt-1 truncate">
            {fechamentos[0]
              ? `Último: ${fechamentos[0].responsavel} (${fechamentos[0].data})`
              : 'Salvo instantaneamente no LocalStorage'}
          </div>
        </div>
      </div>

      {/* =====================================================================
          FLUXO DE ABERTURA E FECHAMENTO DE TURNO (TELA 1 vs TELA 2)
         ===================================================================== */}
      {!isCaixaAberto ? (
        /* TELA 1: CAIXA FECHADO / SEM TURNO ATIVO -> FORMULÁRIO DE ABERTURA DE TURNO */
        <div className="bg-white border border-neutral-200/90 rounded-xl p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 mb-5">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                <PlayCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-neutral-900">
                    Abertura de Turno · Controle Físico de Fichas
                  </h2>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                    Caixa Fechado
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Informe a Data, o Turno, o Operador Responsável e a contagem física inicial de Fichas Pratas e Douradas para abrir o turno na nuvem.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 rounded-lg self-start sm:self-auto shrink-0">
              <Cloud className="w-3.5 h-3.5" />
              <span>LocalStorage Instantâneo</span>
            </div>
          </div>

          {aberturaError && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{aberturaError}</span>
            </div>
          )}

          <form onSubmit={handleAbrirTurnoSubmit} className="space-y-6">
            {/* Linha 1: Data, Turno e Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Data da Abertura */}
              <div>
                <label
                  htmlFor="data-abertura"
                  className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Data do Turno *</span>
                </label>
                <input
                  id="data-abertura"
                  type="date"
                  required
                  value={dataAbertura}
                  onChange={(e) => setDataAbertura(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
                {availableSalesDays.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-neutral-400">Dias c/ vendas:</span>
                    {availableSalesDays.map((day) => {
                      const isSelected = extractDDMM(dataAbertura) === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setDataAbertura(ddmmToDateInput(day))}
                          className={`text-[11px] font-mono-tabular px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-900 text-white font-semibold'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Turno */}
              <div>
                <label
                  htmlFor="select-turno-abertura"
                  className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Turno *</span>
                </label>
                <div className="relative">
                  <select
                    id="select-turno-abertura"
                    required
                    value={turnoAbertura}
                    onChange={(e) => setTurnoAbertura(e.target.value as TurnoOpcao)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 appearance-none focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 cursor-pointer font-medium"
                  >
                    <option value="Manhã (09:00 às 15:59)">Manhã (09:00 às 15:59)</option>
                    <option value="Noite (16:00 às 23:00)">Noite (16:00 às 23:00)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Prévia no período selecionado: {desmembramentoAtivo.pratasVendidas} Pratas / {desmembramentoAtivo.douradasVendidas} Douradas vendidas
                </p>
              </div>

              {/* Responsável */}
              <div>
                <label
                  htmlFor="input-responsavel-abertura"
                  className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Responsável (Operador) *</span>
                </label>
                <input
                  id="input-responsavel-abertura"
                  type="text"
                  required
                  value={responsavelAbertura}
                  onChange={(e) => setResponsavelAbertura(e.target.value)}
                  placeholder="ex: Carlos Lima"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>

            {/* Linha 2: Contagem Inicial de Abertura (Pratas e Douradas) */}
            <div className="p-4 sm:p-5 rounded-xl bg-neutral-50/80 border border-neutral-200/90 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-200/70 pb-2.5">
                <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  Estoque Físico de Abertura (Contagem Inicial na Gaveta/Cofre)
                </span>
                {fechamentos[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      setInicialPrataInput(String(getHistFinalPrata(fechamentos[0])));
                      setInicialDouradaInput(String(getHistFinalDourada(fechamentos[0])));
                    }}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-medium underline cursor-pointer self-start sm:self-auto"
                  >
                    Usar saldo final do último turno ({getHistFinalPrata(fechamentos[0])} P / {getHistFinalDourada(fechamentos[0])} D)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Inicial Pratas */}
                <div>
                  <label
                    htmlFor="abertura-inicial-prata"
                    className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                    <span>Inicial Pratas (Eletrônicas) *</span>
                  </label>
                  <input
                    id="abertura-inicial-prata"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={inicialPrataInput}
                    onChange={(e) => setInicialPrataInput(e.target.value)}
                    placeholder="ex: 500"
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular text-base font-semibold focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                  />
                  <span className="block text-[11px] text-neutral-400 mt-1">
                    Quantidade física de fichas pratas no início do turno
                  </span>
                </div>

                {/* Inicial Douradas */}
                <div>
                  <label
                    htmlFor="abertura-inicial-dourada"
                    className="block text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>Inicial Douradas (Bônus Combos) *</span>
                  </label>
                  <input
                    id="abertura-inicial-dourada"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={inicialDouradaInput}
                    onChange={(e) => setInicialDouradaInput(e.target.value)}
                    placeholder="ex: 150"
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-lg text-neutral-900 font-mono-tabular text-base font-semibold focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/15"
                  />
                  <span className="block text-[11px] text-neutral-400 mt-1">
                    Quantidade física de fichas douradas no início do turno
                  </span>
                </div>
              </div>
            </div>

            {/* Botão Abrir Turno */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="text-xs text-neutral-500">
                Ao abrir o turno, os dados ficam salvos em <code className="font-mono text-neutral-700">turno_ativo</code> no LocalStorage.
              </p>
              <button
                type="submit"
                disabled={isSubmittingAbertura}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 active:bg-neutral-950 disabled:opacity-50 transition-all shadow-sm cursor-pointer shrink-0"
              >
                <PlayCircle className="w-4 h-4" />
                <span>{isSubmittingAbertura ? 'Abrindo Turno...' : 'Abrir Turno'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* TELA 2: CAIXA ABERTO / COM TURNO ATIVO -> PAINEL EM ANDAMENTO + AUDITORIA E FECHAMENTO */
        <div className="bg-white border-2 border-emerald-500/30 rounded-xl p-5 sm:p-6 shadow-sm space-y-6">
          {/* Cabeçalho do Turno Ativo */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-neutral-900">
                    Turno em Andamento · Conferência e Fechamento de Caixa
                  </h2>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Caixa Aberto às {turnoAtivo?.abertoEm}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  As fichas vendidas são calculadas em tempo real cruzando com os lançamentos da Aba 1 ({extractDDMM(turnoAtivo?.data || '')} · {turnoAtivo?.turno}).
                </p>
              </div>
            </div>

            {/* Metadados Bloqueados de Quem Abriu */}
            <div className="flex flex-wrap items-center gap-2 text-xs bg-neutral-50 border border-neutral-200/90 rounded-lg px-3.5 py-2">
              <div className="flex items-center gap-1.5 text-neutral-700">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>Operador:</span>
                <strong className="text-neutral-900">{turnoAtivo?.responsavel}</strong>
              </div>
              <span className="text-neutral-300">|</span>
              <div className="flex items-center gap-1.5 text-neutral-700">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <strong className="font-mono-tabular text-neutral-900">
                  {turnoAtivo?.dataExibicao}
                </strong>
              </div>
              <span className="text-neutral-300">|</span>
              <div className="flex items-center gap-1.5 text-neutral-700">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <strong className="text-neutral-900">{turnoAtivo?.turno}</strong>
              </div>
            </div>
          </div>

          {fechamentoError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{fechamentoError}</span>
            </div>
          )}

          <form onSubmit={handleEncerrarTurnoSubmit} className="space-y-6">
            {/* Linha 1: Estoque Inicial Bloqueado (Somente Leitura) vs Contagem Final Manual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Bloco 1: Estoque Inicial Bloqueado (Somente Leitura) */}
              <div className="p-4 rounded-xl bg-neutral-100/70 border border-neutral-200/90 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-200/80 pb-2">
                  <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-neutral-500" />
                    1. Estoque Inicial (Bloqueado na Abertura)
                  </span>
                  <span className="text-[11px] text-neutral-500 font-medium">Somente Leitura</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                      <span>Inicial Pratas (Fixo)</span>
                    </label>
                    <input
                      type="number"
                      readOnly
                      disabled
                      value={ativoInicialPrata}
                      className="w-full px-3 py-2 bg-neutral-200/60 border border-neutral-300 rounded-lg text-neutral-700 font-mono-tabular text-base font-semibold cursor-not-allowed"
                    />
                    <span className="block text-[11px] text-neutral-500 mt-1 font-mono-tabular">
                      {ativoReposicaoPrata > 0
                        ? `Reposição no turno: +${ativoReposicaoPrata} Pratas`
                        : 'Gravado na abertura do turno'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-800/80 mb-1 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>Inicial Douradas (Fixo)</span>
                    </label>
                    <input
                      type="number"
                      readOnly
                      disabled
                      value={ativoInicialDourada}
                      className="w-full px-3 py-2 bg-amber-100/40 border border-amber-300/80 rounded-lg text-amber-950 font-mono-tabular text-base font-semibold cursor-not-allowed"
                    />
                    <span className="block text-[11px] text-neutral-500 mt-1 font-mono-tabular">
                      {ativoReposicaoDourada > 0
                        ? `Reposição no turno: +${ativoReposicaoDourada} Douradas`
                        : 'Gravado na abertura do turno'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Contagem Final Manual (Preenchimento de Fechamento) */}
              <div className="p-4 rounded-xl bg-white border-2 border-neutral-900/15 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-neutral-200/70 pb-2">
                  <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    2. Contagem Final Manual (Fechamento)
                  </span>
                  <span className="text-[11px] text-neutral-500">Conte as fichas físicas na gaveta</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="final-prata"
                      className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                      <span>Final Pratas (Manual) *</span>
                    </label>
                    <input
                      id="final-prata"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={finalPrataInput}
                      onChange={(e) => setFinalPrataInput(e.target.value)}
                      placeholder="ex: 380"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-neutral-900 font-mono-tabular text-base font-semibold focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                    />
                    <span className="block text-[11px] text-neutral-500 mt-1">
                      Esperado pelo sistema: <strong className="font-mono-tabular">{esperadoPrata}</strong>
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="final-dourada"
                      className="block text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>Final Douradas (Manual) *</span>
                    </label>
                    <input
                      id="final-dourada"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={finalDouradaInput}
                      onChange={(e) => setFinalDouradaInput(e.target.value)}
                      placeholder="ex: 130"
                      className="w-full px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg text-neutral-900 font-mono-tabular text-base font-semibold focus:outline-none focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/15"
                    />
                    <span className="block text-[11px] text-neutral-500 mt-1">
                      Esperado pelo sistema: <strong className="font-mono-tabular">{esperadoDourada}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card de Auditoria em Tempo Real (Cruzamento Automático com a Aba 1 + Suprimento) */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 overflow-hidden">
              <div className="px-4 py-3 bg-neutral-100/80 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-neutral-800" />
                    <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Auditoria em Tempo Real · Cruzamento com Vendas do Turno ({extractDDMM(turnoAtivo?.data || '')})
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 font-mono-tabular flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Layers className="w-3.5 h-3.5 text-neutral-500 inline" />
                    <span>
                      Avulsas: <strong>{desmembramentoAtivo.qtdFichaAvulsa}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Mini Combo: <strong>{desmembramentoAtivo.qtdMiniCombo}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Big Combo: <strong>{desmembramentoAtivo.qtdBigCombo}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Mega Combo: <strong>{desmembramentoAtivo.qtdMegaCombo}</strong>
                    </span>
                  </div>
                </div>

                {/* Botão Discreto: ➕ Registrar Reposição (Suprimento) */}
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenReposicaoModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 hover:border-neutral-400 active:bg-neutral-100 transition-all shadow-2xs cursor-pointer"
                  >
                    <span>➕ Registrar Reposição (Suprimento)</span>
                  </button>
                </div>
              </div>

              {/* Grid Duplo de Auditoria: Fichas Pratas vs Fichas Douradas */}
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Auditoria Fichas Pratas */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Auditoria · Fichas Pratas
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono-tabular">
                      1x Avulsa | 5x Mini | 10x Big | 20x Mega
                    </span>
                  </div>

                  {/* Percurso Matemático Explícito */}
                  <div className="px-3 py-2 rounded-lg bg-slate-100/75 border border-slate-200/80 text-xs font-mono-tabular text-slate-800 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      Inicial: <strong>{ativoInicialPrata}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-700">
                      Reposição: <strong>+{ativoReposicaoPrata}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-blue-700">
                      Vendas: <strong>-{desmembramentoAtivo.pratasVendidas}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-950 font-semibold">
                      Esperado: <strong>{esperadoPrata}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center bg-slate-50/70 rounded-lg p-2.5 border border-slate-100">
                    <div>
                      <div className="text-[11px] text-neutral-500">Inicial</div>
                      <div className="text-sm sm:text-base font-semibold text-neutral-900 font-mono-tabular">
                        {ativoInicialPrata}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500">Reposição</div>
                      <div className="text-sm sm:text-base font-semibold text-emerald-700 font-mono-tabular">
                        +{ativoReposicaoPrata}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500">Vendas</div>
                      <div className="text-sm sm:text-base font-semibold text-blue-700 font-mono-tabular">
                        -{desmembramentoAtivo.pratasVendidas}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-neutral-700">Esperado</div>
                      <div className="text-sm sm:text-base font-bold text-neutral-900 font-mono-tabular">
                        {esperadoPrata}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      diferencaPrata === 0
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : diferencaPrata < 0
                        ? 'bg-red-50/90 border-red-200 text-red-900'
                        : 'bg-amber-50/90 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">
                        {diferencaPrata === 0
                          ? 'Caixa Batido perfeitamente (Fichas Pratas)'
                          : diferencaPrata < 0
                          ? `Faltando ${Math.abs(diferencaPrata)} ${Math.abs(diferencaPrata) === 1 ? 'Ficha Prata' : 'Fichas Pratas'}`
                          : `Sobrando +${diferencaPrata} ${diferencaPrata === 1 ? 'Ficha Prata' : 'Fichas Pratas'}`}
                      </div>
                      <div className="text-[11px] opacity-85">
                        Final Manual ({numFinalPrata}) − Esperado pelo Sistema ({esperadoPrata})
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono-tabular shrink-0 ml-3">
                      {diferencaPrata > 0 ? `+${diferencaPrata}` : diferencaPrata}
                    </div>
                  </div>
                </div>

                {/* Auditoria Fichas Douradas */}
                <div className="bg-white rounded-xl border border-amber-200/90 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                        Auditoria · Fichas Douradas (Bônus)
                      </h4>
                    </div>
                    <span className="text-[11px] text-amber-700 font-mono-tabular">
                      0x Avulsa | 1x Mini | 2x Big | 5x Mega
                    </span>
                  </div>

                  {/* Percurso Matemático Explícito */}
                  <div className="px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200/80 text-xs font-mono-tabular text-amber-950 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      Inicial: <strong>{ativoInicialDourada}</strong>
                    </span>
                    <span className="text-amber-300">|</span>
                    <span className="text-emerald-700">
                      Reposição: <strong>+{ativoReposicaoDourada}</strong>
                    </span>
                    <span className="text-amber-300">|</span>
                    <span className="text-amber-800">
                      Vendas: <strong>-{desmembramentoAtivo.douradasVendidas}</strong>
                    </span>
                    <span className="text-amber-300">|</span>
                    <span className="text-amber-950 font-semibold">
                      Esperado: <strong>{esperadoDourada}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center bg-amber-50/40 rounded-lg p-2.5 border border-amber-100">
                    <div>
                      <div className="text-[11px] text-neutral-500">Inicial</div>
                      <div className="text-sm sm:text-base font-semibold text-neutral-900 font-mono-tabular">
                        {ativoInicialDourada}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500">Reposição</div>
                      <div className="text-sm sm:text-base font-semibold text-emerald-700 font-mono-tabular">
                        +{ativoReposicaoDourada}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-neutral-500">Vendas</div>
                      <div className="text-sm sm:text-base font-semibold text-amber-700 font-mono-tabular">
                        -{desmembramentoAtivo.douradasVendidas}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-neutral-700">Esperado</div>
                      <div className="text-sm sm:text-base font-bold text-neutral-900 font-mono-tabular">
                        {esperadoDourada}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      diferencaDourada === 0
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : diferencaDourada < 0
                        ? 'bg-red-50/90 border-red-200 text-red-900'
                        : 'bg-amber-50/90 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">
                        {diferencaDourada === 0
                          ? 'Caixa Batido perfeitamente (Fichas Douradas)'
                          : diferencaDourada < 0
                          ? `Faltando ${Math.abs(diferencaDourada)} ${Math.abs(diferencaDourada) === 1 ? 'Ficha Dourada' : 'Fichas Douradas'}`
                          : `Sobrando +${diferencaDourada} ${diferencaDourada === 1 ? 'Ficha Dourada' : 'Fichas Douradas'}`}
                      </div>
                      <div className="text-[11px] opacity-85">
                        Final Manual ({numFinalDourada}) − Esperado pelo Sistema ({esperadoDourada})
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-bold font-mono-tabular shrink-0 ml-3">
                      {diferencaDourada > 0 ? `+${diferencaDourada}` : diferencaDourada}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Observação opcional e Botão Finalizar e Fechar Turno */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <input
                type="text"
                value={observacaoFechamento}
                onChange={(e) => setObservacaoFechamento(e.target.value)}
                placeholder="Observação opcional (ex: Suprimento retirado do cofre às 19h / justificativa de diferença)..."
                className="w-full sm:flex-1 px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-neutral-900"
              />
              <button
                type="submit"
                disabled={isSubmittingFechamento}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50 transition-all shadow-sm cursor-pointer shrink-0"
              >
                <StopCircle className="w-4 h-4" />
                <span>
                  {isSubmittingFechamento
                    ? 'Finalizando Turno...'
                    : 'Finalizar e Fechar Turno'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL DE REPOSIÇÃO DE FICHAS (SUPRIMENTO) DURANTE TURNO ABERTO
         ===================================================================== */}
      {isReposicaoModalOpen && isCaixaAberto && (
        <div
          onClick={() => setIsReposicaoModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reposicao-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-neutral-200 rounded-2xl shadow-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-md p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="modal-reposicao-title" className="text-sm sm:text-base font-semibold text-neutral-900">
                    Registrar Reposição (Suprimento)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Some fichas retiradas do cofre à gaveta do turno atual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReposicaoModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reposicaoError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{reposicaoError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmarReposicaoSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 text-xs text-neutral-600 flex items-center justify-between">
                <span>Suprimento já acumulado neste turno:</span>
                <span className="font-mono-tabular font-semibold text-neutral-900">
                  +{ativoReposicaoPrata} P / +{ativoReposicaoDourada} D
                </span>
              </div>

              <div className="space-y-3">
                {/* Input 1: Pratas Adicionadas */}
                <div>
                  <label
                    htmlFor="input-reposicao-prata"
                    className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                    <span>Pratas Adicionadas</span>
                  </label>
                  <input
                    id="input-reposicao-prata"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={reposicaoPrataInput}
                    onChange={(e) => setReposicaoPrataInput(e.target.value)}
                    placeholder="ex: 100"
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-lg text-neutral-900 font-mono-tabular text-base font-semibold focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                  />
                </div>

                {/* Input 2: Douradas Adicionadas */}
                <div>
                  <label
                    htmlFor="input-reposicao-dourada"
                    className="block text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>Douradas Adicionadas</span>
                  </label>
                  <input
                    id="input-reposicao-dourada"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={reposicaoDouradaInput}
                    onChange={(e) => setReposicaoDouradaInput(e.target.value)}
                    placeholder="ex: 50"
                    className="w-full px-3.5 py-2.5 bg-amber-50/20 border border-amber-300 rounded-lg text-neutral-900 font-mono-tabular text-base font-semibold focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-500/15"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsReposicaoModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReposicao}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingReposicao ? 'Confirmando...' : 'Confirmar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Tabela de Histórico dos Fechamentos Registrados (fechamentos_historico no LocalStorage) */}
      <div className="bg-white border border-neutral-200/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              Histórico de Auditoria e Fechamentos de Fichas (LocalStorage)
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Conferência histórica separada em Fichas Pratas e Fichas Douradas com registro de Suprimento (Reposição) e Diferença
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
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (fechamentos.length > 0) {
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
              Nenhum fechamento registrado no histórico
            </h4>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Abra um turno, confira as vendas de fichas em tempo real e clique em &ldquo;Finalizar e Fechar Turno&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                  <th scope="col" className="py-3 px-3.5">Data / Hora</th>
                  <th scope="col" className="py-3 px-3.5">Turno</th>
                  <th scope="col" className="py-3 px-3.5">Responsável</th>
                  <th scope="col" className="py-3 px-3.5 text-right">
                    Inicial (+Reposição)
                    <span className="block text-[10px] font-normal text-neutral-400 normal-case">
                      Prata / Dourada
                    </span>
                  </th>
                  <th scope="col" className="py-3 px-3.5 text-right">
                    Reposição (Suprimento)
                    <span className="block text-[10px] font-normal text-neutral-400 normal-case">
                      Prata / Dourada
                    </span>
                  </th>
                  <th scope="col" className="py-3 px-3.5 text-right">
                    Saída Sistema
                    <span className="block text-[10px] font-normal text-neutral-400 normal-case">
                      Prata / Dourada
                    </span>
                  </th>
                  <th scope="col" className="py-3 px-3.5 text-right">
                    Esperado
                    <span className="block text-[10px] font-normal text-neutral-400 normal-case">
                      Prata / Dourada
                    </span>
                  </th>
                  <th scope="col" className="py-3 px-3.5 text-right">
                    Final Manual
                    <span className="block text-[10px] font-normal text-neutral-400 normal-case">
                      Prata / Dourada
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-right bg-neutral-100/90 font-bold text-neutral-900 border-l border-neutral-200"
                  >
                    Diferença (Auditoria)
                    <span className="block text-[10px] font-normal text-neutral-500 normal-case">
                      Prata / Dourada
                    </span>
                  </th>
                  <th scope="col" className="py-3 px-3 text-right w-[50px]">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredFechamentos.map((f) => {
                  const iniPrata = getHistInicialPrata(f);
                  const iniDourada = getHistInicialDourada(f);
                  const repPrata = getHistReposicaoPrata(f);
                  const repDourada = getHistReposicaoDourada(f);
                  const vendPrata = getHistVendidasPrata(f);
                  const vendDourada = getHistVendidasDourada(f);
                  const espPrata = getHistEsperadoPrata(f);
                  const espDourada = getHistEsperadoDourada(f);
                  const finPrata = getHistFinalPrata(f);
                  const finDourada = getHistFinalDourada(f);
                  const difPrata = getHistDifPrata(f);
                  const difDourada = getHistDifDourada(f);
                  const hasBreak = difPrata < 0 || difDourada < 0;
                  const hasSurplus = !hasBreak && (difPrata > 0 || difDourada > 0);
                  const hasReposicao = repPrata > 0 || repDourada > 0;

                  return (
                    <tr
                      key={f.id}
                      className={`hover:bg-neutral-50/80 transition-colors group ${
                        hasBreak ? 'bg-red-50/20' : ''
                      }`}
                    >
                      {/* Data */}
                      <td className="py-3.5 px-3.5 font-mono-tabular font-medium text-neutral-900 whitespace-nowrap">
                        {f.data}
                        {(f.abertoEm || f.timestamp) && (
                          <span className="block text-[11px] text-neutral-400 font-normal">
                            {f.abertoEm ? `${f.abertoEm} → ` : ''}
                            {f.timestamp ? `${f.timestamp}` : ''}
                          </span>
                        )}
                      </td>

                      {/* Turno */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-xs text-neutral-700 font-medium">
                        {f.turno}
                      </td>

                      {/* Responsável */}
                      <td className="py-3.5 px-3.5 font-medium text-neutral-800 whitespace-nowrap">
                        <div>{f.responsavel}</div>
                        {f.observacao && (
                          <div
                            className="text-[11px] text-neutral-500 font-normal max-w-[200px] truncate"
                            title={f.observacao}
                          >
                            Obs: {f.observacao}
                          </div>
                        )}
                      </td>

                      {/* Inicial (+Reposição) */}
                      <td className="py-3.5 px-3.5 text-right font-mono-tabular whitespace-nowrap">
                        <div>
                          <span className="font-semibold text-slate-700">{iniPrata} P</span>
                          <span className="text-neutral-300 mx-1.5">/</span>
                          <span className="font-semibold text-amber-700">{iniDourada} D</span>
                        </div>
                        {hasReposicao && (
                          <div className="text-[11px] text-emerald-700 font-medium">
                            (+{repPrata} P / +{repDourada} D)
                          </div>
                        )}
                      </td>

                      {/* Reposição (Suprimento) */}
                      <td className="py-3.5 px-3.5 text-right font-mono-tabular whitespace-nowrap">
                        {hasReposicao ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                            +{repPrata} P / +{repDourada} D
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs">0 P / 0 D</span>
                        )}
                      </td>

                      {/* Vendidas no Sistema (Prata / Dourada) */}
                      <td className="py-3.5 px-3.5 text-right font-mono-tabular whitespace-nowrap">
                        <span className="text-slate-700">-{vendPrata} P</span>
                        <span className="text-neutral-300 mx-1.5">/</span>
                        <span className="text-amber-700">-{vendDourada} D</span>
                      </td>

                      {/* Esperado pelo Sistema (Prata / Dourada) */}
                      <td className="py-3.5 px-3.5 text-right font-mono-tabular whitespace-nowrap">
                        <span className="font-semibold text-neutral-800">{espPrata} P</span>
                        <span className="text-neutral-300 mx-1.5">/</span>
                        <span className="font-semibold text-amber-800">{espDourada} D</span>
                      </td>

                      {/* Final Manual (Prata / Dourada) */}
                      <td className="py-3.5 px-3.5 text-right font-mono-tabular whitespace-nowrap">
                        <span className="font-bold text-slate-900">{finPrata} P</span>
                        <span className="text-neutral-300 mx-1.5">/</span>
                        <span className="font-bold text-amber-900">{finDourada} D</span>
                      </td>

                      {/* Coluna Destacada: Diferença (Prata / Dourada) */}
                      <td
                        className={`py-3.5 px-4 text-right font-mono-tabular whitespace-nowrap border-l ${
                          hasBreak
                            ? 'bg-red-50/70 border-red-200 text-red-900'
                            : hasSurplus
                            ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                            : 'bg-emerald-50/40 border-neutral-200 text-emerald-900'
                        }`}
                      >
                        <div className="flex flex-col items-end gap-0.5 text-xs">
                          <span
                            className={
                              difPrata < 0
                                ? 'font-bold text-red-700'
                                : difPrata > 0
                                ? 'font-bold text-amber-700'
                                : 'font-semibold text-emerald-700'
                            }
                          >
                            Prata: {formatDiffSign(difPrata)}
                          </span>
                          <span
                            className={
                              difDourada < 0
                                ? 'font-bold text-red-700'
                                : difDourada > 0
                                ? 'font-bold text-amber-700'
                                : 'font-semibold text-emerald-700'
                            }
                          >
                            Dourada: {formatDiffSign(difDourada)}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onDeleteFechamento(f.id)}
                          title="Remover fechamento do LocalStorage"
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-4 py-3 bg-neutral-50/75 border-t border-neutral-200 text-xs text-neutral-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>Total de {fechamentos.length} fechamentos sincronizados na coleção fechamentos_historico.</span>
          <span className="font-mono-tabular font-medium text-neutral-700">
            Saída acumulada: {formatNumber(totalPratasVendidasHist)} Pratas ·{' '}
            {formatNumber(totalDouradasVendidasHist)} Douradas
          </span>
        </div>
      </div>
    </div>
  );
};
