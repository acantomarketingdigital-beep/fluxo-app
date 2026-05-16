import { useEffect, useMemo, useState } from 'react'
import { Topbar } from './Topbar'
import { loadExpensesState } from '../storage/expensesStorage'
import { loadIncomesState } from '../storage/incomesStorage'

const PERIOD_OPTIONS = [6, 12, 18, 24]

export function CashflowScreen() {
  const [period, setPeriod] = useState(6)
  const [rawData, setRawData] = useState(loadRawData)

  useEffect(() => {
    function handleDataPulled() {
      setRawData(loadRawData())
    }
    window.addEventListener('fluxo:data-pulled', handleDataPulled)
    return () => window.removeEventListener('fluxo:data-pulled', handleDataPulled)
  }, [])

  const { months, averages, totalMonthsPositive, totalMonthsNegative } = useMemo(
    () => buildCashflow(rawData, period),
    [rawData, period],
  )

  const currentMonthKey = getCurrentMonthKey()

  return (
    <>
      <Topbar
        eyebrow="Fluxo mensal"
        searchPlaceholder="Buscar mês"
        subtitle="Receitas, despesas e saldo acumulado mês a mês"
        title="Fluxo de caixa"
      />

      <div className="cashflow-screen">
        <div className="cashflow-controls">
          <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Período:</span>
          {PERIOD_OPTIONS.map((p) => (
            <button
              className={period === p ? 'cashflow-period-btn is-active' : 'cashflow-period-btn'}
              key={p}
              onClick={() => setPeriod(p)}
              type="button"
            >
              {p} meses
            </button>
          ))}
        </div>

        <div className="cashflow-averages">
          <div className="cashflow-avg-tile">
            <span>Receita média/mês</span>
            <strong>{formatCurrency(averages.income)}</strong>
            <small>Nos próximos {period} meses</small>
          </div>
          <div className="cashflow-avg-tile">
            <span>Despesa média/mês</span>
            <strong>{formatCurrency(averages.expense)}</strong>
            <small>Nos próximos {period} meses</small>
          </div>
          <div className="cashflow-avg-tile">
            <span>Saldo médio/mês</span>
            <strong className={averages.balance >= 0 ? 'cashflow-positive' : 'cashflow-negative'}>
              {averages.balance >= 0 ? '+' : ''}{formatCurrency(averages.balance)}
            </strong>
            <small>
              {averages.balance >= 0
                ? `Média de sobra de ${formatCurrency(averages.balance)}/mês`
                : `Média de déficit de ${formatCurrency(Math.abs(averages.balance))}/mês`}
            </small>
          </div>
          <div className="cashflow-avg-tile">
            <span>Saldo acumulado total</span>
            <strong className={averages.accumulated >= 0 ? 'cashflow-positive' : 'cashflow-negative'}>
              {averages.accumulated >= 0 ? '+' : ''}{formatCurrency(averages.accumulated)}
            </strong>
            <small>
              {totalMonthsPositive} meses positivos · {totalMonthsNegative} negativos
            </small>
          </div>
        </div>

        {months.length === 0 ? (
          <div className="cashflow-table-wrap">
            <div className="cashflow-empty">
              Nenhum lançamento encontrado nos próximos {period} meses.
              <br />
              Cadastre receitas e despesas para ver o fluxo aqui.
            </div>
          </div>
        ) : (
          <div className="cashflow-table-wrap">
            <table className="cashflow-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Receitas</th>
                  <th>Despesas</th>
                  <th>Saldo do mês</th>
                  <th>Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {months.map((row) => {
                  const isCurrentMonth = row.key === currentMonthKey
                  return (
                    <tr className={isCurrentMonth ? 'cashflow-current-row' : row.projected ? 'cashflow-projected-row' : ''} key={row.key}>
                      <td>
                        <div className="cashflow-month-label">
                          {row.label}
                          {isCurrentMonth ? <small>mês atual</small> : row.projected ? <small style={{color:'var(--muted)',fontStyle:'italic'}}>projetado</small> : null}
                        </div>
                      </td>
                      <td className="cashflow-positive">{formatCurrency(row.income)}</td>
                      <td className="cashflow-negative">{formatCurrency(row.expense)}</td>
                      <td className={row.balance >= 0 ? 'cashflow-positive' : 'cashflow-negative'}>
                        {row.balance >= 0 ? '+' : ''}{formatCurrency(row.balance)}
                      </td>
                      <td className={row.accumulated >= 0 ? 'cashflow-positive' : 'cashflow-negative'}>
                        {row.accumulated >= 0 ? '+' : ''}{formatCurrency(row.accumulated)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {averages.balance !== 0 ? (
          <div style={{ padding: '16px', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--surface)', fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            {averages.balance >= 0 ? (
              <>
                Nos próximos {period} meses está projetado em média{' '}
                <strong style={{ color: 'var(--text-strong)' }}>{formatCurrency(averages.income)}/mês</strong>{' '}
                com gastos de{' '}
                <strong style={{ color: 'var(--text-strong)' }}>{formatCurrency(averages.expense)}/mês</strong>.{' '}
                Saldo projetado de{' '}
                <strong style={{ color: 'var(--emerald)' }}>{formatCurrency(averages.balance)}/mês</strong>.
              </>
            ) : (
              <>
                Nos próximos {period} meses está projetado em média{' '}
                <strong style={{ color: 'var(--text-strong)' }}>{formatCurrency(averages.income)}/mês</strong>{' '}
                com gastos de{' '}
                <strong style={{ color: 'var(--text-strong)' }}>{formatCurrency(averages.expense)}/mês</strong>.{' '}
                O saldo projetado é de{' '}
                <strong style={{ color: '#fca5a5' }}>{formatCurrency(Math.abs(averages.balance))}</strong> no negativo por mês.
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

function loadRawData() {
  return {
    incomes: loadIncomesState().incomes,
    expenses: loadExpensesState().expenses,
  }
}

function buildCashflow({ incomes, expenses }, period) {
  const monthKeys = getFutureMonthKeys(period)
  const currentKey = getCurrentMonthKey()

  // Build recurring income projections: group by description+source, use last known amount
  const recurringIncomeMap = {}
  for (const inc of incomes) {
    if (!inc.recurring) continue
    const k = `${inc.description}|${inc.source}`
    if (!recurringIncomeMap[k] || inc.date > (recurringIncomeMap[k].date ?? '')) {
      recurringIncomeMap[k] = { amount: safeNum(inc.amount), date: inc.date }
    }
  }

  // Build recurring expense projections: group by description+category, use last known amount
  const recurringExpenseMap = {}
  for (const exp of expenses) {
    if (exp.type !== 'recurring') continue
    const k = `${exp.description}|${exp.category}`
    if (!recurringExpenseMap[k] || exp.dueDate > (recurringExpenseMap[k].dueDate ?? '')) {
      recurringExpenseMap[k] = { amount: safeNum(exp.amount), dueDate: exp.dueDate }
    }
  }

  let accumulated = 0

  const months = monthKeys.map((key) => {
    const isFuture = key > currentKey

    let income = incomes
      .filter((i) => getMonthKey(i.date) === key)
      .reduce((s, i) => s + safeNum(i.amount), 0)

    // Project recurring incomes into future months with no record
    if (isFuture) {
      for (const [groupKey, proj] of Object.entries(recurringIncomeMap)) {
        const [desc, src] = groupKey.split('|')
        const hasRecord = incomes.some(
          (i) => getMonthKey(i.date) === key && i.description === desc && i.source === src && i.recurring
        )
        if (!hasRecord) income += proj.amount
      }
    }

    let expense = expenses
      .filter((e) => getMonthKey(e.dueDate) === key)
      .reduce((s, e) => s + safeNum(e.amount), 0)

    // Project recurring expenses into future months with no record
    if (isFuture) {
      for (const [groupKey, proj] of Object.entries(recurringExpenseMap)) {
        const [desc, cat] = groupKey.split('|')
        const hasRecord = expenses.some(
          (e) => getMonthKey(e.dueDate) === key && e.description === desc && e.category === cat && e.type === 'recurring'
        )
        if (!hasRecord) expense += proj.amount
      }
    }

    const balance = income - expense
    accumulated += balance

    return {
      key,
      label: formatMonthLabel(key),
      income,
      expense,
      balance,
      accumulated,
      projected: isFuture,
    }
  })

  const nonEmpty = months.filter((m) => m.income > 0 || m.expense > 0)
  const n = nonEmpty.length || 1

  const avgIncome = nonEmpty.reduce((s, m) => s + m.income, 0) / n
  const avgExpense = nonEmpty.reduce((s, m) => s + m.expense, 0) / n
  const avgBalance = avgIncome - avgExpense

  const totalMonthsPositive = months.filter((m) => m.balance > 0).length
  const totalMonthsNegative = months.filter((m) => m.balance < 0).length

  return {
    months,
    averages: {
      income: avgIncome,
      expense: avgExpense,
      balance: avgBalance,
      accumulated,
    },
    totalMonthsPositive,
    totalMonthsNegative,
  }
}

function getFutureMonthKeys(count) {
  const keys = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '00').slice(-2)
    keys.push(`${y}-${m}`)
  }

  return keys
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthKey(date) {
  return String(date ?? '').slice(0, 7)
}

function formatMonthLabel(key) {
  if (!key || key.length < 7) return key
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
}

function safeNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatCurrency(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { currency: 'BRL', style: 'currency' })
}
