import { APP_VERSION, clearFluxoData, exportFluxoData } from '../storage/appData'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { openBillingPortal } from '../lib/billing'
import { useState } from 'react'

export function SettingsScreen() {
  const { productAccess, signOut, syncStatus, user } = useAuth()
  const { addToast } = useToast()
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const profileName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'

  function handleExport() {
    exportFluxoData()
    addToast({
      description: 'Backup JSON gerado com receitas, despesas, cartões e transações.',
      title: 'Exportação concluída',
      tone: 'success',
    })
  }

  function handleClearData() {
    const confirmed = window.confirm(
      'Limpar dados financeiros? Receitas, despesas, transações e compras serão removidas deste espaço.',
    )

    if (!confirmed) {
      return
    }

    clearFluxoData()
    addToast({
      description: 'Os dados financeiros foram limpos. Recarregue a visão para ver o estado inicial.',
      title: 'Dados limpos',
      tone: 'success',
    })
  }

  async function handleSignOut() {
    try {
      await signOut()
      addToast({
        description: 'Sessão encerrada com segurança.',
        title: 'Você saiu do Fluxo',
        tone: 'success',
      })
    } catch (error) {
      addToast({
        description: error?.message ?? 'Tente novamente em instantes.',
        title: 'Não foi possível sair',
        tone: 'warning',
      })
    }
  }

  async function handleManageSubscription() {
    setIsPortalLoading(true)

    try {
      await openBillingPortal()
    } catch (error) {
      addToast({
        description: error?.message ?? 'Assine o Premium antes de abrir o portal.',
        title: 'Portal indisponível',
        tone: 'warning',
      })
      setIsPortalLoading(false)
    }
  }

  return (
    <>
      <section className="settings-hero">
        <div>
          <p className="eyebrow">Configurações</p>
          <h1>Conta, dados e preferências</h1>
          <span>Prepare o Fluxo para sua rotina de beta com segurança e portabilidade.</span>
        </div>
        <div className="settings-version">
          <span>Versão</span>
          <strong>{APP_VERSION}</strong>
        </div>
      </section>

      <section className="settings-grid" aria-label="Configurações do Fluxo">
        <article className="settings-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Conta</p>
              <h2>Informações</h2>
            </div>
          </div>
          <dl className="settings-list">
            <div>
              <dt>Nome</dt>
              <dd>{profileName}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Plano</dt>
              <dd>{productAccess.label}</dd>
            </div>
            <div>
              <dt>Status Stripe</dt>
              <dd>{formatBillingStatus(productAccess.billingStatus)}</dd>
            </div>
            <div>
              <dt>Sincronização</dt>
              <dd>{syncStatus?.message ?? 'Modo local'}</dd>
            </div>
          </dl>
          <button
            className="primary-action settings-billing-action"
            disabled={isPortalLoading}
            onClick={handleManageSubscription}
            type="button"
          >
            {isPortalLoading ? 'Abrindo portal...' : 'Gerenciar assinatura'}
          </button>
        </article>

        <article className="settings-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dados</p>
              <h2>Portabilidade</h2>
            </div>
          </div>
          <div className="settings-actions">
            <button className="primary-action" onClick={handleExport} type="button">
              Exportar dados
            </button>
            <button className="ghost-action danger-action" onClick={handleClearData} type="button">
              Limpar dados
            </button>
          </div>
        </article>

        <article className="settings-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Preferências</p>
              <h2>Tema futuro</h2>
            </div>
          </div>
          <div className="theme-preview" aria-label="Tema futuro">
            <button className="is-selected" type="button">
              Escuro premium
            </button>
            <button disabled type="button">
              Claro
            </button>
            <button disabled type="button">
              Automático
            </button>
          </div>
        </article>

        <article className="settings-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Sessão</p>
              <h2>Acesso</h2>
            </div>
          </div>
          <button className="logout-action settings-logout" onClick={handleSignOut} type="button">
            Sair da conta
          </button>
        </article>
      </section>
    </>
  )
}

function formatBillingStatus(status) {
  const labels = {
    active: 'Ativo',
    canceled: 'Cancelado',
    free: 'Gratuito',
    past_due: 'Pagamento pendente',
    trialing: 'Teste grátis',
  }

  return labels[status] ?? 'Não configurado'
}
