import { useState, useEffect, useContext, useRef } from 'react'
import { SalonCtx } from '../App'
import { api } from '../api'
import { Sheet, ConfirmModal } from '../components/Modal'
import { resizeImage } from '../utils/image'
import {
  IconTag, IconClipboard, IconLock, IconBox, IconCamera, IconImage,
  IconPencil, IconArchive, IconRestore, IconPlus, IconX,
  IconDatabase, IconUpload, IconDownload, IconAlert, IconCheck,
} from '../components/Icons'

function Tab({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-2 text-[13px] font-medium rounded-lg transition-colors
        ${active ? 'bg-forest-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
      {icon}
      {children}
    </button>
  )
}

export default function Admin() {
  const { salon } = useContext(SalonCtx)
  const [tab, setTab] = useState('produits')

  return (
    <div className="p-3 space-y-3">
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <Tab active={tab === 'produits'} onClick={() => setTab('produits')} icon={<IconTag size={16} />}>
          Articles
        </Tab>
        <Tab active={tab === 'salon'} onClick={() => setTab('salon')} icon={<IconClipboard size={16} />}>
          Salon
        </Tab>
        <Tab active={tab === 'securite'} onClick={() => setTab('securite')} icon={<IconLock size={16} />}>
          Sécurité
        </Tab>
        <Tab active={tab === 'donnees'} onClick={() => setTab('donnees')} icon={<IconDatabase size={16} />}>
          Données
        </Tab>
      </div>
      {tab === 'produits' && <ProduitsAdmin />}
      {tab === 'salon' && <SalonAdmin salon={salon} />}
      {tab === 'securite' && <SecuriteAdmin />}
      {tab === 'donnees' && <DonneesAdmin />}
    </div>
  )
}

const EMPTY_FORM = { nom: '', prix: '', categorie: '', carton_taille: '', carton_prix: '' }
const EMPTY_PHOTO = { blob: null, preview: null, removed: false }

function ProduitsAdmin() {
  const [produits, setProduits] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [photo, setPhoto] = useState(EMPTY_PHOTO)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { setProduits(await api.getProduits(true)) }
    catch { setError('Erreur de chargement des articles.') }
    finally { setLoading(false) }
  }

  const formToPayload = () => ({
    nom: form.nom,
    prix: parseFloat(form.prix),
    categorie: form.categorie,
    carton_taille: form.carton_taille === '' ? null : parseInt(form.carton_taille),
    carton_prix: form.carton_prix === '' ? null : parseFloat(form.carton_prix),
  })

  const pickPhoto = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const blob = await resizeImage(file)
      setPhoto(ph => {
        if (ph.blob && ph.preview) URL.revokeObjectURL(ph.preview)
        return { blob, preview: URL.createObjectURL(blob), removed: false }
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const removePhoto = () => setPhoto(ph => {
    if (ph.blob && ph.preview) URL.revokeObjectURL(ph.preview)
    return { blob: null, preview: null, removed: true }
  })

  const submit = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let produitId
      if (editing) {
        await api.updateProduit(editing.id, { ...formToPayload(), actif: editing.actif })
        produitId = editing.id
      } else {
        const res = await api.createProduit(formToPayload())
        produitId = res.id
      }
      if (photo.blob) {
        await api.uploadPhoto('produits', produitId, photo.blob)
      } else if (photo.removed && editing) {
        await api.deletePhoto('produits', produitId)
      }
      setEditing(null)
      setShowAdd(false)
      setForm(EMPTY_FORM)
      setPhoto(EMPTY_PHOTO)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = p => {
    setEditing(p)
    setShowAdd(false)
    setForm({
      nom: p.nom, prix: String(p.prix), categorie: p.categorie || '',
      carton_taille: p.carton_taille ? String(p.carton_taille) : '',
      carton_prix: p.carton_prix != null ? String(p.carton_prix) : '',
    })
    setPhoto({
      blob: null,
      preview: p.has_photo ? api.photoUrl('produits', p.id, p.photo_updated) : null,
      removed: false,
    })
  }

  const setActif = async (p, actif) => {
    setError('')
    try {
      await api.updateProduit(p.id, { ...p, actif })
      await load()
    } catch (e) {
      setError(e.message)
    }
    setConfirmArchive(null)
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Chargement…</div>

  const actifs = produits.filter(p => p.actif)
  const archives = produits.filter(p => !p.actif)

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {!showAdd && !editing && (
        <button onClick={() => setShowAdd(true)}
          className="btn-primary w-full inline-flex items-center justify-center gap-1.5">
          <IconPlus size={17} />
          Nouvel article
        </button>
      )}

      {(showAdd || editing) && (
        <form onSubmit={submit} className="card space-y-3">
          <h3 className="font-semibold">{editing ? 'Modifier l’article' : 'Nouvel article'}</h3>
          <input className="input" placeholder="Nom de l'article *" value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Prix unitaire (€) *</label>
              <input className="input mt-1" type="number" step="0.01" min="0" placeholder="0.00" value={form.prix}
                onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} required />
            </div>
            <div>
              <label className="text-xs text-gray-500">Catégorie</label>
              <input className="input mt-1" placeholder="Ex : Boissons" value={form.categorie}
                onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} />
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <IconCamera size={14} className="text-gray-400" />
              Photo (facultatif)
            </p>
            <div className="flex items-center gap-3">
              {photo.preview ? (
                <img src={photo.preview} alt="Aperçu de l'article"
                  className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300">
                  <IconImage size={24} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm text-forest-600 underline cursor-pointer">
                  {photo.preview ? 'Changer la photo' : 'Choisir une photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                </label>
                {photo.preview && (
                  <button type="button" onClick={removePhoto} className="text-sm text-red-400 underline text-left">
                    Retirer la photo
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <IconBox size={14} className="text-gray-400" />
              Vente en carton (facultatif)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Unités / carton</label>
                <input className="input mt-1" type="number" min="2" step="1" placeholder="Ex : 6"
                  value={form.carton_taille}
                  onChange={e => setForm(f => ({ ...f, carton_taille: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Prix carton (€)</label>
                <input className="input mt-1" type="number" step="0.01" min="0" placeholder="Ex : 34.00"
                  value={form.carton_prix}
                  onChange={e => setForm(f => ({ ...f, carton_prix: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-gray-400">Laissez vide pour vendre uniquement à la bouteille.</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '…' : (editing ? 'Enregistrer' : 'Ajouter')}
            </button>
            <button type="button" className="btn-secondary flex-1"
              onClick={() => { setEditing(null); setShowAdd(false); setForm(EMPTY_FORM); setPhoto(EMPTY_PHOTO); setError('') }}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {actifs.map(p => (
          <div key={p.id} className="card flex items-center gap-2">
            {p.has_photo ? (
              <img src={api.photoUrl('produits', p.id, p.photo_updated)} alt=""
                className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-300">
                <IconImage size={18} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{p.nom}</div>
              <div className="text-xs text-gray-500">
                {p.prix?.toFixed(2)} €
                {p.carton_taille ? ` · carton de ${p.carton_taille} : ${p.carton_prix?.toFixed(2)} €` : ''}
                {p.categorie ? ` · ${p.categorie}` : ''}
              </div>
            </div>
            <button onClick={() => startEdit(p)} aria-label={`Modifier ${p.nom}`} title="Modifier"
              className="p-2 rounded-lg text-gray-400 hover:text-forest-600 hover:bg-forest-50 transition-colors">
              <IconPencil size={17} />
            </button>
            <button onClick={() => setConfirmArchive(p)} aria-label={`Archiver ${p.nom}`} title="Archiver"
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <IconArchive size={17} />
            </button>
          </div>
        ))}
      </div>

      {/* Produits archivés (restaurables) */}
      {archives.length > 0 && (
        <div>
          <button onClick={() => setShowArchived(v => !v)}
            className="text-sm text-gray-500 underline mb-2">
            {showArchived ? 'Masquer' : 'Voir'} les articles archivés ({archives.length})
          </button>
          {showArchived && (
            <div className="space-y-1">
              {archives.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100 opacity-70">
                  <div>
                    <span className="text-sm text-gray-600">{p.nom}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.prix?.toFixed(2)} €</span>
                  </div>
                  <button onClick={() => setActif(p, 1)}
                    className="text-xs text-forest-600 py-2 px-2 rounded-lg hover:bg-forest-50
                               inline-flex items-center gap-1.5 transition-colors">
                    <IconRestore size={14} />
                    Restaurer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmArchive && (
        <ConfirmModal
          title={`Archiver « ${confirmArchive.nom} » ?`}
          message="L'article disparaîtra des listes mais restera dans l'historique des ventes. Vous pourrez le restaurer."
          confirmLabel="Archiver"
          onConfirm={() => setActif(confirmArchive, 0)}
          onCancel={() => setConfirmArchive(null)}
        />
      )}
    </div>
  )
}

function SalonAdmin({ salon }) {
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [salon.id])

  const load = async () => {
    setLoading(true)
    try { setProduits(await api.getSalonProduits(salon.id)) }
    catch { setError('Erreur de chargement.') }
    finally { setLoading(false) }
  }

  const toggle = async p => {
    setError('')
    try {
      await api.updateSalonProduit(salon.id, p.produit_id, { ...p, selectionne: p.selectionne ? 0 : 1 })
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const save = async () => {
    if (!editing) return
    if (editing.stock_initial < 0 || editing.stock_restant < 0) {
      setError('Le stock ne peut pas être négatif.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.updateSalonProduit(salon.id, editing.produit_id, editing)
      setEditing(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Même règle que la page Stocks : le restant suit l'écart du stock initial
  const setInitial = value => setEditing(d => ({
    ...d,
    stock_initial: value,
    stock_restant: Math.round((d.stock_restant + (value - d.stock_initial)) * 2) / 2,
  }))

  if (loading) return <div className="text-center py-8 text-gray-400">Chargement…</div>

  const selected = produits.filter(p => p.selectionne)
  const rest = produits.filter(p => !p.selectionne)

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Sélectionnez les articles et définissez les stocks pour <strong>{salon.nom}</strong>
      </p>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {selected.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles actifs</h3>
          {selected.map(p => (
            <div key={p.produit_id} className="card flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.nom}</div>
                <div className="text-xs text-gray-500">
                  Stock : <b>{p.stock_restant}</b> / {p.stock_initial}
                </div>
              </div>
              <button onClick={() => setEditing({ ...p })} className="text-sm text-forest-600 underline py-2">Stock</button>
              <button onClick={() => toggle(p)} className="text-sm text-red-400 underline py-2">Retirer</button>
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles disponibles</h3>
          {rest.map(p => (
            <div key={p.produit_id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
              <div>
                <span className="text-sm text-gray-700">{p.nom}</span>
                <span className="text-xs text-gray-400 ml-2">{p.prix?.toFixed(2)} €</span>
              </div>
              <button onClick={() => toggle(p)} className="text-sm text-forest-600 underline py-2">Ajouter</button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Sheet onClose={() => setEditing(null)}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Stock — {editing.nom}</h3>
            <button onClick={() => setEditing(null)} aria-label="Fermer"
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <IconX size={19} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="adm-stock-init" className="text-xs font-medium text-gray-600">Stock initial</label>
              <input id="adm-stock-init" type="number" inputMode="decimal" min="0" step="0.5" className="input mt-1"
                value={editing.stock_initial}
                onChange={e => setInitial(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="adm-stock-rest" className="text-xs font-medium text-gray-600">Stock restant</label>
              <input id="adm-stock-rest" type="number" inputMode="decimal" min="0" step="0.5" className="input mt-1"
                value={editing.stock_restant}
                onChange={e => setEditing(d => ({ ...d, stock_restant: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? '…' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Annuler</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function SecuriteAdmin() {
  const [form, setForm] = useState({ current: '', neu: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (form.neu.length < 4) {
      setError('Le nouveau mot de passe doit faire au moins 4 caractères.')
      return
    }
    if (form.neu !== form.confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setSaving(true)
    try {
      await api.changePassword(form.current, form.neu)
      setForm({ current: '', neu: '', confirm: '' })
      setSuccess('Mot de passe modifié')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="font-semibold">Changer le mot de passe</h3>
      {error && <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}
      {success && <div role="status" className="text-sm text-green-700 bg-green-50 rounded-lg p-2">{success}</div>}
      <div>
        <label htmlFor="pwd-current" className="text-xs font-medium text-gray-600">Mot de passe actuel</label>
        <input id="pwd-current" className="input mt-1" type="password" autoComplete="current-password"
          value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} required />
      </div>
      <div>
        <label htmlFor="pwd-new" className="text-xs font-medium text-gray-600">Nouveau mot de passe</label>
        <input id="pwd-new" className="input mt-1" type="password" autoComplete="new-password"
          value={form.neu} onChange={e => setForm(f => ({ ...f, neu: e.target.value }))} required />
      </div>
      <div>
        <label htmlFor="pwd-confirm" className="text-xs font-medium text-gray-600">Confirmer le nouveau mot de passe</label>
        <input id="pwd-confirm" className="input mt-1" type="password" autoComplete="new-password"
          value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
      </div>
      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? 'Enregistrement…' : 'Changer le mot de passe'}
      </button>
    </form>
  )
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function fmtBackupKey(key) {
  // 'zeste-2026-07-25-14-30-00' → date lisible (préfixe historique accepté)
  const m = key.match(/^[a-z]+-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/)
  if (!m) return key
  return `${m[3]}/${m[2]}/${m[1]} à ${m[4]}:${m[5]}`
}

function DonneesAdmin() {
  const [backups, setBackups] = useState([])
  const [storage, setStorage] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmImport, setConfirmImport] = useState(null)   // File en attente
  const [confirmRestore, setConfirmRestore] = useState(null) // clé de sauvegarde
  const fileInput = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setBackups(await api.listBackups())
      setStorage(await api.storageInfo())
    } catch { /* informatif seulement */ }
  }

  const flash = msg => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const doExport = async () => {
    setBusy(true)
    setError('')
    try {
      await api.exportDbFile()
      flash('Base exportée')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onFilePicked = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setConfirmImport(file)
  }

  const doImport = async () => {
    const file = confirmImport
    setConfirmImport(null)
    setBusy(true)
    setError('')
    try {
      await api.importDbFile(file)
      // Repart sur un état propre (salon sélectionné, caches…)
      localStorage.removeItem('salon')
      window.location.href = import.meta.env.BASE_URL
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const doRestore = async () => {
    const key = confirmRestore
    setConfirmRestore(null)
    setBusy(true)
    setError('')
    try {
      await api.restoreBackup(key)
      localStorage.removeItem('salon')
      window.location.href = import.meta.env.BASE_URL
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}
      {success && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm
                                      flex items-center gap-2">
          <IconCheck size={16} />
          {success}
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold">Échange avec le PC</h3>
        <p className="text-xs text-gray-500">
          Le fichier <b>.db</b> exporté ici s'ouvre directement dans le logiciel Windows
          (remplacez <b>zeste.db</b> à côté de Zeste.exe), et inversement.
        </p>
        <button onClick={doExport} disabled={busy}
          className="btn-primary w-full inline-flex items-center justify-center gap-2">
          <IconUpload size={17} />
          Exporter la base (.db)
        </button>
        <button onClick={() => fileInput.current?.click()} disabled={busy}
          className="btn-secondary w-full inline-flex items-center justify-center gap-2">
          <IconDownload size={17} />
          Importer une base (.db)
        </button>
        <input ref={fileInput} type="file" accept=".db,application/octet-stream" className="hidden"
          aria-hidden="true" onChange={onFilePicked} />
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Sauvegardes automatiques</h3>
        <p className="text-xs text-gray-500">
          Une sauvegarde est créée à chaque ouverture de l'application (les 14 plus récentes sont conservées).
        </p>
        {backups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">Aucune sauvegarde pour l'instant</p>
        ) : (
          <div className="space-y-1">
            {backups.map(b => (
              <div key={b.key} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                <div>
                  <div className="text-sm text-gray-700">{fmtBackupKey(b.key)}</div>
                  <div className="text-xs text-gray-400">{fmtSize(b.size)}</div>
                </div>
                <button onClick={() => setConfirmRestore(b.key)} disabled={busy}
                  className="text-sm text-forest-600 py-2 px-2 rounded-lg hover:bg-forest-50
                             inline-flex items-center gap-1.5 transition-colors">
                  <IconRestore size={14} />
                  Restaurer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {storage && (
        <div className="card space-y-1">
          <h3 className="font-semibold">Stockage</h3>
          <p className="text-sm text-gray-600 flex items-start gap-2">
            {storage.persisted === true ? (
              <>
                <IconLock size={16} className="text-forest-500 shrink-0 mt-0.5" />
                Stockage protégé : le téléphone ne supprimera pas les données.
              </>
            ) : (
              <>
                <IconAlert size={16} className="text-orange-500 shrink-0 mt-0.5" />
                Stockage non protégé : pensez à exporter la base régulièrement.
              </>
            )}
          </p>
          {storage.usage != null && (
            <p className="text-xs text-gray-400">
              Espace utilisé : {fmtSize(storage.usage)}
            </p>
          )}
        </div>
      )}

      {confirmImport && (
        <ConfirmModal
          title="Remplacer toutes les données ?"
          message={`Le contenu actuel (ventes, stocks, articles…) sera remplacé par « ${confirmImport.name} ». Une sauvegarde automatique de l'état actuel sera conservée.`}
          confirmLabel="Importer"
          onConfirm={doImport}
          onCancel={() => setConfirmImport(null)}
        />
      )}

      {confirmRestore && (
        <ConfirmModal
          title="Restaurer cette sauvegarde ?"
          message={`Les données reviendront à l'état du ${fmtBackupKey(confirmRestore)}. Une sauvegarde de l'état actuel sera conservée.`}
          confirmLabel="Restaurer"
          onConfirm={doRestore}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  )
}
