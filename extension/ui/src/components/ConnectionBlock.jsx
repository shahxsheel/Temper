import { useState } from 'react'

const s = {
  wrap: {
    position: 'relative',
    background: '#0d0d14',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '1rem',
  },
  pre: {
    fontFamily: 'var(--mono)',
    fontSize: '0.78rem',
    color: 'var(--text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.65,
    maxHeight: '320px',
    overflowY: 'auto',
  },
  copyBtn: {
    position: 'absolute',
    top: '0.6rem',
    right: '0.6rem',
    padding: '0.3rem 0.7rem',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    border: '1px solid var(--accent-dim)',
    borderRadius: '5px',
    fontSize: '0.75rem',
    fontWeight: 600,
    transition: 'background 0.15s',
  },
}

export default function ConnectionBlock({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={s.wrap}>
      <pre style={s.pre}>{text}</pre>
      <button style={s.copyBtn} onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
