export const expenseTypes = [
  {
    id: 'single',
    label: 'Despesa \u00fanica',
    description: 'Pagamento pontual',
  },
  {
    id: 'installment',
    label: 'Despesa parcelada',
    description: 'Parcelas liberadas',
  },
  {
    id: 'recurring',
    label: 'Despesa recorrente',
    description: 'Ciclo autom\u00e1tico',
  },
]

export const frequencyOptions = [
  { value: 'daily', label: 'Di\u00e1ria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

export const statusOptions = [
  { value: 'open', label: 'Em aberto' },
  { value: 'paid', label: 'Pago' },
  { value: 'overdue', label: 'Atrasado' },
]

export const alertTimingOptions = [
  { value: 'before_due', label: '1 dia antes' },
  { value: 'on_due', label: 'No dia' },
]

export const initialExpenses = [
  {
    id: 1,
    type: 'recurring',
    description: 'Assinatura CRM',
    amount: 349.9,
    dueDate: '2026-05-16',
    status: 'open',
    category: 'Software',
    note: 'Renova\u00e7\u00e3o mensal do time comercial',
    frequency: 'monthly',
    alertEnabled: true,
    alertTiming: 'before_due',
    alertTime: '08:00',
  },
  {
    id: 2,
    type: 'installment',
    description: 'Notebook equipe comercial',
    amount: 820,
    totalAmount: 4920,
    installmentsTotal: 6,
    installmentNumber: 2,
    dueDate: '2026-05-20',
    status: 'open',
    category: 'Equipamentos',
    note: 'Parcela do lote de notebooks',
    frequency: 'monthly',
    alertEnabled: true,
    alertTiming: 'on_due',
    alertTime: '14:30',
  },
  {
    id: 3,
    type: 'single',
    description: 'Consultoria fiscal',
    amount: 1250,
    dueDate: '2026-05-12',
    status: 'overdue',
    category: 'Servi\u00e7os',
    note: 'Regulariza\u00e7\u00e3o trimestral pendente',
    frequency: 'monthly',
    alertEnabled: true,
    alertTiming: 'before_due',
    alertTime: '10:00',
  },
  {
    id: 4,
    type: 'single',
    description: 'Taxa banc\u00e1ria extraordin\u00e1ria',
    amount: 189.5,
    dueDate: '2026-05-27',
    status: 'paid',
    category: 'Bancos',
    note: '',
    frequency: 'monthly',
    alertEnabled: false,
    alertTiming: 'on_due',
    alertTime: '09:00',
  },
]
