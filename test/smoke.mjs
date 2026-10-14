/**
 * Test de bout en bout de la logique métier (portage de backend/smoke_test.py).
 * S'exécute sous Node sur une base en mémoire : npm test
 */
import initSqlJs from 'sql.js'
import * as ops from '../src/db/operations.js'
import { verifyPassword, hashPassword } from '../src/db/auth.js'
import { backupsToDelete } from '../src/db/backups.js'
import { suggestionsEspeces } from '../src/utils/especes.js'
import { reconcilierPanier } from '../src/utils/panier.js'
import { zTexte, detailArticle, dateLongue } from '../src/utils/z.js'
import { libelleCoupure, totalDetail, lireEcart, ecartSigne, GROUPES } from '../src/utils/comptage.js'
import { libelleRemise, quantiteLigne, paiementTexte, recuTexte } from '../src/utils/recu.js'
import { niveauStock, categoriesDe, filtrerProduits, alertesFranchies, messageAlertes, SANS_CATEGORIE, STOCK_BAS } from '../src/utils/stock.js'

let passed = 0
let failed = 0

function ok(cond, label) {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function throws(fn, label, match) {
  try {
    fn()
    failed++
    console.error(`  ✗ ${label} (aucune erreur levée)`)
  } catch (e) {
    const okMsg = !match || String(e.message).includes(match)
    if (okMsg) {
      passed++
      console.log(`  ✓ ${label}`)
    } else {
      failed++
      console.error(`  ✗ ${label} (message inattendu : ${e.message})`)
    }
  }
}

const SQL = await initSqlJs()
const db = new SQL.Database()

console.log('— Schéma et compte admin')
ops.initSchema(db)
await ops.ensureAdmin(db, hashPassword)
ok((await ops.authStatus(db, verifyPassword)).default_password === true, 'mot de passe par défaut détecté')

console.log('— Authentification')
await ops.login(db, verifyPassword, 'admin123')
ok(true, 'login admin123')
try {
  await ops.login(db, verifyPassword, 'mauvais')
  ok(false, 'login refusé avec mauvais mot de passe')
} catch {
  ok(true, 'login refusé avec mauvais mot de passe')
}
await ops.changePassword(db, { verifyPassword, hashPassword }, 'admin123', 'nouveau1')
await ops.login(db, verifyPassword, 'nouveau1')
ok(true, 'changement de mot de passe + login')
// hash werkzeug scrypt (généré par le desktop) vérifiable ici
const scryptHash = 'scrypt:32768:8:1$giLPJ4oEiNHTA2CE$3384761b021f82376515b2f7fc51c9fa2ef9966ebe0398da54fe0f0ef9cc1c25ed385b0c0a968e92980c3d308fce925854a436729be27dc0695809bd04fd9e0f'
ok(await verifyPassword(scryptHash, 'admin123') === true, 'hash scrypt werkzeug vérifié (compat desktop)')

console.log('— Produits')
const p1 = ops.createProduit(db, { nom: 'Chinon Rouge', prix: 8.5 })
const p2 = ops.createProduit(db, { nom: 'Vouvray Blanc', prix: 6, carton_taille: 6, carton_prix: 34 })
throws(() => ops.createProduit(db, { nom: '', prix: 5 }), 'nom obligatoire')
throws(() => ops.createProduit(db, { nom: 'X', prix: -2 }), 'prix négatif refusé')
throws(() => ops.createProduit(db, { nom: 'X', prix: 5, carton_taille: 6 }), 'carton incomplet refusé')
throws(() => ops.createProduit(db, { nom: 'X', prix: 5, carton_taille: 1, carton_prix: 10 }), 'carton < 2 refusé')
ok(ops.getProduits(db).length === 2, '2 produits actifs')

console.log('— Salon et stocks')
const salon = ops.createSalon(db, { nom: 'Salon de Tours', lieu: 'Tours', date_debut: '2026-07-25', date_fin: '2026-07-27' })
throws(() => ops.createSalon(db, { nom: '  ' }), 'nom de salon obligatoire')
const sid = salon.id
ok(ops.getSalonProduits(db, sid).length === 2, 'produits liés au salon à la création')
ops.updateSalonProduit(db, sid, p1.id, { selectionne: 1, stock_initial: 24, stock_restant: 24 })
ops.updateSalonProduit(db, sid, p2.id, { selectionne: 1, stock_initial: 60, stock_restant: 60 })
throws(() => ops.updateSalonProduit(db, sid, p1.id, { selectionne: 1, stock_initial: -1, stock_restant: 0 }),
  'stock négatif refusé')

console.log('— Ventes : validations')
throws(() => ops.ajouterVente(db, sid, { items: [] }), 'panier vide refusé')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 2 }], mode_paiement: 'Bitcoin',
}), 'mode de paiement invalide refusé')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 1.5 }], mode_paiement: 'CB',
}), 'quantité non entière refusée (vente normale)')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 0.3, type_quantite: 'degustation' }],
}), 'dégustation non multiple de 0.5 refusée')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 1, unite: 'carton' }], mode_paiement: 'CB',
}), 'carton sans définition refusé', 'Pas de carton')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 2 }], mode_paiement: 'Especes', montant_remis: 10,
}), 'espèces insuffisantes refusées', 'insuffisant')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 2 }], mode_paiement: 'Mixte',
  montant_especes: 10, montant_cb: 5, montant_cheque: 0,
}), 'total mixte incorrect refusé', 'ne correspond pas')
throws(() => ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 100 }], mode_paiement: 'CB',
}), 'stock insuffisant refusé', 'Stock insuffisant')

console.log('— Ventes : cas nominaux')
let r = ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 2, sync_id: 'v1' }],
  mode_paiement: 'Especes', montant_remis: 20,
})
ok(r.total === 17, 'vente espèces : total 17 €')
r = ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 2, sync_id: 'v1' }],
  mode_paiement: 'Especes', montant_remis: 20,
})
ok(r.duplicate === true, 'doublon sync_id ignoré (idempotence)')
ops.ajouterVente(db, sid, {
  items: [
    { produit_id: p1.id, quantite: 1, sync_id: 'v2a' },   // 8.50
    { produit_id: p2.id, quantite: 1, unite: 'carton', sync_id: 'v2b' }, // 34.00
  ],
  mode_paiement: 'Mixte', montant_especes: 20, montant_cb: 22.5, montant_cheque: 0,
})
ok(true, 'panier mixte bouteille + carton accepté')
ops.ajouterVente(db, sid, {
  items: [{ produit_id: p2.id, quantite: 1.5, type_quantite: 'degustation', sync_id: 'v3' }],
})
ops.ajouterVente(db, sid, {
  items: [{ produit_id: p1.id, quantite: 1, type_quantite: 'offert', sync_id: 'v4' }],
})
ok(true, 'dégustation 1.5 et offert acceptés sans paiement')

console.log('— Stocks après ventes')
const sp = Object.fromEntries(ops.getSalonProduits(db, sid).map(x => [x.produit_id, x]))
ok(sp[p1.id].stock_restant === 24 - 2 - 1 - 1, `Chinon restant = 20 (obtenu ${sp[p1.id].stock_restant})`)
ok(sp[p2.id].stock_restant === 60 - 6 - 1.5, `Vouvray restant = 52.5 (obtenu ${sp[p2.id].stock_restant})`)

console.log('— Stats')
const stats = ops.getStats(db, sid)
ok(stats.total_global === 17 + 8.5 + 34, `CA global 59.50 (obtenu ${stats.total_global})`)
ok(stats.total_especes === 17 + 20, `espèces 37.00 (obtenu ${stats.total_especes})`)
ok(stats.total_cb === 22.5, `CB 22.50 (obtenu ${stats.total_cb})`)
ok(stats.total_cheque === 0, 'chèque 0')
ok(stats.nb_unites === 2 + 1 + 6, `unités vendues 9 (obtenu ${stats.nb_unites})`)
ok(stats.nb_cartons === 1, 'cartons vendus 1')
ok(stats.nb_degustations === 1.5, 'dégustations 1.5')
ok(stats.nb_offerts === 1, 'offerts 1')

console.log('— Répartition mixte (prorata au centime)')
const parts = ops.prorate(42.5, [8.5, 34])
ok(Math.abs(parts[0] + parts[1] - 42.5) < 1e-9, 'somme des parts = montant')
const ventesMixte = ops.getVentes(db, sid).filter(v => v.mode_paiement === 'Mixte')
const sumEsp = ventesMixte.reduce((s, v) => s + v.montant_especes, 0)
const sumCb = ventesMixte.reduce((s, v) => s + v.montant_cb, 0)
ok(Math.abs(sumEsp - 20) < 1e-9, `parts espèces mixte = 20 (obtenu ${sumEsp})`)
ok(Math.abs(sumCb - 22.5) < 1e-9, `parts CB mixte = 22.5 (obtenu ${sumCb})`)

console.log('— Fond de caisse')
const today = new Date()
const pad = n => String(n).padStart(2, '0')
const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
ops.setCaisse(db, sid, { date: dateStr, montant_initial: 150 })
throws(() => ops.setCaisse(db, sid, { date: '2026-13-45', montant_initial: 10 }), 'date invalide refusée')
throws(() => ops.setCaisse(db, sid, { date: dateStr, montant_initial: -5 }), 'fond négatif refusé')
const caisse = ops.getCaisse(db, sid)
ok(caisse.length === 1, '1 jour de caisse')
ok(caisse[0].especes_encaissees === 37, `espèces encaissées 37 (obtenu ${caisse[0].especes_encaissees})`)
ok(caisse[0].solde === 187, `solde 187 (obtenu ${caisse[0].solde})`)

console.log('— Annulation de ticket (restaure le stock)')
const vente = ops.getVentes(db, sid).find(v => v.sync_id === 'v1')
throws(() => ops.supprimerVente(db, sid, vente.id), 'ligne d’un ticket : suppression seule refusée', 'annulez le ticket')
const t1 = ops.getTickets(db, sid).find(t => t.lignes.some(l => l.vente_id === vente.id))
ok(t1.numero === 1 && t1.total === 17 && t1.lignes.length === 1, 'la vente v1 est le ticket n°1 (17 €)')
ops.annulerTicket(db, sid, t1.id)
const spAfter = Object.fromEntries(ops.getSalonProduits(db, sid).map(x => [x.produit_id, x]))
ok(spAfter[p1.id].stock_restant === 22, `stock restauré à 22 (obtenu ${spAfter[p1.id].stock_restant})`)
ok(ops.getStats(db, sid).total_global === 42.5, 'CA recalculé après annulation')
ok(ops.getTicket(db, sid, t1.id).annule === true && ops.getTicket(db, sid, t1.id).annule_le, 'ticket conservé, marqué annulé')
throws(() => ops.annulerTicket(db, sid, t1.id), 'double annulation refusée', 'déjà annulé')

console.log('— Suppression d’une ligne sans ticket (saisie sur le PC)')
db.run(`INSERT INTO ventes (salon_id, produit_id, type_quantite, quantite, unite, nb_bouteilles, prix_unitaire,
        mode_paiement, total, date, heure, sync_id) VALUES (?, ?, 'normal', 1, 'bouteille', 1, 8.5, 'CB', 8.5, ?, '12:00', 'pc1')`,
  [sid, p1.id, ops.localDate()])
db.run('UPDATE salon_produits SET stock_restant = stock_restant - 1 WHERE salon_id = ? AND produit_id = ?', [sid, p1.id])
const ligneSansTicket = ops.getVentesSansTicket(db, sid)
ok(ligneSansTicket.length === 1 && ligneSansTicket[0].sync_id === 'pc1', 'ligne sans ticket listée à part')
ops.supprimerVente(db, sid, ligneSansTicket[0].id)
ok(ops.getSalonProduits(db, sid).find(x => x.produit_id === p1.id).stock_restant === 22, 'suppression d’une ligne sans ticket : stock restauré')
ok(ops.getStats(db, sid).total_global === 42.5, 'CA inchangé après suppression de la ligne PC')

console.log('— Export : assemblage des données')
const exportData = ops.getExportData(db, sid)
ok(exportData.salon.nom === 'Salon de Tours', 'salon présent')
ok(exportData.ventes.length === ops.getVentes(db, sid).length, 'toutes les ventes présentes')
ok(exportData.salonProduits.length === 2, '2 produits en stock')
ok(exportData.caisse.length === 1, 'caisse présente')

console.log('— Photos')
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
ops.checkPhoto('produits', jpeg)
ops.setPhotoExterne(db, 'produits', p1.id)
ok(ops.getPhoto(db, 'produits', p1.id)?.length === 0, 'base : marqueur vide, image hors base')
ok(ops.getProduits(db).find(p => p.id === p1.id).has_photo === 1, 'has_photo = 1 avec le marqueur')
throws(() => ops.checkPhoto('produits', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])),
  'format non image refusé')
throws(() => ops.checkPhoto('ventes', jpeg), 'table photo inconnue refusée')
ops.deletePhoto(db, 'produits', p1.id)
ok(ops.getPhoto(db, 'produits', p1.id) === null, 'photo supprimée')

console.log('— Photos hors base : migration et export desktop')
{
  const d = new SQL.Database()
  ops.initSchema(d)
  const sa = ops.createSalon(d, { nom: 'A' }).id
  const pa = ops.createProduit(d, { nom: 'X', prix: 5 }).id
  const pb = ops.createProduit(d, { nom: 'Y', prix: 6 }).id
  // Base au format desktop : images dans la base
  d.run('UPDATE produits SET photo = ? WHERE id = ?', [jpeg, pa])
  d.run('UPDATE salons SET photo = ? WHERE id = ?', [jpeg, sa])
  const store = new Map()
  const list = ops.photosInternes(d)
  ok(list.length === 2, '2 photos internes détectées (salon + article)')
  for (const p of list) store.set(`${p.table}/${p.id}`, p.bytes)
  ops.externaliserPhotos(d, list)
  ok(ops.photosInternes(d).length === 0, 'plus aucune image dans la base après migration')
  ok(ops.getProduits(d).find(p => p.id === pa).has_photo === 1, 'has_photo conservé après migration')
  ok(ops.getProduits(d).find(p => p.id === pb).has_photo === 0, 'article sans photo inchangé')
  // Export vers le PC : copie de la base avec images réinjectées
  const copy = new SQL.Database(d.export())
  ops.internaliserPhotos(copy, (t, id) => store.get(`${t}/${id}`))
  const back = ops.getPhoto(copy, 'produits', pa)
  ok(back?.length === jpeg.length && back.every((b, i) => b === jpeg[i]), 'export : image réinjectée à l’identique')
  ok(ops.getPhoto(copy, 'salons', sa)?.length === jpeg.length, 'export : photo de salon réinjectée')
  ok(ops.getPhoto(d, 'produits', pa)?.length === 0, 'base courante non modifiée par l’export')
  // Marqueur sans image (ex. sauvegarde restaurée après suppression)
  store.delete(`salons/${sa}`)
  ops.retirerMarqueursOrphelins(d, (t, id) => store.has(`${t}/${id}`))
  ok(ops.getSalons(d).find(s => s.id === sa).has_photo === 0, 'marqueur orphelin retiré')
  ok(ops.getProduits(d).find(p => p.id === pa).has_photo === 1, 'marqueur valide conservé')
  const copy2 = new SQL.Database(d.export())
  store.delete(`produits/${pa}`)
  ops.internaliserPhotos(copy2, (t, id) => store.get(`${t}/${id}`))
  ok(ops.getPhoto(copy2, 'produits', pa) === null, 'export : image introuvable → NULL (pas de BLOB vide)')
  copy.close(); copy2.close(); d.close()
}

console.log('— Index des ventes')
const idx = ops.queryAll(db, "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ventes'").map(r => r.name)
ok(idx.includes('idx_ventes_salon_date') && idx.includes('idx_ventes_salon_produit'), 'index ventes créés')
const plan = ops.queryAll(db, 'EXPLAIN QUERY PLAN SELECT * FROM ventes WHERE salon_id = ? ORDER BY date DESC, heure DESC, id DESC', [1])
  .map(r => r.detail).join(' | ')
ok(plan.includes('idx_ventes_salon_date') && !plan.includes('TEMP B-TREE'), `liste des ventes servie par l'index, sans tri (${plan})`)

console.log('— Suppression de salon (soft delete)')
ops.updateSalon(db, sid, { nom: 'Salon de Tours', actif: 0 })
ok(ops.getSalons(db).find(s => s.id === sid).actif === 0, 'salon désactivé, données conservées')

console.log('— Arrondis et date locale')
ok(ops.round2(9.9 * 3) === 29.7, `3 × 9.90 arrondi à 29.70 (obtenu ${ops.round2(9.9 * 3)})`)
ok(ops.round2(16.3 * 6) === 97.8, '6 × 16.30 arrondi à 97.80')
ok(ops.localDate(new Date(2026, 9, 14, 0, 30)) === '2026-10-14', 'date locale à 00h30 = jour même')

console.log('— Conservation des sauvegardes')
const key = (day, h) => `viticole-2026-10-${String(day).padStart(2, '0')}-${String(h).padStart(2, '0')}-00-00`
// 20 jours avec 3 ouvertures par jour, puis 15 ouvertures le jour du salon
const keys = []
for (let d = 1; d <= 20; d++) for (const h of [8, 12, 18]) keys.push(key(d, h))
for (let h = 0; h < 15; h++) keys.push(`viticole-2026-10-21-09-${String(h).padStart(2, '0')}-00`)
keys.push('import-inconnu')
const del = new Set(backupsToDelete(keys))
const kept = keys.filter(k => !del.has(k))
ok(!del.has('import-inconnu'), 'clé au format inconnu jamais supprimée')
ok(kept.includes(key(20, 18)), 'la veille du salon est conservée malgré 15 ouvertures')
ok(kept.includes(key(8, 18)) && !kept.includes(key(7, 18)), '14 jours distincts conservés, pas plus')
ok(kept.filter(k => k.startsWith('viticole-2026-10-21')).length === 5, '5 dernières ouvertures conservées')
ok(kept.length === 5 + 13 + 1, `${kept.length} sauvegardes conservées (attendu 19)`)
ok(!kept.includes(key(20, 8)), 'seule la dernière sauvegarde d’un jour passé est gardée')
ok(backupsToDelete(['zeste-2026-10-01-08-00-00', 'viticole-2026-10-02-08-00-00'], 1, 1)[0] === 'zeste-2026-10-01-08-00-00',
  'tri chronologique indépendant du préfixe')

console.log('— Montants rapides espèces')
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const round = x => Math.round(x * 100) / 100
ok(eq(suggestionsEspeces(26.7), [30, 40, 50]), `26.70 → 30, 40, 50 (obtenu ${suggestionsEspeces(26.7)})`)
ok(eq(suggestionsEspeces(9.9), [10, 20, 50]), `9.90 → 10, 20, 50 (obtenu ${suggestionsEspeces(9.9)})`)
ok(eq(suggestionsEspeces(50), [60, 100, 200]), `50 → 60, 100, 200 (obtenu ${suggestionsEspeces(50)})`)
ok(eq(suggestionsEspeces(4.5), [5, 10, 20]), `4.50 → 5, 10, 20 (obtenu ${suggestionsEspeces(4.5)})`)
ok(eq(suggestionsEspeces(250), [260, 300]), `250 → 260, 300 (obtenu ${suggestionsEspeces(250)})`)
ok(eq(suggestionsEspeces(0), []), 'total nul : aucune suggestion')

console.log('— Reprise du panier')
const fiche = (id, extra = {}) => ({ produit_id: id, nom: `P${id}`, prix: 10, carton_taille: 6, carton_prix: 50, ...extra })
const brouillonPanier = [
  { key: 1, produit: fiche(1), type: 'normal', unite: 'bouteille', quantite: 2 },
  { key: 2, produit: fiche(2), type: 'normal', unite: 'carton', quantite: 1 },
  { key: 3, produit: fiche(3), type: 'offert', unite: 'bouteille', quantite: 1 },
]
const frais = [fiche(1, { prix: 12, stock_restant: 7 }), fiche(2, { carton_taille: null, carton_prix: null })]
const repris = reconcilierPanier(brouillonPanier, frais)
ok(repris.length === 1 && repris[0].key === 1, 'lignes impossibles retirées (article retiré, carton supprimé)')
ok(repris[0].produit.prix === 12 && repris[0].produit.stock_restant === 7, 'fiche article mise à jour (prix, stock)')

console.log('— Récap par jour et Z de caisse')
{
  const d = new SQL.Database()
  ops.initSchema(d)
  const sz = ops.createSalon(d, { nom: 'Salon Z', lieu: 'Tours' }).id
  const r = ops.createProduit(d, { nom: 'Rouge', prix: 9.9, carton_taille: 6, carton_prix: 54 }).id
  const b = ops.createProduit(d, { nom: 'Blanc', prix: 8 }).id
  for (const id of [r, b]) ops.updateSalonProduit(d, sz, id, { selectionne: 1, stock_initial: 100, stock_restant: 100 })
  const J1 = '2026-10-13', J2 = '2026-10-14'
  ops.ajouterVente(d, sz, { date: J1, heure: '10:00', items: [{ produit_id: r, quantite: 2 }], mode_paiement: 'CB' })
  ops.ajouterVente(d, sz, { date: J2, heure: '09:15', mode_paiement: 'Especes', montant_remis: 30,
    items: [{ produit_id: r, quantite: 3 }] })
  ops.ajouterVente(d, sz, { date: J2, heure: '11:40', mode_paiement: 'Mixte', montant_especes: 20, montant_cb: 42,
    items: [{ produit_id: r, quantite: 1, unite: 'carton' }, { produit_id: b, quantite: 1 }] })
  ops.ajouterVente(d, sz, { date: J2, heure: '16:05', items: [
    { produit_id: b, quantite: 1.5, type_quantite: 'degustation' }, { produit_id: r, quantite: 1, type_quantite: 'offert' }] })
  ops.setCaisse(d, sz, { date: J2, montant_initial: 150 })

  const tout = ops.getStats(d, sz)
  const j2 = ops.getStats(d, sz, J2)
  ok(tout.total_global === 111.5, `stats salon : 111.50 (obtenu ${tout.total_global})`)
  ok(j2.total_global === 91.7, `stats du 14 : 91.70 (obtenu ${j2.total_global})`)
  ok(j2.total_especes === 49.7 && j2.total_cb === 42 && j2.total_cheque === 0,
    `stats du 14 par mode : espèces 49.70, CB 42 (obtenu ${j2.total_especes} / ${j2.total_cb})`)
  ok(ops.getStats(d, sz, J1).total_global === 19.8, 'stats du 13 : 19.80')
  ok(ops.getStats(d, sz, '2026-10-20').total_global === 0, 'jour sans vente : 0')
  throws(() => ops.getStats(d, sz, '14/10/2026'), 'date mal formée refusée', 'Date invalide')

  const z = ops.getZ(d, sz, J2)
  ok(z.salon.nom === 'Salon Z' && z.date === J2, 'Z : salon et date')
  ok(z.premiere === '09:15' && z.derniere === '16:05' && z.nb_lignes === 5, `Z : ventes de 09:15 à 16:05, 5 lignes (obtenu ${z.premiere}-${z.derniere}, ${z.nb_lignes})`)
  ok(z.stats.nb_unites === 10 && z.stats.nb_cartons === 1, `Z : 10 unités dont 1 carton (obtenu ${z.stats.nb_unites})`)
  const zr = z.articles.find(a => a.nom === 'Rouge'), zb = z.articles.find(a => a.nom === 'Blanc')
  ok(z.articles[0].nom === 'Rouge', 'Z : articles triés par CA décroissant')
  ok(zr.unites === 9 && zr.cartons === 1 && zr.offerts === 1 && zr.total === 83.7, `Z : Rouge 9 u, 1 carton, 1 offert, 83.70 (obtenu ${JSON.stringify(zr)})`)
  ok(zb.unites === 1 && zb.degustations === 1.5 && zb.total === 8, 'Z : Blanc 1 u, 1.5 dégust., 8.00')
  ok(z.caisse.fond_initial === 150 && z.caisse.especes === 49.7 && z.caisse.solde_theorique === 199.7,
    `Z : caisse 150 + 49.70 = 199.70 (obtenu ${JSON.stringify(z.caisse)})`)
  const z1 = ops.getZ(d, sz, J1)
  ok(z1.caisse.fond_initial === null && z1.caisse.solde_theorique === 0, 'Z sans fond de caisse : fond null, solde = espèces')
  const zVide = ops.getZ(d, sz, '2026-10-20')
  ok(zVide.nb_lignes === 0 && zVide.articles.length === 0 && zVide.stats.total_global === 0, 'Z d’un jour sans vente : vide')
  throws(() => ops.getZ(d, 999, J2), 'Z : salon inconnu refusé', 'Salon introuvable')

  const txt = zTexte(z)
  ok(txt.startsWith('Z DE CAISSE — Salon Z (Tours)'), 'texte : en-tête')
  ok(txt.includes(dateLongue(J2)) && dateLongue(J2) === 'mercredi 14 octobre 2026', `texte : date longue (${dateLongue(J2)})`)
  ok(txt.includes("Chiffre d'affaires : 91.70 €") && txt.includes('- Espèces : 49.70 €'), 'texte : CA et modes')
  ok(txt.includes('- Rouge : 9 unités dont 1 carton · 1 offert — 83.70 €'), 'texte : ligne article')
  ok(txt.includes('- Solde théorique : 199.70 €'), 'texte : solde théorique')
  ok(zTexte(z1).includes('- Fond initial : non saisi'), 'texte : fond non saisi')
  ok(zTexte(zVide).includes('Aucune vente ce jour'), 'texte : jour sans vente')
  ok(detailArticle({ unites: 1, cartons: 0, degustations: 0, offerts: 2 }) === '1 unité · 2 offerts', 'détail article : singulier / pluriel')
  d.close()
}

console.log('— Comptage de caisse')
{
  const d = new SQL.Database()
  ops.initSchema(d)
  const sc = ops.createSalon(d, { nom: 'Salon C' }).id
  const pc = ops.createProduit(d, { nom: 'Rouge', prix: 9.9 }).id
  ops.updateSalonProduit(d, sc, pc, { selectionne: 1, stock_initial: 50, stock_restant: 50 })
  const J = '2026-10-14'
  ops.setCaisse(d, sc, { date: J, montant_initial: 150 })
  ops.ajouterVente(d, sc, { date: J, heure: '10:00', mode_paiement: 'Especes', items: [{ produit_id: pc, quantite: 3 }] })

  // 150 + 29.70 = 179.70 théorique ; compté : 1×100 + 1×50 + 1×20 + 1×5 + 2×2 + 1×0.50 + 1×0.20 = 179.70
  const detail = { 10000: 1, 5000: 1, 2000: 1, 500: 1, 200: 2, 50: 1, 20: 1, 10: 0 }
  ok(ops.totalComptage(detail).montant === 179.7, `total du comptage : 179.70 (obtenu ${ops.totalComptage(detail).montant})`)
  ok(!('10' in ops.totalComptage(detail).detail), 'coupures à zéro retirées du détail')
  throws(() => ops.totalComptage({ 300: 1 }), 'coupure inconnue refusée', 'Coupure inconnue')
  throws(() => ops.totalComptage({ 100: -1 }), 'nombre négatif refusé')
  throws(() => ops.totalComptage({ 100: 1.5 }), 'nombre non entier refusé')
  throws(() => ops.totalComptage(null), 'détail absent refusé')
  throws(() => ops.setComptage(d, sc, { date: 'hier', detail }), 'date invalide refusée', 'Date invalide')
  ok(ops.totalComptage({ 1: 3, 2: 1, 5: 1 }).montant === 0.1, 'centimes exacts : 3×0.01 + 0.02 + 0.05 = 0.10')

  ok(ops.getCaisse(d, sc)[0].comptage === null && ops.getCaisse(d, sc)[0].ecart === null, 'avant comptage : pas d’écart')
  ok(ops.setComptage(d, sc, { date: J, detail }).montant === 179.7, 'comptage enregistré')
  let row = ops.getCaisse(d, sc)[0]
  ok(row.comptage.montant === 179.7 && row.comptage.detail[10000] === 1 && /^\d{2}:\d{2}$/.test(row.comptage.heure),
    'comptage relu (montant, détail, heure)')
  ok(row.ecart === 0, `caisse juste : écart 0 (obtenu ${row.ecart})`)
  ok(row.montant_initial === 150 && row.especes_encaissees === 29.7 && row.solde === 179.7,
    'champs de l’export Excel inchangés')

  // Une vente espèces après le comptage : l'écart suit (manquant)
  ops.ajouterVente(d, sc, { date: J, heure: '18:30', mode_paiement: 'Especes', items: [{ produit_id: pc, quantite: 1 }] })
  row = ops.getCaisse(d, sc)[0]
  ok(row.ecart === -9.9, `vente après comptage : manquant −9.90 (obtenu ${row.ecart})`)
  ops.setComptage(d, sc, { date: J, detail: { ...detail, 1000: 1 } })
  row = ops.getCaisse(d, sc)[0]
  ok(row.ecart === 0.1, `recomptage : excédent +0.10 (obtenu ${row.ecart})`)
  ok(ops.queryAll(d, 'SELECT * FROM comptage_caisse').length === 1, 'recomptage : remplace, une seule ligne par jour')

  const z = ops.getZ(d, sc, J)
  ok(z.caisse.compte === 189.7 && z.caisse.ecart === 0.1 && z.caisse.solde_theorique === 189.6,
    `Z : compté 189.70, théorique 189.60, écart +0.10 (obtenu ${JSON.stringify(z.caisse)})`)
  const tz = zTexte(z)
  ok(tz.includes('- Espèces comptées : 189.70 €') && tz.includes('- Écart : +0.10 € (excédent)'), 'texte du Z : comptage et écart')

  ops.deleteComptage(d, sc, J)
  ok(ops.getCaisse(d, sc)[0].comptage === null && ops.getZ(d, sc, J).caisse.compte === null, 'comptage effacé')
  ok(zTexte(ops.getZ(d, sc, J)).includes('- Caisse non comptée'), 'texte du Z : caisse non comptée')

  ok(libelleCoupure(2000) === '20 €' && libelleCoupure(50) === '0,50 €' && libelleCoupure(5) === '0,05 €', 'libellés des coupures')
  ok(GROUPES[0].coupures.length === 6 && GROUPES[1].coupures.length === 8, '6 billets, 8 pièces')
  ok(totalDetail({ 2000: '3', 50: '', 10: '7' }) === 60.7, 'total de la saisie en cours (champs texte)')
  ok(lireEcart(0.004).libelle === 'Caisse juste' && lireEcart(-2).libelle === 'Manquant' && lireEcart(1).libelle === 'Excédent',
    'lecture de l’écart')
  ok(ecartSigne(-3.5) === '−3.50 €' && ecartSigne(1.2) === '+1.20 €' && ecartSigne(0) === '0.00 €', 'écart signé')
  d.close()
}

console.log('— Remises et tickets')
{
  const d = new SQL.Database()
  ops.initSchema(d)
  const st = ops.createSalon(d, { nom: 'Salon T' }).id
  const A = ops.createProduit(d, { nom: 'A', prix: 10 }).id
  const Bp = ops.createProduit(d, { nom: 'B', prix: 25, carton_taille: 6, carton_prix: 140 }).id
  for (const id of [A, Bp]) ops.updateSalonProduit(d, st, id, { selectionne: 1, stock_initial: 100, stock_restant: 100 })
  const J = '2026-10-14'

  // 3 × A à 10 € −10 % = 27 ; B 25 € −5 € = 20 ; dégustation ; puis −10 % sur le ticket (4.70)
  const r = ops.ajouterVente(d, st, {
    date: J, heure: '10:00', mode_paiement: 'Especes', montant_remis: 50,
    remise: { type: 'pct', valeur: 10 },
    items: [
      { produit_id: A, quantite: 3, remise: { type: 'pct', valeur: 10 } },
      { produit_id: Bp, quantite: 1, remise: { type: 'eur', valeur: 5 } },
      { produit_id: A, quantite: 0.5, type_quantite: 'degustation' },
    ],
  })
  ok(r.total === 42.3 && r.ticket.numero === 1, `total net 42.30, ticket n°1 (obtenu ${r.total}, n°${r.ticket?.numero})`)
  const lv = ops.getVentes(d, st).sort((a, b) => a.id - b.id)
  ok(lv[0].total === 24.3 && lv[1].total === 18 && lv[2].total === 0,
    `lignes nettes : 24.30 / 18.00 / 0 (obtenu ${lv.map(v => v.total)})`)
  ok(lv[0].prix_unitaire === 10 && lv[1].prix_unitaire === 25, 'prix unitaire catalogue conservé')
  ok(ops.getStats(d, st).total_global === 42.3, 'CA (calcul du desktop) = montant net')
  ok(ops.getStats(d, st).total_especes === 42.3, 'espèces = montant net')
  const t = ops.getTicket(d, st, r.ticket.id)
  ok(t.total_brut === 55 && t.remise_lignes === 8 && t.remise_ticket === 4.7 && t.total === 42.3,
    `ticket : brut 55, remises lignes 8, ticket 4.70, net 42.30 (obtenu ${t.total_brut}/${t.remise_lignes}/${t.remise_ticket}/${t.total})`)
  ok(t.remise_ticket_type === 'pct' && t.remise_ticket_valeur === 10, 'ticket : remise −10 % mémorisée')
  ok(t.montant_remis === 50 && t.rendu === 7.7 && t.montant_especes === 42.3, 'ticket : remis 50, rendu 7.70')
  ok(t.lignes.length === 3 && t.lignes[0].nom === 'A' && t.lignes[0].remise.valeur === 10 &&
     t.lignes[0].remise_ligne === 3 && t.lignes[0].part_ticket === 2.7 && t.lignes[1].part_ticket === 2,
    'reçu figé : lignes, remises et répartition au prorata')
  ok(t.salon.nom === 'Salon T', 'ticket : salon joint pour le reçu')

  // Reçu texte
  const rt = recuTexte(t)
  ok(rt.startsWith('Salon T\nTicket n°1 · 14/10/2026 à 10:00'), 'reçu : en-tête')
  ok(rt.includes('  3 × 10.00 € = 30.00 €\n  Remise −10 % : −3.00 €'), 'reçu : ligne et remise article')
  ok(rt.includes('  dégustation × 0.5'), 'reçu : dégustation sans prix')
  ok(rt.includes('Sous-total : 55.00 €') && rt.includes('Remises articles : −8.00 €') &&
     rt.includes('Remise ticket −10 % : −4.70 €') && rt.includes('TOTAL : 42.30 €'), 'reçu : sous-total, remises, total')
  ok(rt.includes('Paiement : Espèces · remis 50.00 € · rendu 7.70 €'), 'reçu : paiement espèces')
  ok(libelleRemise({ type: 'pct', valeur: 15 }) === '−15 %' && libelleRemise({ type: 'eur', valeur: 2.5 }) === '−2.50 €', 'libellés de remise')
  ok(quantiteLigne({ type: 'normal', unite: 'carton', quantite: 2, carton_taille: 6, prix_unitaire: 54 }) === '2 cartons de 6 × 54.00 €',
    'quantité : cartons')
  ok(paiementTexte({ mode_paiement: 'Mixte', montant_especes: 10, montant_cb: 5, montant_cheque: 0 }) === 'Mixte · espèces 10.00 € · CB 5.00 €',
    'paiement mixte détaillé')
  ok(paiementTexte({ mode_paiement: null }) === 'Sans paiement', 'ticket sans paiement (dégustations seules)')

  // Mixte avec remise : la somme des paiements doit égaler le net
  throws(() => ops.ajouterVente(d, st, { mode_paiement: 'Mixte', montant_especes: 10, montant_cb: 10,
    remise: { type: 'eur', valeur: 5 }, items: [{ produit_id: A, quantite: 2 }] }),
  'mixte : paiements comparés au montant net', 'ne correspond pas')
  const r2 = ops.ajouterVente(d, st, { date: J, heure: '11:00', mode_paiement: 'Mixte', montant_especes: 10, montant_cb: 5,
    remise: { type: 'eur', valeur: 5 }, items: [{ produit_id: A, quantite: 2 }] })
  ok(r2.total === 15 && r2.ticket.numero === 2, 'mixte 10 + 5 = 15 après remise 5 € : ticket n°2')
  throws(() => ops.ajouterVente(d, st, { mode_paiement: 'Especes', montant_remis: 42,
    remise: { type: 'pct', valeur: 10 }, items: [{ produit_id: A, quantite: 5 }] }),
  'espèces : montant remis comparé au net (42 < 45)', 'insuffisant')

  // Validations
  const essai = (items, remise = null) => () => ops.ajouterVente(d, st, { mode_paiement: 'CB', items, remise })
  throws(essai([{ produit_id: A, quantite: 1, remise: { type: 'pct', valeur: 150 } }]), 'remise > 100 % refusée', '100 %')
  throws(essai([{ produit_id: A, quantite: 1, remise: { type: 'eur', valeur: 12 } }]), 'remise > montant de la ligne refusée', 'dépasse')
  throws(essai([{ produit_id: A, quantite: 1, remise: { type: 'eur', valeur: -2 } }]), 'remise négative refusée', 'positive')
  throws(essai([{ produit_id: A, quantite: 1, remise: { type: 'x', valeur: 2 } }]), 'type de remise inconnu refusé', 'invalide')
  throws(essai([{ produit_id: A, quantite: 1, type_quantite: 'offert', remise: { type: 'pct', valeur: 10 } }]),
    'remise sur un offert refusée', 'ne s’applique')
  throws(() => ops.ajouterVente(d, st, { items: [{ produit_id: A, quantite: 1, type_quantite: 'offert' }],
    remise: { type: 'pct', valeur: 10 } }), 'remise ticket sans vente refusée', 'sans vente')
  throws(essai([{ produit_id: A, quantite: 2 }], { type: 'eur', valeur: 25 }), 'remise ticket > total refusée', 'dépasse')
  ok(ops.getTickets(d, st).length === 2, 'aucun ticket créé par les paniers refusés')

  // Remise 100 % : ticket à 0 €, carton remisé
  const r3 = ops.ajouterVente(d, st, { date: J, heure: '12:00', mode_paiement: 'CB',
    items: [{ produit_id: A, quantite: 1, remise: { type: 'pct', valeur: 100 } },
            { produit_id: Bp, quantite: 1, unite: 'carton', remise: { type: 'eur', valeur: 20 } }] })
  ok(r3.total === 120 && ops.getTicket(d, st, r3.ticket.id).lignes[1].total === 120, 'carton 140 € − 20 € = 120, ligne à 100 % = 0')

  // Tickets et Z
  const tz = ops.getZ(d, st, J)
  ok(tz.tickets.nb === 3 && tz.tickets.remises === 8 + 4.7 + 5 + 10 + 20,
    `Z : 3 tickets, remises 47.70 (obtenu ${tz.tickets.nb}, ${tz.tickets.remises})`)
  ok(tz.tickets.moyen === round(((42.3 + 15 + 120) / 3)), `Z : ticket moyen 59.10 (obtenu ${tz.tickets.moyen})`)
  ok(zTexte(tz).includes('Tickets : 3 · ticket moyen 59.10 €') && zTexte(tz).includes('Remises accordées : 47.70 €'),
    'texte du Z : tickets, ticket moyen, remises')
  ops.annulerTicket(d, st, r2.ticket.id)
  ok(zTexte(ops.getZ(d, st, J)).includes('Tickets : 2 (+ 1 annulé)'), 'texte du Z : ticket annulé compté à part')
  ok(recuTexte(ops.getTicket(d, st, r2.ticket.id)).includes('*** TICKET ANNULÉ'), 'reçu : mention « annulé »')
  const tz2 = ops.getZ(d, st, J)
  ok(tz2.tickets.nb === 2 && tz2.tickets.nb_annules === 1 && tz2.stats.total_global === 162.3,
    `après annulation du n°2 : 2 tickets, 1 annulé, CA 162.30 (obtenu ${tz2.stats.total_global})`)
  const r4 = ops.ajouterVente(d, st, { date: J, heure: '13:00', mode_paiement: 'CB', items: [{ produit_id: A, quantite: 1 }] })
  ok(r4.ticket.numero === 4, 'numérotation continue après une annulation (n°4)')
  ok(ops.getTickets(d, st, J).length === 4 && ops.getTickets(d, st, '2026-10-15').length === 0, 'tickets filtrés par jour')
  ok(ops.getVentesSansTicket(d, st).length === 0, 'toutes les lignes saisies ont un ticket')

  // Fonction pure partagée avec l'écran de vente
  const c = ops.calculerRemises([
    { type_quantite: 'normal', prix_unitaire: 9.9, quantite: 3, remise: null },
    { type_quantite: 'normal', prix_unitaire: 12.5, quantite: 1, remise: null },
  ], ops.normaliserRemise({ type: 'eur', valeur: '2' }))
  ok(c.sous_total === 42.2 && c.total === 40.2 && Math.abs(c.lignes[0].total + c.lignes[1].total - 40.2) < 1e-9,
    'calculerRemises : 42.20 − 2 € = 40.20, somme des lignes exacte au centime')
  ok(ops.normaliserRemise(null) === null && ops.normaliserRemise('') === null, 'remise absente → null')
  d.close()
}

console.log('— Seuils de stock bas et catégories')
{
  const d = new SQL.Database()
  ops.initSchema(d)
  const s1 = ops.createSalon(d, { nom: 'S1' }).id
  const s2 = ops.createSalon(d, { nom: 'S2' }).id
  const rouge = ops.createProduit(d, { nom: 'Rouge', prix: 10, categorie: 'Rouges' }).id
  const blanc = ops.createProduit(d, { nom: 'Blanc', prix: 10, categorie: ' Blancs ' }).id
  const jus = ops.createProduit(d, { nom: 'Jus', prix: 3 }).id
  for (const id of [rouge, blanc, jus]) ops.updateSalonProduit(d, s1, id, { selectionne: 1, stock_initial: 20, stock_restant: 20 })
  const sp = () => Object.fromEntries(ops.getSalonProduits(d, s1).map(p => [p.produit_id, p]))
  ok(sp()[rouge].seuil_alerte === ops.SEUIL_DEFAUT && ops.SEUIL_DEFAUT === 5, 'seuil par défaut : 5')
  ops.updateSalonProduit(d, s1, rouge, { ...sp()[rouge], seuil_alerte: 12 })
  ok(sp()[rouge].seuil_alerte === 12, 'seuil enregistré : 12')
  ok(ops.getSalonProduits(d, s2).length === 3 && ops.getSalonProduits(d, s2).every(p => p.seuil_alerte === 5),
    'seuil propre au salon (S2 garde 5)')
  ops.updateSalonProduit(d, s1, rouge, { ...sp()[rouge], stock_restant: 15 })
  ok(sp()[rouge].seuil_alerte === 12 && sp()[rouge].stock_restant === 15, 'modifier le stock garde le seuil')
  ops.updateSalonProduit(d, s1, rouge, { stock_initial: 20, stock_restant: 15, selectionne: 1 })
  ok(sp()[rouge].seuil_alerte === 12, 'seuil absent de la requête : inchangé')
  ops.updateSalonProduit(d, s1, rouge, { ...sp()[rouge], seuil_alerte: 5 })
  ok(ops.queryAll(d, 'SELECT * FROM seuils_stock').length === 0, 'retour au seuil par défaut : ligne supprimée')
  ops.updateSalonProduit(d, s1, jus, { ...sp()[jus], seuil_alerte: 0 })
  ok(sp()[jus].seuil_alerte === 0, 'seuil 0 accepté (alerte seulement si épuisé)')
  throws(() => ops.updateSalonProduit(d, s1, jus, { ...sp()[jus], seuil_alerte: -1 }), 'seuil négatif refusé', 'seuil')
  throws(() => ops.updateSalonProduit(d, s1, jus, { ...sp()[jus], seuil_alerte: 'abc' }), 'seuil non numérique refusé', 'seuil')
  const fond = ops.queryAll(d, 'PRAGMA table_info(salon_produits)').map(r => r.name).join(',')
  ok(fond === 'id,salon_id,produit_id,selectionne,stock_initial,stock_restant', `table salon_produits du desktop inchangée (${fond})`)

  ok(niveauStock(0, 5) === 'epuise' && niveauStock(-1, 5) === 'epuise' && niveauStock(5, 5) === 'bas' &&
     niveauStock(5.5, 5) === 'ok' && niveauStock(1, 0) === 'ok', 'niveaux : épuisé / bas (≤ seuil) / ok')
  const liste = ops.getSalonProduits(d, s1)
  const cat = categoriesDe(liste)
  ok(JSON.stringify(cat.categories) === '["Blancs","Rouges"]' && cat.sansCategorie, `catégories triées, espaces retirés, « sans » détecté (${cat.categories})`)
  const dispo = p => p.stock_restant
  ok(filtrerProduits(liste, 'Blancs', dispo).map(p => p.nom).join() === 'Blanc', 'filtre catégorie')
  ok(filtrerProduits(liste, SANS_CATEGORIE, dispo).map(p => p.nom).join() === 'Jus', 'filtre sans catégorie')
  ok(filtrerProduits(liste, '', dispo).length === 3, 'sans filtre : tout')
  ok(filtrerProduits(liste, STOCK_BAS, p => (p.nom === 'Blanc' ? 4 : 20)).map(p => p.nom).join() === 'Blanc', 'filtre stock bas (dispo panier déduit)')

  const fiches = [
    { produit_id: 1, nom: 'Rouge', stock_restant: 8, seuil_alerte: 5 },
    { produit_id: 2, nom: 'Blanc', stock_restant: 2, seuil_alerte: 5 },
    { produit_id: 3, nom: 'Rosé', stock_restant: 4, seuil_alerte: 5 },
    { produit_id: 4, nom: 'Jus', stock_restant: 10, seuil_alerte: 5 },
  ]
  const al = alertesFranchies(fiches, { 1: 5, 2: 2, 3: 1, 4: 1 })
  ok(JSON.stringify(al) === JSON.stringify([{ nom: 'Rouge', restant: 3, niveau: 'bas' }, { nom: 'Blanc', restant: 0, niveau: 'epuise' }]),
    `alertes : Rouge passe sous le seuil, Blanc s'épuise ; Rosé déjà bas et Jus au-dessus ignorés (${JSON.stringify(al)})`)
  ok(messageAlertes(al) === 'Stock bas : Rouge (3 restants) · Épuisé : Blanc', `message : ${messageAlertes(al)}`)
  ok(messageAlertes([]) === '', 'aucune alerte : message vide')
  d.close()
}

console.log(`\n${passed} réussis, ${failed} échoués`)
process.exit(failed > 0 ? 1 : 0)
