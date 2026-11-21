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

const LIBELLES = {
  pct: 'Remise en pourcentage',
  eur: 'Remise en euros',
  prix: 'Prix après remise',
}

/**
 * Remise en %, en €, ou par le prix final : [Aucune] [%] [€] [Prix] + montant.
 * En mode Prix, on saisit ce que le client paie (pour la ligne ou le ticket)
 * et la remise est calculée.
 * value : null | { type: 'pct' | 'eur' | 'prix', valeur: texte }
 */
export default function RemiseInput({ id, value, onChange, base, quoi }) {
  const type = value?.type ?? null
  const { montant, erreur } = evaluerRemise(value, base, quoi)
  const choix = [
    { key: null, label: 'Aucune' },
    { key: 'pct', label: '%' },
    { key: 'eur', label: '€' },
    { key: 'prix', label: 'Prix' },
  ]
  // Un montant de remise n'a pas de sens comme prix (et inversement) : on repart de zéro
  const changerType = key => {
    if (!key) return onChange(null)
    const garder = (key === 'prix') === (type === 'prix')
    onChange({ type: key, valeur: garder ? value?.valeur ?? '' : '' })
  }
  const pct = base > 0 ? Math.round(montant / base * 1000) / 10 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex bg-gray-100 rounded-xl p-0.5 shrink-0" role="group" aria-label="Type de remise">
          {choix.map(c => (
            <button key={c.label} type="button" aria-pressed={type === c.key}
              onClick={() => changerType(c.key)}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors
                ${type === c.key ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500'}`}>
              {c.label}
            </button>
          ))}
        </div>
        {type && (
          <div className="relative flex-1 min-w-0">
            <input id={id} type="text" inputMode="decimal" autoFocus
              aria-label={LIBELLES[type]}
              className="input py-1.5 text-right pr-8" placeholder={type === 'prix' ? base.toFixed(2) : '0'}
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
        : type === 'prix'
          ? <p className="text-xs text-gray-500 text-right">
              {value.valeur === ''
                ? 'Prix final payé par le client : la remise est calculée'
                : montant > 0
                  ? <span className="text-rose-600">soit une remise de {montant.toFixed(2)} € (−{String(pct).replace('.', ',')} %)</span>
                  : 'Aucune remise : prix identique'}
            </p>
          : montant > 0 && <p className="text-xs text-rose-600 text-right">−{montant.toFixed(2)} €</p>)}
    </div>
  )
}
