import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

const onboardingItems = [
  {
    detail: 'Acompanhe o dinheiro realmente disponível depois das saídas pagas.',
    label: 'Saldo em mãos',
    metric: 'caixa real',
  },
  {
    detail: 'Registre contas únicas, recorrentes e parceladas com vencimentos claros.',
    label: 'Despesas',
    metric: 'alertas',
  },
  {
    detail: 'Controle limite, fatura e compras parceladas sem perder o impacto no mês.',
    label: 'Cartões',
    metric: 'faturas',
  },
  {
    detail: 'Separe entradas recebidas e futuras para enxergar o fluxo antes do mês fechar.',
    label: 'Receitas',
    metric: 'previsão',
  },
]

export function OnboardingScreen() {
  const { completeOnboarding, productAccess, user } = useAuth()
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const firstName = getFirstName(user)

  async function handleStart() {
    setIsSubmitting(true)

    try {
      await completeOnboarding()
      addToast({
        description: 'Seu painel financeiro já está pronto para uso.',
        title: 'Bem-vindo ao Fluxo',
        tone: 'success',
      })
    } catch (error) {
      addToast({
        description: error?.message ?? 'Tente novamente em alguns instantes.',
        title: 'Não foi possível finalizar',
        tone: 'warning',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="onboarding-shell">
      <section className="onboarding-hero">
        <div className="brand onboarding-brand">
          <img
            alt="Fluxo"
            className="brand-logo-symbol"
            src="/brand/app-icon-192.png"
          />
          <div>
            <strong>Fluxo</strong>
            <span>Beta premium</span>
          </div>
        </div>

        <div className="onboarding-copy">
          <p className="eyebrow">Primeiros passos</p>
          <h1>{firstName}, organize seu dinheiro com clareza.</h1>
          <span>
            O Fluxo conecta caixa, contas, receitas e cartões em uma visão simples para decisões
            de rotina.
          </span>
        </div>

        <div className="trial-banner">
          <span>{productAccess.label}</span>
          <strong>30 dias grátis, depois R$ 7,90/mês</strong>
        </div>
      </section>

      <section className="onboarding-grid" aria-label="Como o Fluxo funciona">
        {onboardingItems.map((item) => (
          <article className="onboarding-card" key={item.label}>
            <span>{item.metric}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="onboarding-action">
        <button className="primary-action" disabled={isSubmitting} onClick={handleStart} type="button">
          {isSubmitting ? 'Preparando...' : 'Começar'}
        </button>
      </section>
    </main>
  )
}

function getFirstName(user) {
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Olá'
  return fullName.split(' ')[0]
}
