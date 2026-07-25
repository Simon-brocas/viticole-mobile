/** Vérifie qu'une vraie base viticole.db du logiciel Windows s'ouvre avec la couche mobile. */
import { readFileSync } from 'fs'
import initSqlJs from 'sql.js'
import * as ops from '../src/db/operations.js'

const path = process.argv[2]
if (!path) {
  console.error('Usage : node test/import-desktop-db.mjs <chemin vers viticole.db>')
  process.exit(1)
}

const SQL = await initSqlJs()
const db = new SQL.Database(new Uint8Array(readFileSync(path)))
ops.initSchema(db) // migrations idempotentes

const salons = ops.getSalons(db)
const produits = ops.getProduits(db, true)
console.log(`✓ Base ouverte : ${salons.length} salon(s), ${produits.length} produit(s)`)
for (const s of salons) {
  const stats = ops.getStats(db, s.id)
  const ventes = ops.getVentes(db, s.id)
  console.log(`  - ${s.nom} (${s.lieu || 'sans lieu'}) : ${ventes.length} vente(s), CA ${stats.total_global.toFixed(2)} €`)
}
const user = ops.queryOne(db, "SELECT username, substr(password_hash, 1, 20) AS h FROM users WHERE username='admin'")
console.log(`✓ Compte admin présent (hash ${user.h}…)`)
