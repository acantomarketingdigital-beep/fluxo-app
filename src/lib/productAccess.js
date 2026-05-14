const TRIAL_DAYS = 30
const DAY_IN_MS = 24 * 60 * 60 * 1000

export function createProductAccess(user, profile = {}) {
  const createdAt = profile.accountCreatedAt || user?.created_at || new Date().toISOString()
  const trialEndsAt = profile.trialEndsAt || addDays(createdAt, TRIAL_DAYS)
  const daysRemaining = calculateDaysRemaining(trialEndsAt)
  const billingStatus = profile.subscriptionStatus || (daysRemaining > 0 ? 'trialing' : 'free')
  const plan = profile.plan || user?.user_metadata?.fluxo_plan || 'trial'
  const hasStripeSubscription = Boolean(
    profile.subscriptionStatus && profile.subscriptionStatus !== 'free',
  )
  const hasBillingBlock = billingStatus === 'past_due' || billingStatus === 'canceled'
  const hasActiveSubscription =
    hasStripeSubscription && (billingStatus === 'active' || billingStatus === 'trialing')
  const isTrialActive = !hasActiveSubscription && !hasBillingBlock && daysRemaining > 0
  const isPremium = hasActiveSubscription || isTrialActive
  const label = createAccessLabel({
    billingStatus,
    daysRemaining,
    hasActiveSubscription,
    isTrialActive,
    plan,
  })

  return {
    accountCreatedAt: createdAt,
    billingStatus,
    daysRemaining,
    isPremium,
    isTrialActive,
    isTrialExpired: !hasActiveSubscription && daysRemaining === 0,
    label,
    plan,
    trialEndsAt,
  }
}

export function isOnboardingComplete(user, profile = {}) {
  return Boolean(
    profile.onboardingCompleted ||
      user?.user_metadata?.onboarding_completed ||
      user?.user_metadata?.fluxo_onboarding_completed,
  )
}

function calculateDaysRemaining(trialEndsAt) {
  const endTime = new Date(trialEndsAt).getTime()

  if (!Number.isFinite(endTime)) {
    return TRIAL_DAYS
  }

  const remaining = Math.ceil((endTime - Date.now()) / DAY_IN_MS)
  return Math.max(0, remaining)
}

function createAccessLabel({
  billingStatus,
  daysRemaining,
  hasActiveSubscription,
  isTrialActive,
  plan,
}) {
  if (billingStatus === 'past_due') {
    return 'Pagamento pendente'
  }

  if (billingStatus === 'canceled') {
    return 'Assinatura cancelada'
  }

  if (hasActiveSubscription && plan === 'yearly') {
    return 'Premium anual ativo'
  }

  if (hasActiveSubscription && plan === 'monthly') {
    return 'Premium mensal ativo'
  }

  if (hasActiveSubscription) {
    return 'Premium ativo'
  }

  if (isTrialActive) {
    return `Teste grátis - ${daysRemaining} dias restantes`
  }

  return 'Plano básico gratuito'
}

function addDays(date, days) {
  const nextDate = new Date(date)

  if (Number.isNaN(nextDate.getTime())) {
    return addDays(new Date().toISOString(), days)
  }

  nextDate.setDate(nextDate.getDate() + days)
  return nextDate.toISOString()
}
