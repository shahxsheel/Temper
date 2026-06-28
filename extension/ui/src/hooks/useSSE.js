import { useEffect, useRef } from 'react'

export function useSSE(roomId, key, onEvent) {
  const esRef = useRef(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!roomId || !key) return

    const url = `/rooms/${roomId}/stream?key=${encodeURIComponent(key)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        onEventRef.current(event)
      } catch {}
    }

    es.onerror = () => {
      // Browser auto-reconnects on error; no action needed
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [roomId, key])
}
