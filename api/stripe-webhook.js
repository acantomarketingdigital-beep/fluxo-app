import {
  createStripeClient,
  createSupabaseAdminClient,
  getStripeId,
  getWebhookSecret,
  normalizeSubscriptionStatus,
  readRawBody,
  sendJson,
  updateSubscriptionFromStripe,
} from './_billing.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Método não permitido.' })
  }

  const stripe = createStripeClient()
  const supabaseAdmin = createSupabaseAdminClient()
  const signature = req.headers['stripe-signature']
  const rawBody = await readRawBody(req)
  const webhookSecret = getWebhookSecret()
  let event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    )
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`)
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted({ event, stripe, supabaseAdmin })
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await handleSubscriptionEvent({ event, stripe, supabaseAdmin })
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
      await handleInvoiceEvent({
        event,
        statusOverride: 'active',
        stripe,
        supabaseAdmin,
      })
    } else if (event.type === 'invoice.payment_failed') {
      await handleInvoiceEvent({
        event,
        statusOverride: 'past_due',
        stripe,
        supabaseAdmin,
      })
    }

    return sendJson(res, 200, { received: true })
  } catch (error) {
    return res.status(500).send(`Webhook handler failed: ${error.message}`)
  }
}

async function handleCheckoutCompleted({ event, stripe, supabaseAdmin }) {
  const session = event.data.object
  const userId = session.client_reference_id || session.metadata?.supabase_user_id
  const subscriptionId = getStripeId(session.subscription)

  if (!userId || !subscriptionId) {
    return
  }

  const { error } = await supabaseAdmin.from('profiles').upsert(
    {
      email: session.customer_details?.email ?? session.customer_email ?? null,
      id: userId,
      stripe_customer_id: getStripeId(session.customer),
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw error
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  })

  await updateSubscriptionFromStripe({
    stripe,
    subscription,
    supabaseAdmin,
  })
}

async function handleSubscriptionEvent({ event, stripe, supabaseAdmin }) {
  const subscription = event.data.object
  const statusOverride =
    event.type === 'customer.subscription.deleted'
      ? 'canceled'
      : normalizeSubscriptionStatus(subscription.status)

  await updateSubscriptionFromStripe({
    statusOverride,
    stripe,
    subscription,
    supabaseAdmin,
  })
}

async function handleInvoiceEvent({ event, statusOverride, stripe, supabaseAdmin }) {
  const invoice = event.data.object
  const subscriptionId = getInvoiceSubscriptionId(invoice)

  if (!subscriptionId) {
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  })

  await updateSubscriptionFromStripe({
    statusOverride,
    stripe,
    subscription,
    supabaseAdmin,
  })
}

function getInvoiceSubscriptionId(invoice) {
  return getStripeId(
    invoice.subscription ||
      (invoice.parent?.type === 'subscription_details'
        ? invoice.parent.subscription_details?.subscription
        : null),
  )
}
