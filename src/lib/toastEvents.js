export function emitToast({ title, description = '', tone = 'info' }) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('fluxo:toast', {
      detail: {
        description,
        tone,
        title,
      },
    }),
  )
}
