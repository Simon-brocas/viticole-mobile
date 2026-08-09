import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthCtx, SalonCtx } from '../App'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'
import { resizeImage } from '../utils/image'
import Logo from '../components/Logo'
import { APP_NAME, APP_TAGLINE } from '../branding'
import { IconPin, IconClipboard, IconCamera, IconX, IconPower, IconPlus, IconTrash } from '../components/Icons'

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
        <div className="flex items-center gap-3">
          <Logo size={44} variant="glass" />
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{APP_NAME}</h1>
            <p className="text-green-300/70 text-sm">{APP_TAGLINE}</p>
          </div>
        </div>
        <button onClick={logout} className="btn-header gap-1.5 px-3 py-2 text-xs font-medium mt-1">
          <IconPower size={15} />
          Déconnexion
        </button>
      </header>

      {/* Contenu */}
      <div className="bg-gray-50 rounded-t-3xl min-h-[calc(100vh-130px)] px-4 pt-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Choisir un salon</h2>
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              className="btn-primary py-2 px-3 text-sm inline-flex items-center gap-1.5">
              <IconPlus size={16} />
              Nouveau
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
            <IconClipboard size={44} className="mx-auto mb-3 text-gray-300" />
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
                                   text-gray-400 hover:text-red-500 shadow-card flex items-center justify-center">
                        <IconX size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => choosePhoto(s.id)}
                      aria-label={`Ajouter une photo au salon ${s.nom}`}
                      className="w-16 h-16 rounded-xl bg-gray-50 border border-dashed border-gray-200
                                 flex items-center justify-center text-gray-300 hover:text-forest-400
                                 hover:border-forest-200 transition-colors shrink-0">
                      <IconCamera size={22} />
                    </button>
                  )}
                  <button onClick={() => pick(s)} className="flex-1 text-left">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-base">{s.nom}</div>
                        {s.lieu && (
                          <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                            <IconPin size={13} className="text-gray-400 shrink-0" />{s.lieu}
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
                    className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
                    <IconTrash size={17} />
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
