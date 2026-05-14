import { emitToast } from '../lib/toastEvents'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  canUseCloudSync,
  fetchDatasetFromCloud,
  getCloudSyncAccess,
  publishSyncStatus,
  saveDatasetToCloud,
} from './cloudSyncQueue'
import {
  loadCardsState,
  saveCardsStateLocal,
} from './cardsStorage'
import {
  loadExpensesState,
  saveExpensesStateLocal,
} from './expensesStorage'
import {
  loadIncomesState,
  saveIncomesStateLocal,
} from './incomesStorage'
import {
  loadTransactionsState,
  saveTransactionsStateLocal,
} from './transactionsStorage'
import { setStorageUser } from './storageSession'

const datasets = [
  {
    hasData: (state) => state.incomes.length > 0,
    loadLocal: loadIncomesState,
    name: 'incomes',
    saveLocal: saveIncomesStateLocal,
  },
  {
    hasData: (state) => state.expenses.length > 0,
    loadLocal: loadExpensesState,
    name: 'expenses',
    saveLocal: saveExpensesStateLocal,
  },
  {
    hasData: (state) => state.cards.length > 0 || state.purchases.length > 0,
    loadLocal: loadCardsState,
    name: 'cards',
    saveLocal: saveCardsStateLocal,
  },
  {
    hasData: (state) => state.transactions.length > 0,
    loadLocal: loadTransactionsState,
    name: 'transactions',
    saveLocal: saveTransactionsStateLocal,
  },
]

export async function prepareCloudBackedStorage(userId) {
  setStorageUser(userId)

  if (!isSupabaseConfigured) {
    const result = {
      message: 'Modo local ativo. Configure o Supabase para sincronizar.',
      state: 'local',
    }
    publishSyncStatus(result)
    return result
  }

  if (!canUseCloudSync()) {
    const syncAccess = getCloudSyncAccess()
    const result = {
      message: syncAccess.enabled
        ? 'Sem conexão agora. Salvando localmente.'
        : syncAccess.message,
      state: 'local',
    }
    publishSyncStatus(result)
    return result
  }

  let pulledFromCloud = 0
  let seededCloud = 0

  for (const dataset of datasets) {
    const cloudState = await fetchDatasetFromCloud(dataset.name)

    if (cloudState && dataset.hasData(cloudState)) {
      dataset.saveLocal(cloudState)
      pulledFromCloud += 1
    } else {
      const localState = dataset.loadLocal()

      if (dataset.hasData(localState)) {
        await saveDatasetToCloud(dataset.name, localState)
        seededCloud += 1
      }
    }
  }

  const result = {
    message:
      pulledFromCloud > 0
        ? 'Dados carregados da nuvem.'
        : 'Backup inicial preparado na nuvem.',
    state: 'synced',
    syncedAt: new Date().toISOString(),
  }

  publishSyncStatus(result)

  if (pulledFromCloud > 0 || seededCloud > 0) {
    emitToast({
      description: 'Seu espaço Fluxo está pronto.',
      title: 'Sincronização ativa',
      tone: 'success',
    })
  }

  return result
}

export async function pushLocalStorageToCloud() {
  if (!canUseCloudSync()) {
    const syncAccess = getCloudSyncAccess()
    const result = {
      message: syncAccess.enabled
        ? 'Modo local ativo. A nuvem volta quando houver conexão.'
        : syncAccess.message,
      state: 'local',
    }
    publishSyncStatus(result)
    return result
  }

  for (const dataset of datasets) {
    await saveDatasetToCloud(dataset.name, dataset.loadLocal())
  }

  const result = {
    message: 'Dados sincronizados na nuvem.',
    state: 'synced',
    syncedAt: new Date().toISOString(),
  }

  publishSyncStatus(result)
  return result
}
