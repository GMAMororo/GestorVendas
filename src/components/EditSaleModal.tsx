import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  CircleDot,
  Ticket,
  GlassWater,
  Gift,
  Wrench,
  DollarSign,
  Lock,
} from 'lucide-react';
import { TipoVenda, VendaComanda, MotivoOperacional } from '../types/venda';
import { CATALOGO_VOLUX } from '../utils/voluxParser';
import { CATALOGO_AEB_PRODUTOS } from '../data/catalogoAeB';
import {
  formatCurrencyBRL,
  isRegistroCortesia,
  isRegistroManutencao,
  isRegistroVoucher,
  getContaAdmCode,
} from '../utils/formatters';

interface EditSaleModalProps {
  isOpen: boolean;
  venda: VendaComanda | null;
  onClose: () => void;
  onSaveVenda: (vendaAtualizada: VendaComanda) => void;
}

function getCatalogForCategory(categoria: TipoVenda): Array<{ nome: string; precoReferencia: number }> {
  if (categoria === 'Boliche') {
    return CATALOGO_VOLUX.boliche.map((b) => ({
      nome: b.nome,
      precoReferencia: b.precoReferencia,
    }));
  }
  if (categoria === 'Fichas') {
    return [
      ...CATALOGO_VOLUX.fichas.map((f) => ({
        nome: f.nome,
        precoReferencia: f.precoReferencia,
      })),
      {
        nome: 'Ficha Individual (Manutenção)',
        precoReferencia: 0,
      },
      {
        nome: 'Ficha Individual (Cortesia)',
        precoReferencia: 0,
      },
    ];
  }
  return CATALOGO_AEB_PRODUTOS.map((p) => ({
    nome: p.nome,
    precoReferencia: p.preco,
  }));
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  venda,
  onClose,
  onSaveVenda,
}) => {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [tipoVenda, setTipoVenda] = useState<TipoVenda>('Boliche');
  const [motivoOperacional, setMotivoOperacional] = useState<MotivoOperacional>('Normal');
  const [item, setItem] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState<number>(0);
  const [qtde, setQtde] = useState<number>(1);
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');

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

  useEffect(() => {
    if (venda && isOpen) {
      setData(venda.data);
      setHora(venda.hora);
      const catInicial: TipoVenda = venda.tipo_venda || 'Boliche';
      setTipoVenda(catInicial);

      const qtdeInicial = Math.max(1, Number(venda.qtde) || 1);
      setQtde(qtdeInicial);

      let initialMotivo: MotivoOperacional = 'Normal';
      if (catInicial === 'Fichas') {
        if (isRegistroManutencao(venda)) {
          initialMotivo = 'Manutenção';
        } else if (isRegistroCortesia(venda) && !getContaAdmCode(venda)) {
          initialMotivo = 'Cortesia';
        } else {
          initialMotivo = 'Normal';
        }
      } else {
        if (isRegistroVoucher(venda)) {
          initialMotivo = 'Voucher';
        } else {
          initialMotivo = 'Normal';
        }
      }
      setMotivoOperacional(initialMotivo);

      const catalogoCat = getCatalogForCategory(catInicial);
      const itemNoCatalogo = catalogoCat.find((op) => op.nome === venda.item);

      if (itemNoCatalogo) {
        setItem(itemNoCatalogo.nome);
        setPrecoUnitario(itemNoCatalogo.precoReferencia);
      } else {
        const primeiroOficial = catalogoCat[0];
        setItem(primeiroOficial.nome);
        setPrecoUnitario(primeiroOficial.precoReferencia);
      }

      setResponsavel(venda.responsavel || '');
      setObservacao(venda.observacao || '');
    }
  }, [venda, isOpen]);

  if (!isOpen || !venda) return null;

  const contaAdmDetected = getContaAdmCode(venda);
  const isComandaAdm = Boolean(contaAdmDetected);
  const isOperacaoSemCusto =
    !isComandaAdm &&
    tipoVenda === 'Fichas' &&
    (motivoOperacional === 'Cortesia' || motivoOperacional === 'Manutenção');

  const quantidadeValida = Math.max(1, Math.floor(Number(qtde) || 1));
  const precoUnitarioEfetivo = isOperacaoSemCusto ? 0 : precoUnitario;
  const valorTotalCalculado = Number((quantidadeValida * precoUnitarioEfetivo).toFixed(2));

  // Ao trocar a Categoria da Venda, seleciona AUTOMATICAMENTE o primeiro item oficial do catálogo daquela nova categoria
  // e recalcula imediatamente o preço unitário e o Valor Total (R$)
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

    const catalogoNovo = getCatalogForCategory(novoTipo);
    if (novoTipo === 'Fichas' && nextMotivo === 'Cortesia') {
      setItem('Ficha Individual (Cortesia)');
      setPrecoUnitario(0);
    } else if (novoTipo === 'Fichas' && nextMotivo === 'Manutenção') {
      setItem('Ficha Individual (Manutenção)');
      setPrecoUnitario(0);
    } else {
      const primeiroItem = catalogoNovo[0];
      setItem(primeiroItem.nome);
      setPrecoUnitario(primeiroItem.precoReferencia);
    }
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

    if (tipoVenda === 'Fichas' && novoMotivo === 'Cortesia') {
      setItem('Ficha Individual (Cortesia)');
      setPrecoUnitario(0);
    } else if (tipoVenda === 'Fichas' && novoMotivo === 'Manutenção') {
      setItem('Ficha Individual (Manutenção)');
      setPrecoUnitario(0);
    } else {
      const catalogoAtual = getCatalogForCategory(tipoVenda).filter(
        (op) =>
          op.nome !== 'Ficha Individual (Cortesia)' &&
          op.nome !== 'Ficha Individual (Manutenção)'
      );
      const encontrado =
        catalogoAtual.find((op) => op.nome === item) || catalogoAtual[0];
      setItem(encontrado.nome);
      setPrecoUnitario(encontrado.precoReferencia);
    }
  };

  const handleItemPresetChange = (nomeItem: string, precoRef: number) => {
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
    setPrecoUnitario(precoRef);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isContaAdmFinal = Boolean(contaAdmDetected);
    const isVoucherFinal =
      !isContaAdmFinal &&
      (tipoVenda === 'Boliche' || tipoVenda === 'AeB') &&
      motivoOperacional === 'Voucher';
    const isManutencaoFinal =
      !isContaAdmFinal &&
      tipoVenda === 'Fichas' &&
      motivoOperacional === 'Manutenção';
    const isCortesiaManualFinal =
      !isContaAdmFinal &&
      tipoVenda === 'Fichas' &&
      motivoOperacional === 'Cortesia';
    const isCortesiaFinal = isContaAdmFinal || isCortesiaManualFinal;

    onSaveVenda({
      ...venda,
      data: data.trim() || venda.data,
      hora: hora.trim() || venda.hora,
      tipo_venda: tipoVenda,
      item,
      qtde: quantidadeValida,
      preco: isOperacaoSemCusto ? 0 : valorTotalCalculado,
      responsavel: responsavel.trim(),
      observacao: observacao.trim() || undefined,
      conta3000: isContaAdmFinal,
      contaAdm: contaAdmDetected || venda.contaAdm,
      espaco: contaAdmDetected || venda.espaco,
      isCortesia: isCortesiaFinal,
      isManutencao: isManutencaoFinal,
      isVoucher: isVoucherFinal,
      motivoOperacional: isCortesiaFinal
        ? 'Cortesia'
        : isVoucherFinal
          ? 'Voucher'
          : isManutencaoFinal
            ? 'Manutenção'
            : 'Normal',
    });

    onClose();
  };

  const opcoesAtuais = getCatalogForCategory(tipoVenda);

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
              Editar Venda
            </h3>
            <p className="text-xs text-neutral-500">
              Selecione a categoria, modalidade e item oficial do catálogo
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
          {/* 1. Seleção de Categoria */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Categoria da Venda
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTipoChange('Boliche')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  tipoVenda === 'Boliche'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-2 ring-indigo-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <CircleDot className="w-4 h-4 text-indigo-600" />
                <span>Boliche</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('Fichas')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  tipoVenda === 'Fichas'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Ticket className="w-4 h-4 text-amber-600" />
                <span>Fichas</span>
              </button>

              <button
                type="button"
                onClick={() => handleTipoChange('AeB')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  tipoVenda === 'AeB'
                    ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/15'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <GlassWater className="w-4 h-4 text-blue-600" />
                <span>AeB</span>
              </button>
            </div>
          </div>

          {/* 2. Modalidade / Forma Operacional */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Modalidade / Forma Operacional
            </label>
            <div
              className={`grid gap-2 ${
                tipoVenda === 'Fichas' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'
              }`}
            >
              <button
                type="button"
                onClick={() => handleMotivoChange('Normal')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  motivoOperacional === 'Normal'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Normal</span>
              </button>

              {(tipoVenda === 'Boliche' || tipoVenda === 'AeB') && (
                <button
                  type="button"
                  onClick={() => handleMotivoChange('Voucher')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    motivoOperacional === 'Voucher'
                      ? 'bg-violet-50 border-violet-300 text-violet-900'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5 text-violet-600" />
                  <span>🎟️ Voucher</span>
                </button>
              )}

              {tipoVenda === 'Fichas' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleMotivoChange('Cortesia')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      motivoOperacional === 'Cortesia'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cortesia (R$ 0,00)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMotivoChange('Manutenção')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      motivoOperacional === 'Manutenção'
                        ? 'bg-cyan-50 border-cyan-300 text-cyan-900'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Manutenção</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 3. Catálogo Oficial (Seleção Exclusiva de Item) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Catálogo Oficial Volux ({tipoVenda})
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono-tabular">
                <Lock className="w-3 h-3 text-neutral-400" />
                Unitário: <strong>{formatCurrencyBRL(precoUnitarioEfetivo)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {opcoesAtuais.map((op) => {
                const isSelected = item === op.nome;
                return (
                  <button
                    key={op.nome}
                    type="button"
                    onClick={() => handleItemPresetChange(op.nome, op.precoReferencia)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 font-medium'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{op.nome}</span>
                    <span
                      className={`font-mono-tabular font-semibold ${
                        isSelected ? 'text-emerald-300' : 'text-neutral-900'
                      }`}
                    >
                      {formatCurrencyBRL(op.precoReferencia)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Data e Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Data (DD/MM)
              </label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Hora (HH:MM)
              </label>
              <input
                type="text"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
              />
            </div>
          </div>

          {/* 5. Quantidade, Valor Total (Bloqueado) & Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={qtde}
                onChange={(e) => setQtde(Math.max(1, parseInt(e.target.value, 10) || 1))}
                required
                className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1">
                <Lock className="w-3 h-3 text-neutral-400" />
                <span>Valor Total (R$)</span>
              </label>
              <input
                type="text"
                value={formatCurrencyBRL(valorTotalCalculado)}
                readOnly
                className="w-full px-3 py-2 text-xs font-mono-tabular font-bold bg-neutral-100 border border-neutral-300 text-neutral-900 rounded-lg cursor-not-allowed focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Responsável pela Venda
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do operador de caixa..."
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
              />
            </div>
          </div>

          {/* 6. Observações (Opcional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Observações (Opcional)
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
