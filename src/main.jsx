import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './components/AuthProvider.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import { registerPwaInstallPromptDiagnostics, registerServiceWorker } from './pwa.js'

registerServiceWorker()
registerPwaInstallPromptDiagnostics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
)
