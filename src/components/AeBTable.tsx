import React from 'react';
import {
  UtensilsCrossed,
  Trash2,
  User,
  Clock,
  Calendar,
  Inbox,
  Pencil,
  Ban,
  Gift,
  CalendarRange,
} from 'lucide-react';
import { VendaAeB } from '../types/venda';
import {
  formatCurrencyBRL,
  isRegistroCortesia,
  isRegistroConta3000,
  getContaAdmCode,
  isRegistroVoucher,
  getValorMonetarioEfetivo,
} from '../utils/formatters';

interface AeBTableProps {
  vendas: VendaAeB[];
  totalDatabaseCount?: number;
  onExpandAllDates?: () => void;
  onResponsavelChange: (id: string, novoResponsavel: string) => void;
  onEditVenda: (venda: VendaAeB) => void;
  onDeleteVenda: (id: string) => void;
}

export const AeBTable: React.FC<AeBTableProps> = ({
  vendas,
  totalDatabaseCount = 0,
  onExpandAllDates,
  onResponsavelChange,
  onEditVenda,
  onDeleteVenda,
}) => {
  if (vendas.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-12 text-center shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <Inbox className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">
          Nenhuma comanda de Alimentos e Bebidas encontrada
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Importe um relatório PDF de AeB do sistema Volux, ajuste o período de datas acima ou
          registre uma venda manual pelo Catálogo Oficial.
        </p>
        {totalDatabaseCount > 0 && onExpandAllDates && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onExpandAllDates}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/40 transition-colors cursor-pointer"
            >
              <CalendarRange className="w-4 h-4" />
              <span>
                Exibir todas as datas ({totalDatabaseCount} registros AeB no banco)
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const totalAtivasPagas = vendas
    .filter((v) => !v.cancelado && v.status !== 'Cancelado')
    .reduce((acc, curr) => acc + getValorMonetarioEfetivo(curr), 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-3.5 px-3">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Data</span>
                </div>
              </th>
              <th className="py-3.5 px-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hora</span>
                </div>
              </th>
              <th className="py-3.5 px-4">Item (Produto AeB)</th>
              <th className="py-3.5 px-4 text-right">Preço Unit.</th>
              <th className="py-3.5 px-4 min-w-[210px]">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-orange-400" />
                  <span>Garçom / Responsável</span>
                </div>
              </th>
              <th className="py-3.5 px-4 text-center w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {vendas.map((venda, idx) => {
              const numeroComandaExibicao = venda.comanda || venda.id;
              const isCancelado = Boolean(venda.cancelado || venda.status === 'Cancelado');
              const isCortesia = isRegistroCortesia(venda);
              const contaAdmCode = getContaAdmCode(venda);
              const isConta3000 = isRegistroConta3000(venda);
              const isVoucher = isRegistroVoucher(venda);
              const valorEfetivo = getValorMonetarioEfetivo(venda);

              return (
                <tr
                  key={`${venda.id}-${idx}`}
                  className={`transition-colors group ${
                    isCancelado
                      ? 'bg-rose-950/20 hover:bg-rose-950/30 opacity-65'
                      : isCortesia
                      ? 'bg-amber-950/10 hover:bg-amber-950/20'
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  {/* Data */}
                  <td
                    className={`py-3 px-3 text-xs whitespace-nowrap ${
                      isCancelado ? 'text-rose-300/70 line-through' : 'text-slate-300'
                    }`}
                  >
                    {venda.data}
                  </td>

                  {/* Hora */}
                  <td
                    className={`py-3 px-3 text-xs font-mono whitespace-nowrap ${
                      isCancelado ? 'text-rose-300/70 line-through' : 'text-slate-400'
                    }`}
                  >
                    {venda.hora}
                  </td>

                  {/* Item (Produto AeB) + Micro-badges */}
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2 flex-nowrap">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-400 shrink-0 ${
                          isCancelado ? 'opacity-60' : ''
                        }`}
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                      </span>
                      <span
                        title={`Comanda / ID Interno: #${numeroComandaExibicao}`}
                        className={`whitespace-nowrap ${
                          isCancelado ? 'text-rose-300/80 line-through' : 'text-slate-200'
                        }`}
                      >
                        {venda.item}
                      </span>
                      {venda.faltouNoManual && !isCancelado && (
                        <span
                          title="Faltou no manual, adicionado via PDF"
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/40"
                        >
                          ⚠️ Só PDF
                        </span>
                      )}
                      {contaAdmCode && !isCancelado && (
                        <span
                          title={`Conta ${contaAdmCode} (ADM = S)`}
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40"
                        >
                          ADM {contaAdmCode}
                        </span>
                      )}
                      {isVoucher && !isCancelado && (
                        <span
                          title="Pago com Voucher"
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/40"
                        >
                          🎟️ Voucher
                        </span>
                      )}
                      {isCortesia && !isConta3000 && (
                        <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          Cortesia
                        </span>
                      )}
                      {isCancelado && (
                        <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Cancelado
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Preço */}
                  <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">
                    {isCancelado ? (
                      <span className="text-rose-400 line-through">
                        {formatCurrencyBRL(0)}
                      </span>
                    ) : isCortesia ? (
                      <span className="text-amber-300 font-mono">
                        {formatCurrencyBRL(valorEfetivo)}
                      </span>
                    ) : (
                      <span className="text-emerald-400">
                        {formatCurrencyBRL(valorEfetivo)}
                      </span>
                    )}
                  </td>

                  {/* Responsável Input */}
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      value={venda.responsavel}
                      onChange={(e) => onResponsavelChange(venda.id, e.target.value)}
                      placeholder="Digitar nome do garçom/caixa..."
                      className={`w-full text-xs rounded-lg px-3 py-1.5 border transition-all focus:outline-none ${
                        venda.responsavel.trim()
                          ? 'bg-slate-950/90 border-slate-700/80 text-white font-medium focus:border-orange-500'
                          : 'bg-slate-950/40 border-dashed border-slate-800 text-slate-400 placeholder-slate-600 focus:border-orange-500/60 focus:bg-slate-950'
                      }`}
                    />
                  </td>

                  {/* Ações: Editar e Excluir */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEditVenda(venda)}
                        title="Editar venda AeB"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteVenda(venda.id)}
                        title="Remover registro AeB"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-950/90 border-t border-slate-800 text-xs font-semibold text-slate-300">
              <td colSpan={3} className="py-3.5 px-4 text-right uppercase tracking-wider text-slate-400">
                Total Faturado AeB ({vendas.length} itens exibidos):
              </td>
              <td className="py-3.5 px-4 text-right text-sm font-bold text-emerald-400 whitespace-nowrap">
                {formatCurrencyBRL(totalAtivasPagas)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
