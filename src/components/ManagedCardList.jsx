export function ManagedCardList({
  cards,
  formatCurrency,
  formatDate,
  onPayInvoice,
  selectedCardId,
  onSelect,
}) {
  return (
    <section className="managed-card-grid" aria-label="Cartões cadastrados">
      {cards.map((card) => {
        const usedPercent = Math.round(((card.totalLimit - card.availableLimit) / card.totalLimit) * 100)

        return (
          <article
            className={
              selectedCardId === card.id
                ? `managed-card managed-card-${card.variant} is-selected`
                : `managed-card managed-card-${card.variant}`
            }
            key={card.id}
          >
            <div className="managed-card-header">
              <div>
                <span>Cart&atilde;o</span>
                <strong>{card.name}</strong>
              </div>
              <div className="managed-card-actions">
                <button onClick={() => onSelect(card.id)} type="button">
                  Usar
                </button>
                <button
                  disabled={card.invoice <= 0}
                  onClick={() => onPayInvoice(card.id)}
                  type="button"
                >
                  Pagar fatura
                </button>
              </div>
            </div>

            <div className="managed-card-balance">
              <span>Limite dispon&iacute;vel</span>
              <strong>{formatCurrency(card.availableLimit)}</strong>
            </div>

            <div className="managed-card-details">
              <div>
                <span>Limite total</span>
                <strong>{formatCurrency(card.totalLimit)}</strong>
              </div>
              <div>
                <span>Fatura atual</span>
                <strong>{formatCurrency(card.invoice)}</strong>
              </div>
              <div>
                <span>Vencimento</span>
                <strong>{formatDate(card.dueDate)}</strong>
              </div>
            </div>

            <div className="limit-track" aria-label={`${usedPercent}% do limite utilizado`}>
              <span style={{ width: `${usedPercent}%` }} />
            </div>
          </article>
        )
      })}
    </section>
  )
}
