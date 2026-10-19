import React, { useState, useEffect } from 'react';
import { X, AlertCircle, GlassWater, DollarSign, Clock, Calendar, User } from 'lucide-react';
import { VendaAeB } from '../types/venda';
import { AeBAutocomplete } from './AeBAutocomplete';
import { buscarProdutoNoCatalogo } from '../data/catalogoAeB';

interface EditAeBSaleModalProps {
  isOpen: boolean;
  venda: VendaAeB | null;
  onClose: () => void;
  onSaveVenda: (venda: VendaAeB) => void;
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
  const [preco, setPreco] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && venda) {
      setData(venda.data || '');
      setHora(venda.hora || '');
      setItem(venda.item || '');
      setPreco(venda.preco.toFixed(2).replace('.', ','));
      setResponsavel(venda.responsavel || '');
      setError('');
    }
  }, [isOpen, venda]);

  if (!isOpen || !venda) return null;

  const handleItemChange = (novoItem: string, precoSugerido?: number) => {
    setItem(novoItem);
    setError('');

    if (precoSugerido !== undefined) {
      setPreco(precoSugerido.toFixed(2).replace('.', ','));
    } else {
      const prodCatalogo = buscarProdutoNoCatalogo(novoItem);
      if (prodCatalogo) {
        setPreco(prodCatalogo.preco.toFixed(2).replace('.', ','));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!item.trim()) {
      setError('Por favor, informe a descrição do item de bebida.');
      return;
    }

    const numPreco = parseFloat(preco.replace(',', '.'));
    if (isNaN(numPreco) || numPreco <= 0) {
      setError('Por favor, informe um valor de preço válido maior que zero.');
      return;
    }

    const atualizada: VendaAeB = {
      ...venda,
      data: data.trim() || venda.data,
      hora: hora.trim() || venda.hora,
      item: item.trim(),
      preco: numPreco,
      responsavel: responsavel.trim(),
    };

    onSaveVenda(atualizada);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div
        className="bg-white rounded-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-md border border-neutral-200 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <GlassWater className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Editar Venda · Alimentos e Bebidas (AeB) #{venda.comanda || venda.id}
              </h3>
              <p className="text-xs text-neutral-500">
                Corrija o item, preço, data ou responsável da venda de alimentos e bebidas
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-700">
                Item / Alimentos e Bebidas *
              </label>
              <span className="text-[11px] text-blue-600 font-medium">
                Catálogo Volux
              </span>
            </div>

            <AeBAutocomplete
              value={item}
              onChange={handleItemChange}
              placeholder="Buscar no catálogo ou digitar novo nome..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-aeb-preco" className="text-xs font-semibold text-neutral-700">
                  Preço Total (R$) *
                </label>
                <span className="text-[10px] text-neutral-400">Editável</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
                <input
                  id="edit-aeb-preco"
                  type="text"
                  required
                  value={preco}
                  onChange={(e) => {
                    setPreco(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-aeb-responsavel" className="block text-xs font-semibold text-neutral-700 mb-1">
                Responsável
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  id="edit-aeb-responsavel"
                  type="text"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="ex: Carlos Lima"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Data (DD/MM)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Hora (HH:MM)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>
          </div>

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
