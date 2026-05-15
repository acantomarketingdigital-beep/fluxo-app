export const PWA_INSTALL_STATE_EVENT = 'fluxo:pwa-install-state'

const PWA_LOG_PREFIX = '[Fluxo PWA]'
let deferredInstallPrompt = null
let diagnosticsRegistered = false

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    logPwaInstallDiagnostics('service-worker-unsupported')
    return
  }

  if (!import.meta.env.PROD) {
    logPwaInstallDiagnostics('service-worker-disabled-in-dev')
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.info(`${PWA_LOG_PREFIX} Service worker registrado.`, {
          scope: registration.scope,
        })
        return registration.update()
      })
      .catch((error) => {
        console.warn(`${PWA_LOG_PREFIX} Service worker não registrou.`, {
          error,
        })
      })
  })
}

export function registerPwaInstallPromptDiagnostics() {
  if (typeof window === 'undefined' || diagnosticsRegistered) {
    return
  }

  diagnosticsRegistered = true

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallPrompt = event
    console.info(`${PWA_LOG_PREFIX} beforeinstallprompt capturado.`, getPwaInstallDiagnostics())
    dispatchInstallState()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    console.info(`${PWA_LOG_PREFIX} appinstalled disparado.`, getPwaInstallDiagnostics())
    dispatchInstallState()
  })

  window.addEventListener('load', () => {
    logPwaInstallDiagnostics('window-load')

    window.setTimeout(() => {
      if (!deferredInstallPrompt && !isPwaStandalone()) {
        logPwaInstallDiagnostics('beforeinstallprompt-not-fired')
      }
    }, 3500)
  })
}

export function getPwaInstallState() {
  return {
    canPrompt: Boolean(deferredInstallPrompt),
    diagnostics: getPwaInstallDiagnostics(),
    isStandalone: isPwaStandalone(),
  }
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) {
    logPwaInstallDiagnostics('prompt-unavailable')
    return {
      outcome: 'unavailable',
    }
  }

  const promptEvent = deferredInstallPrompt
  deferredInstallPrompt = null
  dispatchInstallState()

  try {
    promptEvent.prompt()
    const choice = await promptEvent.userChoice

    console.info(`${PWA_LOG_PREFIX} Resultado do prompt de instalação.`, {
      outcome: choice?.outcome,
      platform: choice?.platform,
    })
    dispatchInstallState()

    return choice
  } catch (error) {
    console.warn(`${PWA_LOG_PREFIX} Prompt de instalação falhou.`, { error })
    dispatchInstallState()
    return {
      outcome: 'unavailable',
    }
  }
}

export function logPwaInstallDiagnostics(reason = 'manual') {
  if (typeof console === 'undefined') {
    return
  }

  console.info(`${PWA_LOG_PREFIX} Diagnóstico de instalação (${reason}).`, getPwaInstallDiagnostics())
}

export function getPwaInstallDiagnostics() {
  if (typeof window === 'undefined') {
    return {
      notes: ['window indisponível'],
    }
  }

  const serviceWorkerSupported = 'serviceWorker' in navigator
  const serviceWorkerControlled = serviceWorkerSupported
    ? Boolean(navigator.serviceWorker.controller)
    : false
  const isSecureOrigin =
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  const userAgent = navigator.userAgent
  const isAndroid = /Android/i.test(userAgent)
  const isChromeLike = /Chrome|CriOS|Chromium|Edg\//i.test(userAgent) && !/OPR\//i.test(userAgent)
  const hasManifest = Boolean(document.querySelector('link[rel="manifest"]'))
  const isStandalone = isPwaStandalone()
  const notes = []

  if (!isSecureOrigin) {
    notes.push('A instalação exige HTTPS ou localhost.')
  }

  if (!hasManifest) {
    notes.push('Nenhum manifest foi encontrado no HTML.')
  }

  if (!serviceWorkerSupported) {
    notes.push('Este navegador não suporta service worker.')
  }

  if (serviceWorkerSupported && !serviceWorkerControlled && import.meta.env.PROD) {
    notes.push('O service worker ainda não controla esta aba; recarregue após o registro.')
  }

  if (!isAndroid || !isChromeLike) {
    notes.push('O prompt automático aparece principalmente no Chrome/Edge Android.')
  }

  if (!deferredInstallPrompt && !isStandalone) {
    notes.push('beforeinstallprompt ainda não foi disparado pelo navegador.')
  }

  if (isStandalone) {
    notes.push('O app já está em modo standalone.')
  }

  return {
    beforeInstallPromptCaptured: Boolean(deferredInstallPrompt),
    hasManifest,
    isAndroid,
    isChromeLike,
    isSecureOrigin,
    isStandalone,
    notes,
    serviceWorkerControlled,
    serviceWorkerSupported,
  }
}

export function isPwaStandalone() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function dispatchInstallState() {
  window.dispatchEvent(
    new CustomEvent(PWA_INSTALL_STATE_EVENT, {
      detail: getPwaInstallState(),
    }),
  )
}
