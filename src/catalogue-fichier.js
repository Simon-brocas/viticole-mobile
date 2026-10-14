/**
 * Fichiers du catalogue : lecture (.xlsx ou .csv) et export (.xlsx) au même
 * format, pour pouvoir exporter, modifier dans un tableur puis réimporter.
 * exceljs est chargé à la demande (comme pour l'export Excel des ventes).
 */
import { lireCsv, decoderTexte, lignesCatalogue } from './utils/catalogue.js'

/** Valeur affichable d'une cellule exceljs (formule, texte enrichi, lien…). */
function valeurCellule(v) {
  if (v === null || v === undefined) return ''
  if (typeof v !== 'object') return v
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if ('result' in v) return valeurCellule(v.result)
  if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('')
  if ('text' in v) return valeurCellule(v.text)
  return ''
}

/** Lit un fichier catalogue → lignes pour ops.importerCatalogue. */
export async function lireCatalogue(nom, bytes) {
  const ext = nom.toLowerCase().split('.').pop()
  // Un .xlsx est une archive ZIP (« PK ») : reconnu même si le nom a perdu son extension
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if ((ext === 'csv' || ext === 'txt') && !zip) return lignesCatalogue(lireCsv(decoderTexte(bytes)))
  if (ext === 'xlsx' || zip) {
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(bytes)
    } catch {
      throw new Error('Fichier Excel illisible.')
    }
    const ws = wb.worksheets[0]
    if (!ws) throw new Error('Le classeur ne contient aucune feuille.')
    const tableau = []
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      tableau[n - 1] = row.values.slice(1).map(valeurCellule) // row.values commence à l'index 1
    })
    return lignesCatalogue(Array.from(tableau, r => r ?? []))
  }
  if (ext === 'xls') throw new Error('Ancien format Excel (.xls) : enregistrez le fichier en .xlsx ou en .csv.')
  throw new Error('Format non pris en charge : choisissez un fichier .xlsx ou .csv.')
}

/** Catalogue actuel en .xlsx (colonnes reconnues à l'import). Stock = stock initial du salon. */
export async function classeurCatalogue(produits, stocks = new Map()) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Catalogue')
  ws.addRow(['Nom', 'Prix (€)', 'Catégorie', 'Carton (unités)', 'Prix carton (€)', 'Stock'])
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F855A' } }
  for (const p of produits) {
    ws.addRow([p.nom, p.prix, p.categorie || '', p.carton_taille ?? '', p.carton_prix ?? '', stocks.get(p.id) ?? ''])
  }
  ;[42, 12, 18, 16, 16, 10].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.getColumn(2).numFmt = '#,##0.00'
  ws.getColumn(5).numFmt = '#,##0.00'
  return wb.xlsx.writeBuffer()
}
