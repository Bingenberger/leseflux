import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginTeacher } from '../../lib/api.ts'
import { useAuthStore } from '../../store/authStore.ts'
import { Button } from '../../components/shared/Button.tsx'

export default function TeacherLoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await loginTeacher(email, password)
      setAuth(data.user, data.token)
      navigate('/teacher/dashboard', { replace: true })
    } catch {
      setError('E-Mail-Adresse oder Passwort ungültig.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Leseflux</h1>
          <p className="text-gray-500 mt-1 text-sm">Lehrkräfte-Anmeldung</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button icon="check" type="submit" disabled={loading} className="w-full">
            {loading ? 'Einen Moment...' : 'Anmelden'}
          </Button>
        </form>

        <Link
          to="/child/login"
          className="text-sm text-gray-400 text-center hover:underline"
        >
          Zur Schüler-Anmeldung
        </Link>
      </div>
    </div>
  )
}
