import { useEffect, useRef, useState } from 'react'

export function IncomeList({ incomes, onDelete, onEdit, onMarkReceived }) {
  return (
    <section className="panel income-list-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Controle</p>
          <h2>Receitas cadastradas</h2>
        </div>
        <span>{incomes.length} itens</span>
      </div>

      <div className="income-list">
        {incomes.length === 0 ? (
          <div className="expense-empty-state">Nenhuma receita cadastrada.</div>
        ) : null}

        {incomes.map((income) => (
          <IncomeRow
            income={income}
            key={income.id}
            onDelete={onDelete}
            onEdit={onEdit}
            onMarkReceived={onMarkReceived}
          />
        ))}
      </div>
    </section>
  )
}

function IncomeRow({ income, onDelete, onEdit, onMarkReceived }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const isReceived = income.status === 'received'

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <article className={isReceived ? 'income-row income-row-received' : 'income-row income-row-pending'}>
      <div className={isReceived ? 'income-status income-status-received' : 'income-status income-status-pending'} aria-hidden="true">
        {isReceived ? 'Recebido' : 'Pendente'}
      </div>

      <div className="income-main">
        <strong>{income.description}</strong>
        <span>
          {income.source}
          {income.recurring ? ' · Recorrente' : ''}
        </span>
        {income.installmentGroupId && income.installmentsTotal > 1 ? (
          <small>
            <span className="group-badge">{income.installmentNumber}/{income.installmentsTotal}</span>
          </small>
        ) : null}
        {income.note ? <small>{income.note}</small> : null}
      </div>

      <div className="income-meta">
        <strong>{formatCurrency(income.amount)}</strong>
        <span>{formatDate(income.date)}</span>
      </div>

      <div className="income-actions">
        {!isReceived ? (
          <button
            className="ghost-action income-receive-action"
            onClick={() => onMarkReceived(income.id)}
            type="button"
          >
            Marcar recebido
          </button>
        ) : (
          <span>Recebido em {income.receivedAt ? formatDate(income.receivedAt) : '-'}</span>
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
              onClick={() => { setMenuOpen(false); onEdit(income) }}
              type="button"
            >
              ✎ Editar
            </button>
            <button
              className="row-menu-item danger"
              onClick={() => { setMenuOpen(false); onDelete(income) }}
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

function formatCurrency(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { currency: 'BRL', style: 'currency' })
}

function formatDate(date) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
}
