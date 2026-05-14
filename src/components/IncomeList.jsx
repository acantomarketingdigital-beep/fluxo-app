export function IncomeList({
  frequencyLabels,
  incomes,
  onMarkReceived,
  statusLabels,
  typeLabels,
}) {
  return (
    <section className="panel income-list-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Controle</p>
          <h2>Receitas cadastradas</h2>
        </div>
        <span>{incomes.length} itens</span>
      </div>

      <div className="income-list">
        {incomes.length === 0 ? (
          <div className="expense-empty-state">Nenhuma receita cadastrada.</div>
        ) : null}

        {incomes.map((income) => {
          const isReceived = income.status === 'received'

          return (
            <article
              className={isReceived ? 'income-row income-row-received' : 'income-row income-row-pending'}
              key={income.id}
            >
              <div
                className={
                  isReceived
                    ? 'income-status income-status-received'
                    : 'income-status income-status-pending'
                }
                aria-hidden="true"
              >
                {statusLabels[income.status]}
              </div>

              <div className="income-main">
                <strong>{income.description}</strong>
                <span>
                  {income.source} / {typeLabels[income.type]}
                </span>
                {income.recurring ? <small>{frequencyLabels[income.frequency]}</small> : null}
                {income.note ? <small>{income.note}</small> : null}
              </div>

              <div className="income-meta">
                <strong>{formatCurrency(income.amount)}</strong>
                <span>{formatDate(income.date)}</span>
              </div>

              <div className="income-actions">
                {!isReceived ? (
                  <button
                    className="ghost-action income-receive-action"
                    onClick={() => onMarkReceived(income.id)}
                    type="button"
                  >
                    Marcar como recebido
                  </button>
                ) : (
                  <span>Recebido em {income.receivedAt ? formatDate(income.receivedAt) : '-'}</span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
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
  }).format(new Date(`${date}T12:00:00`))
}
