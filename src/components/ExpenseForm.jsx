import { ExpenseTypeSelector } from './ExpenseTypeSelector'

export function ExpenseForm({
  alertTimingOptions,
  expenseTypes,
  formData,
  frequencyOptions,
  onChange,
  onSubmit,
  onTypeChange,
  statusMessage,
  statusOptions,
}) {
  const isInstallment = formData.type === 'installment'
  const isRecurring = formData.type === 'recurring'
  const frequencyChoices = isInstallment
    ? frequencyOptions.filter((option) => option.value !== 'daily')
    : frequencyOptions

  return (
    <section className="panel expense-form-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h2>Adicionar despesa</h2>
        </div>
      </div>

      <form className="expense-form" onSubmit={onSubmit}>
        <ExpenseTypeSelector
          activeType={formData.type}
          expenseTypes={expenseTypes}
          onChange={onTypeChange}
        />

        <label className="form-field form-field-wide">
          <span>Descri&ccedil;&atilde;o</span>
          <input
            id="expense-description"
            name="description"
            onChange={onChange}
            placeholder="Ex: Assinatura do ERP"
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
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Categoria opcional</span>
            <input
              name="category"
              onChange={onChange}
              placeholder="Ex: Software"
              type="text"
              value={formData.category}
            />
          </label>
        </div>

        {isInstallment ? (
          <div className="installment-fields">
            <div className="form-grid">
              <label className="form-field">
                <span>Quantidade de parcelas</span>
                <input
                  min="1"
                  name="installmentsTotal"
                  onChange={onChange}
                  required
                  type="number"
                  value={formData.installmentsTotal}
                />
              </label>

              <label className="form-field">
                <span>Parcela atual</span>
                <input
                  min="1"
                  name="installmentNumber"
                  onChange={onChange}
                  required
                  type="number"
                  value={formData.installmentNumber}
                />
              </label>
            </div>

            <label className="form-field">
              <span>Frequ&ecirc;ncia</span>
              <select name="frequency" onChange={onChange} value={formData.frequency}>
                {frequencyChoices.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {isRecurring ? (
          <label className="form-field">
            <span>Frequ&ecirc;ncia</span>
            <select name="frequency" onChange={onChange} value={formData.frequency}>
              {frequencyChoices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="form-field form-field-wide">
          <span>Observa&ccedil;&atilde;o opcional</span>
          <textarea
            name="note"
            onChange={onChange}
            placeholder="Detalhes, contrato, centro de custo..."
            value={formData.note}
          />
        </label>

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
              {alertTimingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field alert-time">
            <span>Hor&aacute;rio exato</span>
            <input
              disabled={!formData.alertEnabled}
              name="alertTime"
              onChange={onChange}
              type="time"
              value={formData.alertTime}
            />
          </label>
        </div>

        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

        <button className="primary-action form-submit" type="submit">
          Adicionar despesa
        </button>
      </form>
    </section>
  )
}
