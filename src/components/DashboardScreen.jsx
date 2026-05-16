import { useCallback, useEffect, useMemo, useState } from 'react'
import { CardList } from './CardList'
import { CashFlowPanel } from './CashFlowPanel'
import { PaymentList } from './PaymentList'
import { StatCard } from './StatCard'
import { Topbar } from './Topbar'
import { loadCardsState } from '../storage/cardsStorage'
import { loadExpensesState } from '../storage/expensesStorage'
import { loadIncomesState } from '../storage/incomesStorage'
import { loadTransactionsState } from '../storage/transactionsStorage'
import { pullAllFromCloud } from '../storage/syncCoordinator'
import { useToast } from '../hooks/useToast'

export function DashboardScreen() {
  const [dashboardData, setDashboardData] = useState(loadDashboardData)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const { addToast } = useToast()

  const dashboard = useMemo(() => createDashboardView(dashboardData), [dashboardData])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsLoading(false), 220)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    function handleDataPulled() {
      setDashboardData(loadDashboardData())
    }

    window.addEventListener('fluxo:data-pulled', handleDataPulled)
    return () => window.removeEventListener('fluxo:data-pulled', handleDataPulled)
  }, [])

  const handleSyncNow = useCallback(async () => {
    if (isSyncing) {
      return
    }

    setIsSyncing(true)

    try {
      const result = await pullAllFromCloud()
      setDashboardData(loadDashboardData())

      addToast({
        description:
          result.state === 'synced'
            ? 'Dados atualizados com a nuvem.'
            : result.message,
        title: result.state === 'synced' ? 'Sincronização concluída' : 'Modo local',
        tone: result.state === 'synced' ? 'success' : 'warning',
      })
    } catch {
      addToast({
        description: 'Não foi possível buscar dados do servidor.',
        title: 'Erro na sincronização',
        tone: 'warning',
      })
    } finally {
      setIsSyncing(false)
    }
  }, [addToast, isSyncing])

  return (
    <>
      <Topbar
        actionLabel={isSyncing ? 'Sincronizando...' : 'Sincronizar agora'}
        eyebrow="Dashboard financeiro"
        onAction={handleSyncNow}
        searchPlaceholder="Buscar lançamentos"
        subtitle="Saldo real, entradas futuras e contas do mês"
        title="Visão geral do Fluxo"
      />

      {isLoading ? (
        <section className="skeleton-grid" aria-label="Carregando resumo">
          {[1, 2, 3, 4].map((item) => (
            <div className="skeleton-card" key={item} />
          ))}
        </section>
      ) : null}

      <section className="dashboard-hero" aria-label="Resumo rápido">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Previsão mensal</p>
          <h2>{dashboard.monthTrend}</h2>
          <span>{dashboard.monthDetail}</span>
        </div>

        <div className="dashboard-hero-chart" aria-label="Receitas, despesas e saldo previsto">
          {dashboard.chartBars.map((bar) => (
            <div className="hero-chart-column" key={bar.label}>
              <span style={{ height: `${bar.percent}%` }} />
              <small>{bar.label}</small>
            </div>
          ))}
        </div>

        <div className="dashboard-hero-kpis">
          {dashboard.quickStats.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-insight-grid" aria-label="Resumo do mês">
        {dashboard.monthSummary.map((item) => (
          <article className={`dashboard-insight dashboard-insight-${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="metrics-grid" aria-label="Indicadores financeiros">
        {dashboard.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="dashboard-grid" aria-label="Agenda e previsão mensal">
        <CashFlowPanel
          categories={dashboard.categories}
          forecastPercent={dashboard.forecastPercent}
          forecastValue={dashboard.netForecast}
        />
        <PaymentList
          actionLabel=""
          emptyMessage="Nenhuma conta aberta."
          payments={dashboard.nextPayments}
          title="Próximas contas"
        />
        <PaymentList
          actionLabel=""
          emptyMessage="Nenhum recebimento pendente."
          eyebrow="Receitas"
          payments={dashboard.nextReceipts}
          title="Próximos recebimentos"
        />
        <PaymentList
          actionLabel=""
          emptyMessage="Nenhuma movimentação registrada."
          eyebrow="Movimentos"
          payments={dashboard.recentTransactions}
          title="Transações recentes"
        />
        <CardList cards={dashboard.cards} />
      </section>
    </>
  )
}

function loadDashboardData() {
  return {
    cards: loadCardsState().cards,
    expenses: loadExpensesState().expenses,
    incomes: loadIncomesState().incomes,
    transactions: loadTransactionsState().transactions,
  }
}

function computeAccumulatedBalance(incomes, expenses) {
  const monthKeys = getPast12MonthKeys()
  let accumulated = 0

  for (const key of monthKeys) {
    const monthIncome = incomes
      .filter((i) => getMonthKey(i.date) === key)
      .reduce((s, i) => s + safeNum(i.amount), 0)
    const monthExpense = expenses
      .filter((e) => getMonthKey(e.dueDate) === key)
      .reduce((s, e) => s + safeNum(e.amount), 0)
    accumulated += monthIncome - monthExpense
  }

  return accumulated
}

function computeMonthStats(incomes, expenses) {
  const monthKeys = getPast12MonthKeys()
  let positive = 0
  let negative = 0

  for (const key of monthKeys) {
    const monthIncome = incomes
      .filter((i) => getMonthKey(i.date) === key)
      .reduce((s, i) => s + safeNum(i.amount), 0)
    const monthExpense = expenses
      .filter((e) => getMonthKey(e.dueDate) === key)
      .reduce((s, e) => s + safeNum(e.amount), 0)
    const balance = monthIncome - monthExpense
    if (balance > 0) positive++
    else if (balance < 0) negative++
  }

  return { positive, negative }
}

function getPast12MonthKeys() {
  const keys = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function safeNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function createDashboardView({ cards, expenses, incomes, transactions }) {
  const currentMonth = getCurrentMonthKey()
  const monthlyIncomes = incomes.filter((income) => getMonthKey(income.date) === currentMonth)
  const monthlyExpenses = expenses.filter((expense) => getMonthKey(expense.dueDate) === currentMonth)
  const accumulatedBalance = computeAccumulatedBalance(incomes, expenses)
  const monthStats = computeMonthStats(incomes, expenses)
  const receivedIncomes = incomes.filter((income) => income.status === 'received')
  const pendingMonthlyIncomes = monthlyIncomes.filter((income) => income.status !== 'received')
  const unpaidMonthlyExpenses = monthlyExpenses.filter((expense) => expense.status !== 'paid')
  const paidOutflows = transactions.filter((transaction) => transaction.type === 'saida')
  const balanceOnHand = sumBy(receivedIncomes, 'amount')
  const cashBalance = balanceOnHand - sumBy(paidOutflows, 'amount')
  const monthlyIncomeTotal = sumBy(monthlyIncomes, 'amount')
  const monthlyExpenseTotal = sumBy(monthlyExpenses, 'amount')
  const pendingIncomeTotal = sumBy(pendingMonthlyIncomes, 'amount')
  const unpaidExpenseTotal = sumBy(unpaidMonthlyExpenses, 'amount')
  const forecastBalance = cashBalance + pendingIncomeTotal - unpaidExpenseTotal
  const netForecast = pendingIncomeTotal - unpaidExpenseTotal
  const amountLeft = monthlyIncomeTotal - monthlyExpenseTotal
  const commitmentPercent = calculateCommitmentPercent(monthlyExpenseTotal, monthlyIncomeTotal)
  const risk = createRiskSignal({
    commitmentPercent,
    forecastBalance,
    unpaidExpenseTotal,
  })
  const expensePayments = unpaidMonthlyExpenses
    .sort((current, next) => current.dueDate.localeCompare(next.dueDate))
    .map((expense) => ({
      id: expense.id,
      dueDate: expense.dueDate,
      payee: expense.description,
      category: expense.category || 'Despesa',
      date: formatShortDate(expense.dueDate),
      amount: formatCurrency(expense.amount),
      status: expense.status === 'overdue' || expense.dueDate < getTodayDate() ? 'Atrasado' : 'Em aberto',
    }))
  const cardPayments = cards
    .filter((card) => card.invoice > 0)
    .map((card) => ({
      id: `card-invoice-${card.id}`,
      dueDate: card.dueDate,
      payee: `Fatura - ${card.name}`,
      category: 'Cartão',
      date: formatShortDate(card.dueDate),
      amount: formatCurrency(card.invoice),
      status: 'Fatura aberta',
    }))
  const nextPayments = [...expensePayments, ...cardPayments]
    .sort((current, next) => current.dueDate.localeCompare(next.dueDate))
    .slice(0, 4)
  const nextReceipts = pendingMonthlyIncomes
    .sort((current, next) => current.date.localeCompare(next.date))
    .map((income) => ({
      id: income.id,
      payee: income.description,
      category: income.source,
      date: formatShortDate(income.date),
      amount: formatCurrency(income.amount),
      status: income.recurring ? 'Recorrente' : 'Pendente',
    }))
    .slice(0, 4)
  const recentTransactions = [...transactions]
    .sort((current, next) => next.date.localeCompare(current.date))
    .map((transaction) => ({
      id: transaction.id,
      payee: transaction.description,
      category: getTransactionOriginLabel(transaction.origin),
      date: formatShortDate(transaction.date),
      amount: `${transaction.type === 'saida' ? '-' : ''}${formatCurrency(transaction.amount)}`,
      status: transaction.type === 'saida' ? 'Saída' : 'Entrada',
    }))
    .slice(0, 4)

  return {
    cards: cards.map(mapDashboardCard),
    categories: createExpenseCategories(monthlyExpenses),
    forecastPercent: calculateForecastPercent(pendingIncomeTotal, unpaidExpenseTotal),
    chartBars: createChartBars({
      monthlyIncomeTotal,
      monthlyExpenseTotal,
      forecastBalance,
    }),
    monthDetail: `${pendingMonthlyIncomes.length} recebimentos e ${unpaidMonthlyExpenses.length} contas abertas`,
    monthSummary: [
      {
        detail: 'Receitas do mês menos despesas do mês',
        label: 'Quanto sobra',
        tone: amountLeft >= 0 ? 'positive' : 'warning',
        value: formatCurrency(amountLeft),
      },
      {
        detail: 'Despesas sobre receitas do mês',
        label: 'Renda comprometida',
        tone: commitmentPercent >= 80 ? 'warning' : 'neutral',
        value: `${commitmentPercent}%`,
      },
      {
        detail: risk.detail,
        label: 'Alerta de risco',
        tone: risk.tone,
        value: risk.label,
      },
      {
        detail: 'Saldo real mais pendências previstas',
        label: 'Previsão mensal',
        tone: forecastBalance >= 0 ? 'positive' : 'warning',
        value: formatCurrency(forecastBalance),
      },
    ],
    monthTrend:
      forecastBalance >= balanceOnHand
        ? 'Fluxo mensal em expansão'
        : 'Atenção ao caixa projetado',
    netForecast: formatCurrency(netForecast),
    nextPayments,
    nextReceipts,
    recentTransactions,
    quickStats: [
      {
        label: 'Entradas pendentes',
        value: formatCurrency(pendingIncomeTotal),
      },
      {
        label: 'Contas abertas',
        value: formatCurrency(unpaidExpenseTotal),
      },
      {
        label: 'Saldo projetado',
        value: formatCurrency(forecastBalance),
      },
    ],
    stats: [
      {
        label: 'Saldo em mãos',
        value: formatCurrency(cashBalance),
        detail: 'Receitas recebidas menos saídas',
        trend: `${receivedIncomes.length} entradas`,
        tone: cashBalance >= 0 ? 'positive' : 'warning',
      },
      {
        label: 'Receitas do mês',
        value: formatCurrency(monthlyIncomeTotal),
        detail: `${monthlyIncomes.length} entradas no mês`,
        trend: `${pendingMonthlyIncomes.length} pendentes`,
        tone: 'positive',
      },
      {
        label: 'Despesas do mês',
        value: formatCurrency(monthlyExpenseTotal),
        detail: `${monthlyExpenses.length} despesas no mês`,
        trend: `${unpaidMonthlyExpenses.length} abertas`,
        tone: unpaidExpenseTotal > pendingIncomeTotal ? 'warning' : 'neutral',
      },
      {
        label: 'Saldo acumulado',
        value: formatCurrency(accumulatedBalance),
        detail: `${monthStats.positive} meses positivos · ${monthStats.negative} negativos`,
        trend: accumulatedBalance >= 0 ? 'Em dia' : 'Atenção',
        tone: accumulatedBalance >= 0 ? 'positive' : 'warning',
      },
    ],
  }
}

function getTransactionOriginLabel(origin) {
  const labels = {
    cartao: 'Cartão',
    despesa: 'Despesa',
    receita: 'Receita',
  }

  return labels[origin] ?? origin
}

function createChartBars({ monthlyIncomeTotal, monthlyExpenseTotal, forecastBalance }) {
  const values = [
    { label: 'Receitas', value: monthlyIncomeTotal },
    { label: 'Despesas', value: monthlyExpenseTotal },
    { label: 'Previsto', value: Math.max(forecastBalance, 0) },
  ]
  const highestValue = Math.max(...values.map((item) => item.value), 1)

  return values.map((item) => ({
    ...item,
    percent: Math.max(12, Math.round((item.value / highestValue) * 100)),
  }))
}

function createExpenseCategories(expenses) {
  const totalsByCategory = expenses.reduce((totals, expense) => {
    const category = expense.category || 'Sem categoria'
    return {
      ...totals,
      [category]: (totals[category] ?? 0) + expense.amount,
    }
  }, {})
  const highestValue = Math.max(...Object.values(totalsByCategory), 1)

  return Object.entries(totalsByCategory)
    .map(([name, total]) => ({
      name,
      value: formatCurrency(total),
      percent: Math.max(8, Math.round((total / highestValue) * 100)),
    }))
    .sort((current, next) => next.percent - current.percent)
    .slice(0, 4)
}

function calculateForecastPercent(income, expenses) {
  if (income <= 0 && expenses <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round((income / Math.max(expenses, 1)) * 100)))
}

function calculateCommitmentPercent(expenses, income) {
  if (income <= 0 && expenses > 0) {
    return 100
  }

  if (income <= 0) {
    return 0
  }

  return Math.min(999, Math.round((expenses / income) * 100))
}

function createRiskSignal({ commitmentPercent, forecastBalance, unpaidExpenseTotal }) {
  if (forecastBalance < 0) {
    return {
      detail: 'A previsão fecha negativa se nada mudar.',
      label: 'Alto',
      tone: 'warning',
    }
  }

  if (commitmentPercent >= 80) {
    return {
      detail: 'Boa parte da renda já está comprometida.',
      label: 'Atenção',
      tone: 'warning',
    }
  }

  if (unpaidExpenseTotal === 0) {
    return {
      detail: 'Nenhuma conta aberta no mês atual.',
      label: 'Baixo',
      tone: 'positive',
    }
  }

  return {
    detail: 'Fluxo mensal sob controle.',
    label: 'Controlado',
    tone: 'neutral',
  }
}

function mapDashboardCard(card) {
  const usedLimit = card.totalLimit - card.availableLimit
  const usage = Math.round((usedLimit / card.totalLimit) * 100)
  const variants = {
    violet: 'emerald',
    plum: 'blue',
    graphite: 'amber',
  }

  return {
    name: card.name,
    lastDigits: card.id.slice(0, 4).toUpperCase(),
    invoice: formatCurrency(card.invoice),
    limit: formatCurrency(card.totalLimit),
    dueDate: formatShortDate(card.dueDate),
    usage,
    variant: variants[card.variant] ?? 'emerald',
  }
}

function sumBy(items, field) {
  return items.reduce((sum, item) => sum + item[field], 0)
}

function getCurrentMonthKey() {
  return getMonthKey(getTodayDate())
}

function getMonthKey(date) {
  return String(date).slice(0, 7)
}

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  })
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}
