export function PaymentList({
  actionLabel = 'Ver todos',
  emptyMessage = 'Nenhum item na agenda.',
  eyebrow = 'Agenda',
  payments,
  title = 'Próximos pagamentos',
}) {
  return (
    <section className="panel payments-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {actionLabel ? (
          <button type="button" className="ghost-action">
            {actionLabel}
          </button>
        ) : null}
      </div>

      <div className="payment-list">
        {payments.length === 0 ? (
          <div className="expense-empty-state">{emptyMessage}</div>
        ) : null}

        {payments.map((payment) => (
          <article className="payment-row" key={payment.id ?? `${payment.payee}-${payment.date}`}>
            <div>
              <span className="payment-date">{payment.date}</span>
            </div>
            <div className="payment-main">
              <strong>{payment.payee}</strong>
              <span>{payment.category}</span>
            </div>
            <div className="payment-side">
              <strong>{payment.amount}</strong>
              <span>{payment.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
