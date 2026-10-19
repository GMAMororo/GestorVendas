export type TipoVenda = 'Boliche' | 'Fichas';

export interface VendaComanda {
  id: string; // Identificador (determinístico para PDF, UUID para vendas manuais)
  comanda?: string; // Número/código da comanda Volux (ex: "13.402.402")
  data: string;
  hora: string;
  tipo_venda: TipoVenda;
  item: string;
  preco: number;
  responsavel: string;
  cancelado?: boolean; // Indica se o registro foi cancelado/estornado no Volux
}

export type FiltroTipo = 'Todos' | TipoVenda;
export type FiltroStatusResponsavel = 'todos' | 'pendentes' | 'preenchidos';

export type TurnoOpcao = 'Manhã (08:00 às 16:00)' | 'Tarde/Noite (16:00 às 23:20)';

export interface FechamentoTurnoFichas {
  id: string; // Identificador único do fechamento
  data: string;
  turno: TurnoOpcao;
  responsavel: string;
  contagemInicial: number;
  contagemFinal: number;
  fichasVendidas: number;
  observacao?: string;
  timestamp?: string;
}

export interface VendaAeB {
  id: string; // Identificador (determinístico para PDF, UUID para vendas manuais)
  comanda?: string; // Número/código da comanda Volux (ex: "13.402.501")
  data: string;
  hora: string;
  item: string;
  preco: number;
  responsavel: string;
  cancelado?: boolean; // Indica se o registro foi cancelado/estornado no Volux
}

export type AppTab = 'comandas' | 'controle_fichas' | 'aeb' | 'relatorios';

export type { CategoriaAeB, ProdutoAeB } from '../data/catalogoAeB';
