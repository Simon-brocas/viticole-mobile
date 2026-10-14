import { useState, useRef } from 'react'
import { api } from '../api'
import { Sheet } from './Modal'
import { IconUpload, IconDownload, IconX, IconCheck } from './Icons'

const ACTIONS = {
  creer: { label: 'Nouveau', badge: 'bg-forest-100 text-forest-800' },
  maj: { label: 'Mis à jour', badge: 'bg-blue-100 text-blue-800' },
  reactiver: { label: 'Réactivé', badge: 'bg-purple-100 text-purple-800' },
  inchange: { label: 'Inchangé', badge: 'bg-gray-100 text-gray-600' },
  erreur: { label: 'Erreur', badge: 'bg-red-100 text-red-700' },
}

/**
 * Import du catalogue depuis un fichier Excel (.xlsx) ou CSV, avec aperçu
 * avant import, et export du catalogue au même format (modèle à remplir).
 * salon : salon courant, dont la colonne Stock règle le stock initial.
 */
export default function ImportCatalogue({ salon, onImported }) {
  const input = useRef(null)
  const [fichier, setFichier] = useState(null) // { nom, lignes, apercu }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [succes, setSucces] = useState('')
  const [voirInchanges, setVoirInchanges] = useState(false)

  const salonId = salon?.id ?? null

  const choisir = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setSucces('')
    setBusy(true)
    try {
      const lignes = await api.lireCatalogue(file)
      const apercu = await api.analyserCatalogue(lignes, salonId)
      setFichier({ nom: file.name, lignes, apercu, avecStock: lignes.some(l => 'stock' in l) })
      setVoirInchanges(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const importer = async () => {
    setBusy(true)
    setError('')
    try {
      const { resume } = await api.importerCatalogue(fichier.lignes, salonId)
      setFichier(null)
      setSucces([
        resume.creer && `${resume.creer} article${resume.creer > 1 ? 's' : ''} créé${resume.creer > 1 ? 's' : ''}`,
        resume.maj && `${resume.maj} mis à jour`,
        resume.reactiver && `${resume.reactiver} réactivé${resume.reactiver > 1 ? 's' : ''}`,
      ].filter(Boolean).join(', ') + '.')
      onImported?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const exporter = async () => {
    setError('')
    try { await api.exportCatalogue(salonId) } catch (err) { setError(err.message) }
  }

  const r = fichier?.apercu.resume
  const aImporter = r ? r.creer + r.maj + r.reactiver : 0
  const lignesVisibles = fichier?.apercu.lignes.filter(l => voirInchanges || l.action !== 'inchange') ?? []

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => input.current?.click()} disabled={busy}
          className="btn-secondary py-2.5 text-sm inline-flex items-center justify-center gap-1.5">
          <IconUpload size={16} />
          {busy && !fichier ? 'Lecture…' : 'Importer'}
        </button>
        <button onClick={exporter} className="btn-secondary py-2.5 text-sm inline-flex items-center justify-center gap-1.5">
          <IconDownload size={16} />
          Exporter
        </button>
      </div>
      <p className="text-[11px] text-gray-400 leading-snug">
        Fichier Excel (.xlsx) ou CSV. Colonnes reconnues : Nom, Prix, Catégorie, Carton, Prix carton, Stock.
        Astuce : exportez le catalogue pour obtenir un modèle à compléter.
      </p>
      <input ref={input} type="file" className="hidden" aria-hidden="true"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={choisir} />

      {error && !fichier && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}
      {succes && (
        <div role="status" className="bg-forest-50 border border-forest-200 text-forest-800 rounded-xl p-3 text-sm flex items-center gap-2">
          <IconCheck size={16} className="text-forest-600 shrink-0" />Import terminé : {succes}
        </div>
      )}

      {fichier && (
        <Sheet onClose={() => setFichier(null)} label="Aperçu de l'import" className="max-h-[92vh] overflow-y-auto">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900">Importer le catalogue</h3>
              <p className="text-sm text-gray-500 truncate">{fichier.nom}</p>
            </div>
            <button onClick={() => setFichier(null)} aria-label="Fermer" className="text-gray-400 p-1">
              <IconX size={20} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="Résumé">
            {Object.entries(ACTIONS).filter(([k]) => r[k] > 0).map(([k, a]) => (
              <span key={k} className={`badge ${a.badge}`}>{r[k]} {a.label.toLowerCase()}{r[k] > 1 && k !== 'maj' ? 's' : ''}</span>
            ))}
          </div>
          {fichier.avecStock && (
            <p className="text-xs text-gray-500">
              {salon
                ? <>Colonne Stock : stock initial du salon « {salon.nom} » (les ventes déjà faites sont déduites).</>
                : <>Colonne Stock ignorée : choisissez d'abord un salon.</>}
            </p>
          )}
          {error && <div role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{error}</div>}

          <ul className="divide-y divide-gray-100 border-y border-gray-100">
            {lignesVisibles.map(l => (
              <li key={l.ligne} className="py-2 flex items-start gap-2 text-sm">
                <span className="text-[11px] text-gray-400 w-9 shrink-0 pt-0.5">L{l.ligne}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{l.nom || '—'}</div>
                  {l.erreur
                    ? <div className="text-xs text-red-600">{l.erreur}</div>
                    : l.changements.length > 0 && <div className="text-xs text-gray-500">{l.changements.join(', ')}</div>}
                </div>
                <span className={`badge shrink-0 ${ACTIONS[l.action].badge}`}>{ACTIONS[l.action].label}</span>
              </li>
            ))}
          </ul>
          {r.inchange > 0 && (
            <button onClick={() => setVoirInchanges(v => !v)} className="text-xs text-gray-500 underline">
              {voirInchanges ? 'Masquer' : 'Afficher'} {r.inchange > 1 ? `les ${r.inchange} articles inchangés` : 'l’article inchangé'}
            </button>
          )}
          {r.erreur > 0 && (
            <p className="text-xs text-gray-500">Les lignes en erreur seront ignorées ; corrigez le fichier puis réimportez-le si besoin.</p>
          )}

          <div className="flex gap-2">
            <button onClick={importer} disabled={busy || aImporter === 0} className="btn-primary flex-1">
              {busy ? 'Import…' : aImporter === 0 ? 'Rien à importer' : `Importer ${aImporter} article${aImporter > 1 ? 's' : ''}`}
            </button>
            <button onClick={() => setFichier(null)} className="btn-secondary flex-1">Annuler</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
