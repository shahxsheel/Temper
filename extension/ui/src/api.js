const BASE = ''  // same-origin when served by FastAPI; proxied by Vite dev server

export async function createRoom() {
  const res = await fetch(`${BASE}/rooms/create`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to create room: ${res.status}`)
  return res.json()
}

export async function fetchRoomState(roomId, key) {
  const res = await fetch(`${BASE}/rooms/${roomId}/state?key=${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error(`Failed to fetch room state: ${res.status}`)
  return res.json()
}
