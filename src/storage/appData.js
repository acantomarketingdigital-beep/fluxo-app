import { loadCardsState, saveCardsStateLocal } from './cardsStorage'
import {
  clearCloudSyncQueue,
  deleteCloudDataForCurrentUser,
  publishSyncStatus,
} from './cloudSyncQueue'
import { loadExpensesState, saveExpensesStateLocal } from './expensesStorage'
import { loadIncomesState, saveIncomesStateLocal } from './incomesStorage'
import { loadTransactionsState, saveTransactionsStateLocal } from './transactionsStorage'
import { removeFluxoLocalStorageItems } from './storageSession'

export const APP_VERSION = '0.2.0-beta'

const EMPTY_FLUXO_STATE = {
  cards: [],
  expenses: [],
  incomes: [],
  purchases: [],
  transactions: [],
}

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
  clearFluxoLocalData()
}

export function clearFluxoLocalData() {
  clearCloudSyncQueue()
  removeFluxoLocalStorageItems()
  saveEmptyFluxoLocalState()
}

export async function resetFluxoTestData({ includeCloud = false } = {}) {
  clearFluxoLocalData()

  if (!includeCloud) {
    publishSyncStatus({
      message: 'Dados locais zerados.',
      state: 'local',
    })

    return {
      cloud: null,
      local: true,
    }
  }

  const cloudResult = await deleteCloudDataForCurrentUser()
  publishSyncStatus(cloudResult)

  return {
    cloud: cloudResult,
    local: true,
  }
}

function saveEmptyFluxoLocalState() {
  saveIncomesStateLocal({ incomes: EMPTY_FLUXO_STATE.incomes })
  saveExpensesStateLocal({ expenses: EMPTY_FLUXO_STATE.expenses })
  saveTransactionsStateLocal({ transactions: EMPTY_FLUXO_STATE.transactions })
  saveCardsStateLocal({
    cards: EMPTY_FLUXO_STATE.cards,
    purchases: EMPTY_FLUXO_STATE.purchases,
  })
}

function formatDateForFile(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
