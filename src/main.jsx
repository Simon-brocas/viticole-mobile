import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { initDatabase } from './db/database'
import './index.css'

// Service worker PWA : précache l'app entière, mise à jour automatique
registerSW({ immediate: true })

const root = ReactDOM.createRoot(document.getElementById('root'))

// La base SQLite locale doit être prête avant le premier rendu
initDatabase()
  .then(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
  .catch(err => {
    console.error(err)
    root.render(
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'linear-gradient(160deg,#102d20 0%,#1e5038 45%,#276749 100%)',
        color: '#fff', textAlign: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginBottom: 12 }} aria-hidden="true">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Impossible d'ouvrir la base de données</div>
        <p style={{ fontSize: 14, color: 'rgba(167,243,208,0.8)', marginTop: 8, maxWidth: 320 }}>
          Vérifiez que le navigateur autorise le stockage local
          (la navigation privée peut le bloquer), puis rechargez la page.
        </p>
        <button onClick={() => window.location.reload()} style={{
          marginTop: 20, padding: '10px 24px', borderRadius: 12, border: 'none',
          background: '#2f855a', color: '#fff', fontWeight: 600, fontSize: 15,
        }}>
          Recharger
        </button>
      </div>
    )
  })
