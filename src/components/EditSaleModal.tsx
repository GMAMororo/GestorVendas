import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CircleDot, Ticket, Edit3 } from 'lucide-react';
import { VendaComanda, TipoVenda } from '../types/venda';
import { CATALOGO_OPCOES } from './NewSaleModal';

interface EditSaleModalProps {
  isOpen: boolean;
  venda: VendaComanda | null;
  onClose: () => void;
  onSaveVenda: (venda: VendaComanda) => void;
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
  const [item, setItem] = useState('');
  const [preco, setPreco] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [error, setError] = useState('');

  // Ao abrir com a venda selecionada, popula os campos exatamente com os valores atuais
  useEffect(() => {
    if (isOpen && venda) {
      setData(venda.data || '');
      setHora(venda.hora || '');
      setTipoVenda(venda.tipo_venda || 'Boliche');
      setItem(venda.item || '');
      setPreco(venda.preco.toFixed(2));
      setResponsavel(venda.responsavel || '');
      setError('');
    }
  }, [isOpen, venda]);

  if (!isOpen || !venda) return null;

  // Ao alternar o Tipo de Venda, atualiza o item para a primeira opção da categoria e sugere preço tabelado
  const handleTipoVendaChange = (novoTipo: TipoVenda) => {
    setTipoVenda(novoTipo);
    const primeiraOpcao = CATALOGO_OPCOES[novoTipo][0];
    setItem(primeiraOpcao.nome);
    setPreco(primeiraOpcao.precoPadrao.toFixed(2));
    setError('');
  };

  // Ao mudar de item pelo dropdown, atualiza com o preço de tabela daquele item
  const handleItemChange = (novoItem: string) => {
    setItem(novoItem);
    const itemEncontrado = CATALOGO_OPCOES[tipoVenda].find((opt) => opt.nome === novoItem);
    if (itemEncontrado) {
      setPreco(itemEncontrado.precoPadrao.toFixed(2));
    }
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numPreco = parseFloat(preco.replace(',', '.'));
    if (isNaN(numPreco) || numPreco <= 0) {
      setError('Por favor, informe um valor de preço válido maior que zero.');
      return;
    }

    const vendaAtualizada: VendaComanda = {
      ...venda,
      data: data.trim() || venda.data,
      hora: hora.trim() || venda.hora,
      tipo_venda: tipoVenda,
      item: item.trim(),
      preco: numPreco,
      responsavel: responsavel.trim(),
    };

    onSaveVenda(vendaAtualizada);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl max-w-lg w-full border border-neutral-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Editar Venda da Comanda #{venda.comanda || venda.id}
              </h3>
              <p className="text-xs text-neutral-500">
                Corrija itens, preços, horários ou operador responsável
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Tipo de Venda Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Tipo de Venda
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTipoVendaChange('Boliche')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  tipoVenda === 'Boliche'
                    ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5 text-blue-600" />
                <span>Boliche</span>
              </button>
              <button
                type="button"
                onClick={() => handleTipoVendaChange('Fichas')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  tipoVenda === 'Fichas'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fichas</span>
              </button>
            </div>
          </div>

          {/* Item Dropdown dinâmico conforme Tipo de Venda */}
          <div>
            <label htmlFor="edit-select-item" className="block text-xs font-semibold text-neutral-700 mb-1">
              Item / Descrição *
            </label>
            <div className="relative">
              <select
                id="edit-select-item"
                value={item}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 appearance-none focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 cursor-pointer font-medium"
              >
                {CATALOGO_OPCOES[tipoVenda].map((opt) => (
                  <option key={opt.nome} value={opt.nome}>
                    {opt.nome} — R$ {opt.precoPadrao.toFixed(2).replace('.', ',')}
                  </option>
                ))}
                {/* Se o item original não estava exatamente no catálogo, adiciona como opção preservada */}
                {!CATALOGO_OPCOES[tipoVenda].some((o) => o.nome === item) && (
                  <option value={item}>{item} (Personalizado)</option>
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Preço e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Preço (R$) *
                </label>
                <span className="text-[10px] text-neutral-400">Editável</span>
              </div>
              <input
                type="text"
                required
                value={preco}
                onChange={(e) => {
                  setPreco(e.target.value);
                  setError('');
                }}
                placeholder="ex: 70,00"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Responsável (Operador)
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="ex: Carlos Lima"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          </div>

          {/* Data & Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Data (DD/MM)
              </label>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="ex: 05/10"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Hora (HH:MM)
              </label>
              <input
                type="text"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                placeholder="ex: 15:30"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-neutral-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
