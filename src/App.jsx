import './App.css'
import { useState } from 'react'
import { AuthLayout } from './components/AuthLayout'
import { CardsScreen } from './components/CardsScreen'
import { DashboardScreen } from './components/DashboardScreen'
import { ExpenseScreen } from './components/ExpenseScreen'
import { IncomeScreen } from './components/IncomeScreen'
import { LoginScreen } from './components/LoginScreen'
import { OnboardingScreen } from './components/OnboardingScreen'
import { PremiumScreen } from './components/PremiumScreen'
import { ReportsScreen } from './components/ReportsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { Sidebar } from './components/Sidebar'
import { TransactionsScreen } from './components/TransactionsScreen'
import { useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'

const screens = {
  'Visão geral': DashboardScreen,
  Receitas: IncomeScreen,
  Despesas: ExpenseScreen,
  Transações: TransactionsScreen,
  Cartões: CardsScreen,
  Relatórios: ReportsScreen,
  Premium: PremiumScreen,
  Configurações: SettingsScreen,
}

function App() {
  const {
    isAuthLoading,
    isDataLoading,
    onboardingCompleted,
    productAccess,
    signOut,
    syncStatus,
    user,
  } = useAuth()
  const { addToast } = useToast()
  const [activeScreen, setActiveScreen] = useState('Visão geral')
  const ActiveScreen = screens[activeScreen]

  if (isAuthLoading) {
    return (
      <AuthLayout>
        <div className="auth-card auth-loading-card">
          <div className="loading-mark" aria-hidden="true" />
          <p className="eyebrow">Sessão segura</p>
          <h1>Preparando o Fluxo</h1>
          <span>Validando acesso e sessão local.</span>
        </div>
      </AuthLayout>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  if (isDataLoading) {
    return (
      <AuthLayout>
        <div className="auth-card auth-loading-card">
          <div className="loading-mark" aria-hidden="true" />
          <p className="eyebrow">Sincronização</p>
          <h1>Carregando seus dados</h1>
          <span>Receitas, despesas, cartões e transações estão sendo preparados.</span>
        </div>
      </AuthLayout>
    )
  }

  if (!onboardingCompleted) {
    return <OnboardingScreen />
  }

  function handleNavigate(itemLabel) {
    if (itemLabel === 'Relatórios' && !productAccess.isPremium) {
      setActiveScreen('Premium')
      addToast({
        description: 'Relatórios avançados ficam disponíveis no Premium.',
        title: 'Recurso premium',
        tone: 'warning',
      })
      return
    }

    if (screens[itemLabel]) {
      setActiveScreen(itemLabel)
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      addToast({
        description: 'Sua sessão foi encerrada neste dispositivo.',
        title: 'Você saiu do Fluxo',
        tone: 'success',
      })
    } catch (error) {
      addToast({
        description: error?.message ?? 'Tente novamente em alguns instantes.',
        title: 'Não foi possível sair',
        tone: 'warning',
      })
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeItem={activeScreen}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
        productAccess={productAccess}
        syncStatus={syncStatus}
        user={user}
      />

      <main className="dashboard-main" id="main-content">
        <ActiveScreen
          onNavigate={handleNavigate}
          productAccess={productAccess}
        />
      </main>
    </div>
  )
}

export default App
