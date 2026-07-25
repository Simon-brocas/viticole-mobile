import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useState } from 'react'
import Login from './pages/Login'
import Salons from './pages/Salons'
import SaisieVente from './pages/SaisieVente'
import Recap from './pages/Recap'
import Stocks from './pages/Stocks'
import Caisse from './pages/Caisse'
import Admin from './pages/Admin'
import Layout from './components/Layout'
import { tokenIsValid } from './api'

export const AuthCtx = createContext(null)
export const SalonCtx = createContext(null)

function Protected({ children }) {
  const { authed } = useContext(AuthCtx)
  if (!authed) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    // Session locale de 48 h, comme le JWT du desktop
    if (!tokenIsValid(localStorage.getItem('token'))) {
      localStorage.removeItem('token')
      return false
    }
    return true
  })
  const [salon, setSalon] = useState(() => {
    try { return JSON.parse(localStorage.getItem('salon')) } catch { return null }
  })

  const login = token => {
    localStorage.setItem('token', token)
    setAuthed(true)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('salon')
    setAuthed(false)
    setSalon(null)
  }

  const selectSalon = s => {
    localStorage.setItem('salon', JSON.stringify(s))
    setSalon(s)
  }

  const clearSalon = () => {
    localStorage.removeItem('salon')
    setSalon(null)
  }

  return (
    <AuthCtx.Provider value={{ authed, login, logout }}>
      <SalonCtx.Provider value={{ salon, selectSalon, clearSalon }}>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/salons" element={<Protected><Salons /></Protected>} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={salon ? <Navigate to="/vente" replace /> : <Navigate to="/salons" replace />} />
              <Route path="/vente" element={<SaisieVente />} />
              <Route path="/recap" element={<Recap />} />
              <Route path="/stocks" element={<Stocks />} />
              <Route path="/caisse" element={<Caisse />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SalonCtx.Provider>
    </AuthCtx.Provider>
  )
}
