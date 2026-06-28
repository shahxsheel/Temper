const s = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  title: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '0.25rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '0.3rem 0',
    borderBottom: '1px solid var(--border)',
  },
  label: {
    fontSize: '0.78rem',
    color: 'var(--muted)',
  },
  value: {
    fontFamily: 'var(--mono)',
    fontSize: '0.8rem',
    color: 'var(--text)',
  },
  divider: {
    borderTop: '1px solid var(--border)',
    margin: '0.25rem 0',
  },
  modelTag: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    borderRadius: '4px',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: 'var(--mono)',
  },
}

function fmt(ms) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function fmtTokens(n) {
  if (!n) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
}

export default function BaselinePanel({
  baselineModel,
  judgeModel,
  piTokens,
  baselineTokens,
  avgPiLatency,
  avgBaselineLatency,
}) {
  return (
    <>
      <div style={s.section}>
        <div style={s.title}>Baseline</div>
        <div>
          <span style={s.modelTag}>{baselineModel}</span>
        </div>
        <div style={{ ...s.row, borderBottom: 'none', marginTop: '0.25rem' }}>
          <span style={s.label}>Judge</span>
          <span style={s.value}>{judgeModel}</span>
        </div>
      </div>

      <div style={s.divider} />

      <div style={s.section}>
        <div style={s.title}>Token Usage</div>
        <div style={s.row}>
          <span style={s.label}>Pi input</span>
          <span style={s.value}>{fmtTokens(piTokens.input)}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Pi output</span>
          <span style={s.value}>{fmtTokens(piTokens.output)}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Baseline input</span>
          <span style={s.value}>{fmtTokens(baselineTokens.input)}</span>
        </div>
        <div style={{ ...s.row, borderBottom: 'none' }}>
          <span style={s.label}>Baseline output</span>
          <span style={s.value}>{fmtTokens(baselineTokens.output)}</span>
        </div>
      </div>

      <div style={s.divider} />

      <div style={s.section}>
        <div style={s.title}>Avg Latency</div>
        <div style={s.row}>
          <span style={s.label}>Pi</span>
          <span style={s.value}>{fmt(avgPiLatency)}</span>
        </div>
        <div style={{ ...s.row, borderBottom: 'none' }}>
          <span style={s.label}>Baseline</span>
          <span style={s.value}>{fmt(avgBaselineLatency)}</span>
        </div>
      </div>
    </>
  )
}
