import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCtx, SalonCtx } from '../App'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'
import { resizeImage } from '../utils/image'

function fmt(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Salons() {
  const { logout } = useContext(AuthCtx)
  const { selectSalon } = useContext(SalonCtx)
  const navigate = useNavigate()
  const [salons, setSalons] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', lieu: '', date_debut: '', date_fin: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const photoInput = useRef(null)
  const photoTarget = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setSalons(await api.getSalons())
    } catch {
      setError('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.createSalon(form)
      setShowForm(false)
      setForm({ nom: '', lieu: '', date_debut: '', date_fin: '' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const pick = s => { selectSalon(s); navigate('/vente') }

  const choosePhoto = id => {
    photoTarget.current = id
    photoInput.current?.click()
  }

  const onPhotoPicked = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !photoTarget.current) return
    setError('')
    try {
      const blob = await resizeImage(file)
      await api.uploadPhoto('salons', photoTarget.current, blob)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const removePhoto = async id => {
    setError('')
    try {
      await api.deletePhoto('salons', id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteSalon = async s => {
    setConfirmDelete(null)
    setError('')
    try {
      await api.updateSalon(s.id, { ...s, actif: 0 })
      await load()
    } catch { setError('Erreur lors de la suppression') }
  }

  const actifs = salons.filter(s => s.actif)

  return (
    <div className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #102d20 0%, #1e5038 45%, #276749 100%)' }}>

      {/* Header */}
      <header className="px-5 pt-12 pb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl" aria-hidden="true">🍷</span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Viticole</h1>
          </div>
          <p className="text-green-300/70 text-sm">Gestion de salon</p>
        </div>
        <button onClick={logout}
          className="text-xs text-green-300/70 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 mt-1">
          Déconnexion
        </button>
      </header>

      {/* Contenu */}
      <div className="bg-gray-50 rounded-t-3xl min-h-[calc(100vh-130px)] px-4 pt-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Choisir un salon</h2>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="btn-primary py-2 px-3 text-sm">
              + Nouveau
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>
        )}

        {showForm && (
          <form onSubmit={submit} className="card mb-4 space-y-3">
            <h3 className="font-bold text-gray-800">Nouveau salon</h3>
            <input className="input" placeholder="Nom du salon *" value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required />
            <input className="input" placeholder="Lieu" value={form.lieu}
              onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="salon-debut" className="text-xs text-gray-500 font-medium">Date début</label>
                <input id="salon-debut" type="date" className="input mt-1" value={form.date_debut}
                  onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="salon-fin" className="text-xs text-gray-500 font-medium">Date fin</label>
                <input id="salon-fin" type="date" className="input mt-1" value={form.date_fin}
                  onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Création…' : 'Créer'}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Chargement…</div>
        ) : actifs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3" aria-hidden="true">📋</div>
            <p className="font-medium">Aucun salon créé</p>
            <p className="text-sm mt-1">Créez votre premier salon ci-dessus</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actifs.map(s => (
              <div key={s.id} className="card shadow-card-hover group">
                <div className="flex items-start gap-3">
                  {s.has_photo ? (
                    <div className="relative shrink-0">
                      <button onClick={() => choosePhoto(s.id)}
                        aria-label={`Changer la photo du salon ${s.nom}`}
                        title="Changer la photo">
                        <img src={api.photoUrl('salons', s.id, s.photo_updated)} alt=""
                          className="w-16 h-16 rounded-xl object-cover" loading="lazy" />
                      </button>
                      <button onClick={() => removePhoto(s.id)}
                        aria-label={`Retirer la photo du salon ${s.nom}`}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200
                                   text-gray-400 hover:text-red-500 text-[10px] leading-none shadow-card">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => choosePhoto(s.id)}
                      aria-label={`Ajouter une photo au salon ${s.nom}`}
                      className="w-16 h-16 rounded-xl bg-gray-50 border border-dashed border-gray-200
                                 flex items-center justify-center text-xl text-gray-300 hover:text-gray-400
                                 hover:border-gray-300 transition-colors shrink-0">
                      📷
                    </button>
                  )}
                  <button onClick={() => pick(s)} className="flex-1 text-left">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-base">{s.nom}</div>
                        {s.lieu && (
                          <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                            <span className="text-xs" aria-hidden="true">📍</span>{s.lieu}
                          </div>
                        )}
                        {(s.date_debut || s.date_fin) && (
                          <div className="text-xs text-gray-400 mt-1 font-medium">
                            {fmt(s.date_debut)}{s.date_fin ? ` → ${fmt(s.date_fin)}` : ''}
                          </div>
                        )}
                      </div>
                      <span className="text-gray-300 text-xl mt-0.5" aria-hidden="true">›</span>
                    </div>
                  </button>
                  <button onClick={() => setConfirmDelete(s)}
                    aria-label={`Supprimer le salon ${s.nom}`}
                    className="text-red-300 hover:text-red-500 transition-colors p-2">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sélecteur de fichier partagé pour les photos de salon */}
      <input ref={photoInput} type="file" accept="image/*" className="hidden"
        aria-hidden="true" onChange={onPhotoPicked} />

      {confirmDelete && (
        <ConfirmModal
          title={`Supprimer le salon « ${confirmDelete.nom} » ?`}
          message="Le salon sera retiré de la liste. Ses ventes et stocks sont conservés dans la base."
          onConfirm={() => deleteSalon(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
