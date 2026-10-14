// Duplication de salon, import CSV « Excel France », export puis réimport du catalogue
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { lireCatalogue } from '../../../src/catalogue-fichier.js'
import { pageAvecBase, connecter } from '../outils.mjs'
import { baseDuplication, csvExcelFrance } from '../bases.mjs'

export const titre = 'Duplication de salon et catalogue'

export default async function ({ browser, url, check, dossier }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', acceptDownloads: true })
  const page = await pageAvecBase(ctx, url, baseDuplication())
  await connecter(page, url)

  // Duplication
  await page.getByRole('button', { name: 'Dupliquer le salon Salon des vins' }).click()
  const dup = page.getByRole('dialog', { name: 'Dupliquer le salon' })
  check(await dup.getByLabel('Nom du nouveau salon *').inputValue() === 'Salon des vins (copie)', 'nom proposé')
  await dup.getByLabel('Nom du nouveau salon *').fill('Marché de Noël')
  await dup.getByLabel('Lieu').fill('Amboise')
  await dup.getByRole('button', { name: 'Créer le salon' }).click()
  await page.getByText('Salon « Marché de Noël » créé à partir de « Salon des vins ».').waitFor()
  await page.getByText('Marché de Noël', { exact: true }).click()
  await page.getByRole('link', { name: 'Stocks' }).click()
  await page.getByText('Chinon rouge').first().waitFor()
  const carteStock = nom => page.locator('.card').filter({ hasText: nom }).first().innerText()
  const ch = await carteStock('Chinon rouge')
  check(ch.includes('/ 7') && ch.includes('alerte ≤ 6'), 'duplication : Chinon 12 − 5 = 7, seuil 6 repris')
  check((await page.getByText('Produits non sélectionnés').locator('..').innerText()).includes('Jus de raisin'), 'sélection reprise')
  await page.getByRole('link', { name: 'Récap' }).click()
  check(await page.getByText('Aucune vente').isVisible(), 'aucune vente copiée')

  // Import CSV
  const csv = join(dossier, 'catalogue-fr.csv')
  writeFileSync(csv, csvExcelFrance())
  await page.goto(url + 'admin')
  const fichier = page.locator('input[type=file][accept*=".xlsx"]')
  await fichier.setInputFiles(csv)
  const ap = page.getByRole('dialog', { name: "Aperçu de l'import" })
  await ap.waitFor()
  const at = await ap.innerText()
  check(at.includes('1 nouveau') && at.includes('1 mis à jour') && at.includes('1 erreur'), 'aperçu : 1 nouveau, 1 mis à jour, 1 erreur')
  check(at.includes('prix, carton, prix du carton') && at.includes('Prix manquant.'), 'aperçu : changements et erreur par ligne')
  check(at.includes('stock initial du salon « Marché de Noël »'), 'colonne Stock pour le salon courant')
  await ap.getByRole('button', { name: 'Importer 2 articles' }).click()
  await page.getByText('Import terminé : 1 article créé, 1 mis à jour.').waitFor()
  await page.getByRole('link', { name: 'Stocks' }).click()
  await page.getByText('Sancerre blanc').first().waitFor()
  check((await carteStock('Sancerre blanc')).includes('/ 12'), 'Sancerre importé, stock 12')

  // Export puis réimport : rien à changer
  await page.goto(url + 'admin')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter' }).click()])
  const lignes = await lireCatalogue('c.xlsx', readFileSync(await dl.path()))
  check(lignes.length === 6 && lignes.find(l => l.nom === 'Sancerre blanc')?.stock === 12, 'export : 6 articles, stock compris')
  await fichier.setInputFiles(await dl.path())
  await ap.waitFor()
  check(await ap.getByRole('button', { name: 'Rien à importer' }).isDisabled(), 'réimport de l’export : rien à importer')
  await ap.getByRole('button', { name: 'Annuler' }).click()
  await fichier.setInputFiles({ name: 'vieux.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
  check((await page.getByRole('alert').innerText()).includes('.xlsx'), '.xls : message explicite')
  await ctx.close()
}
