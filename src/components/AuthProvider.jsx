import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from '../context/authContext'
import { createProductAccess, isOnboardingComplete } from '../lib/productAccess'
import { emitToast } from '../lib/toastEvents'
import { fromPublicTable, isSupabaseConfigured, supabase } from '../lib/supabase'
import { setCloudSyncAccess } from '../storage/cloudSyncQueue'
import {
  prepareCloudBackedStorage,
  pushLocalStorageToCloud,
} from '../storage/syncCoordinator'
import { setStorageUser } from '../storage/storageSession'

const PROFILE_STORAGE_KEY = 'fluxo:user-profile'

const initialSyncStatus = {
  message: isSupabaseConfigured
    ? 'Preparando conexão segura...'
    : 'Modo local ativo. Configure o Supabase para sincronizar.',
  state: isSupabaseConfigured ? 'idle' : 'local',
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [accountProfile, setAccountProfile] = useState({})
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isDataLoading, setIsDataLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState(initialSyncStatus)
  const user = session?.user ?? null
  const productAccess = useMemo(
    () => createProductAccess(user, accountProfile),
    [accountProfile, user],
  )
  const onboardingCompleted = useMemo(
    () => isOnboardingComplete(user, accountProfile),
    [accountProfile, user],
  )

  const hydrateStorage = useCallback(async (nextUser) => {
    if (!nextUser) {
      setAccountProfile({})
      setStorageUser(null)
      setIsDataLoading(false)
      return
    }

    setIsDataLoading(true)
    const storedProfile = loadStoredProfile(nextUser.id)
    const billingProfile = await loadBillingProfile(nextUser.id)
    const nextProfile = ensureAccountProfile(nextUser, {
      ...storedProfile,
      ...billingProfile,
    })
    const nextProductAccess = createProductAccess(nextUser, nextProfile)

    setAccountProfile(nextProfile)
    setCloudSyncAccess({
      enabled: nextProductAccess.isPremium,
      message: nextProductAccess.isPremium
        ? 'Sincronização disponível.'
        : 'Modo básico ativo. Sincronização ilimitada é Premium.',
    })

    try {
      const result = await prepareCloudBackedStorage(nextUser.id)
      setSyncStatus(result)
    } catch (error) {
      const result = {
        message: 'Não foi possível sincronizar. O fallback local está ativo.',
        reason: 'sync-error',
        state: 'local',
      }
      setSyncStatus(result)
      emitToast({
        description: error?.message ?? 'Confira a estrutura SQL no Supabase.',
        title: 'Fallback local ativo',
        tone: 'warning',
      })
    } finally {
      setIsDataLoading(false)
    }
  }, [])

  useEffect(() => {
    setCloudSyncAccess({
      enabled: productAccess.isPremium,
      message: productAccess.isPremium
        ? 'Sincronização disponível.'
        : 'Modo básico ativo. Sincronização ilimitada é Premium.',
    })
  }, [productAccess.isPremium])

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      if (!supabase) {
        setIsAuthLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      const verifiedSession = await resolveUsableSession(data.session)

      if (!isMounted) {
        return
      }

      setSession(verifiedSession)
      await hydrateStorage(verifiedSession?.user)

      if (isMounted) {
        setIsAuthLoading(false)
      }
    }

    loadSession()

    if (!supabase) {
      return () => {
        isMounted = false
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      hydrateStorage(nextSession?.user)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [hydrateStorage])

  useEffect(() => {
    function handleSyncStatus(event) {
      setSyncStatus(event.detail)
    }

    window.addEventListener('fluxo:sync-status', handleSyncStatus)

    return () => window.removeEventListener('fluxo:sync-status', handleSyncStatus)
  }, [])

  useEffect(() => {
    if (!user) {
      return undefined
    }

    async function handleOnline() {
      const result = await pushLocalStorageToCloud()
      setSyncStatus(result)

      if (
        result.reason === 'database-unconfigured' ||
        result.reason === 'database-permissions'
      ) {
        return
      }

      emitToast({
        description:
          result.state === 'synced'
            ? 'As alterações locais foram enviadas.'
            : 'O modo básico mantém seus dados locais neste dispositivo.',
        title: result.state === 'synced' ? 'Fluxo online novamente' : 'Sincronização Premium',
        tone: result.state === 'synced' ? 'success' : 'warning',
      })
    }

    window.addEventListener('online', handleOnline)

    return () => window.removeEventListener('online', handleOnline)
  }, [user])

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) {
      throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    return data
  }, [])

  const signUp = useCallback(async ({ email, fullName, password }) => {
    if (!supabase) {
      throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
    }

    const accountCreatedAt = new Date().toISOString()
    const { data, error } = await supabase.auth.signUp({
      email,
      options: {
        data: {
          full_name: fullName,
          fluxo_account_created_at: accountCreatedAt,
          fluxo_onboarding_completed: false,
          fluxo_plan: 'trial',
        },
      },
      password,
    })

    if (error) {
      throw error
    }

    return data
  }, [])

  const completeOnboarding = useCallback(async () => {
    if (!user) {
      return
    }

    const nextProfile = {
      ...accountProfile,
      onboardingCompleted: true,
    }

    setAccountProfile(nextProfile)
    saveStoredProfile(user.id, nextProfile)

    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        fluxo_onboarding_completed: true,
        onboarding_completed: true,
      },
    })

    if (error) {
      throw error
    }

    const { data } = await supabase.auth.getSession()
    setSession(data.session)
  }, [accountProfile, user])

  const sendPasswordReset = useCallback(async (email) => {
    if (!supabase) {
      throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    if (error) {
      throw error
    }

    return data
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    setStorageUser(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({
      isAuthLoading,
      isConfigured: isSupabaseConfigured,
      isDataLoading,
      onboardingCompleted,
      productAccess,
      sendPasswordReset,
      session,
      completeOnboarding,
      signIn,
      signOut,
      signUp,
      syncStatus,
      user,
    }),
    [
      isAuthLoading,
      isDataLoading,
      onboardingCompleted,
      productAccess,
      sendPasswordReset,
      session,
      completeOnboarding,
      signIn,
      signOut,
      signUp,
      syncStatus,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ensureAccountProfile(user, storedProfile = {}) {
  const nextProfile = {
    ...storedProfile,
    accountCreatedAt:
      storedProfile.accountCreatedAt ||
      user?.user_metadata?.fluxo_account_created_at ||
      user?.created_at ||
      new Date().toISOString(),
    onboardingCompleted:
      storedProfile.onboardingCompleted ||
      user?.user_metadata?.fluxo_onboarding_completed ||
      user?.user_metadata?.onboarding_completed ||
      false,
    plan: storedProfile.plan || user?.user_metadata?.fluxo_plan || 'trial',
    stripeCustomerId: storedProfile.stripeCustomerId,
    subscriptionStatus: storedProfile.subscriptionStatus,
    trialEndsAt: storedProfile.trialEndsAt,
  }

  saveStoredProfile(user.id, nextProfile)
  return nextProfile
}

async function resolveUsableSession(currentSession) {
  if (!currentSession) {
    return null
  }

  if (isExpiredSession(currentSession)) {
    await supabase.auth.signOut().catch(() => {})
    return null
  }

  if (!isBrowserOnline()) {
    return currentSession
  }

  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    await supabase.auth.signOut().catch(() => {})
    return null
  }

  return {
    ...currentSession,
    user: data.user,
  }
}

function isExpiredSession(currentSession) {
  if (!currentSession?.expires_at) {
    return false
  }

  return currentSession.expires_at * 1000 <= Date.now()
}

function isBrowserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine
}

async function loadBillingProfile(userId) {
  if (!supabase || !userId) {
    return {}
  }

  try {
    const profilesTable = fromPublicTable('profiles')

    if (!profilesTable) {
      return {}
    }

    const { data, error } = await profilesTable
      .select(
        'account_created_at, plan_interval, stripe_customer_id, subscription_status, trial_ends_at',
      )
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      return {}
    }

    return {
      accountCreatedAt: data.account_created_at,
      plan: data.plan_interval,
      stripeCustomerId: data.stripe_customer_id,
      subscriptionStatus: data.subscription_status,
      trialEndsAt: data.trial_ends_at,
    }
  } catch {
    return {}
  }
}

function loadStoredProfile(userId) {
  if (!userId || typeof window === 'undefined') {
    return {}
  }

  try {
    const savedProfile = window.localStorage.getItem(getProfileStorageKey(userId))
    return savedProfile ? JSON.parse(savedProfile) : {}
  } catch {
    return {}
  }
}

function saveStoredProfile(userId, profile) {
  if (!userId || typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(getProfileStorageKey(userId), JSON.stringify(profile))
  } catch {
    // Account metadata remains in Supabase when localStorage is unavailable.
  }
}

function getProfileStorageKey(userId) {
  return `${PROFILE_STORAGE_KEY}:${userId}`
}
