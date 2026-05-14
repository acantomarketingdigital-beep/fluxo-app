import { useMemo, useState } from 'react'
import { Topbar } from './Topbar'
import { loadTransactionsState } from '../storage/transactionsStorage'

const transactionTypeLabels = {
  entrada: 'Entrada',
  saida: 'Saída',
}

const originLabels = {
  receita: 'Receita',
  despesa: 'Despesa',
  cartao: 'Cartão',
}

export function TransactionsScreen() {
  const [transactionsState, setTransactionsState] = useState(loadTransactionsState)
  const [typeFilter, setTypeFilter] = useState('all')
  const [query, setQuery] = useState('')
  const { transactions } = transactionsState
  const filteredTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => typeFilter === 'all' || transaction.type === typeFilter)
        .filter((transaction) => matchesTransactionQuery(transaction, query))
        .sort(sortTransactionsByDate),
    [query, transactions, typeFilter],
  )
  const groupedTransactions = useMemo(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions],
  )
  const totals = useMemo(() => {
    const income = transactions
      .filter((transaction) => transaction.type === 'entrada')
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const outcome = transactions
      .filter((transaction) => transaction.type === 'saida')
      .reduce((sum, transaction) => sum + transaction.amount, 0)

    return {
      income,
      outcome,
      balance: income - outcome,
    }
  }, [transactions])

  return (
    <>
      <Topbar
        actionLabel="Atualizar"
        eyebrow="Transações"
        onAction={() => setTransactionsState(loadTransactionsState())}
        searchPlaceholder="Buscar movimentações"
        subtitle="Entradas e saídas registradas automaticamente"
        title="Movimentações"
      />

      <section className="transactions-summary" aria-label="Resumo de movimentações">
        <article className="summary-tile transactions-summary-tile">
          <span>Entradas</span>
          <strong>{formatCurrency(totals.income)}</strong>
          <small>Receitas recebidas</small>
        </article>
        <article className="summary-tile transactions-summary-tile transactions-summary-out">
          <span>Saídas</span>
          <strong>{formatCurrency(totals.outcome)}</strong>
          <small>Despesas pagas</small>
        </article>
        <article className="summary-tile transactions-summary-tile">
          <span>Saldo movimentado</span>
          <strong>{formatCurrency(totals.balance)}</strong>
          <small>Entradas menos saídas</small>
        </article>
      </section>

      <section className="panel transactions-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2>Movimentações recentes</h2>
          </div>
          <span>{filteredTransactions.length} registros</span>
        </div>

        <div className="transactions-toolbar">
          <label className="transactions-search">
            <span className="sr-only">Buscar transações</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por descrição, origem ou referência"
              type="search"
              value={query}
            />
          </label>

          <div className="segmented-control" aria-label="Filtrar movimentações">
            {[
              ['all', 'Todas'],
              ['entrada', 'Entradas'],
              ['saida', 'Saídas'],
            ].map(([value, label]) => (
              <button
                className={typeFilter === value ? 'is-selected' : ''}
                key={value}
                onClick={() => setTypeFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="transaction-list">
          {filteredTransactions.length === 0 ? (
            <div className="expense-empty-state">
              Nenhuma movimentação encontrada para este filtro.
            </div>
          ) : null}

          {groupedTransactions.map(([date, items]) => (
            <section className="transaction-day-group" key={date}>
              <div className="transaction-day-heading">
                <span>{formatDate(date)}</span>
                <small>{items.length} movimentações</small>
              </div>

              {items.map((transaction) => (
                <article
                  className={`transaction-row transaction-row-${transaction.type}`}
                  key={transaction.id}
                >
                  <div className={`transaction-status transaction-status-${transaction.type}`}>
                    {transactionTypeLabels[transaction.type]}
                  </div>

                  <div className="transaction-main">
                    <strong>{transaction.description}</strong>
                    <span>Ref. {transaction.referenceId}</span>
                    <span
                      className={`transaction-origin-badge transaction-origin-${transaction.origin}`}
                    >
                      {originLabels[transaction.origin] ?? transaction.origin}
                    </span>
                  </div>

                  <div className="transaction-meta">
                    <strong>{formatSignedCurrency(transaction)}</strong>
                    <span className={`transaction-badge transaction-badge-${transaction.type}`}>
                      {transactionTypeLabels[transaction.type]}
                    </span>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </section>
    </>
  )
}

function matchesTransactionQuery(transaction, query) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return true
  }

  return [transaction.description, transaction.origin, transaction.referenceId]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery)
}

function groupTransactionsByDate(transactions) {
  const groups = transactions.reduce((result, transaction) => {
    const group = result.get(transaction.date) ?? []
    result.set(transaction.date, [...group, transaction])
    return result
  }, new Map())

  return Array.from(groups.entries())
}

function sortTransactionsByDate(current, next) {
  const dateComparison = next.date.localeCompare(current.date)

  if (dateComparison !== 0) {
    return dateComparison
  }

  return String(next.id).localeCompare(String(current.id))
}

function formatSignedCurrency(transaction) {
  const sign = transaction.type === 'entrada' ? '' : '-'
  return `${sign}${formatCurrency(transaction.amount)}`
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  })
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}
