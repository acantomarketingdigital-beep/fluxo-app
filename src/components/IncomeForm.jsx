export function IncomeForm({
  formData,
  frequencyOptions,
  incomeTypes,
  onChange,
  onSubmit,
  onTypeChange,
  statusMessage,
  statusOptions,
}) {
  const isCash = formData.type === 'cash'

  return (
    <section className="panel income-form-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h2>Adicionar receita</h2>
        </div>
      </div>

      <form className="income-form" onSubmit={onSubmit}>
        <div className="income-type-selector" aria-label="Tipo de receita">
          {incomeTypes.map((type) => (
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
            <span>Valor</span>
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
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Data</span>
            <input
              name="date"
              onChange={onChange}
              required
              type="date"
              value={formData.date}
            />
          </label>

          <label className="form-field">
            <span>Status</span>
            <select disabled name="status" onChange={onChange} value={formData.status}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

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
              {frequencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>Observação opcional</span>
          <textarea
            name="note"
            onChange={onChange}
            placeholder={isCash ? 'Onde esse saldo está guardado?' : 'Condição de pagamento, contrato, referência...'}
            value={formData.note}
          />
        </label>

        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <button className="primary-action form-submit" type="submit">
          Adicionar receita
        </button>
      </form>
    </section>
  )
}
