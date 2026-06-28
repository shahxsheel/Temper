import { Routes, Route, Navigate } from 'react-router-dom'
import CreateRoom from './components/CreateRoom'
import Dashboard from './components/Dashboard'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateRoom />} />
      <Route path="/room/:roomId" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
