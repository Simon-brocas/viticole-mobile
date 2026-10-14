/**
 * Bases d'exemple des tests navigateur, construites avec la logique métier
 * de l'app (src/db/operations.js) dans une base sql.js en mémoire.
 */
import initSqlJs from 'sql.js'
import sharp from 'sharp'
import * as ops from '../../src/db/operations.js'

const SQL = await initSqlJs()

function nouvelleBase() {
  const d = new SQL.Database()
  ops.initSchema(d)
  return d
}

function articles(d, salon, liste) {
  const ids = {}
  for (const [nom, prix, categorie = '', stock = 0, extra = {}] of liste) {
    ids[nom] = ops.createProduit(d, { nom, prix, categorie, ...extra }).id
    if (stock) ops.updateSalonProduit(d, salon, ids[nom], { selectionne: 1, stock_initial: stock, stock_restant: stock })
  }
  return ids
}

/** Image JPEG bruitée (taille réaliste, ~150 Ko). */
export const jpeg = async gris => new Uint8Array(await sharp({
  create: { width: 600, height: 400, channels: 3, noise: { type: 'gaussian', mean: gris, sigma: 40 } },
}).jpeg({ quality: 90 }).toBuffer())

/** Ancien format : photos dans la base, pas d'index (téléphone d'avant les photos séparées). */
export async function baseAnciennePhotos() {
  const d = nouvelleBase()
  d.exec('DROP INDEX idx_ventes_salon_date; DROP INDEX idx_ventes_salon_produit')
  const s = ops.createSalon(d, { nom: 'Ancien' }).id
  const ids = articles(d, s, [['Rouge', 9.9, '', 10], ['Blanc', 8, '', 10]])
  const photo = await jpeg(90)
  d.run('UPDATE produits SET photo = ?, photo_updated = ? WHERE id = ?', [photo, '1', ids.Rouge])
  d.run('UPDATE salons SET photo = ?, photo_updated = ? WHERE id = ?', [await jpeg(60), '1', s])
  return { bytes: d.export(), photo }
}

/** Deux jours de ventes (hier, aujourd'hui) avec carton, mixte, chèque, dégustation, offert, fond de caisse. */
export function baseDeuxJours() {
  const d = nouvelleBase()
  const today = ops.localDate(), hier = ops.localDate(new Date(Date.now() - 864e5))
  const s = ops.createSalon(d, { nom: 'Salon des vins', lieu: 'Tours' }).id
  const ids = articles(d, s, [
    ['Chinon rouge 2022', 9.9, '', 100, { carton_taille: 6, carton_prix: 54 }],
    ['Vouvray sec', 12.5, '', 100], ['Crémant de Loire', 14, '', 100]])
  const [r, b, c] = Object.values(ids)
  ops.ajouterVente(d, s, { date: hier, heure: '15:00', items: [{ produit_id: c, quantite: 2 }], mode_paiement: 'CB' })
  ops.ajouterVente(d, s, { date: today, heure: '09:15', mode_paiement: 'Especes', items: [{ produit_id: r, quantite: 3 }] })
  ops.ajouterVente(d, s, { date: today, heure: '11:40', mode_paiement: 'Mixte', montant_especes: 20, montant_cb: 46.5,
    items: [{ produit_id: r, quantite: 1, unite: 'carton' }, { produit_id: b, quantite: 1 }] })
  ops.ajouterVente(d, s, { date: today, heure: '14:20', mode_paiement: 'Cheque', items: [{ produit_id: c, quantite: 2 }, { produit_id: b, quantite: 2 }] })
  ops.ajouterVente(d, s, { date: today, heure: '17:05', items: [
    { produit_id: b, quantite: 1.5, type_quantite: 'degustation' }, { produit_id: r, quantite: 1, type_quantite: 'offert' }] })
  ops.setCaisse(d, s, { date: today, montant_initial: 150 })
  return d.export()
}

/** Trois articles et une ligne saisie sur le PC (sans ticket) ce matin. */
export function baseTickets() {
  const d = nouvelleBase()
  const today = ops.localDate()
  const s = ops.createSalon(d, { nom: 'Salon des vins', lieu: 'Tours' }).id
  const ids = articles(d, s, [['Chinon rouge 2022', 9.9, '', 100], ['Vouvray sec', 12.5, '', 100], ['Crémant de Loire', 14, '', 100]])
  d.run(`INSERT INTO ventes (salon_id, produit_id, type_quantite, quantite, unite, nb_bouteilles, prix_unitaire,
         mode_paiement, total, date, heure, sync_id) VALUES (?, ?, 'normal', 2, 'bouteille', 2, 14, 'CB', 28, ?, '08:30', 'pc-1')`,
    [s, ids['Crémant de Loire'], today])
  d.run('UPDATE salon_produits SET stock_restant = 98 WHERE produit_id = ?', [ids['Crémant de Loire']])
  ops.setCaisse(d, s, { date: today, montant_initial: 100 })
  return d.export()
}

/** Cinq articles en trois catégories (+ un sans), un déjà sous le seuil. */
export function baseCategories() {
  const d = nouvelleBase()
  const s = ops.createSalon(d, { nom: 'Salon des vins', lieu: 'Tours' }).id
  articles(d, s, [
    ['Chinon rouge', 9.9, 'Rouges', 7], ['Saumur-Champigny', 11, 'Rouges', 30], ['Vouvray sec', 12.5, 'Blancs', 3],
    ['Crémant de Loire', 14, 'Bulles', 20], ['Jus de raisin', 4, '', 40]])
  return d.export()
}

/** Salon avec une vente et un seuil réglé (duplication) ; Jus de raisin non sélectionné. */
export function baseDuplication() {
  const d = nouvelleBase()
  const s = ops.createSalon(d, { nom: 'Salon des vins', lieu: 'Tours' }).id
  const ids = articles(d, s, [
    ['Chinon rouge', 9.9, 'Rouges', 12], ['Saumur-Champigny', 11, 'Rouges', 30], ['Vouvray sec', 12.5, 'Blancs', 8],
    ['Crémant de Loire', 14, 'Bulles', 20], ['Jus de raisin', 4, '', 0]])
  ops.updateSalonProduit(d, s, ids['Chinon rouge'], { selectionne: 1, stock_initial: 12, stock_restant: 12, seuil_alerte: 6 })
  ops.ajouterVente(d, s, { mode_paiement: 'CB', items: [{ produit_id: ids['Chinon rouge'], quantite: 5 }] })
  return d.export()
}

/** CSV tel qu'Excel France l'enregistre : Windows-1252, séparateur « ; ». */
export function csvExcelFrance() {
  const csv = 'Désignation;Prix;Famille;Colisage;Prix carton;Stock\r\n' +
    'chinon ROUGE;10,50;Rouges;6;57;\r\n' +
    'Sancerre blanc;15,00 €;Blancs;;;12\r\n' +
    'Crémant de Loire;14;Bulles;;;\r\n' +
    'Rosé sans prix;;Rosés;;;\r\n'
  return Buffer.from(Uint8Array.from(csv, c => (c === '€' ? 0x80 : c.charCodeAt(0))))
}

/** Grand salon : n tickets répartis sur deux jours (pagination du Récap). */
export function baseGrandSalon(n = 130) {
  const d = nouvelleBase()
  const s = ops.createSalon(d, { nom: 'Grand salon' }).id
  const { Vin } = articles(d, s, [['Vin', 10, '', 100000]])
  const today = ops.localDate(), hier = ops.localDate(new Date(Date.now() - 864e5))
  for (let i = 0; i < n; i++) {
    const date = i < 30 ? hier : today
    const min = i % 600
    const heure = `${String(8 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    ops.ajouterVente(d, s, { date, heure, mode_paiement: 'CB', items: [{ produit_id: Vin, quantite: 1 + (i % 3) }] })
  }
  return d.export()
}
