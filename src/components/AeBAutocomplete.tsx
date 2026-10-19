import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Sparkles, X, Tag } from 'lucide-react';
import { CATALOGO_AEB_PRODUTOS, ProdutoAeB, CategoriaAeB } from '../data/catalogoAeB';

interface AeBAutocompleteProps {
  value: string;
  onChange: (nome: string, precoSugerido?: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const AeBAutocomplete: React.FC<AeBAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Buscar alimento ou bebida no catálogo...',
  autoFocus = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('Todas');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Categorias disponíveis para filtro rápido
  const categorias = useMemo(() => {
    const cats = Array.from(new Set(CATALOGO_AEB_PRODUTOS.map((p) => p.categoria)));
    return ['Todas', ...cats];
  }, []);

  // Filtragem dos produtos do catálogo por texto e categoria
  const produtosFiltrados = useMemo(() => {
    const termoNorm = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return CATALOGO_AEB_PRODUTOS.filter((p) => {
      // Filtro de categoria
      if (categoriaAtiva !== 'Todas' && p.categoria !== categoriaAtiva) {
        return false;
      }

      if (!termoNorm) return true;

      const nomeNorm = p.nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      const catNorm = p.categoria
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return nomeNorm.includes(termoNorm) || catNorm.includes(termoNorm);
    });
  }, [value, categoriaAtiva]);

  // Checa se o texto digitado é um item exatamente do catálogo
  const matchExato = useMemo(() => {
    const termoNorm = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!termoNorm) return null;

    return (
      CATALOGO_AEB_PRODUTOS.find(
        (p) =>
          p.nome
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim() === termoNorm
      ) || null
    );
  }, [value]);

  // Se o usuário digitou algo que não bate 100% com nenhum item, permitimos criar fora do catálogo
  const temItemPersonalizado = useMemo(() => {
    return value.trim().length > 0 && !matchExato;
  }, [value, matchExato]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scrolla para o item destacado
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Selecionar produto do catálogo
  const handleSelectProduto = (produto: ProdutoAeB) => {
    onChange(produto.nome, produto.preco);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Selecionar item fora do catálogo (preço zerado/vazio para digitação manual)
  const handleSelectPersonalizado = () => {
    onChange(value.trim(), undefined);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const totalOpcoes = produtosFiltrados.length + (temItemPersonalizado ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < totalOpcoes ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalOpcoes - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < produtosFiltrados.length) {
        handleSelectProduto(produtosFiltrados[highlightedIndex]);
      } else if (highlightedIndex === produtosFiltrados.length && temItemPersonalizado) {
        handleSelectPersonalizado();
      } else if (produtosFiltrados.length > 0) {
        handleSelectProduto(produtosFiltrados[0]);
      } else if (temItemPersonalizado) {
        handleSelectPersonalizado();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Cor do badge por categoria
  const getBadgeColor = (cat: CategoriaAeB) => {
    switch (cat) {
      case 'Águas':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Cervejas':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Refrigerantes':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Diversos e Guloseimas':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Sucos':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Cafés/Chás/Achocolatados':
        return 'bg-stone-100 text-stone-700 border-stone-200';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input de Pesquisa */}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-neutral-400 flex items-center">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const novoValor = e.target.value;
            // Checa se o texto corresponde diretamente a algum item do catálogo
            const prod = CATALOGO_AEB_PRODUTOS.find(
              (p) => p.nome.toLowerCase() === novoValor.toLowerCase().trim()
            );
            if (prod) {
              onChange(novoValor, prod.preco);
            } else {
              // Se for um item diferente ou fora do catálogo, passa undefined para o preço
              onChange(novoValor, undefined);
            }
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-16 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 font-medium transition-all"
        />

        {/* Botão limpar e seta */}
        <div className="absolute right-2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('', undefined);
                inputRef.current?.focus();
              }}
              className="p-1 text-neutral-400 hover:text-neutral-600 rounded-md hover:bg-neutral-200/60 transition-colors"
              title="Limpar campo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded-md hover:bg-neutral-200/60 transition-colors"
            tabIndex={-1}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu com Categorias & Produtos do Catálogo */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-80 flex flex-col">
          {/* Barra de Filtro Rápido de Categorias */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/70 overflow-x-auto scrollbar-none flex gap-1.5 shrink-0">
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategoriaAtiva(cat);
                  setHighlightedIndex(-1);
                  inputRef.current?.focus();
                }}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  categoriaAtiva === cat
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white text-neutral-600 hover:bg-neutral-200/70 border border-neutral-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de Resultados */}
          <ul
            ref={listRef}
            className="overflow-y-auto p-1.5 space-y-0.5 divide-y divide-neutral-100/60 focus:outline-none flex-1"
          >
            {/* Opção de item personalizado caso o usuário digite algo fora do catálogo */}
            {temItemPersonalizado && (
              <li
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectPersonalizado();
                }}
                className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors mb-1 ${
                  highlightedIndex === produtosFiltrados.length
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-900">"{value}"</span>
                    <span className="text-[11px] text-neutral-500 ml-1.5">
                      (Item fora do catálogo padrão)
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded">
                  Preço manual
                </span>
              </li>
            )}

            {/* Itens do catálogo oficial */}
            {produtosFiltrados.length === 0 && !temItemPersonalizado ? (
              <li className="px-4 py-6 text-center text-xs text-neutral-500">
                Nenhum produto encontrado para "{value}".
                <p className="text-[11px] text-neutral-400 mt-1">
                  Pressione Enter para salvar como novo item e preencher o preço livremente.
                </p>
              </li>
            ) : (
              produtosFiltrados.map((produto, idx) => {
                const isSelected =
                  value.trim().toLowerCase() === produto.nome.toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={produto.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectProduto(produto);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors ${
                      isHighlighted
                        ? 'bg-neutral-100 text-neutral-900'
                        : isSelected
                        ? 'bg-neutral-50 font-medium text-neutral-900'
                        : 'hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center">
                            <Tag className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <div className="truncate">
                        <span className="font-medium text-neutral-900 truncate block">
                          {produto.nome}
                        </span>
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.2 rounded border font-medium mt-0.5 ${getBadgeColor(
                            produto.categoria
                          )}`}
                        >
                          {produto.categoria}
                        </span>
                      </div>
                    </div>

                    {/* Preço de Catálogo */}
                    <div className="shrink-0 text-right">
                      <span className="font-mono-tabular font-semibold text-neutral-900 text-xs sm:text-sm bg-neutral-100/80 px-2 py-0.5 rounded border border-neutral-200">
                        R$ {produto.preco.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Rodapé informativo */}
          <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-200/80 flex items-center justify-between text-[11px] text-neutral-500">
            <span>
              <strong>{produtosFiltrados.length}</strong> de {CATALOGO_AEB_PRODUTOS.length} itens no catálogo
            </span>
            <span className="hidden sm:inline text-neutral-400">
              Use ↑ ↓ para navegar e Enter para selecionar
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
