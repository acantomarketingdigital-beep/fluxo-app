import { useEffect, useRef, useState } from 'react'

const COLORS = [
  { value: 'violet', label: 'Roxo' },
  { value: 'plum', label: 'Ameixa' },
  { value: 'graphite', label: 'Grafite' },
  { value: 'emerald', label: 'Esmeralda' },
  { value: 'blue', label: 'Azul' },
  { value: 'amber', label: 'Âmbar' },
]

export function ManagedCardList({
  cards,
  formatCurrency,
  formatDate,
  onAddCard,
  onDeleteCard,
  onEditCard,
  onPayInvoice,
  onSelect,
  selectedCardId,
}) {
  return (
    <section className="managed-card-grid" aria-label="Cartões cadastrados">
      {cards.map((card) => (
        <CardTile
          card={card}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          isSelected={selectedCardId === card.id}
          key={card.id}
          onDelete={onDeleteCard}
          onEdit={onEditCard}
          onPayInvoice={onPayInvoice}
          onSelect={onSelect}
        />
      ))}

      <button className="add-card-trigger" onClick={onAddCard} type="button">
        <span>+</span>
        <strong>Novo cartão</strong>
        <small>Adicionar cartão</small>
      </button>
    </section>
  )
}

function CardTile({ card, formatCurrency, formatDate, isSelected, onDelete, onEdit, onPayInvoice, onSelect }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const color = card.color ?? card.variant ?? 'violet'

  const usedPercent =
    card.totalLimit > 0
      ? Math.round(((card.totalLimit - card.availableLimit) / card.totalLimit) * 100)
      : 0

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <article
      className={isSelected
        ? `managed-card managed-card-${color} is-selected`
        : `managed-card managed-card-${color}`}
    >
      <div className="managed-card-header">
        <div>
          <span>{card.brand ?? 'Cartão'}</span>
          <strong>{card.name}</strong>
        </div>
        <div className="managed-card-actions">
          <button onClick={() => onSelect(card.id)} type="button">Usar</button>
          <button disabled={card.invoice <= 0} onClick={() => onPayInvoice(card.id)} type="button">
            Pagar fatura
          </button>
          <div className="row-menu" ref={menuRef} style={{ position: 'relative' }}>
            <button
              aria-label="Opções"
              className={menuOpen ? 'row-menu-btn is-open' : 'row-menu-btn'}
              onClick={() => setMenuOpen((v) => !v)}
              style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
              type="button"
            >
              ···
            </button>
            {menuOpen ? (
              <div className="row-menu-dropdown" role="menu">
                <button className="row-menu-item" onClick={() => { setMenuOpen(false); onEdit(card) }} type="button">
                  ✎ Editar
                </button>
                <button className="row-menu-item danger" onClick={() => { setMenuOpen(false); onDelete(card) }} type="button">
                  ✕ Excluir
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="managed-card-balance">
        <span>Limite disponível</span>
        <strong>{formatCurrency(card.availableLimit)}</strong>
      </div>

      <div className="managed-card-details">
        <div>
          <span>Limite total</span>
          <strong>{formatCurrency(card.totalLimit)}</strong>
        </div>
        <div>
          <span>Fatura atual</span>
          <strong>{formatCurrency(card.invoice)}</strong>
        </div>
        <div>
          <span>Vencimento</span>
          <strong>{card.dueDate ? formatDate(card.dueDate) : `Dia ${card.dueDay}`}</strong>
        </div>
      </div>

      <div className="limit-track" aria-label={`${usedPercent}% do limite utilizado`}>
        <span style={{ width: `${usedPercent}%` }} />
      </div>
    </article>
  )
}
