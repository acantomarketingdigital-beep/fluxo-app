import { ExpenseTypeSelector } from './ExpenseTypeSelector'

const PAYMENT_METHODS = [
  { value: 'cash', icon: '💵', label: 'Dinheiro' },
  { value: 'pix', icon: '⚡', label: 'Pix' },
  { value: 'debit', icon: '💳', label: 'Débito' },
  { value: 'credit_card', icon: '🪙', label: 'Crédito' },
  { value: 'bill', icon: '🧾', label: 'Boleto' },
  { value: 'other', icon: '·', label: 'Outro' },
]

export function ExpenseForm({
  alertTimingOptions = [],
  cards = [],
  expenseTypes,
  formData,
  frequencyOptions,
  isEditing = false,
  onChange,
  onSubmit,
  onTypeChange,
  statusMessage,
  statusOptions,
}) {
  const isInstallment = formData.type === 'installment'
  const isRecurring = formData.type === 'recurring'
  const isCreditCard = formData.paymentMethod === 'credit_card'
  const frequencyChoices = isInstallment
    ? frequencyOptions.filter((o) => o.value !== 'daily')
    : frequencyOptions

  return (
    <section className="panel expense-form-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{isEditing ? 'Editar' : 'Cadastro'}</p>
          <h2>{isEditing ? 'Editar despesa' : 'Adicionar despesa'}</h2>
        </div>
      </div>

      <form className="expense-form" onSubmit={onSubmit}>
        <ExpenseTypeSelector
          activeType={formData.type}
          expenseTypes={expenseTypes}
          onChange={onTypeChange}
        />

        <label className="form-field form-field-wide">
          <span>Descrição</span>
          <input
            id="expense-description"
            name="description"
            onChange={onChange}
            placeholder="Ex: Mercado, internet, aluguel"
            required
            type="text"
            value={formData.description}
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>{isInstallment ? 'Valor total' : 'Valor'}</span>
            <input
              inputMode="decimal"
              name={isInstallment ? 'totalAmount' : 'amount'}
              onChange={onChange}
              placeholder="0,00"
              required
              type="text"
              value={isInstallment ? formData.totalAmount : formData.amount}
            />
          </label>

          <label className="form-field">
            <span>Vencimento</span>
            <input
              name="dueDate"
              onChange={onChange}
              required
              type="date"
              value={formData.dueDate}
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Status</span>
            <select name="status" onChange={onChange} value={formData.status}>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Categoria opcional</span>
            <input
              name="category"
              onChange={onChange}
              placeholder="Ex: Alimentação"
              type="text"
              value={formData.category}
            />
          </label>
        </div>

        {isInstallment ? (
          <div className="installment-fields">
            <div className="form-grid">
              <label className="form-field">
                <span>Total de parcelas</span>
                <input
                  min="2"
                  name="installmentsTotal"
                  onChange={onChange}
                  required
                  type="number"
                  value={formData.installmentsTotal}
                />
              </label>

              <label className="form-field">
                <span>Frequência</span>
                <select name="frequency" onChange={onChange} value={formData.frequency}>
                  {frequencyChoices.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {isRecurring ? (
          <label className="form-field">
            <span>Frequência</span>
            <select name="frequency" onChange={onChange} value={formData.frequency}>
              {frequencyChoices.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="form-field form-field-wide">
          <span>Forma de pagamento</span>
          <div className="payment-method-grid">
            {PAYMENT_METHODS.map((pm) => (
              <button
                className={formData.paymentMethod === pm.value ? 'payment-method-btn is-selected' : 'payment-method-btn'}
                key={pm.value}
                onClick={() => onChange({ target: { name: 'paymentMethod', value: pm.value, type: 'select' } })}
                type="button"
              >
                <span>{pm.icon}</span>
                <small>{pm.label}</small>
              </button>
            ))}
          </div>
        </div>

        {isCreditCard && cards.length > 0 ? (
          <div className="card-selector-field form-grid">
            <label className="form-field">
              <span>Cartão</span>
              <select name="cardId" onChange={onChange} value={formData.cardId}>
                <option value="">Selecionar cartão</option>
                {cards.filter((c) => c.active !== false).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            {!isInstallment ? (
              <label className="form-field">
                <span>Parcelas no cartão</span>
                <select name="cardInstallments" onChange={onChange} value={formData.cardInstallments ?? '1'}>
                  <option value="1">À vista (1x)</option>
                  {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                    <option key={n} value={String(n)}>{n}x</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {isCreditCard && cards.length === 0 ? (
          <p className="form-status">Nenhum cartão cadastrado. Cadastre um cartão primeiro.</p>
        ) : null}

        <label className="form-field form-field-wide">
          <span>Observação opcional</span>
          <textarea
            name="note"
            onChange={onChange}
            placeholder="Detalhes, contrato, centro de custo..."
            value={formData.note}
          />
        </label>

        {!isEditing ? (
          <div className="alert-row expense-alert-settings">
            <label className="toggle-field">
              <input
                checked={formData.alertEnabled}
                name="alertEnabled"
                onChange={onChange}
                type="checkbox"
              />
              <span className="toggle-control" aria-hidden="true" />
              <span>Alerta ativo</span>
            </label>

            <label className="form-field">
              <span>Avisar</span>
              <select
                disabled={!formData.alertEnabled}
                name="alertTiming"
                onChange={onChange}
                value={formData.alertTiming}
              >
                {alertTimingOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="form-field alert-time">
              <span>Horário</span>
              <input
                disabled={!formData.alertEnabled}
                name="alertTime"
                onChange={onChange}
                type="time"
                value={formData.alertTime}
              />
            </label>
          </div>
        ) : null}

        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <button className="primary-action form-submit" type="submit">
          {isEditing ? 'Salvar alterações' : 'Adicionar despesa'}
        </button>
      </form>
    </section>
  )
}
