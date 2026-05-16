import { emitToast } from '../lib/toastEvents'
import {
  FLUXO_DATA_TABLES,
  SUPABASE_SCHEMA,
  fromPublicTable,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase'

const SYNC_DELAY = 650
const SYNC_ERROR_TOAST_INTERVAL = 60_000
const DATABASE_NOT_CONFIGURED_MESSAGE =
  'Banco ainda não configurado. Seus dados ficam salvos neste dispositivo.'
const DATABASE_PERMISSION_MESSAGE =
  'Banco configurado, mas permissões/RLS precisam de ajuste. Dados locais preservados.'

const syncTimers = new Map()
const activeSyncs = new Set()
const pendingSyncStates = new Map()
let cloudSyncAccess = {
  enabled: true,
  message: 'Sincronização disponível.',
}
let cloudDatabaseAccess = {
  message: '',
  ready: true,
  reason: null,
}
let lastSyncErrorToast = {
  key: '',
  shownAt: 0,
}

const datasetConfig = {
  incomes: createSimpleDatasetConfig('incomes', 'incomes'),
  expenses: createSimpleDatasetConfig('expenses', 'expenses'),
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
  transactions: createSimpleDatasetConfig('transactions', 'transactions'),
}

export function queueCloudStateSync(dataset, state) {
  if (typeof window === 'undefined') {
    return
  }

  const unavailableResult = getCloudSyncUnavailableResult()

  if (unavailableResult) {
    publishSyncStatus(unavailableResult)
    return
  }

  window.clearTimeout(syncTimers.get(dataset))
  syncTimers.set(
    dataset,
    window.setTimeout(() => {
      runQueuedCloudSync(dataset, state)
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
  const unavailableResult = getCloudSyncUnavailableResult()

  if (unavailableResult) {
    return {
      enabled: false,
      message: unavailableResult.message,
      reason: unavailableResult.reason,
    }
  }

  return cloudSyncAccess
}

export function clearCloudSyncQueue() {
  if (typeof window !== 'undefined') {
    syncTimers.forEach((timer) => window.clearTimeout(timer))
  }

  syncTimers.clear()
  pendingSyncStates.clear()
}

export async function deleteCloudDataForCurrentUser() {
  const user = await getCurrentUser()

  if (!user || !supabase) {
    return createLocalStatus('Modo local ativo.', 'local')
  }

  const results = await Promise.all(
    Object.values(datasetConfig).map((config) => {
      const table = fromPublicTable(config.table)
      return table
        ? table.delete().eq('user_id', user.id)
        : Promise.resolve({ error: new Error('Supabase não configurado.') })
    }),
  )
  const failedResult = results.find((result) => result.error)

  if (failedResult) {
    const result = handleCloudSyncError(failedResult.error)
    throw new Error(result.message)
  }

  return {
    message: 'Dados removidos da nuvem.',
    state: 'synced',
    syncedAt: new Date().toISOString(),
  }
}

export async function validateFluxoCloudSchema() {
  if (!canUseCloudSync()) {
    return null
  }

  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  const checks = await Promise.all(
    FLUXO_DATA_TABLES.map(async (tableName) => {
      const table = fromPublicTable(tableName)

      if (!table) {
        return {
          error: new Error('Supabase não configurado.'),
          table: tableName,
        }
      }

      const { error } = await table
        .select(getValidationSelect(tableName), { count: 'exact', head: true })
        .limit(1)

      return {
        error,
        table: tableName,
      }
    }),
  )
  const failedCheck = checks.find((check) => check.error)

  if (failedCheck) {
    throw withTableContext(failedCheck.error, failedCheck.table)
  }

  logCloudSyncInfo('Supabase REST validou as tabelas do Fluxo.', {
    schema: SUPABASE_SCHEMA,
    tables: FLUXO_DATA_TABLES,
  })

  return checks
}

export async function fetchDatasetFromCloud(dataset) {
  const config = datasetConfig[dataset]
  const user = await getCurrentUser()

  if (!config || !user) {
    return null
  }

  const table = fromPublicTable(config.table)

  if (!table) {
    return null
  }

  const { data, error } = await table
    .select(config.select)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) {
    throw withTableContext(error, config.table)
  }

  logCloudSyncInfo(`PULL ${dataset}`, { rows: (data ?? []).length, userId: user.id })
  return config.deserialize(data ?? [])
}

export async function saveDatasetToCloud(dataset, state, { silent = true } = {}) {
  const config = datasetConfig[dataset]
  const user = await getCurrentUser()
  const unavailableResult = getCloudSyncUnavailableResult()

  if (!config || !user || unavailableResult) {
    return unavailableResult ?? createLocalStatus('Modo local ativo.', 'local')
  }

  const rows = config.serialize(state, user.id)

  logCloudSyncInfo(`PUSH ${dataset}`, { rows: rows.length, userId: user.id })
  publishSyncStatus({
    message: 'Sincronizando com a nuvem...',
    state: 'syncing',
  })

  const deleteTable = fromPublicTable(config.table)
  const { error: deleteError } = await deleteTable
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    throw withTableContext(deleteError, config.table)
  }

  if (rows.length > 0) {
    const upsertTable = fromPublicTable(config.table)
    const { error: insertError } = await upsertTable.upsert(rows, {
      onConflict: config.conflict,
    })

    if (insertError) {
      throw withTableContext(insertError, config.table)
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
  return !getCloudSyncUnavailableResult()
}

export function handleCloudSyncError(error, { shouldToast = true } = {}) {
  const diagnosis = diagnoseCloudSyncError(error)

  if (diagnosis.disablesSync) {
    cloudDatabaseAccess = {
      message: diagnosis.message,
      ready: false,
      reason: diagnosis.reason,
    }
    clearCloudSyncQueue()
  }

  const result = createLocalStatus(diagnosis.message, diagnosis.reason)

  publishSyncStatus(result)
  logCloudSyncDiagnostic(error, diagnosis)

  if (shouldToast) {
    emitThrottledSyncErrorToast(diagnosis)
  }

  return result
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

export function publishDataPulled() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent('fluxo:data-pulled'))
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

async function runQueuedCloudSync(dataset, state) {
  syncTimers.delete(dataset)

  if (activeSyncs.has(dataset)) {
    pendingSyncStates.set(dataset, state)
    return
  }

  activeSyncs.add(dataset)

  try {
    await saveDatasetToCloud(dataset, state)
  } catch (error) {
    handleCloudSyncError(error)
  } finally {
    activeSyncs.delete(dataset)

    const pendingState = pendingSyncStates.get(dataset)
    pendingSyncStates.delete(dataset)

    if (pendingState && canUseCloudSync()) {
      queueCloudStateSync(dataset, pendingState)
    }
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

function getCloudSyncUnavailableResult() {
  if (!cloudSyncAccess.enabled) {
    return createLocalStatus(cloudSyncAccess.message, 'access-disabled')
  }

  if (!cloudDatabaseAccess.ready) {
    return createLocalStatus(cloudDatabaseAccess.message, cloudDatabaseAccess.reason)
  }

  if (!isSupabaseConfigured || !supabase) {
    return createLocalStatus(
      'Modo local ativo. Configure o Supabase para sincronizar.',
      'supabase-env-missing',
    )
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return createLocalStatus('Modo local ativo. A nuvem volta quando houver conexão.', 'offline')
  }

  return null
}

function createLocalStatus(message, reason) {
  return {
    message,
    reason,
    state: 'local',
  }
}

function getValidationSelect(tableName) {
  return tableName === 'cards'
    ? 'local_id,record_type,data,sort_order,updated_at'
    : 'local_id,data,sort_order,updated_at'
}

function diagnoseCloudSyncError(error) {
  if (isSchemaSetupError(error)) {
    return {
      description:
        'Rode supabase/fluxo_schema.sql e recarregue o schema cache do PostgREST.',
      disablesSync: true,
      message: DATABASE_NOT_CONFIGURED_MESSAGE,
      reason: 'database-unconfigured',
      title: 'Banco ainda não configurado',
    }
  }

  if (isPermissionError(error)) {
    return {
      description: 'Revise grants e políticas RLS do supabase/fluxo_schema.sql.',
      disablesSync: true,
      message: DATABASE_PERMISSION_MESSAGE,
      reason: 'database-permissions',
      title: 'Permissões do banco bloqueando o sync',
    }
  }

  return {
    description: 'O app seguirá salvando localmente e tentará novamente quando possível.',
    disablesSync: false,
    message: 'Não foi possível sincronizar. O fallback local está ativo.',
    reason: 'sync-error',
    title: 'Sincronização em modo local',
  }
}

function isSchemaSetupError(error) {
  const code = String(error?.code ?? '')
  const text = getErrorText(error)

  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === 'PGRST106' ||
    code === '42P01' ||
    code === '3F000' ||
    /schema cache/i.test(text) ||
    /could not find the table/i.test(text) ||
    /could not find .* column/i.test(text) ||
    /relation .* does not exist/i.test(text) ||
    /schema .* does not exist/i.test(text)
  )
}

function isPermissionError(error) {
  const code = String(error?.code ?? '')
  const text = getErrorText(error)

  return (
    code === '42501' ||
    /permission denied/i.test(text) ||
    /row-level security/i.test(text) ||
    /violates row-level security/i.test(text)
  )
}

function getErrorText(error) {
  return [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
}

function withTableContext(error, tableName) {
  if (error && typeof error === 'object') {
    error.fluxoTable = tableName
    return error
  }

  const nextError = new Error(String(error ?? 'Erro de sincronização.'))
  nextError.fluxoTable = tableName
  return nextError
}

function emitThrottledSyncErrorToast(diagnosis) {
  const now = Date.now()

  if (
    lastSyncErrorToast.key === diagnosis.reason &&
    now - lastSyncErrorToast.shownAt < SYNC_ERROR_TOAST_INTERVAL
  ) {
    return
  }

  lastSyncErrorToast = {
    key: diagnosis.reason,
    shownAt: now,
  }

  emitToast({
    description: diagnosis.description,
    title: diagnosis.title,
    tone: 'warning',
  })
}

function logCloudSyncDiagnostic(error, diagnosis) {
  if (typeof console === 'undefined') {
    return
  }

  console.warn('[Fluxo Sync] Supabase em modo local.', {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    message: error?.message,
    reason: diagnosis.reason,
    schema: SUPABASE_SCHEMA,
    table: error?.fluxoTable,
    tables: FLUXO_DATA_TABLES,
  })
}

function logCloudSyncInfo(message, detail) {
  if (typeof console === 'undefined') {
    return
  }

  console.info('[Fluxo Sync]', message, detail)
}
