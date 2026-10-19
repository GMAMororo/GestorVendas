import { VendaComanda, FechamentoTurnoFichas } from '../types/venda';

/**
 * Dados iniciais alinhados estritamente com o catálogo Volux:
 * Boliche: "Meia Hora de Boliche", "Uma Hora de Boliche"
 * Fichas: "Fichas Eletronicas", "Mini Combo", "Big Combo", "Mega Combo"
 * 
 * Inclui o exemplo de teste com preço de desconto imutável:
 * Comanda 13.402.402 -> Meia Hora de Boliche por R$ 49,00
 */
export const INITIAL_VENDAS: VendaComanda[] = [
  {
    id: '13.402.402',
    data: '05/10',
    hora: '15:03',
    tipo_venda: 'Boliche',
    item: 'Meia Hora de Boliche',
    preco: 49.0, // Regra de Ouro: Preço lido no Volux com desconto (referência 70.00)
    responsavel: '',
  },
  {
    id: '13.402.403',
    data: '05/10',
    hora: '15:20',
    tipo_venda: 'Fichas',
    item: 'Mini Combo',
    preco: 65.0,
    responsavel: '',
  },
  {
    id: '13.402.404',
    data: '05/10',
    hora: '15:45',
    tipo_venda: 'Boliche',
    item: 'Uma Hora de Boliche',
    preco: 120.0,
    responsavel: '',
  },
  {
    id: '13.402.405',
    data: '05/10',
    hora: '16:15',
    tipo_venda: 'Fichas',
    item: 'Fichas Eletronicas',
    preco: 24.0, // 2 fichas individuais
    responsavel: '',
  },
  {
    id: '13.402.406',
    data: '05/10',
    hora: '17:00',
    tipo_venda: 'Fichas',
    item: 'Big Combo',
    preco: 120.0,
    responsavel: '',
  },
  {
    id: '13.402.407',
    data: '05/10',
    hora: '17:40',
    tipo_venda: 'Fichas',
    item: 'Mega Combo',
    preco: 250.0,
    responsavel: '',
  },
  {
    id: '13.402.408',
    data: '05/10',
    hora: '18:10',
    tipo_venda: 'Boliche',
    item: 'Uma Hora de Boliche',
    preco: 110.0, // Desconto fidelidade lido no Volux
    responsavel: '',
  },
  {
    id: '13.402.409',
    data: '06/10',
    hora: '14:15',
    tipo_venda: 'Boliche',
    item: 'Meia Hora de Boliche',
    preco: 70.0,
    responsavel: '',
  },
  {
    id: '13.402.410',
    data: '06/10',
    hora: '14:50',
    tipo_venda: 'Fichas',
    item: 'Mini Combo',
    preco: 65.0,
    responsavel: '',
  },
  {
    id: '13.402.411',
    data: '06/10',
    hora: '15:30',
    tipo_venda: 'Boliche',
    item: 'Uma Hora de Boliche',
    preco: 120.0,
    responsavel: '',
  },
  {
    id: '13.402.412',
    data: '06/10',
    hora: '16:05',
    tipo_venda: 'Fichas',
    item: 'Fichas Eletronicas',
    preco: 12.0,
    responsavel: '',
  },
  {
    id: '13.402.413',
    data: '06/10',
    hora: '16:45',
    tipo_venda: 'Fichas',
    item: 'Big Combo',
    preco: 120.0,
    responsavel: '',
  },
  {
    id: '13.402.414',
    data: '06/10',
    hora: '17:25',
    tipo_venda: 'Fichas',
    item: 'Mega Combo',
    preco: 250.0,
    responsavel: '',
  },
  {
    id: '13.402.415',
    data: '06/10',
    hora: '18:00',
    tipo_venda: 'Boliche',
    item: 'Meia Hora de Boliche',
    preco: 55.0, // Preço promocional lido no Volux
    responsavel: '',
  },
];

export const INITIAL_FECHAMENTOS: FechamentoTurnoFichas[] = [
  {
    id: 'fech-1',
    data: '05/10/2026',
    turno: 'Manhã (08:00 às 16:00)',
    responsavel: 'Carlos Lima',
    contagemInicial: 600,
    contagemFinal: 460,
    fichasVendidas: 140,
    timestamp: '16:05',
  },
  {
    id: 'fech-2',
    data: '05/10/2026',
    turno: 'Tarde/Noite (16:00 às 23:20)',
    responsavel: 'Mariana Costa',
    contagemInicial: 460,
    contagemFinal: 210,
    fichasVendidas: 250,
    timestamp: '23:25',
  },
  {
    id: 'fech-3',
    data: '06/10/2026',
    turno: 'Manhã (08:00 às 16:00)',
    responsavel: 'Lucas Mendes',
    contagemInicial: 600,
    contagemFinal: 480,
    fichasVendidas: 120,
    timestamp: '16:00',
  },
  {
    id: 'fech-4',
    data: '06/10/2026',
    turno: 'Tarde/Noite (16:00 às 23:20)',
    responsavel: 'Carlos Lima',
    contagemInicial: 480,
    contagemFinal: 195,
    fichasVendidas: 285,
    timestamp: '23:30',
  },
];

