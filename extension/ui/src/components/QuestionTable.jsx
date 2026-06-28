import { useState } from 'react'

const DIM_COLORS = {
  instruction_adherence: '#818cf8',
  tool_accuracy: '#34d399',
  output_format: '#60a5fa',
  skill_trigger: '#f59e0b',
  latency_delta: '#a78bfa',
  error_recovery: '#f87171',
}

const s = {
  wrap: {
    border: '1px solid var(--border)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2rem 160px 1fr 72px 72px 52px 104px 120px',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  row: (expanded) => ({
    borderBottom: '1px solid var(--border)',
    background: expanded ? '#0f0f1a' : 'transparent',
    cursor: 'pointer',
    transition: 'background 0.1s',
  }),
  rowMain: {
    display: 'grid',
    gridTemplateColumns: '2rem 160px 1fr 72px 72px 52px 104px 120px',
    gap: '0.5rem',
    padding: '0.65rem 1rem',
    alignItems: 'center',
  },
  idx: {
    color: 'var(--muted)',
    fontFamily: 'var(--mono)',
    fontSize: '0.75rem',
  },
  dim: (dim) => ({
    fontSize: '0.75rem',
    fontWeight: 600,
    color: DIM_COLORS[dim] || 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  verdict: {
    fontSize: '0.78rem',
    color: 'var(--muted)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  score: (val, baseline) => ({
    fontFamily: 'var(--mono)',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: val == null ? 'var(--muted)'
      : val >= baseline ? 'var(--green)'
      : val >= baseline - 10 ? 'var(--yellow)'
      : 'var(--red)',
    textAlign: 'right',
  }),
  delta: (d) => ({
    fontFamily: 'var(--mono)',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: d == null ? 'var(--muted)' : d >= 0 ? 'var(--green)' : 'var(--red)',
    textAlign: 'right',
  }),
  latency: {
    fontFamily: 'var(--mono)',
    fontSize: '0.75rem',
    color: 'var(--muted)',
    textAlign: 'right',
  },
  tokens: {
    fontFamily: 'var(--mono)',
    fontSize: '0.7rem',
    color: 'var(--muted)',
    textAlign: 'right',
  },
  statusIcon: (status) => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: status === 'judged' ? 'var(--green)' : status === 'submitted' ? 'var(--yellow)' : 'var(--border)',
    margin: '0 auto',
    flexShrink: 0,
  }),
  expanded: {
    padding: '0.75rem 1rem 1rem 3rem',
    borderTop: '1px solid var(--border)',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  expandLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.35rem',
  },
  expandText: {
    fontSize: '0.8rem',
    color: 'var(--text)',
    lineHeight: 1.55,
  },
  empty: {
    padding: '3rem',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '0.85rem',
  },
}

function fmt(ms) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

function fmtScore(v) {
  return v == null ? '—' : `${Math.round(v)}`
}

function fmtDelta(d) {
  if (d == null) return '—'
  return d > 0 ? `+${Math.round(d)}` : `${Math.round(d)}`
}

function fmtTokens(inp, out) {
  if (inp == null && out == null) return '—'
  return `${inp ?? '?'}/${out ?? '?'}`
}

function fmtPair(primary, secondary, formatter) {
  if (primary == null && secondary == null) return '—'
  return `${formatter(primary)} / ${formatter(secondary)}`
}

function fmtTokenPair(q) {
  const pi = fmtTokens(q.pi_input_tokens, q.pi_output_tokens)
  const baseline = fmtTokens(q.baseline_input_tokens, q.baseline_output_tokens)
  if (pi === '—' && baseline === '—') return '—'
  return `${pi} / ${baseline}`
}

export default function QuestionTable({ questions }) {
  const [expandedId, setExpandedId] = useState(null)

  if (!questions.length) {
    return (
      <div style={s.wrap}>
        <div style={s.empty}>Waiting for Pi to connect and receive questions…</div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.tableHeader}>
        <div />
        <div>Dimension</div>
        <div>Verdict</div>
        <div style={{ textAlign: 'right' }}>Pi</div>
        <div style={{ textAlign: 'right' }}>Baseline</div>
        <div style={{ textAlign: 'right' }}>Δ</div>
        <div style={{ textAlign: 'right' }}>Latency P/B</div>
        <div style={{ textAlign: 'right' }}>Tokens P/B</div>
      </div>

      {questions.map((q, i) => {
        const expanded = expandedId === q.question_id
        return (
          <div key={q.question_id} style={s.row(expanded)}>
            <div
              style={s.rowMain}
              onClick={() => setExpandedId(expanded ? null : q.question_id)}
            >
              <span style={s.idx}>{i + 1}</span>
              <span style={s.dim(q.dimension)}>{q.dimension?.replace(/_/g, ' ')}</span>
              <span style={s.verdict}>{q.verdict || (q.status === 'submitted' ? 'Judging…' : '—')}</span>
              <span style={s.score(q.harness_score, q.baseline_score)}>{fmtScore(q.harness_score)}</span>
              <span style={s.score(q.baseline_score, q.baseline_score)}>{fmtScore(q.baseline_score)}</span>
              <span style={s.delta(q.delta)}>{fmtDelta(q.delta)}</span>
              <span style={s.latency}>{fmtPair(q.pi_latency_ms, q.baseline_latency_ms, fmt)}</span>
              <span style={s.tokens}>{fmtTokenPair(q)}</span>
            </div>
            {expanded && q.prompt && (
              <div style={s.expanded}>
                <div>
                  <div style={s.expandLabel}>Question</div>
                  <div style={s.expandText}>{q.prompt}</div>
                </div>
                <div>
                  <div style={s.expandLabel}>Gemini Verdict</div>
                  <div style={s.expandText}>{q.verdict || 'Pending…'}</div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
