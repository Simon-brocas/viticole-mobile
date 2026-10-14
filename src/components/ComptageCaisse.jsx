import { useState } from 'react'
import { api } from '../api'
import { Sheet } from './Modal'
import { GROUPES, libelleCoupure, totalDetail, lireEcart, ecartSigne } from '../utils/comptage'
import { dateLongue, euros } from '../utils/z'
import { IconMinus, IconPlus, IconX } from './Icons'

export const TON_ECART = {
  ok: 'bg-green-50 text-green-700',
  plus: 'bg-orange-50 text-orange-700',
  moins: 'bg-red-50 text-red-700',
}

/**
 * Comptage de fin de journée : nombre de billets et de pièces, total compté
 * et écart avec le solde théorique (fond initial + espèces encaissées).
 * row : ligne de api.getCaisse (date, montant_initial, especes_encaissees, solde, comptage)
 */
export default function ComptageCaisse({ salonId, row, onClose, onSaved }) {
  const [detail, setDetail] = useState(() => Object.fromEntries(
    Object.entries(row.comptage?.detail ?? {}).map(([c, n]) => [c, String(n)])
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const total = totalDetail(detail)
  const ecart = lireEcart(total - row.solde)

  const setNombre = (c, value) => setDetail(d => ({ ...d, [c]: value.replace(/\D/g, '').slice(0, 6) }))
  const pas = (c, dir) => setDetail(d => {
    const n = Math.max(0, (parseInt(d[c], 10) || 0) + dir)
    return { ...d, [c]: n ? String(n) : '' }
  })

  const run = async action => {
    setSaving(true)
    setError('')
    try {
      await action()
      onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const enregistrer = () => run(() => api.setComptage(salonId, {
    date: row.date,
    detail: Object.fromEntries(Object.entries(detail)
      .map(([c, n]) => [c, parseInt(n, 10) || 0])
      .filter(([, n]) => n > 0)),
  }))
  const effacer = () => run(() => api.deleteComptage(salonId, row.date))

  return (
    <Sheet onClose={onClose} label="Comptage de caisse" className="max-h-[92vh] overflow-y-auto !pb-0">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Compter la caisse</h3>
          <p className="text-sm text-gray-500 first-letter:uppercase">{dateLongue(row.date)}</p>
        </div>
        <button onClick={onClose} aria-label="Fermer" className="text-gray-400 p-1">
          <IconX size={20} />
        </button>
      </div>

      {GROUPES.map(({ titre, coupures }) => (
        <fieldset key={titre}>
          <legend className="section-label mb-1.5">{titre}</legend>
          <div className="divide-y divide-gray-100">
            {coupures.map(c => {
              const n = parseInt(detail[c], 10) || 0
              const label = libelleCoupure(c)
              return (
                <div key={c} className="flex items-center gap-2 py-1.5">
                  <label htmlFor={`coupure-${c}`} className="w-16 shrink-0 font-semibold text-sm text-gray-800">
                    {label}
                  </label>
                  <button type="button" onClick={() => pas(c, -1)} disabled={n === 0}
                    aria-label={`Retirer un ${label}`}
                    className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center
                               active:bg-gray-200 disabled:opacity-30">
                    <IconMinus size={16} strokeWidth={2.4} />
                  </button>
                  <input id={`coupure-${c}`} inputMode="numeric" pattern="[0-9]*" placeholder="0"
                    aria-label={`Nombre de ${label}`}
                    className="input w-16 py-1.5 text-center px-1"
                    value={detail[c] ?? ''} onChange={e => setNombre(c, e.target.value)} />
                  <button type="button" onClick={() => pas(c, 1)} aria-label={`Ajouter un ${label}`}
                    className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center active:bg-gray-200">
                    <IconPlus size={16} strokeWidth={2.4} />
                  </button>
                  <span className={`ml-auto text-sm tabular-nums ${n ? 'font-semibold text-gray-900' : 'text-gray-300'}`}>
                    {euros((c * n) / 100)}
                  </span>
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}

      {/* Récapitulatif, toujours visible en bas */}
      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-white border-t border-gray-100 space-y-2">
        {error && <div role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg p-2">{error}</div>}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Compté</div>
            <div className="font-bold text-lg tabular-nums" aria-live="polite">{euros(total)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Théorique</div>
            <div className="font-bold text-lg tabular-nums">{euros(row.solde)}</div>
            <div className="text-[11px] text-gray-500">
              fond {euros(row.montant_initial)} + espèces {euros(row.especes_encaissees)}
            </div>
          </div>
        </div>
        <div className={`flex justify-between font-semibold rounded-lg px-3 py-2 ${TON_ECART[ecart.ton]}`}
          aria-live="polite">
          <span>{ecart.libelle}</span>
          <span className="tabular-nums">{ecartSigne(ecart.e)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={enregistrer} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Enregistrement…' : 'Enregistrer le comptage'}
          </button>
          {row.comptage && (
            <button onClick={effacer} disabled={saving} className="btn-secondary px-3 text-sm">
              Effacer
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
