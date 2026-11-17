import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignBatch: (responsavel: string) => void;
  pendingCount: number;
  existingResponsaveis: string[];
}

export const QuickAssignModal: React.FC<QuickAssignModalProps> = ({
  isOpen,
  onClose,
  onAssignBatch,
  pendingCount,
  existingResponsaveis,
}) => {
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');

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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Por favor, informe o nome do operador responsável.');
      return;
    }
    onAssignBatch(nome.trim());
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-md border border-neutral-200 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Atribuição Rápida em Lote
              </h3>
              <p className="text-xs text-neutral-500">
                Preencher responsável em {pendingCount} {pendingCount === 1 ? 'comanda pendente' : 'comandas pendentes'}
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
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Nome do Operador Responsável
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setError('');
              }}
              placeholder="ex: Carlos Lima"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          {existingResponsaveis.length > 0 && (
            <div>
              <span className="block text-[11px] font-medium text-neutral-500 mb-1.5">
                Operadores já cadastrados:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {existingResponsaveis.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setNome(op)}
                    className="text-xs px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 rounded border border-neutral-200/70 transition-colors cursor-pointer"
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              Aplicar a Todos os Pendentes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
