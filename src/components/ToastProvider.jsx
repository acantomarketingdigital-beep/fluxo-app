import { useCallback, useEffect, useMemo, useState } from 'react'
import { ToastContext } from '../context/toastContext'

const TOAST_DURATION = 4400

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const addToast = useCallback(
    ({ title, description = '', tone = 'info' }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      setToasts((current) => [
        ...current,
        {
          description,
          id,
          title,
          tone,
        },
      ])

      window.setTimeout(() => removeToast(id), TOAST_DURATION)
    },
    [removeToast],
  )

  const value = useMemo(() => ({ addToast }), [addToast])

  useEffect(() => {
    function handleToast(event) {
      addToast(event.detail)
    }

    window.addEventListener('fluxo:toast', handleToast)

    return () => window.removeEventListener('fluxo:toast', handleToast)
  }, [addToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <strong>{toast.title}</strong>
            {toast.description ? <span>{toast.description}</span> : null}
            <button
              aria-label="Fechar mensagem"
              onClick={() => removeToast(toast.id)}
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
