export const financialStats = [
  {
    label: 'Saldo em m\u00e3os',
    value: 'R$ 48.760,20',
    detail: 'Dispon\u00edvel para movimentar',
    trend: '+12,4%',
    tone: 'positive',
  },
  {
    label: 'Receitas do m\u00eas',
    value: 'R$ 27.430,00',
    detail: '8 entradas confirmadas',
    trend: '+8,1%',
    tone: 'positive',
  },
  {
    label: 'Despesas do m\u00eas',
    value: 'R$ 18.960,50',
    detail: '74% do previsto',
    trend: '-3,8%',
    tone: 'warning',
  },
  {
    label: 'Saldo previsto',
    value: 'R$ 57.229,70',
    detail: 'Projetado at\u00e9 31 maio',
    trend: '+R$ 8.469',
    tone: 'neutral',
  },
]

export const spendingCategories = [
  { name: 'Operacional', value: 'R$ 8.420', percent: 72 },
  { name: 'Marketing', value: 'R$ 4.120', percent: 46 },
  { name: 'Assinaturas', value: 'R$ 1.890', percent: 28 },
  { name: 'Impostos', value: 'R$ 4.530', percent: 53 },
]

export const payments = [
  {
    payee: 'Aluguel do escrit\u00f3rio',
    category: 'Operacional',
    date: '15 maio',
    amount: 'R$ 4.800,00',
    status: 'Agendado',
  },
  {
    payee: 'Google Ads',
    category: 'Marketing',
    date: '18 maio',
    amount: 'R$ 2.340,00',
    status: 'Pendente',
  },
  {
    payee: 'Folha complementar',
    category: 'Equipe',
    date: '22 maio',
    amount: 'R$ 6.920,00',
    status: 'Aprovar',
  },
  {
    payee: 'AWS Cloud',
    category: 'Infraestrutura',
    date: '25 maio',
    amount: 'R$ 1.780,50',
    status: 'Agendado',
  },
]

export const creditCards = [
  {
    name: 'Fluxo Black',
    lastDigits: '2189',
    invoice: 'R$ 8.420,80',
    limit: 'R$ 42.000',
    dueDate: '20 maio',
    usage: 62,
    variant: 'emerald',
  },
  {
    name: 'Fluxo Business',
    lastDigits: '7044',
    invoice: 'R$ 3.180,40',
    limit: 'R$ 18.000',
    dueDate: '28 maio',
    usage: 38,
    variant: 'blue',
  },
  {
    name: 'Fluxo Travel',
    lastDigits: '5127',
    invoice: 'R$ 1.290,00',
    limit: 'R$ 12.000',
    dueDate: '05 junho',
    usage: 21,
    variant: 'amber',
  },
]
