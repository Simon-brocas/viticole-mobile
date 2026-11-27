/**
 * Aides à la saisie des remises — fonctions pures, testables sous Node
 * (voir test/smoke.mjs).
 */

const centimes = x => Math.round(x * 100)

/**
 * Prix ronds proposés sous un prix remisé, pour éviter de rendre des
 * centimes : 15.27 → [15.20, 15.00]. Seuls les prix strictement inférieurs
 * et positifs sont proposés, sans doublon.
 */
export function prixArrondis(prix) {
  const c = centimes(prix)
  const out = []
  for (const pas of [10, 100]) {
    const v = Math.floor(c / pas) * pas
    if (v > 0 && v < c && !out.includes(v)) out.push(v)
  }
  return out.map(v => v / 100)
}
