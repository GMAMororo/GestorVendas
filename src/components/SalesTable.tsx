import React, { useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  User,
  Trash2,
  Copy,
  CheckCheck,
  CircleDot,
  Ticket,
  Lock,
  Pencil,
} from 'lucide-react';
import { VendaComanda } from '../types/venda';
import { formatCurrencyBRL, compareDateTimeChronologically } from '../utils/formatters';

interface SalesTableProps {
  vendas: VendaComanda[];
  onUpdateResponsavel: (id: string, responsavel: string) => void;
  onEditVenda?: (venda: VendaComanda) => void;
  onDeleteVenda?: (id: string) => void;
}

type SortField = 'data_hora' | 'tipo_venda' | 'item' | 'preco' | 'responsavel';
type SortDirection = 'asc' | 'desc';

export const SalesTable: React.FC<SalesTableProps> = ({
  vendas,
  onUpdateResponsavel,
  onEditVenda,
  onDeleteVenda,
}) => {
  const [sortField, setSortField] = useState<SortField>('data_hora');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResponsavelChange = (id: string, value: string) => {
    onUpdateResponsavel(id, value);
    setSavedRowId(id);
    setTimeout(() => {
      setSavedRowId((current) => (current === id ? null : current));
    }, 1500);
  };

  // Sort rows based on active sorting
  const sortedVendas = [...vendas].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'data_hora': {
        comparison = compareDateTimeChronologically(a, b);
        break;
      }
      case 'tipo_venda':
        comparison = a.tipo_venda.localeCompare(b.tipo_venda);
        break;
      case 'item':
        comparison = a.item.localeCompare(b.item);
        break;
      case 'preco':
        comparison = a.preco - b.preco;
        break;
      case 'responsavel':
        comparison = (a.responsavel || '').localeCompare(b.responsavel || '');
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-neutral-900" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-neutral-900" />
    );
  };

  return (
    <div className="bg-white border border-neutral-200/90 rounded-b-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Empty State */}
      {sortedVendas.length === 0 ? (
        <div className="py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-100 mx-auto flex items-center justify-center text-neutral-400 mb-3">
            <User className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Nenhuma comanda registrada
          </h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
            Seu banco de dados local está vazio e pronto para uso real. Importe o relatório Volux (PDF) acima ou clique em <strong className="font-semibold text-neutral-700">Nova Venda</strong> para fazer lançamentos.
          </p>
        </div>
      ) : (
        <>
          {/* Tabela de Dados com Rolagem Horizontal para Mobile (overflow-x-auto) */}
          <div className="overflow-x-auto w-full scroll-smooth">
            <div className="md:hidden px-4 py-2 bg-neutral-50/90 border-b border-neutral-200/80 text-[11px] text-neutral-600 flex items-center justify-between">
              <span>👉 Deslize para o lado para ver todas as colunas</span>
              <span className="font-mono-tabular font-medium">{sortedVendas.length} itens</span>
            </div>
            <table className="w-full min-w-[760px] text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/75 text-xs font-semibold text-neutral-600 tracking-tight">
                  <th scope="col" className="py-3 px-4 w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleSort('data_hora')}
                      className="group inline-flex items-center gap-1.5 hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      <span>Data / Hora</span>
                      {renderSortIcon('data_hora')}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 w-[140px]">
                    <button
                      type="button"
                      onClick={() => handleSort('tipo_venda')}
                      className="group inline-flex items-center gap-1.5 hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      <span>Tipo de Venda</span>
                      {renderSortIcon('tipo_venda')}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 min-w-[220px]">
                    <button
                      type="button"
                      onClick={() => handleSort('item')}
                      className="group inline-flex items-center gap-1.5 hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      <span>Item / Descrição</span>
                      {renderSortIcon('item')}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 text-right w-[150px]">
                    <button
                      type="button"
                      onClick={() => handleSort('preco')}
                      title="Preço lido no relatório Volux (Imutável conforme Regra de Ouro)"
                      className="group inline-flex items-center gap-1.5 justify-end w-full hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      <Lock className="w-3 h-3 text-neutral-400" />
                      <span>Preço Volux</span>
                      {renderSortIcon('preco')}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 min-w-[240px]">
                    <button
                      type="button"
                      onClick={() => handleSort('responsavel')}
                      className="group inline-flex items-center gap-1.5 hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      <span>Responsável (Operador)</span>
                      {renderSortIcon('responsavel')}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4 text-right w-[150px]">
                    <span className="font-semibold text-neutral-600">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedVendas.map((venda) => {
                  const isBoliche = venda.tipo_venda === 'Boliche';
                  const isCancelado = Boolean(venda.cancelado || venda.status === 'Cancelado');
                  const hasResponsavel = venda.responsavel && venda.responsavel.trim().length > 0;
                  const justSaved = savedRowId === venda.id;
                  const precoExibido = isCancelado ? 0 : venda.preco;

                  return (
                    <tr
                      key={venda.id}
                      className={`transition-colors group ${
                        isCancelado
                          ? 'bg-red-50/25 hover:bg-red-50/40 opacity-75'
                          : 'hover:bg-neutral-50/80'
                      }`}
                    >
                      {/* Data & Hora */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                        <div className={`flex flex-col ${isCancelado ? 'line-through decoration-red-400/70 opacity-75' : ''}`}>
                          <span className="font-semibold text-neutral-900 font-mono-tabular text-xs">
                            {venda.data}
                          </span>
                          <span className="text-neutral-500 font-mono-tabular text-xs">
                            às {venda.hora}
                          </span>
                        </div>
                      </td>

                      {/* Tipo de Venda (Badge Colorido + Badge Cancelado no Volux) */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                        <div className="flex flex-col items-start gap-1">
                          {isBoliche ? (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 ${
                                isCancelado ? 'opacity-60 line-through' : ''
                              }`}
                            >
                              <CircleDot className="w-3 h-3 text-blue-500" />
                              Boliche
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${
                                isCancelado ? 'opacity-60 line-through' : ''
                              }`}
                            >
                              <Ticket className="w-3 h-3 text-emerald-500" />
                              Fichas
                            </span>
                          )}
                          {isCancelado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 shadow-2xs">
                              Cancelado no Volux
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Item & Comanda ID */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex flex-col">
                          <span
                            className={`font-medium ${
                              isCancelado
                                ? 'text-neutral-500 line-through decoration-red-500/80'
                                : 'text-neutral-900'
                            }`}
                          >
                            {venda.item}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono-tabular mt-0.5">
                            <span className={isCancelado ? 'line-through' : ''}>
                              Comanda #{venda.comanda || venda.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyId(venda.comanda || venda.id)}
                              title="Copiar código da comanda"
                              className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-700 transition-opacity p-0.5 cursor-pointer"
                            >
                              {copiedId === (venda.comanda || venda.id) ? (
                                <CheckCheck className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Preço */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right align-middle">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-semibold font-mono-tabular text-sm ${
                              isCancelado ? 'text-red-700' : 'text-neutral-900'
                            }`}
                          >
                            {formatCurrencyBRL(precoExibido)}
                          </span>
                          {isCancelado && (
                            <span className="text-[10px] font-medium text-red-600">
                              Anulado (R$ 0,00)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Responsável (Input interativo em tempo real) */}
                      <td className="py-3 px-4 align-middle">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            value={venda.responsavel}
                            onChange={(e) =>
                              handleResponsavelChange(venda.id, e.target.value)
                            }
                            placeholder="Digitar operador..."
                            aria-label={`Responsável pela comanda ${venda.id}`}
                            className={`w-full py-1.5 pl-3 pr-8 text-xs sm:text-sm rounded-lg border transition-all ${
                              hasResponsavel
                                ? 'bg-white border-neutral-300 text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10'
                                : 'bg-neutral-50/70 border-neutral-200 text-neutral-700 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10'
                            }`}
                          />
                          <div className="absolute right-2.5 flex items-center pointer-events-none">
                            {justSaved ? (
                              <span
                                title="Salvo em tempo real"
                                className="text-emerald-600 animate-pulse flex items-center"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </span>
                            ) : hasResponsavel ? (
                              <span
                                title="Operador atribuído"
                                className="text-neutral-400"
                              >
                                <Check className="w-3 h-3" />
                              </span>
                            ) : (
                              <User className="w-3 h-3 text-neutral-300" />
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Ações da linha */}
                      <td className="py-3.5 px-4 text-right align-middle whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCancelado && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                              Cancelado no Volux
                            </span>
                          )}
                          {onEditVenda && (
                            <button
                              type="button"
                              onClick={() => onEditVenda(venda)}
                              title="Editar lançamento desta venda"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/90 active:bg-neutral-200 rounded-md border border-neutral-200/80 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3 text-neutral-600" />
                              <span>Editar</span>
                            </button>
                          )}
                          {onDeleteVenda && (
                            <button
                              type="button"
                              onClick={() => onDeleteVenda(venda.id)}
                              title="Excluir comanda permanentemente"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100/90 active:bg-red-200 rounded-md border border-red-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span>Excluir</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View - Ocultado em favor da tabela rolável horizontal */}
          <div className="hidden">
            {sortedVendas.map((venda) => {
              const isBoliche = venda.tipo_venda === 'Boliche';
              const isCancelado = Boolean(venda.cancelado);
              const hasResponsavel = venda.responsavel && venda.responsavel.trim().length > 0;
              const justSaved = savedRowId === venda.id;
              const precoExibido = isCancelado ? 0 : venda.preco;

              return (
                <div
                  key={venda.id}
                  className={`p-4 space-y-3 ${
                    isCancelado ? 'bg-red-50/25 opacity-75' : 'bg-white'
                  }`}
                >
                  {/* Header: Date, badge and price */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isBoliche ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 ${
                              isCancelado ? 'line-through opacity-60' : ''
                            }`}
                          >
                            <CircleDot className="w-3 h-3 text-blue-500" />
                            Boliche
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${
                              isCancelado ? 'line-through opacity-60' : ''
                            }`}
                          >
                            <Ticket className="w-3 h-3 text-emerald-500" />
                            Fichas
                          </span>
                        )}
                        {isCancelado && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                            Cancelado no Volux
                          </span>
                        )}
                        <span
                          className={`text-xs text-neutral-500 font-mono-tabular ${
                            isCancelado ? 'line-through' : ''
                          }`}
                        >
                          {venda.data} às {venda.hora}
                        </span>
                      </div>
                      <h4
                        className={`text-sm font-semibold pt-0.5 ${
                          isCancelado
                            ? 'text-neutral-500 line-through decoration-red-500/80'
                            : 'text-neutral-900'
                        }`}
                      >
                        {venda.item}
                      </h4>
                      <p
                        className={`text-[11px] text-neutral-400 font-mono-tabular ${
                          isCancelado ? 'line-through' : ''
                        }`}
                      >
                        Comanda #{venda.comanda || venda.id}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-semibold font-mono-tabular text-base ${
                          isCancelado ? 'text-red-700' : 'text-neutral-900'
                        }`}
                      >
                        {formatCurrencyBRL(precoExibido)}
                      </span>
                    </div>
                  </div>

                  {/* Responsible input on mobile */}
                  <div className="pt-1">
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Responsável / Operador:
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={venda.responsavel}
                        onChange={(e) =>
                          handleResponsavelChange(venda.id, e.target.value)
                        }
                        placeholder="Digitar operador..."
                        className={`w-full py-2 pl-3 pr-8 text-xs rounded-lg border transition-all ${
                          hasResponsavel
                            ? 'bg-white border-neutral-300 text-neutral-900 focus:border-neutral-900'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-700 placeholder:text-neutral-400 focus:bg-white focus:border-neutral-900'
                        }`}
                      />
                      <div className="absolute right-2.5 pointer-events-none">
                        {justSaved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        ) : hasResponsavel ? (
                          <Check className="w-3 h-3 text-neutral-400" />
                        ) : (
                          <User className="w-3 h-3 text-neutral-300" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions row */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-100">
                    {onEditVenda && (
                      <button
                        type="button"
                        onClick={() => onEditVenda(venda)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-neutral-200/80 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3 text-neutral-600" />
                        <span>Editar Venda</span>
                      </button>
                    )}
                    {onDeleteVenda && (
                      <button
                        type="button"
                        onClick={() => onDeleteVenda(venda.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Table Footer info */}
      <div className="px-4 py-3 bg-neutral-50/75 border-t border-neutral-200 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>Dica: edite o campo</span>
          <span className="font-medium text-neutral-700">Responsável</span>
          <span>para salvar o operador da venda em tempo real.</span>
        </div>
        <div className="font-mono-tabular text-neutral-600 font-medium">
          {sortedVendas.length} {sortedVendas.length === 1 ? 'comanda exibida' : 'comandas exibidas'}
        </div>
      </div>
    </div>
  );
};
