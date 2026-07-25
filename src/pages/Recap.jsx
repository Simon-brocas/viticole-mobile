import { useState, useEffect, useContext } from 'react'
import { SalonCtx } from '../App'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'

const BADGE = {
  Especes: 'bg-green-100 text-green-800',
  CB:      'bg-blue-100 text-blue-800',
  Cheque:  'bg-yellow-100 text-yellow-800',
  Mixte:   'bg-indigo-100 text-indigo-800',
}
const TYPE_BADGE = {
  normal:      'bg-forest-100 text-forest-800',
  degustation: 'bg-amber-100 text-amber-800',
  offert:      'bg-purple-100 text-purple-800',
}
const TYPE_LABEL = { degustation: 'dégust.', offert: 'offert' }

export default function Recap() {
  const { salon } = useContext(SalonCtx)
  const [ventes, setVentes] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [confirm, setConfirm] = useState(null)

  useEffect(() => { load() }, [salon.id])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [v, s] = await Promise.all([api.getVentes(salon.id), api.getStats(salon.id)])
      setVentes(v)
      setStats(s)
    } catch {
      setError('Erreur de chargement du récapitulatif.')
    } finally {
      setLoading(false)
    }
  }

  const supprimer = async id => {
    try {
      await api.supprimerVente(salon.id, id)
    } catch (e) {
      setError(e.message)
    }
    setConfirm(null)
    load()
  }

  const doExport = async () => {
    setExporting(true)
    setError('')
    try { await api.exportExcel(salon.id) } catch (e) { setError(e.message) } finally { setExporting(false) }
  }

  const dates = [...new Set(ventes.map(v => v.date))].sort().reverse()
  const filtered = filterDate ? ventes.filter(v => v.date === filterDate) : ventes

  const fmtQty = v => {
    const unit = v.unite === 'carton' ? ` carton${v.quantite > 1 ? 's' : ''}` : ''
    const type = v.type_quantite !== 'normal' ? `${TYPE_LABEL[v.type_quantite] || v.type_quantite} ` : ''
    return `${type}×${v.quantite}${unit}`
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement…</div>

  return (
    <div className="p-3 space-y-3">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {/* Stats globales */}
      {stats && (
        <div className="space-y-2">
          {/* Total principal */}
          <div className="rounded-2xl p-4 text-center"
            style={{ background: 'linear-gradient(135deg, #1e5038 0%, #2f855a 100%)' }}>
            <div className="text-3xl font-bold text-white">{stats.total_global?.toFixed(2)} €</div>
            <div className="text-green-200/80 text-xs font-medium mt-0.5">
              Total ventes • {stats.nb_bouteilles} bouteille{stats.nb_bouteilles > 1 ? 's' : ''}
              {stats.nb_cartons > 0 && ` (dont ${stats.nb_cartons} carton${stats.nb_cartons > 1 ? 's' : ''})`}
            </div>
          </div>
          {/* Détail paiements */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '💶 Espèces', val: stats.total_especes, color: 'text-green-700', bg: 'bg-green-50' },
              { label: '💳 CB',      val: stats.total_cb,      color: 'text-blue-700',  bg: 'bg-blue-50' },
              { label: '📝 Chèque', val: stats.total_cheque,  color: 'text-yellow-700', bg: 'bg-yellow-50' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <div className={`font-bold text-sm ${color}`}>{val?.toFixed(2)} €</div>
                <div className="text-[11px] text-gray-600 mt-0.5 font-medium">{label}</div>
              </div>
            ))}
          </div>
          {/* Dégust / Offerts */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <div className="font-bold text-amber-600">{stats.nb_degustations}</div>
              <div className="text-[11px] text-gray-600 font-medium">Dégustations</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="font-bold text-purple-600">{stats.nb_offerts}</div>
              <div className="text-[11px] text-gray-600 font-medium">Offerts</div>
            </div>
          </div>
        </div>
      )}

      {/* Export + filtre */}
      <div className="flex gap-2">
        <select className="input flex-1" aria-label="Filtrer par date"
          value={filterDate} onChange={e => setFilterDate(e.target.value)}>
          <option value="">Toutes les dates</option>
          {dates.map(d => <option key={d} value={d}>{new Date(d).toLocaleDateString('fr-FR')}</option>)}
        </select>
        <button onClick={doExport} disabled={exporting}
          className="btn-primary py-2 px-3 text-sm whitespace-nowrap">
          {exporting ? '…' : '📥 Excel'}
        </button>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Aucune vente</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => (
            <div key={v.id} className="card flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{v.produit_nom}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className={`badge ${TYPE_BADGE[v.type_quantite]}`}>{fmtQty(v)}</span>
                  {v.mode_paiement && (
                    <span className={`badge ${BADGE[v.mode_paiement] || 'bg-gray-100 text-gray-600'}`}>{v.mode_paiement}</span>
                  )}
                  <span className="badge bg-gray-100 text-gray-600">{v.heure}</span>
                </div>
              </div>
              <div className="text-right flex items-center gap-1">
                {v.type_quantite === 'normal' && (
                  <div className="font-bold text-forest-600">{v.total?.toFixed(2)} €</div>
                )}
                <button onClick={() => setConfirm(v.id)}
                  aria-label={`Supprimer la vente de ${v.produit_nom}`}
                  className="text-red-400 hover:text-red-600 text-sm py-2 px-2">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      {confirm && (
        <ConfirmModal
          title="Supprimer cette vente ?"
          message="Cette action est irréversible et restaure le stock."
          onConfirm={() => supprimer(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
