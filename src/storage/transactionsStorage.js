import { queueCloudStateSync } from './cloudSyncQueue'
import {
  readScopedStorageItem,
  writeScopedStorageItem,
} from './storageSession'

const STORAGE_KEY = 'fluxo:transactions-state'
const STORAGE_VERSION = 1

export function createInitialTransactionsState() {
  return {
    transactions: [],
  }
}

export function loadTransactionsState() {
  if (typeof window === 'undefined') {
    return createInitialTransactionsState()
  }

  try {
    const savedState = readScopedStorageItem(STORAGE_KEY)

    if (!savedState) {
      return createInitialTransactionsState()
    }

    const parsedState = JSON.parse(savedState)

    if (!isValidTransactionsState(parsedState)) {
      return createInitialTransactionsState()
    }

    return {
      transactions: parsedState.transactions.map(normalizeTransaction),
    }
  } catch {
    return createInitialTransactionsState()
  }
}

export function saveTransactionsState({ transactions }) {
  saveTransactionsStateLocal({ transactions })
  queueCloudStateSync('transactions', { transactions })
}

export function saveTransactionsStateLocal({ transactions }) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    writeScopedStorageItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        transactions,
      }),
    )
  } catch {
    // Local history is helpful, but the app must keep working without storage.
  }
}

export function recordTransaction(transaction) {
  const currentState = loadTransactionsState()
  const nextTransaction = normalizeTransaction(transaction)
  const alreadyExists = currentState.transactions.some((currentTransaction) =>
    isSameTransactionReference(currentTransaction, nextTransaction),
  )

  if (alreadyExists) {
    return currentState
  }

  const nextState = {
    transactions: [nextTransaction, ...currentState.transactions],
  }

  saveTransactionsState(nextState)
  return nextState
}

export function hasTransactionForReference({ origin, referenceId, type }) {
  return loadTransactionsState().transactions.some(
    (transaction) =>
      transaction.origin === origin &&
      String(transaction.referenceId) === String(referenceId) &&
      (!type || transaction.type === type),
  )
}

function isValidTransactionsState(state) {
  return state && Array.isArray(state.transactions)
}

function isSameTransactionReference(currentTransaction, nextTransaction) {
  return (
    currentTransaction.type === nextTransaction.type &&
    currentTransaction.origin === nextTransaction.origin &&
    String(currentTransaction.referenceId) === String(nextTransaction.referenceId)
  )
}

function normalizeTransaction(transaction) {
  return {
    id: transaction.id ?? createTransactionId(),
    type: transaction.type === 'entrada' ? 'entrada' : 'saida',
    description: transaction.description ?? '',
    amount: normalizeAmount(transaction.amount),
    date: transaction.date ?? getTodayDate(),
    origin: transaction.origin ?? 'despesa',
    referenceId: transaction.referenceId ?? '',
  }
}

function normalizeAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const numericValue = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}

function createTransactionId() {
  return `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
