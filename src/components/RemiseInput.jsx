import { normaliserRemise, montantRemise } from '../db/operations'

/** Saisie en cours ({ type, valeur: texte }) → remise prête pour le calcul, ou null. */
export function remiseSaisie(r) {
  if (!r || r.valeur === '' || r.valeur === undefined) return null
  return { type: r.type, valeur: parseFloat(String(r.valeur).replace(',', '.')) }
}

/** Montant de la remise saisie sur une base, ou le message d'erreur. */
export function evaluerRemise(r, base, quoi) {
  try {
    return { montant: montantRemise(normaliserRemise(remiseSaisie(r)), base, quoi), erreur: '' }
  } catch (e) {
    return { montant: 0, erreur: e.message }
  }
}

/**
 * Remise en % ou en € : [Aucune] [%] [€] + montant.
 * value : null | { type: 'pct' | 'eur', valeur: texte }
 */
export default function RemiseInput({ id, value, onChange, base, quoi }) {
  const type = value?.type ?? null
  const { montant, erreur } = evaluerRemise(value, base, quoi)
  const choix = [
    { key: null, label: 'Aucune' },
    { key: 'pct', label: '%' },
    { key: 'eur', label: '€' },
  ]
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex bg-gray-100 rounded-xl p-0.5 shrink-0" role="group" aria-label="Type de remise">
          {choix.map(c => (
            <button key={c.label} type="button" aria-pressed={type === c.key}
              onClick={() => onChange(c.key ? { type: c.key, valeur: value?.valeur ?? '' } : null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors
                ${type === c.key ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'}`}>
              {c.label}
            </button>
          ))}
        </div>
        {type && (
          <div className="relative flex-1">
            <input id={id} type="text" inputMode="decimal" autoFocus
              aria-label={type === 'pct' ? 'Remise en pourcentage' : 'Remise en euros'}
              className="input py-1.5 text-right pr-8" placeholder="0"
              value={value.valeur}
              onChange={e => onChange({ type, valeur: e.target.value.replace(/[^\d.,]/g, '') })} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              {type === 'pct' ? '%' : '€'}
            </span>
          </div>
        )}
      </div>
      {type && (erreur
        ? <p role="alert" className="text-xs text-red-600">{erreur}</p>
        : montant > 0 && <p className="text-xs text-rose-600 text-right">−{montant.toFixed(2)} €</p>)}
    </div>
  )
}
