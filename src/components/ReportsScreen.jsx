import { useEffect, useMemo, useState } from 'react'
import { loadCardsState } from '../storage/cardsStorage'
import { loadExpensesState } from '../storage/expensesStorage'
import { loadIncomesState } from '../storage/incomesStorage'
import { loadTransactionsState } from '../storage/transactionsStorage'

export function ReportsScreen() {
  const [reportData, setReportData] = useState(createReport)

  useEffect(() => {
    function handleDataPulled() {
      setReportData(createReport())
    }

    window.addEventListener('fluxo:data-pulled', handleDataPulled)
    return () => window.removeEventListener('fluxo:data-pulled', handleDataPulled)
  }, [])

  const report = useMemo(() => reportData, [reportData])

  return (
    <>
      <section className="settings-hero">
        <div>
          <p className="eyebrow">Relatórios avançados</p>
          <h1>Leitura premium do seu mês.</h1>
          <span>
            Indicadores para entender comprometimento de renda, peso dos cartões e fôlego do caixa.
          </span>
        </div>
        <div className="settings-version">
          <span>Score financeiro</span>
          <strong>{report.score}</strong>
        </div>
      </section>

      <section className="dashboard-insight-grid" aria-label="Indicadores avançados">
        {report.insights.map((item) => (
          <article className={`dashboard-insight dashboard-insight-${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="premium-grid" aria-label="Recomendações">
        {report.recommendations.map((item) => (
          <article className="premium-benefit" key={item.label}>
            <span aria-hidden="true">+</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>
    </>
  )
}

function createReport() {
  const incomes = loadIncomesState().incomes
  const expenses = loadExpensesState().expenses
  const cards = loadCardsState().cards
  const transactions = loadTransactionsState().transactions
  const monthKey = getCurrentMonthKey()
  const monthlyIncome = incomes
    .filter((income) => getMonthKey(income.date) === monthKey)
    .reduce((sum, income) => sum + income.amount, 0)
  const monthlyExpenses = expenses
    .filter((expense) => getMonthKey(expense.dueDate) === monthKey)
    .reduce((sum, expense) => sum + expense.amount, 0)
  const cardInvoices = cards.reduce((sum, card) => sum + card.invoice, 0)
  const outflows = transactions
    .filter((transaction) => transaction.type === 'saida')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const commitment = monthlyIncome > 0 ? Math.round((monthlyExpenses / monthlyIncome) * 100) : 0
  const projectedLeft = monthlyIncome - monthlyExpenses - cardInvoices
  const score = Math.max(0, Math.min(100, 100 - Math.round(commitment / 2) - (projectedLeft < 0 ? 24 : 0)))

  return {
    insights: [
      {
        detail: 'Depois de despesas e faturas abertas',
        label: 'Sobra projetada',
        tone: projectedLeft >= 0 ? 'positive' : 'warning',
        value: formatCurrency(projectedLeft),
      },
      {
        detail: 'Despesas do mês sobre receitas do mês',
        label: 'Comprometimento',
        tone: commitment >= 80 ? 'warning' : 'neutral',
        value: `${commitment}%`,
      },
      {
        detail: 'Total aberto nos cartões',
        label: 'Peso dos cartões',
        tone: cardInvoices > monthlyIncome * 0.35 ? 'warning' : 'neutral',
        value: formatCurrency(cardInvoices),
      },
      {
        detail: 'Saídas já pagas no histórico',
        label: 'Saídas registradas',
        tone: 'neutral',
        value: formatCurrency(outflows),
      },
    ],
    recommendations: [
      {
        detail:
          commitment >= 80
            ? 'Reduza contas variáveis antes de assumir novas parcelas.'
            : 'Seu mês ainda tem espaço para decisões planejadas.',
        label: 'Renda comprometida',
      },
      {
        detail:
          projectedLeft < 0
            ? 'A previsão está negativa. Priorize entradas pendentes e faturas próximas.'
            : 'A previsão segue positiva. Mantenha alertas de vencimento ativos.',
        label: 'Previsão mensal',
      },
    ],
    score,
  }
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
