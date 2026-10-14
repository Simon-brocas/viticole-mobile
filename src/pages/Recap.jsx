import { useState, useEffect, useContext, useRef } from 'react'
import { SalonCtx } from '../App'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'
import ZCaisse from '../components/ZCaisse'
import Recu from '../components/Recu'
import { localDate } from '../db/operations'
import { dateCourte } from '../utils/z'
import { MODES } from '../utils/recu'
import { IconCash, IconCard, IconCheque, IconDownload, IconTrash, IconReceipt } from '../components/Icons'

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
const PAGE = 50 // entrées chargées à la fois

export default function Recap() {
  const { salon } = useContext(SalonCtx)
  // Historique paginé : tickets et lignes sans ticket (saisies sur le PC ou avant les tickets)
  const [entrees, setEntrees] = useState([])
  const [total, setTotal] = useState(0)
  const [dates, setDates] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [zDate, setZDate] = useState(null)
  const [recu, setRecu] = useState(null) // id du ticket affiché

  // Premier affichage : écran de chargement ; changement de filtre : liste remplacée sans clignoter
  const premier = useRef(true)
  useEffect(() => {
    load(!premier.current)
    premier.current = false
  }, [salon.id, filterDate])
  // Les totaux suivent le filtre : tout le salon, ou une seule journée
  useEffect(() => { loadStats() }, [salon.id, filterDate])

  // silent : rafraîchit sans écran de chargement (garde le reçu ouvert)
  // garder : recharge autant d'entrées que déjà affichées (après une annulation)
  const load = async (silent = false, garder = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [j, d] = await Promise.all([
        api.getJournal(salon.id, { date: filterDate || null, limit: garder ? Math.max(PAGE, entrees.length) : PAGE }),
        api.getDatesActivite(salon.id),
      ])
      setEntrees(j.entrees)
      setTotal(j.total)
      setDates(d)
    } catch {
      setError('Erreur de chargement du récapitulatif.')
    } finally {
      setLoading(false)
    }
  }

  const afficherPlus = async () => {
    setLoadingMore(true)
    try {
      const j = await api.getJournal(salon.id, { date: filterDate || null, limit: PAGE, offset: entrees.length })
      setEntrees(e => [...e, ...j.entrees])
      setTotal(j.total)
    } catch {
      setError('Erreur de chargement du récapitulatif.')
    } finally {
      setLoadingMore(false)
    }
  }

  const loadStats = async () => {
    try {
      setStats(await api.getStats(salon.id, filterDate || null))
    } catch {
      setError('Erreur de chargement du récapitulatif.')
    }
  }

  const supprimer = async id => {
    try {
      await api.supprimerVente(salon.id, id)
    } catch (e) {
      setError(e.message)
    }
    setConfirm(null)
    load(true, true)
    loadStats()
  }

  const doExport = async () => {
    setExporting(true)
    setError('')
    try { await api.exportExcel(salon.id) } catch (e) { setError(e.message) } finally { setExporting(false) }
  }

  const reste = total - entrees.length

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
              {filterDate ? `Ventes du ${dateCourte(filterDate)}` : 'Total des ventes'} • {stats.nb_unites} article{stats.nb_unites > 1 ? 's' : ''}
              {stats.nb_cartons > 0 && ` (dont ${stats.nb_cartons} carton${stats.nb_cartons > 1 ? 's' : ''})`}
            </div>
          </div>
          {/* Détail paiements */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Espèces', Icon: IconCash,   val: stats.total_especes, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'CB',      Icon: IconCard,   val: stats.total_cb,      color: 'text-blue-700',  bg: 'bg-blue-50' },
              { label: 'Chèque',  Icon: IconCheque, val: stats.total_cheque,  color: 'text-yellow-700', bg: 'bg-yellow-50' },
            ].map(({ label, Icon, val, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <div className={`font-bold text-sm ${color}`}>{val?.toFixed(2)} €</div>
                <div className="text-[11px] text-gray-600 mt-1 font-medium flex items-center justify-center gap-1">
                  <Icon size={13} className="text-gray-500" />
                  {label}
                </div>
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
          {dates.map(d => <option key={d} value={d}>{dateCourte(d)}</option>)}
        </select>
        <button onClick={() => setZDate(filterDate || dates[0] || localDate())}
          className="btn-secondary py-2 px-3 text-sm whitespace-nowrap inline-flex items-center gap-1.5">
          <IconReceipt size={16} />
          Z du jour
        </button>
        <button onClick={doExport} disabled={exporting}
          className="btn-primary py-2 px-3 text-sm whitespace-nowrap inline-flex items-center gap-1.5">
          <IconDownload size={16} />
          {exporting ? '…' : 'Excel'}
        </button>
      </div>

      {/* Liste */}
      {entrees.length === 0 ? (
        <div className="text-center py-10 text-gray-400">Aucune vente</div>
      ) : (
        <div className="space-y-2">
          {entrees.map(({ ticket: t, vente: v }) => t ? (
            <button key={`t${t.id}`} onClick={() => setRecu(t.id)}
              aria-label={`Ticket n°${t.numero}${t.annule ? ' (annulé)' : ''}, ${t.total.toFixed(2)} €`}
              className={`card w-full text-left space-y-1.5 active:scale-[0.99] transition-transform ${t.annule ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="badge bg-gray-800 text-white">N°{t.numero}</span>
                {t.mode_paiement && (
                  <span className={`badge ${BADGE[t.mode_paiement] || 'bg-gray-100 text-gray-600'}`}>{MODES[t.mode_paiement]}</span>
                )}
                <span className="badge bg-gray-100 text-gray-600">{t.heure}</span>
                {(t.remise_lignes > 0 || t.remise_ticket > 0) && (
                  <span className="badge bg-rose-100 text-rose-700">remise −{(t.remise_lignes + t.remise_ticket).toFixed(2)} €</span>
                )}
                {t.annule && <span className="badge bg-red-100 text-red-700">Annulé</span>}
                <span className={`ml-auto font-bold text-forest-600 ${t.annule ? 'line-through' : ''}`}>{t.total.toFixed(2)} €</span>
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                {t.lignes.map((l, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    {l.nom} {l.type === 'normal' ? `×${l.quantite}${l.unite === 'carton' ? ' carton' + (l.quantite > 1 ? 's' : '') : ''}` : `(${TYPE_LABEL[l.type]} ×${l.quantite})`}
                  </span>
                ))}
              </div>
            </button>
          ) : (
            <div key={`v${v.id}`} className="card flex items-center gap-3">
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
                  className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                  <IconTrash size={16} />
                </button>
              </div>
            </div>
          ))}
          {/* Pagination : les entrées suivantes à la demande */}
          {reste > 0 && (
            <button onClick={afficherPlus} disabled={loadingMore}
              className="btn-secondary w-full py-2.5 text-sm">
              {loadingMore ? 'Chargement…' : `Afficher les ${Math.min(PAGE, reste)} suivantes`}
              <span className="block text-[11px] font-normal text-gray-400">{entrees.length} sur {total}</span>
            </button>
          )}
        </div>
      )}

      {recu && (
        <Recu salonId={salon.id} ticketId={recu} onClose={() => setRecu(null)}
          onAnnule={() => { load(true, true); loadStats() }} />
      )}

      {zDate && (
        <ZCaisse salon={salon} dates={dates} initialDate={zDate} onClose={() => setZDate(null)} />
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
