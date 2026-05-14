export function CardSummary({ summary }) {
  return (
    <section className="card-summary" aria-label="Resumo dos cartões">
      {summary.map((item) => (
        <article className="summary-tile card-summary-tile" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
  )
}
