import { queueCloudStateSync } from './cloudSyncQueue'
import {
  readScopedStorageItem,
  removeScopedStorageItem,
  writeScopedStorageItem,
} from './storageSession'

const STORAGE_KEY = 'fluxo:incomes-state'
const STORAGE_VERSION = 1

export function createInitialIncomesState() {
  return {
    incomes: [],
  }
}

export function loadIncomesState() {
  if (typeof window === 'undefined') {
    return createInitialIncomesState()
  }

  try {
    const savedState = readScopedStorageItem(STORAGE_KEY)

    if (!savedState) {
      return createInitialIncomesState()
    }

    const parsedState = JSON.parse(savedState)

    if (!isValidIncomesState(parsedState)) {
      return createInitialIncomesState()
    }

    return {
      incomes: parsedState.incomes.map(normalizeIncome),
    }
  } catch {
    return createInitialIncomesState()
  }
}

export function saveIncomesState({ incomes }) {
  saveIncomesStateLocal({ incomes })
  queueCloudStateSync('incomes', { incomes })
}

export function saveIncomesStateLocal({ incomes }) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    writeScopedStorageItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        incomes,
      }),
    )
  } catch {
    // Keep the UI usable when localStorage is unavailable.
  }
}

export function resetIncomesData() {
  if (typeof window !== 'undefined') {
    try {
      removeScopedStorageItem(STORAGE_KEY)
    } catch {
      // Keep the in-memory reset working when storage cannot be changed.
    }
  }

  return createInitialIncomesState()
}

function isValidIncomesState(state) {
  return state && Array.isArray(state.incomes)
}

function normalizeIncome(income) {
  return {
    id: income.id,
    type: income.type ?? 'receivable',
    description: income.description ?? '',
    source: income.source ?? '',
    amount: normalizeAmount(income.amount),
    date: income.date ?? '',
    status: income.status ?? 'pending',
    recurring: Boolean(income.recurring),
    frequency: income.frequency ?? 'monthly',
    note: income.note ?? '',
    receivedAt: income.receivedAt ?? '',
    generatedFrom: income.generatedFrom,
    installmentGroupId: income.installmentGroupId ?? '',
    installmentsTotal: Number(income.installmentsTotal) || 1,
    installmentNumber: Number(income.installmentNumber) || 1,
  }
}

function normalizeAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const numericValue = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}
