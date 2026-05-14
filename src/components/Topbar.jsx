export function Topbar({
  eyebrow = 'Dashboard financeiro',
  title = 'Visão geral do Fluxo',
  subtitle = 'Quarta-feira, 13 de maio de 2026',
  searchPlaceholder = 'Buscar lançamentos',
  actionLabel = 'Novo lançamento',
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <span className="topbar-date">{subtitle}</span>
      </div>

      <div className="topbar-actions">
        <label className="search-field">
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder={searchPlaceholder} />
        </label>
        {secondaryActionLabel && onSecondaryAction ? (
          <button className="ghost-action" onClick={onSecondaryAction} type="button">
            {secondaryActionLabel}
          </button>
        ) : null}
        <button className="primary-action" onClick={onAction} type="button">
          {actionLabel}
        </button>
      </div>
    </header>
  )
}
