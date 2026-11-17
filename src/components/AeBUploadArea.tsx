import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  FileCode,
  GlassWater,
} from 'lucide-react';
import {
  extractTextFromPdf,
  parseVoluxAeBTextWithReconciliation,
  VoluxAeBReconciliationResult,
} from '../utils/voluxParser';
import { VendaAeB } from '../types/venda';
import { formatCurrencyBRL } from '../utils/formatters';

interface ImportResult {
  addedCount: number;
  updatedCount?: number;
  addedValor: number;
  ignoredDuplicateCount: number;
  cancelledRemovedCount: number;
}

interface AeBUploadAreaProps {
  onDataLoaded: (vendas: VendaAeB[], sourceName: string) => ImportResult | void;
  currentLoadedSource?: string | null;
}

export const AeBUploadArea: React.FC<AeBUploadAreaProps> = ({
  onDataLoaded,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discrepancyAlert, setDiscrepancyAlert] = useState<{
    sourceName: string;
    reconciliation: VoluxAeBReconciliationResult;
    formattedMessage: string;
  } | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    fileName: string;
    totalItens: number;
    updatedItens?: number;
    totalValor: number;
    totalLido?: number;
    ignoredCount?: number;
  } | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!discrepancyAlert && !showPasteModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (discrepancyAlert) setDiscrepancyAlert(null);
        if (showPasteModal) setShowPasteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [discrepancyAlert, showPasteModal]);

  const commitValidatedData = (
    reconciliation: VoluxAeBReconciliationResult,
    sourceName: string
  ) => {
    const parsed = reconciliation.vendas;
    const result = onDataLoaded(parsed, sourceName);

    if (result) {
      setSuccessInfo({
        fileName: sourceName,
        totalItens: result.addedCount,
        updatedItens: result.updatedCount || 0,
        totalValor: result.addedValor,
        totalLido: parsed.length,
        ignoredCount: result.ignoredDuplicateCount,
      });
    } else {
      const totalSoma = parsed.reduce((acc, curr) => acc + curr.preco, 0);
      setSuccessInfo({
        fileName: sourceName,
        totalItens: parsed.length,
        updatedItens: 0,
        totalValor: totalSoma,
        totalLido: parsed.length,
      });
    }
    setErrorMessage(null);
    setDiscrepancyAlert(null);
  };

  const processTextAndEmit = (rawText: string, sourceName: string) => {
    try {
      const reconciliation = parseVoluxAeBTextWithReconciliation(rawText);
      const parsed = reconciliation.vendas;

      if (parsed.length === 0) {
        if (reconciliation.isEmptyReport || sourceName.toLowerCase().endsWith('.pdf')) {
          onDataLoaded([], sourceName);
          setSuccessInfo({
            fileName: sourceName,
            totalItens: 0,
            updatedItens: 0,
            totalValor: 0,
            totalLido: 0,
          });
          setErrorMessage(null);
          setDiscrepancyAlert(null);
          return;
        }
        setErrorMessage(
          'Não foi possível encontrar itens de Alimentos e Bebidas (AeB) no documento. Verifique se o arquivo contém comandas e itens válidos.'
        );
        return;
      }

      // TRAVA DE SEGURANÇA (Conciliação e Auditoria):
      // Validação: if (totalExtraido !== totalEsperado)
      if (
        reconciliation.totalEsperado !== null &&
        reconciliation.totalExtraido !== reconciliation.totalEsperado &&
        reconciliation.hasDiscrepancy
      ) {
        const valorEsperadoFmt = reconciliation.totalEsperado.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const valorExtraidoFmt = reconciliation.totalExtraido.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const diferencaFmt = reconciliation.diferenca.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        const alertMsg = `Atenção: Discrepância na Leitura! O relatório indica um total de R$ ${valorEsperadoFmt}, mas o sistema identificou apenas R$ ${valorExtraidoFmt}. Faltam R$ ${diferencaFmt}.`;

        setSuccessInfo(null);
        setErrorMessage(alertMsg);
        setDiscrepancyAlert({
          sourceName,
          reconciliation,
          formattedMessage: alertMsg,
        });
        return;
      }

      // Sem discrepância: envia os dados validados para a tabela de AeB e obtém resultado efetivo do Upsert
      commitValidatedData(reconciliation, sourceName);
    } catch (err: any) {
      console.error('Erro ao processar relatório AeB:', err);
      setErrorMessage(
        'Ocorreu uma falha ao interpretar o relatório Volux de Alimentos e Bebidas (AeB). Tente novamente ou use a opção de colar texto.'
      );
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Por favor, selecione um arquivo válido no formato PDF (.pdf).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const text = await extractTextFromPdf(file);
      if (!text || text.trim().length === 0) {
        throw new Error('O PDF está vazio ou não possui texto legível.');
      }
      processTextAndEmit(text, file.name);
    } catch (err: any) {
      console.error('Erro na extração do PDF AeB:', err);
      setErrorMessage(
        err.message || 'Falha ao processar o arquivo PDF. Verifique se o arquivo não está protegido por senha.'
      );
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;
    processTextAndEmit(pastedText, 'Texto_Colado_AeB.txt');
    setShowPasteModal(false);
    setPastedText('');
  };

  return (
    <section className="mb-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all p-5 sm:p-6 bg-white shadow-2xs ${
          isDragging
            ? 'border-blue-900 bg-blue-50/50 scale-[1.005]'
            : 'border-neutral-300/80 hover:border-neutral-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
          id="volux-aeb-pdf-input"
        />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
          {/* Lado Esquerdo */}
          <div className="flex items-start sm:items-center gap-4 text-center sm:text-left flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-700 shrink-0">
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
              ) : successInfo ? (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <GlassWater className="w-6 h-6 text-blue-600" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className="text-sm font-semibold text-neutral-900">
                  {successInfo
                    ? `Relatório AeB Carregado: ${successInfo.fileName}`
                    : 'Processamento de Relatório · Alimentos e Bebidas (AeB)'}
                </span>
                {successInfo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" />
                    {successInfo.totalLido === 0
                      ? 'PDF lido com sucesso: Nenhuma comanda de A&B lançada neste período (R$ 0,00).'
                      : successInfo.totalItens > 0
                        ? `${successInfo.totalItens} ${successInfo.totalItens === 1 ? 'item novo importado' : 'itens novos importados'} com sucesso (${formatCurrencyBRL(successInfo.totalValor)})${
                            successInfo.updatedItens && successInfo.updatedItens > 0
                              ? ` · ${successInfo.updatedItens} atualizado(s)`
                              : ''
                          }`
                        : successInfo.updatedItens && successInfo.updatedItens > 0
                          ? `${successInfo.updatedItens} ${successInfo.updatedItens === 1 ? 'item existente sincronizado/atualizado' : 'itens existentes sincronizados/atualizados'} com sucesso`
                          : `Todos os itens de AeB já constavam no sistema (0 novos inseridos)`}
                  </span>
                )}
              </div>

              <p className="text-xs text-neutral-500">
                Arraste o relatório PDF de alimentos e bebidas ou utilize o botão para extrair as comandas, quantidades (Qtde) e conciliação de valores.
              </p>
            </div>
          </div>

          {/* Lado Direito: Ações */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
            {/* Botão com o texto exato solicitado */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extraindo itens AeB do PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Importar Relatório Volux AeB (PDF)</span>
                </>
              )}
            </button>

            {/* Colar Texto */}
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              title="Colar texto copiado do relatório Volux AeB"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Colar Texto</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-800">
            <div className="flex items-start sm:items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
              <span className="font-semibold leading-relaxed">{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {discrepancyAlert && (
                <button
                  type="button"
                  onClick={() =>
                    commitValidatedData(
                      discrepancyAlert.reconciliation,
                      discrepancyAlert.sourceName
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-semibold text-red-800 bg-red-100 hover:bg-red-200 rounded border border-red-300 transition-colors cursor-pointer"
                >
                  Importar Mesmo Assim
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setDiscrepancyAlert(null);
                }}
                className="text-red-500 hover:text-red-800 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Alerta Visual de Discrepância na Conciliação AeB */}
      {discrepancyAlert && (
        <div
          onClick={() => setDiscrepancyAlert(null)}
          className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-2xl border border-red-200 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 border border-red-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-red-950">
                    Trava de Conciliação Financeira (AeB) · Discrepância Detectada
                  </h3>
                  <p className="text-xs text-red-700 mt-0.5">
                    O salvamento automático foi bloqueado para evitar divergência no fechamento do caixa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscrepancyAlert(null)}
                className="text-red-500 hover:text-red-800 p-1 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="p-4 rounded-lg bg-red-50/90 border border-red-200 text-red-950 font-semibold text-xs sm:text-sm leading-relaxed">
                {discrepancyAlert.formattedMessage}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 block">Total Esperado (PDF)</span>
                  <span className="text-base font-bold text-neutral-900 font-mono-tabular">
                    {formatCurrencyBRL(discrepancyAlert.reconciliation.totalEsperado || 0)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] text-neutral-500 block">
                    Total Extraído ({discrepancyAlert.reconciliation.vendas.length} itens)
                  </span>
                  <span className="text-base font-bold text-amber-700 font-mono-tabular">
                    {formatCurrencyBRL(discrepancyAlert.reconciliation.totalExtraido)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <span className="text-[11px] text-red-700 block">Diferença Encontrada</span>
                  <span className="text-base font-bold text-red-700 font-mono-tabular">
                    {formatCurrencyBRL(discrepancyAlert.reconciliation.diferenca)}
                  </span>
                </div>
              </div>

              {discrepancyAlert.reconciliation.unmatchedLines.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-neutral-900">
                    Linhas com valores não reconhecidas pelo parser ({discrepancyAlert.reconciliation.unmatchedLines.length}):
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-900 text-amber-300 font-mono-tabular text-[11px] space-y-1 max-h-36 overflow-y-auto">
                    {discrepancyAlert.reconciliation.unmatchedLines.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-700">
                <strong>Auditoria Técnica (Console.log):</strong> A lista detalhada de todas as{' '}
                {discrepancyAlert.reconciliation.vendas.length} comandas e itens de AeB extraídos foi impressa no{' '}
                <code className="px-1.5 py-0.5 bg-white rounded border border-neutral-300 text-neutral-900">
                  console.log
                </code>{' '}
                do navegador para conferência linha a linha com o PDF físico.
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDiscrepancyAlert(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar e Revisar PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  commitValidatedData(
                    discrepancyAlert.reconciliation,
                    discrepancyAlert.sourceName
                  )
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                Salvar Mesmo Assim ({discrepancyAlert.reconciliation.vendas.length} itens)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Colar Texto AeB */}
      {showPasteModal && (
        <div
          onClick={() => setShowPasteModal(false)}
          className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl w-[95%] max-h-[90vh] overflow-y-auto md:w-full md:max-w-lg border border-neutral-200 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Colar Texto do Relatório Volux AeB
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Cole linhas de venda de alimentos e bebidas para extração imediata
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <textarea
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Exemplo:&#10;13.402.501 05/10/2026 15:10 Agua Mineral S/Gas Lata 350ml 9,90&#10;13.402.502 05/10/2026 15:25 Coca Cola Lata 350Ml 23,80"
                className="w-full p-3 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Extrai Comanda, Data, Hora, Item (AeB) e Preço automaticamente.</span>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!pastedText.trim()}
                onClick={handleProcessPastedText}
                className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Processar Alimentos e Bebidas (AeB)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
