import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'
import { useEscape } from './Modal'
import { euros, dateLongue, dateCourte, detailArticle, zTexte } from '../utils/z'
import { lireEcart, ecartSigne } from '../utils/comptage'
import { IconX, IconCash, IconCard, IconCheque, IconShare, IconPrinter, IconCheck } from './Icons'

/**
 * Z de caisse : rapport de fin de journée d'un salon, plein écran.
 * Partage en texte (feuille de partage ou presse-papiers) et impression /
 * PDF via la boîte d'impression du navigateur (seul le rapport est imprimé).
 */
export default function ZCaisse({ salon, dates, initialDate, onClose }) {
  const [date, setDate] = useState(initialDate)
  const [z, setZ] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  useEscape(onClose)

  useEffect(() => {
    setError('')
    api.getZ(salon.id, date).then(setZ).catch(e => setError(e.message))
  }, [salon.id, date])

  // Pendant l'impression, seul le Z est affiché (voir index.css)
  useEffect(() => {
    document.body.classList.add('z-open')
    return () => document.body.classList.remove('z-open')
  }, [])

  const showFlash = msg => {
    setFlash(msg)
    setTimeout(() => setFlash(''), 2500)
  }

  const partager = async () => {
    const text = zTexte(z)
    if (navigator.share) {
      try {
        await navigator.share({ title: `Z de caisse — ${salon.nom} — ${dateCourte(date)}`, text })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      showFlash('Z copié — collez-le dans un message')
    } catch {
      setError('Partage indisponible sur cet appareil : utilisez « Imprimer / PDF ».')
    }
  }

  // Le jour affiché reste dans la liste même sans vente (ex. aujourd'hui)
  const choix = [...new Set([date, ...dates])].sort().reverse()

  return createPortal(
    <div className="z-overlay fixed inset-0 z-50 bg-gray-50 overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="Z de caisse">
      <div className="max-w-lg mx-auto px-3 space-y-3
                      pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="no-print flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">Z de caisse</h2>
          <button onClick={onClose} aria-label="Fermer"
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100">
            <IconX size={20} />
          </button>
        </div>

        <select className="input no-print" aria-label="Journée" value={date}
          onChange={e => setDate(e.target.value)}>
          {choix.map(d => <option key={d} value={d}>{dateLongue(d)}</option>)}
        </select>

        {error && (
          <div role="alert" className="no-print bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}
        <div aria-live="polite" className="no-print">
          {flash && (
            <div className="bg-gray-800 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2">
              <IconCheck size={18} className="text-green-400" />
              {flash}
            </div>
          )}
        </div>

        {z && (
          <div className="print-zone card space-y-4">
            {/* En-tête */}
            <div className="text-center border-b border-dashed border-gray-200 pb-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Z de caisse</div>
              <div className="font-bold text-gray-900 text-lg mt-0.5">{z.salon.nom}</div>
              {z.salon.lieu && <div className="text-sm text-gray-500">{z.salon.lieu}</div>}
              <div className="text-sm font-medium text-gray-700 mt-1 first-letter:uppercase">{dateLongue(z.date)}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {z.nb_lignes > 0 ? `Ventes de ${z.premiere} à ${z.derniere}` : 'Aucune vente ce jour'}
              </div>
            </div>

            {/* Chiffre d'affaires */}
            <div className="text-center">
              <div className="text-xs text-gray-500 font-medium">Chiffre d'affaires</div>
              <div className="text-3xl font-bold text-forest-700">{euros(z.stats.total_global)}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Espèces', Icon: IconCash, val: z.stats.total_especes },
                { label: 'CB', Icon: IconCard, val: z.stats.total_cb },
                { label: 'Chèque', Icon: IconCheque, val: z.stats.total_cheque },
              ].map(({ label, Icon, val }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-2">
                  <div className="font-bold text-sm text-gray-900">{euros(val)}</div>
                  <div className="text-[11px] text-gray-500 font-medium flex items-center justify-center gap-1 mt-0.5">
                    <Icon size={13} className="text-gray-400" />{label}
                  </div>
                </div>
              ))}
            </div>

            {/* Compteurs */}
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <dt className="text-[11px] text-gray-500">Unités vendues</dt>
                <dd className="font-bold">{z.stats.nb_unites}
                  {z.stats.nb_cartons > 0 && (
                    <span className="block text-[11px] font-medium text-gray-500">dont {z.stats.nb_cartons} carton{z.stats.nb_cartons > 1 ? 's' : ''}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-500">Dégustations</dt>
                <dd className="font-bold text-amber-600">{z.stats.nb_degustations}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-gray-500">Offerts</dt>
                <dd className="font-bold text-purple-600">{z.stats.nb_offerts}</dd>
              </div>
            </dl>

            {/* Détail par article */}
            {z.articles.length > 0 && (
              <div>
                <h3 className="section-label mb-1.5">Détail par article</h3>
                <ul className="divide-y divide-gray-100">
                  {z.articles.map(a => (
                    <li key={a.nom} className="flex items-start justify-between gap-3 py-1.5">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">{a.nom}</div>
                        <div className="text-xs text-gray-500">{detailArticle(a)}</div>
                      </div>
                      {a.total > 0 && <div className="text-sm font-semibold whitespace-nowrap">{euros(a.total)}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Caisse espèces */}
            <div className="bg-forest-50 rounded-xl p-3 space-y-1 text-sm">
              <h3 className="section-label text-forest-700 mb-1">Caisse espèces</h3>
              <div className="flex justify-between">
                <span className="text-gray-600">Fond initial</span>
                <span className="font-medium">{z.caisse.fond_initial === null ? 'non saisi' : euros(z.caisse.fond_initial)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Espèces encaissées</span>
                <span className="font-medium">+ {euros(z.caisse.especes)}</span>
              </div>
              <div className="flex justify-between font-bold text-forest-700 border-t border-forest-200 pt-1">
                <span>Solde théorique</span>
                <span>{euros(z.caisse.solde_theorique)}</span>
              </div>
              {z.caisse.compte !== null ? (() => {
                const ecart = lireEcart(z.caisse.ecart)
                const couleur = { ok: 'text-green-700', plus: 'text-orange-700', moins: 'text-red-700' }[ecart.ton]
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Espèces comptées{z.caisse.compte_heure ? ` (${z.caisse.compte_heure})` : ''}
                      </span>
                      <span className="font-medium">{euros(z.caisse.compte)}</span>
                    </div>
                    <div className={`flex justify-between font-bold ${couleur}`}>
                      <span>Écart · {ecart.libelle}</span>
                      <span>{ecartSigne(ecart.e)}</span>
                    </div>
                  </>
                )
              })() : (
                <p className="no-print text-xs text-gray-500 pt-1">
                  Caisse non comptée : onglet Caisse → Compter la caisse.
                </p>
              )}
              {z.caisse.fond_initial === null && (
                <p className="no-print text-xs text-gray-500 pt-1">
                  Fond de caisse non saisi pour ce jour : ajoutez-le dans l'onglet Caisse.
                </p>
              )}
            </div>

            <div className="text-center text-[11px] text-gray-400 border-t border-dashed border-gray-200 pt-2">
              Édité le {dateCourte(z.edite_le.date)} à {z.edite_le.heure} · récapitulatif non certifié
            </div>
          </div>
        )}

        {z && (
          <div className="no-print grid grid-cols-2 gap-2">
            <button onClick={partager} className="btn-primary inline-flex items-center justify-center gap-2">
              <IconShare size={18} />Partager
            </button>
            <button onClick={() => window.print()} className="btn-secondary inline-flex items-center justify-center gap-2">
              <IconPrinter size={18} />Imprimer / PDF
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
