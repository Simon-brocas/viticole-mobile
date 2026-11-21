import { euros, tauxTexte } from '../utils/z'

/**
 * Ventilation de la TVA par taux (ops.ventilerTva) : HT, TVA, TTC.
 * total : ajoute une ligne de total quand il y a plusieurs taux.
 */
export default function TableTva({ tva, total = false, className = '' }) {
  if (!tva || tva.taux.length === 0) return null
  return (
    <table className={`w-full tabular-nums ${className}`} aria-label="TVA par taux">
      <thead>
        <tr>
          <th className="text-left font-medium">TVA</th>
          <th className="text-right font-medium">HT</th>
          <th className="text-right font-medium">TVA</th>
          <th className="text-right font-medium">TTC</th>
        </tr>
      </thead>
      <tbody>
        {tva.taux.map(v => (
          <tr key={v.taux}>
            <td>{tauxTexte(v.taux)}</td>
            <td className="text-right">{euros(v.ht)}</td>
            <td className="text-right">{euros(v.tva)}</td>
            <td className="text-right">{euros(v.ttc)}</td>
          </tr>
        ))}
        {total && tva.taux.length > 1 && (
          <tr className="font-semibold border-t border-gray-200">
            <td>Total</td>
            <td className="text-right">{euros(tva.ht)}</td>
            <td className="text-right">{euros(tva.tva)}</td>
            <td className="text-right">{euros(tva.ttc)}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
