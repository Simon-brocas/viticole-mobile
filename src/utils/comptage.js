/**
 * Comptage de caisse : libellés des coupures et lecture de l'écart —
 * fonctions pures, testables sous Node (voir test/smoke.mjs).
 */
import { COUPURES } from '../db/operations.js'

export { COUPURES }

/** Coupures regroupées pour l'affichage : billets puis pièces. */
export const GROUPES = [
  { titre: 'Billets', coupures: COUPURES.filter(c => c >= 500) },
  { titre: 'Pièces', coupures: COUPURES.filter(c => c < 500) },
]

/** 2000 → « 20 € », 50 → « 0,50 € », 5 → « 0,05 € » */
export function libelleCoupure(centimes) {
  return centimes % 100 === 0
    ? `${centimes / 100} €`
    : `${Math.floor(centimes / 100)},${String(centimes % 100).padStart(2, '0')} €`
}

/** Total en € d'un détail { centimes: nombre } (saisie en cours, non validée). */
export function totalDetail(detail) {
  return Object.entries(detail).reduce((s, [c, n]) => s + Number(c) * (Number(n) || 0), 0) / 100
}

/** Lecture de l'écart compté − théorique (arrondi au centime). */
export function lireEcart(ecart) {
  if (ecart === null || ecart === undefined) return null
  const e = Math.round(ecart * 100) / 100
  if (Math.abs(e) < 0.005) return { e: 0, libelle: 'Caisse juste', ton: 'ok' }
  return e > 0
    ? { e, libelle: 'Excédent', ton: 'plus' }
    : { e, libelle: 'Manquant', ton: 'moins' }
}

/** Écart signé : « +1.20 € », « −3.50 € », « 0.00 € » */
export function ecartSigne(e) {
  if (Math.abs(e) < 0.005) return '0.00 €'
  return `${e > 0 ? '+' : '−'}${Math.abs(e).toFixed(2)} €`
}
