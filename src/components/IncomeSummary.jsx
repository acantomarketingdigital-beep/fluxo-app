export function IncomeSummary({ summary }) {
  return (
    <section className="income-summary" aria-label="Resumo de receitas">
      {summary.map((item) => (
        <article className="summary-tile income-summary-tile" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
  )
}
