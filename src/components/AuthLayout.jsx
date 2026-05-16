import heroImage from '../assets/hero.png'

export function AuthLayout({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-visual" aria-label="Fluxo Finance OS">
        <div
          className="auth-visual-media"
          style={{ backgroundImage: `linear-gradient(135deg, rgba(5, 8, 7, 0.18), rgba(5, 8, 7, 0.76)), url(${heroImage})` }}
        />
        <div className="auth-brand">
          <img
            alt="Fluxo"
            className="brand-logo-symbol"
            src="/brand/fluxo-symbol.svg"
          />
          <div>
            <strong>Fluxo</strong>
            <span>Finance OS</span>
          </div>
        </div>

        <div className="auth-metrics" aria-hidden="true">
          <div>
            <span>Saldo projetado</span>
            <strong>R$ 48.920</strong>
          </div>
          <div>
            <span>Sync</span>
            <strong>Cloud</strong>
          </div>
          <div>
            <span>RLS</span>
            <strong>Ativo</strong>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Acesso ao Fluxo">
        {children}
      </section>
    </main>
  )
}
