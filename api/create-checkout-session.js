import {
  assertPost,
  createStripeClient,
  createSupabaseAdminClient,
  getAppUrl,
  getOrCreateStripeCustomer,
  getPriceId,
  getTrialDaysRemaining,
  handleApiError,
  readJsonBody,
  requireAuthenticatedUser,
  sendJson,
} from './_billing.js'

export default async function handler(req, res) {
  try {
    assertPost(req)

    const { plan = 'monthly' } = await readJsonBody(req)
    const stripe = createStripeClient()
    const supabaseAdmin = createSupabaseAdminClient()
    const user = await requireAuthenticatedUser(req, supabaseAdmin)
    const { customerId, profile } = await getOrCreateStripeCustomer({
      stripe,
      supabaseAdmin,
      user,
    })
    const appUrl = getAppUrl(req)
    const existingSubscription = await findManageableSubscription(stripe, customerId)

    if (existingSubscription) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/?billing=return`,
      })

      return sendJson(res, 200, { url: portalSession.url })
    }

    const priceId = getPriceId(plan)
    const trialDaysRemaining = getTrialDaysRemaining(profile, user)
    const subscriptionData = {
      metadata: {
        plan,
        supabase_user_id: user.id,
      },
    }

    if (trialDaysRemaining > 0) {
      subscriptionData.trial_period_days = trialDaysRemaining
    }

    const session = await stripe.checkout.sessions.create({
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: user.id,
      customer: customerId,
      customer_update: {
        name: 'auto',
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        plan,
        supabase_user_id: user.id,
      },
      mode: 'subscription',
      payment_method_collection: 'always',
      subscription_data: subscriptionData,
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled`,
    })

    sendJson(res, 200, { url: session.url })
  } catch (error) {
    handleApiError(res, error)
  }
}

async function findManageableSubscription(stripe, customerId) {
  const manageableStatuses = new Set([
    'active',
    'incomplete',
    'past_due',
    'paused',
    'trialing',
    'unpaid',
  ])
  const { data } = await stripe.subscriptions.list({
    customer: customerId,
    limit: 10,
    status: 'all',
  })

  return data.find((subscription) => manageableStatuses.has(subscription.status))
}
