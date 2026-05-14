export const incomeTypes = [
  {
    id: 'cash',
    label: 'Receita em mãos',
    description: 'Dinheiro disponível agora',
  },
  {
    id: 'receivable',
    label: 'A receber',
    description: 'Entrada futura pendente',
  },
]

export const incomeStatusOptions = [
  { value: 'received', label: 'Recebido' },
  { value: 'pending', label: 'Pendente' },
]

export const incomeFrequencyOptions = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

export const initialIncomes = [
  {
    id: 1,
    type: 'cash',
    description: 'Saldo inicial operacional',
    source: 'Conta principal',
    amount: 24760.2,
    date: '2026-05-01',
    status: 'received',
    recurring: false,
    frequency: 'monthly',
    note: 'Dinheiro já disponível no início do mês',
    receivedAt: '2026-05-01',
  },
  {
    id: 2,
    type: 'cash',
    description: 'Reserva em espécie',
    source: 'Caixa interno',
    amount: 15000,
    date: '2026-05-03',
    status: 'received',
    recurring: false,
    frequency: 'monthly',
    note: '',
    receivedAt: '2026-05-03',
  },
  {
    id: 3,
    type: 'receivable',
    description: 'Contrato de performance',
    source: 'Cliente Orion',
    amount: 12400,
    date: '2026-05-22',
    status: 'pending',
    recurring: false,
    frequency: 'monthly',
    note: 'Pagamento após aprovação do relatório',
    receivedAt: '',
  },
  {
    id: 4,
    type: 'receivable',
    description: 'Pró-labore',
    source: 'Fluxo Consultoria',
    amount: 9800,
    date: '2026-05-30',
    status: 'pending',
    recurring: true,
    frequency: 'monthly',
    note: 'Entrada recorrente mensal',
    receivedAt: '',
  },
]
