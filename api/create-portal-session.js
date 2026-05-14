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

export default async function handler(req, res) {
  try {
    assertPost(req)

    const stripe = createStripeClient()
    const supabaseAdmin = createSupabaseAdminClient()
    const user = await requireAuthenticatedUser(req, supabaseAdmin)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      throw createHttpError(500, 'Não foi possível carregar sua assinatura.')
    }

    if (!profile?.stripe_customer_id) {
      throw createHttpError(404, 'Nenhuma assinatura Stripe foi encontrada para esta conta.')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppUrl(req)}/?billing=return`,
    })

    sendJson(res, 200, { url: session.url })
  } catch (error) {
    handleApiError(res, error)
  }
}
