const s = {
  wrap: {
    border: '1px solid var(--accent-dim)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  header: {
    padding: '0.85rem 1.2rem',
    background: 'var(--accent-dim)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--accent)',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 80px 60px 120px',
    gap: '0.5rem',
    padding: '0.6rem 1.2rem',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 80px 80px 60px 120px',
    gap: '0.5rem',
    padding: '0.65rem 1.2rem',
    borderBottom: '1px solid var(--border)',
    alignItems: 'center',
  },
  dim: {
    fontSize: '0.82rem',
    color: 'var(--text)',
  },
  mono: (color) => ({
    fontFamily: 'var(--mono)',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: color || 'var(--text)',
    textAlign: 'right',
  }),
  status: (s) => ({
    padding: '0.18rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 700,
    background: s === 'PASSING' || s === 'RESOLVED' ? '#064e2e'
      : s === 'NEEDS_PATCH' ? '#431407'
      : '#1e1b4b',
    color: s === 'PASSING' || s === 'RESOLVED' ? 'var(--green)'
      : s === 'NEEDS_PATCH' ? 'var(--red)'
      : 'var(--muted)',
    textAlign: 'center',
    letterSpacing: '0.03em',
  }),
  patchesSection: {
    padding: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  patchTitle: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '0.5rem',
  },
  patch: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.85rem 1rem',
  },
  patchFilename: {
    fontFamily: 'var(--mono)',
    fontSize: '0.75rem',
    color: 'var(--accent)',
    marginBottom: '0.5rem',
  },
  patchContent: {
    fontFamily: 'var(--mono)',
    fontSize: '0.75rem',
    color: 'var(--text)',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    maxHeight: '200px',
    overflowY: 'auto',
  },
  empty: {
    padding: '1.2rem',
    color: 'var(--muted)',
    fontSize: '0.82rem',
  },
}

function deltaColor(d) {
  if (d == null) return 'var(--muted)'
  return d >= 0 ? 'var(--green)' : d >= -10 ? 'var(--yellow)' : 'var(--red)'
}

export default function FinalReport({ report, patches }) {
  const dims = report?.dimensions || {}
  const dimEntries = Object.entries(dims)

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.headerTitle}>Final Report</span>
      </div>

      {dimEntries.length === 0 ? (
        <div style={s.empty}>No dimension results available.</div>
      ) : (
        <>
          <div style={s.tableHeader}>
            <div>Dimension</div>
            <div style={{ textAlign: 'right' }}>Pi</div>
            <div style={{ textAlign: 'right' }}>Baseline</div>
            <div style={{ textAlign: 'right' }}>Δ</div>
            <div style={{ textAlign: 'center' }}>Status</div>
          </div>
          {dimEntries.map(([dim, result]) => (
            <div key={dim} style={s.row}>
              <span style={s.dim}>{dim.replace(/_/g, ' ')}</span>
              <span style={s.mono(result.delta >= 0 ? 'var(--green)' : result.delta >= -10 ? 'var(--yellow)' : 'var(--red)')}>
                {result.harness_score ?? '—'}
              </span>
              <span style={s.mono()}>{result.baseline_score ?? '—'}</span>
              <span style={s.mono(deltaColor(result.delta))}>
                {result.delta != null ? (result.delta > 0 ? `+${result.delta}` : result.delta) : '—'}
              </span>
              <span style={s.status(result.status)}>{result.status || '—'}</span>
            </div>
          ))}
        </>
      )}

      {patches && patches.length > 0 && (
        <div style={s.patchesSection}>
          <div style={s.patchTitle}>Suggested Patches ({patches.length})</div>
          {patches.map((p, i) => (
            <div key={i} style={s.patch}>
              <div style={s.patchFilename}>{p.filename}</div>
              <pre style={s.patchContent}>{p.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
