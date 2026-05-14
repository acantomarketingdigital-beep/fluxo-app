export function ExpenseList({
  alertTimingOptions,
  expenses,
  frequencyLabels,
  onMarkPaid,
  statusLabels,
  typeLabels,
}) {
  const alertTimingLabels = createLabelMap(alertTimingOptions)

  return (
    <section className="panel expense-list-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Controle</p>
          <h2>Despesas cadastradas</h2>
        </div>
        <span>{expenses.length} itens</span>
      </div>

      <div className="expense-list">
        {expenses.length === 0 ? (
          <div className="expense-empty-state">Nenhuma despesa cadastrada.</div>
        ) : null}

        {expenses.map((expense) => {
          const status = expense.displayStatus ?? expense.status
          const isPaid = status === 'paid'

          return (
            <article className={`expense-row expense-row-${status}`} key={expense.id}>
              <div className={`expense-status expense-status-${status}`} aria-hidden="true">
                {statusLabels[status]}
              </div>

              <div className="expense-main">
                <strong>{expense.description}</strong>
                <span>
                  {typeLabels[expense.type]}
                  {expense.type === 'single'
                    ? ''
                    : ` / ${frequencyLabels[expense.frequency]}`}
                </span>
                {expense.category ? <small>{expense.category}</small> : null}
                {expense.type === 'installment' ? (
                  <small>
                    Parcela {expense.installmentNumber} de {expense.installmentsTotal}
                  </small>
                ) : null}
                {expense.note ? <small>{expense.note}</small> : null}
              </div>

              <div className="expense-meta">
                <strong>{formatCurrency(expense.amount)}</strong>
                <span>{formatDueDate(expense.dueDate)}</span>
                {expense.type === 'installment' ? (
                  <span>Total: {formatCurrency(expense.totalAmount)}</span>
                ) : null}
              </div>

              <div className="expense-alert">
                <strong>{statusLabels[status]}</strong>
                <span>{formatAlert(expense, alertTimingLabels)}</span>
              </div>

              <div className="expense-actions">
                {!isPaid ? (
                  <button
                    className="ghost-action expense-pay-action"
                    onClick={() => onMarkPaid(expense.id)}
                    type="button"
                  >
                    Marcar como pago
                  </button>
                ) : (
                  <span>Pago em {expense.paidAt ? formatDueDate(expense.paidAt) : '-'}</span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function createLabelMap(items) {
  return items.reduce((labels, item) => ({ ...labels, [item.value]: item.label }), {})
}

function formatAlert(expense, alertTimingLabels) {
  if (!expense.alertEnabled) {
    return 'Sem alerta'
  }

  return `${alertTimingLabels[expense.alertTiming]} às ${expense.alertTime}`
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  })
}

function formatDueDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}
