/** Vérifie le classeur généré par src/excel.js : onglets, en-têtes, totaux. */
import initSqlJs from 'sql.js'
import ExcelJS from 'exceljs'
import * as ops from '../src/db/operations.js'
import { hashPassword } from '../src/db/auth.js'
import { buildWorkbook } from '../src/excel.js'

const SQL = await initSqlJs()
const db = new SQL.Database()
ops.initSchema(db)
await ops.ensureAdmin(db, hashPassword)

const p1 = ops.createProduit(db, { nom: 'Chinon Rouge', prix: 8.5, carton_taille: 6, carton_prix: 46 })
const salon = ops.createSalon(db, { nom: 'Salon Test', lieu: 'Angers' })
ops.updateSalonProduit(db, salon.id, p1.id, { selectionne: 1, stock_initial: 24, stock_restant: 24 })
ops.ajouterVente(db, salon.id, {
  items: [{ produit_id: p1.id, quantite: 2, sync_id: 'x1' }],
  mode_paiement: 'Especes', montant_remis: 20,
})
// Même jour que la vente ci-dessus (les espèces sont comptées par journée) :
// une date figée ferait échouer le test dès le lendemain de son écriture.
const TODAY = new Date().toISOString().slice(0, 10)
ops.setCaisse(db, salon.id, { date: TODAY, montant_initial: 150 })

const buffer = await buildWorkbook(ops.getExportData(db, salon.id))

// Relecture du xlsx généré
const wb = new ExcelJS.Workbook()
await wb.xlsx.load(buffer)
const names = wb.worksheets.map(ws => ws.name)
console.log('Onglets :', names.join(' / '))

const ws1 = wb.getWorksheet('Récap ventes')
const ws2 = wb.getWorksheet('Stocks')
const ws3 = wb.getWorksheet('Fond de caisse')

const fail = msg => { console.error('✗ ' + msg); process.exit(1) }

if (names.length !== 3) fail('3 onglets attendus')
if (ws1.getCell('A1').value !== 'Date') fail('en-tête ventes')
if (ws1.getCell('C2').value !== 'Chinon Rouge') fail('produit en ligne 2')
if (ws1.getCell('I2').value !== 17) fail('total vente 17')
// Ligne TOTAL (col 8/9) après la ligne vide
let totalRow = null
ws1.eachRow((row, n) => { if (row.getCell(8).value === 'TOTAL') totalRow = n })
if (!totalRow || ws1.getRow(totalRow).getCell(9).value !== 17) fail('ligne TOTAL = 17')
if (ws2.getCell('A2').value !== 'Chinon Rouge' || ws2.getCell('H2').value !== 22) fail('stocks : restant 22')
// 150 € de fond + 17 € encaissés en espèces le même jour
if (ws3.getCell('A2').value !== TODAY || ws3.getCell('D2').value !== 167) fail('caisse : solde 167')

console.log('✓ Classeur Excel conforme (3 onglets, en-têtes, totaux, stocks, caisse)')
