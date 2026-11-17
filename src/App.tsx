import React, { useState, useMemo, useEffect } from 'react';
import {
  VendaComanda,
  FiltroTipo,
  FiltroSubItem,
  FiltroStatusResponsavel,
  FiltroTurno,
  FechamentoTurnoFichas,
  VendaAeB,
  AppTab,
  TurnoAtivoCaixa,
} from './types/venda';
import {
  exportToCSV,
  formatCurrencyBRL,
  compareDateTimeChronologically,
  matchesTurnoFilter,
  getTodayLocalISO,
  isDateWithinRange,
  matchesSubItemFilter,
  isRegistroCortesia,
  isRegistroManutencao,
  isRegistroConta3000,
  isRegistroVoucher,
  recordDateToISO,
  horaToMinutes,
  areSameDateRecords,
  isManualSaleRecord,
  getShiftFromHora,
} from './utils/formatters';
import {
  generateUniqueId,
  toFirestoreDocId,
  identificarItemECategoria,
  normalizeText,
} from './utils/voluxParser';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { TableToolbar } from './components/TableToolbar';
import { SalesTable } from './components/SalesTable';
import { NewSaleModal } from './components/NewSaleModal';
import { EditSaleModal } from './components/EditSaleModal';
import { QuickAssignModal } from './components/QuickAssignModal';
import { BackupModal } from './components/BackupModal';
import { VoluxUploadArea } from './components/VoluxUploadArea';
import { ControleFichasTab } from './components/ControleFichasTab';
import { AeBTab } from './components/AeBTab';
import { RelatoriosTab } from './components/RelatoriosTab';
import { NewAeBSaleModal } from './components/NewAeBSaleModal';
import { EditAeBSaleModal } from './components/EditAeBSaleModal';
import { CheckCircle2, HardDrive, AlertTriangle, Trash2, X } from 'lucide-react';

const LS_KEY_COMANDAS_BOLICHE = 'comandas_boliche';
const LS_KEY_COMANDAS_AEB = 'comandas_aeb';
const LS_KEY_FECHAMENTOS_HISTORICO = 'fechamentos_historico';
const LS_KEY_TURNO_ATIVO = 'turno_ativo';

function loadArrayFromLocalStorage<T>(primaryKey: string, fallbackKeys: string[] = []): T[] {
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    for (const key of fallbackKeys) {
      const fbRaw = localStorage.getItem(key);
      if (fbRaw) {
        const parsed = JSON.parse(fbRaw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    console.error(`Erro ao ler ${primaryKey} do localStorage:`, e);
  }
  return [];
}

function loadTurnoAtivoFromLocalStorage(): TurnoAtivoCaixa | null {
  try {
    const raw = localStorage.getItem(LS_KEY_TURNO_ATIVO) || localStorage.getItem('status_caixa');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TurnoAtivoCaixa;
    if (parsed && parsed.aberto) {
      return {
        ...parsed,
        reposicaoPrata: Math.max(0, Number(parsed.reposicaoPrata ?? 0) || 0),
        reposicaoDourada: Math.max(0, Number(parsed.reposicaoDourada ?? 0) || 0),
      };
    }
  } catch (e) {
    console.error('Erro ao ler turno_ativo do localStorage:', e);
  }
  return null;
}

/**
 * Compara estritamente se dois nomes de produtos correspondem exatamente ao mesmo item do catálogo.
 */
function areSameProductStrict(itemA: string, itemB: string): boolean {
  const normA = normalizeText(itemA || '');
  const normB = normalizeText(itemB || '');
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const catA = identificarItemECategoria(itemA);
  const catB = identificarItemECategoria(itemB);
  return (
    catA.tipoVenda === catB.tipoVenda &&
    normalizeText(catA.itemOficial) === normalizeText(catB.itemOficial)
  );
}


export default function App() {
  // Navegação Principal de Abas
  const [activeTab, setActiveTab] = useState<AppTab>('comandas');

  // Estados Sincronizados Instantaneamente com o LocalStorage
  const [vendas, setVendas] = useState<VendaComanda[]>(() =>
    loadArrayFromLocalStorage<VendaComanda>(LS_KEY_COMANDAS_BOLICHE, ['volux_vendas_storage_v2'])
  );
  const [fechamentos, setFechamentos] = useState<FechamentoTurnoFichas[]>(() =>
    loadArrayFromLocalStorage<FechamentoTurnoFichas>(LS_KEY_FECHAMENTOS_HISTORICO, [
      'volux_fechamentos_storage_v2',
    ])
  );
  const [aebSales, setAebSales] = useState<VendaAeB[]>(() =>
    loadArrayFromLocalStorage<VendaAeB>(LS_KEY_COMANDAS_AEB, ['volux_aeb_storage_v2'])
  );
  const [turnoAtivo, setTurnoAtivo] = useState<TurnoAtivoCaixa | null>(() =>
    loadTurnoAtivoFromLocalStorage()
  );

  // Persistência automática e síncrona no LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_COMANDAS_BOLICHE, JSON.stringify(vendas));
    } catch (e) {
      console.error('Erro ao salvar comandas_boliche no localStorage:', e);
    }
  }, [vendas]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify(aebSales));
    } catch (e) {
      console.error('Erro ao salvar comandas_aeb no localStorage:', e);
    }
  }, [aebSales]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_FECHAMENTOS_HISTORICO, JSON.stringify(fechamentos));
    } catch (e) {
      console.error('Erro ao salvar fechamentos_historico no localStorage:', e);
    }
  }, [fechamentos]);

  useEffect(() => {
    try {
      if (turnoAtivo && turnoAtivo.aberto) {
        localStorage.setItem(LS_KEY_TURNO_ATIVO, JSON.stringify(turnoAtivo));
      } else {
        localStorage.removeItem(LS_KEY_TURNO_ATIVO);
      }
    } catch (e) {
      console.error('Erro ao salvar turno_ativo no localStorage:', e);
    }
  }, [turnoAtivo]);

  const [loadedSourceName, setLoadedSourceName] = useState<string | null>(null);

  // Filtros de Comandas (Aba 1) - Data Inicial e Data Final com default Hoje (timezone local)
  const [startDate, setStartDate] = useState<string>(() => getTodayLocalISO());
  const [endDate, setEndDate] = useState<string>(() => getTodayLocalISO());
  const [selectedTurno, setSelectedTurno] = useState<FiltroTurno>('Todos os Turnos');
  const [selectedTipo, setSelectedTipo] = useState<FiltroTipo>('Todos');
  const [selectedSubItem, setSelectedSubItem] = useState<FiltroSubItem>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusResponsavel, setStatusResponsavel] = useState<FiltroStatusResponsavel>('todos');

  // Modais de Comandas & Sistema
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [editingVenda, setEditingVenda] = useState<VendaComanda | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  // Modais de AeB (Aba 3)
  const [isNewAeBSaleOpen, setIsNewAeBSaleOpen] = useState(false);
  const [editingAeBSale, setEditingAeBSale] = useState<VendaAeB | null>(null);
  const [isEditAeBModalOpen, setIsEditAeBModalOpen] = useState(false);

  // Confirmação de Exclusão Individual (Ícone de Lixeira)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{
    id: string;
    comanda: string;
    item: string;
    data: string;
    hora: string;
    preco: number;
    originTab: 'comandas' | 'aeb';
  } | null>(null);

  // Toast Notificações
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  /**
   * Motor de Conciliação e Re-Conciliação Inteligente Considerando a Quantidade (qtde)
   * entre lançamentos manuais (origem: "MANUAL") e o relatório PDF do Volux (origem: "PDF"):
   * - Caso 1 (Quantidades iguais): Se o PDF tem qtde: 2 e o manual mais próximo tem qtde: 2, concilia 1 única linha (2x).
   * - Caso 2 (Operador lançou separado no manual, mas no PDF veio junto): Se o PDF traz 1 linha com qtde: 2 (ou 3) e o
   *   operador lançou 2 (ou 3) vendas manuais de 1x próximas daquele horário, consome as vendas manuais equivalentes e
   *   unifica no registro oficial do PDF (2x), preservando responsavel e observacoes.
   * - Caso 3 (Diferença parcial de quantidade): Atualiza para a quantidade real e valor total do PDF preservando responsavel e observacao,
   *   e se o manual tiver unidades excedentes, desmembra o excedente para conciliar com outra linha ou receber alerta "❗ Só Manual (Fora do PDF)".
   * - Re-Conciliação Inteligente: Se o PDF já foi importado antes (gerando linhas "⚠️ Só PDF") e o operador cadastrou vendas manuais depois,
   *   funde as linhas "MANUAL" com as linhas "⚠️ Só PDF" correspondentes mantendo apenas a quantidade real do PDF.
   */
  const handleVoluxDataLoaded = (extractedVendas: VendaComanda[], sourceName: string) => {
    const updatedList = [...vendas];
    const matchedLaunchedIndices = new Set<number>();
    const consumedSecondaryIndices = new Set<number>();
    const cancelledInPassIndices = new Set<number>();
    const newlyAddedIndices = new Set<number>();

    let addedCount = 0;
    let updatedCount = 0;
    let reconciledManualCount = 0;
    let faltouNoManualCount = 0;
    let sobraNoManualCount = 0;
    let addedValor = 0;
    let cancelledRemovedCount = 0;
    let ignoredOrphanCancelCount = 0;

    // Separa os registros em "Comandas lançadas" (vendas normais) e "Comandas Canceladas" (estornos)
    const launchedItems = extractedVendas.filter(
      (v) => !v.cancelado && v.status !== 'Cancelado' && v.preco >= 0
    );
    const cancelledItems = extractedVendas.filter(
      (v) => Boolean(v.cancelado) || v.status === 'Cancelado' || v.preco < 0
    );

    // PASSO 1: Processa cada linha de "Comandas lançadas" mantendo a quantidade agrupada (ex: 2x, 3x)
    for (let itemIdx = 0; itemIdx < launchedItems.length; itemIdx++) {
      const rawItem = launchedItems[itemIdx];
      const idDeterministico = toFirestoreDocId(rawItem.id);
      const pdfQtde = Math.max(1, Math.floor(Number(rawItem.qtde) || 1));
      const item: VendaComanda = {
        ...rawItem,
        id: idDeterministico,
        pdfId: idDeterministico,
        qtde: pdfQtde,
        preco: Math.abs(rawItem.preco),
        cancelado: false,
        status: 'Ativo',
      };

      // 1. Verifica se este item do PDF já existe na tabela (reimportação do mesmo PDF)
      const existingPdfIdx = updatedList.findIndex(
        (existing, idx) =>
          !matchedLaunchedIndices.has(idx) &&
          !consumedSecondaryIndices.has(idx) &&
          (existing.id === idDeterministico || existing.pdfId === idDeterministico)
      );

      let alreadyAbsorbedManualQtde = 0;
      if (existingPdfIdx !== -1) {
        const existingItem = updatedList[existingPdfIdx];
        const isAlreadyMatchedManual =
          !existingItem.faltouNoManual &&
          (existingItem.origem === 'MANUAL' || Boolean(existingItem.conciliado));
        if (isAlreadyMatchedManual) {
          alreadyAbsorbedManualQtde = Math.max(
            1,
            Math.floor(Number(existingItem.manualQtdeConciliada ?? existingItem.qtde) || 1)
          );
        }

        // Se já estava 100% conciliado com lançamentos manuais, apenas atualiza mantendo blindagem
        if (alreadyAbsorbedManualQtde >= pdfQtde) {
          matchedLaunchedIndices.add(existingPdfIdx);
          const targetId = existingItem.id || idDeterministico;
          const preservedResponsavel =
            existingItem.responsavel && existingItem.responsavel.trim().length > 0
              ? existingItem.responsavel
              : item.responsavel || '';
          const preservedObservacao =
            existingItem.observacao && existingItem.observacao.trim().length > 0
              ? existingItem.observacao
              : item.observacao;
          const preservedIsVoucher = Boolean(existingItem.isVoucher || item.isVoucher);

          updatedList[existingPdfIdx] = {
            ...existingItem,
            id: targetId,
            pdfId: idDeterministico,
            comanda: item.comanda || existingItem.comanda,
            data: item.data,
            hora: item.hora,
            tipo_venda: item.tipo_venda,
            item: item.item,
            qtde: pdfQtde,
            preco: item.preco,
            cancelado: false,
            status: 'Ativo',
            responsavel: preservedResponsavel,
            observacao: preservedObservacao,
            origem: 'MANUAL',
            conciliado: true,
            faltouNoManual: false,
            sobraNoManual: false,
            manualQtdeConciliada: pdfQtde,
            conta3000: Boolean(item.conta3000 || existingItem.conta3000),
            contaAdm: item.contaAdm || existingItem.contaAdm,
            espaco: item.espaco || existingItem.espaco,
            isCortesia: Boolean(item.isCortesia || existingItem.isCortesia),
            isManutencao: Boolean(item.isManutencao || existingItem.isManutencao),
            isVoucher: preservedIsVoucher,
            motivoOperacional: preservedIsVoucher
              ? 'Voucher'
              : item.motivoOperacional || existingItem.motivoOperacional || 'Normal',
          };
          updatedCount++;
          continue;
        }
      }

      // 2. BUSCA LANÇAMENTOS MANUAIS NÃO CONCILIADOS DO MESMO DIA E PRODUTO
      // (Funciona tanto na 1ª importação quanto na Re-Conciliação de linhas "⚠️ Só PDF" ou parciais)
      const neededQtde = Math.max(1, pdfQtde - alreadyAbsorbedManualQtde);
      const pdfMinutes = horaToMinutes(item.hora);
      const pdfShift = getShiftFromHora(item.hora);
      const manualCandidates: {
        idx: number;
        diff: number;
        qtde: number;
        sameShift: boolean;
      }[] = [];

      for (let idx = 0; idx < updatedList.length; idx++) {
        if (idx === existingPdfIdx) continue;
        if (matchedLaunchedIndices.has(idx) || consumedSecondaryIndices.has(idx)) continue;
        const candidate = updatedList[idx];

        // Deve ser lançamento MANUAL ainda NÃO conciliado e ativo
        if (!isManualSaleRecord(candidate)) continue;
        if (candidate.conciliado === true) continue;
        if (candidate.cancelado || candidate.status === 'Cancelado') continue;

        // Ignora Manutenção e Cortesia manual de R$ 0,00 (nunca entram no PDF)
        if (isRegistroManutencao(candidate)) continue;
        if (
          isRegistroCortesia(candidate) &&
          !isRegistroConta3000(candidate) &&
          candidate.preco === 0
        ) {
          continue;
        }

        // Mesma data e Mesmo Produto Estrito
        if (!areSameDateRecords(candidate.data, item.data)) continue;
        if (candidate.tipo_venda !== item.tipo_venda) continue;
        if (!areSameProductStrict(candidate.item, item.item)) continue;

        const manualMinutes = horaToMinutes(candidate.hora);
        const diff = Math.abs(pdfMinutes - manualMinutes);
        const candQtde = Math.max(1, Math.floor(Number(candidate.qtde) || 1));
        const sameShift = getShiftFromHora(candidate.hora) === pdfShift;
        manualCandidates.push({ idx, diff, qtde: candQtde, sameShift });
      }

      // Ordena priorizando: 1º Mesmo turno, 2º Menor diferença de horário, 3º Quantidade idêntica (Caso 1)
      manualCandidates.sort((a, b) => {
        if (a.sameShift !== b.sameShift) return a.sameShift ? -1 : 1;
        if (a.diff !== b.diff) return a.diff - b.diff;
        const aExact = a.qtde === neededQtde ? 0 : 1;
        const bExact = b.qtde === neededQtde ? 0 : 1;
        return aExact - bExact;
      });

      if (manualCandidates.length > 0) {
        const consumedIndices: number[] = [];
        let accumulatedQtde = 0;

        for (const cand of manualCandidates) {
          if (consumedIndices.length === 0) {
            consumedIndices.push(cand.idx);
            accumulatedQtde += cand.qtde;
            if (accumulatedQtde >= neededQtde) break;
          } else {
            // Caso 2: PDF tem qtde > 1 e operador lançou múltiplas vendas manuais separadas (ex: 1x + 1x)
            if (accumulatedQtde + cand.qtde <= neededQtde) {
              consumedIndices.push(cand.idx);
              accumulatedQtde += cand.qtde;
              if (accumulatedQtde >= neededQtde) break;
            }
          }
        }

        const primaryManualIdx = consumedIndices[0];
        const primaryManual = updatedList[primaryManualIdx];

        // Se o registro manual tinha quantidade maior do que a linha do PDF (ex: manual 3x e PDF 2x),
        // desmembra o saldo excedente em uma linha manual separada para não apagar vendas a mais (Requisito 2)
        if (consumedIndices.length === 1 && accumulatedQtde > neededQtde) {
          const remainingQtde = accumulatedQtde - neededQtde;
          const unitManualPrice = Number((primaryManual.preco / accumulatedQtde).toFixed(2));
          const remainderItem: VendaComanda = {
            ...primaryManual,
            id: `${primaryManual.id}_ex_${itemIdx}_${Date.now()}`,
            comanda: `${primaryManual.comanda || primaryManual.id}_ex_${itemIdx}`,
            qtde: remainingQtde,
            preco: Number((unitManualPrice * remainingQtde).toFixed(2)),
            origem: 'MANUAL',
            conciliado: false,
            faltouNoManual: false,
            sobraNoManual: false,
          };
          updatedList.push(remainderItem);
          accumulatedQtde = neededQtde;
        }

        // Define qual índice receberá o registro unificado (mantém existingPdfIdx se já existia, ou primaryManualIdx)
        const targetUpdateIdx = existingPdfIdx !== -1 ? existingPdfIdx : primaryManualIdx;
        const baseRecord =
          existingPdfIdx !== -1 ? updatedList[existingPdfIdx] : primaryManual;

        matchedLaunchedIndices.add(targetUpdateIdx);
        for (const cIdx of consumedIndices) {
          if (cIdx !== targetUpdateIdx) {
            consumedSecondaryIndices.add(cIdx);
          }
        }

        // Unifica Responsável, Observações e flag Voucher (preservando dados tanto da linha manual quanto de eventual edição anterior)
        let mergedResponsavel = '';
        const observacoesList: string[] = [];
        let mergedIsVoucher = Boolean(item.isVoucher || baseRecord.isVoucher);

        const recordsToMerge =
          existingPdfIdx !== -1
            ? [
                ...consumedIndices.map((i) => updatedList[i]),
                updatedList[existingPdfIdx],
              ]
            : consumedIndices.map((i) => updatedList[i]);

        for (const cItem of recordsToMerge) {
          if (!mergedResponsavel && cItem.responsavel && cItem.responsavel.trim().length > 0) {
            mergedResponsavel = cItem.responsavel.trim();
          }
          if (cItem.observacao && cItem.observacao.trim().length > 0) {
            const cleanObs = cItem.observacao.trim();
            if (!observacoesList.includes(cleanObs)) {
              observacoesList.push(cleanObs);
            }
          }
          if (cItem.isVoucher) {
            mergedIsVoucher = true;
          }
        }

        if (!mergedResponsavel && item.responsavel) {
          mergedResponsavel = item.responsavel;
        }
        if (observacoesList.length === 0 && item.observacao) {
          observacoesList.push(item.observacao);
        }

        const targetId = primaryManual.id || baseRecord.id || idDeterministico;
        const totalAbsorbed = Math.min(
          pdfQtde,
          alreadyAbsorbedManualQtde + accumulatedQtde
        );

        const mergedItem: VendaComanda = {
          ...baseRecord,
          id: targetId,
          pdfId: idDeterministico,
          comanda: item.comanda || baseRecord.comanda,
          data: item.data,
          hora: item.hora,
          tipo_venda: item.tipo_venda,
          item: item.item,
          qtde: pdfQtde,
          preco: item.preco,
          cancelado: false,
          status: 'Ativo',
          responsavel: mergedResponsavel,
          observacao: observacoesList.length > 0 ? observacoesList.join(' | ') : undefined,
          origem: 'MANUAL',
          conciliado: true,
          faltouNoManual: false,
          sobraNoManual: false,
          manualQtdeConciliada: totalAbsorbed,
          conta3000: Boolean(item.conta3000 || baseRecord.conta3000),
          contaAdm: item.contaAdm || baseRecord.contaAdm,
          espaco: item.espaco || baseRecord.espaco,
          isCortesia: Boolean(item.isCortesia || baseRecord.isCortesia),
          isManutencao: Boolean(item.isManutencao || baseRecord.isManutencao),
          isVoucher: mergedIsVoucher,
          motivoOperacional: mergedIsVoucher
            ? 'Voucher'
            : item.motivoOperacional || baseRecord.motivoOperacional || 'Normal',
        };

        updatedList[targetUpdateIdx] = mergedItem;
        updatedCount++;
        reconciledManualCount += consumedIndices.length;
      } else if (existingPdfIdx !== -1) {
        // Reimportação de item "⚠️ Só PDF" que continua sem par manual
        matchedLaunchedIndices.add(existingPdfIdx);
        const existingItem = updatedList[existingPdfIdx];
        const targetId = existingItem.id || idDeterministico;
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : item.responsavel || '';
        const preservedObservacao =
          existingItem.observacao && existingItem.observacao.trim().length > 0
            ? existingItem.observacao
            : item.observacao;
        const preservedIsVoucher = Boolean(existingItem.isVoucher || item.isVoucher);

        updatedList[existingPdfIdx] = {
          ...existingItem,
          id: targetId,
          pdfId: idDeterministico,
          comanda: item.comanda || existingItem.comanda,
          data: item.data,
          hora: item.hora,
          tipo_venda: item.tipo_venda,
          item: item.item,
          qtde: pdfQtde,
          preco: item.preco,
          cancelado: false,
          status: 'Ativo',
          responsavel: preservedResponsavel,
          observacao: preservedObservacao,
          origem: existingItem.origem || 'PDF',
          conciliado: true,
          faltouNoManual: Boolean(existingItem.faltouNoManual),
          sobraNoManual: false,
          conta3000: Boolean(item.conta3000 || existingItem.conta3000),
          contaAdm: item.contaAdm || existingItem.contaAdm,
          espaco: item.espaco || existingItem.espaco,
          isCortesia: Boolean(item.isCortesia || existingItem.isCortesia),
          isManutencao: Boolean(item.isManutencao || existingItem.isManutencao),
          isVoucher: preservedIsVoucher,
          motivoOperacional: preservedIsVoucher
            ? 'Voucher'
            : item.motivoOperacional || existingItem.motivoOperacional || 'Normal',
        };
        updatedCount++;
      } else {
        // AVISO DE VENDA QUE FALTOU NO MANUAL: insere normalmente como 1 linha agrupada com flag faltouNoManual: true
        const newPdfItem: VendaComanda = {
          ...item,
          origem: 'PDF',
          conciliado: true,
          faltouNoManual: true,
          sobraNoManual: false,
          manualQtdeConciliada: 0,
        };
        const newIndex = updatedList.length;
        updatedList.push(newPdfItem);
        matchedLaunchedIndices.add(newIndex);
        newlyAddedIndices.add(newIndex);
        addedCount++;
        faltouNoManualCount++;
        addedValor = Number((addedValor + newPdfItem.preco).toFixed(2));
      }
    }

    // PASSO 2: Ação de Estorno ("Comandas Canceladas" ou valores negativos) - 1 para 1
    for (const rawCancel of cancelledItems) {
      const cancelDocId = toFirestoreDocId(rawCancel.id);
      const targetComanda = (rawCancel.comanda || '').trim().toLowerCase();
      const targetItem = (rawCancel.item || '').trim();

      // 1. Procura venda ativa com mesmo ID determinístico
      let matchIdx = updatedList.findIndex(
        (existing, idx) =>
          !consumedSecondaryIndices.has(idx) &&
          !cancelledInPassIndices.has(idx) &&
          !existing.cancelado &&
          existing.status !== 'Cancelado' &&
          (existing.id === cancelDocId || existing.pdfId === cancelDocId)
      );

      // 2. Procura venda ativa com mesma Comanda + mesmo Item + mesma Data
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !consumedSecondaryIndices.has(idx) &&
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            areSameProductStrict(existing.item, targetItem) &&
            areSameDateRecords(existing.data, rawCancel.data)
        );
      }

      // 3. Procura venda ativa batendo Comanda + Item em qualquer data
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !consumedSecondaryIndices.has(idx) &&
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            areSameProductStrict(existing.item, targetItem)
        );
      }

      // 4. Caso de reimportação do mesmo PDF (o item já consta como cancelado)
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !consumedSecondaryIndices.has(idx) &&
            !cancelledInPassIndices.has(idx) &&
            (existing.cancelado || existing.status === 'Cancelado') &&
            (existing.id === cancelDocId ||
              existing.pdfId === cancelDocId ||
              ((existing.comanda || '').trim().toLowerCase() === targetComanda &&
                areSameProductStrict(existing.item, targetItem)))
        );
      }

      if (matchIdx !== -1) {
        cancelledInPassIndices.add(matchIdx);
        const existingItem = updatedList[matchIdx];
        const targetId = existingItem.id;
        const wasAlreadyCancelled =
          Boolean(existingItem.cancelado) || existingItem.status === 'Cancelado';

        // Blindagem de Responsável e Observação também no estorno
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : rawCancel.responsavel || '';
        const preservedObservacao =
          existingItem.observacao && existingItem.observacao.trim().length > 0
            ? existingItem.observacao
            : rawCancel.observacao;

        if (newlyAddedIndices.has(matchIdx) && !wasAlreadyCancelled) {
          addedValor = Math.max(0, Number((addedValor - existingItem.preco).toFixed(2)));
        } else if (!newlyAddedIndices.has(matchIdx)) {
          updatedCount++;
        }

        const cancelledDoc: VendaComanda = {
          ...existingItem,
          id: targetId,
          preco: 0,
          cancelado: true,
          status: 'Cancelado',
          responsavel: preservedResponsavel,
          observacao: preservedObservacao,
        };

        updatedList[matchIdx] = cancelledDoc;
        cancelledRemovedCount++;
      } else {
        ignoredOrphanCancelCount++;
      }
    }

    // Remove linhas secundárias que foram fundidas durante a conciliação/re-conciliação
    const finalList = updatedList
      .filter((_, idx) => !consumedSecondaryIndices.has(idx))
      .map((registro) => {
        // PASSO 3: Verifica lançamentos manuais excedentes do mesmo dia que NÃO encontraram par no PDF
        if (!isManualSaleRecord(registro) || registro.conciliado === true) {
          return { ...registro, sobraNoManual: false };
        }
        if (registro.cancelado || registro.status === 'Cancelado') {
          return { ...registro, sobraNoManual: false };
        }

        // Exceção Obrigatória: Ignora Manutenção e Cortesia Manual (nunca constam no Volux e são sempre válidos)
        if (isRegistroManutencao(registro)) {
          return { ...registro, sobraNoManual: false };
        }
        if (
          isRegistroCortesia(registro) &&
          !isRegistroConta3000(registro) &&
          registro.preco === 0
        ) {
          return { ...registro, sobraNoManual: false };
        }

        const isSameDateAsPdf = extractedVendas.some((pdfRow) =>
          areSameDateRecords(pdfRow.data, registro.data)
        );
        if (!isSameDateAsPdf) {
          return registro;
        }

        // Categoria compatível com a aba de Comandas (Boliche/Fichas ou categoria presente no PDF)
        const isMatchingCategory =
          registro.tipo_venda === 'Boliche' ||
          registro.tipo_venda === 'Fichas' ||
          extractedVendas.some((pdfRow) => pdfRow.tipo_venda === registro.tipo_venda);

        if (isMatchingCategory) {
          sobraNoManualCount++;
          return {
            ...registro,
            sobraNoManual: true,
          };
        }

        return registro;
      });

    // Salva imediatamente no estado e no LocalStorage
    setVendas(finalList);
    localStorage.setItem(LS_KEY_COMANDAS_BOLICHE, JSON.stringify(finalList));
    setLoadedSourceName(sourceName);

    // Ajusta automaticamente o filtro de data da tela para a data real extraída do PDF
    const extractedISODates = extractedVendas
      .map((v) => recordDateToISO(v.data))
      .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
      .sort();

    if (extractedISODates.length > 0) {
      setStartDate(extractedISODates[0]);
      setEndDate(extractedISODates[extractedISODates.length - 1]);
    }

    if (reconciledManualCount > 0 || addedCount > 0 || sobraNoManualCount > 0) {
      const parts: string[] = [];
      if (reconciledManualCount > 0) {
        parts.push(
          `${reconciledManualCount} ${
            reconciledManualCount === 1
              ? 'venda manual conciliada'
              : 'vendas manuais conciliadas'
          } (Responsável preservado)`
        );
      }
      if (faltouNoManualCount > 0) {
        parts.push(
          `${faltouNoManualCount} ${
            faltouNoManualCount === 1
              ? 'item faltou no manual e foi adicionado via PDF'
              : 'itens faltaram no manual e foram adicionados via PDF'
          } (${formatCurrencyBRL(addedValor)})`
        );
      }
      if (sobraNoManualCount > 0) {
        parts.push(
          `${sobraNoManualCount} ${
            sobraNoManualCount === 1
              ? 'item lançado a mais no manual (❗ Só Manual)'
              : 'itens lançados a mais no manual (❗ Só Manual)'
          }`
        );
      }
      if (cancelledRemovedCount > 0) {
        parts.push(`${cancelledRemovedCount} estorno(s) aplicado(s)`);
      }
      if (ignoredOrphanCancelCount > 0) {
        parts.push(`${ignoredOrphanCancelCount} cancelamento(s) de outro dia ignorado(s)`);
      }
      showToast(parts.join(' · '));
    } else if (updatedCount > 0 || cancelledRemovedCount > 0) {
      let msg = `${updatedCount} ${updatedCount === 1 ? 'registro atualizado' : 'registros atualizados'} (Responsável preservado).`;
      if (cancelledRemovedCount > 0) {
        msg += ` ${cancelledRemovedCount} estorno(s) marcado(s) como Cancelado (R$ 0,00).`;
      }
      showToast(msg);
    } else {
      showToast('Relatório processado e conciliado no LocalStorage com sucesso.');
    }

    return {
      addedCount,
      updatedCount,
      addedValor,
      ignoredDuplicateCount: updatedCount,
      cancelledRemovedCount,
    };
  };

  // Operadores conhecidos para sugestões rápidas em todo o sistema
  const existingResponsaveis = useMemo(() => {
    const namesSet = new Set<string>();
    vendas.forEach((v) => {
      if (v.responsavel && v.responsavel.trim()) {
        namesSet.add(v.responsavel.trim());
      }
    });
    fechamentos.forEach((f) => {
      if (f.responsavel && f.responsavel.trim()) {
        namesSet.add(f.responsavel.trim());
      }
    });
    aebSales.forEach((a) => {
      if (a.responsavel && a.responsavel.trim()) {
        namesSet.add(a.responsavel.trim());
      }
    });
    return Array.from(namesSet);
  }, [vendas, fechamentos, aebSales]);

  const pendingAssignCount = useMemo(() => {
    return vendas.filter((v) => !v.responsavel || v.responsavel.trim() === '').length;
  }, [vendas]);

  const todayISO = getTodayLocalISO();
  const hasActiveFilters =
    startDate !== todayISO ||
    endDate !== todayISO ||
    selectedTurno !== 'Todos os Turnos' ||
    selectedTipo !== 'Todos' ||
    selectedSubItem !== 'Todos' ||
    statusResponsavel !== 'todos' ||
    searchTerm.trim() !== '';

  const handleClearFilters = () => {
    const today = getTodayLocalISO();
    setStartDate(today);
    setEndDate(today);
    setSelectedTurno('Todos os Turnos');
    setSelectedTipo('Todos');
    setSelectedSubItem('Todos');
    setStatusResponsavel('todos');
    setSearchTerm('');
  };

  // Unifica comandas (Boliche/Fichas e AeB quando aplicável) sem duplicar IDs
  const allUnifiedComandas = useMemo<VendaComanda[]>(() => {
    const existingIds = new Set(vendas.map((v) => v.id));
    const aebMapped: VendaComanda[] = aebSales
      .filter((a) => !existingIds.has(a.id))
      .map((a) => ({
        ...a,
        tipo_venda: 'AeB' as const,
      }));

    if (selectedTipo === 'AeB') {
      return [...vendas.filter((v) => v.tipo_venda === 'AeB'), ...aebMapped];
    }
    return vendas;
  }, [vendas, aebSales, selectedTipo]);

  // Comandas filtradas (Aba 1) - Filtros cumulativos (Date Range + Turno + Categoria + Sub-filtro + Responsável + Busca)
  const filteredVendas = useMemo(() => {
    const filtered = allUnifiedComandas.filter((venda) => {
      if (!isDateWithinRange(venda.data, startDate, endDate)) {
        return false;
      }

      if (!matchesTurnoFilter(venda.hora, selectedTurno)) {
        return false;
      }

      if (selectedTipo !== 'Todos' && venda.tipo_venda !== selectedTipo) {
        return false;
      }

      if (!matchesSubItemFilter(venda, selectedTipo, selectedSubItem)) {
        return false;
      }

      const hasResp = Boolean(venda.responsavel && venda.responsavel.trim().length > 0);
      if (statusResponsavel === 'pendentes' && hasResp) {
        return false;
      }
      if (statusResponsavel === 'preenchidos' && !hasResp) {
        return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesItem = venda.item.toLowerCase().includes(query);
        const matchesComanda = (venda.comanda || '').toLowerCase().includes(query);
        const matchesId = venda.id.toLowerCase().includes(query);
        const matchesResp = (venda.responsavel || '').toLowerCase().includes(query);
        const matchesObs = (venda.observacao || '').toLowerCase().includes(query);
        const matchesTipo = venda.tipo_venda.toLowerCase().includes(query);
        if (
          !matchesItem &&
          !matchesComanda &&
          !matchesId &&
          !matchesResp &&
          !matchesObs &&
          !matchesTipo
        ) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort(compareDateTimeChronologically);
  }, [
    allUnifiedComandas,
    startDate,
    endDate,
    selectedTurno,
    selectedTipo,
    selectedSubItem,
    statusResponsavel,
    searchTerm,
  ]);

  // Vendas AeB filtradas pelo mesmo Período / Turno / Responsável / Busca para alimentar o Card de AeB no topo
  const filteredVendasAeBForDashboard = useMemo(() => {
    return aebSales.filter((a) => {
      if (!isDateWithinRange(a.data, startDate, endDate)) return false;
      if (!matchesTurnoFilter(a.hora, selectedTurno)) return false;

      if (selectedSubItem === 'Cortesia' && !isRegistroCortesia(a)) return false;
      if (selectedSubItem === 'Voucher' && !isRegistroVoucher(a)) return false;
      if (selectedSubItem === 'Manutenção') return false;

      const hasResp = Boolean(a.responsavel && a.responsavel.trim().length > 0);
      if (statusResponsavel === 'pendentes' && hasResp) return false;
      if (statusResponsavel === 'preenchidos' && !hasResp) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mItem = a.item.toLowerCase().includes(q);
        const mComanda = (a.comanda || '').toLowerCase().includes(q);
        const mId = a.id.toLowerCase().includes(q);
        const mResp = (a.responsavel || '').toLowerCase().includes(q);
        const mObs = (a.observacao || '').toLowerCase().includes(q);
        if (!mItem && !mComanda && !mId && !mResp && !mObs) return false;
      }

      return true;
    });
  }, [aebSales, startDate, endDate, selectedTurno, selectedSubItem, statusResponsavel, searchTerm]);

  // Handlers de Comandas (Aba 1) -> Sincronização Instantânea no LocalStorage
  const handleUpdateResponsavel = (id: string, responsavel: string) => {
    const existsInBoliche = vendas.some((v) => v.id === id);
    if (existsInBoliche) {
      setVendas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, responsavel } : v))
      );
    }
    const existsInAeB = aebSales.some((a) => a.id === id);
    if (existsInAeB) {
      setAebSales((prev) =>
        prev.map((a) => (a.id === id ? { ...a, responsavel } : a))
      );
    }
  };

  const handleUpdateObservacao = (id: string, observacao: string) => {
    const existsInBoliche = vendas.some((v) => v.id === id);
    if (existsInBoliche) {
      setVendas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, observacao } : v))
      );
    }
    const existsInAeB = aebSales.some((a) => a.id === id);
    if (existsInAeB) {
      setAebSales((prev) =>
        prev.map((a) => (a.id === id ? { ...a, observacao } : a))
      );
    }
  };

  /**
   * Lançamento Manual Agrupado:
   * Quando o operador lançar uma venda manual com Quantidade > 1 (ex: 2x ou 3x),
   * salva como 1 único registro na tabela contendo qtde: Quantidade e preco: Quantidade * precoUnitario.
   */
  const handleAddVenda = (novaVenda: VendaComanda) => {
    const baseId = novaVenda.id || `MANUAL-${Date.now()}`;
    const quantidade = Math.max(1, Math.floor(Number(novaVenda.qtde) || 1));
    const precoTotal = Number(Math.max(0, Number(novaVenda.preco) || 0).toFixed(2));

    const singleRecord: VendaComanda = {
      ...novaVenda,
      id: baseId,
      comanda: novaVenda.comanda || baseId,
      qtde: quantidade,
      preco: precoTotal,
      origem: 'MANUAL',
      conciliado: false,
      faltouNoManual: false,
    };

    setVendas((prev) => [...prev, singleRecord]);

    if (singleRecord.tipo_venda === 'AeB') {
      const aebRecord: VendaAeB = {
        id: baseId,
        comanda: singleRecord.comanda,
        data: singleRecord.data,
        hora: singleRecord.hora,
        item: singleRecord.item,
        qtde: quantidade,
        preco: precoTotal,
        responsavel: singleRecord.responsavel,
        observacao: singleRecord.observacao,
        origem: 'MANUAL',
        conciliado: false,
        faltouNoManual: false,
        conta3000: singleRecord.conta3000,
        contaAdm: singleRecord.contaAdm,
        espaco: singleRecord.espaco,
        cancelado: false,
        status: 'Ativo',
        isCortesia: singleRecord.isCortesia,
        isVoucher: singleRecord.isVoucher,
        motivoOperacional: singleRecord.motivoOperacional,
      };
      setAebSales((prev) => [...prev, aebRecord]);
    }

    // Se a data da venda manual estiver fora do filtro atual, ajusta o filtro para exibi-la
    const saleISO = recordDateToISO(novaVenda.data);
    if (saleISO && /^\d{4}-\d{2}-\d{2}$/.test(saleISO)) {
      if (!isDateWithinRange(novaVenda.data, startDate, endDate)) {
        setStartDate(saleISO);
        setEndDate(saleISO);
      }
    }

    showToast(
      `Comanda #${baseId} (${quantidade}x ${novaVenda.item} - ${formatCurrencyBRL(precoTotal)}) salva no LocalStorage.`
    );
  };

  const handleEditVenda = (venda: VendaComanda) => {
    setEditingVenda(venda);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedVenda = (vendaAtualizada: VendaComanda) => {
    const docId = vendaAtualizada.id;
    const existsInBoliche = vendas.some((v) => v.id === docId);
    const existsInAeB = aebSales.some((a) => a.id === docId);

    if (vendaAtualizada.tipo_venda !== 'AeB') {
      setVendas((prev) => {
        const idx = prev.findIndex((v) => v.id === docId);
        if (idx === -1) return [...prev, vendaAtualizada];
        const copy = [...prev];
        copy[idx] = vendaAtualizada;
        return copy;
      });
      if (existsInAeB) {
        setAebSales((prev) => prev.filter((a) => a.id !== docId));
      }
    } else {
      if (existsInBoliche) {
        setVendas((prev) =>
          prev.map((v) => (v.id === docId ? vendaAtualizada : v))
        );
      }
      const payloadAeB: VendaAeB = {
        id: docId,
        comanda: vendaAtualizada.comanda,
        data: vendaAtualizada.data,
        hora: vendaAtualizada.hora,
        item: vendaAtualizada.item,
        qtde: vendaAtualizada.qtde,
        preco: vendaAtualizada.preco,
        responsavel: vendaAtualizada.responsavel,
        observacao: vendaAtualizada.observacao,
        origem: vendaAtualizada.origem,
        conciliado: vendaAtualizada.conciliado,
        faltouNoManual: vendaAtualizada.faltouNoManual,
        pdfId: vendaAtualizada.pdfId,
        conta3000: vendaAtualizada.conta3000,
        contaAdm: vendaAtualizada.contaAdm,
        espaco: vendaAtualizada.espaco,
        cancelado: Boolean(vendaAtualizada.cancelado),
        status: vendaAtualizada.status || 'Ativo',
        isCortesia: vendaAtualizada.isCortesia,
        isVoucher: vendaAtualizada.isVoucher,
        motivoOperacional: vendaAtualizada.motivoOperacional,
      };
      setAebSales((prev) => {
        const idx = prev.findIndex((a) => a.id === docId);
        if (idx === -1) return [...prev, payloadAeB];
        const copy = [...prev];
        copy[idx] = payloadAeB;
        return copy;
      });
    }
    showToast(`Venda atualizada!`);
  };

  // Fechar modal de confirmação de exclusão ao pressionar ESC
  useEffect(() => {
    if (!pendingDeleteItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingDeleteItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDeleteItem]);

  // Exclusão individual segura (Solicita confirmação antes de apagar o item)
  const handleDeleteVenda = (id: string) => {
    const itemToDelete = vendas.find((v) => v.id === id) || aebSales.find((a) => a.id === id);
    if (!itemToDelete) return;

    setPendingDeleteItem({
      id: itemToDelete.id,
      comanda: itemToDelete.comanda || itemToDelete.id,
      item: itemToDelete.item,
      data: itemToDelete.data,
      hora: itemToDelete.hora,
      preco: itemToDelete.preco,
      originTab: 'comandas',
    });
  };

  const handleConfirmDeleteIndividual = () => {
    if (!pendingDeleteItem) return;
    const { id, comanda, item, originTab } = pendingDeleteItem;

    setVendas((prev) => {
      const next = prev.filter((v) => v.id !== id);
      localStorage.setItem(LS_KEY_COMANDAS_BOLICHE, JSON.stringify(next));
      return next;
    });
    setAebSales((prev) => {
      const next = prev.filter((a) => a.id !== id);
      localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify(next));
      return next;
    });

    setPendingDeleteItem(null);

    if (originTab === 'aeb') {
      showToast(`Item "${item}" excluído do LocalStorage.`);
    } else {
      showToast(`Comanda #${comanda} (${item}) excluída.`);
    }
  };

  const handleClearAllData = () => {
    if (activeTab === 'comandas') {
      if (vendas.length === 0) {
        showToast('A lista de comandas já está vazia.');
        return;
      }
      setVendas([]);
      localStorage.setItem(LS_KEY_COMANDAS_BOLICHE, JSON.stringify([]));
      setLoadedSourceName(null);
      handleClearFilters();
      showToast('Todas as comandas foram apagadas do LocalStorage.');
    } else if (activeTab === 'controle_fichas') {
      if (fechamentos.length === 0) {
        showToast('O histórico de fechamentos já está vazio.');
        return;
      }
      setFechamentos([]);
      localStorage.setItem(LS_KEY_FECHAMENTOS_HISTORICO, JSON.stringify([]));
      showToast('Histórico de fechamentos apagado do LocalStorage.');
    } else if (activeTab === 'aeb') {
      if (aebSales.length === 0) {
        showToast('A lista de Alimentos e Bebidas (AeB) já está vazia.');
        return;
      }
      setAebSales([]);
      localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify([]));
      showToast('Todas as vendas de Alimentos e Bebidas (AeB) foram apagadas.');
    } else {
      showToast('A aba de Relatórios é um painel de consulta analítica.');
    }
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredVendas,
      `comandas-${startDate || 'todas'}-a-${endDate || 'todas'}.csv`
    );
    showToast(`Exportadas ${filteredVendas.length} comandas em CSV.`);
  };

  const handleAssignBatch = (responsavel: string) => {
    const pendingCount = vendas.filter(
      (item) => !item.responsavel || item.responsavel.trim() === ''
    ).length;

    setVendas((prev) =>
      prev.map((item) =>
        !item.responsavel || item.responsavel.trim() === ''
          ? { ...item, responsavel }
          : item
      )
    );
    showToast(`Operador "${responsavel}" atribuído a ${pendingCount} comandas.`);
  };

  // Handlers do Fluxo de Abertura, Reposição (Suprimento) e Fechamento de Turno (Aba 2 - Fichas)
  const handleAbrirTurno = (novoTurno: TurnoAtivoCaixa) => {
    const payload: TurnoAtivoCaixa = {
      ...novoTurno,
      aberto: true,
      reposicaoPrata: Math.max(0, Number(novoTurno.reposicaoPrata ?? 0) || 0),
      reposicaoDourada: Math.max(0, Number(novoTurno.reposicaoDourada ?? 0) || 0),
    };
    setTurnoAtivo(payload);
    localStorage.setItem(LS_KEY_TURNO_ATIVO, JSON.stringify(payload));
    showToast(
      `Turno aberto por ${payload.responsavel} (${payload.inicialPrata} Pratas / ${payload.inicialDourada} Douradas).`
    );
  };

  const handleRegistrarReposicaoTurno = (
    pratasAdicionadas: number,
    douradasAdicionadas: number
  ) => {
    if (!turnoAtivo) return;
    const addPrata = Math.max(0, Math.floor(Number(pratasAdicionadas) || 0));
    const addDourada = Math.max(0, Math.floor(Number(douradasAdicionadas) || 0));
    if (addPrata === 0 && addDourada === 0) return;

    const novaReposicaoPrata = (Number(turnoAtivo.reposicaoPrata) || 0) + addPrata;
    const novaReposicaoDourada = (Number(turnoAtivo.reposicaoDourada) || 0) + addDourada;

    const payload: TurnoAtivoCaixa = {
      ...turnoAtivo,
      reposicaoPrata: novaReposicaoPrata,
      reposicaoDourada: novaReposicaoDourada,
    };

    setTurnoAtivo(payload);
    localStorage.setItem(LS_KEY_TURNO_ATIVO, JSON.stringify(payload));
    showToast(
      `Suprimento registrado: +${addPrata} Pratas e +${addDourada} Douradas adicionadas ao turno.`
    );
  };

  const handleEncerrarTurno = (novoFechamento: FechamentoTurnoFichas) => {
    const docId = novoFechamento.id || `FECH-${Date.now()}`;
    const payload: FechamentoTurnoFichas = {
      ...novoFechamento,
      id: docId,
    };

    setFechamentos((prev) => {
      const next = [payload, ...prev];
      localStorage.setItem(LS_KEY_FECHAMENTOS_HISTORICO, JSON.stringify(next));
      return next;
    });
    setTurnoAtivo(null);
    localStorage.removeItem(LS_KEY_TURNO_ATIVO);
    localStorage.removeItem('status_caixa');

    showToast(
      `Turno encerrado e salvo no histórico! (${payload.vendidasPrataSistema} Pratas / ${payload.vendidasDouradaSistema} Douradas saídas).`
    );
  };

  const handleDeleteFechamento = (id: string) => {
    setFechamentos((prev) => {
      const next = prev.filter((f) => f.id !== id);
      localStorage.setItem(LS_KEY_FECHAMENTOS_HISTORICO, JSON.stringify(next));
      return next;
    });
    showToast('Fechamento de turno removido do histórico.');
  };

  const handleResetFechamentos = () => {
    setFechamentos([]);
    localStorage.setItem(LS_KEY_FECHAMENTOS_HISTORICO, JSON.stringify([]));
    showToast('Histórico de fechamentos limpo no LocalStorage.');
  };

  // Handlers de Alimentos e Bebidas - AeB (Aba 3 -> comandas_aeb no LocalStorage) com Conciliação e Re-Conciliação Inteligente por Quantidade
  const handleAeBDataLoaded = (extracted: VendaAeB[], _sourceName: string) => {
    // PDF de A&B vazio (apenas cabeçalho, ex: "Comandas X Itens por PDV" sem vendas)
    if (!extracted || extracted.length === 0) {
      showToast(
        'PDF lido com sucesso: Nenhuma comanda de A&B lançada neste período (R$ 0,00).'
      );
      return {
        addedCount: 0,
        updatedCount: 0,
        addedValor: 0,
        ignoredDuplicateCount: 0,
        cancelledRemovedCount: 0,
      };
    }

    const updatedList = [...aebSales];
    const matchedLaunchedIndices = new Set<number>();
    const consumedSecondaryIndices = new Set<number>();
    const cancelledInPassIndices = new Set<number>();
    const newlyAddedIndices = new Set<number>();

    let addedCount = 0;
    let updatedCount = 0;
    let reconciledManualCount = 0;
    let faltouNoManualCount = 0;
    let sobraNoManualCount = 0;
    let addedValor = 0;
    let cancelledRemovedCount = 0;
    let ignoredOrphanCancelCount = 0;

    const launchedItems = extracted.filter(
      (v) => !v.cancelado && v.status !== 'Cancelado' && v.preco >= 0
    );
    const cancelledItems = extracted.filter(
      (v) => Boolean(v.cancelado) || v.status === 'Cancelado' || v.preco < 0
    );

    // PASSO 1: Processa cada linha de "Comandas lançadas" mantendo a quantidade agrupada (qtde)
    for (let itemIdx = 0; itemIdx < launchedItems.length; itemIdx++) {
      const rawItem = launchedItems[itemIdx];
      const idDeterministico = toFirestoreDocId(rawItem.id);
      const pdfQtde = Math.max(1, Math.floor(Number(rawItem.qtde) || 1));
      const item: VendaAeB = {
        ...rawItem,
        id: idDeterministico,
        pdfId: idDeterministico,
        qtde: pdfQtde,
        preco: Math.abs(rawItem.preco),
        cancelado: false,
        status: 'Ativo',
      };

      // 1. Verifica primeiro se já existe pelo ID determinístico (reimportação do mesmo PDF)
      const existingPdfIdx = updatedList.findIndex(
        (existing, idx) =>
          !matchedLaunchedIndices.has(idx) &&
          !consumedSecondaryIndices.has(idx) &&
          (existing.id === idDeterministico || existing.pdfId === idDeterministico)
      );

      let alreadyAbsorbedManualQtde = 0;
      if (existingPdfIdx !== -1) {
        const existingItem = updatedList[existingPdfIdx];
        const isAlreadyMatchedManual =
          !existingItem.faltouNoManual &&
          (existingItem.origem === 'MANUAL' || Boolean(existingItem.conciliado));
        if (isAlreadyMatchedManual) {
          alreadyAbsorbedManualQtde = Math.max(
            1,
            Math.floor(Number(existingItem.manualQtdeConciliada ?? existingItem.qtde) || 1)
          );
        }

        if (alreadyAbsorbedManualQtde >= pdfQtde) {
          matchedLaunchedIndices.add(existingPdfIdx);
          const targetId = existingItem.id || idDeterministico;
          const preservedResponsavel =
            existingItem.responsavel && existingItem.responsavel.trim().length > 0
              ? existingItem.responsavel
              : item.responsavel || '';
          const preservedObservacao =
            existingItem.observacao && existingItem.observacao.trim().length > 0
              ? existingItem.observacao
              : item.observacao;
          const preservedIsVoucher = Boolean(existingItem.isVoucher || item.isVoucher);

          updatedList[existingPdfIdx] = {
            ...existingItem,
            id: targetId,
            pdfId: idDeterministico,
            comanda: item.comanda || existingItem.comanda,
            data: item.data,
            hora: item.hora,
            item: item.item,
            qtde: pdfQtde,
            preco: item.preco,
            cancelado: false,
            status: 'Ativo',
            responsavel: preservedResponsavel,
            observacao: preservedObservacao,
            origem: 'MANUAL',
            conciliado: true,
            faltouNoManual: false,
            sobraNoManual: false,
            manualQtdeConciliada: pdfQtde,
            conta3000: Boolean(item.conta3000 || existingItem.conta3000),
            contaAdm: item.contaAdm || existingItem.contaAdm,
            espaco: item.espaco || existingItem.espaco,
            isCortesia: Boolean(item.isCortesia || existingItem.isCortesia),
            isVoucher: preservedIsVoucher,
            motivoOperacional: preservedIsVoucher
              ? 'Voucher'
              : item.motivoOperacional || existingItem.motivoOperacional || 'Normal',
          };
          updatedCount++;
          continue;
        }
      }

      // 2. CONCILIAÇÃO E RE-CONCILIAÇÃO INTELIGENTE COM LANÇAMENTOS MANUAIS DO MESMO DIA E ITEM
      const neededQtde = Math.max(1, pdfQtde - alreadyAbsorbedManualQtde);
      const pdfMinutes = horaToMinutes(item.hora);
      const pdfShift = getShiftFromHora(item.hora);
      const manualCandidates: {
        idx: number;
        diff: number;
        qtde: number;
        sameShift: boolean;
      }[] = [];

      for (let idx = 0; idx < updatedList.length; idx++) {
        if (idx === existingPdfIdx) continue;
        if (matchedLaunchedIndices.has(idx) || consumedSecondaryIndices.has(idx)) continue;
        const candidate = updatedList[idx];

        if (!isManualSaleRecord(candidate)) continue;
        if (candidate.conciliado === true) continue;
        if (candidate.cancelado || candidate.status === 'Cancelado') continue;
        if (
          isRegistroCortesia(candidate) &&
          !isRegistroConta3000(candidate) &&
          candidate.preco === 0
        ) {
          continue;
        }

        if (!areSameDateRecords(candidate.data, item.data)) continue;
        if (!areSameProductStrict(candidate.item, item.item)) continue;

        const manualMinutes = horaToMinutes(candidate.hora);
        const diff = Math.abs(pdfMinutes - manualMinutes);
        const candQtde = Math.max(1, Math.floor(Number(candidate.qtde) || 1));
        const sameShift = getShiftFromHora(candidate.hora) === pdfShift;
        manualCandidates.push({ idx, diff, qtde: candQtde, sameShift });
      }

      manualCandidates.sort((a, b) => {
        if (a.sameShift !== b.sameShift) return a.sameShift ? -1 : 1;
        if (a.diff !== b.diff) return a.diff - b.diff;
        const aExact = a.qtde === neededQtde ? 0 : 1;
        const bExact = b.qtde === neededQtde ? 0 : 1;
        return aExact - bExact;
      });

      if (manualCandidates.length > 0) {
        const consumedIndices: number[] = [];
        let accumulatedQtde = 0;

        for (const cand of manualCandidates) {
          if (consumedIndices.length === 0) {
            consumedIndices.push(cand.idx);
            accumulatedQtde += cand.qtde;
            if (accumulatedQtde >= neededQtde) break;
          } else {
            if (accumulatedQtde + cand.qtde <= neededQtde) {
              consumedIndices.push(cand.idx);
              accumulatedQtde += cand.qtde;
              if (accumulatedQtde >= neededQtde) break;
            }
          }
        }

        const primaryManualIdx = consumedIndices[0];
        const primaryManual = updatedList[primaryManualIdx];

        if (consumedIndices.length === 1 && accumulatedQtde > neededQtde) {
          const remainingQtde = accumulatedQtde - neededQtde;
          const unitManualPrice = Number((primaryManual.preco / accumulatedQtde).toFixed(2));
          const remainderItem: VendaAeB = {
            ...primaryManual,
            id: `${primaryManual.id}_ex_${itemIdx}_${Date.now()}`,
            comanda: `${primaryManual.comanda || primaryManual.id}_ex_${itemIdx}`,
            qtde: remainingQtde,
            preco: Number((unitManualPrice * remainingQtde).toFixed(2)),
            origem: 'MANUAL',
            conciliado: false,
            faltouNoManual: false,
            sobraNoManual: false,
          };
          updatedList.push(remainderItem);
          accumulatedQtde = neededQtde;
        }

        const targetUpdateIdx = existingPdfIdx !== -1 ? existingPdfIdx : primaryManualIdx;
        const baseRecord =
          existingPdfIdx !== -1 ? updatedList[existingPdfIdx] : primaryManual;

        matchedLaunchedIndices.add(targetUpdateIdx);
        for (const cIdx of consumedIndices) {
          if (cIdx !== targetUpdateIdx) {
            consumedSecondaryIndices.add(cIdx);
          }
        }

        let mergedResponsavel = '';
        const observacoesList: string[] = [];
        let mergedIsVoucher = Boolean(item.isVoucher || baseRecord.isVoucher);

        const recordsToMerge =
          existingPdfIdx !== -1
            ? [
                ...consumedIndices.map((i) => updatedList[i]),
                updatedList[existingPdfIdx],
              ]
            : consumedIndices.map((i) => updatedList[i]);

        for (const cItem of recordsToMerge) {
          if (!mergedResponsavel && cItem.responsavel && cItem.responsavel.trim().length > 0) {
            mergedResponsavel = cItem.responsavel.trim();
          }
          if (cItem.observacao && cItem.observacao.trim().length > 0) {
            const cleanObs = cItem.observacao.trim();
            if (!observacoesList.includes(cleanObs)) {
              observacoesList.push(cleanObs);
            }
          }
          if (cItem.isVoucher) {
            mergedIsVoucher = true;
          }
        }

        if (!mergedResponsavel && item.responsavel) {
          mergedResponsavel = item.responsavel;
        }
        if (observacoesList.length === 0 && item.observacao) {
          observacoesList.push(item.observacao);
        }

        const targetId = primaryManual.id || baseRecord.id || idDeterministico;
        const totalAbsorbed = Math.min(
          pdfQtde,
          alreadyAbsorbedManualQtde + accumulatedQtde
        );

        const mergedItem: VendaAeB = {
          ...baseRecord,
          id: targetId,
          pdfId: idDeterministico,
          comanda: item.comanda || baseRecord.comanda,
          data: item.data,
          hora: item.hora,
          item: item.item,
          qtde: pdfQtde,
          preco: item.preco,
          cancelado: false,
          status: 'Ativo',
          responsavel: mergedResponsavel,
          observacao: observacoesList.length > 0 ? observacoesList.join(' | ') : undefined,
          origem: 'MANUAL',
          conciliado: true,
          faltouNoManual: false,
          sobraNoManual: false,
          manualQtdeConciliada: totalAbsorbed,
          conta3000: Boolean(item.conta3000 || baseRecord.conta3000),
          contaAdm: item.contaAdm || baseRecord.contaAdm,
          espaco: item.espaco || baseRecord.espaco,
          isCortesia: Boolean(item.isCortesia || baseRecord.isCortesia),
          isVoucher: mergedIsVoucher,
          motivoOperacional: mergedIsVoucher
            ? 'Voucher'
            : item.motivoOperacional || baseRecord.motivoOperacional || 'Normal',
        };

        updatedList[targetUpdateIdx] = mergedItem;
        updatedCount++;
        reconciledManualCount += consumedIndices.length;
      } else if (existingPdfIdx !== -1) {
        matchedLaunchedIndices.add(existingPdfIdx);
        const existingItem = updatedList[existingPdfIdx];
        const targetId = existingItem.id || idDeterministico;
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : item.responsavel || '';
        const preservedObservacao =
          existingItem.observacao && existingItem.observacao.trim().length > 0
            ? existingItem.observacao
            : item.observacao;
        const preservedIsVoucher = Boolean(existingItem.isVoucher || item.isVoucher);

        updatedList[existingPdfIdx] = {
          ...existingItem,
          id: targetId,
          pdfId: idDeterministico,
          comanda: item.comanda || existingItem.comanda,
          data: item.data,
          hora: item.hora,
          item: item.item,
          qtde: pdfQtde,
          preco: item.preco,
          cancelado: false,
          status: 'Ativo',
          responsavel: preservedResponsavel,
          observacao: preservedObservacao,
          origem: existingItem.origem || 'PDF',
          conciliado: true,
          faltouNoManual: Boolean(existingItem.faltouNoManual),
          sobraNoManual: false,
          conta3000: Boolean(item.conta3000 || existingItem.conta3000),
          contaAdm: item.contaAdm || existingItem.contaAdm,
          espaco: item.espaco || existingItem.espaco,
          isCortesia: Boolean(item.isCortesia || existingItem.isCortesia),
          isVoucher: preservedIsVoucher,
          motivoOperacional: preservedIsVoucher
            ? 'Voucher'
            : item.motivoOperacional || existingItem.motivoOperacional || 'Normal',
        };
        updatedCount++;
      } else {
        const newPdfItem: VendaAeB = {
          ...item,
          origem: 'PDF',
          conciliado: true,
          faltouNoManual: true,
          sobraNoManual: false,
          manualQtdeConciliada: 0,
        };
        const newIndex = updatedList.length;
        updatedList.push(newPdfItem);
        matchedLaunchedIndices.add(newIndex);
        newlyAddedIndices.add(newIndex);
        addedCount++;
        faltouNoManualCount++;
        addedValor = Number((addedValor + newPdfItem.preco).toFixed(2));
      }
    }

    // PASSO 2: Ação de Estorno ("Comandas Canceladas" ou valores negativos) - 1 para 1
    for (const rawCancel of cancelledItems) {
      const cancelDocId = toFirestoreDocId(rawCancel.id);
      const targetComanda = (rawCancel.comanda || '').trim().toLowerCase();
      const targetItem = (rawCancel.item || '').trim();

      let matchIdx = updatedList.findIndex(
        (existing, idx) =>
          !consumedSecondaryIndices.has(idx) &&
          !cancelledInPassIndices.has(idx) &&
          !existing.cancelado &&
          existing.status !== 'Cancelado' &&
          (existing.id === cancelDocId || existing.pdfId === cancelDocId)
      );

      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !consumedSecondaryIndices.has(idx) &&
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            areSameProductStrict(existing.item, targetItem) &&
            areSameDateRecords(existing.data, rawCancel.data)
        );
      }

      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !consumedSecondaryIndices.has(idx) &&
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            areSameProductStrict(existing.item, targetItem)
        );
      }

      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !consumedSecondaryIndices.has(idx) &&
            !cancelledInPassIndices.has(idx) &&
            (existing.cancelado || existing.status === 'Cancelado') &&
            (existing.id === cancelDocId ||
              existing.pdfId === cancelDocId ||
              ((existing.comanda || '').trim().toLowerCase() === targetComanda &&
                areSameProductStrict(existing.item, targetItem)))
        );
      }

      if (matchIdx !== -1) {
        cancelledInPassIndices.add(matchIdx);
        const existingItem = updatedList[matchIdx];
        const targetId = existingItem.id;
        const wasAlreadyCancelled =
          Boolean(existingItem.cancelado) || existingItem.status === 'Cancelado';
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : rawCancel.responsavel || '';
        const preservedObservacao =
          existingItem.observacao && existingItem.observacao.trim().length > 0
            ? existingItem.observacao
            : rawCancel.observacao;

        if (newlyAddedIndices.has(matchIdx) && !wasAlreadyCancelled) {
          addedValor = Math.max(0, Number((addedValor - existingItem.preco).toFixed(2)));
        } else if (!newlyAddedIndices.has(matchIdx)) {
          updatedCount++;
        }

        const cancelledDoc: VendaAeB = {
          ...existingItem,
          id: targetId,
          preco: 0,
          cancelado: true,
          status: 'Cancelado',
          responsavel: preservedResponsavel,
          observacao: preservedObservacao,
        };

        updatedList[matchIdx] = cancelledDoc;
        cancelledRemovedCount++;
      } else {
        ignoredOrphanCancelCount++;
      }
    }

    const finalList = updatedList
      .filter((_, idx) => !consumedSecondaryIndices.has(idx))
      .map((registro) => {
        // PASSO 3: Verifica lançamentos manuais excedentes de AeB que NÃO encontraram par no PDF
        if (!isManualSaleRecord(registro) || registro.conciliado === true) {
          return { ...registro, sobraNoManual: false };
        }
        if (registro.cancelado || registro.status === 'Cancelado') {
          return { ...registro, sobraNoManual: false };
        }

        // Exceção Obrigatória: Ignora Cortesia Manual de R$ 0,00
        if (
          isRegistroCortesia(registro) &&
          !isRegistroConta3000(registro) &&
          registro.preco === 0
        ) {
          return { ...registro, sobraNoManual: false };
        }

        const isSameDateAsPdf = extracted.some((pdfRow) =>
          areSameDateRecords(pdfRow.data, registro.data)
        );
        if (isSameDateAsPdf) {
          sobraNoManualCount++;
          return {
            ...registro,
            sobraNoManual: true,
          };
        }

        return registro;
      });

    setAebSales(finalList);
    localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify(finalList));

    // Ajusta filtro de data principal também para a data do PDF importado
    const extractedISODates = extracted
      .map((v) => recordDateToISO(v.data))
      .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
      .sort();
    if (extractedISODates.length > 0) {
      setStartDate(extractedISODates[0]);
      setEndDate(extractedISODates[extractedISODates.length - 1]);
    }

    if (reconciledManualCount > 0 || addedCount > 0 || sobraNoManualCount > 0) {
      const parts: string[] = [];
      if (reconciledManualCount > 0) {
        parts.push(
          `${reconciledManualCount} ${
            reconciledManualCount === 1
              ? 'venda manual de AeB conciliada'
              : 'vendas manuais de AeB conciliadas'
          } (Responsável preservado)`
        );
      }
      if (faltouNoManualCount > 0) {
        parts.push(
          `${faltouNoManualCount} ${
            faltouNoManualCount === 1
              ? 'item faltou no manual e foi adicionado via PDF'
              : 'itens faltaram no manual e foram adicionados via PDF'
          } (${formatCurrencyBRL(addedValor)})`
        );
      }
      if (sobraNoManualCount > 0) {
        parts.push(
          `${sobraNoManualCount} ${
            sobraNoManualCount === 1
              ? 'item lançado a mais no manual (❗ Só Manual)'
              : 'itens lançados a mais no manual (❗ Só Manual)'
          }`
        );
      }
      if (cancelledRemovedCount > 0) {
        parts.push(`${cancelledRemovedCount} estorno(s) aplicado(s)`);
      }
      if (ignoredOrphanCancelCount > 0) {
        parts.push(`${ignoredOrphanCancelCount} cancelamento(s) de outro dia ignorado(s)`);
      }
      showToast(parts.join(' · '));
    } else if (updatedCount > 0 || cancelledRemovedCount > 0) {
      let msg = `${updatedCount} ${updatedCount === 1 ? 'item de AeB atualizado' : 'itens de AeB atualizados'} (Responsável preservado).`;
      if (cancelledRemovedCount > 0) {
        msg += ` (${cancelledRemovedCount} estorno(s) marcado(s) como Cancelado R$ 0,00).`;
      }
      showToast(msg);
    } else {
      showToast('Relatório de AeB conciliado e salvo no LocalStorage.');
    }

    return {
      addedCount,
      updatedCount,
      addedValor,
      ignoredDuplicateCount: updatedCount,
      cancelledRemovedCount,
    };
  };

  const handleUpdateAeBResponsavel = (id: string, responsavel: string) => {
    setAebSales((prev) =>
      prev.map((v) => (v.id === id ? { ...v, responsavel } : v))
    );
    const existsInBoliche = vendas.some((v) => v.id === id);
    if (existsInBoliche) {
      setVendas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, responsavel } : v))
      );
    }
  };

  const handleUpdateAeBObservacao = (id: string, observacao: string) => {
    setAebSales((prev) =>
      prev.map((v) => (v.id === id ? { ...v, observacao } : v))
    );
    const existsInBoliche = vendas.some((v) => v.id === id);
    if (existsInBoliche) {
      setVendas((prev) =>
        prev.map((v) => (v.id === id ? { ...v, observacao } : v))
      );
    }
  };

  /**
   * Lançamento Manual de AeB Agrupado:
   * Quando Quantidade > 1, salva como 1 único registro na tabela com qtde: Quantidade e preco total.
   */
  const handleAddAeBSale = (novaVenda: VendaAeB) => {
    const baseId = novaVenda.id || `MANUAL-${Date.now()}`;
    const quantidade = Math.max(1, Math.floor(Number(novaVenda.qtde) || 1));
    const precoTotal = Number(Math.max(0, Number(novaVenda.preco) || 0).toFixed(2));

    const singleRecord: VendaAeB = {
      ...novaVenda,
      id: baseId,
      comanda: novaVenda.comanda || baseId,
      qtde: quantidade,
      preco: precoTotal,
      origem: 'MANUAL',
      conciliado: false,
      faltouNoManual: false,
    };

    setAebSales((prev) => {
      const next = [...prev, singleRecord];
      localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify(next));
      return next;
    });
    showToast(
      `Item #${baseId} (${quantidade}x ${novaVenda.item} - ${formatCurrencyBRL(precoTotal)}) salvo no LocalStorage.`
    );
  };

  const handleEditAeBSale = (venda: VendaAeB) => {
    setEditingAeBSale(venda);
    setIsEditAeBModalOpen(true);
  };

  const handleSaveEditedAeBSale = (vendaAtualizada: VendaAeB) => {
    const docId = vendaAtualizada.id;
    setAebSales((prev) => {
      const next = prev.map((v) => (v.id === docId ? vendaAtualizada : v));
      localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify(next));
      return next;
    });
    const existsInBoliche = vendas.some((v) => v.id === docId);
    if (existsInBoliche) {
      setVendas((prev) =>
        prev.map((v) =>
          v.id === docId
            ? {
                ...v,
                comanda: vendaAtualizada.comanda,
                data: vendaAtualizada.data,
                hora: vendaAtualizada.hora,
                item: vendaAtualizada.item,
                qtde: vendaAtualizada.qtde,
                preco: vendaAtualizada.preco,
                responsavel: vendaAtualizada.responsavel,
                observacao: vendaAtualizada.observacao,
              }
            : v
        )
      );
    }
    showToast(`Venda #${vendaAtualizada.comanda || docId} (AeB) atualizada!`);
  };

  const handleDeleteAeBSale = (id: string) => {
    const itemToDelete = aebSales.find((v) => v.id === id) || vendas.find((v) => v.id === id);
    if (!itemToDelete) return;

    setPendingDeleteItem({
      id: itemToDelete.id,
      comanda: itemToDelete.comanda || itemToDelete.id,
      item: itemToDelete.item,
      data: itemToDelete.data,
      hora: itemToDelete.hora,
      preco: itemToDelete.preco,
      originTab: 'aeb',
    });
  };

  const handleExportAeBCSV = () => {
    exportToCSV(
      aebSales.map((a) => ({
        id: a.id,
        comanda: a.comanda,
        data: a.data,
        hora: a.hora,
        tipo_venda: 'AeB' as const,
        item: a.item,
        qtde: a.qtde ?? 1,
        preco: a.preco,
        responsavel: a.responsavel,
        observacao: a.observacao,
        conta3000: a.conta3000,
        contaAdm: a.contaAdm,
        espaco: a.espaco,
        isCortesia: a.isCortesia,
        cancelado: a.cancelado,
        status: a.status,
      })),
      `vendas-aeb-${new Date().toISOString().split('T')[0]}.csv`
    );
    showToast(`Exportados ${aebSales.length} itens de Alimentos e Bebidas (AeB) em CSV.`);
  };

  // Restauração instantânea de backup JSON unificado direto para o LocalStorage
  const handleRestoreBackup = (
    restoredVendas: VendaComanda[],
    restoredFechamentos: FechamentoTurnoFichas[],
    restoredAeB?: VendaAeB[]
  ) => {
    const normalizedVendas: VendaComanda[] = [];
    if (restoredVendas.length > 0) {
      const seen = new Set<string>();
      for (const v of restoredVendas) {
        let docId = toFirestoreDocId(v.id || generateUniqueId());
        if (seen.has(docId)) {
          docId = toFirestoreDocId(generateUniqueId());
        }
        seen.add(docId);
        normalizedVendas.push({
          ...v,
          id: docId,
          comanda: v.comanda || docId,
        });
      }
      setVendas(normalizedVendas);
      localStorage.setItem(LS_KEY_COMANDAS_BOLICHE, JSON.stringify(normalizedVendas));
    }

    if (restoredFechamentos.length > 0) {
      const normalizedFech: FechamentoTurnoFichas[] = [];
      const seen = new Set<string>();
      for (const f of restoredFechamentos) {
        let docId = toFirestoreDocId(f.id || generateUniqueId());
        if (seen.has(docId)) {
          docId = toFirestoreDocId(generateUniqueId());
        }
        seen.add(docId);
        normalizedFech.push({ ...f, id: docId });
      }
      setFechamentos(normalizedFech);
      localStorage.setItem(LS_KEY_FECHAMENTOS_HISTORICO, JSON.stringify(normalizedFech));
    }

    if (restoredAeB && restoredAeB.length > 0) {
      const normalizedAeB: VendaAeB[] = [];
      const seen = new Set<string>();
      for (const v of restoredAeB) {
        let docId = toFirestoreDocId(v.id || generateUniqueId());
        if (seen.has(docId)) {
          docId = toFirestoreDocId(generateUniqueId());
        }
        seen.add(docId);
        normalizedAeB.push({
          ...v,
          id: docId,
          comanda: v.comanda || docId,
        });
      }
      setAebSales(normalizedAeB);
      localStorage.setItem(LS_KEY_COMANDAS_AEB, JSON.stringify(normalizedAeB));
    }

    // Se houver datas nas vendas restauradas, ajusta o filtro de data para cobrir o período restaurado
    const restoredISODates = normalizedVendas
      .map((v) => recordDateToISO(v.data))
      .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
      .sort();

    if (restoredISODates.length > 0) {
      setStartDate(restoredISODates[0]);
      setEndDate(restoredISODates[restoredISODates.length - 1]);
    } else {
      handleClearFilters();
    }

    showToast(
      `Backup restaurado no LocalStorage (${restoredVendas.length} comandas, ${restoredFechamentos.length} fechamentos e ${restoredAeB?.length || 0} itens AeB).`
    );
  };

  // Importação direta de Backup JSON para o LocalStorage
  const handleDirectImportBackupJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let restoredVendas: VendaComanda[] = [];
        let restoredFechamentos: FechamentoTurnoFichas[] = [];
        let restoredAeB: VendaAeB[] = [];

        if (Array.isArray(parsed)) {
          restoredVendas = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.vendas)) {
            restoredVendas = parsed.vendas;
          }
          if (Array.isArray(parsed.fechamentos)) {
            restoredFechamentos = parsed.fechamentos;
          }
          if (Array.isArray(parsed.aebSales)) {
            restoredAeB = parsed.aebSales;
          }
        }

        if (
          restoredVendas.length === 0 &&
          restoredFechamentos.length === 0 &&
          restoredAeB.length === 0
        ) {
          throw new Error('O arquivo JSON não possui comandas, bebidas ou fechamentos válidos.');
        }

        handleRestoreBackup(restoredVendas, restoredFechamentos, restoredAeB);
      } catch (err: any) {
        showToast(
          err.message || 'Arquivo de backup inválido. Selecione um JSON válido.'
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-neutral-50/70 text-neutral-900 pb-16">
      {/* Top Header com Navegação em Abas */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        totalRecords={vendas.length}
        filteredRecords={filteredVendas.length}
        fechamentosCount={fechamentos.length}
        aebCount={aebSales.length}
        onOpenNewSaleModal={() => setIsNewSaleOpen(true)}
        onOpenNewAeBSaleModal={() => setIsNewAeBSaleOpen(true)}
        onExportCSV={handleExportCSV}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onImportBackupJSON={handleDirectImportBackupJSON}
        onClearAllData={handleClearAllData}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {activeTab === 'comandas' ? (
          /* ABA 1: COMANDAS & VENDAS */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Context / Welcome Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-neutral-200/80 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Dashboard Operacional · Relatório de Comandas & Vendas Volux
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Importe o PDF do Volux ou adicione lançamentos manuais. Conciliação 1 para 1 com preservação do Responsável.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto text-xs text-neutral-500">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>LocalStorage Ativo</span>
                <span className="text-neutral-300">|</span>
                <span className="font-mono-tabular">
                  {vendas.length} {vendas.length === 1 ? 'registro salvo' : 'registros salvos'}
                </span>
              </div>
            </div>

            {/* Upload e Processamento do PDF do Volux */}
            <VoluxUploadArea
              onDataLoaded={handleVoluxDataLoaded}
              currentLoadedSource={loadedSourceName}
            />

            {/* 4 Summary Cards baseados nas comandas e vendas AeB visíveis */}
            <SummaryCards
              filteredVendas={filteredVendas}
              filteredVendasAeB={filteredVendasAeBForDashboard}
              totalVendasCount={allUnifiedComandas.length}
            />

            {/* Tabela de Comandas com Toolbar de Filtros */}
            <div className="space-y-0">
              <TableToolbar
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                selectedTurno={selectedTurno}
                onSelectTurno={setSelectedTurno}
                selectedTipo={selectedTipo}
                onSelectTipo={setSelectedTipo}
                selectedSubItem={selectedSubItem}
                onSelectSubItem={setSelectedSubItem}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusResponsavel={statusResponsavel}
                onSelectStatusResponsavel={setStatusResponsavel}
                totalCount={allUnifiedComandas.length}
                filteredCount={filteredVendas.length}
                onClearFilters={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
                onOpenQuickAssign={() => setIsQuickAssignOpen(true)}
                pendingAssignCount={pendingAssignCount}
                onOpenBackupModal={() => setIsBackupModalOpen(true)}
                onImportBackupJSON={handleDirectImportBackupJSON}
              />

              <SalesTable
                vendas={filteredVendas}
                totalDatabaseCount={allUnifiedComandas.length}
                onExpandAllDates={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                onUpdateResponsavel={handleUpdateResponsavel}
                onUpdateObservacao={handleUpdateObservacao}
                onEditVenda={handleEditVenda}
                onDeleteVenda={handleDeleteVenda}
              />
            </div>
          </div>
        ) : activeTab === 'controle_fichas' ? (
          /* ABA 2: CONTROLE FÍSICO DE FICHAS (FLUXO DE ABERTURA E FECHAMENTO DE TURNO) */
          <ControleFichasTab
            vendas={vendas}
            fechamentos={fechamentos}
            turnoAtivo={turnoAtivo}
            onAbrirTurno={handleAbrirTurno}
            onRegistrarReposicao={handleRegistrarReposicaoTurno}
            onEncerrarTurno={handleEncerrarTurno}
            onDeleteFechamento={handleDeleteFechamento}
            onResetFechamentos={handleResetFechamentos}
          />
        ) : activeTab === 'aeb' ? (
          /* ABA 3: ALIMENTOS E BEBIDAS (AeB) */
          <AeBTab
            vendas={aebSales}
            onUpdateResponsavel={handleUpdateAeBResponsavel}
            onUpdateObservacao={handleUpdateAeBObservacao}
            onEditVenda={handleEditAeBSale}
            onDeleteVenda={handleDeleteAeBSale}
            onDataLoaded={handleAeBDataLoaded}
            onOpenNewSaleModal={() => setIsNewAeBSaleOpen(true)}
            onExportCSV={handleExportAeBCSV}
          />
        ) : (
          /* ABA 4: RELATÓRIOS (BI) */
          <RelatoriosTab
            vendas={vendas}
            aebSales={aebSales}
            fechamentos={fechamentos}
            turnoAtivo={turnoAtivo}
          />
        )}
      </main>

      {/* Modal 1: Registrar Nova Venda (Comandas & Fichas) */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onAddVenda={handleAddVenda}
      />

      {/* Modal 2: Editar Venda Existente */}
      <EditSaleModal
        isOpen={isEditModalOpen}
        venda={editingVenda}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingVenda(null);
        }}
        onSaveVenda={handleSaveEditedVenda}
      />

      {/* Modal 3: Atribuição Rápida de Operador em Lote */}
      <QuickAssignModal
        isOpen={isQuickAssignOpen}
        onClose={() => setIsQuickAssignOpen(false)}
        onAssignBatch={handleAssignBatch}
        pendingCount={pendingAssignCount}
        existingResponsaveis={existingResponsaveis}
      />

      {/* Modal 4: Nova Venda de Bebida (AeB) */}
      <NewAeBSaleModal
        isOpen={isNewAeBSaleOpen}
        onClose={() => setIsNewAeBSaleOpen(false)}
        onAddVenda={handleAddAeBSale}
      />

      {/* Modal 5: Editar Venda de Bebida (AeB) */}
      <EditAeBSaleModal
        isOpen={isEditAeBModalOpen}
        venda={editingAeBSale}
        onClose={() => {
          setIsEditAeBModalOpen(false);
          setEditingAeBSale(null);
        }}
        onSaveVenda={handleSaveEditedAeBSale}
      />

      {/* Modal 6: Backup & Segurança dos Dados (JSON/CSV) */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        vendas={vendas}
        fechamentos={fechamentos}
        aebSales={aebSales}
        onRestoreBackup={handleRestoreBackup}
      />

      {/* Modal 7: Confirmação Simples de Exclusão Individual (Evita cliques acidentais na lixeira) */}
      {pendingDeleteItem && (
        <div
          onClick={() => setPendingDeleteItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200/80 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="confirm-delete-title" className="text-sm font-semibold text-neutral-900">
                    Confirmar Exclusão de Item
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Confirmação de segurança contra clique acidental
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDeleteItem(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                Tem certeza que deseja excluir este item? Esta ação apagará o registro do sistema.
              </p>

              <div className="rounded-xl bg-neutral-50 border border-neutral-200/80 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">Item:</span>
                  <span className="font-semibold text-neutral-900 text-right">
                    {pendingDeleteItem.item}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">Data / Hora:</span>
                  <span className="font-mono-tabular text-neutral-700">
                    {pendingDeleteItem.data} às {pendingDeleteItem.hora}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-500">Valor:</span>
                  <span className="font-mono-tabular font-semibold text-neutral-900">
                    {formatCurrencyBRL(pendingDeleteItem.preco)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingDeleteItem(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteIndividual}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-2xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
