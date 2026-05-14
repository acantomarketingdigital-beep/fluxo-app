import { useMemo, useState } from 'react'

const navigationItems = [
  { label: 'Visão geral', shortcut: 'VG' },
  { label: 'Receitas', shortcut: 'RC' },
  { label: 'Despesas', shortcut: 'DE' },
  { label: 'Transações', shortcut: 'TR' },
  { label: 'Cartões', shortcut: 'CA' },
  { label: 'Relatórios', shortcut: 'RE', premium: true },
  { label: 'Premium', shortcut: 'PR' },
  { label: 'Configurações', shortcut: 'CO' },
]

const mobileNavigationItems = [
  { label: 'Visão geral', shortcut: 'VG' },
  { label: 'Receitas', shortcut: 'RC' },
  { label: 'Despesas', shortcut: 'DE' },
  { label: 'Cartões', shortcut: 'CA' },
  { label: 'Premium', shortcut: 'PR' },
]

export function Sidebar({
  activeItem = 'Visão geral',
  onNavigate,
  onSignOut,
  productAccess,
  syncStatus,
  user,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const profile = useMemo(() => createUserProfile(user), [user])

  function handleNavigate(itemLabel) {
    onNavigate?.(itemLabel)
    setIsOpen(false)
  }

  return (
    <>
      <aside className={isOpen ? 'sidebar is-open' : 'sidebar'} aria-label="Navegação principal">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              F
            </div>
            <div>
              <strong>Fluxo</strong>
              <span>Finance OS</span>
            </div>
          </div>

          <button
            aria-expanded={isOpen}
            aria-label="Alternar navegação"
            className="sidebar-toggle"
            onClick={() => setIsOpen((current) => !current)}
            type="button"
          >
            <span />
            <span />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <a
              aria-current={item.label === activeItem ? 'page' : undefined}
              className={item.label === activeItem ? 'nav-item is-active' : 'nav-item'}
              href="#main-content"
              key={item.label}
              onClick={() => handleNavigate(item.label)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.shortcut}
              </span>
              <span>{item.label}</span>
              {item.premium && !productAccess?.isPremium ? (
                <small className="nav-lock">Pro</small>
              ) : null}
            </a>
          ))}
        </nav>

        <div className="sidebar-account">
          <div className="trial-badge">{productAccess?.label ?? 'Teste grátis'}</div>

          <div className="user-chip">
            <div className="user-avatar" aria-hidden="true">
              {profile.initials}
            </div>
            <div className="user-copy">
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
            </div>
          </div>

          <div className={`sync-pill sync-pill-${syncStatus?.state ?? 'idle'}`}>
            <span aria-hidden="true" />
            {syncStatus?.message ?? 'Sincronização local'}
          </div>

          <button className="logout-action" onClick={onSignOut} type="button">
            Sair
          </button>
        </div>
      </aside>

      <nav className="bottom-nav" aria-label="Navegação rápida">
        {mobileNavigationItems.map((item) => (
          <a
            aria-current={item.label === activeItem ? 'page' : undefined}
            className={item.label === activeItem ? 'bottom-nav-item is-active' : 'bottom-nav-item'}
            href="#main-content"
            key={item.label}
            onClick={() => handleNavigate(item.label)}
          >
            <span aria-hidden="true">{item.shortcut}</span>
            <small>{item.label}</small>
          </a>
        ))}
      </nav>
    </>
  )
}

function createUserProfile(user) {
  const email = user?.email ?? 'usuario@fluxo.app'
  const name = user?.user_metadata?.full_name || email.split('@')[0] || 'Fluxo'
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return {
    email,
    initials: initials || 'FL',
    name,
  }
}
