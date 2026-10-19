import React, { useState, useMemo, useEffect } from 'react';
import {
  VendaComanda,
  FiltroTipo,
  FiltroStatusResponsavel,
  FechamentoTurnoFichas,
  VendaAeB,
  AppTab,
} from './types/venda';
import { useLocalStorage } from './hooks/useLocalStorage';
import { exportToCSV, formatCurrencyBRL } from './utils/formatters';
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
    // 1. Identifica IDs cancelados no relatório PDF
    const canceladosIds = new Set<string>(
      extractedVendas.filter((v) => v.cancelado).map((v) => v.id)
    );

    // Obtém o conjunto atual para cálculo síncrono e preciso das métricas
    let currentVendas = vendas;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_VENDAS_KEY);
        if (raw) currentVendas = JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
    }

    // 2. Se a venda cancelada já existia no banco local, remove-a do sistema
    let cancelledRemovedCount = 0;
    const baseVendas = currentVendas.filter((item) => {
      if (canceladosIds.has(item.id)) {
        cancelledRemovedCount++;
        return false;
      }
      return true;
    });

    // 3. Varredura com verificação de ID no estado existente (preserva dados como Responsável)
    const existingIds = new Set<string>(baseVendas.map((item) => item.id));
    const toAdd: VendaComanda[] = [];
    let addedCount = 0;
    let addedValor = 0;
    let ignoredDuplicateCount = 0;

    for (const item of extractedVendas) {
      if (item.cancelado) {
        // Se o cancelamento for de venda que ainda não estava no banco, ignora a linha e não adiciona
        continue;
      }

      if (existingIds.has(item.id)) {
        // Se o ID já existir, ignora a adição (anti-duplicação) e mantém os dados antigos
        ignoredDuplicateCount++;
      } else {
        // Se o ID não existir, adiciona o novo registro
        toAdd.push(item);
        existingIds.add(item.id);
        addedCount++;
        addedValor += item.preco;
      }
    }

    const finalResult = [...baseVendas, ...toAdd];
    setVendas(finalResult);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_VENDAS_KEY, JSON.stringify(finalResult));
      }
    } catch (err) {
      console.error('Erro ao salvar no localStorage:', err);
    }

    setLoadedSourceName(sourceName);

    // Feedback visual preciso: baseado exclusivamente nas vendas que foram efetivamente adicionadas ou alteradas
    if (addedCount > 0) {
      const valorStr = formatCurrencyBRL(addedValor);
      let msg = `${addedCount} ${addedCount === 1 ? 'comanda nova importada' : 'comandas novas importadas'} com sucesso (${valorStr}).`;
      if (ignoredDuplicateCount > 0) {
        msg += ` ${ignoredDuplicateCount} já existente(s) mantida(s).`;
      }
      if (cancelledRemovedCount > 0) {
        msg += ` ${cancelledRemovedCount} cancelamento(s) processado(s).`;
      }
      showToast(msg);
    } else if (cancelledRemovedCount > 0) {
      showToast(`${cancelledRemovedCount} venda(s) cancelada(s) processada(s) e removida(s) do sistema.`);
    } else {
      showToast(`Nenhuma comanda nova: todas as ${ignoredDuplicateCount || extractedVendas.length} comandas do PDF já constavam no sistema.`);
    }

    return { addedCount, addedValor, ignoredDuplicateCount, cancelledRemovedCount };
  };

  // Extração automática de dias únicos disponíveis nas comandas salvas
  const availableDays = useMemo(() => {
    const daysSet = new Set<string>();
    vendas.forEach((v) => {
      if (v.data && v.data.trim()) {
        daysSet.add(v.data.trim());
      }
    });
    return Array.from(daysSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
    selectedTipo !== 'Todos' ||
    statusResponsavel !== 'todos' ||
    searchTerm.trim() !== '';

  const handleClearFilters = () => {
    setSelectedDay('Todos');
    setSelectedTipo('Todos');
    setStatusResponsavel('todos');
    setSearchTerm('');
  };

  // Comandas filtradas (Aba 1)
  const filteredVendas = useMemo(() => {
    return vendas.filter((venda) => {
      if (selectedDay !== 'Todos' && venda.data !== selectedDay) {
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
  }, [vendas, selectedDay, selectedTipo, statusResponsavel, searchTerm]);

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
  const handleAeBDataLoaded = (extracted: VendaAeB[], sourceName: string) => {
    // 1. Identifica cancelamentos
    const canceladosIds = new Set<string>(
      extracted.filter((v) => v.cancelado).map((v) => v.id)
    );

    let currentAeb = aebSales;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_AEB_KEY);
        if (raw) currentAeb = JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
    }

    let cancelledRemovedCount = 0;
    const baseAeb = currentAeb.filter((item) => {
      if (canceladosIds.has(item.id)) {
        cancelledRemovedCount++;
        return false;
      }
      return true;
    });

    const existingIds = new Set<string>(baseAeb.map((item) => item.id));
    const toAdd: VendaAeB[] = [];
    let addedCount = 0;
    let addedValor = 0;
    let ignoredDuplicateCount = 0;

    for (const item of extracted) {
      if (item.cancelado) {
        continue;
      }

      if (existingIds.has(item.id)) {
        // Previne duplicação e preserva o registro antigo
        ignoredDuplicateCount++;
      } else {
        toAdd.push(item);
        existingIds.add(item.id);
        addedCount++;
        addedValor += item.preco;
      }
    }

    const finalResult = [...baseAeb, ...toAdd];
    setAebSales(finalResult);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_AEB_KEY, JSON.stringify(finalResult));
      }
    } catch (err) {
      console.error('Erro ao salvar AeB no localStorage:', err);
    }

    // Feedback visual preciso: baseado exclusivamente nas vendas que foram efetivamente adicionadas ou alteradas
    if (addedCount > 0) {
      const valorStr = formatCurrencyBRL(addedValor);
      let msg = `${addedCount} ${addedCount === 1 ? 'item novo de AeB importado' : 'itens novos de AeB importados'} com sucesso (${valorStr}).`;
      if (ignoredDuplicateCount > 0) {
        msg += ` (${ignoredDuplicateCount} já existente(s) mantido(s)).`;
      }
      if (cancelledRemovedCount > 0) {
        msg += ` (${cancelledRemovedCount} cancelamento(s) processado(s)).`;
      }
      showToast(msg);
    } else if (cancelledRemovedCount > 0) {
      showToast(`${cancelledRemovedCount} item(ns) de AeB cancelado(s) removido(s) do sistema.`);
    } else {
      showToast(`Nenhum item novo: todos os ${ignoredDuplicateCount || extracted.length} itens de AeB do PDF já constavam no sistema.`);
    }

    return { addedCount, addedValor, ignoredDuplicateCount, cancelledRemovedCount };
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
