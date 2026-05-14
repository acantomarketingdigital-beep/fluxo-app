import { initialCards } from '../data/cards'
import { loadCardsState, saveCardsState } from './cardsStorage'
import { loadExpensesState, saveExpensesState } from './expensesStorage'
import { loadIncomesState, saveIncomesState } from './incomesStorage'
import { loadTransactionsState, saveTransactionsState } from './transactionsStorage'

export const APP_VERSION = '0.2.0-beta'

export function loadFluxoSnapshot() {
  return {
    cards: loadCardsState(),
    exportedAt: new Date().toISOString(),
    expenses: loadExpensesState(),
    incomes: loadIncomesState(),
    transactions: loadTransactionsState(),
    version: APP_VERSION,
  }
}

export function exportFluxoData() {
  const snapshot = loadFluxoSnapshot()
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `fluxo-backup-${formatDateForFile(new Date())}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function clearFluxoData() {
  saveIncomesState({ incomes: [] })
  saveExpensesState({ expenses: [] })
  saveTransactionsState({ transactions: [] })
  saveCardsState({
    cards: initialCards.map((card) => ({
      ...card,
      availableLimit: card.totalLimit,
      invoice: 0,
      invoiceCycle: 0,
    })),
    purchases: [],
  })
}

function formatDateForFile(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
