import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { AuthLayout } from './AuthLayout'

const authModes = {
  login: {
    action: 'Entrar',
    eyebrow: 'Acesso seguro',
    subtitle: 'Entre para sincronizar receitas, despesas, cartões e transações.',
    title: 'Bem-vindo de volta',
  },
  recover: {
    action: 'Enviar recuperação',
    eyebrow: 'Recuperação',
    subtitle: 'Receba um link seguro no e-mail cadastrado.',
    title: 'Recuperar senha',
  },
  signup: {
    action: 'Criar conta',
    eyebrow: 'Novo espaço',
    subtitle: 'Crie sua conta e mantenha o Fluxo salvo na nuvem.',
    title: 'Comece seu Fluxo',
  },
}

export function LoginScreen() {
  const { isConfigured, sendPasswordReset, signIn, signUp } = useAuth()
  const { addToast } = useToast()
  const [mode, setMode] = useState('login')
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const copy = authModes[mode]
  const isRecovery = mode === 'recover'
  const isSignup = mode === 'signup'

  const modeOptions = useMemo(
    () => [
      ['login', 'Login'],
      ['signup', 'Cadastro'],
      ['recover', 'Senha'],
    ],
    [],
  )

  function handleChange(event) {
    const { name, value } = event.target
    setMessage('')
    setFormData((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    try {
      if (isRecovery) {
        await sendPasswordReset(formData.email)
        setMessage('E-mail de recuperação enviado.')
        addToast({
          description: 'Confira sua caixa de entrada para redefinir a senha.',
          title: 'Recuperação enviada',
          tone: 'success',
        })
        return
      }

      if (isSignup) {
        const data = await signUp(formData)
        const needsConfirmation = data.user && !data.session

        setMessage(
          needsConfirmation
            ? 'Cadastro criado. Confirme o e-mail para entrar.'
            : 'Conta criada. Preparando seu Fluxo...',
        )
        addToast({
          description: needsConfirmation
            ? 'Depois da confirmação, volte para fazer login.'
            : 'Seu espaço seguro foi criado.',
          title: 'Cadastro realizado',
          tone: 'success',
        })
        return
      }

      await signIn(formData)
      addToast({
        description: 'Sincronizando seus dados financeiros.',
        title: 'Login realizado',
        tone: 'success',
      })
    } catch (error) {
      const errorMessage = getAuthErrorMessage(error)
      setMessage(errorMessage)
      addToast({
        description: errorMessage,
        title: 'Acesso não concluído',
        tone: 'warning',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <span>{copy.subtitle}</span>
        </div>

        <div className="auth-tabs" aria-label="Escolher fluxo de acesso">
          {modeOptions.map(([value, label]) => (
            <button
              className={mode === value ? 'is-selected' : ''}
              key={value}
              onClick={() => {
                setMode(value)
                setMessage('')
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {!isConfigured ? (
          <div className="auth-warning" role="status">
            Configure o Supabase no arquivo .env para habilitar autenticação.
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup ? (
            <label className="form-field">
              <span>Nome</span>
              <input
                autoComplete="name"
                name="fullName"
                onChange={handleChange}
                placeholder="Seu nome"
                required
                type="text"
                value={formData.fullName}
              />
            </label>
          ) : null}

          <label className="form-field">
            <span>E-mail</span>
            <input
              autoComplete="email"
              name="email"
              onChange={handleChange}
              placeholder="voce@empresa.com"
              required
              type="email"
              value={formData.email}
            />
          </label>

          {!isRecovery ? (
            <label className="form-field">
              <span>Senha</span>
              <input
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                minLength={6}
                name="password"
                onChange={handleChange}
                placeholder="********"
                required
                type="password"
                value={formData.password}
              />
            </label>
          ) : null}

          {message ? <p className="auth-message">{message}</p> : null}

          <button className="primary-action auth-submit" disabled={!isConfigured || isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde...' : copy.action}
          </button>
        </form>
      </div>
    </AuthLayout>
  )
}

function getAuthErrorMessage(error) {
  const message = String(error?.message ?? '').toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.'
  }

  if (message.includes('email rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos.'
  }

  if (message.includes('password')) {
    return 'Use uma senha com pelo menos 6 caracteres.'
  }

  return error?.message ?? 'Não foi possível concluir o acesso.'
}
