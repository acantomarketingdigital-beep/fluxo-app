export function IncomeForm({
  formData,
  frequencyOptions,
  incomeTypes,
  isEditing = false,
  onChange,
  onSubmit,
  onTypeChange,
  statusMessage,
  statusOptions,
}) {
  const isCash = formData.type === 'cash'
  const isInstallment = formData.type === 'installment'

  const allTypes = [
    ...incomeTypes,
    { id: 'installment', label: 'Parcelada', description: 'Receber em parcelas' },
  ]

  return (
    <section className="panel income-form-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{isEditing ? 'Editar' : 'Cadastro'}</p>
          <h2>{isEditing ? 'Editar receita' : 'Adicionar receita'}</h2>
        </div>
      </div>

      <form className="income-form" onSubmit={onSubmit}>
        <div className="income-type-selector" aria-label="Tipo de receita" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {allTypes.map((type) => (
            <button
              className={formData.type === type.id ? 'expense-type is-selected' : 'expense-type'}
              key={type.id}
              onClick={() => onTypeChange(type.id)}
              type="button"
            >
              <span>{type.label}</span>
              <small>{type.description}</small>
            </button>
          ))}
        </div>

        <label className="form-field">
          <span>Descrição</span>
          <input
            id="income-description"
            name="description"
            onChange={onChange}
            placeholder="Ex: Salário, comissão, cliente"
            required
            type="text"
            value={formData.description}
          />
        </label>

        <div className="form-grid">
          <label className="form-field">
            <span>Origem / de quem</span>
            <input
              name="source"
              onChange={onChange}
              placeholder="Ex: Cliente Orion"
              required
              type="text"
              value={formData.source}
            />
          </label>

          <label className="form-field">
            <span>{isInstallment ? 'Valor total' : 'Valor'}</span>
            <input
              inputMode="decimal"
              name={isInstallment ? 'installmentTotalAmount' : 'amount'}
              onChange={onChange}
              placeholder="0,00"
              required
              type="text"
              value={isInstallment ? (formData.installmentTotalAmount ?? '') : formData.amount}
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>{isInstallment ? 'Data da 1ª parcela' : 'Data'}</span>
            <input
              name="date"
              onChange={onChange}
              required
              type="date"
              value={formData.date}
            />
          </label>

          {isInstallment ? (
            <label className="form-field">
              <span>Total de parcelas</span>
              <input
                min="2"
                name="installmentsTotal"
                onChange={onChange}
                required
                type="number"
                value={formData.installmentsTotal ?? ''}
              />
            </label>
          ) : (
            <label className="form-field">
              <span>Status</span>
              <select disabled name="status" onChange={onChange} value={formData.status}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {!isInstallment ? (
          <div className="income-recurring-row">
            <label className="toggle-field">
              <input
                checked={formData.recurring}
                name="recurring"
                onChange={onChange}
                type="checkbox"
              />
              <span className="toggle-control" aria-hidden="true" />
              <span>Recorrente</span>
            </label>

            <label className="form-field">
              <span>Frequência</span>
              <select
                disabled={!formData.recurring}
                name="frequency"
                onChange={onChange}
                value={formData.frequency}
              >
                {frequencyOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <label className="form-field">
          <span>Observação opcional</span>
          <textarea
            name="note"
            onChange={onChange}
            placeholder={isCash ? 'Onde esse saldo está?' : 'Condição de pagamento, referência...'}
            value={formData.note}
          />
        </label>

        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <button className="primary-action form-submit" type="submit">
          {isEditing ? 'Salvar alterações' : isInstallment ? `Criar ${formData.installmentsTotal ?? ''} parcelas` : 'Adicionar receita'}
        </button>
      </form>
    </section>
  )
}
