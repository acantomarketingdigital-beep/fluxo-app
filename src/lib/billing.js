import { supabase } from './supabase'

export async function startCheckout(plan) {
  const data = await postBillingRequest('/api/create-checkout-session', { plan })

  if (!data.url) {
    throw new Error('Checkout indisponível no momento.')
  }

  window.location.assign(data.url)
}

export async function openBillingPortal() {
  const data = await postBillingRequest('/api/create-portal-session')

  if (!data.url) {
    throw new Error('Portal indisponível no momento.')
  }

  window.location.assign(data.url)
}

async function postBillingRequest(path, body = {}) {
  const token = await getAccessToken()
  let response

  try {
    response = await fetch(path, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor de cobrança.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível conectar com a cobrança.')
  }

  return data
}

async function getAccessToken() {
  if (!supabase) {
    throw new Error('Configure o Supabase antes de assinar.')
  }

  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session?.access_token) {
    throw new Error('Faça login novamente para continuar.')
  }

  return data.session.access_token
}
