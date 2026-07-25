import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCtx } from '../App'
import { api } from '../api'

export default function Login() {
  const { login } = useContext(AuthCtx)
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [defaultPwd, setDefaultPwd] = useState(false)

  useEffect(() => {
    api.authStatus().then(s => setDefaultPwd(s.default_password)).catch(() => {})
  }, [])

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.login(password)
      login(res.token)
      navigate('/salons')
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Impossible de contacter le serveur' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #102d20 0%, #1e5038 45%, #276749 100%)' }}>

      {/* Déco cercles en arrière-plan */}
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #7dcfa9, transparent)' }} />
      <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #44b483, transparent)' }} />

      {/* Logo */}
      <div className="text-center mb-8 relative z-10">
        <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20
                        flex items-center justify-center text-5xl mx-auto mb-4 shadow-modal" aria-hidden="true">
          🍷
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Viticole</h1>
        <p className="text-green-300/70 text-sm mt-1 font-medium">Gestion de salon</p>
      </div>

      {/* Carte login */}
      <form onSubmit={submit}
        className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-2xl shadow-modal p-6 space-y-4 relative z-10">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="password" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Mot de passe
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            autoFocus
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full text-base mt-2" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        {defaultPwd && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 text-center">
            Mot de passe initial : <b>admin123</b><br />
            Pensez à le changer dans Admin → Sécurité.
          </p>
        )}
      </form>
    </div>
  )
}
