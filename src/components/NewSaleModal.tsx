import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CircleDot, Ticket } from 'lucide-react';
import { VendaComanda, TipoVenda } from '../types/venda';
import { generateUniqueId } from '../utils/voluxParser';

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVenda: (venda: VendaComanda) => void;
}

// Catálogo oficial com preços tabelados de referência
export const CATALOGO_OPCOES = {
  Boliche: [
    { nome: 'Meia Hora de Boliche', precoPadrao: 70.0 },
    { nome: 'Uma Hora de Boliche', precoPadrao: 120.0 },
  ],
  Fichas: [
    { nome: 'Fichas Eletronicas', precoPadrao: 12.0 },
    { nome: 'Mini Combo', precoPadrao: 65.0 },
    { nome: 'Big Combo', precoPadrao: 120.0 },
    { nome: 'Mega Combo', precoPadrao: 250.0 },
  ],
};

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onAddVenda,
}) => {
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [tipoVenda, setTipoVenda] = useState<TipoVenda>('Boliche');
  const [item, setItem] = useState('Meia Hora de Boliche');
  const [preco, setPreco] = useState('70.00');
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
      setTipoVenda('Boliche');
      setItem('Meia Hora de Boliche');
      setPreco('70.00');
      setResponsavel('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Quando o tipo de venda muda, atualiza as opções do dropdown e o preço tabelado inicial
  const handleTipoVendaChange = (novoTipo: TipoVenda) => {
    setTipoVenda(novoTipo);
    const primeiraOpcao = CATALOGO_OPCOES[novoTipo][0];
    setItem(primeiraOpcao.nome);
    setPreco(primeiraOpcao.precoPadrao.toFixed(2));
    setError('');
  };

  // Quando o item é selecionado via dropdown, preenche o preço automaticamente com o valor tabelado
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

    // Gera identificador absolutamente único para a linha e código legível de comanda
    const randomSuffix = Math.floor(400 + Math.random() * 599);
    const comandaCode = `13.402.${randomSuffix}`;

    const novaVenda: VendaComanda = {
      id: generateUniqueId(),
      comanda: comandaCode,
      data: data.trim() || '07/10',
      hora: hora.trim() || '15:00',
      tipo_venda: tipoVenda,
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
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Registrar Nova Venda
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Lançamento avulso com data, hora e itens do catálogo Volux
            </p>
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
            <label htmlFor="select-item" className="block text-xs font-semibold text-neutral-700 mb-1">
              Item / Descrição (Catálogo {tipoVenda}) *
            </label>
            <div className="relative">
              <select
                id="select-item"
                value={item}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 appearance-none focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 cursor-pointer font-medium"
              >
                {CATALOGO_OPCOES[tipoVenda].map((opt) => (
                  <option key={opt.nome} value={opt.nome}>
                    {opt.nome} — R$ {opt.precoPadrao.toFixed(2).replace('.', ',')}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Preço Automático (Tabelado, mas editável para descontos) & Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Preço (R$) *
                </label>
                <span className="text-[10px] text-neutral-400">Editável (descontos)</span>
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
                Responsável (Opcional)
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

          {/* Data & Hora preenchidas automaticamente pelo momento atual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Data (DD/MM)
                </label>
                <span className="text-[10px] text-neutral-400">Automático</span>
              </div>
              <input
                type="text"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="ex: 07/10"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 font-mono-tabular focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700">
                  Hora (HH:MM)
                </label>
                <span className="text-[10px] text-neutral-400">Automático</span>
              </div>
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
              Salvar Venda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
