export function CashFlowPanel({
  categories,
  forecastPercent = 0,
  forecastValue = 'R$ 0,00',
}) {
  return (
    <section className="panel cashflow-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Previs&atilde;o</p>
          <h2>Distribui&ccedil;&atilde;o de gastos</h2>
        </div>
        <span>Maio</span>
      </div>

      <div className="forecast-card">
        <div>
          <span>Entrada l&iacute;quida prevista</span>
          <strong>{forecastValue}</strong>
        </div>
        <div
          className="forecast-ring"
          style={{ '--forecast-value': `${forecastPercent}%` }}
          aria-label={`${forecastPercent} por cento da meta`}
        >
          {forecastPercent}%
        </div>
      </div>

      <div className="category-list">
        {categories.length === 0 ? (
          <div className="expense-empty-state">Sem despesas no mês.</div>
        ) : null}

        {categories.map((category) => (
          <div className="category-row" key={category.name}>
            <div className="category-copy">
              <span>{category.name}</span>
              <strong>{category.value}</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${category.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
