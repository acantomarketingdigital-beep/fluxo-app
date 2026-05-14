import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const STRIPE_API_VERSION = '2026-02-25.clover'
const TRIAL_DAYS = 30
const DAY_IN_MS = 24 * 60 * 60 * 1000

export function createStripeClient() {
  return new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
    apiVersion: STRIPE_API_VERSION,
  })
}

export function createSupabaseAdminClient() {
  return createClient(
    requiredEnv('VITE_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export async function requireAuthenticatedUser(req, supabaseAdmin) {
  const token = getBearerToken(req)

  if (!token) {
    throw createHttpError(401, 'Sessão inválida. Faça login novamente.')
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    throw createHttpError(401, 'Sessão inválida. Faça login novamente.')
  }

  return data.user
}

export async function getOrCreateStripeCustomer({ stripe, supabaseAdmin, user }) {
  const profile = await getProfileByUserId(supabaseAdmin, user.id)

  if (profile?.stripe_customer_id) {
    return {
      customerId: profile.stripe_customer_id,
      profile,
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      supabase_user_id: user.id,
    },
    name: user.user_metadata?.full_name,
  })
  const accountCreatedAt = profile?.account_created_at || user.created_at || new Date().toISOString()
  const trialEndsAt = profile?.trial_ends_at || addDays(accountCreatedAt, TRIAL_DAYS)
  const nextProfile = {
    account_created_at: accountCreatedAt,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? null,
    id: user.id,
    stripe_customer_id: customer.id,
    subscription_status: profile?.subscription_status || 'free',
    trial_ends_at: trialEndsAt,
    trial_started_at: profile?.trial_started_at || accountCreatedAt,
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(nextProfile, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    throw createHttpError(500, 'Não foi possível preparar o perfil de cobrança.')
  }

  return {
    customerId: customer.id,
    profile: data,
  }
}

export async function updateSubscriptionFromStripe({
  statusOverride,
  stripe,
  subscription,
  supabaseAdmin,
}) {
  if (!subscription?.id) {
    return null
  }

  const customerId = getStripeId(subscription.customer)
  const userId =
    subscription.metadata?.supabase_user_id ||
    (customerId ? await findUserIdByCustomerId(supabaseAdmin, customerId) : null)

  if (!userId) {
    return null
  }

  const item = subscription.items?.data?.[0]
  const price = item?.price
  const status = normalizeSubscriptionStatus(statusOverride || subscription.status)
  const planInterval = getPlanInterval(price)
  const subscriptionRecord = {
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: formatStripeTimestamp(subscription.canceled_at),
    current_period_end: formatStripeTimestamp(subscription.current_period_end),
    current_period_start: formatStripeTimestamp(subscription.current_period_start),
    plan_interval: planInterval,
    status,
    stripe_customer_id: customerId,
    stripe_price_id: price?.id ?? null,
    stripe_subscription_id: subscription.id,
    user_id: userId,
  }

  const { error: subscriptionError } = await supabaseAdmin
    .from('subscriptions')
    .upsert(subscriptionRecord, { onConflict: 'stripe_subscription_id' })

  if (subscriptionError) {
    throw subscriptionError
  }

  const customer = customerId ? await safeRetrieveCustomer(stripe, customerId) : null
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      email: customer?.email ?? null,
      full_name: customer?.name ?? null,
      id: userId,
      plan_interval: planInterval,
      stripe_customer_id: customerId,
      stripe_price_id: price?.id ?? null,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    throw profileError
  }

  return subscriptionRecord
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    if (Buffer.isBuffer(req.body)) {
      return req.body.length > 0 ? JSON.parse(req.body.toString('utf8')) : {}
    }

    return req.body
  }

  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {}
  }

  const rawBody = await readRawBody(req)
  return rawBody.length > 0 ? JSON.parse(rawBody.toString('utf8')) : {}
}

export function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body)
  }

  if (typeof req.body === 'string') {
    return Promise.resolve(Buffer.from(req.body, 'utf8'))
  }

  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload)
}

export function handleApiError(res, error) {
  const statusCode = error.statusCode || 500
  sendJson(res, statusCode, {
    error: error.publicMessage || 'Não foi possível processar a cobrança agora.',
  })
}

export function assertPost(req) {
  if (req.method !== 'POST') {
    throw createHttpError(405, 'Método não permitido.')
  }
}

export function getAppUrl(req) {
  const configuredUrl = process.env.APP_URL

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '')
  }

  const host = req.headers.host
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  return `${protocol}://${host}`
}

export function getPriceId(plan) {
  assertBillingPlan(plan)

  if (plan === 'yearly') {
    return requiredEnv('STRIPE_PRICE_YEARLY')
  }

  return requiredEnv('STRIPE_PRICE_MONTHLY')
}

export function getTrialDaysRemaining(profile, user) {
  const accountCreatedAt = profile?.account_created_at || user?.created_at || new Date().toISOString()
  const trialEndsAt = profile?.trial_ends_at || addDays(accountCreatedAt, TRIAL_DAYS)
  const remainingDays = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY_IN_MS)

  return Math.max(0, remainingDays)
}

export function normalizeSubscriptionStatus(status) {
  if (status === 'active' || status === 'trialing' || status === 'past_due' || status === 'canceled') {
    return status
  }

  if (status === 'incomplete_expired' || status === 'unpaid') {
    return 'canceled'
  }

  return 'free'
}

export function createHttpError(statusCode, publicMessage) {
  const error = new Error(publicMessage)
  error.publicMessage = publicMessage
  error.statusCode = statusCode
  return error
}

export function getStripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function getWebhookSecret() {
  return requiredEnv('STRIPE_WEBHOOK_SECRET')
}

async function getProfileByUserId(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw createHttpError(500, 'Não foi possível carregar o perfil de cobrança.')
  }

  return data
}

async function findUserIdByCustomerId(supabaseAdmin, customerId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.id ?? null
}

async function safeRetrieveCustomer(stripe, customerId) {
  try {
    const customer = await stripe.customers.retrieve(customerId)
    return customer.deleted ? null : customer
  } catch {
    return null
  }
}

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw createHttpError(500, `Variável ${name} não configurada.`)
  }

  return value
}

function assertBillingPlan(plan) {
  if (plan !== 'monthly' && plan !== 'yearly') {
    throw createHttpError(400, 'Plano inválido.')
  }
}

function addDays(date, days) {
  const nextDate = new Date(date)

  if (Number.isNaN(nextDate.getTime())) {
    return addDays(new Date().toISOString(), days)
  }

  nextDate.setDate(nextDate.getDate() + days)
  return nextDate.toISOString()
}

function formatStripeTimestamp(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null
}

function getPlanInterval(price) {
  if (price?.recurring?.interval === 'year') {
    return 'yearly'
  }

  if (price?.recurring?.interval === 'month') {
    return 'monthly'
  }

  return null
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization

  if (!header || !header.startsWith('Bearer ')) {
    return null
  }

  return header.slice('Bearer '.length)
}
