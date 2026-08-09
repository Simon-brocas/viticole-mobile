/**
 * Test de bout en bout de la logique métier (portage de backend/smoke_test.py).
 * S'exécute sous Node sur une base en mémoire : npm test
 */
import initSqlJs from 'sql.js'
import * as ops from '../src/db/operations.js'
import { verifyPassword, hashPassword } from '../src/db/auth.js'

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

console.log('— Suppression de vente (restaure le stock)')
const vente = ops.getVentes(db, sid).find(v => v.sync_id === 'v1')
ops.supprimerVente(db, sid, vente.id)
const spAfter = Object.fromEntries(ops.getSalonProduits(db, sid).map(x => [x.produit_id, x]))
ok(spAfter[p1.id].stock_restant === 22, `stock restauré à 22 (obtenu ${spAfter[p1.id].stock_restant})`)
ok(ops.getStats(db, sid).total_global === 42.5, 'CA recalculé après suppression')

console.log('— Export : assemblage des données')
const exportData = ops.getExportData(db, sid)
ok(exportData.salon.nom === 'Salon de Tours', 'salon présent')
ok(exportData.ventes.length === ops.getVentes(db, sid).length, 'toutes les ventes présentes')
ok(exportData.salonProduits.length === 2, '2 produits en stock')
ok(exportData.caisse.length === 1, 'caisse présente')

console.log('— Photos')
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
ops.setPhoto(db, 'produits', p1.id, jpeg)
ok(ops.getPhoto(db, 'produits', p1.id)?.length === jpeg.length, 'photo produit stockée')
ok(ops.getProduits(db).find(p => p.id === p1.id).has_photo === 1, 'has_photo = 1')
throws(() => ops.setPhoto(db, 'produits', p1.id, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])),
  'format non image refusé')
ops.deletePhoto(db, 'produits', p1.id)
ok(ops.getPhoto(db, 'produits', p1.id) === null, 'photo supprimée')

console.log('— Suppression de salon (soft delete)')
ops.updateSalon(db, sid, { nom: 'Salon de Tours', actif: 0 })
ok(ops.getSalons(db).find(s => s.id === sid).actif === 0, 'salon désactivé, données conservées')

console.log(`\n${passed} réussis, ${failed} échoués`)
process.exit(failed > 0 ? 1 : 0)
