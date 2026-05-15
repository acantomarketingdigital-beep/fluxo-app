import { initialCards, initialPurchases } from '../data/cards.js'
import { queueCloudStateSync } from './cloudSyncQueue'
import {
  readScopedStorageItem,
  removeScopedStorageItem,
  writeScopedStorageItem,
} from './storageSession'

const STORAGE_KEY = 'fluxo:cards-state'
const STORAGE_VERSION = 1

export function createInitialCardsState() {
  return {
    cards: initialCards.map(normalizeCard),
    purchases: initialPurchases.map(normalizePurchase),
  }
}

export function loadCardsState() {
  if (typeof window === 'undefined') {
    return createInitialCardsState()
  }

  try {
    const savedState = readScopedStorageItem(STORAGE_KEY)

    if (!savedState) {
      return createInitialCardsState()
    }

    const parsedState = JSON.parse(savedState)

    if (!isValidCardsState(parsedState)) {
      return createInitialCardsState()
    }

    return {
      cards: parsedState.cards.map(normalizeCard),
      purchases: parsedState.purchases.map(normalizePurchase),
    }
  } catch {
    return createInitialCardsState()
  }
}

function normalizeCard(card) {
  return {
    ...card,
    invoice: normalizeAmount(card.invoice),
    totalLimit: normalizeAmount(card.totalLimit),
    availableLimit: normalizeAmount(card.availableLimit),
    invoiceCycle: Number(card.invoiceCycle) || 0,
  }
}

function normalizePurchase(purchase) {
  const installments = Number(purchase.installments) || 1
  const cardId =
    purchase.cardId ??
    initialCards.find((card) => card.name === purchase.cardName)?.id ??
    ''

  return {
    ...purchase,
    cardId,
    amount: normalizeAmount(purchase.amount),
    invoiceCharge: normalizeAmount(purchase.invoiceCharge),
    installments,
    billedInstallments: Math.min(
      Number(purchase.billedInstallments) || 1,
      installments,
    ),
  }
}

function normalizeAmount(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const numericValue = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function saveCardsState({ cards, purchases }) {
  saveCardsStateLocal({ cards, purchases })
  queueCloudStateSync('cards', { cards, purchases })
}

export function saveCardsStateLocal({ cards, purchases }) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    writeScopedStorageItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        cards,
        purchases,
      }),
    )
  } catch {
    // Ignore storage failures so the app keeps working in private/restricted contexts.
  }
}

export function resetCardsDemoData() {
  if (typeof window !== 'undefined') {
    try {
      removeScopedStorageItem(STORAGE_KEY)
    } catch {
      // Same fallback posture as saving: reset in memory even if storage is blocked.
    }
  }

  return createInitialCardsState()
}

export function createInvoiceReference(card) {
  return `${card.id}-fatura-${Number(card.invoiceCycle) || 0}`
}

export function rollInstallmentsIntoNextInvoice(purchases, card) {
  let nextInvoice = 0

  const nextPurchases = purchases.map((purchase) => {
    const belongsToCard = purchase.cardId
      ? purchase.cardId === card.id
      : purchase.cardName === card.name
    const totalInstallments = Number(purchase.installments) || 1
    const billedInstallments = Number(purchase.billedInstallments) || 1

    if (!belongsToCard || totalInstallments <= 1 || billedInstallments >= totalInstallments) {
      return purchase
    }

    nextInvoice += purchase.invoiceCharge

    return {
      ...purchase,
      billedInstallments: billedInstallments + 1,
    }
  })

  return {
    nextInvoice,
    purchases: nextPurchases,
  }
}

function isValidCardsState(state) {
  return (
    state &&
    Array.isArray(state.cards) &&
    Array.isArray(state.purchases)
  )
}
