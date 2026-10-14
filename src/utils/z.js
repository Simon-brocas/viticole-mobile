/**
 * Mise en forme du Z de caisse (données de ops.getZ) — fonctions pures,
 * testables sous Node (voir test/smoke.mjs).
 */
import { lireEcart, ecartSigne } from './comptage.js'

export const euros = v => `${(v ?? 0).toFixed(2)} €`

/** 'AAAA-MM-JJ' → « mardi 14 octobre 2026 » (date locale, pas d'écart UTC). */
export function dateLongue(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** 'AAAA-MM-JJ' → 'JJ/MM/AAAA' */
export const dateCourte = iso => iso.split('-').reverse().join('/')

/** Écart compté − théorique : « 0.00 € (caisse juste) », « −3.50 € (manquant) » */
function ecartTexte(ecart) {
  const { e, libelle } = lireEcart(ecart)
  return `${ecartSigne(e)} (${libelle.toLowerCase()})`
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Quantités d'une ligne article : « 12 unités dont 2 cartons · 1 dégust. » */
export function detailArticle(a) {
  const parts = []
  if (a.unites > 0) parts.push(pluriel(a.unites, 'unité') + (a.cartons > 0 ? ` dont ${pluriel(a.cartons, 'carton')}` : ''))
  if (a.degustations > 0) parts.push(`${a.degustations} dégust.`)
  if (a.offerts > 0) parts.push(pluriel(a.offerts, 'offert'))
  return parts.join(' · ')
}

/** Version texte du Z, pour la feuille de partage (WhatsApp, mail, SMS…). */
export function zTexte(z) {
  const { salon, stats, caisse } = z
  const lignes = [
    `Z DE CAISSE — ${salon.nom}${salon.lieu ? ` (${salon.lieu})` : ''}`,
    dateLongue(z.date),
    z.nb_lignes > 0 ? `Ventes de ${z.premiere} à ${z.derniere}` : 'Aucune vente ce jour',
    '',
    `Chiffre d'affaires : ${euros(stats.total_global)}`,
    `- Espèces : ${euros(stats.total_especes)}`,
    `- CB : ${euros(stats.total_cb)}`,
    `- Chèque : ${euros(stats.total_cheque)}`,
    '',
    `Unités vendues : ${stats.nb_unites}${stats.nb_cartons > 0 ? ` (dont ${pluriel(stats.nb_cartons, 'carton')})` : ''}`,
    `Dégustations : ${stats.nb_degustations} · Offerts : ${stats.nb_offerts}`,
  ]
  if (z.tickets?.nb > 0) {
    lignes.push(
      `Tickets : ${z.tickets.nb}${z.tickets.nb_annules > 0 ? ` (+ ${z.tickets.nb_annules} annulé${z.tickets.nb_annules > 1 ? 's' : ''})` : ''}`
        + (z.tickets.moyen !== null ? ` · ticket moyen ${euros(z.tickets.moyen)}` : ''),
      `Remises accordées : ${euros(z.tickets.remises)}`,
    )
  }
  if (z.articles.length > 0) {
    lignes.push('', 'Détail par article :')
    for (const a of z.articles) {
      lignes.push(`- ${a.nom} : ${detailArticle(a)}${a.total > 0 ? ` — ${euros(a.total)}` : ''}`)
    }
  }
  lignes.push(
    '',
    'Caisse espèces :',
    `- Fond initial : ${caisse.fond_initial === null ? 'non saisi' : euros(caisse.fond_initial)}`,
    `- Espèces encaissées : ${euros(caisse.especes)}`,
    `- Solde théorique : ${euros(caisse.solde_theorique)}`,
    ...(caisse.compte !== null && caisse.compte !== undefined ? [
      `- Espèces comptées : ${euros(caisse.compte)}${caisse.compte_heure ? ` (${caisse.compte_heure})` : ''}`,
      `- Écart : ${ecartTexte(caisse.ecart)}`,
    ] : ['- Caisse non comptée']),
    '',
    `Édité le ${dateCourte(z.edite_le.date)} à ${z.edite_le.heure}`,
  )
  return lignes.join('\n')
}
