import { useEffect, useRef, useState } from 'react'

export function ExpenseList({
  expenses,
  onDelete,
  onEdit,
  onMarkPaid,
}) {
  return (
    <section className="panel expense-list-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Controle</p>
          <h2>Despesas cadastradas</h2>
        </div>
        <span>{expenses.length} itens</span>
      </div>

      <div className="expense-list">
        {expenses.length === 0 ? (
          <div className="expense-empty-state">Nenhuma despesa cadastrada.</div>
        ) : null}

        {expenses.map((expense) => (
          <ExpenseRow
            expense={expense}
            key={expense.id}
            onDelete={onDelete}
            onEdit={onEdit}
            onMarkPaid={onMarkPaid}
          />
        ))}
      </div>
    </section>
  )
}

function ExpenseRow({ expense, onDelete, onEdit, onMarkPaid }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const status = expense.displayStatus ?? expense.status
  const isPaid = status === 'paid'

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <article className={`expense-row expense-row-${status}`}>
      <div className={`expense-status expense-status-${status}`} aria-hidden="true">
        {statusLabel(status)}
      </div>

      <div className="expense-main">
        <strong>{expense.description}</strong>
        <span>
          {typeLabel(expense.type)}
          {expense.category ? ` · ${expense.category}` : ''}
        </span>
        {expense.installmentGroupId && expense.installmentsTotal > 1 ? (
          <small>
            <span className="group-badge">{expense.installmentNumber}/{expense.installmentsTotal}</span>
            {expense.cardName ? ` · ${expense.cardName}` : ''}
          </small>
        ) : null}
        {!expense.installmentGroupId && expense.cardName ? (
          <small>{paymentMethodLabel(expense.paymentMethod)} · {expense.cardName}</small>
        ) : null}
        {!expense.installmentGroupId && expense.paymentMethod && expense.paymentMethod !== 'other' && !expense.cardName ? (
          <small>{paymentMethodLabel(expense.paymentMethod)}</small>
        ) : null}
      </div>

      <div className="expense-meta">
        <strong>{formatCurrency(expense.amount)}</strong>
        <span>{formatDueDate(expense.dueDate)}</span>
        {expense.installmentsTotal > 1 && !expense.installmentGroupId ? (
          <span>Total: {formatCurrency(expense.totalAmount)}</span>
        ) : null}
      </div>

      <div className="expense-alert">
        <strong>{statusLabel(status)}</strong>
        {expense.alertEnabled ? (
          <span>{alertTimingLabel(expense.alertTiming)} às {expense.alertTime}</span>
        ) : (
          <span>Sem alerta</span>
        )}
      </div>

      <div className="expense-actions">
        {!isPaid ? (
          <button
            className="ghost-action expense-pay-action"
            onClick={() => onMarkPaid(expense.id)}
            type="button"
          >
            Marcar pago
          </button>
        ) : (
          <span>Pago em {expense.paidAt ? formatDueDate(expense.paidAt) : '-'}</span>
        )}
      </div>

      <div className="row-menu" ref={menuRef}>
        <button
          aria-label="Ações"
          className={menuOpen ? 'row-menu-btn is-open' : 'row-menu-btn'}
          onClick={() => setMenuOpen((v) => !v)}
          type="button"
        >
          ···
        </button>
        {menuOpen ? (
          <div className="row-menu-dropdown" role="menu">
            <button
              className="row-menu-item"
              onClick={() => { setMenuOpen(false); onEdit(expense) }}
              type="button"
            >
              ✎ Editar
            </button>
            <button
              className="row-menu-item danger"
              onClick={() => { setMenuOpen(false); onDelete(expense) }}
              type="button"
            >
              ✕ Excluir
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function statusLabel(status) {
  if (status === 'paid') return 'Pago'
  if (status === 'overdue') return 'Atrasado'
  return 'Aberto'
}

function typeLabel(type) {
  if (type === 'recurring') return 'Recorrente'
  if (type === 'installment') return 'Parcelado'
  return 'Único'
}

function paymentMethodLabel(method) {
  const labels = {
    cash: 'Dinheiro',
    pix: 'Pix',
    debit: 'Débito',
    credit_card: 'Cartão de crédito',
    bill: 'Boleto',
    other: '',
  }
  return labels[method] ?? ''
}

function alertTimingLabel(timing) {
  if (timing === 'before_due') return '1 dia antes'
  return 'No dia'
}

function formatCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 'R$ 0,00'
  return num.toLocaleString('pt-BR', { currency: 'BRL', style: 'currency' })
}

function formatDueDate(date) {
  if (!date) return '-'
  const d = new Date(`${date}T12:00:00`)
  const opts = { day: '2-digit', month: 'short' }
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return new Intl.DateTimeFormat('pt-BR', opts).format(d)
}
