/**
 * Montants suggérés pour un paiement en espèces : arrondis supérieurs
 * (5, 10, 20, 50, 100 €) et billets, strictement au-dessus du total.
 * Ex : 26.70 € → 30, 40, 50 · 9.90 € → 10, 20, 50 · 50 € → 60, 100, 200
 */
const PALIERS = [5, 10, 20, 50, 100]
const BILLETS = [5, 10, 20, 50, 100, 200]

export function suggestionsEspeces(total, max = 3) {
  if (!(total > 0)) return []
  const candidats = [
    ...PALIERS.map(p => Math.ceil(total / p) * p),
    ...BILLETS,
  ].filter(v => v > total + 0.005)
  return [...new Set(candidats)].sort((a, b) => a - b).slice(0, max)
}
