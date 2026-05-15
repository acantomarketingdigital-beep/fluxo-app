export function CardList({ cards }) {
  return (
    <section className="panel cards-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Carteira</p>
          <h2>Lista de cart&otilde;es</h2>
        </div>
        <span>{cards.length} ativos</span>
      </div>

      <div className="credit-card-list">
        {cards.length === 0 ? (
          <article className="empty-state compact-empty-state">
            <strong>Nenhum cartão cadastrado</strong>
            <span>Use o painel de cartões para restaurar dados de demonstração quando precisar.</span>
          </article>
        ) : null}
        {cards.map((card) => (
          <article className={`credit-card credit-card-${card.variant}`} key={card.lastDigits}>
            <div className="credit-card-top">
              <span>{card.name}</span>
              <strong>**** {card.lastDigits}</strong>
            </div>
            <div className="credit-card-total">
              <span>Fatura atual</span>
              <strong>{card.invoice}</strong>
            </div>
            <div className="credit-card-meta">
              <span>Limite {card.limit}</span>
              <span>Vence {card.dueDate}</span>
            </div>
            <div className="card-usage">
              <span style={{ width: `${card.usage}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
