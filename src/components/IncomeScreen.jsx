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

const TODAY = getTodayDate()

const initialFormData = {
  type: 'cash',
  description: '',
  source: '',
  amount: '',
  installmentTotalAmount: '',
  installmentsTotal: '3',
  date: TODAY,
  status: 'received',
  recurring: false,
  frequency: 'monthly',
  note: '',
}

export function IncomeScreen() {
  const [incomesState, setIncomesState] = useState(loadIncomesState)
  const [formData, setFormData] = useState(initialFormData)
  const [statusMessage, setStatusMessage] = useState('')
  const [editingIncome, setEditingIncome] = useState(null)
  const [editFormData, setEditFormData] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const { addToast } = useToast()
  const { incomes } = incomesState

  useEffect(() => {
    function handleDataPulled() {
      setIncomesState(loadIncomesState())
    }
    window.addEventListener('fluxo:data-pulled', handleDataPulled)
    return () => window.removeEventListener('fluxo:data-pulled', handleDataPulled)
  }, [])

  useEffect(() => {
    saveIncomesState(incomesState)
  }, [incomesState])

  const sortedIncomes = useMemo(
    () => [...incomes].sort(sortIncomesByPriority),
    [incomes],
  )

  const summary = useMemo(() => {
    const outflows = loadTransactionsState().transactions
      .filter((t) => t.type === 'saida')
      .reduce((s, t) => s + t.amount, 0)
    const balance = incomes
      .filter((i) => i.status === 'received')
      .reduce((s, i) => s + i.amount, 0) - outflows
    const pending = incomes.filter((i) => i.status === 'pending')
    const pendingTotal = pending.reduce((s, i) => s + i.amount, 0)
    const recurring = incomes.filter((i) => i.recurring).length
    const nextReceivable = [...pending].sort((a, b) => a.date.localeCompare(b.date))[0]

    return [
      { label: 'Saldo em mãos', value: formatCurrency(balance), detail: 'Receitas recebidas menos saídas' },
      { label: 'A receber', value: formatCurrency(pendingTotal), detail: `${pending.length} entradas pendentes` },
      { label: 'Recorrentes', value: String(recurring), detail: 'Receitas com ciclo ativo' },
      { label: 'Próximo recebimento', value: nextReceivable ? formatShortDate(nextReceivable.date) : '-', detail: nextReceivable?.description ?? 'Sem pendências' },
    ]
  }, [incomes])

  function handleChange(event) {
    const { checked, name, type, value } = event.target
    setStatusMessage('')
    setFormData((cur) => ({
      ...cur,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleTypeChange(type) {
    setStatusMessage('')
    setFormData((cur) => ({
      ...cur,
      type,
      status: type === 'cash' ? 'received' : 'pending',
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (formData.type === 'installment') {
      handleSubmitInstallmentGroup()
      return
    }

    if (formData.recurring) {
      handleSubmitRecurringGroup()
      return
    }

    const income = createIncomeFromForm(formData)
    if (!income) {
      setStatusMessage('Preencha valor, descrição, origem e data.')
      return
    }

    if (income.status === 'received') {
      recordIncomeTransaction(income)
    }

    setIncomesState((cur) => ({ incomes: [income, ...cur.incomes] }))
    setStatusMessage('Receita cadastrada.')
    addToast({ title: 'Receita cadastrada', description: 'Salva com sucesso.', tone: 'success' })
    setFormData({ ...initialFormData, date: TODAY })
  }

  function handleSubmitRecurringGroup() {
    const amount = parseBrazilianAmount(formData.amount)
    if (amount <= 0 || !formData.description.trim() || !formData.source.trim() || !formData.date) {
      setStatusMessage('Preencha valor, descrição, origem e data.')
      return
    }

    const groupId = `rgrp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startDate = formData.date
    const endDate = addMonths(startDate, 12)
    const records = []
    let currentDate = startDate

    while (currentDate <= endDate) {
      records.push({
        id: createIncomeId(),
        type: formData.type === 'cash' ? 'cash' : 'receivable',
        description: formData.description.trim(),
        source: formData.source.trim(),
        amount,
        date: currentDate,
        status: 'pending',
        recurring: true,
        frequency: formData.frequency,
        note: formData.note.trim(),
        receivedAt: '',
        installmentGroupId: '',
        installmentsTotal: 1,
        installmentNumber: 1,
        recurringGroupId: groupId,
      })
      currentDate = addFrequency(currentDate, formData.frequency)
    }

    setIncomesState((cur) => ({ incomes: [...records, ...cur.incomes] }))
    setStatusMessage(`${records.length} lançamentos recorrentes criados.`)
    addToast({
      title: 'Recorrência criada',
      description: `${records.length} lançamentos de ${formatCurrency(amount)}`,
      tone: 'success',
    })
    setFormData({ ...initialFormData, date: TODAY })
  }

  function handleSubmitInstallmentGroup() {
    const total = parseBrazilianAmount(formData.installmentTotalAmount || formData.amount)
    const installmentsTotal = Math.max(2, Number(formData.installmentsTotal) || 2)

    if (total <= 0 || !formData.description.trim() || !formData.source.trim() || !formData.date) {
      setStatusMessage('Preencha valor total, descrição, origem e data da 1ª parcela.')
      return
    }

    const groupId = `igrp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const perInstallment = total / installmentsTotal

    const newIncomes = Array.from({ length: installmentsTotal }, (_, i) => ({
      id: createIncomeId(),
      type: 'receivable',
      description: formData.description.trim(),
      source: formData.source.trim(),
      amount: perInstallment,
      date: addMonths(formData.date, i),
      status: 'pending',
      recurring: false,
      frequency: 'monthly',
      note: formData.note.trim(),
      receivedAt: '',
      installmentGroupId: groupId,
      installmentsTotal,
      installmentNumber: i + 1,
    }))

    setIncomesState((cur) => ({ incomes: [...newIncomes, ...cur.incomes] }))
    setStatusMessage(`${installmentsTotal} parcelas criadas.`)
    addToast({
      title: 'Parcelas criadas',
      description: `${installmentsTotal}x de ${formatCurrency(perInstallment)}`,
      tone: 'success',
    })
    setFormData({ ...initialFormData, date: TODAY })
  }

  function handleMarkReceived(incomeId) {
    const selected = incomes.find((i) => i.id === incomeId)
    if (!selected || selected.status === 'received') return

    setIncomesState((cur) => {
      const target = cur.incomes.find((i) => i.id === incomeId)
      if (!target || target.status === 'received') return cur

      recordIncomeTransaction({ ...target, status: 'received', receivedAt: getTodayDate() })

      const updated = cur.incomes.map((i) =>
        i.id === incomeId ? { ...i, status: 'received', receivedAt: getTodayDate() } : i,
      )
      const next = target.recurring && !target.installmentGroupId ? createNextIncome(target) : null

      return { incomes: next ? [next, ...updated] : updated }
    })

    addToast({ title: 'Receita recebida', description: 'Entrada registrada.', tone: 'success' })
  }

  function handleEdit(income) {
    setEditingIncome(income)
    setEditFormData({
      description: income.description ?? '',
      source: income.source ?? '',
      amount: String(income.amount ?? ''),
      installmentTotalAmount: income.installmentsTotal > 1
        ? String(income.amount * income.installmentsTotal)
        : String(income.amount ?? ''),
      date: income.date ?? TODAY,
      status: income.status ?? 'pending',
      note: income.note ?? '',
      recurring: income.recurring ?? false,
      frequency: income.frequency ?? 'monthly',
    })
  }

  function handleEditChange(event) {
    const { checked, name, type, value } = event.target
    setEditFormData((cur) => ({
      ...cur,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleSaveEdit(event) {
    event.preventDefault()

    const hasGroup = !!editingIncome.installmentGroupId && editingIncome.installmentsTotal > 1

    if (hasGroup) {
      const groupId = editingIncome.installmentGroupId
      const groupIncomes = incomes.filter((i) => i.installmentGroupId === groupId)
      const total = parseBrazilianAmount(editFormData.installmentTotalAmount || editFormData.amount)
      const perInstallment = total / groupIncomes.length

      setIncomesState((cur) => ({
        incomes: cur.incomes.map((i) => {
          if (i.installmentGroupId !== groupId) return i
          return {
            ...i,
            description: editFormData.description.trim(),
            source: editFormData.source.trim(),
            amount: perInstallment,
            note: editFormData.note.trim(),
          }
        }),
      }))
      addToast({ title: 'Parcelas atualizadas', description: `${groupIncomes.length} parcelas editadas.`, tone: 'success' })
    } else {
      const amount = parseBrazilianAmount(editFormData.amount)
      setIncomesState((cur) => ({
        incomes: cur.incomes.map((i) => {
          if (i.id !== editingIncome.id) return i
          return {
            ...i,
            description: editFormData.description.trim(),
            source: editFormData.source.trim(),
            amount,
            date: editFormData.date,
            status: editFormData.status,
            note: editFormData.note.trim(),
            recurring: editFormData.recurring,
            frequency: editFormData.frequency,
          }
        }),
      }))
      addToast({ title: 'Receita atualizada', description: 'Alterações salvas.', tone: 'success' })
    }

    setEditingIncome(null)
    setEditFormData(null)
  }

  function handleDelete(income) {
    const installGroupSize = income.installmentGroupId
      ? incomes.filter((i) => i.installmentGroupId === income.installmentGroupId).length
      : 0
    const recurGroupSize = income.recurringGroupId
      ? incomes.filter((i) => i.recurringGroupId === income.recurringGroupId).length
      : 0
    setDeleteConfirm({ income, groupSize: installGroupSize || recurGroupSize })
  }

  function handleConfirmDelete(mode) {
    if (!deleteConfirm) return
    const { income } = deleteConfirm

    if (mode === 'group' && income.installmentGroupId) {
      const groupId = income.installmentGroupId
      setIncomesState((cur) => ({
        incomes: cur.incomes.filter((i) => i.installmentGroupId !== groupId),
      }))
      addToast({ title: 'Parcelas excluídas', description: 'Todo o grupo foi removido.', tone: 'success' })
    } else if (mode === 'group' && income.recurringGroupId) {
      const groupId = income.recurringGroupId
      setIncomesState((cur) => ({
        incomes: cur.incomes.filter((i) => i.recurringGroupId !== groupId),
      }))
      addToast({ title: 'Recorrência excluída', description: 'Todos os lançamentos foram removidos.', tone: 'success' })
    } else {
      setIncomesState((cur) => ({
        incomes: cur.incomes.filter((i) => i.id !== income.id),
      }))
      addToast({ title: 'Receita excluída', description: '', tone: 'success' })
    }

    setDeleteConfirm(null)
  }

  function handleResetIncomes() {
    if (!window.confirm('Apagar todas as receitas salvas neste navegador?')) return
    setIncomesState(resetIncomesData())
    setFormData({ ...initialFormData, date: TODAY })
    setStatusMessage('Receitas apagadas.')
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
          incomes={sortedIncomes}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onMarkReceived={handleMarkReceived}
        />
      </section>

      {editingIncome && editFormData ? (
        <div className="modal-overlay" onClick={() => { setEditingIncome(null); setEditFormData(null) }}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                Editar receita
                {editingIncome.installmentGroupId && editingIncome.installmentsTotal > 1
                  ? ` — todas as ${incomes.filter((i) => i.installmentGroupId === editingIncome.installmentGroupId).length} parcelas`
                  : ''}
              </h2>
              <button className="modal-close" onClick={() => { setEditingIncome(null); setEditFormData(null) }} type="button">×</button>
            </div>
            <div className="modal-body">
              <form className="income-form" onSubmit={handleSaveEdit}>
                <label className="form-field form-field-wide">
                  <span>Descrição</span>
                  <input name="description" onChange={handleEditChange} required type="text" value={editFormData.description} />
                </label>

                <div className="form-grid">
                  <label className="form-field">
                    <span>Origem</span>
                    <input name="source" onChange={handleEditChange} required type="text" value={editFormData.source} />
                  </label>

                  <label className="form-field">
                    <span>{editingIncome.installmentGroupId ? 'Valor total' : 'Valor'}</span>
                    <input
                      inputMode="decimal"
                      name={editingIncome.installmentGroupId ? 'installmentTotalAmount' : 'amount'}
                      onChange={handleEditChange}
                      required
                      type="text"
                      value={editingIncome.installmentGroupId ? editFormData.installmentTotalAmount : editFormData.amount}
                    />
                  </label>
                </div>

                {!editingIncome.installmentGroupId ? (
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Data</span>
                      <input name="date" onChange={handleEditChange} type="date" value={editFormData.date} />
                    </label>
                    <label className="form-field">
                      <span>Status</span>
                      <select name="status" onChange={handleEditChange} value={editFormData.status}>
                        {incomeStatusOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
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
                    onClick={() => { setEditingIncome(null); setEditFormData(null); handleDelete(editingIncome) }}
                    type="button"
                  >
                    Excluir
                  </button>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button className="ghost-action" onClick={() => { setEditingIncome(null); setEditFormData(null) }} type="button">Cancelar</button>
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
              <h2>Excluir receita</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)} type="button">×</button>
            </div>
            <div className="modal-body">
              <strong>{deleteConfirm.income.description}</strong>
              <p>
                {deleteConfirm.groupSize > 1
                  ? `Esta é a parcela ${deleteConfirm.income.installmentNumber}/${deleteConfirm.income.installmentsTotal}. Excluir apenas esta ou todo o grupo (${deleteConfirm.groupSize} parcelas)?`
                  : 'Confirma a exclusão desta receita?'}
              </p>
              <div className="confirm-actions">
                {deleteConfirm.groupSize > 1 ? (
                  <>
                    <button className="confirm-action-danger" onClick={() => handleConfirmDelete('group')} type="button">
                      Excluir todas as {deleteConfirm.groupSize} parcelas
                    </button>
                    <button className="confirm-action-secondary" onClick={() => handleConfirmDelete('single')} type="button">
                      Excluir só esta parcela
                    </button>
                  </>
                ) : (
                  <button className="confirm-action-danger" onClick={() => handleConfirmDelete('single')} type="button">
                    Confirmar exclusão
                  </button>
                )}
                <button className="confirm-action-cancel" onClick={() => setDeleteConfirm(null)} type="button">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function createIncomeFromForm(formData) {
  const amount = parseBrazilianAmount(formData.amount)
  if (amount <= 0 || !formData.description.trim() || !formData.source.trim() || !formData.date) return null

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
    installmentGroupId: '',
    installmentsTotal: 1,
    installmentNumber: 1,
  }
}

function recordIncomeTransaction(income) {
  if (hasTransactionForReference({ origin: 'receita', referenceId: income.id, type: 'entrada' })) return
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
    installmentGroupId: '',
    installmentsTotal: 1,
    installmentNumber: 1,
  }
}

function sortIncomesByPriority(a, b) {
  const ag = a.status === 'pending' ? 0 : 1
  const bg = b.status === 'pending' ? 0 : 1
  if (ag !== bg) return ag - bg
  return a.date.localeCompare(b.date) || a.description.localeCompare(b.description)
}

function addMonths(dateStr, months) {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  d.setMonth(d.getMonth() + months)
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

function parseBrazilianAmount(value) {
  const n = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function createIncomeId() {
  return `income-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
