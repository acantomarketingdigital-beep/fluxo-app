import { useEffect, useMemo, useState } from 'react'
import { IncomeForm } from './IncomeForm'
import { IncomeList } from './IncomeList'
import { IncomeSummary } from './IncomeSummary'
import { Topbar } from './Topbar'
import {
  incomeFrequencyOptions,
  incomeStatusOptions,
  incomeTypes,
} from '../data/incomes'
import {
  loadIncomesState,
  resetIncomesData,
  saveIncomesState,
} from '../storage/incomesStorage'
import {
  hasTransactionForReference,
  loadTransactionsState,
  recordTransaction,
} from '../storage/transactionsStorage'
import { useToast } from '../hooks/useToast'

const initialFormData = {
  type: 'cash',
  description: '',
  source: '',
  amount: '',
  date: '2026-05-13',
  status: 'received',
  recurring: false,
  frequency: 'monthly',
  note: '',
}

export function IncomeScreen() {
  const [incomesState, setIncomesState] = useState(loadIncomesState)
  const [formData, setFormData] = useState(initialFormData)
  const [statusMessage, setStatusMessage] = useState('')
  const { addToast } = useToast()
  const { incomes } = incomesState

  const typeLabels = useMemo(() => createLabelMap(incomeTypes), [])
  const statusLabels = useMemo(() => createLabelMap(incomeStatusOptions), [])
  const frequencyLabels = useMemo(() => createLabelMap(incomeFrequencyOptions), [])

  useEffect(() => {
    saveIncomesState(incomesState)
  }, [incomesState])

  const sortedIncomes = useMemo(
    () => [...incomes].sort(sortIncomesByPriority),
    [incomes],
  )

  const summary = useMemo(() => {
    const expenseOutflows = loadTransactionsState().transactions
      .filter((transaction) => transaction.type === 'saida')
      .reduce((sum, transaction) => sum + transaction.amount, 0)
    const balance = incomes
      .filter((income) => income.status === 'received')
      .reduce((sum, income) => sum + income.amount, 0) - expenseOutflows
    const pending = incomes.filter((income) => income.status === 'pending')
    const pendingTotal = pending.reduce((sum, income) => sum + income.amount, 0)
    const recurring = incomes.filter((income) => income.recurring).length
    const nextReceivable = [...pending].sort((current, next) =>
      current.date.localeCompare(next.date),
    )[0]

    return [
      {
        label: 'Saldo em mãos',
        value: formatCurrency(balance),
        detail: 'Receitas recebidas menos saídas',
      },
      {
        label: 'A receber',
        value: formatCurrency(pendingTotal),
        detail: `${pending.length} entradas pendentes`,
      },
      {
        label: 'Recorrentes',
        value: String(recurring),
        detail: 'Receitas com ciclo ativo',
      },
      {
        label: 'Próximo recebimento',
        value: nextReceivable ? formatShortDate(nextReceivable.date) : '-',
        detail: nextReceivable?.description ?? 'Sem pendências',
      },
    ]
  }, [incomes])

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
      status: type === 'cash' ? 'received' : 'pending',
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const newIncome = createIncomeFromForm(formData)

    if (!newIncome) {
      setStatusMessage('Preencha um valor maior que zero e confira os dados da receita.')
      return
    }

    const nextIncome =
      newIncome.status === 'received' && newIncome.recurring
        ? createNextIncome(newIncome)
        : null

    if (newIncome.status === 'received') {
      recordIncomeTransaction(newIncome)
    }

    setIncomesState((currentState) => ({
      incomes: nextIncome
        ? [nextIncome, newIncome, ...currentState.incomes]
        : [newIncome, ...currentState.incomes],
    }))
    setStatusMessage(
      nextIncome
        ? 'Receita cadastrada. O próximo recebimento futuro também foi criado.'
        : 'Receita cadastrada e salva automaticamente.',
    )
    addToast({
      description: nextIncome ? 'Receita recorrente preparada.' : 'Entrada salva com fallback local.',
      title: 'Receita cadastrada',
      tone: 'success',
    })
    setFormData(initialFormData)
  }

  function handleMarkReceived(incomeId) {
    const selectedIncome = incomes.find((income) => income.id === incomeId)

    if (!selectedIncome || selectedIncome.status === 'received') {
      return
    }

    setIncomesState((currentState) => {
      const targetIncome = currentState.incomes.find((income) => income.id === incomeId)

      if (!targetIncome || targetIncome.status === 'received') {
        return currentState
      }

      recordIncomeTransaction({
        ...targetIncome,
        status: 'received',
        receivedAt: getTodayDate(),
      })

      const receivedIncomes = currentState.incomes.map((income) =>
        income.id === incomeId
          ? {
              ...income,
              status: 'received',
              receivedAt: getTodayDate(),
            }
          : income,
      )
      const nextIncome = targetIncome.recurring ? createNextIncome(targetIncome) : null

      return {
        incomes: nextIncome ? [nextIncome, ...receivedIncomes] : receivedIncomes,
      }
    })

    setStatusMessage(
      selectedIncome.recurring
        ? 'Receita recebida. O próximo recebimento futuro foi criado.'
        : 'Receita marcada como recebida e somada ao saldo em mãos.',
    )
    addToast({
      description: 'A entrada foi registrada em transações.',
      title: 'Receita recebida',
      tone: 'success',
    })
  }

  function handleResetIncomes() {
    const confirmed = window.confirm(
      'Apagar todas as receitas salvas neste navegador?',
    )

    if (!confirmed) {
      return
    }

    setIncomesState(resetIncomesData())
    setFormData(initialFormData)
    setStatusMessage('Receitas apagadas.')
    addToast({
      description: 'Todas as receitas foram removidas.',
      title: 'Receitas zeradas',
      tone: 'success',
    })
  }

  function focusIncomeForm() {
    document.getElementById('income-description')?.focus()
  }

  return (
    <>
      <Topbar
        actionLabel="Adicionar receita"
        eyebrow="Receitas"
        onAction={focusIncomeForm}
        onSecondaryAction={handleResetIncomes}
        searchPlaceholder="Buscar receitas"
        secondaryActionLabel="Resetar receitas"
        subtitle="Saldo em mãos e recebimentos futuros no mesmo lugar"
        title="Receitas e saldo"
      />

      <IncomeSummary summary={summary} />

      <section className="income-grid" aria-label="Gestão de receitas">
        <IncomeForm
          formData={formData}
          frequencyOptions={incomeFrequencyOptions}
          incomeTypes={incomeTypes}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onTypeChange={handleTypeChange}
          statusMessage={statusMessage}
          statusOptions={incomeStatusOptions}
        />
        <IncomeList
          frequencyLabels={frequencyLabels}
          incomes={sortedIncomes}
          onMarkReceived={handleMarkReceived}
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

function createIncomeFromForm(formData) {
  const amount = parseBrazilianAmount(formData.amount)

  if (amount <= 0 || !formData.description.trim() || !formData.source.trim() || !formData.date) {
    return null
  }

  return {
    id: createIncomeId(),
    type: formData.type,
    description: formData.description.trim(),
    source: formData.source.trim(),
    amount,
    date: formData.date,
    status: formData.type === 'cash' ? 'received' : 'pending',
    recurring: formData.recurring,
    frequency: formData.frequency,
    note: formData.note.trim(),
    receivedAt: formData.type === 'cash' ? formData.date : '',
  }
}

function recordIncomeTransaction(income) {
  if (
    hasTransactionForReference({
      origin: 'receita',
      referenceId: income.id,
      type: 'entrada',
    })
  ) {
    return
  }

  recordTransaction({
    type: 'entrada',
    description: income.description,
    amount: income.amount,
    date: income.receivedAt || income.date,
    origin: 'receita',
    referenceId: income.id,
  })
}

function createNextIncome(income) {
  return {
    ...income,
    id: createIncomeId(),
    type: 'receivable',
    date: addFutureFrequency(income.date, income.frequency),
    status: 'pending',
    receivedAt: '',
    generatedFrom: income.id,
  }
}

function sortIncomesByPriority(current, next) {
  const currentGroup = current.status === 'pending' ? 0 : 1
  const nextGroup = next.status === 'pending' ? 0 : 1

  if (currentGroup !== nextGroup) {
    return currentGroup - nextGroup
  }

  const dateComparison = current.date.localeCompare(next.date)

  if (dateComparison !== 0) {
    return dateComparison
  }

  return current.description.localeCompare(next.description)
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

function addFrequency(date, frequency) {
  const nextDate = new Date(`${date}T12:00:00`)

  if (Number.isNaN(nextDate.getTime())) {
    return initialFormData.date
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

function parseBrazilianAmount(value) {
  const numericValue = Number(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
}

function createIncomeId() {
  return `income-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
