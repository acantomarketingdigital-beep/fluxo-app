import {
  assertPost,
  createHttpError,
  createStripeClient,
  createSupabaseAdminClient,
  getAppUrl,
  handleApiError,
  requireAuthenticatedUser,
  sendJson,
} from './_billing.js'

const PORTAL_ELIGIBLE_STATUSES = ['active', 'trialing', 'past_due']
const STRIPE_MANAGEABLE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']

export default async function handler(req, res) {
  try {
    assertPost(req)

    const stripe = createStripeClient()
    const supabaseAdmin = createSupabaseAdminClient()
    const user = await requireAuthenticatedUser(req, supabaseAdmin)
    const [{ data: profile, error: profileError }, { data: subscription, error: subscriptionError }] =
      await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('stripe_customer_id, stripe_subscription_id, subscription_status')
          .eq('id', user.id)
          .maybeSingle(),
        supabaseAdmin
          .from('subscriptions')
          .select('stripe_customer_id, stripe_subscription_id, status')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    if (profileError || subscriptionError) {
      throw createHttpError(500, 'Não foi possível carregar sua assinatura.')
    }

    const customerId = profile?.stripe_customer_id || subscription?.stripe_customer_id
    const localStatus = profile?.subscription_status || subscription?.status

    if (!customerId) {
      throw createHttpError(404, 'Você ainda não possui assinatura ativa.')
    }

    if (!PORTAL_ELIGIBLE_STATUSES.includes(localStatus)) {
      const hasStripeSubscription = await hasManageableStripeSubscription(stripe, customerId)

      if (!hasStripeSubscription) {
        throw createHttpError(404, 'Você ainda não possui assinatura ativa.')
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl(req)}/?billing=return`,
    })

    sendJson(res, 200, { url: session.url })
  } catch (error) {
    handleApiError(res, error)
  }
}

async function hasManageableStripeSubscription(stripe, customerId) {
  const { data: subscriptions } = await stripe.subscriptions.list({
    customer: customerId,
    limit: 10,
    status: 'all',
  })

  return subscriptions.some((subscription) => STRIPE_MANAGEABLE_STATUSES.includes(subscription.status))
}
