import { useEffect, useMemo, useState } from 'react'
import { CardSummary } from './CardSummary'
import { ManagedCardList } from './ManagedCardList'
import { PurchaseForm } from './PurchaseForm'
import { PurchaseHistory } from './PurchaseHistory'
import { Topbar } from './Topbar'
import {
  createInvoiceReference,
  loadCardsState,
  resetCardsData,
  rollInstallmentsIntoNextInvoice,
  saveCardsState,
} from '../storage/cardsStorage'
import {
  hasTransactionForReference,
  recordTransaction,
} from '../storage/transactionsStorage'
import { useToast } from '../hooks/useToast'

const BRANDS = ['Nubank', 'Mastercard', 'Visa', 'Itaú', 'Inter', 'Caixa', 'Outro']
const COLORS = [
  { value: 'violet', label: 'Roxo' },
  { value: 'plum', label: 'Ameixa' },
  { value: 'graphite', label: 'Grafite' },
  { value: 'emerald', label: 'Esmeralda' },
  { value: 'blue', label: 'Azul' },
  { value: 'amber', label: 'Âmbar' },
]

const emptyCardForm = {
  name: '',
  brand: 'Nubank',
  totalLimit: '',
  closingDay: '1',
  dueDay: '10',
  color: 'violet',
  active: true,
}

const initialFormData = {
  cardId: '',
  description: '',
  amount: '',
  purchaseType: 'cash',
  installments: '6',
}

export function CardsScreen({ onNavigate, productAccess }) {
  const [cardsState, setCardsState] = useState(loadCardsState)
  const [formData, setFormData] = useState(initialFormData)
  const [statusMessage, setStatusMessage] = useState('')
  const [showCardForm, setShowCardForm] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [cardFormData, setCardFormData] = useState(emptyCardForm)
  const [deleteCardConfirm, setDeleteCardConfirm] = useState(null)
  const { addToast } = useToast()
  const { cards, purchases } = cardsState
  const canUseMultipleCards = productAccess?.isPremium ?? true

  const visibleCards = useMemo(
    () => (canUseMultipleCards ? cards : cards.slice(0, 1)),
    [canUseMultipleCards, cards],
  )

  const visibleCardIds = useMemo(() => visibleCards.map((c) => c.id), [visibleCards])

  const visiblePurchases = useMemo(
    () => purchases.filter((p) => visibleCardIds.includes(p.cardId)),
    [purchases, visibleCardIds],
  )

  const selectedCard = visibleCards.find((c) => c.id === formData.cardId) ?? visibleCards[0]

  const purchaseFormData = useMemo(
    () => ({ ...formData, cardId: selectedCard?.id ?? formData.cardId }),
    [formData, selectedCard],
  )

  useEffect(() => {
    function handleDataPulled() {
      setCardsState(loadCardsState())
    }
    window.addEventListener('fluxo:data-pulled', handleDataPulled)
    return () => window.removeEventListener('fluxo:data-pulled', handleDataPulled)
  }, [])

  useEffect(() => {
    saveCardsState(cardsState)
  }, [cardsState])

  const summary = useMemo(() => {
    const totalLimit = visibleCards.reduce((s, c) => s + c.totalLimit, 0)
    const availableLimit = visibleCards.reduce((s, c) => s + c.availableLimit, 0)
    const invoice = visibleCards.reduce((s, c) => s + c.invoice, 0)
    const nextDue = [...visibleCards].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0]

    return [
      { label: 'Limite total', value: formatCurrency(totalLimit), detail: `${cards.length} cartões` },
      { label: 'Limite disponível', value: formatCurrency(availableLimit), detail: 'Atualizado após compras' },
      { label: 'Fatura atual', value: formatCurrency(invoice), detail: 'Total em aberto' },
      {
        label: 'Próximo vencimento',
        value: nextDue?.dueDate ? formatShortDate(nextDue.dueDate) : nextDue ? `Dia ${nextDue.dueDay}` : '-',
        detail: nextDue?.name ?? 'Sem cartões',
      },
    ]
  }, [cards.length, visibleCards])

  /* ---- Card form ---- */

  function handleOpenAddCard() {
    setEditingCard(null)
    setCardFormData(emptyCardForm)
    setShowCardForm(true)
  }

  function handleEditCard(card) {
    setEditingCard(card)
    setCardFormData({
      name: card.name ?? '',
      brand: card.brand ?? 'Outro',
      totalLimit: String(card.totalLimit > 0 ? card.totalLimit : ''),
      closingDay: String(card.closingDay ?? 1),
      dueDay: String(card.dueDay ?? 10),
      color: card.color ?? card.variant ?? 'violet',
      active: card.active !== false,
    })
    setShowCardForm(true)
  }

  function handleCardFormChange(event) {
    const { checked, name, type, value } = event.target
    setCardFormData((cur) => ({ ...cur, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleCardFormColor(color) {
    setCardFormData((cur) => ({ ...cur, color }))
  }

  function handleCardFormSubmit(event) {
    event.preventDefault()

    const name = cardFormData.name.trim()
    if (!name) return

    const totalLimit = parseBrazilianAmount(cardFormData.totalLimit)
    const dueDay = Math.max(1, Math.min(31, Number(cardFormData.dueDay) || 10))
    const closingDay = Math.max(1, Math.min(31, Number(cardFormData.closingDay) || 1))

    const dueDate = buildDueDateFromDay(dueDay)

    if (editingCard) {
      setCardsState((cur) => ({
        ...cur,
        cards: cur.cards.map((c) => {
          if (c.id !== editingCard.id) return c
          const limitDiff = totalLimit - c.totalLimit
          return {
            ...c,
            name,
            brand: cardFormData.brand,
            totalLimit,
            availableLimit: Math.max(0, c.availableLimit + limitDiff),
            dueDate,
            dueDay,
            closingDay,
            color: cardFormData.color,
            variant: cardFormData.color,
            active: cardFormData.active,
          }
        }),
      }))
      addToast({ title: 'Cartão atualizado', description: name, tone: 'success' })
    } else {
      const newCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        brand: cardFormData.brand,
        totalLimit,
        availableLimit: totalLimit,
        invoice: 0,
        dueDate,
        dueDay,
        closingDay,
        color: cardFormData.color,
        variant: cardFormData.color,
        active: cardFormData.active,
        invoiceCycle: 0,
      }

      setCardsState((cur) => ({ ...cur, cards: [...cur.cards, newCard] }))
      addToast({ title: 'Cartão criado', description: name, tone: 'success' })
      setFormData((cur) => ({ ...cur, cardId: newCard.id }))
    }

    setShowCardForm(false)
    setEditingCard(null)
    setCardFormData(emptyCardForm)
  }

  function handleDeleteCard(card) {
    setDeleteCardConfirm(card)
  }

  function handleConfirmDeleteCard() {
    if (!deleteCardConfirm) return
    const cardId = deleteCardConfirm.id
    setCardsState((cur) => ({
      cards: cur.cards.filter((c) => c.id !== cardId),
      purchases: cur.purchases.filter((p) => p.cardId !== cardId),
    }))
    addToast({ title: 'Cartão excluído', description: deleteCardConfirm.name, tone: 'success' })
    setDeleteCardConfirm(null)
    if (formData.cardId === cardId) {
      setFormData((cur) => ({ ...cur, cardId: '' }))
    }
  }

  /* ---- Purchase form ---- */

  function handleChange(event) {
    const { name, value } = event.target
    setStatusMessage('')
    setFormData((cur) => ({
      ...cur,
      [name]: value,
      installments: name === 'purchaseType' && value === 'cash' ? '6' : cur.installments,
    }))
  }

  function handleCardSelect(cardId) {
    if (!canUseMultipleCards && cardId !== visibleCards[0]?.id) {
      addToast({ description: 'Múltiplos cartões fazem parte do Premium.', title: 'Recurso bloqueado', tone: 'warning' })
      onNavigate?.('Premium')
      return
    }
    setStatusMessage('')
    setFormData((cur) => ({ ...cur, cardId }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const amount = parseBrazilianAmount(formData.amount)
    const installments = Number(formData.installments)
    const invoiceCharge = formData.purchaseType === 'installment' ? amount / installments : amount

    if (amount <= 0) {
      setStatusMessage('Informe um valor maior que zero.')
      return
    }

    if (!selectedCard) {
      setStatusMessage('Nenhum cartão disponível. Cadastre um cartão primeiro.')
      return
    }

    if (amount > selectedCard.availableLimit) {
      setStatusMessage('Compra acima do limite disponível deste cartão.')
      return
    }

    setCardsState((cur) => {
      const nextPurchase = {
        id: Date.now(),
        cardId: selectedCard.id,
        cardName: selectedCard.name,
        description: formData.description,
        amount,
        invoiceCharge,
        type: formData.purchaseType === 'installment' ? 'Compra parcelada' : 'Compra à vista',
        installments: formData.purchaseType === 'installment' ? installments : 1,
        billedInstallments: 1,
      }

      return {
        cards: cur.cards.map((c) =>
          c.id === selectedCard.id
            ? { ...c, availableLimit: c.availableLimit - amount, invoice: c.invoice + invoiceCharge }
            : c,
        ),
        purchases: [nextPurchase, ...cur.purchases],
      }
    })

    setStatusMessage(`Compra de ${formatCurrency(amount)} registrada.`)
    addToast({ description: `${formatCurrency(amount)} no cartão.`, title: 'Compra salva', tone: 'success' })
    setFormData({ ...initialFormData, cardId: selectedCard.id })
  }

  function handlePayInvoice(cardId) {
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.invoice <= 0) return

    const referenceId = createInvoiceReference(card)
    if (!window.confirm(`Pagar a fatura de ${card.name} no valor de ${formatCurrency(card.invoice)}?`)) return

    if (hasTransactionForReference({ origin: 'cartao', referenceId, type: 'saida' })) {
      setStatusMessage('Esta fatura já foi paga.')
      return
    }

    recordTransaction({
      type: 'saida',
      description: `Pagamento da fatura - ${card.name}`,
      amount: card.invoice,
      date: getTodayDate(),
      origin: 'cartao',
      referenceId,
    })

    setCardsState((cur) => {
      const current = cur.cards.find((c) => c.id === cardId)
      if (!current || current.invoice <= 0) return cur

      const paidAmount = current.invoice
      const { nextInvoice, purchases: nextPurchases } = rollInstallmentsIntoNextInvoice(cur.purchases, current)

      return {
        cards: cur.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                availableLimit: Math.min(c.totalLimit, c.availableLimit + paidAmount),
                invoice: nextInvoice,
                invoiceCycle: (Number(c.invoiceCycle) || 0) + 1,
              }
            : c,
        ),
        purchases: nextPurchases,
      }
    })

    addToast({ description: 'Pagamento registrado.', title: 'Fatura paga', tone: 'success' })
  }

  function handleResetData() {
    if (!window.confirm('Apagar todos os cartões e compras?')) return
    setCardsState(resetCardsData())
    setFormData(initialFormData)
  }

  function focusPurchaseForm() {
    document.getElementById('purchase-description')?.focus()
  }

  return (
    <>
      <Topbar
        actionLabel="Nova compra"
        eyebrow="Cartões"
        onAction={focusPurchaseForm}
        onSecondaryAction={handleResetData}
        searchPlaceholder="Buscar cartões"
        secondaryActionLabel="Resetar dados"
        subtitle="Limites, faturas e compras parceladas sob controle"
        title="Cartões Fluxo"
      />

      <CardSummary summary={summary} />

      <ManagedCardList
        cards={visibleCards}
        formatCurrency={formatCurrency}
        formatDate={formatShortDate}
        onAddCard={handleOpenAddCard}
        onDeleteCard={handleDeleteCard}
        onEditCard={handleEditCard}
        onPayInvoice={handlePayInvoice}
        onSelect={handleCardSelect}
        selectedCardId={purchaseFormData.cardId}
      />

      {!canUseMultipleCards ? (
        <section className="feature-lock" aria-label="Múltiplos cartões bloqueados">
          <div>
            <span>Premium</span>
            <strong>Múltiplos cartões ficam liberados no plano Premium.</strong>
            <p>O modo básico mantém um cartão ativo.</p>
          </div>
          <button className="ghost-action" onClick={() => onNavigate?.('Premium')} type="button">
            Ver Premium
          </button>
        </section>
      ) : null}

      <section className="cards-workspace" aria-label="Operações dos cartões">
        <PurchaseForm
          cards={visibleCards}
          formData={purchaseFormData}
          formatCurrency={formatCurrency}
          onChange={handleChange}
          onSubmit={handleSubmit}
          selectedCard={selectedCard}
          statusMessage={statusMessage}
        />
        <PurchaseHistory formatCurrency={formatCurrency} purchases={visiblePurchases} />
      </section>

      {showCardForm ? (
        <div className="modal-overlay" onClick={() => { setShowCardForm(false); setEditingCard(null) }}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCard ? 'Editar cartão' : 'Novo cartão'}</h2>
              <button className="modal-close" onClick={() => { setShowCardForm(false); setEditingCard(null) }} type="button">×</button>
            </div>
            <div className="modal-body">
              <form className="card-form" onSubmit={handleCardFormSubmit}>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Nome do cartão</span>
                    <input
                      autoFocus
                      name="name"
                      onChange={handleCardFormChange}
                      placeholder="Ex: Nubank Gold"
                      required
                      type="text"
                      value={cardFormData.name}
                    />
                  </label>

                  <label className="form-field">
                    <span>Bandeira</span>
                    <select name="brand" onChange={handleCardFormChange} value={cardFormData.brand}>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="form-field">
                  <span>Limite (opcional)</span>
                  <input
                    inputMode="decimal"
                    name="totalLimit"
                    onChange={handleCardFormChange}
                    placeholder="Ex: 5000,00"
                    type="text"
                    value={cardFormData.totalLimit}
                  />
                </label>

                <div className="form-grid">
                  <label className="form-field">
                    <span>Dia de fechamento</span>
                    <input
                      max="31"
                      min="1"
                      name="closingDay"
                      onChange={handleCardFormChange}
                      type="number"
                      value={cardFormData.closingDay}
                    />
                  </label>

                  <label className="form-field">
                    <span>Dia de vencimento</span>
                    <input
                      max="31"
                      min="1"
                      name="dueDay"
                      onChange={handleCardFormChange}
                      type="number"
                      value={cardFormData.dueDay}
                    />
                  </label>
                </div>

                <div className="form-field">
                  <span>Cor do cartão</span>
                  <div className="color-picker-grid">
                    {COLORS.map((c) => (
                      <button
                        aria-label={c.label}
                        className={cardFormData.color === c.value
                          ? `color-swatch color-swatch-${c.value} is-selected`
                          : `color-swatch color-swatch-${c.value}`}
                        key={c.value}
                        onClick={() => handleCardFormColor(c.value)}
                        title={c.label}
                        type="button"
                      />
                    ))}
                  </div>
                </div>

                <label className="toggle-field">
                  <input
                    checked={cardFormData.active}
                    name="active"
                    onChange={handleCardFormChange}
                    type="checkbox"
                  />
                  <span className="toggle-control" aria-hidden="true" />
                  <span>Cartão ativo</span>
                </label>

                <div className="modal-actions">
                  <button className="ghost-action" onClick={() => { setShowCardForm(false); setEditingCard(null) }} type="button">
                    Cancelar
                  </button>
                  <button className="primary-action" type="submit">
                    {editingCard ? 'Salvar alterações' : 'Criar cartão'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {deleteCardConfirm ? (
        <div className="modal-overlay" onClick={() => setDeleteCardConfirm(null)}>
          <div className="modal-dialog modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Excluir cartão</h2>
              <button className="modal-close" onClick={() => setDeleteCardConfirm(null)} type="button">×</button>
            </div>
            <div className="modal-body">
              <strong>{deleteCardConfirm.name}</strong>
              <p>Todas as compras vinculadas a este cartão também serão removidas. Esta ação não pode ser desfeita.</p>
              <div className="confirm-actions">
                <button className="confirm-action-danger" onClick={handleConfirmDeleteCard} type="button">
                  Confirmar exclusão
                </button>
                <button className="confirm-action-cancel" onClick={() => setDeleteCardConfirm(null)} type="button">
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

function buildDueDateFromDay(day) {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(Math.min(day, 28)).padStart(2, '0')
  return `${year}-${month}-${d}`
}

function getTodayDate() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseBrazilianAmount(value) {
  const n = Number(String(value ?? '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
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
