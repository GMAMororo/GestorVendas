import React, { useState, useMemo, useEffect } from 'react';
import {
  VendaComanda,
  FiltroTipo,
  FiltroStatusResponsavel,
  FiltroTurno,
  FechamentoTurnoFichas,
  VendaAeB,
  AppTab,
} from './types/venda';
import { useLocalStorage } from './hooks/useLocalStorage';
import {
  exportToCSV,
  formatCurrencyBRL,
  compareDatesChronologically,
  matchesTurnoFilter,
} from './utils/formatters';
import { generateUniqueId } from './utils/voluxParser';
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
import { CheckCircle2, Info } from 'lucide-react';

const STORAGE_VENDAS_KEY = 'gestor_comandas_vendas_v1';
const STORAGE_FECHAMENTOS_KEY = 'gestor_fechamentos_fichas_v1';
const STORAGE_AEB_KEY = 'volux_aeb_data';

export default function App() {
  // Navegação Principal de Abas
  const [activeTab, setActiveTab] = useState<AppTab>('comandas');

  // Estado das Vendas de Comandas com LocalStorage (inicia estritamente vazio [])
  const [vendas, setVendas] = useLocalStorage<VendaComanda[]>(STORAGE_VENDAS_KEY, []);

  // Estado dos Fechamentos de Turno de Fichas com LocalStorage (inicia estritamente vazio [])
  const [fechamentos, setFechamentos] = useLocalStorage<FechamentoTurnoFichas[]>(STORAGE_FECHAMENTOS_KEY, []);

  // Estado exclusivo das Vendas de AeB - Alimentos e Bebidas (AeB) com LocalStorage (inicia estritamente vazio [])
  const [aebSales, setAebSales] = useLocalStorage<VendaAeB[]>(STORAGE_AEB_KEY, []);

  // Sanitização e garantia de unicidade absoluta para registros já existentes no LocalStorage
  // (evita que dados gravados antes da correção compartilhem IDs de comanda duplicados)
  useEffect(() => {
    let changedVendas = false;
    const seenVendas = new Set<string>();
    const sanitizedVendas = vendas.map((v) => {
      let id = v.id;
      if (id && id.startsWith('pdf_') && !/_\d+$/.test(id)) {
        id = `${id}_1`;
        changedVendas = true;
      }
      const isDuplicate = seenVendas.has(id);
      seenVendas.add(id);
      if (!id || isDuplicate) {
        changedVendas = true;
        return {
          ...v,
          id: generateUniqueId(),
          comanda: v.comanda || v.id || '13.402.000',
        };
      }
      if (!v.comanda) {
        changedVendas = true;
        return { ...v, id, comanda: id };
      }
      if (id !== v.id) {
        return { ...v, id };
      }
      return v;
    });

    if (changedVendas) {
      setVendas(sanitizedVendas);
    }

    let changedAeB = false;
    const seenAeB = new Set<string>();
    const sanitizedAeB = aebSales.map((v) => {
      let id = v.id;
      if (id && id.startsWith('pdf_') && !/_\d+$/.test(id)) {
        id = `${id}_1`;
        changedAeB = true;
      }
      const isDuplicate = seenAeB.has(id);
      seenAeB.add(id);
      if (!id || isDuplicate) {
        changedAeB = true;
        return {
          ...v,
          id: generateUniqueId(),
          comanda: v.comanda || v.id || '13.402.000',
        };
      }
      if (!v.comanda) {
        changedAeB = true;
        return { ...v, id, comanda: id };
      }
      if (id !== v.id) {
        return { ...v, id };
      }
      return v;
    });

    if (changedAeB) {
      setAebSales(sanitizedAeB);
    }
  }, []);

  const [loadedSourceName, setLoadedSourceName] = useState<string | null>(null);

  // Filtros de Comandas (Aba 1)
  const [selectedDay, setSelectedDay] = useState<string>('Todos');
  const [selectedTurno, setSelectedTurno] = useState<FiltroTurno>('Todos os Turnos');
  const [selectedTipo, setSelectedTipo] = useState<FiltroTipo>('Todos');
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

  // Toast Notificações
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleVoluxDataLoaded = (extractedVendas: VendaComanda[], sourceName: string) => {
    // Obtém o conjunto atual salvo no banco local para sincronização síncrona
    let currentVendas = [...vendas];
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_VENDAS_KEY);
        if (raw) currentVendas = JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
    }

    const updatedList = [...currentVendas];
    const matchedLaunchedIndices = new Set<number>();
    const cancelledInPassIndices = new Set<number>();
    const newlyAddedIndices = new Set<number>();

    let addedCount = 0;
    let updatedCount = 0;
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

    // PASSO 1: Processa "Comandas lançadas" (Inserção e Upsert preservando Responsável)
    for (const rawItem of launchedItems) {
      const item: VendaComanda = {
        ...rawItem,
        preco: Math.abs(rawItem.preco),
        cancelado: false,
        status: 'Ativo',
      };

      // 1. Procura por ID determinístico exato ainda não pareado nesta leitura
      let matchIdx = updatedList.findIndex(
        (existing, idx) => !matchedLaunchedIndices.has(idx) && existing.id === item.id
      );

      // 2. Fallback Update Inteligente (Upsert): mesma Comanda + mesmo Item + mesma Data
      if (matchIdx === -1) {
        const targetComanda = (item.comanda || '').trim().toLowerCase();
        const targetItem = (item.item || '').trim().toLowerCase();
        if (targetComanda && targetItem) {
          matchIdx = updatedList.findIndex(
            (existing, idx) =>
              !matchedLaunchedIndices.has(idx) &&
              (existing.comanda || '').trim().toLowerCase() === targetComanda &&
              (existing.item || '').trim().toLowerCase() === targetItem &&
              existing.data === item.data
          );
        }
      }

      if (matchIdx !== -1) {
        matchedLaunchedIndices.add(matchIdx);
        const existingItem = updatedList[matchIdx];
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : item.responsavel || '';

        updatedList[matchIdx] = {
          ...existingItem,
          id: item.id,
          comanda: item.comanda || existingItem.comanda,
          data: item.data,
          hora: item.hora,
          tipo_venda: item.tipo_venda,
          item: item.item,
          preco: item.preco,
          cancelado: false,
          status: 'Ativo',
          responsavel: preservedResponsavel,
        };
        updatedCount++;
      } else {
        const newIndex = updatedList.length;
        updatedList.push(item);
        matchedLaunchedIndices.add(newIndex);
        newlyAddedIndices.add(newIndex);
        addedCount++;
        addedValor = Number((addedValor + item.preco).toFixed(2));
      }
    }

    // PASSO 2: Ação de Estorno ("Comandas Canceladas" ou valores negativos)
    // Busca no banco local (incluindo vendas recém-lançadas) a venda correspondente por ID determinístico ou Comanda + Item.
    // Se encontrada: atualiza status para "Cancelado" e força preco para 0.00.
    // Se NÃO encontrada (vendida num dia não importado): ignora a linha e não a insere na tabela.
    for (const rawCancel of cancelledItems) {
      const targetComanda = (rawCancel.comanda || '').trim().toLowerCase();
      const targetItem = (rawCancel.item || '').trim().toLowerCase();

      // 1. Procura venda ativa com mesmo ID determinístico
      let matchIdx = updatedList.findIndex(
        (existing, idx) =>
          !cancelledInPassIndices.has(idx) &&
          !existing.cancelado &&
          existing.status !== 'Cancelado' &&
          existing.id === rawCancel.id
      );

      // 2. Procura venda ativa com mesma Comanda + mesmo Item + mesma Data
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            (existing.item || '').trim().toLowerCase() === targetItem &&
            existing.data === rawCancel.data
        );
      }

      // 3. Procura venda ativa batendo Comanda + Item (em qualquer data importada no localStorage)
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            (existing.item || '').trim().toLowerCase() === targetItem
        );
      }

      // 4. Caso de reimportação do mesmo PDF (o item já consta como cancelado no banco local)
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !cancelledInPassIndices.has(idx) &&
            (existing.cancelado || existing.status === 'Cancelado') &&
            (existing.id === rawCancel.id ||
              ((existing.comanda || '').trim().toLowerCase() === targetComanda &&
                (existing.item || '').trim().toLowerCase() === targetItem))
        );
      }

      if (matchIdx !== -1) {
        cancelledInPassIndices.add(matchIdx);
        const existingItem = updatedList[matchIdx];
        const wasAlreadyCancelled =
          Boolean(existingItem.cancelado) || existingItem.status === 'Cancelado';
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : rawCancel.responsavel || '';

        if (newlyAddedIndices.has(matchIdx) && !wasAlreadyCancelled) {
          addedValor = Math.max(0, Number((addedValor - existingItem.preco).toFixed(2)));
        } else if (!newlyAddedIndices.has(matchIdx)) {
          updatedCount++;
        }

        updatedList[matchIdx] = {
          ...existingItem,
          preco: 0,
          cancelado: true,
          status: 'Cancelado',
          responsavel: preservedResponsavel,
        };
        cancelledRemovedCount++;
      } else {
        // IMPORTANTE: Venda original não encontrada no banco local -> ignora a linha sem inserir "fantasma negativo"
        ignoredOrphanCancelCount++;
      }
    }

    setVendas(updatedList);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_VENDAS_KEY, JSON.stringify(updatedList));
      }
    } catch (err) {
      console.error('Erro ao salvar no localStorage:', err);
    }

    setLoadedSourceName(sourceName);

    // Feedback visual preciso baseado nos itens adicionados, atualizados e estornados
    if (addedCount > 0) {
      const valorStr = formatCurrencyBRL(addedValor);
      let msg = `${addedCount} ${addedCount === 1 ? 'comanda nova importada' : 'comandas novas importadas'} com sucesso (${valorStr}).`;
      if (updatedCount > 0) {
        msg += ` ${updatedCount} existente(s) atualizada(s).`;
      }
      if (cancelledRemovedCount > 0) {
        msg += ` ${cancelledRemovedCount} estorno(s) aplicado(s) com R$ 0,00.`;
      }
      if (ignoredOrphanCancelCount > 0) {
        msg += ` (${ignoredOrphanCancelCount} cancelamento(s) de outro dia ignorado(s)).`;
      }
      showToast(msg);
    } else if (updatedCount > 0 || cancelledRemovedCount > 0) {
      let msg = `${updatedCount} ${updatedCount === 1 ? 'comanda existente atualizada' : 'comandas existentes atualizadas'} com sucesso.`;
      if (cancelledRemovedCount > 0) {
        msg += ` ${cancelledRemovedCount} estorno(s) marcado(s) como Cancelado (R$ 0,00).`;
      }
      showToast(msg);
    } else {
      showToast('Relatório sincronizado com sucesso.');
    }

    return {
      addedCount,
      updatedCount,
      addedValor,
      ignoredDuplicateCount: updatedCount,
      cancelledRemovedCount,
    };
  };

  // Extração automática de dias únicos disponíveis nas comandas salvas (Ordenação Cronológica Real: mês -> dia)
  const availableDays = useMemo(() => {
    const daysSet = new Set<string>();
    vendas.forEach((v) => {
      if (v.data && v.data.trim()) {
        daysSet.add(v.data.trim());
      }
    });
    return Array.from(daysSet).sort(compareDatesChronologically);
  }, [vendas]);

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

  const hasActiveFilters =
    selectedDay !== 'Todos' ||
    selectedTurno !== 'Todos os Turnos' ||
    selectedTipo !== 'Todos' ||
    statusResponsavel !== 'todos' ||
    searchTerm.trim() !== '';

  const handleClearFilters = () => {
    setSelectedDay('Todos');
    setSelectedTurno('Todos os Turnos');
    setSelectedTipo('Todos');
    setStatusResponsavel('todos');
    setSearchTerm('');
  };

  // Comandas filtradas (Aba 1) - Filtros cumulativos (Data + Turno + Tipo + Responsável + Busca)
  const filteredVendas = useMemo(() => {
    return vendas.filter((venda) => {
      if (selectedDay !== 'Todos' && venda.data !== selectedDay) {
        return false;
      }

      if (!matchesTurnoFilter(venda.hora, selectedTurno)) {
        return false;
      }

      if (selectedTipo !== 'Todos' && venda.tipo_venda !== selectedTipo) {
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
        const matchesTipo = venda.tipo_venda.toLowerCase().includes(query);
        if (!matchesItem && !matchesComanda && !matchesId && !matchesResp && !matchesTipo) {
          return false;
        }
      }

      return true;
    });
  }, [vendas, selectedDay, selectedTurno, selectedTipo, statusResponsavel, searchTerm]);

  // Handlers de Comandas (Aba 1)
  const handleUpdateResponsavel = (id: string, responsavel: string) => {
    setVendas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, responsavel } : item))
    );
  };

  const handleAddVenda = (novaVenda: VendaComanda) => {
    setVendas((prev) => [novaVenda, ...prev]);
    showToast(`Comanda #${novaVenda.comanda || novaVenda.id} (${novaVenda.item}) registrada e salva.`);
  };

  const handleEditVenda = (venda: VendaComanda) => {
    setEditingVenda(venda);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedVenda = (vendaAtualizada: VendaComanda) => {
    setVendas((prev) =>
      prev.map((item) => (item.id === vendaAtualizada.id ? vendaAtualizada : item))
    );
    showToast(`Comanda #${vendaAtualizada.comanda || vendaAtualizada.id} atualizada com sucesso!`);
  };

  // 2. Refatoração da Função de Excluir:
  // Recebe o ID único gerado e usa o método .filter() de forma estrita.
  // Atualiza imediatamente o estado do React e salva no LocalStorage.
  const handleDeleteVenda = (id: string) => {
    const itemToDelete = vendas.find((v) => v.id === id);
    setVendas((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_VENDAS_KEY, JSON.stringify(updated));
        }
      } catch (err) {
        console.error('Erro ao salvar no localStorage após exclusão:', err);
      }
      return updated;
    });
    showToast(
      itemToDelete
        ? `Comanda #${itemToDelete.comanda || itemToDelete.id} (${itemToDelete.item}) excluída.`
        : 'Comanda excluída com sucesso.'
    );
  };

  // Exclusão em Massa apenas dos itens visíveis no filtro atual (Comandas)
  const handleDeleteFilteredVendas = () => {
    if (filteredVendas.length === 0) return;

    if (
      window.confirm(
        'Tem certeza que deseja excluir TODAS as vendas exibidas neste filtro? Essa ação não pode ser desfeita.'
      )
    ) {
      const idsToRemove = new Set(filteredVendas.map((v) => v.id));
      const removedCount = idsToRemove.size;

      setVendas((prev) => {
        const updated = prev.filter((item) => !idsToRemove.has(item.id));
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_VENDAS_KEY, JSON.stringify(updated));
          }
        } catch (err) {
          console.error('Erro ao salvar no localStorage após exclusão filtrada:', err);
        }
        return updated;
      });

      showToast(
        `${removedCount} ${removedCount === 1 ? 'venda filtrada excluída' : 'vendas filtradas excluídas'} com sucesso.`
      );
    }
  };

  const handleClearAllData = () => {
    if (activeTab === 'comandas') {
      if (vendas.length === 0) {
        showToast('A base de comandas já está vazia.');
        return;
      }
      if (window.confirm('Tem certeza de que deseja apagar TODAS as comandas salvas? Esta operação não pode ser desfeita sem backup.')) {
        setVendas([]);
        setLoadedSourceName(null);
        handleClearFilters();
        showToast('Todas as comandas foram apagadas.');
      }
    } else if (activeTab === 'controle_fichas') {
      if (fechamentos.length === 0) {
        showToast('O histórico de fechamentos já está vazio.');
        return;
      }
      if (window.confirm('Tem certeza de que deseja apagar TODO o histórico de fechamentos de turno?')) {
        setFechamentos([]);
        showToast('Histórico de fechamentos apagado.');
      }
    } else if (activeTab === 'aeb') {
      if (aebSales.length === 0) {
        showToast('A base de Alimentos e Bebidas (AeB) já está vazia.');
        return;
      }
      if (window.confirm('Tem certeza de que deseja apagar TODAS as vendas de Alimentos e Bebidas (AeB) salvas?')) {
        setAebSales([]);
        showToast('Todas as vendas de Alimentos e Bebidas (AeB) foram apagadas.');
      }
    } else {
      showToast('A aba de Relatórios é um painel de consulta analítica.');
    }
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredVendas,
      `comandas-${selectedDay === 'Todos' ? 'todas' : selectedDay.replace('/', '-')}.csv`
    );
    showToast(`Exportadas ${filteredVendas.length} comandas em CSV.`);
  };

  const handleAssignBatch = (responsavel: string) => {
    setVendas((prev) =>
      prev.map((item) => {
        if (!item.responsavel || item.responsavel.trim() === '') {
          return { ...item, responsavel };
        }
        return item;
      })
    );
    showToast(`Operador "${responsavel}" atribuído a todas as comandas pendentes.`);
  };

  // Handlers de Fechamento de Fichas (Aba 2)
  const handleAddFechamento = (novo: FechamentoTurnoFichas) => {
    setFechamentos((prev) => [novo, ...prev]);
    showToast(`Fechamento salvo: ${novo.fichasVendidas} fichas vendidas no turno.`);
  };

  const handleDeleteFechamento = (id: string) => {
    setFechamentos((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_FECHAMENTOS_KEY, JSON.stringify(updated));
        }
      } catch (err) {
        console.error('Erro ao salvar no localStorage após exclusão de fechamento:', err);
      }
      return updated;
    });
    showToast('Fechamento de turno removido com sucesso.');
  };

  const handleResetFechamentos = () => {
    setFechamentos([]);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_FECHAMENTOS_KEY, JSON.stringify([]));
      }
    } catch (e) {
      console.error(e);
    }
    showToast('Histórico de fechamentos de fichas limpo.');
  };

  // Handlers de Alimentos e Bebidas - AeB (Aba 3)
  const handleAeBDataLoaded = (extracted: VendaAeB[], _sourceName: string) => {
    let currentAeb = [...aebSales];
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_AEB_KEY);
        if (raw) currentAeb = JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
    }

    const updatedList = [...currentAeb];
    const matchedLaunchedIndices = new Set<number>();
    const cancelledInPassIndices = new Set<number>();
    const newlyAddedIndices = new Set<number>();

    let addedCount = 0;
    let updatedCount = 0;
    let addedValor = 0;
    let cancelledRemovedCount = 0;
    let ignoredOrphanCancelCount = 0;

    // Separa os registros em "Comandas lançadas" (vendas normais) e "Comandas Canceladas" (estornos)
    const launchedItems = extracted.filter(
      (v) => !v.cancelado && v.status !== 'Cancelado' && v.preco >= 0
    );
    const cancelledItems = extracted.filter(
      (v) => Boolean(v.cancelado) || v.status === 'Cancelado' || v.preco < 0
    );

    // PASSO 1: Processa "Comandas lançadas" (Inserção e Upsert preservando Responsável)
    for (const rawItem of launchedItems) {
      const item: VendaAeB = {
        ...rawItem,
        preco: Math.abs(rawItem.preco),
        cancelado: false,
        status: 'Ativo',
      };

      // 1. Procura por ID determinístico exato ainda não pareado nesta leitura
      let matchIdx = updatedList.findIndex(
        (existing, idx) => !matchedLaunchedIndices.has(idx) && existing.id === item.id
      );

      // 2. Fallback Update Inteligente (Upsert): mesma Comanda + mesmo Nome na mesma data
      if (matchIdx === -1) {
        const targetComanda = (item.comanda || '').trim().toLowerCase();
        const targetItem = (item.item || '').trim().toLowerCase();
        if (targetComanda && targetItem) {
          matchIdx = updatedList.findIndex(
            (existing, idx) =>
              !matchedLaunchedIndices.has(idx) &&
              (existing.comanda || '').trim().toLowerCase() === targetComanda &&
              (existing.item || '').trim().toLowerCase() === targetItem &&
              existing.data === item.data
          );
        }
      }

      if (matchIdx !== -1) {
        matchedLaunchedIndices.add(matchIdx);
        const existingItem = updatedList[matchIdx];
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : item.responsavel || '';

        updatedList[matchIdx] = {
          ...existingItem,
          id: item.id,
          comanda: item.comanda || existingItem.comanda,
          data: item.data,
          hora: item.hora,
          item: item.item,
          preco: item.preco,
          cancelado: false,
          status: 'Ativo',
          responsavel: preservedResponsavel,
        };
        updatedCount++;
      } else {
        const newIndex = updatedList.length;
        updatedList.push(item);
        matchedLaunchedIndices.add(newIndex);
        newlyAddedIndices.add(newIndex);
        addedCount++;
        addedValor = Number((addedValor + item.preco).toFixed(2));
      }
    }

    // PASSO 2: Ação de Estorno ("Comandas Canceladas" ou valores negativos)
    // Busca no banco local (incluindo vendas recém-lançadas) a venda correspondente por ID determinístico ou Comanda + Item.
    // Se encontrada: atualiza status para "Cancelado" e força preco para 0.00.
    // Se NÃO encontrada (vendida num dia não importado): ignora a linha e não a insere na tabela.
    for (const rawCancel of cancelledItems) {
      const targetComanda = (rawCancel.comanda || '').trim().toLowerCase();
      const targetItem = (rawCancel.item || '').trim().toLowerCase();

      // 1. Procura venda ativa com mesmo ID determinístico
      let matchIdx = updatedList.findIndex(
        (existing, idx) =>
          !cancelledInPassIndices.has(idx) &&
          !existing.cancelado &&
          existing.status !== 'Cancelado' &&
          existing.id === rawCancel.id
      );

      // 2. Procura venda ativa com mesma Comanda + mesmo Item + mesma Data
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            (existing.item || '').trim().toLowerCase() === targetItem &&
            existing.data === rawCancel.data
        );
      }

      // 3. Procura venda ativa batendo Comanda + Item (em qualquer data importada no localStorage)
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !cancelledInPassIndices.has(idx) &&
            !existing.cancelado &&
            existing.status !== 'Cancelado' &&
            (existing.comanda || '').trim().toLowerCase() === targetComanda &&
            (existing.item || '').trim().toLowerCase() === targetItem
        );
      }

      // 4. Caso de reimportação do mesmo PDF (o item já consta como cancelado no banco local)
      if (matchIdx === -1 && targetComanda && targetItem) {
        matchIdx = updatedList.findIndex(
          (existing, idx) =>
            !cancelledInPassIndices.has(idx) &&
            (existing.cancelado || existing.status === 'Cancelado') &&
            (existing.id === rawCancel.id ||
              ((existing.comanda || '').trim().toLowerCase() === targetComanda &&
                (existing.item || '').trim().toLowerCase() === targetItem))
        );
      }

      if (matchIdx !== -1) {
        cancelledInPassIndices.add(matchIdx);
        const existingItem = updatedList[matchIdx];
        const wasAlreadyCancelled =
          Boolean(existingItem.cancelado) || existingItem.status === 'Cancelado';
        const preservedResponsavel =
          existingItem.responsavel && existingItem.responsavel.trim().length > 0
            ? existingItem.responsavel
            : rawCancel.responsavel || '';

        if (newlyAddedIndices.has(matchIdx) && !wasAlreadyCancelled) {
          addedValor = Math.max(0, Number((addedValor - existingItem.preco).toFixed(2)));
        } else if (!newlyAddedIndices.has(matchIdx)) {
          updatedCount++;
        }

        updatedList[matchIdx] = {
          ...existingItem,
          preco: 0,
          cancelado: true,
          status: 'Cancelado',
          responsavel: preservedResponsavel,
        };
        cancelledRemovedCount++;
      } else {
        // IMPORTANTE: Venda original não encontrada no banco local -> ignora a linha sem inserir "fantasma negativo"
        ignoredOrphanCancelCount++;
      }
    }

    setAebSales(updatedList);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_AEB_KEY, JSON.stringify(updatedList));
      }
    } catch (err) {
      console.error('Erro ao salvar AeB no localStorage:', err);
    }

    if (addedCount > 0) {
      const valorStr = formatCurrencyBRL(addedValor);
      let msg = `${addedCount} ${addedCount === 1 ? 'item novo de AeB importado' : 'itens novos de AeB importados'} com sucesso (${valorStr}).`;
      if (updatedCount > 0) {
        msg += ` (${updatedCount} existente(s) atualizado(s)).`;
      }
      if (cancelledRemovedCount > 0) {
        msg += ` (${cancelledRemovedCount} estorno(s) aplicado(s) com R$ 0,00).`;
      }
      if (ignoredOrphanCancelCount > 0) {
        msg += ` (${ignoredOrphanCancelCount} cancelamento(s) de outro dia ignorado(s)).`;
      }
      showToast(msg);
    } else if (updatedCount > 0 || cancelledRemovedCount > 0) {
      let msg = `${updatedCount} ${updatedCount === 1 ? 'item existente de AeB atualizado' : 'itens existentes de AeB atualizados'} com sucesso.`;
      if (cancelledRemovedCount > 0) {
        msg += ` (${cancelledRemovedCount} estorno(s) marcado(s) como Cancelado R$ 0,00).`;
      }
      showToast(msg);
    } else {
      showToast('Relatório de AeB sincronizado com sucesso.');
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
      prev.map((item) => (item.id === id ? { ...item, responsavel } : item))
    );
  };

  const handleAddAeBSale = (novaVenda: VendaAeB) => {
    setAebSales((prev) => [novaVenda, ...prev]);
    showToast(`Item #${novaVenda.comanda || novaVenda.id} (${novaVenda.item}) registrado e salvo.`);
  };

  const handleEditAeBSale = (venda: VendaAeB) => {
    setEditingAeBSale(venda);
    setIsEditAeBModalOpen(true);
  };

  const handleSaveEditedAeBSale = (vendaAtualizada: VendaAeB) => {
    setAebSales((prev) =>
      prev.map((item) => (item.id === vendaAtualizada.id ? vendaAtualizada : item))
    );
    showToast(`Venda #${vendaAtualizada.comanda || vendaAtualizada.id} (AeB) atualizada com sucesso!`);
  };

  const handleDeleteAeBSale = (id: string) => {
    const itemToDelete = aebSales.find((v) => v.id === id);
    setAebSales((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_AEB_KEY, JSON.stringify(updated));
        }
      } catch (err) {
        console.error('Erro ao salvar no localStorage após exclusão de AeB:', err);
      }
      return updated;
    });
    showToast(
      itemToDelete
        ? `Item "${itemToDelete.item}" excluído com sucesso.`
        : 'Venda de Alimentos e Bebidas (AeB) excluída com sucesso.'
    );
  };

  const handleDeleteFilteredAeBSales = (filteredIds: string[]) => {
    if (filteredIds.length === 0) return;

    if (
      window.confirm(
        'Tem certeza que deseja excluir TODAS as vendas exibidas neste filtro? Essa ação não pode ser desfeita.'
      )
    ) {
      const idsToRemove = new Set(filteredIds);
      const removedCount = idsToRemove.size;

      setAebSales((prev) => {
        const updated = prev.filter((item) => !idsToRemove.has(item.id));
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_AEB_KEY, JSON.stringify(updated));
          }
        } catch (err) {
          console.error('Erro ao salvar AeB no localStorage após exclusão filtrada:', err);
        }
        return updated;
      });

      showToast(
        `${removedCount} ${removedCount === 1 ? 'venda filtrada de AeB excluída' : 'vendas filtradas de AeB excluídas'} com sucesso.`
      );
    }
  };

  const handleExportAeBCSV = () => {
    exportToCSV(
      aebSales.map((a) => ({
        id: a.id,
        data: a.data,
        hora: a.hora,
        tipo_venda: 'Fichas' as const, // Formato compatível de exportação
        item: a.item,
        preco: a.preco,
        responsavel: a.responsavel,
      })),
      `vendas-aeb-${new Date().toISOString().split('T')[0]}.csv`
    );
    showToast(`Exportados ${aebSales.length} itens de Alimentos e Bebidas (AeB) em CSV.`);
  };

  // Restauração de backup JSON unificado
  const handleRestoreBackup = (
    restoredVendas: VendaComanda[],
    restoredFechamentos: FechamentoTurnoFichas[],
    restoredAeB?: VendaAeB[]
  ) => {
    if (restoredVendas.length > 0) {
      const seen = new Set<string>();
      const sanitized = restoredVendas.map((v) => {
        if (!v.id || seen.has(v.id)) {
          return { ...v, id: generateUniqueId(), comanda: v.comanda || v.id || '13.402.000' };
        }
        seen.add(v.id);
        return { ...v, comanda: v.comanda || v.id };
      });
      setVendas(sanitized);
    }
    if (restoredFechamentos.length > 0) {
      const seen = new Set<string>();
      const sanitized = restoredFechamentos.map((f) => {
        if (!f.id || seen.has(f.id)) {
          return { ...f, id: generateUniqueId() };
        }
        seen.add(f.id);
        return f;
      });
      setFechamentos(sanitized);
    }
    if (restoredAeB && restoredAeB.length > 0) {
      const seen = new Set<string>();
      const sanitized = restoredAeB.map((v) => {
        if (!v.id || seen.has(v.id)) {
          return { ...v, id: generateUniqueId(), comanda: v.comanda || v.id || '13.402.000' };
        }
        seen.add(v.id);
        return { ...v, comanda: v.comanda || v.id };
      });
      setAebSales(sanitized);
    }
    handleClearFilters();
    showToast(
      `Backup restaurado com sucesso (${restoredVendas.length} comandas, ${restoredFechamentos.length} fechamentos e ${restoredAeB?.length || 0} itens AeB).`
    );
  };

  // Importação direta de Backup JSON (Sincronização Manual entre PC e Celular)
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
          // Arquivo contém array direto de comandas
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
        alert(err.message || 'Arquivo de backup inválido. Certifique-se de selecionar um JSON gerado pelo sistema.');
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
                <div className="w-10 h-10 rounded-lg bg-neutral-900/5 text-neutral-900 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-neutral-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Dashboard Operacional · Relatório de Comandas & Vendas Volux
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Importe o PDF do Volux ou adicione lançamentos reais. Os dados são salvos continuamente no seu navegador.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-auto text-xs text-neutral-500">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Armazenamento Local Ativo</span>
                <span className="text-neutral-300">|</span>
                <span className="font-mono-tabular">
                  {vendas.length} {vendas.length === 1 ? 'comanda salva' : 'comandas salvas'}
                </span>
              </div>
            </div>

            {/* Upload e Processamento do PDF do Volux */}
            <VoluxUploadArea
              onDataLoaded={handleVoluxDataLoaded}
              currentLoadedSource={loadedSourceName}
            />

            {/* 3 Summary Cards baseados nas comandas visíveis */}
            <SummaryCards
              filteredVendas={filteredVendas}
              totalVendasCount={vendas.length}
            />

            {/* Tabela de Comandas com Toolbar de Filtros */}
            <div className="space-y-0">
              <TableToolbar
                availableDays={availableDays}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                selectedTurno={selectedTurno}
                onSelectTurno={setSelectedTurno}
                selectedTipo={selectedTipo}
                onSelectTipo={setSelectedTipo}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusResponsavel={statusResponsavel}
                onSelectStatusResponsavel={setStatusResponsavel}
                totalCount={vendas.length}
                filteredCount={filteredVendas.length}
                onClearFilters={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
                onOpenQuickAssign={() => setIsQuickAssignOpen(true)}
                pendingAssignCount={pendingAssignCount}
                onOpenBackupModal={() => setIsBackupModalOpen(true)}
                onImportBackupJSON={handleDirectImportBackupJSON}
                onDeleteFilteredVendas={handleDeleteFilteredVendas}
              />

              <SalesTable
                vendas={filteredVendas}
                onUpdateResponsavel={handleUpdateResponsavel}
                onEditVenda={handleEditVenda}
                onDeleteVenda={handleDeleteVenda}
              />
            </div>
          </div>
        ) : activeTab === 'controle_fichas' ? (
          /* ABA 2: CONTROLE FÍSICO DE FICHAS */
          <ControleFichasTab
            fechamentos={fechamentos}
            onAddFechamento={handleAddFechamento}
            onDeleteFechamento={handleDeleteFechamento}
            onResetFechamentos={handleResetFechamentos}
          />
        ) : activeTab === 'aeb' ? (
          /* ABA 3: ALIMENTOS E BEBIDAS (AeB) */
          <AeBTab
            vendas={aebSales}
            onUpdateResponsavel={handleUpdateAeBResponsavel}
            onEditVenda={handleEditAeBSale}
            onDeleteVenda={handleDeleteAeBSale}
            onDeleteFilteredVendas={handleDeleteFilteredAeBSales}
            onDataLoaded={handleAeBDataLoaded}
            onOpenNewSaleModal={() => setIsNewAeBSaleOpen(true)}
            onExportCSV={handleExportAeBCSV}
          />
        ) : (
          /* ABA 4: RELATÓRIOS (BI) */
          <RelatoriosTab
            vendas={vendas}
            aebSales={aebSales}
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
