import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { startCheckout } from '../lib/billing'

const premiumBenefits = [
  {
    detail: 'Cadastre todos os cartões da casa ou do negócio, com limite e fatura individual.',
    label: 'Múltiplos cartões',
  },
  {
    detail: 'Visões avançadas de risco, comprometimento de renda e previsão mensal.',
    label: 'Relatórios avançados',
  },
  {
    detail: 'Backup contínuo entre dispositivos enquanto o plano estiver ativo.',
    label: 'Sincronização ilimitada',
  },
  {
    detail: 'Portal Stripe para trocar cartão, atualizar cobrança ou cancelar.',
    label: 'Gestão segura',
  },
]

export function PremiumScreen() {
  const { productAccess } = useAuth()
  const { addToast } = useToast()
  const [loadingPlan, setLoadingPlan] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubscribe(plan) {
    setErrorMessage('')
    setLoadingPlan(plan)

    try {
      await startCheckout(plan)
    } catch (error) {
      const message = error?.message ?? 'Não foi possível iniciar o checkout.'
      setErrorMessage(message)
      addToast({
        description: message,
        title: 'Checkout indisponível',
        tone: 'warning',
      })
      setLoadingPlan('')
    }
  }

  return (
    <>
      <section className="premium-hero">
        <div className="premium-copy">
          <p className="eyebrow">Fluxo Premium</p>
          <h1>Seu controle financeiro pronto para crescer.</h1>
          <span>
            Teste todos os recursos por 30 dias. Depois, continue no básico gratuito ou mantenha o
            Premium com assinatura segura via Stripe.
          </span>
        </div>

        <div className="premium-price-card">
          <span>{productAccess.label}</span>
          <strong>R$ 7,90</strong>
          <small>por mês após o teste grátis</small>
          <button
            className="primary-action"
            disabled={Boolean(loadingPlan)}
            onClick={() => handleSubscribe('monthly')}
            type="button"
          >
            {loadingPlan === 'monthly' ? 'Abrindo checkout...' : 'Assinar mensal'}
          </button>
        </div>
      </section>

      {errorMessage ? <p className="billing-error">{errorMessage}</p> : null}

      <section className="premium-grid" aria-label="Vantagens premium">
        {premiumBenefits.map((benefit) => (
          <article className="premium-benefit" key={benefit.label}>
            <span aria-hidden="true">+</span>
            <strong>{benefit.label}</strong>
            <p>{benefit.detail}</p>
          </article>
        ))}
      </section>

      <section className="premium-plan-row" aria-label="Planos">
        <article>
          <span>Mensal</span>
          <strong>R$ 7,90/mês</strong>
          <p>Cancele quando quiser após o teste.</p>
          <button
            className="ghost-action"
            disabled={Boolean(loadingPlan)}
            onClick={() => handleSubscribe('monthly')}
            type="button"
          >
            {loadingPlan === 'monthly' ? 'Abrindo...' : 'Assinar mensal'}
          </button>
        </article>
        <article>
          <span>Anual</span>
          <strong>R$ 59,90/ano</strong>
          <p>Economia para quem já quer seguir com o Fluxo por mais tempo.</p>
          <button
            className="ghost-action"
            disabled={Boolean(loadingPlan)}
            onClick={() => handleSubscribe('yearly')}
            type="button"
          >
            {loadingPlan === 'yearly' ? 'Abrindo...' : 'Assinar anual'}
          </button>
        </article>
      </section>
    </>
  )
}
