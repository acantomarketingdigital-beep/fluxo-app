import { useEffect, useMemo, useState } from 'react'
import { CardSummary } from './CardSummary'
import { ManagedCardList } from './ManagedCardList'
import { PurchaseForm } from './PurchaseForm'
import { PurchaseHistory } from './PurchaseHistory'
import { Topbar } from './Topbar'
import { initialCards } from '../data/cards'
import {
  createInvoiceReference,
  loadCardsState,
  resetCardsDemoData,
  rollInstallmentsIntoNextInvoice,
  saveCardsState,
} from '../storage/cardsStorage'
import {
  hasTransactionForReference,
  recordTransaction,
} from '../storage/transactionsStorage'
import { useToast } from '../hooks/useToast'

const initialFormData = {
  cardId: initialCards[0].id,
  description: '',
  amount: '',
  purchaseType: 'cash',
  installments: '6',
}

export function CardsScreen({ onNavigate, productAccess }) {
  const [cardsState, setCardsState] = useState(loadCardsState)
  const [formData, setFormData] = useState(initialFormData)
  const [statusMessage, setStatusMessage] = useState('')
  const { addToast } = useToast()
  const { cards, purchases } = cardsState
  const canUseMultipleCards = productAccess?.isPremium ?? true
  const visibleCards = useMemo(
    () => (canUseMultipleCards ? cards : cards.slice(0, 1)),
    [canUseMultipleCards, cards],
  )
  const visibleCardIds = useMemo(() => visibleCards.map((card) => card.id), [visibleCards])
  const visiblePurchases = useMemo(
    () => purchases.filter((purchase) => visibleCardIds.includes(purchase.cardId)),
    [purchases, visibleCardIds],
  )

  const selectedCard = visibleCards.find((card) => card.id === formData.cardId) ?? visibleCards[0]
  const purchaseFormData = useMemo(
    () => ({
      ...formData,
      cardId: selectedCard?.id ?? formData.cardId,
    }),
    [formData, selectedCard],
  )

  useEffect(() => {
    saveCardsState(cardsState)
  }, [cardsState])

  const summary = useMemo(() => {
    const totalLimit = visibleCards.reduce((sum, card) => sum + card.totalLimit, 0)
    const availableLimit = visibleCards.reduce((sum, card) => sum + card.availableLimit, 0)
    const invoice = visibleCards.reduce((sum, card) => sum + card.invoice, 0)
    const nextDue = [...visibleCards].sort((current, next) =>
      current.dueDate.localeCompare(next.dueDate),
    )[0]

    return [
      {
        label: 'Limite total',
        value: formatCurrency(totalLimit),
        detail: canUseMultipleCards ? `${cards.length} cartões ativos` : '1 cartão no modo básico',
      },
      {
        label: 'Limite disponível',
        value: formatCurrency(availableLimit),
        detail: 'Atualizado após compras',
      },
      {
        label: 'Fatura atual',
        value: formatCurrency(invoice),
        detail: 'Total em aberto',
      },
      {
        label: 'Próximo vencimento',
        value: nextDue ? formatShortDate(nextDue.dueDate) : '-',
        detail: nextDue?.name ?? 'Sem cartões',
      },
    ]
  }, [canUseMultipleCards, cards.length, visibleCards])

  function handleChange(event) {
    const { name, value } = event.target

    setStatusMessage('')
    setFormData((current) => ({
      ...current,
      [name]: value,
      installments: name === 'purchaseType' && value === 'cash' ? '6' : current.installments,
    }))
  }

  function handleCardSelect(cardId) {
    if (!canUseMultipleCards && cardId !== visibleCards[0]?.id) {
      addToast({
        description: 'Múltiplos cartões fazem parte do Premium.',
        title: 'Recurso bloqueado',
        tone: 'warning',
      })
      onNavigate?.('Premium')
      return
    }

    setStatusMessage('')
    setFormData((current) => ({ ...current, cardId }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const amount = parseBrazilianAmount(formData.amount)
    const installments = Number(formData.installments)
    const invoiceCharge = formData.purchaseType === 'installment' ? amount / installments : amount

    if (amount <= 0) {
      setStatusMessage('Informe um valor de compra maior que zero.')
      return
    }

    if (!selectedCard) {
      setStatusMessage('Nenhum cartão disponível para registrar a compra.')
      return
    }

    if (amount > selectedCard.availableLimit) {
      setStatusMessage('Compra acima do limite disponível deste cartão.')
      return
    }

    setCardsState((currentState) => {
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
        cards: currentState.cards.map((card) =>
          card.id === selectedCard.id
            ? {
                ...card,
                availableLimit: card.availableLimit - amount,
                invoice: card.invoice + invoiceCharge,
              }
            : card,
        ),
        purchases: [nextPurchase, ...currentState.purchases],
      }
    })

    setStatusMessage(
      formData.purchaseType === 'installment'
        ? `Compra parcelada registrada: ${formatCurrency(amount)} consumidos do limite e ${formatCurrency(invoiceCharge)} adicionados à fatura.`
        : `Compra à vista registrada: ${formatCurrency(amount)} adicionados à fatura.`,
    )
    addToast({
      description: `${formatCurrency(amount)} registrado no cartão.`,
      title: 'Compra salva',
      tone: 'success',
    })

    setFormData({
      ...initialFormData,
      cardId: selectedCard.id,
    })
  }

  function handlePayInvoice(cardId) {
    const card = cards.find((currentCard) => currentCard.id === cardId)

    if (!card || card.invoice <= 0) {
      return
    }

    const referenceId = createInvoiceReference(card)
    const confirmed = window.confirm(
      `Pagar a fatura de ${card.name} no valor de ${formatCurrency(card.invoice)}?`,
    )

    if (!confirmed) {
      return
    }

    if (
      hasTransactionForReference({
        origin: 'cartao',
        referenceId,
        type: 'saida',
      })
    ) {
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

    setCardsState((currentState) => {
      const currentCard = currentState.cards.find((item) => item.id === cardId)

      if (!currentCard || currentCard.invoice <= 0) {
        return currentState
      }

      const paidAmount = currentCard.invoice
      const { nextInvoice, purchases: nextPurchases } = rollInstallmentsIntoNextInvoice(
        currentState.purchases,
        currentCard,
      )

      return {
        cards: currentState.cards.map((item) =>
          item.id === cardId
            ? {
                ...item,
                availableLimit: Math.min(item.totalLimit, item.availableLimit + paidAmount),
                invoice: nextInvoice,
                invoiceCycle: (Number(item.invoiceCycle) || 0) + 1,
              }
            : item,
        ),
        purchases: nextPurchases,
      }
    })

    setStatusMessage(
      `Fatura paga: ${formatCurrency(card.invoice)} descontados do saldo em mãos e registrados em Transações.`,
    )
    addToast({
      description: 'Pagamento registrado em transações.',
      title: 'Fatura paga',
      tone: 'success',
    })
  }

  function handleResetData() {
    const confirmed = window.confirm(
      'Resetar os dados? Isso apaga compras e ajustes salvos neste navegador e restaura os dados de demonstração.',
    )

    if (!confirmed) {
      return
    }

    const demoState = resetCardsDemoData()

    setCardsState(demoState)
    setFormData({
      ...initialFormData,
      cardId: demoState.cards[0].id,
    })
    setStatusMessage('Dados de demonstração restaurados.')
    addToast({
      description: 'Cartões e compras voltaram ao estado inicial.',
      title: 'Cartões resetados',
      tone: 'success',
    })
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
        onPayInvoice={handlePayInvoice}
        onSelect={handleCardSelect}
        selectedCardId={purchaseFormData.cardId}
      />

      {!canUseMultipleCards ? (
        <section className="feature-lock" aria-label="Múltiplos cartões bloqueados">
          <div>
            <span>Premium</span>
            <strong>Múltiplos cartões ficam liberados no plano Premium.</strong>
            <p>O modo básico mantém um cartão ativo, receitas, despesas e transações locais.</p>
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
    </>
  )
}

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseBrazilianAmount(value) {
  const numericValue = Number(String(value).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numericValue) ? numericValue : 0
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
