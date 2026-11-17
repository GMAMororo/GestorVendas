import React from 'react';
import {
  DollarSign,
  CircleDot,
  Ticket,
  GlassWater,
  Gift,
  Wrench,
} from 'lucide-react';
import { VendaComanda, VendaAeB } from '../types/venda';
import {
  formatCurrencyBRL,
  isRegistroCortesia,
  isRegistroManutencao,
  isRegistroVoucher,
  getValorMonetarioEfetivo,
  getValorNaoMonetarioVoucher,
} from '../utils/formatters';

interface SummaryCardsProps {
  filteredVendas: VendaComanda[];
  filteredVendasAeB?: VendaAeB[];
  totalVendasCount: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  filteredVendas,
  filteredVendasAeB = [],
  totalVendasCount,
}) => {
  // Ignora comandas canceladas/estornadas
  const vendasAtivas = filteredVendas.filter(
    (v) => !v.cancelado && v.status !== 'Cancelado'
  );
  const vendasAeBAtivas = filteredVendasAeB.filter(
    (v) => !v.cancelado && v.status !== 'Cancelado'
  );

  // Separa por categoria
  const bolicheAtivas = vendasAtivas.filter((v) => v.tipo_venda === 'Boliche');
  const fichasAtivas = vendasAtivas.filter((v) => v.tipo_venda === 'Fichas');

  // Combina vendas AeB vindas da coleção comandas_aeb e eventuais registros AeB em vendasAtivas (sem duplicar ID)
  const aebIdsFromComandas = new Set(
    vendasAtivas.filter((v) => v.tipo_venda === 'AeB').map((v) => v.id)
  );
  const aebCombinadas: Array<Partial<VendaComanda & VendaAeB> & { item: string; preco: number }> = [
    ...vendasAtivas.filter((v) => v.tipo_venda === 'AeB'),
    ...vendasAeBAtivas.filter((v) => !aebIdsFromComandas.has(v.id)),
  ];

  // Faturamento Real Efetivo em Caixa: Vouchers NÃO entram no Total Arrecadado em Dinheiro/Caixa
  const totalBoliche = bolicheAtivas.reduce(
    (sum, item) => sum + getValorMonetarioEfetivo(item),
    0
  );

  const totalFichas = fichasAtivas.reduce(
    (sum, item) => sum + getValorMonetarioEfetivo(item),
    0
  );

  const totalAeB = aebCombinadas.reduce(
    (sum, item) => sum + getValorMonetarioEfetivo(item),
    0
  );

  const totalArrecadado = totalBoliche + totalFichas + totalAeB;

  // Contadores de Vouchers (Qtd e Valor Não Monetário)
  const sumUnidades = (arr: Array<{ qtde?: number }>) =>
    arr.reduce((acc, item) => acc + Math.max(1, Number(item.qtde) || 1), 0);

  const vouchersBolicheList = bolicheAtivas.filter((v) => isRegistroVoucher(v));
  const vouchersAeBList = aebCombinadas.filter((v) => isRegistroVoucher(v));

  const vouchersBolicheQtd = sumUnidades(vouchersBolicheList);
  const vouchersBolicheValor = vouchersBolicheList.reduce(
    (acc, v) => acc + getValorNaoMonetarioVoucher(v),
    0
  );

  const vouchersAeBQtd = sumUnidades(vouchersAeBList);
  const vouchersAeBValor = vouchersAeBList.reduce(
    (acc, v) => acc + getValorNaoMonetarioVoucher(v),
    0
  );

  const totalVouchersQtd = vouchersBolicheQtd + vouchersAeBQtd;
  const totalVouchersValor = vouchersBolicheValor + vouchersAeBValor;

  // Contadores de Cortesias e Manutenções (multiplicados por venda.qtde)
  const cortesiasBoliche = sumUnidades(
    bolicheAtivas.filter((v) => isRegistroCortesia(v))
  );
  const cortesiasFichas = sumUnidades(
    fichasAtivas.filter((v) => isRegistroCortesia(v))
  );
  const manutencoesFichas = sumUnidades(
    fichasAtivas.filter((v) => isRegistroManutencao(v))
  );

  // Contadores de itens vendidos multiplicados pela propriedade qtde de cada linha (Voucher CONTA normalmente nos itens vendidos!)
  const countBolichePagos = sumUnidades(
    bolicheAtivas.filter(
      (v) =>
        getValorMonetarioEfetivo(v) > 0 ||
        isRegistroVoucher(v) ||
        (!isRegistroCortesia(v) && !isRegistroManutencao(v))
    )
  );
  const countFichasPagos = sumUnidades(
    fichasAtivas.filter(
      (v) =>
        getValorMonetarioEfetivo(v) > 0 ||
        (!isRegistroCortesia(v) && !isRegistroManutencao(v))
    )
  );
  const countAeBPagos = sumUnidades(
    aebCombinadas.filter(
      (v) =>
        getValorMonetarioEfetivo(v) > 0 ||
        isRegistroVoucher(v) ||
        (!isRegistroCortesia(v) && !isRegistroManutencao(v))
    )
  );

  const bolichePercentage =
    totalArrecadado > 0 ? Math.round((totalBoliche / totalArrecadado) * 100) : 0;
  const fichasPercentage =
    totalArrecadado > 0 ? Math.round((totalFichas / totalArrecadado) * 100) : 0;
  const aebPercentage =
    totalArrecadado > 0 ? Math.round((totalAeB / totalArrecadado) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Arrecadado (Faturamento Monetário em Caixa) */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Total Arrecadado (Caixa)
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900 font-mono-tabular tracking-tight">
              {formatCurrencyBRL(totalArrecadado)}
            </h2>
            <p className="mt-1.5 text-xs text-neutral-500 font-medium">
              Cortesias: {cortesiasBoliche + cortesiasFichas} | Manutenção:{' '}
              {manutencoesFichas}
            </p>
            <p className="mt-1 text-xs font-semibold text-purple-700">
              🎟️ Vouchers: {totalVouchersQtd} un. ({formatCurrencyBRL(totalVouchersValor)} não monetário)
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Exibindo{' '}
            <strong className="text-neutral-800 font-semibold">
              {filteredVendas.length}
            </strong>{' '}
            de {totalVendasCount} comandas
          </span>
          <span className="font-mono-tabular text-emerald-700 font-medium">100%</span>
        </div>
      </div>

      {/* Card 2: Total em Boliche */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total em Boliche
              </p>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900 font-mono-tabular tracking-tight">
              {formatCurrencyBRL(totalBoliche)}
            </h2>
            <p className="mt-1.5 text-xs font-semibold text-amber-700 flex items-center gap-1">
              <span>🎁 Cortesias: {cortesiasBoliche}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-purple-700">
              🎟️ Vouchers: {vouchersBolicheQtd} un. ({formatCurrencyBRL(vouchersBolicheValor)} não monetário)
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-700 shrink-0">
            <CircleDot className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>
            <strong className="text-neutral-800 font-semibold">{countBolichePagos}</strong>{' '}
            {countBolichePagos === 1 ? 'pista registrada' : 'pistas registradas'}
          </span>
          <span className="font-mono-tabular text-indigo-700 font-medium">
            {bolichePercentage}% do total
          </span>
        </div>
      </div>

      {/* Card 3: Total em Fichas */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total em Fichas
              </p>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900 font-mono-tabular tracking-tight">
              {formatCurrencyBRL(totalFichas)}
            </h2>
            <p className="mt-1.5 text-xs font-semibold text-neutral-600 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Cortesias: {cortesiasFichas}
              </span>
              <span className="text-neutral-300">|</span>
              <span className="inline-flex items-center gap-1 text-cyan-700">
                <Wrench className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                Manutenção: {manutencoesFichas}
              </span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 shrink-0">
            <Ticket className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>
            <strong className="text-neutral-800 font-semibold">{countFichasPagos}</strong>{' '}
            {countFichasPagos === 1 ? 'venda registrada' : 'vendas registradas'}
          </span>
          <span className="font-mono-tabular text-amber-700 font-medium">
            {fichasPercentage}% do total
          </span>
        </div>
      </div>

      {/* Card 4: Total em AeB */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total em AeB
              </p>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-neutral-900 font-mono-tabular tracking-tight">
              {formatCurrencyBRL(totalAeB)}
            </h2>
            <p className="mt-1.5 text-xs font-semibold text-purple-700">
              🎟️ Vouchers: {vouchersAeBQtd} un. ({formatCurrencyBRL(vouchersAeBValor)} não monetário)
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700 shrink-0">
            <GlassWater className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
          <span>
            <strong className="text-neutral-800 font-semibold">{countAeBPagos}</strong>{' '}
            {countAeBPagos === 1 ? 'item vendido' : 'itens vendidos'}
          </span>
          <span className="font-mono-tabular text-blue-700 font-medium">
            {aebPercentage}% do total
          </span>
        </div>
      </div>
    </div>
  );
};
