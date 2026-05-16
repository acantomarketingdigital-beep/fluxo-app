import { queueCloudStateSync } from './cloudSyncQueue'
import {
  readScopedStorageItem,
  removeScopedStorageItem,
  writeScopedStorageItem,
} from './storageSession'

const STORAGE_KEY = 'fluxo:expenses-state'
const STORAGE_VERSION = 1

export function createInitialExpensesState() {
  return {
    expenses: [],
  }
}

export function loadExpensesState() {
  if (typeof window === 'undefined') {
    return createInitialExpensesState()
  }

  try {
    const savedState = readScopedStorageItem(STORAGE_KEY)

    if (!savedState) {
      return createInitialExpensesState()
    }

    const parsedState = JSON.parse(savedState)

    if (!isValidExpensesState(parsedState)) {
      return createInitialExpensesState()
    }

    return {
      expenses: parsedState.expenses.map(normalizeExpense),
    }
  } catch {
    return createInitialExpensesState()
  }
}

export function saveExpensesState({ expenses }) {
  saveExpensesStateLocal({ expenses })
  queueCloudStateSync('expenses', { expenses })
}

export function saveExpensesStateLocal({ expenses }) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    writeScopedStorageItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        expenses,
      }),
    )
  } catch {
    // The app should remain usable even when localStorage is blocked.
  }
}

export function resetExpensesData() {
  if (typeof window !== 'undefined') {
    try {
      removeScopedStorageItem(STORAGE_KEY)
    } catch {
      // Keep the in-memory reset working when storage cannot be changed.
    }
  }

  return createInitialExpensesState()
}

function isValidExpensesState(state) {
  return state && Array.isArray(state.expenses)
}

function normalizeExpense(expense) {
  return {
    id: expense.id,
    type: expense.type ?? 'single',
    description: expense.description ?? '',
    amount: normalizeAmount(expense.amount),
    totalAmount: normalizeAmount(expense.totalAmount),
    installmentsTotal: Number(expense.installmentsTotal) || 1,
    installmentNumber: Number(expense.installmentNumber) || 1,
    dueDate: expense.dueDate ?? '',
    status: expense.status ?? 'open',
    category: expense.category ?? '',
    note: expense.note ?? '',
    frequency: expense.frequency ?? 'monthly',
    alertEnabled: Boolean(expense.alertEnabled ?? expense.alert),
    alertTiming: expense.alertTiming ?? 'on_due',
    alertTime: expense.alertTime ?? '08:00',
    paidAt: expense.paidAt ?? '',
    paymentMethod: expense.paymentMethod ?? 'other',
    cardId: expense.cardId ?? '',
    cardName: expense.cardName ?? '',
    installmentGroupId: expense.installmentGroupId ?? '',
    recurringGroupId: expense.recurringGroupId ?? '',
  }
}

function normalizeAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const numericValue = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}
