import React from 'react';
import {
  CircleDot,
  Ticket,
  GlassWater,
  User,
  Clock,
  Calendar,
  FileSearch,
  Pencil,
  Trash2,
  Ban,
  Gift,
  Wrench,
  CalendarRange,
  MessageSquareText,
} from 'lucide-react';
import { VendaComanda } from '../types/venda';
import {
  formatCurrencyBRL,
  isRegistroCortesia,
  isRegistroManutencao,
  isRegistroConta3000,
  getContaAdmCode,
  isRegistroVoucher,
  getValorMonetarioEfetivo,
  getValorNaoMonetarioVoucher,
} from '../utils/formatters';

interface SalesTableProps {
  vendas: VendaComanda[];
  totalDatabaseCount?: number;
  onExpandAllDates?: () => void;
  onUpdateResponsavel: (id: string, responsavel: string) => void;
  onUpdateObservacao: (id: string, observacao: string) => void;
  onEditVenda: (venda: VendaComanda) => void;
  onDeleteVenda: (id: string) => void;
}

export const SalesTable: React.FC<SalesTableProps> = ({
  vendas,
  totalDatabaseCount = 0,
  onExpandAllDates,
  onUpdateResponsavel,
  onUpdateObservacao,
  onEditVenda,
  onDeleteVenda,
}) => {
  if (vendas.length === 0) {
    return (
      <div className="bg-white rounded-b-xl border border-neutral-200/80 p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-3">
          <FileSearch className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-900">
          Nenhuma comanda encontrada no período ou filtro selecionado
        </h3>
        <p className="mt-1 text-xs text-neutral-500 max-w-md mx-auto">
          Ajuste o período de datas (Data Inicial / Data Final), o filtro de categoria/item acima ou
          importe um novo relatório PDF do Volux.
        </p>
        {totalDatabaseCount > 0 && onExpandAllDates && (
          <div className="mt-4">
            <button
              type="button"
              onClick={onExpandAllDates}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
            >
              <CalendarRange className="w-4 h-4 text-neutral-600" />
              <span>
                Exibir todas as datas ({totalDatabaseCount} comandas salvas no banco)
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Soma apenas o valor monetário efetivo em caixa (Vouchers não somam no caixa monetário)
  const totalExibido = vendas
    .filter((v) => !v.cancelado && v.status !== 'Cancelado')
    .reduce((sum, item) => sum + getValorMonetarioEfetivo(item), 0);

  return (
    <div className="bg-white rounded-b-xl border border-neutral-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200/80 bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <th className="py-3 px-3 w-24">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Data</span>
                </div>
              </th>
              <th className="py-3 px-3 w-24">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Hora</span>
                </div>
              </th>
              <th className="py-3 px-4 w-44">Tipo de Venda</th>
              <th className="py-3 px-4 min-w-[260px]">Item</th>
              <th className="py-3 px-3 w-20 text-center">Qtde</th>
              <th className="py-3 px-4 w-36 text-right">Preço</th>
              <th className="py-3 px-4 w-52">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Responsável</span>
                </div>
              </th>
              <th className="py-3 px-4 w-56">
                <div className="flex items-center gap-1.5">
                  <MessageSquareText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Observação</span>
                </div>
              </th>
              <th className="py-3 px-4 w-24 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/60 text-sm">
            {vendas.map((venda, index) => {
              const isBoliche = venda.tipo_venda === 'Boliche';
              const isAeB = venda.tipo_venda === 'AeB';
              const isCancelado = Boolean(venda.cancelado || venda.status === 'Cancelado');
              const contaAdmCode = getContaAdmCode(venda);
              const isConta3000 = isRegistroConta3000(venda);
              const isVoucher = isRegistroVoucher(venda);
              const isCortesia = isRegistroCortesia(venda);
              const isManutencao = isRegistroManutencao(venda);
              const hasResponsavel =
                venda.responsavel && venda.responsavel.trim().length > 0;
              const hasObservacao =
                venda.observacao && venda.observacao.trim().length > 0;
              const numeroComandaExibicao = venda.comanda || venda.id;
              const qtdeExibicao = Math.max(1, Number(venda.qtde) || 1);
              const valorEfetivo = getValorMonetarioEfetivo(venda);
              const valorVoucherRef = isVoucher ? getValorNaoMonetarioVoucher(venda) : 0;

              return (
                <tr
                  key={`${venda.id}-${index}`}
                  className={`transition-colors group ${
                    isCancelado
                      ? 'bg-red-50/40 hover:bg-red-50/70 opacity-75'
                      : isVoucher
                      ? 'bg-purple-50/35 hover:bg-purple-50/60'
                      : isCortesia
                      ? 'bg-amber-50/35 hover:bg-amber-50/60'
                      : isManutencao
                      ? 'bg-cyan-50/35 hover:bg-cyan-50/60'
                      : 'hover:bg-neutral-50/90'
                  }`}
                >
                  {/* Data */}
                  <td
                    className={`py-3 px-3 font-mono-tabular text-xs whitespace-nowrap ${
                      isCancelado ? 'text-red-600/80 line-through' : 'text-neutral-600'
                    }`}
                  >
                    {venda.data}
                  </td>

                  {/* Hora */}
                  <td
                    className={`py-3 px-3 font-mono-tabular text-xs whitespace-nowrap ${
                      isCancelado ? 'text-red-600/80 line-through' : 'text-neutral-600'
                    }`}
                  >
                    {venda.hora}
                  </td>

                  {/* Tipo de Venda (Badge) */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isBoliche ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70 ${
                            isCancelado ? 'opacity-60 line-through' : ''
                          }`}
                        >
                          <CircleDot className="w-3 h-3 text-indigo-600" />
                          Boliche
                        </span>
                      ) : isAeB ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70 ${
                            isCancelado ? 'opacity-60 line-through' : ''
                          }`}
                        >
                          <GlassWater className="w-3 h-3 text-blue-600" />
                          AeB
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/70 ${
                            isCancelado ? 'opacity-60 line-through' : ''
                          }`}
                        >
                          <Ticket className="w-3 h-3 text-amber-600" />
                          Fichas
                        </span>
                      )}

                      {isCortesia && !isConta3000 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                          <Gift className="w-3 h-3 text-amber-700" />
                          Cortesia
                        </span>
                      )}

                      {isManutencao && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-300">
                          <Wrench className="w-3 h-3 text-cyan-700" />
                          Manutenção
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Item + Micro-Badges na Mesma Linha */}
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2 flex-nowrap">
                      <span
                        title={`Comanda / ID Interno: #${numeroComandaExibicao}`}
                        className={`whitespace-nowrap ${
                          isCancelado
                            ? 'text-red-700/80 line-through'
                            : 'text-neutral-900'
                        }`}
                      >
                        {venda.item}
                      </span>

                      {venda.faltouNoManual && !isCancelado && (
                        <span
                          title="Faltou no manual, adicionado via PDF"
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-900 border border-amber-300"
                        >
                          ⚠️ Só PDF
                        </span>
                      )}

                      {venda.sobraNoManual && !venda.conciliado && !isCancelado && (
                        <span
                          title="Este item foi lançado manualmente, mas não consta na comanda oficial do PDF Volux"
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-900 border border-rose-300"
                        >
                          ❗ Só Manual (Fora do PDF)
                        </span>
                      )}

                      {contaAdmCode && !isCancelado && (
                        <span
                          title={`Conta ${contaAdmCode} (ADM = S / Cortesia Volux)`}
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300"
                        >
                          ADM {contaAdmCode}
                        </span>
                      )}

                      {isVoucher && !isCancelado && (
                        <span
                          title="Pago com Voucher (Não soma no caixa em dinheiro, abate ficha física normalmente)"
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-900 border border-purple-300"
                        >
                          🎟️ Voucher
                        </span>
                      )}

                      {venda.conciliado && venda.origem === 'MANUAL' && !venda.faltouNoManual && !isCancelado && (
                        <span
                          title="Lançamento manual conciliado 1 para 1 com o relatório PDF do Volux"
                          className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          ✓ Conciliado
                        </span>
                      )}

                      {isCancelado && (
                        <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 inline-flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Cancelado
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Qtde */}
                  <td className="py-3 px-3 text-center font-mono-tabular text-xs font-bold whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md border ${
                        isCancelado
                          ? 'bg-red-50 text-red-600 border-red-200 line-through'
                          : qtdeExibicao > 1
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-200/80'
                      }`}
                    >
                      {qtdeExibicao}x
                    </span>
                  </td>

                  {/* Preço */}
                  <td className="py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap">
                    {isCancelado ? (
                      <span className="text-red-600 line-through">
                        {formatCurrencyBRL(0)}
                      </span>
                    ) : isVoucher ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-purple-800 font-bold">
                          {formatCurrencyBRL(0)}
                        </span>
                        <span className="text-[10px] font-medium text-purple-600">
                          (Voucher {formatCurrencyBRL(valorVoucherRef)})
                        </span>
                      </div>
                    ) : isCortesia ? (
                      <span className="text-amber-800">
                        {formatCurrencyBRL(valorEfetivo)}
                      </span>
                    ) : isManutencao ? (
                      <span className="text-cyan-700">
                        {formatCurrencyBRL(0)}
                      </span>
                    ) : (
                      <span className="text-neutral-900">
                        {formatCurrencyBRL(valorEfetivo)}
                      </span>
                    )}
                  </td>

                  {/* Responsável pela Venda (Input Editável em Tempo Real) */}
                  <td className="py-2.5 px-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={venda.responsavel}
                        onChange={(e) =>
                          onUpdateResponsavel(venda.id, e.target.value)
                        }
                        placeholder="Nome do caixa..."
                        aria-label={`Responsável pela comanda ${numeroComandaExibicao}`}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                          hasResponsavel
                            ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950 font-medium focus:bg-white focus:ring-emerald-500/20 focus:border-emerald-500'
                            : 'bg-neutral-50/70 border-neutral-200 text-neutral-800 placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:ring-neutral-900/10 focus:border-neutral-400'
                        }`}
                      />
                      {hasResponsavel && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          title="Salvo automaticamente"
                        />
                      )}
                    </div>
                  </td>

                  {/* Observação (Input Editável em Tempo Real) */}
                  <td className="py-2.5 px-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={venda.observacao || ''}
                        onChange={(e) =>
                          onUpdateObservacao(venda.id, e.target.value)
                        }
                        placeholder="Adicionar observação..."
                        aria-label={`Observação da comanda ${numeroComandaExibicao}`}
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                          hasObservacao
                            ? 'bg-amber-50/60 border-amber-200/90 text-amber-950 font-medium focus:bg-white focus:ring-amber-500/20 focus:border-amber-500'
                            : 'bg-neutral-50/70 border-neutral-200 text-neutral-800 placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:ring-neutral-900/10 focus:border-neutral-400'
                        }`}
                      />
                      {hasObservacao && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          title="Observação salva"
                        />
                      )}
                    </div>
                  </td>

                  {/* Coluna de Ações (Editar e Excluir) */}
                  <td className="py-2.5 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditVenda(venda)}
                        title={`Editar item (#${numeroComandaExibicao})`}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteVenda(venda.id)}
                        title={`Excluir item (#${numeroComandaExibicao})`}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Table Footer Summary */}
          <tfoot>
            <tr className="bg-neutral-50/90 border-t border-neutral-200/80 text-xs font-semibold text-neutral-700">
              <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-neutral-500">
                Subtotal Efetivo em Caixa ({vendas.length} {vendas.length === 1 ? 'registro' : 'registros'}):
              </td>
              <td className="py-3 px-4 text-right font-mono-tabular text-sm font-bold text-neutral-900">
                {formatCurrencyBRL(totalExibido)}
              </td>
              <td colSpan={3} className="py-3 px-4 text-neutral-400 font-normal">
                Salvo instantaneamente no LocalStorage
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
