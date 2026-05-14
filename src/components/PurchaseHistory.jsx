export function PurchaseHistory({ formatCurrency, purchases }) {
  return (
    <section className="panel purchase-history-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Movimentos</p>
          <h2>Compras recentes</h2>
        </div>
        <span>{purchases.length} compras</span>
      </div>

      <div className="purchase-history">
        {purchases.map((purchase) => (
          <article className="purchase-row" key={purchase.id}>
            <div className="purchase-icon" aria-hidden="true">
              {purchase.installments > 1 ? `${purchase.installments}x` : '1x'}
            </div>
            <div className="purchase-copy">
              <strong>{purchase.description}</strong>
              <span>
                {purchase.cardName} / {purchase.type}
              </span>
              {purchase.installments > 1 ? (
                <small>
                  {purchase.billedInstallments} de {purchase.installments} parcelas lançadas
                </small>
              ) : null}
            </div>
            <div className="purchase-values">
              <strong>{formatCurrency(purchase.amount)}</strong>
              <span>Fatura: {formatCurrency(purchase.invoiceCharge)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
