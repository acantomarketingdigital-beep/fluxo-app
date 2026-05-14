export function ExpenseSummary({ summary }) {
  return (
    <section className="expense-summary" aria-label="Resumo de despesas">
      {summary.map((item) => (
        <article className="summary-tile" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
  )
}
