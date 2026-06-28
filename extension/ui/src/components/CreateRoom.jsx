import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../api'
import ConnectionBlock from './ConnectionBlock'

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    gap: '2rem',
  },
  header: {
    textAlign: 'center',
  },
  wordmark: {
    fontSize: '2rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: 'var(--accent)',
  },
  tagline: {
    color: 'var(--muted)',
    marginTop: '0.5rem',
    fontSize: '0.9rem',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '2rem',
    width: '100%',
    maxWidth: '560px',
  },
  btn: {
    width: '100%',
    padding: '0.85rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  error: {
    color: 'var(--red)',
    fontSize: '0.85rem',
    marginTop: '0.75rem',
    textAlign: 'center',
  },
}

export default function CreateRoom() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [room, setRoom] = useState(null)
  const navigate = useNavigate()

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      const data = await createRoom()
      setRoom(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    const url = new URL(room.dashboard_url)
    navigate(`/room/${url.pathname.split('/room/')[1]}${url.search}`)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.wordmark}>TEMPER</div>
        <div style={s.tagline}>Environment-level evaluation for AI deployments</div>
      </div>

      <div style={s.card}>
        {!room ? (
          <>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Create a room to test any Pi session. You'll get a connection block to paste into Pi — it will self-administer the evaluation and report results here live.
            </p>
            <button
              style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating room…' : 'Create Room'}
            </button>
            {error && <div style={s.error}>{error}</div>}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ color: 'var(--green)', fontWeight: 600 }}>
              Room created — paste this into Pi:
            </div>
            <ConnectionBlock text={room.connection_block} />
            <button style={s.btn} onClick={handleOpen}>
              Open Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
