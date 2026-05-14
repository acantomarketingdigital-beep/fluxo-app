import { emitToast } from '../lib/toastEvents'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const SYNC_DELAY = 650
const syncTimers = new Map()
let cloudSyncAccess = {
  enabled: true,
  message: 'Sincronização disponível.',
}

const datasetConfig = {
  cards: {
    conflict: 'user_id,record_type,local_id',
    deserialize: (rows) => ({
      cards: deserializeRows(rows.filter((row) => row.record_type === 'card')),
      purchases: deserializeRows(rows.filter((row) => row.record_type === 'purchase')),
    }),
    select: 'local_id,record_type,data,sort_order,updated_at',
    serialize: (state, userId) => [
      ...serializeRows({
        items: state.cards,
        recordType: 'card',
        userId,
      }),
      ...serializeRows({
        items: state.purchases,
        recordType: 'purchase',
        userId,
      }),
    ],
    table: 'cards',
  },
  expenses: createSimpleDatasetConfig('expenses', 'expenses'),
  incomes: createSimpleDatasetConfig('incomes', 'incomes'),
  transactions: createSimpleDatasetConfig('transactions', 'transactions'),
}

export function queueCloudStateSync(dataset, state) {
  if (typeof window === 'undefined') {
    return
  }

  if (!canUseCloudSync()) {
    publishSyncStatus({
      message: !cloudSyncAccess.enabled
        ? cloudSyncAccess.message
        : isSupabaseConfigured
        ? 'Modo local ativo. A nuvem volta quando houver conexão.'
        : 'Modo local ativo. Configure o Supabase para sincronizar.',
      state: 'local',
    })
    return
  }

  window.clearTimeout(syncTimers.get(dataset))
  syncTimers.set(
    dataset,
    window.setTimeout(() => {
      saveDatasetToCloud(dataset, state).catch((error) => reportSyncError(error))
    }, SYNC_DELAY),
  )
}

export function setCloudSyncAccess(nextAccess) {
  cloudSyncAccess = {
    enabled: nextAccess?.enabled ?? true,
    message: nextAccess?.message ?? 'Sincronização disponível.',
  }
}

export function getCloudSyncAccess() {
  return cloudSyncAccess
}

export async function fetchDatasetFromCloud(dataset) {
  const config = datasetConfig[dataset]
  const user = await getCurrentUser()

  if (!config || !user) {
    return null
  }

  const { data, error } = await supabase
    .from(config.table)
    .select(config.select)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) {
    throw error
  }

  return config.deserialize(data ?? [])
}

export async function saveDatasetToCloud(dataset, state, { silent = true } = {}) {
  const config = datasetConfig[dataset]
  const user = await getCurrentUser()

  if (!config || !user || !canUseCloudSync()) {
    return {
      message: 'Modo local ativo.',
      state: 'local',
    }
  }

  const rows = config.serialize(state, user.id)

  publishSyncStatus({
    message: 'Sincronizando com a nuvem...',
    state: 'syncing',
  })

  const { error: deleteError } = await supabase
    .from(config.table)
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    throw deleteError
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from(config.table).upsert(rows, {
      onConflict: config.conflict,
    })

    if (insertError) {
      throw insertError
    }
  }

  const result = {
    message: 'Dados sincronizados na nuvem.',
    state: 'synced',
    syncedAt: new Date().toISOString(),
  }

  publishSyncStatus(result)

  if (!silent) {
    emitToast({
      description: 'O backup do Fluxo está atualizado.',
      title: 'Sincronização concluída',
      tone: 'success',
    })
  }

  return result
}

export function canUseCloudSync() {
  if (!cloudSyncAccess.enabled) {
    return false
  }

  if (!isSupabaseConfigured || !supabase) {
    return false
  }

  if (typeof navigator === 'undefined') {
    return true
  }

  return navigator.onLine
}

export function publishSyncStatus(detail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('fluxo:sync-status', {
      detail,
    }),
  )
}

function createSimpleDatasetConfig(table, stateKey) {
  return {
    conflict: 'user_id,local_id',
    deserialize: (rows) => ({
      [stateKey]: deserializeRows(rows),
    }),
    select: 'local_id,data,sort_order,updated_at',
    serialize: (state, userId) =>
      serializeRows({
        items: state[stateKey],
        userId,
      }),
    table,
  }
}

function serializeRows({ items = [], recordType, userId }) {
  return items.map((item, index) => {
    const row = {
      data: item,
      local_id: String(item.id),
      sort_order: index,
      user_id: userId,
    }

    if (recordType) {
      row.record_type = recordType
    }

    return row
  })
}

function deserializeRows(rows) {
  return [...rows]
    .sort((current, next) => current.sort_order - next.sort_order)
    .map((row) => row.data)
}

async function getCurrentUser() {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return data.user
}

function reportSyncError(error) {
  publishSyncStatus({
    message: 'Não foi possível sincronizar. O fallback local está ativo.',
    state: 'local',
  })

  emitToast({
    description: getErrorMessage(error),
    title: 'Sincronização em modo local',
    tone: 'warning',
  })
}

function getErrorMessage(error) {
  if (!error?.message) {
    return 'Confira as tabelas e políticas no Supabase.'
  }

  return error.message
}
