let activeUserId = null

export function setStorageUser(userId) {
  activeUserId = userId || null
}

export function getStorageUser() {
  return activeUserId
}

export function readScopedStorageItem(baseKey) {
  if (typeof window === 'undefined') {
    return null
  }

  const scopedKey = getScopedStorageKey(baseKey)
  const scopedValue = window.localStorage.getItem(scopedKey)

  if (scopedValue || !activeUserId) {
    return scopedValue
  }

  const legacyValue = window.localStorage.getItem(baseKey)

  if (!legacyValue) {
    return null
  }

  window.localStorage.setItem(scopedKey, legacyValue)
  window.localStorage.removeItem(baseKey)

  return legacyValue
}

export function writeScopedStorageItem(baseKey, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(getScopedStorageKey(baseKey), value)
}

export function removeScopedStorageItem(baseKey) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(getScopedStorageKey(baseKey))
}

export function removeFluxoLocalStorageItems() {
  if (typeof window === 'undefined') {
    return
  }

  const dataPrefixes = [
    'fluxo:cards-state',
    'fluxo:expenses-state',
    'fluxo:incomes-state',
    'fluxo:transactions-state',
    'fluxo:sync-queue',
  ]
  const keysToRemove = []

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)

    if (dataPrefixes.some((prefix) => key === prefix || key?.startsWith(`${prefix}:`))) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}

function getScopedStorageKey(baseKey) {
  return activeUserId ? `${baseKey}:${activeUserId}` : baseKey
}
