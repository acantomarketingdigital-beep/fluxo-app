export const initialCards = [
  {
    id: 'black',
    name: 'Fluxo Black',
    totalLimit: 42000,
    availableLimit: 28460,
    invoice: 8420.8,
    dueDate: '2026-05-20',
    variant: 'violet',
  },
  {
    id: 'business',
    name: 'Fluxo Business',
    totalLimit: 18000,
    availableLimit: 12690,
    invoice: 3180.4,
    dueDate: '2026-05-28',
    variant: 'plum',
  },
  {
    id: 'travel',
    name: 'Fluxo Travel',
    totalLimit: 12000,
    availableLimit: 8740,
    invoice: 1290,
    dueDate: '2026-06-05',
    variant: 'graphite',
  },
]

export const initialPurchases = [
  {
    id: 1,
    cardName: 'Fluxo Black',
    description: 'SaaS de analytics',
    amount: 1290,
    invoiceCharge: 1290,
    type: 'Compra \u00e0 vista',
    installments: 1,
  },
  {
    id: 2,
    cardName: 'Fluxo Business',
    description: 'Mobili\u00e1rio comercial',
    amount: 3600,
    invoiceCharge: 600,
    type: 'Compra parcelada',
    installments: 6,
  },
]
