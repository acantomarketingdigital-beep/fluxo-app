export function PurchaseForm({
  cards,
  formData,
  formatCurrency,
  onChange,
  onSubmit,
  selectedCard,
  statusMessage,
}) {
  const amount = parseBrazilianAmount(formData.amount)
  const installments = Number(formData.installments)
  const monthlyCharge = formData.purchaseType === 'installment' ? amount / installments : amount

  return (
    <section className="panel purchase-form-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Compras</p>
          <h2>Nova compra</h2>
        </div>
      </div>

      <form className="purchase-form" onSubmit={onSubmit}>
        <label className="form-field">
          <span>Cart&atilde;o</span>
          <select name="cardId" onChange={onChange} value={formData.cardId}>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Descri&ccedil;&atilde;o</span>
          <input
            id="purchase-description"
            name="description"
            onChange={onChange}
            placeholder="Ex: Equipamento de vendas"
            required
            type="text"
            value={formData.description}
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Valor da compra</span>
            <input
              inputMode="decimal"
              name="amount"
              onChange={onChange}
              placeholder="0,00"
              required
              type="text"
              value={formData.amount}
            />
          </label>

          <label className="form-field">
            <span>Parcelas</span>
            <select
              disabled={formData.purchaseType === 'cash'}
              name="installments"
              onChange={onChange}
              value={formData.installments}
            >
              {[2, 3, 4, 5, 6, 8, 10, 12].map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity}x
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="purchase-type-selector" aria-label="Tipo de compra">
          <label className={formData.purchaseType === 'cash' ? 'purchase-type is-selected' : 'purchase-type'}>
            <input
              checked={formData.purchaseType === 'cash'}
              name="purchaseType"
              onChange={onChange}
              type="radio"
              value="cash"
            />
            <span>Compra &agrave; vista</span>
            <small>Entra integralmente na fatura</small>
          </label>

          <label
            className={
              formData.purchaseType === 'installment'
                ? 'purchase-type is-selected'
                : 'purchase-type'
            }
          >
            <input
              checked={formData.purchaseType === 'installment'}
              name="purchaseType"
              onChange={onChange}
              type="radio"
              value="installment"
            />
            <span>Compra parcelada</span>
            <small>Limite usa o total, fatura usa a parcela</small>
          </label>
        </div>

        <div className="purchase-preview">
          <div>
            <span>Limite usado</span>
            <strong>{formatCurrency(amount)}</strong>
          </div>
          <div>
            <span>Cobran&ccedil;a nesta fatura</span>
            <strong>{formatCurrency(monthlyCharge)}</strong>
          </div>
          <div>
            <span>Dispon&iacute;vel no cart&atilde;o</span>
            <strong>{formatCurrency(selectedCard.availableLimit)}</strong>
          </div>
        </div>

        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <button className="primary-action form-submit" type="submit">
          Registrar compra
        </button>
      </form>
    </section>
  )
}

function parseBrazilianAmount(value) {
  const numericValue = Number(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}
