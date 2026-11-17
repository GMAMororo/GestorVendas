import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  GlassWater,
  Search,
  DollarSign,
  Ticket,
  Lock,
} from 'lucide-react';
import { VendaAeB, MotivoOperacional } from '../types/venda';
import { CATALOGO_AEB_PRODUTOS } from '../utils/voluxParser';
import {
  formatCurrencyBRL,
  isRegistroVoucher,
  getContaAdmCode,
} from '../utils/formatters';

interface EditAeBSaleModalProps {
  isOpen: boolean;
  venda: VendaAeB | null;
  onClose: () => void;
  onSaveVenda: (vendaAtualizada: VendaAeB) => void;
}

export const EditAeBSaleModal: React.FC<EditAeBSaleModalProps> = ({
  isOpen,
  venda,
  onClose,
  onSaveVenda,
}) => {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [item, setItem] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState<number>(0);
  const [qtde, setQtde] = useState<number>(1);
  const [motivo, setMotivo] = useState<MotivoOperacional>('Normal');
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');
  const [searchCat, setSearchCat] = useState('');

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
      setQtde(Math.max(1, Number(venda.qtde) || 1));
      const initialMotivo: MotivoOperacional = isRegistroVoucher(venda)
        ? 'Voucher'
        : 'Normal';
      setMotivo(initialMotivo);

      const encontrado =
        CATALOGO_AEB_PRODUTOS.find((p) => p.nome === venda.item) ||
        CATALOGO_AEB_PRODUTOS[0];
      setItem(encontrado.nome);
      setPrecoUnitario(encontrado.preco);

      setResponsavel(venda.responsavel || '');
      setObservacao(venda.observacao || '');
    }
  }, [venda, isOpen]);

  if (!isOpen || !venda) return null;

  const contaAdmExisting = getContaAdmCode(venda);
  const isVoucher = motivo === 'Voucher';
  const quantidadeValida = Math.max(1, Math.floor(Number(qtde) || 1));
  const valorTotalCalculado = Number((quantidadeValida * precoUnitario).toFixed(2));

  const handleSelectProduto = (nome: string, valor: number) => {
    setItem(nome);
    setPrecoUnitario(valor);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isContaAdmFinal = Boolean(contaAdmExisting);
    const isVoucherFinal = !isContaAdmFinal && isVoucher;

    onSaveVenda({
      ...venda,
      data: data.trim() || venda.data,
      hora: hora.trim() || venda.hora,
      item,
      qtde: quantidadeValida,
      preco: valorTotalCalculado,
      responsavel: responsavel.trim(),
      observacao: observacao.trim() || undefined,
      conta3000: isContaAdmFinal,
      contaAdm: contaAdmExisting || venda.contaAdm,
      espaco: contaAdmExisting || venda.espaco,
      isCortesia: isContaAdmFinal,
      isVoucher: isVoucherFinal,
      motivoOperacional: isContaAdmFinal
        ? 'Cortesia'
        : isVoucherFinal
          ? 'Voucher'
          : 'Normal',
    });

    onClose();
  };

  const produtosFiltrados = CATALOGO_AEB_PRODUTOS.filter((p) =>
    p.nome.toLowerCase().includes(searchCat.toLowerCase().trim())
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-950/50 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl border border-neutral-200 shadow-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-lg"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-blue-50/40 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <GlassWater className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Editar Venda
              </h3>
              <p className="text-xs text-neutral-500">
                Selecione a modalidade (Normal / Voucher) e o item do catálogo AeB
              </p>
            </div>
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
          {/* Modalidade */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Modalidade / Forma Operacional
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMotivo('Normal')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  motivo === 'Normal'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Venda Normal</span>
              </button>
              <button
                type="button"
                onClick={() => setMotivo('Voucher')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  motivo === 'Voucher'
                    ? 'bg-violet-50 border-violet-300 text-violet-900'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Ticket className="w-3.5 h-3.5 text-violet-600" />
                <span>🎟️ Voucher</span>
              </button>
            </div>
          </div>

          {/* Catálogo Oficial AeB */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Catálogo Oficial de Bebidas & Conveniência
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500 font-mono-tabular">
                <Lock className="w-3 h-3 text-neutral-400" />
                Unitário: <strong>{formatCurrencyBRL(precoUnitario)}</strong>
              </span>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchCat}
                onChange={(e) => setSearchCat(e.target.value)}
                placeholder="Filtrar produto no catálogo..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto p-1 border border-neutral-200/80 rounded-xl bg-neutral-50/50">
              {produtosFiltrados.map((op) => {
                const isSelected = item === op.nome;
                return (
                  <button
                    key={op.nome}
                    type="button"
                    onClick={() => handleSelectProduto(op.nome, op.preco)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-2xs'
                        : 'bg-white text-neutral-700 border-neutral-200/80 hover:bg-blue-50/50 hover:border-blue-200'
                    }`}
                  >
                    <span className="truncate pr-2">{op.nome}</span>
                    <span
                      className={`font-mono-tabular font-semibold shrink-0 ${
                        isSelected ? 'text-blue-100' : 'text-neutral-900'
                      }`}
                    >
                      {formatCurrencyBRL(op.preco)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data e Hora */}
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
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
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
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Quantidade, Valor Total (Bloqueado) & Responsável */}
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
                className="w-full px-3 py-2 text-xs font-mono-tabular font-semibold bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
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
                placeholder="Nome do operador..."
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Observações (Opcional) */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder='Ex: "Autorizado pela gerência", "Troca de bebida"...'
              className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
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
