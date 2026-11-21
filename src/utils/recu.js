/**
 * Mise en forme des tickets (reçu) et des remises — fonctions pures,
 * testables sous Node (voir test/smoke.mjs).
 */
import { euros, dateCourte, tauxTexte } from './z.js'
import { ventilerTva } from '../db/operations.js'

export const MODES = { Especes: 'Espèces', CB: 'CB', Cheque: 'Chèque', Mixte: 'Mixte' }

/** { type: 'pct', valeur: 10 } → « −10 % » ; 'eur' 5 → « −5.00 € » ; 'prix' 25 → « prix 25.00 € » */
export function libelleRemise(remise) {
  if (!remise) return ''
  if (remise.type === 'prix') return `prix ${euros(remise.valeur)}`
  return remise.type === 'pct' ? `−${remise.valeur} %` : `−${remise.valeur.toFixed(2)} €`
}

/** Intitulé d'une remise sur le reçu : « Remise −10 % », « Remise ticket (prix 50.00 €) » */
export function texteRemise(prefixe, remise) {
  return remise?.type === 'prix' ? `${prefixe} (${libelleRemise(remise)})` : `${prefixe} ${libelleRemise(remise)}`
}

/**
 * TVA d'un ticket, ventilée par taux (montants TTC nets de remise).
 * null pour un ticket antérieur à la TVA (lignes sans taux figé).
 */
export function tvaTicket(t) {
  const payantes = t.lignes.filter(l => l.type === 'normal' && l.total > 0)
  if (payantes.length === 0 || payantes.some(l => l.taux_tva === undefined || l.taux_tva === null)) return null
  return ventilerTva(payantes.map(l => ({ taux: l.taux_tva, ttc: l.total })))
}

/** Quantité d'une ligne du reçu : « 3 × 9.90 € », « 1 carton de 6 × 54.00 € », « dégustation × 0.5 » */
export function quantiteLigne(l) {
  if (l.type === 'degustation') return `dégustation × ${l.quantite}`
  if (l.type === 'offert') return `offert × ${l.quantite}`
  if (l.unite === 'carton') {
    return `${l.quantite} carton${l.quantite > 1 ? 's' : ''}${l.carton_taille ? ` de ${l.carton_taille}` : ''} × ${euros(l.prix_unitaire)}`
  }
  return `${l.quantite} × ${euros(l.prix_unitaire)}`
}

/** Détail du paiement : « Espèces · remis 50.00 € · rendu 7.70 € », « Mixte · espèces 10.00 € · CB 5.00 € » */
export function paiementTexte(t) {
  if (!t.mode_paiement) return 'Sans paiement'
  if (t.mode_paiement === 'Mixte') {
    return ['Mixte',
      t.montant_especes > 0 && `espèces ${euros(t.montant_especes)}`,
      t.montant_cb > 0 && `CB ${euros(t.montant_cb)}`,
      t.montant_cheque > 0 && `chèque ${euros(t.montant_cheque)}`].filter(Boolean).join(' · ')
  }
  if (t.mode_paiement === 'Especes' && t.montant_remis !== null && t.montant_remis !== undefined) {
    return `Espèces · remis ${euros(t.montant_remis)} · rendu ${euros(t.rendu)}`
  }
  return MODES[t.mode_paiement] ?? t.mode_paiement
}

/** Version texte du reçu, pour la feuille de partage. */
export function recuTexte(t) {
  const lignes = [
    `${t.salon.nom}${t.salon.lieu ? ` — ${t.salon.lieu}` : ''}`,
    `Ticket n°${t.numero} · ${dateCourte(t.date)} à ${t.heure}`,
  ]
  if (t.annule) lignes.push(`*** TICKET ANNULÉ (${t.annule_le}) ***`)
  lignes.push('')
  for (const l of t.lignes) {
    lignes.push(`${l.nom}`)
    lignes.push(`  ${quantiteLigne(l)}${l.type === 'normal' ? ` = ${euros(l.brut)}` : ''}`)
    if (l.remise) lignes.push(`  ${texteRemise('Remise', l.remise)} : −${euros(l.remise_ligne)}`)
  }
  lignes.push('')
  if (t.remise_lignes > 0 || t.remise_ticket > 0) {
    lignes.push(`Sous-total : ${euros(t.total_brut)}`)
    if (t.remise_lignes > 0) lignes.push(`Remises articles : −${euros(t.remise_lignes)}`)
    if (t.remise_ticket > 0) {
      const r = { type: t.remise_ticket_type, valeur: t.remise_ticket_valeur }
      lignes.push(`${texteRemise('Remise ticket', r)} : −${euros(t.remise_ticket)}`)
    }
  }
  lignes.push(`TOTAL : ${euros(t.total)}`)
  const tva = tvaTicket(t)
  if (tva) {
    for (const v of tva.taux) lignes.push(`dont TVA ${tauxTexte(v.taux)} : ${euros(v.tva)} (HT ${euros(v.ht)})`)
  }
  lignes.push(`Paiement : ${paiementTexte(t)}`, '', 'Merci de votre visite !')
  return lignes.join('\n')
}
