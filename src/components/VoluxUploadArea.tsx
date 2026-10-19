import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  BookOpen,
  X,
  FileCode,
} from 'lucide-react';
import {
  extractTextFromPdf,
  parseVoluxText,
  SAMPLE_VOLUX_REPORT_TEXT,
  CATALOGO_VOLUX,
} from '../utils/voluxParser';
import { VendaComanda } from '../types/venda';
import { formatCurrencyBRL } from '../utils/formatters';

interface ImportResult {
  addedCount: number;
  addedValor: number;
  ignoredDuplicateCount: number;
  cancelledRemovedCount: number;
}

interface VoluxUploadAreaProps {
  onDataLoaded: (vendas: VendaComanda[], sourceName: string) => ImportResult | void;
  currentLoadedSource?: string | null;
}

export const VoluxUploadArea: React.FC<VoluxUploadAreaProps> = ({
  onDataLoaded,
  currentLoadedSource,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    fileName: string;
    totalItens: number;
    totalValor: number;
    totalLido?: number;
    ignoredCount?: number;
  } | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processTextAndEmit = (rawText: string, sourceName: string) => {
    try {
      const parsed = parseVoluxText(rawText);
      if (parsed.length === 0) {
        setErrorMessage(
          'Não foi possível encontrar itens do catálogo Volux no documento. Verifique se o arquivo contém comandas e itens válidos.'
        );
        return;
      }

      // Envia os dados para a tabela principal e obtém o resultado efetivo do Upsert
      const result = onDataLoaded(parsed, sourceName);

      if (result) {
        setSuccessInfo({
          fileName: sourceName,
          totalItens: result.addedCount,
          totalValor: result.addedValor,
          totalLido: parsed.length,
          ignoredCount: result.ignoredDuplicateCount,
        });
      } else {
        const totalSoma = parsed.reduce((acc, curr) => acc + curr.preco, 0);
        setSuccessInfo({
          fileName: sourceName,
          totalItens: parsed.length,
          totalValor: totalSoma,
          totalLido: parsed.length,
        });
      }
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Erro ao processar texto Volux:', err);
      setErrorMessage(
        'Ocorreu uma falha ao interpretar o relatório Volux. Tente novamente ou use a opção de colar texto.'
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
        throw new Error('O PDF está vazio ou contém apenas imagens escaneadas sem texto.');
      }
      processTextAndEmit(text, file.name);
    } catch (err: any) {
      console.error('Erro na extração do PDF:', err);
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

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleLoadSample = () => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      processTextAndEmit(SAMPLE_VOLUX_REPORT_TEXT, 'Relatorio_Volux_Exemplo_05-06_Out.pdf');
      setIsLoading(false);
    }, 400);
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;
    processTextAndEmit(pastedText, 'Texto_Colado_Volux.txt');
    setShowPasteModal(false);
    setPastedText('');
  };

  return (
    <section className="mb-6">
      {/* Container Principal de Upload */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all p-5 sm:p-6 bg-white shadow-2xs ${
          isDragging
            ? 'border-neutral-900 bg-neutral-50/90 scale-[1.005]'
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
          id="volux-pdf-input"
        />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
          {/* Lado Esquerdo: Ícone e Instruções */}
          <div className="flex items-start sm:items-center gap-4 text-center sm:text-left flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shrink-0">
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin text-neutral-900" />
              ) : successInfo ? (
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              ) : (
                <UploadCloud className="w-6 h-6 text-neutral-700" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <span className="text-sm font-semibold text-neutral-900">
                  {successInfo
                    ? `Relatório Carregado: ${successInfo.fileName}`
                    : 'Processamento de Relatório do Sistema Volux'}
                </span>
                {successInfo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2 py-0.5 rounded">
                    <CheckCircle className="w-3 h-3" />
                    {successInfo.totalItens > 0
                      ? `${successInfo.totalItens} ${successInfo.totalItens === 1 ? 'comanda nova importada' : 'comandas novas importadas'} com sucesso (${formatCurrencyBRL(successInfo.totalValor)})`
                      : `Todas as comandas já constavam no sistema (0 novas inseridas)`}
                  </span>
                )}
              </div>

              <p className="text-xs text-neutral-500">
                Arraste o arquivo PDF aqui ou clique no botão para carregar e extrair automaticamente as comandas, itens e preços.
              </p>
            </div>
          </div>

          {/* Lado Direito: Ações */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
            {/* Botão Principal com o texto exato solicitado */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleTriggerFileInput}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 active:bg-neutral-950 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extraindo texto do PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Importar Relatório Volux (PDF)</span>
                </>
              )}
            </button>

            {/* Ação rápida: Testar com relatório de exemplo Volux */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleLoadSample}
              title="Carregar exemplo oficial com vendas de 05/10 e 06/10 (inclui Meia Hora de Boliche por R$ 49,00)"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 active:bg-neutral-200 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Carregar Exemplo Volux</span>
            </button>

            {/* Botão de Ver Catálogo Oficial */}
            <button
              type="button"
              onClick={() => setShowCatalogModal(true)}
              title="Consultar regras do catálogo de itens e preços de referência"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Catálogo</span>
            </button>

            {/* Botão de Colar Texto */}
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              title="Colar texto bruto copiado do relatório Volux"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Colar Texto</span>
            </button>
          </div>
        </div>

        {/* Mensagem de Erro, se houver */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Modal do Catálogo Volux & Regra de Ouro */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl max-w-lg w-full border border-neutral-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Catálogo Volux & Regras de Categorização
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Itens oficiais reconhecidos e diretrizes de cálculo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Regra de Ouro Banner */}
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  Regra de Ouro (Preço Imutável do Volux)
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Os valores abaixo são preços de referência do catálogo padrão. O preço final que vai para a tabela é <strong>estritamente o que foi lido no PDF</strong>. Se a &ldquo;Meia Hora de Boliche&rdquo; custou R$ 49,00 devido a um desconto, o sistema salva e calcula exatamente <strong>R$ 49,00</strong>.
                </p>
              </div>

              {/* Seção Boliche */}
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-neutral-900 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                  Categoria: Boliche
                </div>
                <div className="border border-neutral-200 rounded-lg overflow-hidden divide-y divide-neutral-100">
                  {CATALOGO_VOLUX.boliche.map((item) => (
                    <div key={item.nome} className="p-2.5 flex items-center justify-between bg-white">
                      <span className="font-medium text-neutral-800">{item.nome}</span>
                      <span className="font-mono-tabular text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                        Padrão: {formatCurrencyBRL(item.precoReferencia)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção Fichas */}
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-neutral-900 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Categoria: Fichas
                </div>
                <div className="border border-neutral-200 rounded-lg overflow-hidden divide-y divide-neutral-100">
                  {CATALOGO_VOLUX.fichas.map((item) => (
                    <div key={item.nome} className="p-2.5 flex items-center justify-between bg-white">
                      <div>
                        <div className="font-medium text-neutral-800">{item.nome}</div>
                        <div className="text-[11px] text-neutral-400">{item.desc}</div>
                      </div>
                      <span className="font-mono-tabular text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                        Padrão: {formatCurrencyBRL(item.precoReferencia)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-800 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Colar Texto Bruto */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl max-w-lg w-full border border-neutral-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  Colar Texto do Relatório Volux
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Cole as linhas copiadas do seu visualizador de PDF ou relatório
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
                placeholder="Exemplo:&#10;13.402.402 05/10/2026 15:03 Meia Hora de Boliche 49,00&#10;13.402.403 05/10/2026 15:20 Mini Combo 65,00"
                className="w-full p-3 text-xs font-mono-tabular bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>O parser extrai Comanda, Data, Hora, Item e Preço automaticamente.</span>
                <button
                  type="button"
                  onClick={() => setPastedText(SAMPLE_VOLUX_REPORT_TEXT)}
                  className="text-neutral-700 hover:underline font-medium cursor-pointer"
                >
                  Inserir texto de exemplo
                </button>
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
                Processar Texto
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
