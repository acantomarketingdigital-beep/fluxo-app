import { useEffect, useMemo, useState } from 'react'
import { ExpenseForm } from './ExpenseForm'
import { ExpenseList } from './ExpenseList'
import { ExpenseSummary } from './ExpenseSummary'
import { Topbar } from './Topbar'
import {
  alertTimingOptions,
  expenseTypes,
  frequencyOptions,
  statusOptions,
} from '../data/expenses'
import {
  loadExpensesState,
  resetExpensesData,
  saveExpensesState,
} from '../storage/expensesStorage'
import { loadCardsState } from '../storage/cardsStorage'
import {
  hasTransactionForReference,
  recordTransaction,
} from '../storage/transactionsStorage'
import { useToast } from '../hooks/useToast'

const TODAY = getTodayDate()

const initialFormData = {
  type: 'single',
  description: '',
  amount: '',
  totalAmount: '',
  installmentsTotal: '3',
  dueDate: TODAY,
  status: 'open',
  category: '',
  note: '',
  frequency: 'monthly',
  alertEnabled: true,
  alertTiming: 'before_due',
  alertTime: '08:00',
  paymentMethod: 'other',
  cardId: '',
  cardInstallments: '1',
}

export function ExpenseScreen() {
  const [expensesState, setExpensesState] = useState(loadExpensesState)
  const [cards, setCards] = useState(() => loadCardsState().cards)
  const [formData, setFormData] = useState(initialFormData)
  const [statusMessage, setStatusMessage] = useState('')
  const [editingExpense, setEditingExpense] = useState(null)
  const [editFormData, setEditFormData] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const { addToast } = useToast()
  const { expenses } = expensesState

  useEffect(() => {
    function handleDataPulled() {
      setExpensesState(loadExpensesState())
      setCards(loadCardsState().cards)
    }
    window.addEventListener('fluxo:data-pulled', handleDataPulled)
    return () => window.removeEventListener('fluxo:data-pulled', handleDataPulled)
  }, [])

  useEffect(() => {
    saveExpensesState(expensesState)
  }, [expensesState])

  const today = useMemo(getTodayDate, [])

  const expensesWithStatus = useMemo(
    () => expenses.map((e) => ({ ...e, displayStatus: getExpenseDisplayStatus(e, today) })),
    [expenses, today],
  )

  const sortedExpenses = useMemo(
    () => [...expensesWithStatus].sort(sortExpensesByPriority),
    [expensesWithStatus],
  )

  const summary = useMemo(() => {
    const unpaid = expensesWithStatus.filter((e) => e.displayStatus !== 'paid')
    const totalOpen = unpaid.reduce((s, e) => s + e.amount, 0)
    const overdue = expensesWithStatus.filter((e) => e.displayStatus === 'overdue').length
    const alerts = unpaid.filter((e) => e.alertEnabled).length
    const nextDue = [...unpaid].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]

    return [
      { label: 'Total em aberto', value: formatCurrency(totalOpen), detail: `${unpaid.length} despesas pendentes` },
      { label: 'Atrasadas', value: String(overdue), detail: 'Destaque em vermelho' },
      { label: 'Alertas ativos', value: String(alerts), detail: 'Lembretes configurados' },
      { label: 'Próximo vencimento', value: nextDue ? formatShortDate(nextDue.dueDate) : '-', detail: nextDue?.description ?? 'Sem despesas abertas' },
    ]
  }, [expensesWithStatus])

  function handleChange(event) {
    const { checked, name, type, value } = event.target
    setStatusMessage('')
    setFormData((cur) => ({
      ...cur,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'paymentMethod' && value !== 'credit_card' ? { cardId: '', cardInstallments: '1' } : {}),
    }))
  }

  function handleTypeChange(type) {
    setStatusMessage('')
    setFormData((cur) => ({
      ...cur,
      type,
      amount: type === 'installment' ? cur.amount : cur.amount || cur.totalAmount,
      totalAmount: type === 'installment' ? cur.totalAmount || cur.amount : '',
      frequency: type === 'single' ? 'monthly' : cur.frequency || 'monthly',
      installmentsTotal: type === 'installment' ? cur.installmentsTotal : '3',
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (formData.type === 'installment') {
      handleSubmitInstallmentGroup()
      return
    }

    if (formData.type === 'recurring') {
      handleSubmitRecurringGroup()
      return
    }

    const newExpense = createExpenseFromForm(formData)
    if (!newExpense) {
      setStatusMessage('Preencha um valor maior que zero e todos os campos obrigatórios.')
      return
    }

    if (newExpense.status === 'paid') {
      recordExpensePayment(newExpense)
    }

    setExpensesState((cur) => ({ expenses: [newExpense, ...cur.expenses] }))
    setStatusMessage('Despesa cadastrada.')
    addToast({ title: 'Despesa cadastrada', description: 'Salva com sucesso.', tone: 'success' })
    setFormData({ ...initialFormData, dueDate: TODAY })
  }

  function handleSubmitRecurringGroup() {
    const amount = parseBrazilianAmount(formData.amount)
    if (amount <= 0 || !formData.description.trim() || !formData.dueDate) {
      setStatusMessage('Preencha valor, descrição e data.')
      return
    }

    const cardObj = formData.paymentMethod === 'credit_card'
      ? cards.find((c) => c.id === formData.cardId)
      : null

    const groupId = createGroupId()
    const startDate = formData.dueDate
    const endDate = addMonths(startDate, 12)
    const records = []
    let currentDate = startDate

    while (currentDate <= endDate) {
      records.push({
        id: createExpenseId(),
        type: 'recurring',
        description: formData.description.trim(),
        amount,
        totalAmount: 0,
        installmentsTotal: 1,
        installmentNumber: 1,
        dueDate: currentDate,
        status: 'open',
        category: formData.category.trim(),
        note: formData.note.trim(),
        frequency: formData.frequency,
        alertEnabled: formData.alertEnabled,
        alertTiming: formData.alertTiming,
        alertTime: formData.alertTime,
        paidAt: '',
        paymentMethod: formData.paymentMethod,
        cardId: cardObj?.id ?? '',
        cardName: cardObj?.name ?? '',
        installmentGroupId: '',
        recurringGroupId: groupId,
      })
      currentDate = addFrequency(currentDate, formData.frequency)
    }

    setExpensesState((cur) => ({ expenses: [...records, ...cur.expenses] }))
    setStatusMessage(`${records.length} lançamentos recorrentes criados.`)
    addToast({
      title: 'Recorrência criada',
      description: `${records.length} lançamentos de ${formatCurrency(amount)}`,
      tone: 'success',
    })
    setFormData({ ...initialFormData, dueDate: TODAY })
  }

  function handleSubmitInstallmentGroup() {
    const totalAmount = parseBrazilianAmount(formData.totalAmount || formData.amount)
    const installmentsTotal = Math.max(2, Number(formData.installmentsTotal) || 2)

    if (totalAmount <= 0 || !formData.description.trim() || !formData.dueDate) {
      setStatusMessage('Preencha valor, descrição e data.')
      return
    }

    const cardObj = formData.paymentMethod === 'credit_card'
      ? cards.find((c) => c.id === formData.cardId)
      : null

    const groupId = createGroupId()
    const installmentAmount = totalAmount / installmentsTotal
    const newExpenses = Array.from({ length: installmentsTotal }, (_, i) => ({
      id: createExpenseId(),
      type: 'installment',
      description: formData.description.trim(),
      amount: installmentAmount,
      totalAmount,
      installmentsTotal,
      installmentNumber: i + 1,
      dueDate: addMonths(formData.dueDate, i),
      status: 'open',
      category: formData.category.trim(),
      note: formData.note.trim(),
      frequency: formData.frequency,
      alertEnabled: formData.alertEnabled,
      alertTiming: formData.alertTiming,
      alertTime: formData.alertTime,
      paidAt: '',
      paymentMethod: formData.paymentMethod,
      cardId: cardObj?.id ?? '',
      cardName: cardObj?.name ?? '',
      installmentGroupId: groupId,
    }))

    setExpensesState((cur) => ({ expenses: [...newExpenses, ...cur.expenses] }))
    setStatusMessage(`${installmentsTotal} parcelas criadas para "${formData.description.trim()}".`)
    addToast({
      title: 'Parcelas criadas',
      description: `${installmentsTotal}x de ${formatCurrency(installmentAmount)}`,
      tone: 'success',
    })
    setFormData({ ...initialFormData, dueDate: TODAY })
  }

  function handleMarkPaid(expenseId) {
    const selectedExpense = expenses.find((e) => e.id === expenseId)
    if (!selectedExpense || getExpenseDisplayStatus(selectedExpense, today) === 'paid') return

    const paymentDate = getTodayDate()

    setExpensesState((cur) => {
      const target = cur.expenses.find((e) => e.id === expenseId)
      if (!target || getExpenseDisplayStatus(target, today) === 'paid') return cur

      recordExpensePayment(target, paymentDate)

      const updated = cur.expenses.map((e) =>
        e.id === expenseId ? { ...e, status: 'paid', paidAt: paymentDate } : e,
      )

      if (target.type === 'recurring' && !target.installmentGroupId && !target.recurringGroupId) {
        const next = createNextRecurring(target)
        return { expenses: next ? [next, ...updated] : updated }
      }

      return { expenses: updated }
    })

    addToast({ title: 'Despesa paga', description: 'Registrado em transações.', tone: 'success' })
  }

  function handleEdit(expense) {
    setEditingExpense(expense)
    setEditFormData({
      type: expense.type ?? 'single',
      description: expense.description ?? '',
      amount: String(expense.amount ?? ''),
      totalAmount: String(expense.totalAmount ?? expense.amount ?? ''),
      installmentsTotal: String(expense.installmentsTotal ?? 1),
      dueDate: expense.dueDate ?? TODAY,
      status: expense.status ?? 'open',
      category: expense.category ?? '',
      note: expense.note ?? '',
      frequency: expense.frequency ?? 'monthly',
      alertEnabled: expense.alertEnabled ?? true,
      alertTiming: expense.alertTiming ?? 'before_due',
      alertTime: expense.alertTime ?? '08:00',
      paymentMethod: expense.paymentMethod ?? 'other',
      cardId: expense.cardId ?? '',
      cardInstallments: '1',
    })
  }

  function handleEditChange(event) {
    const { checked, name, type, value } = event.target
    setEditFormData((cur) => ({
      ...cur,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'paymentMethod' && value !== 'credit_card' ? { cardId: '' } : {}),
    }))
  }

  function handleEditTypeChange(type) {
    setEditFormData((cur) => ({
      ...cur,
      type,
      amount: type === 'installment' ? cur.amount : cur.amount || cur.totalAmount,
      totalAmount: type === 'installment' ? cur.totalAmount || cur.amount : '',
      frequency: type === 'single' ? 'monthly' : cur.frequency || 'monthly',
    }))
  }

  function handleSaveEdit(event) {
    event.preventDefault()

    const parsedAmount = parseBrazilianAmount(
      editFormData.type === 'installment' ? editFormData.totalAmount : editFormData.amount,
    )

    if (parsedAmount <= 0 || !editFormData.description.trim()) {
      return
    }

    const cardObj = editFormData.paymentMethod === 'credit_card'
      ? cards.find((c) => c.id === editFormData.cardId)
      : null

    const hasGroup = !!editingExpense.installmentGroupId && editingExpense.installmentsTotal > 1

    if (hasGroup) {
      const groupId = editingExpense.installmentGroupId
      const groupExpenses = expenses.filter((e) => e.installmentGroupId === groupId)
      const perInstallment = parsedAmount / groupExpenses.length

      setExpensesState((cur) => ({
        expenses: cur.expenses.map((e) => {
          if (e.installmentGroupId !== groupId) return e
          return {
            ...e,
            description: editFormData.description.trim(),
            amount: perInstallment,
            totalAmount: parsedAmount,
            category: editFormData.category.trim(),
            note: editFormData.note.trim(),
            paymentMethod: editFormData.paymentMethod,
            cardId: cardObj?.id ?? '',
            cardName: cardObj?.name ?? '',
          }
        }),
      }))
      addToast({ title: 'Parcelas atualizadas', description: `${groupExpenses.length} parcelas editadas.`, tone: 'success' })
    } else {
      setExpensesState((cur) => ({
        expenses: cur.expenses.map((e) => {
          if (e.id !== editingExpense.id) return e
          return {
            ...e,
            type: editFormData.type,
            description: editFormData.description.trim(),
            amount: parsedAmount,
            totalAmount: editFormData.type === 'installment' ? parsedAmount : 0,
            dueDate: editFormData.dueDate,
            status: editFormData.status,
            category: editFormData.category.trim(),
            note: editFormData.note.trim(),
            frequency: editFormData.frequency,
            alertEnabled: editFormData.alertEnabled,
            alertTiming: editFormData.alertTiming,
            alertTime: editFormData.alertTime,
            paymentMethod: editFormData.paymentMethod,
            cardId: cardObj?.id ?? '',
            cardName: cardObj?.name ?? '',
          }
        }),
      }))
      addToast({ title: 'Despesa atualizada', description: 'Alterações salvas.', tone: 'success' })
    }

    setEditingExpense(null)
    setEditFormData(null)
  }

  function handleDelete(expense) {
    const installGroupSize = expense.installmentGroupId
      ? expenses.filter((e) => e.installmentGroupId === expense.installmentGroupId).length
      : 0
    const recurGroupSize = expense.recurringGroupId
      ? expenses.filter((e) => e.recurringGroupId === expense.recurringGroupId).length
      : 0
    setDeleteConfirm({ expense, groupSize: installGroupSize || recurGroupSize })
  }

  function handleConfirmDelete(mode) {
    if (!deleteConfirm) return
    const { expense } = deleteConfirm

    if (mode === 'group' && expense.installmentGroupId) {
      const groupId = expense.installmentGroupId
      setExpensesState((cur) => ({
        expenses: cur.expenses.filter((e) => e.installmentGroupId !== groupId),
      }))
      addToast({ title: 'Parcelas excluídas', description: 'Todo o grupo foi removido.', tone: 'success' })
    } else if (mode === 'group' && expense.recurringGroupId) {
      const groupId = expense.recurringGroupId
      setExpensesState((cur) => ({
        expenses: cur.expenses.filter((e) => e.recurringGroupId !== groupId),
      }))
      addToast({ title: 'Recorrência excluída', description: 'Todos os lançamentos foram removidos.', tone: 'success' })
    } else {
      setExpensesState((cur) => ({
        expenses: cur.expenses.filter((e) => e.id !== expense.id),
      }))
      addToast({ title: 'Despesa excluída', tone: 'success', description: '' })
    }

    setDeleteConfirm(null)
  }

  function handleResetExpenses() {
    if (!window.confirm('Apagar todas as despesas salvas neste navegador?')) return
    setExpensesState(resetExpensesData())
    setFormData({ ...initialFormData, dueDate: TODAY })
    setStatusMessage('Despesas apagadas.')
  }

  function focusExpenseForm() {
    document.getElementById('expense-description')?.focus()
  }

  return (
    <>
      <Topbar
        actionLabel="Adicionar despesa"
        eyebrow="Despesas"
        onAction={focusExpenseForm}
        onSecondaryAction={handleResetExpenses}
        searchPlaceholder="Buscar despesas"
        secondaryActionLabel="Resetar despesas"
        subtitle="Contas, vencimentos e alertas em um só lugar"
        title="Gestão de despesas"
      />

      <ExpenseSummary summary={summary} />

      <section className="expenses-grid" aria-label="Gestão de despesas">
        <ExpenseForm
          alertTimingOptions={alertTimingOptions}
          cards={cards}
          expenseTypes={expenseTypes}
          formData={formData}
          frequencyOptions={frequencyOptions}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onTypeChange={handleTypeChange}
          statusMessage={statusMessage}
          statusOptions={statusOptions}
        />
        <ExpenseList
          expenses={sortedExpenses}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onMarkPaid={handleMarkPaid}
        />
      </section>

      {editingExpense && editFormData ? (
        <div className="modal-overlay" onClick={() => { setEditingExpense(null); setEditFormData(null) }}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                Editar despesa
                {editingExpense.installmentGroupId && editingExpense.installmentsTotal > 1
                  ? ` — todas as ${expenses.filter((e) => e.installmentGroupId === editingExpense.installmentGroupId).length} parcelas`
                  : ''}
              </h2>
              <button className="modal-close" onClick={() => { setEditingExpense(null); setEditFormData(null) }} type="button">×</button>
            </div>
            <div className="modal-body">
              <form className="expense-form" onSubmit={handleSaveEdit}>
                <label className="form-field form-field-wide">
                  <span>Descrição</span>
                  <input
                    name="description"
                    onChange={handleEditChange}
                    required
                    type="text"
                    value={editFormData.description}
                  />
                </label>

                <div className="form-grid">
                  <label className="form-field">
                    <span>{editingExpense.installmentGroupId ? 'Valor total' : 'Valor'}</span>
                    <input
                      inputMode="decimal"
                      name={editingExpense.installmentGroupId ? 'totalAmount' : 'amount'}
                      onChange={handleEditChange}
                      required
                      type="text"
                      value={editingExpense.installmentGroupId ? editFormData.totalAmount : editFormData.amount}
                    />
                  </label>

                  {!editingExpense.installmentGroupId ? (
                    <label className="form-field">
                      <span>Vencimento</span>
                      <input name="dueDate" onChange={handleEditChange} type="date" value={editFormData.dueDate} />
                    </label>
                  ) : null}
                </div>

                <div className="form-grid">
                  {!editingExpense.installmentGroupId ? (
                    <label className="form-field">
                      <span>Status</span>
                      <select name="status" onChange={handleEditChange} value={editFormData.status}>
                        {statusOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="form-field">
                    <span>Categoria</span>
                    <input name="category" onChange={handleEditChange} type="text" value={editFormData.category} />
                  </label>
                </div>

                <div className="form-field form-field-wide">
                  <span>Forma de pagamento</span>
                  <div className="payment-method-grid">
                    {PAYMENT_METHODS.map((pm) => (
                      <button
                        className={editFormData.paymentMethod === pm.value ? 'payment-method-btn is-selected' : 'payment-method-btn'}
                        key={pm.value}
                        onClick={() => handleEditChange({ target: { name: 'paymentMethod', value: pm.value, type: 'select' } })}
                        type="button"
                      >
                        <span>{pm.icon}</span>
                        <small>{pm.label}</small>
                      </button>
                    ))}
                  </div>
                </div>

                {editFormData.paymentMethod === 'credit_card' && cards.length > 0 ? (
                  <div className="card-selector-field">
                    <label className="form-field">
                      <span>Cartão</span>
                      <select name="cardId" onChange={handleEditChange} value={editFormData.cardId}>
                        <option value="">Selecionar cartão</option>
                        {cards.filter((c) => c.active !== false).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <label className="form-field form-field-wide">
                  <span>Observação</span>
                  <textarea name="note" onChange={handleEditChange} value={editFormData.note} />
                </label>

                <div className="modal-actions">
                  <button
                    className="confirm-action-danger"
                    onClick={() => { setEditingExpense(null); setEditFormData(null); handleDelete(editingExpense) }}
                    type="button"
                  >
                    Excluir
                  </button>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button className="ghost-action" onClick={() => { setEditingExpense(null); setEditFormData(null) }} type="button">
                      Cancelar
                    </button>
                    <button className="primary-action" type="submit">Salvar alterações</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-dialog modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Excluir despesa</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)} type="button">×</button>
            </div>
            <div className="modal-body">
              <strong>{deleteConfirm.expense.description}</strong>
              <p>
                {deleteConfirm.groupSize > 1
                  ? deleteConfirm.expense.recurringGroupId
                    ? `Este lançamento faz parte de um grupo recorrente (${deleteConfirm.groupSize} lançamentos). Excluir apenas este ou todos?`
                    : `Esta é a parcela ${deleteConfirm.expense.installmentNumber}/${deleteConfirm.expense.installmentsTotal}. Deseja excluir apenas esta parcela ou todo o grupo (${deleteConfirm.groupSize} parcelas)?`
                  : 'Confirma a exclusão desta despesa? Esta ação não pode ser desfeita.'}
              </p>
              <div className="confirm-actions">
                {deleteConfirm.groupSize > 1 ? (
                  <>
                    <button className="confirm-action-danger" onClick={() => handleConfirmDelete('group')} type="button">
                      {deleteConfirm.expense.recurringGroupId
                        ? `Excluir todos os ${deleteConfirm.groupSize} lançamentos`
                        : `Excluir todas as ${deleteConfirm.groupSize} parcelas`}
                    </button>
                    <button className="confirm-action-secondary" onClick={() => handleConfirmDelete('single')} type="button">
                      {deleteConfirm.expense.recurringGroupId
                        ? 'Excluir só este lançamento'
                        : `Excluir só esta parcela (${deleteConfirm.expense.installmentNumber}/${deleteConfirm.expense.installmentsTotal})`}
                    </button>
                  </>
                ) : (
                  <button className="confirm-action-danger" onClick={() => handleConfirmDelete('single')} type="button">
                    Confirmar exclusão
                  </button>
                )}
                <button className="confirm-action-cancel" onClick={() => setDeleteConfirm(null)} type="button">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

const PAYMENT_METHODS = [
  { value: 'cash', icon: '💵', label: 'Dinheiro' },
  { value: 'pix', icon: '⚡', label: 'Pix' },
  { value: 'debit', icon: '💳', label: 'Débito' },
  { value: 'credit_card', icon: '🪙', label: 'Crédito' },
  { value: 'bill', icon: '🧾', label: 'Boleto' },
  { value: 'other', icon: '·', label: 'Outro' },
]

function createExpenseFromForm(formData) {
  const parsedAmount = parseBrazilianAmount(formData.amount)
  if (parsedAmount <= 0 || !formData.description.trim() || !formData.dueDate) return null

  return {
    id: createExpenseId(),
    type: formData.type,
    description: formData.description.trim(),
    amount: parsedAmount,
    totalAmount: 0,
    installmentsTotal: 1,
    installmentNumber: 1,
    dueDate: formData.dueDate,
    status: formData.status,
    category: formData.category.trim(),
    note: formData.note.trim(),
    frequency: formData.frequency,
    alertEnabled: formData.alertEnabled,
    alertTiming: formData.alertTiming,
    alertTime: formData.alertTime,
    paidAt: formData.status === 'paid' ? getTodayDate() : '',
    paymentMethod: formData.paymentMethod,
    cardId: formData.paymentMethod === 'credit_card' ? formData.cardId : '',
    cardName: '',
    installmentGroupId: '',
  }
}

function createNextRecurring(expense) {
  return {
    ...expense,
    id: createExpenseId(),
    dueDate: addFutureFrequency(expense.dueDate, expense.frequency),
    status: 'open',
    paidAt: '',
    generatedFrom: expense.id,
  }
}

function recordExpensePayment(expense, paymentDate = getTodayDate()) {
  if (hasTransactionForReference({ origin: 'despesa', referenceId: expense.id, type: 'saida' })) return
  recordTransaction({
    type: 'saida',
    description: expense.description,
    amount: expense.amount,
    date: paymentDate,
    origin: 'despesa',
    referenceId: expense.id,
  })
}

function sortExpensesByPriority(a, b) {
  const rank = (s) => s === 'paid' ? 2 : s === 'overdue' ? 1 : 0
  const ra = rank(a.displayStatus)
  const rb = rank(b.displayStatus)
  if (ra !== rb) return ra - rb
  const d = a.dueDate.localeCompare(b.dueDate)
  return d !== 0 ? d : a.description.localeCompare(b.description)
}

function getExpenseDisplayStatus(expense, today) {
  if (expense.status === 'paid') return 'paid'
  if (expense.status === 'overdue' || expense.dueDate < today) return 'overdue'
  return 'open'
}

function addMonths(dateStr, months) {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  d.setMonth(d.getMonth() + months)
  return formatInputDate(d)
}

function addFrequency(date, frequency) {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  if (frequency === 'daily') d.setDate(d.getDate() + 1)
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 15)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return formatInputDate(d)
}

function addFutureFrequency(date, frequency) {
  let next = addFrequency(date, frequency)
  let attempts = 0
  while (next <= getTodayDate() && attempts < 60) {
    next = addFrequency(next, frequency)
    attempts += 1
  }
  return next
}

function parseBrazilianAmount(value) {
  const n = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function createExpenseId() {
  return `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createGroupId() {
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getTodayDate() {
  return formatInputDate(new Date())
}

function formatInputDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatCurrency(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { currency: 'BRL', style: 'currency' })
}

function formatShortDate(date) {
  if (!date) return '-'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${date}T12:00:00`))
}
