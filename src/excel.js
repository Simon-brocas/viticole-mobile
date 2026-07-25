/**
 * Export Excel — reproduction fidèle des 3 onglets générés par openpyxl
 * côté desktop (Récap ventes / Stocks / Fond de caisse), avec les mêmes styles.
 */
import ExcelJS from 'exceljs'

const H_FONT = { bold: true, color: { argb: 'FFFFFFFF' } }
const H_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F855A' } }
const MONEY = '#,##0.00 €'
const TYPE_LABELS = { normal: 'Vente', degustation: 'Dégustation', offert: 'Offert' }

function styleHeader(ws, ncols) {
  for (let i = 1; i <= ncols; i++) {
    const c = ws.getRow(1).getCell(i)
    c.font = H_FONT
    c.fill = H_FILL
    c.alignment = { horizontal: 'center' }
  }
}

export async function buildWorkbook({ ventes, salonProduits, stats, caisse }) {
  const wb = new ExcelJS.Workbook()

  // ── Feuille 1 : Récap ventes ────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Récap ventes')
  ws1.addRow(['Date', 'Heure', 'Produit', 'Type', 'Unité', 'Quantité',
              'Prix unitaire (€)', 'Mode de paiement', 'Total (€)'])
  styleHeader(ws1, 9)
  for (const v of ventes) {
    ws1.addRow([v.date, v.heure, v.produit_nom,
                TYPE_LABELS[v.type_quantite] || v.type_quantite,
                v.unite === 'carton' ? 'Carton' : 'Bouteille',
                v.quantite, v.prix_unitaire, v.mode_paiement || '', v.total])
  }
  const last = ws1.rowCount
  ws1.addRow([])
  for (const [label, val] of [['TOTAL', stats.total_global], ['Espèces', stats.total_especes],
                              ['CB', stats.total_cb], ['Chèque', stats.total_cheque]]) {
    const row = ws1.addRow([])
    const lc = row.getCell(8)
    lc.value = label
    lc.font = { bold: true }
    const vc = row.getCell(9)
    vc.value = Math.round(val * 100) / 100
    vc.numFmt = MONEY
    vc.font = { bold: true }
  }
  for (const col of [7, 9]) {
    for (let r = 2; r <= last; r++) {
      ws1.getRow(r).getCell(col).numFmt = MONEY
    }
  }
  const widths1 = [12, 7, 42, 14, 11, 10, 18, 18, 14]
  widths1.forEach((w, i) => { ws1.getColumn(i + 1).width = w })

  // ── Feuille 2 : Stocks ──────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Stocks')
  ws2.addRow(['Produit', 'Prix (€)', 'Stock initial', 'Vendu (bouteilles)',
              'dont cartons', 'Dégustation', 'Offert', 'Stock restant'])
  styleHeader(ws2, 8)
  for (const sp of salonProduits) {
    ws2.addRow([sp.nom, sp.prix, sp.stock_initial, sp.vendu,
                sp.cartons, sp.degu, sp.offert, sp.stock_restant])
  }
  ws2.getColumn(1).width = 42
  ws2.getColumn(2).width = 10
  for (let i = 3; i <= 8; i++) ws2.getColumn(i).width = 16

  // ── Feuille 3 : Fond de caisse ──────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Fond de caisse')
  ws3.addRow(['Date', 'Fond initial (€)', 'Espèces encaissées (€)', 'Solde (€)'])
  styleHeader(ws3, 4)
  for (const row of caisse) {
    ws3.addRow([row.date, row.montant_initial, row.especes_encaissees, row.solde])
  }
  for (let i = 1; i <= 4; i++) ws3.getColumn(i).width = 24

  return wb.xlsx.writeBuffer()
}
