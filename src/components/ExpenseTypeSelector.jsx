export function ExpenseTypeSelector({ activeType, expenseTypes, onChange }) {
  return (
    <div className="expense-type-selector" aria-label="Tipo de despesa">
      {expenseTypes.map((type) => (
        <button
          className={activeType === type.id ? 'expense-type is-selected' : 'expense-type'}
          key={type.id}
          onClick={() => onChange(type.id)}
          type="button"
        >
          <span>{type.label}</span>
          <small>{type.description}</small>
        </button>
      ))}
    </div>
  )
}
