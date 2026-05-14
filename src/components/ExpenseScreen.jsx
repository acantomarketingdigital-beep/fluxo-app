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
  resetExpensesDemoData,
  saveExpensesState,
} from '../storage/expensesStorage'
import {
  hasTransactionForReference,
  recordTransaction,
} from '../storage/transactionsStorage'
import { useToast } from '../hooks/useToast'

const initialFormData = {
  type: 'single',
  description: '',
  amount: '',
  totalAmount: '',
  installmentsTotal: '6',
  installmentNumber: '1',
  dueDate: '2026-05-15',
  status: 'open',
  category: '',
  note: '',
  frequency: 'monthly',
  alertEnabled: true,
  alertTiming: 'before_due',
  alertTime: '08:00',
}

export function ExpenseScreen() {
  const [expensesState, setExpensesState] = useState(loadExpensesState)
  const [formData, setFormData] = useState(initialFormData)
  const [statusMessage, setStatusMessage] = useState('')
  const { addToast } = useToast()
  const { expenses } = expensesState
  const today = getTodayDate()

  const typeLabels = useMemo(() => createLabelMap(expenseTypes), [])
  const frequencyLabels = useMemo(() => createLabelMap(frequencyOptions), [])
  const statusLabels = useMemo(() => createLabelMap(statusOptions), [])

  useEffect(() => {
    saveExpensesState(expensesState)
  }, [expensesState])

  const expensesWithStatus = useMemo(
    () =>
      expenses.map((expense) => ({
        ...expense,
        displayStatus: getExpenseDisplayStatus(expense, today),
      })),
    [expenses, today],
  )

  const sortedExpenses = useMemo(
    () => [...expensesWithStatus].sort(sortExpensesByPriority),
    [expensesWithStatus],
  )

  const summary = useMemo(() => {
    const unpaidExpenses = expensesWithStatus.filter(
      (expense) => expense.displayStatus !== 'paid',
    )
    const totalOpen = unpaidExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const overdue = expensesWithStatus.filter(
      (expense) => expense.displayStatus === 'overdue',
    ).length
    const alerts = unpaidExpenses.filter((expense) => expense.alertEnabled).length
    const nextDue = [...unpaidExpenses].sort((current, next) =>
      current.dueDate.localeCompare(next.dueDate),
    )[0]

    return [
      {
        label: 'Total em aberto',
        value: formatCurrency(totalOpen),
        detail: `${unpaidExpenses.length} despesas pendentes`,
      },
      {
        label: 'Atrasadas',
        value: String(overdue),
        detail: 'Destaque em vermelho',
      },
      {
        label: 'Alertas ativos',
        value: String(alerts),
        detail: 'Lembretes configurados',
      },
      {
        label: 'Próximo vencimento',
        value: nextDue ? formatShortDate(nextDue.dueDate) : '-',
        detail: nextDue?.description ?? 'Sem despesas abertas',
      },
    ]
  }, [expensesWithStatus])

  function handleChange(event) {
    const { checked, name, type, value } = event.target

    setStatusMessage('')
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleTypeChange(type) {
    setStatusMessage('')
    setFormData((current) => ({
      ...current,
      type,
      amount: type === 'installment' ? current.amount : current.amount || current.totalAmount,
      totalAmount: type === 'installment' ? current.totalAmount || current.amount : '',
      frequency: type === 'single' ? 'monthly' : current.frequency || 'monthly',
      installmentsTotal: type === 'installment' ? current.installmentsTotal : '6',
      installmentNumber: type === 'installment' ? current.installmentNumber : '1',
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const newExpense = createExpenseFromForm(formData)

    if (!newExpense) {
      setStatusMessage('Preencha um valor maior que zero e confira os dados da despesa.')
      return
    }

    const nextExpense = newExpense.status === 'paid' ? createNextExpense(newExpense) : null

    if (newExpense.status === 'paid') {
      recordExpensePayment(newExpense)
    }

    setExpensesState((currentState) => ({
      expenses: nextExpense
        ? [nextExpense, newExpense, ...currentState.expenses]
        : [newExpense, ...currentState.expenses],
    }))
    setStatusMessage(
      newExpense.status === 'paid'
        ? 'Despesa cadastrada como paga e descontada do saldo em mãos.'
        : 'Despesa cadastrada e salva automaticamente.',
    )
    addToast({
      description:
        newExpense.status === 'paid'
          ? 'A saída foi registrada em transações.'
          : 'Despesa salva com fallback local.',
      title: 'Despesa cadastrada',
      tone: 'success',
    })
    setFormData(initialFormData)
  }

  function handleMarkPaid(expenseId) {
    const selectedExpense = expenses.find((expense) => expense.id === expenseId)

    if (!selectedExpense || getExpenseDisplayStatus(selectedExpense, today) === 'paid') {
      return
    }

    const paymentDate = getTodayDate()

    setExpensesState((currentState) => {
      const targetExpense = currentState.expenses.find((expense) => expense.id === expenseId)

      if (!targetExpense || getExpenseDisplayStatus(targetExpense, today) === 'paid') {
        return currentState
      }

      recordExpensePayment(targetExpense, paymentDate)

      const paidExpenses = currentState.expenses.map((expense) =>
        expense.id === expenseId
          ? {
              ...expense,
              status: 'paid',
              paidAt: paymentDate,
            }
          : expense,
      )
      const nextExpense = createNextExpense(targetExpense)

      return {
        expenses: nextExpense ? [nextExpense, ...paidExpenses] : paidExpenses,
      }
    })

    setStatusMessage(createPaidMessage(selectedExpense))
    addToast({
      description: 'A saída foi registrada em transações.',
      title: 'Despesa paga',
      tone: 'success',
    })
  }

  function handleResetExpenses() {
    const confirmed = window.confirm(
      'Resetar despesas? Isso apaga as despesas salvas neste navegador e restaura os dados de demonstração.',
    )

    if (!confirmed) {
      return
    }

    setExpensesState(resetExpensesDemoData())
    setFormData(initialFormData)
    setStatusMessage('Despesas de demonstração restauradas.')
    addToast({
      description: 'Os dados iniciais foram restaurados.',
      title: 'Despesas resetadas',
      tone: 'success',
    })
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
          alertTimingOptions={alertTimingOptions}
          expenses={sortedExpenses}
          frequencyLabels={frequencyLabels}
          onMarkPaid={handleMarkPaid}
          statusLabels={statusLabels}
          typeLabels={typeLabels}
        />
      </section>
    </>
  )
}

function createLabelMap(items) {
  return items.reduce((labels, item) => ({ ...labels, [item.id ?? item.value]: item.label }), {})
}

function createExpenseFromForm(formData) {
  const isInstallment = formData.type === 'installment'
  const parsedAmount = parseBrazilianAmount(isInstallment ? formData.totalAmount : formData.amount)

  if (parsedAmount <= 0 || !formData.description.trim() || !formData.dueDate) {
    return null
  }

  const installmentsTotal = Math.max(1, Number(formData.installmentsTotal) || 1)
  const installmentNumber = Math.min(
    Math.max(1, Number(formData.installmentNumber) || 1),
    installmentsTotal,
  )
  const installmentAmount = parsedAmount / installmentsTotal
  const baseExpense = {
    id: createExpenseId(),
    type: formData.type,
    description: formData.description.trim(),
    amount: isInstallment ? installmentAmount : parsedAmount,
    dueDate: formData.dueDate,
    status: formData.status,
    category: formData.category.trim(),
    note: formData.note.trim(),
    frequency: formData.frequency,
    alertEnabled: formData.alertEnabled,
    alertTiming: formData.alertTiming,
    alertTime: formData.alertTime,
    paidAt: formData.status === 'paid' ? getTodayDate() : '',
  }

  if (!isInstallment) {
    return baseExpense
  }

  return {
    ...baseExpense,
    totalAmount: parsedAmount,
    installmentsTotal,
    installmentNumber,
  }
}

function recordExpensePayment(expense, paymentDate = getTodayDate()) {
  if (
    hasTransactionForReference({
      origin: 'despesa',
      referenceId: expense.id,
      type: 'saida',
    })
  ) {
    return
  }

  recordTransaction({
    type: 'saida',
    description: expense.description,
    amount: expense.amount,
    date: paymentDate,
    origin: 'despesa',
    referenceId: expense.id,
  })
}

function createNextExpense(expense) {
  if (expense.type === 'recurring') {
    return {
      ...expense,
      id: createExpenseId(),
      dueDate: addFutureFrequency(expense.dueDate, expense.frequency),
      status: 'open',
      paidAt: '',
      generatedFrom: expense.id,
    }
  }

  if (expense.type !== 'installment') {
    return null
  }

  const installmentNumber = Number(expense.installmentNumber) || 1
  const installmentsTotal = Number(expense.installmentsTotal) || 1

  if (installmentNumber >= installmentsTotal) {
    return null
  }

  return {
    ...expense,
    id: createExpenseId(),
    dueDate: addFrequency(expense.dueDate, expense.frequency),
    status: 'open',
    installmentNumber: installmentNumber + 1,
    paidAt: '',
    generatedFrom: expense.id,
  }
}

function createPaidMessage(expense) {
  if (expense.type === 'recurring') {
    return 'Despesa recorrente paga. A próxima foi criada automaticamente.'
  }

  if (expense.type === 'installment') {
    const installmentNumber = Number(expense.installmentNumber) || 1
    const installmentsTotal = Number(expense.installmentsTotal) || 1

    return installmentNumber < installmentsTotal
      ? 'Parcela paga. A próxima parcela foi liberada.'
      : 'Última parcela marcada como paga.'
  }

  return 'Despesa marcada como paga.'
}

function sortExpensesByPriority(current, next) {
  const currentGroup = current.displayStatus === 'paid' ? 1 : 0
  const nextGroup = next.displayStatus === 'paid' ? 1 : 0

  if (currentGroup !== nextGroup) {
    return currentGroup - nextGroup
  }

  const dueDateComparison = current.dueDate.localeCompare(next.dueDate)

  if (dueDateComparison !== 0) {
    return dueDateComparison
  }

  return current.description.localeCompare(next.description)
}

function getExpenseDisplayStatus(expense, today) {
  if (expense.status === 'paid') {
    return 'paid'
  }

  if (expense.status === 'overdue' || expense.dueDate < today) {
    return 'overdue'
  }

  return 'open'
}

function addFrequency(date, frequency) {
  const nextDate = new Date(`${date}T12:00:00`)

  if (Number.isNaN(nextDate.getTime())) {
    return initialFormData.dueDate
  }

  if (frequency === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1)
  } else if (frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7)
  } else if (frequency === 'biweekly') {
    nextDate.setDate(nextDate.getDate() + 15)
  } else if (frequency === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1)
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1)
  }

  return formatInputDate(nextDate)
}

function addFutureFrequency(date, frequency) {
  let nextDate = addFrequency(date, frequency)
  let attempts = 0

  while (nextDate <= getTodayDate() && attempts < 60) {
    nextDate = addFrequency(nextDate, frequency)
    attempts += 1
  }

  return nextDate
}

function parseBrazilianAmount(value) {
  const numericValue = Number(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}

function createExpenseId() {
  return `expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getTodayDate() {
  return formatInputDate(new Date())
}

function formatInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  })
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}
