export type TipoVenda = 'Boliche' | 'Fichas' | 'AeB';

export type MotivoOperacional = 'Normal' | 'Voucher' | 'Cortesia' | 'Manutenção';

export type OrigemVenda = 'MANUAL' | 'PDF';

export interface VendaComanda {
  id: string; // Identificador (determinístico para PDF, MANUAL-timestamp para vendas manuais)
  comanda?: string; // Número/código da comanda Volux (ex: "13.536.039", "A8126" ou "3000")
  data: string;
  hora: string;
  tipo_venda: TipoVenda;
  item: string;
  preco: number; // Valor unitário/total da linha
  responsavel: string;
  qtde?: number; // Quantidade de unidades (desmembrado 1 para 1 por padrão)
  observacao?: string; // Observação opcional por venda
  origem?: OrigemVenda; // Origem do lançamento ("MANUAL" ou "PDF")
  conciliado?: boolean; // Indica se o lançamento manual já foi conciliado com uma linha do PDF
  faltouNoManual?: boolean; // Indica se veio do PDF sem correspondente manual no dia
  sobraNoManual?: boolean; // Indica se foi lançado manualmente a mais (não consta no PDF do Volux)
  manualQtdeConciliada?: number; // Quantidade de unidades manuais já absorvidas nesta linha do PDF
  pdfId?: string; // ID determinístico do PDF vinculado na conciliação
  conta3000?: boolean; // Indica se pertence à Conta 3000 ou 3030 (ADM = S / Espaço 3000 ou 3030 no Volux)
  contaAdm?: '3000' | '3030' | string; // Número da conta ADM ("3000" ou "3030")
  espaco?: string; // Identificador de espaço/quarto quando aplicável (ex: "3000" ou "3030")
  cancelado?: boolean; // Indica se o registro foi cancelado/estornado no Volux
  status?: 'Ativo' | 'Cancelado' | string; // Status da venda ("Ativo" ou "Cancelado")
  isVoucher?: boolean; // Flag de Voucher (Não é cancelamento e não soma como dinheiro no caixa)
  isCortesia?: boolean; // Flag de Cortesia (Manual ou Comanda 3000/3030 do Volux)
  isManutencao?: boolean; // Flag de Manutenção (Fichas - Valor R$ 0,00 / abate 1 Ficha Dourada)
  motivoOperacional?: MotivoOperacional | string;
}

export type FiltroTipo = 'Todos' | TipoVenda;

export type FiltroSubItemBoliche = 'Todos' | 'Meia Hora' | 'Uma Hora' | 'Voucher';
export type FiltroSubItemFichas =
  | 'Todos'
  | 'Avulsa/Eletrônica'
  | 'Mini Combo'
  | 'Big Combo'
  | 'Mega Combo'
  | 'Voucher'
  | 'Manutenção'
  | 'Cortesia';
export type FiltroSubItem = FiltroSubItemBoliche | FiltroSubItemFichas | string;

export type FiltroStatusResponsavel = 'todos' | 'pendentes' | 'preenchidos';

/**
 * Regra Oficial de Turnos:
 * - Manhã (09:00 às 15:59) — inclui eventuais aberturas às 08:xx
 * - Noite (16:00 às 23:00) — aceita até 23:59 caso uma comanda feche após as 23h
 */
export type FiltroTurno =
  | 'Todos os Turnos'
  | 'Manhã (09:00 às 15:59)'
  | 'Noite (16:00 às 23:00)'
  | 'Manhã (08:00 às 15:59)'
  | 'Tarde/Noite (16:00 em diante)';

export const FILTRO_TURNO_OPCOES: FiltroTurno[] = [
  'Todos os Turnos',
  'Manhã (09:00 às 15:59)',
  'Noite (16:00 às 23:00)',
];

export type TurnoOpcao =
  | 'Manhã (09:00 às 15:59)'
  | 'Noite (16:00 às 23:00)'
  | 'Manhã (08:00 às 15:59)'
  | 'Tarde-Noite (16:00 em diante)'
  | 'Manhã (08:00 às 16:00)'
  | 'Tarde/Noite (16:00 às 23:20)';

export type ModoRelatorioPDF = 'MANHA' | 'NOITE' | 'DIA_COMPLETO';

export interface FechamentoTurnoFichas {
  id: string; // Identificador único do fechamento
  data: string;
  turno: TurnoOpcao | string;
  responsavel: string;
  // Contagem de Fichas Pratas (Eletrônicas normais)
  inicialPrata: number;
  reposicaoPrata?: number; // Suprimento de fichas pratas adicionado durante o turno
  vendidasPrataSistema: number;
  esperadoPrata: number;
  finalPrata: number;
  diferencaPrata: number; // Final Manual Prata - Esperado Prata
  // Contagem de Fichas Douradas (Bônus dos combos)
  inicialDourada: number;
  reposicaoDourada?: number; // Suprimento de fichas douradas adicionado durante o turno
  vendidasDouradaSistema: number;
  esperadoDourada: number;
  finalDourada: number;
  diferencaDourada: number; // Final Manual Dourada - Esperado Dourada
  // Campos legados mantidos como opcionais para retrocompatibilidade de backups antigos
  contagemInicial?: number;
  contagemFinal?: number;
  fichasVendidas?: number;
  observacao?: string;
  timestamp?: string;
  abertoEm?: string;
}

export interface TurnoAtivoCaixa {
  aberto: boolean;
  data: string; // Formato YYYY-MM-DD
  dataExibicao: string; // Formato DD/MM/YYYY
  turno: TurnoOpcao | string;
  responsavel: string;
  inicialPrata: number;
  inicialDourada: number;
  reposicaoPrata: number; // Suprimento de fichas pratas adicionado durante o turno aberto (default: 0)
  reposicaoDourada: number; // Suprimento de fichas douradas adicionado durante o turno aberto (default: 0)
  abertoEm: string; // Horário de abertura (HH:MM)
}

export interface VendaAeB {
  id: string; // Identificador (determinístico para PDF, MANUAL-timestamp para vendas manuais)
  comanda?: string; // Número/código da comanda Volux (ex: "13.536.120", "A8126" ou "3000")
  data: string;
  hora: string;
  item: string;
  preco: number; // Valor unitário/total da linha
  qtde?: number; // Quantidade de unidades (desmembrado 1 para 1 por padrão)
  responsavel: string;
  observacao?: string; // Observação opcional por venda
  origem?: OrigemVenda; // Origem do lançamento ("MANUAL" ou "PDF")
  conciliado?: boolean; // Indica se o lançamento manual já foi conciliado com uma linha do PDF
  faltouNoManual?: boolean; // Indica se veio do PDF sem correspondente manual no dia
  sobraNoManual?: boolean; // Indica se foi lançado manualmente a mais (não consta no PDF do Volux)
  manualQtdeConciliada?: number; // Quantidade de unidades manuais já absorvidas nesta linha do PDF
  pdfId?: string; // ID determinístico do PDF vinculado na conciliação
  conta3000?: boolean; // Indica se pertence à Conta 3000 ou 3030 (ADM = S / Espaço 3000 ou 3030 no Volux)
  contaAdm?: '3000' | '3030' | string; // Número da conta ADM ("3000" ou "3030")
  espaco?: string; // Identificador de espaço/quarto quando aplicável (ex: "3000" ou "3030")
  cancelado?: boolean; // Indica se o registro foi cancelado/estornado no Volux
  status?: 'Ativo' | 'Cancelado' | string; // Status da venda ("Ativo" ou "Cancelado")
  isVoucher?: boolean; // Flag de Voucher (Não é cancelamento e não soma como dinheiro no caixa)
  isCortesia?: boolean; // Flag de Cortesia (Manual ou Comanda 3000/3030 do Volux)
  motivoOperacional?: MotivoOperacional | string;
}

export type AppTab = 'comandas' | 'controle_fichas' | 'aeb' | 'relatorios';

export type { CategoriaAeB, ProdutoAeB } from '../data/catalogoAeB';
