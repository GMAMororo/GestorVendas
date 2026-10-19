import React, { useState, useEffect } from 'react';
import { X, AlertCircle, GlassWater, DollarSign, Clock, Calendar, User } from 'lucide-react';
import { VendaAeB } from '../types/venda';
import { generateUniqueId } from '../utils/voluxParser';
import { AeBAutocomplete } from './AeBAutocomplete';
import { buscarProdutoNoCatalogo } from '../data/catalogoAeB';

interface NewAeBSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVenda: (venda: VendaAeB) => void;
}

export const NewAeBSaleModal: React.FC<NewAeBSaleModalProps> = ({
  isOpen,
  onClose,
  onAddVenda,
}) => {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [item, setItem] = useState('');
  const [preco, setPreco] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [error, setError] = useState('');

  // Ao abrir o modal: Data e Hora automáticas do momento do clique via new Date()
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dia = String(now.getDate()).padStart(2, '0');
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      const horas = String(now.getHours()).padStart(2, '0');
      const minutos = String(now.getMinutes()).padStart(2, '0');

      setData(`${dia}/${mes}`);
      setHora(`${horas}:${minutos}`);
      setItem('');
      setPreco(''); // O campo de preço deve estar inicialmente livre para digitação ou preenchimento automático
      setResponsavel('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Atualização do Item através do Autocomplete
  const handleItemChange = (novoItem: string, precoSugerido?: number) => {
    setItem(novoItem);
    setError('');

    if (precoSugerido !== undefined) {
      // Preenchimento Automático imediato com o valor correspondente do catálogo
      setPreco(precoSugerido.toFixed(2).replace('.', ','));
    } else {
      // Verifica se o texto digitado coincide com algum produto do catálogo
      const prodCatalogo = buscarProdutoNoCatalogo(novoItem);
      if (prodCatalogo) {
        setPreco(prodCatalogo.preco.toFixed(2).replace('.', ','));
      } else if (!novoItem.trim()) {
        // Se limpou o item, limpa o preço
        setPreco('');
      }
      // Se for item fora do catálogo digitado manualmente, o preço permanece livre/zerado para preenchimento manual
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!item.trim()) {
      setError('Por favor, informe ou selecione o item no catálogo.');
      return;
    }

    const numPreco = parseFloat(preco.replace(',', '.'));
    if (isNaN(numPreco) || numPreco <= 0) {
      setError('Por favor, informe um valor de preço válido maior que zero (ex: 9,90).');
      return;
    }

    // Gera identificador absolutamente único para a linha e código legível de comanda
    const randomSuffix = Math.floor(500 + Math.random() * 499);
    const comandaCode = `13.402.${randomSuffix}`;

    const novaVenda: VendaAeB = {
      id: generateUniqueId(),
      comanda: comandaCode,
      data: data.trim() || '05/10',
      hora: hora.trim() || '15:00',
      item: item.trim(),
      preco: numPreco,
      responsavel: responsavel.trim(),
    };

    onAddVenda(novaVenda);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div
        className="bg-white rounded-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-md border border-neutral-200 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <GlassWater className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Nova Venda · Alimentos e Bebidas (AeB)
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Catálogo Volux com Autocomplete e preenchimento automático de preço
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

          {/* Item com Autocomplete pesquisável do Catálogo Volux */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-700">
                Item / Descrição da Venda *
              </label>
              <span className="text-[11px] text-blue-600 font-medium">
                Catálogo Volux Integrado
              </span>
            </div>

            <AeBAutocomplete
              value={item}
              onChange={handleItemChange}
              placeholder="Digite para buscar alimento/bebida ou digite um novo item..."
              autoFocus
            />

            <p className="text-[11px] text-neutral-400 mt-1.5 flex items-center gap-1">
              <span>Dica:</span>
              <span>
                Ao escolher um item da lista, o preço é preenchido automaticamente e pode ser editado.
              </span>
            </p>
          </div>

          {/* Preço (Preenchimento Automático + Edição Livre) & Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="preco-aeb" className="text-xs font-semibold text-neutral-700">
                  Preço Total (R$) *
                </label>
                <span className="text-[10px] text-neutral-400">Editável (Descontos)</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
                <input
                  id="preco-aeb"
                  type="text"
                  required
                  value={preco}
                  onChange={(e) => {
                    setPreco(e.target.value);
                    setError('');
                  }}
                  placeholder="0,00"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="responsavel-aeb" className="block text-xs font-semibold text-neutral-700 mb-1">
                Responsável (Opcional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  id="responsavel-aeb"
                  type="text"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="ex: Carlos Lima"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>
          </div>

          {/* Data & Hora Automáticas (new Date) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Data (DD/MM)
                </label>
                <span className="text-[10px] text-neutral-400">Automático</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  placeholder="ex: 05/10"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Hora (HH:MM)
                </label>
                <span className="text-[10px] text-neutral-400">Automático</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  placeholder="ex: 15:30"
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
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
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <GlassWater className="w-3.5 h-3.5" />
              <span>Salvar Venda (AeB)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
