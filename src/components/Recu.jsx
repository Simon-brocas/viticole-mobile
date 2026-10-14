import { useState, useEffect } from 'react'
import { api } from '../api'
import PrintOverlay, { useFlash, partagerTexte } from './PrintOverlay'
import { ConfirmModal } from './Modal'
import { euros, dateCourte } from '../utils/z'
import { libelleRemise, quantiteLigne, paiementTexte, recuTexte } from '../utils/recu'
import { IconShare, IconPrinter, IconTrash } from './Icons'

/**
 * Reçu d'un ticket, plein écran : partage en texte, impression / PDF,
 * et annulation du ticket entier (stock restauré, CA recalculé).
 */
export default function Recu({ salonId, ticketId, onClose, onAnnule }) {
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showFlash, flashNode] = useFlash()

  const load = () => api.getTicket(salonId, ticketId).then(setT).catch(e => setError(e.message))
  useEffect(() => { load() }, [salonId, ticketId])

  const partager = async () => {
    try {
      const res = await partagerTexte(`Ticket n°${t.numero} — ${t.salon.nom}`, recuTexte(t))
      if (res === 'copied') showFlash('Reçu copié — collez-le dans un message')
    } catch (e) {
      setError(e.message)
    }
  }

  const annuler = async () => {
    setConfirm(false)
    setBusy(true)
    setError('')
    try {
      await api.annulerTicket(salonId, ticketId)
      await load()
      onAnnule?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remiseTicket = t && t.remise_ticket > 0
    ? { type: t.remise_ticket_type, valeur: t.remise_ticket_valeur } : null

  return (
    // Échap ferme d'abord la confirmation, pas le reçu
    <PrintOverlay title={t ? `Ticket n°${t.numero}` : 'Ticket'} onClose={confirm ? () => setConfirm(false) : onClose}>
      {error && (
        <div role="alert" className="no-print bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}
      {flashNode}

      {t && (
        <div className="print-zone card space-y-3 relative overflow-hidden">
          {t.annule && (
            <div className="text-center font-bold text-red-600 border-2 border-red-500 rounded-lg py-1 uppercase tracking-wider">
              Ticket annulé · {t.annule_le}
            </div>
          )}
          <div className="text-center border-b border-dashed border-gray-200 pb-3">
            <div className="font-bold text-gray-900 text-lg">{t.salon.nom}</div>
            {t.salon.lieu && <div className="text-sm text-gray-500">{t.salon.lieu}</div>}
            <div className="text-sm text-gray-700 mt-1">
              Ticket n°{t.numero} · {dateCourte(t.date)} à {t.heure}
            </div>
          </div>

          <ul className="space-y-2">
            {t.lignes.map((l, i) => (
              <li key={i} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium text-gray-900">{l.nom}</span>
                  {l.type === 'normal' && <span className="tabular-nums">{euros(l.brut)}</span>}
                </div>
                <div className="text-xs text-gray-500">{quantiteLigne(l)}</div>
                {l.remise && (
                  <div className="flex justify-between text-xs text-rose-600">
                    <span>Remise {libelleRemise(l.remise)}</span>
                    <span className="tabular-nums">−{euros(l.remise_ligne)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-dashed border-gray-200 pt-2 space-y-1 text-sm">
            {(t.remise_lignes > 0 || t.remise_ticket > 0) && (
              <div className="flex justify-between text-gray-600">
                <span>Sous-total</span><span className="tabular-nums">{euros(t.total_brut)}</span>
              </div>
            )}
            {t.remise_lignes > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Remises articles</span><span className="tabular-nums">−{euros(t.remise_lignes)}</span>
              </div>
            )}
            {remiseTicket && (
              <div className="flex justify-between text-rose-600">
                <span>Remise ticket {libelleRemise(remiseTicket)}</span>
                <span className="tabular-nums">−{euros(t.remise_ticket)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-gray-900">
              <span>Total</span><span className="tabular-nums">{euros(t.total)}</span>
            </div>
            <div className="text-xs text-gray-500">{paiementTexte(t)}</div>
          </div>
          <div className="text-center text-xs text-gray-400 pt-1">Merci de votre visite !</div>
        </div>
      )}

      {t && (
        <div className="no-print space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={partager} className="btn-primary inline-flex items-center justify-center gap-2">
              <IconShare size={18} />Partager
            </button>
            <button onClick={() => window.print()} className="btn-secondary inline-flex items-center justify-center gap-2">
              <IconPrinter size={18} />Imprimer / PDF
            </button>
          </div>
          {!t.annule && (
            <button onClick={() => setConfirm(true)} disabled={busy}
              className="w-full py-2.5 text-sm font-semibold text-red-600 rounded-xl border border-red-200 bg-white
                         active:bg-red-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
              <IconTrash size={16} />Annuler le ticket
            </button>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={`Annuler le ticket n°${t.numero} ?`}
          message="Toutes ses lignes sont supprimées et le stock est restauré. Le ticket reste visible, marqué annulé."
          confirmLabel="Annuler le ticket"
          onConfirm={annuler}
          onCancel={() => setConfirm(false)}
        />
      )}
    </PrintOverlay>
  )
}
