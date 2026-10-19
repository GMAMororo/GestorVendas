import React from 'react';
import { DollarSign, Ticket, CircleDot, TrendingUp, Users } from 'lucide-react';
import { VendaComanda } from '../types/venda';
import { formatCurrencyBRL } from '../utils/formatters';

interface SummaryCardsProps {
  filteredVendas: VendaComanda[];
  totalVendasCount: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  filteredVendas,
  totalVendasCount,
}) => {
  // Calculations based strictly on currently filtered items (garantindo exclusão de cancelados)
  const vendasValidas = filteredVendas.filter((v) => !v.cancelado);
  const totalArrecadado = vendasValidas.reduce((acc, curr) => acc + curr.preco, 0);

  const vendasBoliche = vendasValidas.filter((v) => v.tipo_venda === 'Boliche');
  const totalBoliche = vendasBoliche.reduce((acc, curr) => acc + curr.preco, 0);

  const vendasFichas = vendasValidas.filter((v) => v.tipo_venda === 'Fichas');
  const totalFichas = vendasFichas.reduce((acc, curr) => acc + curr.preco, 0);

  const pendentesResponsavel = filteredVendas.filter(
    (v) => !v.responsavel || v.responsavel.trim() === ''
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Card 1: Total Arrecadado */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-neutral-300 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Total Arrecadado
          </span>
          <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {formatCurrencyBRL(totalArrecadado)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-medium text-neutral-700 font-mono-tabular">
              {filteredVendas.length}
            </span>
            <span>{filteredVendas.length === 1 ? 'comanda filtrada' : 'comandas filtradas'}</span>
            {filteredVendas.length !== totalVendasCount && (
              <span className="text-neutral-400">
                (de {totalVendasCount} no total)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card 2: Total de Vendas de Boliche */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-blue-200 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            Total Boliche
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <CircleDot className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {formatCurrencyBRL(totalBoliche)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-medium text-blue-700 font-mono-tabular">
              {vendasBoliche.length}
            </span>
            <span>{vendasBoliche.length === 1 ? 'locação / item' : 'locações / itens'}</span>
            {totalArrecadado > 0 && (
              <span className="text-neutral-400 font-mono-tabular">
                · {((totalBoliche / totalArrecadado) * 100).toFixed(0)}% do valor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card 3: Total de Fichas */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-emerald-200 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Total Fichas
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Ticket className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl font-semibold text-neutral-900 font-mono-tabular tracking-tight">
            {formatCurrencyBRL(totalFichas)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-medium text-emerald-700 font-mono-tabular">
              {vendasFichas.length}
            </span>
            <span>{vendasFichas.length === 1 ? 'venda registrada' : 'vendas registradas'}</span>
            {totalArrecadado > 0 && (
              <span className="text-neutral-400 font-mono-tabular">
                · {((totalFichas / totalArrecadado) * 100).toFixed(0)}% do valor
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
