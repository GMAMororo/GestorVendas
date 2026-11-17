import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  CircleDot,
  Ticket,
  GlassWater,
  Gift,
  Wrench,
  DollarSign,
  Lock,
  Coins,
  Award,
  MessageSquareText,
} from 'lucide-react';
import { TipoVenda, VendaComanda, MotivoOperacional } from '../types/venda';
import { CATALOGO_VOLUX } from '../utils/voluxParser';
import { CATALOGO_AEB_PRODUTOS } from '../data/catalogoAeB';
import { formatCurrencyBRL } from '../utils/formatters';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVenda: (novaVenda: VendaComanda) => void;
}

/**
 * Retorna a definição unitária padrão de saída de fichas (Prata x Dourada) por 1 unidade do item:
 * - Ficha Avulsa / Prata ("Ficha de Jogos Eletronicos" - R$ 12,00): 1 Prata | 0 Douradas
 * - Mini Combo Fichas (R$ 65,00): 5 Pratas | 1 Dourada
 * - Big Combo Fichas (R$ 120,00): 10 Pratas | 2 Douradas
 * - Mega Combo Fichas (R$ 250,00): 20 Pratas | 5 Douradas
 * - Manutenção Fichas (R$ 0,00): 0 Pratas | 1 Dourada
 * - Cortesia Fichas (R$ 0,00): 0 Pratas | 1 Dourada
 */
function getFichaRuleForItem(
  itemName: string,
  motivo: MotivoOperacional
): { prataPorUnidade: number; douradaPorUnidade: number; labelRegra: string } {
  const norm = (itemName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    motivo === 'Cortesia' ||
    motivo === 'Manutenção' ||
    norm.includes('cortesia') ||
    norm.includes('manutencao')
  ) {
    return {
      prataPorUnidade: 0,
      douradaPorUnidade: 1,
      labelRegra: 'Padrão unitário: 0 Pratas | 1 Dourada (R$ 0,00)',
    };
  }

  if (norm.includes('mega combo')) {
    return {
      prataPorUnidade: 20,
      douradaPorUnidade: 5,
      labelRegra: 'Padrão unitário: 20 Pratas | 5 Douradas (R$ 250,00)',
    };
  }

  if (norm.includes('big combo')) {
    return {
      prataPorUnidade: 10,
      douradaPorUnidade: 2,
      labelRegra: 'Padrão unitário: 10 Pratas | 2 Douradas (R$ 120,00)',
    };
  }

  if (norm.includes('mini combo')) {
    return {
      prataPorUnidade: 5,
      douradaPorUnidade: 1,
      labelRegra: 'Padrão unitário: 5 Pratas | 1 Dourada (R$ 65,00)',
    };
  }

  return {
    prataPorUnidade: 1,
    douradaPorUnidade: 0,
    labelRegra: 'Padrão unitário: 1 Prata | 0 Douradas (R$ 12,00)',
  };
}

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getCurrentDateAndTime() {
  const current = new Date();
  const dateFormatted = `${String(current.getDate()).padStart(2, '0')}/${String(
    current.getMonth() + 1
  ).padStart(2, '0')}/${current.getFullYear()}`;
  const timeFormatted = current.toTimeString().slice(0, 5);
  return { dateFormatted, timeFormatted };
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onAddVenda,
}) => {
  const initialDateTime = getCurrentDateAndTime();

  const [data, setData] = useState(initialDateTime.dateFormatted);
  const [hora, setHora] = useState(initialDateTime.timeFormatted);
  const [tipoVenda, setTipoVenda] = useState<TipoVenda>('Boliche');
  const [motivoOperacional, setMotivoOperacional] = useState<MotivoOperacional>('Normal');
  const [item, setItem] = useState(CATALOGO_VOLUX.boliche[0].nome);
  const [precoUnitario, setPrecoUnitario] = useState<number>(
    CATALOGO_VOLUX.boliche[0].precoReferencia
  );
  const [qtde, setQtde] = useState<number>(1);
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');

  // Reset Automático ao Abrir o Modal: SEMPRE puxa a Data de hoje e o Horário exato do sistema naquele instante
  useEffect(() => {
    if (isOpen) {
      const { dateFormatted, timeFormatted } = getCurrentDateAndTime();
      setData(dateFormatted);
      setHora(timeFormatted);
    }
  }, [isOpen]);

  // Fechar ao pressionar a tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Garante as modalidades permitidas por categoria:
  // - Boliche: apenas Normal ou Voucher
  // - Fichas: apenas Normal, Cortesia ou Manutenção (sem Voucher)
  // - AeB: apenas Normal ou Voucher (sem Cortesia / Manutenção)
  useEffect(() => {
    if (
      (tipoVenda === 'Boliche' || tipoVenda === 'AeB') &&
      motivoOperacional !== 'Normal' &&
      motivoOperacional !== 'Voucher'
    ) {
      setMotivoOperacional('Normal');
    } else if (tipoVenda === 'Fichas' && motivoOperacional === 'Voucher') {
      setMotivoOperacional('Normal');
    }
  }, [tipoVenda, motivoOperacional]);

  if (!isOpen) return null;

  const isOperacaoSemCusto =
    tipoVenda === 'Fichas' &&
    (motivoOperacional === 'Cortesia' || motivoOperacional === 'Manutenção');

  const isFichasUnitarioEspecial =
    tipoVenda === 'Fichas' &&
    (motivoOperacional === 'Cortesia' || motivoOperacional === 'Manutenção');

  const handleTipoChange = (novoTipo: TipoVenda) => {
    setTipoVenda(novoTipo);
    let nextMotivo: MotivoOperacional = motivoOperacional;
    if (novoTipo === 'Boliche' || novoTipo === 'AeB') {
      if (nextMotivo !== 'Normal' && nextMotivo !== 'Voucher') {
        nextMotivo = 'Normal';
      }
    } else if (novoTipo === 'Fichas') {
      if (nextMotivo === 'Voucher') {
        nextMotivo = 'Normal';
      }
    }
    setMotivoOperacional(nextMotivo);
    setQtde(1);

    let defaultItemName = '';
    let defaultPrice = 0;

    if (novoTipo === 'Boliche') {
      defaultItemName = CATALOGO_VOLUX.boliche[0].nome;
      defaultPrice = CATALOGO_VOLUX.boliche[0].precoReferencia;
    } else if (novoTipo === 'Fichas') {
      if (nextMotivo === 'Cortesia') {
        defaultItemName = 'Ficha Individual (Cortesia)';
        defaultPrice = 0;
      } else if (nextMotivo === 'Manutenção') {
        defaultItemName = 'Ficha Individual (Manutenção)';
        defaultPrice = 0;
      } else {
        defaultItemName = CATALOGO_VOLUX.fichas[0].nome;
        defaultPrice = CATALOGO_VOLUX.fichas[0].precoReferencia;
      }
    } else {
      defaultItemName = CATALOGO_AEB_PRODUTOS[0].nome;
      defaultPrice = CATALOGO_AEB_PRODUTOS[0].preco;
    }

    setItem(defaultItemName);
    setPrecoUnitario(
      novoTipo === 'Fichas' && (nextMotivo === 'Cortesia' || nextMotivo === 'Manutenção')
        ? 0
        : defaultPrice
    );
  };

  const handleMotivoChange = (novoMotivo: MotivoOperacional) => {
    if (
      (tipoVenda === 'Boliche' || tipoVenda === 'AeB') &&
      novoMotivo !== 'Normal' &&
      novoMotivo !== 'Voucher'
    ) {
      return;
    }
    if (tipoVenda === 'Fichas' && novoMotivo === 'Voucher') {
      return;
    }
    setMotivoOperacional(novoMotivo);
    setQtde(1);

    if (tipoVenda === 'Fichas' && novoMotivo === 'Cortesia') {
      setPrecoUnitario(0);
      setItem('Ficha Individual (Cortesia)');
    } else if (tipoVenda === 'Fichas' && novoMotivo === 'Manutenção') {
      setPrecoUnitario(0);
      setItem('Ficha Individual (Manutenção)');
    } else {
      if (tipoVenda === 'Boliche') {
        const found =
          CATALOGO_VOLUX.boliche.find((b) => b.nome === item) || CATALOGO_VOLUX.boliche[0];
        setItem(found.nome);
        setPrecoUnitario(found.precoReferencia);
      } else if (tipoVenda === 'Fichas') {
        const defaultFicha = CATALOGO_VOLUX.fichas[0];
        const found = CATALOGO_VOLUX.fichas.find((f) => f.nome === item) || defaultFicha;
        setItem(found.nome);
        setPrecoUnitario(found.precoReferencia);
      } else {
        const found =
          CATALOGO_AEB_PRODUTOS.find((p) => p.nome === item) || CATALOGO_AEB_PRODUTOS[0];
        setItem(found.nome);
        setPrecoUnitario(found.preco);
      }
    }
  };

  const handleItemPresetChange = (nomeItem: string) => {
    if (tipoVenda === 'Fichas' && nomeItem === 'Ficha Individual (Cortesia)') {
      setMotivoOperacional('Cortesia');
      setItem('Ficha Individual (Cortesia)');
      setPrecoUnitario(0);
      return;
    }
    if (tipoVenda === 'Fichas' && nomeItem === 'Ficha Individual (Manutenção)') {
      setMotivoOperacional('Manutenção');
      setItem('Ficha Individual (Manutenção)');
      setPrecoUnitario(0);
      return;
    }

    if (tipoVenda === 'Fichas' && motivoOperacional !== 'Normal') {
      setMotivoOperacional('Normal');
    }

    setItem(nomeItem);

    const todosPresets = [
      ...CATALOGO_VOLUX.boliche.map((b) => ({ nome: b.nome, preco: b.precoReferencia })),
      ...CATALOGO_VOLUX.fichas.map((f) => ({ nome: f.nome, preco: f.precoReferencia })),
      ...CATALOGO_AEB_PRODUTOS.map((p) => ({ nome: p.nome, preco: p.preco })),
    ];
    const encontrado = todosPresets.find((p) => p.nome === nomeItem);
    if (encontrado) {
      setPrecoUnitario(encontrado.preco);
    }
  };

  const quantidadeValida = Math.max(1, Math.floor(Number(qtde) || 1));
  const precoUnitarioEfetivo = isOperacaoSemCusto ? 0 : precoUnitario;
  const valorTotalCalculado = Number((quantidadeValida * precoUnitarioEfetivo).toFixed(2));

  // Multiplicação automática de saída de fichas (Prata x Dourada) quando a categoria for "Fichas"
  const regraFichas = getFichaRuleForItem(item, motivoOperacional);
  const saidaPratas = quantidadeValida * regraFichas.prataPorUnidade;
  const saidaDouradas = quantidadeValida * regraFichas.douradaPorUnidade;

  const isHoraValida = TIME_24H_REGEX.test(hora.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHoraValida) {
      return;
    }

    const { dateFormatted } = getCurrentDateAndTime();
    let motivoFinal: MotivoOperacional = motivoOperacional;
    if (tipoVenda === 'Boliche' || tipoVenda === 'AeB') {
      if (motivoFinal !== 'Normal' && motivoFinal !== 'Voucher') {
        motivoFinal = 'Normal';
      }
    } else if (tipoVenda === 'Fichas' && motivoFinal === 'Voucher') {
      motivoFinal = 'Normal';
    }
    const semCustoFinal =
      tipoVenda === 'Fichas' &&
      (motivoFinal === 'Cortesia' || motivoFinal === 'Manutenção');

    const manualId = `MANUAL-${Date.now()}`;

    const itemFinal = isFichasUnitarioEspecial
      ? motivoFinal === 'Manutenção'
        ? 'Ficha Individual (Manutenção)'
        : 'Ficha Individual (Cortesia)'
      : item.trim() || 'Item Avulso';

    onAddVenda({
      id: manualId,
      comanda: manualId,
      data: data.trim() || dateFormatted,
      hora: hora.trim(),
      tipo_venda: tipoVenda,
      item: itemFinal,
      preco: semCustoFinal ? 0 : valorTotalCalculado,
      qtde: quantidadeValida,
      responsavel: responsavel.trim(),
      observacao: observacao.trim() || undefined,
      origem: 'MANUAL',
      conciliado: false,
      faltouNoManual: false,
      sobraNoManual: false,
      cancelado: false,
      status: 'Ativo',
      isCortesia: tipoVenda === 'Fichas' && motivoFinal === 'Cortesia',
      isManutencao: tipoVenda === 'Fichas' && motivoFinal === 'Manutenção',
      isVoucher: (tipoVenda === 'Boliche' || tipoVenda === 'AeB') && motivoFinal === 'Voucher',
      motivoOperacional: motivoFinal,
    });

    setQtde(1);
    setObservacao('');
    onClose();
  };

  const opcoesAtuais =
    tipoVenda === 'Boliche'
      ? CATALOGO_VOLUX.boliche.map((b) => ({
          nome: b.nome,
          precoReferencia: b.precoReferencia,
          desc: 'Locação de pista (preço unitário fixo)',
        }))
      : tipoVenda === 'Fichas'
      ? [
          ...CATALOGO_VOLUX.fichas.map((f) => ({
            nome: f.nome,
            precoReferencia: f.precoReferencia,
            desc: f.desc,
          })),
          {
            nome: 'Ficha Individual (Manutenção)',
            precoReferencia: 0,
            desc: '0 Pratas + 1 Dourada / R$ 0,00 (Manutenção)',
          },
          {
            nome: 'Ficha Individual (Cortesia)',
            precoReferencia: 0,
            desc: '0 Pratas + 1 Dourada / R$ 0,00 (Cortesia)',
          },
        ]
      : CATALOGO_AEB_PRODUTOS.map((p) => ({
          nome: p.nome,
          precoReferencia: p.preco,
          desc: p.categoria,
        }));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-950/50 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-lg"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50/60 sticky top-0 z-10">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Registrar Nova Venda / Operação Manual
            </h3>
            <p className="text-xs text-neutral-500">
              Preço unitário tabelado, multiplicação por quantidade, Voucher e observação opcional
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 1. Seleção de Categoria: Boliche, Fichas ou AeB */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              1. Categoria da Venda
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTipoChange('Boliche')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  tipoVenda === 'Boliche'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <CircleDot className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Boliche</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('Fichas')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  tipoVenda === 'Fichas'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Ticket className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Fichas</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('AeB')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  tipoVenda === 'AeB'
                    ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <GlassWater className="w-4 h-4 text-blue-600 shrink-0" />
                <span>AeB</span>
              </button>
            </div>
          </div>

          {/* 2. Motivo Operacional por Categoria */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                2. Modalidade / Forma Operacional
              </label>
              {motivoOperacional === 'Voucher' && (
                <span className="text-[11px] font-medium text-violet-700">
                  🎟️ Desconta estoque normal · Não soma em dinheiro no caixa
                </span>
              )}
            </div>
            <div
              className={`grid gap-2 ${
                tipoVenda === 'Fichas' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                onClick={() => handleMotivoChange('Normal')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  motivoOperacional === 'Normal'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-2 ring-emerald-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Venda Normal</span>
              </button>

              {(tipoVenda === 'Boliche' || tipoVenda === 'AeB') && (
                <button
                  type="button"
                  onClick={() => handleMotivoChange('Voucher')}
                  title="Voucher: conta nos itens vendidos, mas não soma dinheiro no caixa"
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    motivoOperacional === 'Voucher'
                      ? 'bg-violet-50 border-violet-300 text-violet-900 ring-2 ring-violet-500/15'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                  <span>🎟️ Voucher</span>
                </button>
              )}

              {tipoVenda === 'Fichas' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMotivoChange('Cortesia')}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      motivoOperacional === 'Cortesia'
                        ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/15'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Cortesia (R$ 0,00)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMotivoChange('Manutenção')}
                    title="Registrar saída de ficha para Manutenção (R$ 0,00)"
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      motivoOperacional === 'Manutenção'
                        ? 'bg-cyan-50 border-cyan-300 text-cyan-900 ring-2 ring-cyan-500/15'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                    <span>Manutenção</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3. Catálogo Oficial do Item + Preço Unitário Fixo (readOnly) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Catálogo Oficial ({tipoVenda})
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono-tabular">
                <Lock className="w-3 h-3 text-neutral-400" />
                Unitário fixo: <strong>{formatCurrencyBRL(precoUnitarioEfetivo)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {opcoesAtuais.map((op) => {
                const isSelected = item === op.nome;
                const displayPrice =
                  tipoVenda === 'AeB' && motivoOperacional === 'Cortesia'
                    ? 0
                    : op.precoReferencia;
                return (
                  <button
                    key={op.nome}
                    type="button"
                    onClick={() => handleItemPresetChange(op.nome)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 font-medium'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <div>
                      <span>{op.nome}</span>
                      {op.desc && (
                        <span
                          className={`block text-[10px] ${
                            isSelected ? 'text-neutral-300' : 'text-neutral-500'
                          }`}
                        >
                          {op.desc}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono-tabular font-semibold ${
                        isSelected ? 'text-emerald-300' : 'text-neutral-900'
                      }`}
                    >
                      {formatCurrencyBRL(displayPrice)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Preço Unitário (Bloqueado), Quantidade (Editável) e Total R$ (Bloqueado) lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-neutral-400" />
                <span>Preço Unitário (R$)</span>
              </label>
              <input
                type="text"
                readOnly
                value={formatCurrencyBRL(precoUnitarioEfetivo)}
                aria-label="Preço Unitário Fixo"
                className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold bg-neutral-100 border border-neutral-300 text-neutral-600 rounded-lg cursor-not-allowed focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={qtde}
                onChange={(e) =>
                  setQtde(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                required
                aria-label="Quantidade"
                className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold bg-white border border-neutral-300 text-neutral-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-neutral-400" />
                <span>Total (R$)</span>
              </label>
              <input
                type="text"
                readOnly
                value={formatCurrencyBRL(valorTotalCalculado)}
                aria-label="Total (R$)"
                className="w-full px-3 py-2 text-xs font-mono-tabular font-bold bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-lg cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>

          {/* 5. Card Bloqueado (readOnly) SAÍDA DE FICHAS (PRATA × DOURADA) quando Categoria === "Fichas" */}
          {tipoVenda === 'Fichas' && (
            <div className="p-3.5 rounded-xl border border-amber-200/90 bg-amber-50/40 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  SAÍDA DE FICHAS (PRATA × DOURADA)
                </span>
                <span className="text-[10px] font-mono-tabular font-semibold px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-900">
                  {regraFichas.labelRegra}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-slate-500" />
                    <span>Fichas Pratas (Saída)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${saidaPratas} Prata${saidaPratas === 1 ? '' : 's'} (${saidaPratas}P)`}
                    className="w-full px-3 py-2 text-xs font-mono-tabular font-bold bg-neutral-100 border border-neutral-300 text-slate-900 rounded-lg cursor-not-allowed focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 mb-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Fichas Douradas (Saída)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${saidaDouradas} Dourada${saidaDouradas === 1 ? '' : 's'} (${saidaDouradas}D)`}
                    className="w-full px-3 py-2 text-xs font-mono-tabular font-bold bg-amber-100/60 border border-amber-300 text-amber-950 rounded-lg cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-[10px] text-neutral-500 font-mono-tabular">
                Regra: Avulsa: 1P/0D | Mini: 5P/1D | Big: 10P/2D | Mega: 20P/5D | Manutenção e Cortesia: 0P/1D com preço R$ 0,00
              </p>
            </div>
          )}

          {/* 6. Data, Hora e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Data (DD/MM/AAAA)
              </label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="19/10/2025"
                required
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Hora (HH:MM)
              </label>
              <input
                type="time"
                step={60}
                value={hora}
                onChange={(e) => setHora(e.target.value.slice(0, 5))}
                required
                aria-invalid={!isHoraValida}
                className={`w-full px-3 py-2 text-xs font-mono-tabular border rounded-lg focus:bg-white focus:outline-none focus:ring-2 ${
                  isHoraValida
                    ? 'bg-neutral-50 border-neutral-200 focus:ring-neutral-900/10 focus:border-neutral-400'
                    : 'bg-red-50/70 border-red-400 text-red-900 focus:ring-red-500/20 focus:border-red-500'
                }`}
              />
              {!isHoraValida && (
                <p className="mt-1 text-[10px] font-semibold text-red-600">
                  Informe um horário válido entre 00:00 e 23:59.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Responsável
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Operador de caixa..."
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
              />
            </div>
          </div>

          {/* 7. Observações (Opcional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1.5">
              <MessageSquareText className="w-3.5 h-3.5 text-neutral-400" />
              <span>Observações (Opcional)</span>
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder='Ex: "Máquina de basquete travou", "Troca de pista", "Autorizado pela gerência"...'
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/70 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isHoraValida}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Registro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
