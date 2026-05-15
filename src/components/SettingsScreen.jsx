import {
  APP_VERSION,
  clearFluxoLocalData,
  exportFluxoData,
  resetFluxoTestData,
} from '../storage/appData'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { openBillingPortal } from '../lib/billing'
import { useEffect, useState } from 'react'

export function SettingsScreen({ onNavigate }) {
  const { productAccess, signOut, syncStatus, user } = useAuth()
  const { addToast } = useToast()
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(() => isAppInstalled())
  const [isResettingAll, setIsResettingAll] = useState(false)
  const [isResettingLocal, setIsResettingLocal] = useState(false)
  const profileName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário'

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    function handleAppInstalled() {
      setInstallPrompt(null)
      setIsStandalone(true)
      addToast({
        description: 'O Fluxo foi instalado neste dispositivo.',
        title: 'App instalado',
        tone: 'success',
      })
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [addToast])

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
      'Limpar dados financeiros locais? Receitas, despesas, transações e compras serão removidas deste dispositivo.',
    )

    if (!confirmed) {
      return
    }

    clearFluxoLocalData()
    onNavigate?.('Visão geral')
    addToast({
      description: 'Os dados locais foram limpos. A conta e a assinatura foram preservadas.',
      title: 'Dados locais limpos',
      tone: 'success',
    })
  }

  async function handleResetLocalData() {
    const confirmed = window.confirm(
      'Resetar apenas dados locais deste dispositivo? A nuvem, a conta e a assinatura serão preservadas.',
    )

    if (!confirmed) {
      return
    }

    setIsResettingLocal(true)

    try {
      await resetFluxoTestData({ includeCloud: false })
      onNavigate?.('Visão geral')
      addToast({
        description: 'Receitas, despesas, cartões, transações e filas locais foram removidos.',
        title: 'Dados locais resetados',
        tone: 'success',
      })
    } catch (error) {
      addToast({
        description: error?.message ?? 'Tente novamente em instantes.',
        title: 'Não foi possível resetar os dados locais',
        tone: 'warning',
      })
    } finally {
      setIsResettingLocal(false)
    }
  }

  async function handleResetAllData() {
    const confirmation = window.prompt(
      'Essa ação apaga receitas, despesas, cartões, transações e filas de sync, localmente e na nuvem. Digite ZERAR para confirmar.',
    )

    if (confirmation !== 'ZERAR') {
      return
    }

    setIsResettingAll(true)

    try {
      await resetFluxoTestData({ includeCloud: Boolean(user) })
      onNavigate?.('Visão geral')
      addToast({
        description: 'Conta, login, assinatura e perfil de cobrança foram preservados.',
        title: 'Dados zerados com sucesso',
        tone: 'success',
      })
    } catch (error) {
      addToast({
        description:
          error?.message ??
          'Os dados locais foram limpos, mas não foi possível confirmar a limpeza na nuvem.',
        title: 'Reset parcialmente concluído',
        tone: 'warning',
      })
    } finally {
      setIsResettingAll(false)
    }
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
      if (isNoActiveSubscriptionError(error)) {
        addToast({
          description: 'Você ainda não possui assinatura ativa.',
          title: 'Assinatura não encontrada',
          tone: 'warning',
        })
        onNavigate?.('Premium')
      } else {
        addToast({
          description: error?.message ?? 'Tente novamente em instantes.',
          title: 'Portal indisponível',
          tone: 'warning',
        })
      }

      setIsPortalLoading(false)
    }
  }

  async function handleInstallApp() {
    if (isStandalone) {
      addToast({
        description: 'O Fluxo já está aberto como app instalado neste dispositivo.',
        title: 'App já instalado',
        tone: 'success',
      })
      return
    }

    if (!installPrompt) {
      addToast({
        description:
          'Android Chrome: menu > Instalar app. iPhone Safari: compartilhar > Adicionar à Tela de Início.',
        title: 'Instalar app',
        tone: 'warning',
      })
      return
    }

    installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)

    addToast({
      description:
        choice?.outcome === 'accepted'
          ? 'Instalação iniciada pelo navegador.'
          : 'Você pode instalar depois pelo menu do navegador.',
      title: choice?.outcome === 'accepted' ? 'Instalando Fluxo' : 'Instalação cancelada',
      tone: choice?.outcome === 'accepted' ? 'success' : 'warning',
    })
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
              <p className="eyebrow">PWA</p>
              <h2>Instalar app</h2>
            </div>
          </div>
          <p className="settings-panel-copy">
            {isStandalone
              ? 'O Fluxo já está rodando em modo app neste dispositivo.'
              : 'Use o botão quando o navegador liberar a instalação, ou siga o caminho manual no celular.'}
          </p>
          <div className="settings-help-list">
            <span>Android Chrome: menu &gt; Instalar app</span>
            <span>iPhone Safari: compartilhar &gt; Adicionar à Tela de Início</span>
          </div>
          <button className="primary-action settings-billing-action" onClick={handleInstallApp} type="button">
            Instalar app
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
              Limpar dados locais
            </button>
          </div>
        </article>

        <article className="settings-panel settings-danger-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Dados de teste</p>
              <h2>Zerar ambiente</h2>
            </div>
          </div>
          <p className="settings-panel-copy">
            Remove somente dados financeiros e filas de sincronização. Conta, login, assinatura e perfil de
            cobrança continuam intactos.
          </p>
          <div className="settings-actions">
            <button
              className="ghost-action danger-action"
              disabled={isResettingAll}
              onClick={handleResetAllData}
              type="button"
            >
              {isResettingAll ? 'Zerando dados...' : 'Zerar todos os dados'}
            </button>
            <button
              className="ghost-action settings-secondary-action"
              disabled={isResettingLocal}
              onClick={handleResetLocalData}
              type="button"
            >
              {isResettingLocal ? 'Resetando local...' : 'Resetar apenas dados locais'}
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

function isNoActiveSubscriptionError(error) {
  return error?.status === 404 || error?.message === 'Você ainda não possui assinatura ativa.'
}

function isAppInstalled() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}
