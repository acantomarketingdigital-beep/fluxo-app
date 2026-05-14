export function StatCard({ label, value, detail, trend, tone }) {
  const trendPrefix = tone === 'warning' ? '-' : '+'

  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-header">
        <span>{label}</span>
        <strong className="trend-badge">{trend}</strong>
      </div>
      <p>{value}</p>
      <div className="stat-card-footer">
        <small>{detail}</small>
        <span className="metric-spark" aria-hidden="true">
          {[38, 54, 46, 72, 64, 86].map((height, index) => (
            <i key={`${label}-${height}-${index}`} style={{ height: `${height}%` }} />
          ))}
        </span>
      </div>
      <span className="stat-card-watermark" aria-hidden="true">
        {trendPrefix}
      </span>
    </article>
  )
}
