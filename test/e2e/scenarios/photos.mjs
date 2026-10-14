// Téléphone d'avant les photos séparées : migration, base allégée, export .db identique, restauration
import initSqlJs from 'sql.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as ops from '../../../src/db/operations.js'
import { pageAvecBase, connecter, lireIdb } from '../outils.mjs'
import { baseAnciennePhotos } from '../bases.mjs'

export const titre = 'Photos : migration et export vers le PC'

export default async function ({ browser, url, check, dossier }) {
  const SQL = await initSqlJs()
  const { bytes, photo } = await baseAnciennePhotos()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
  const page = await pageAvecBase(ctx, url, bytes, 1)
  await connecter(page, url)
  const imgOk = loc => loc.evaluate(img => img.complete && img.naturalWidth > 0)
  const photoSalon = page.getByRole('button', { name: 'Changer la photo du salon Ancien' }).locator('img')
  await photoSalon.waitFor()
  check(await imgOk(photoSalon), 'photo du salon affichée après migration')
  await page.getByText('Ancien', { exact: true }).click()
  const carte = nom => page.getByRole('button', { name: new RegExp('^' + nom) })
  await carte('Rouge').locator('img').waitFor()
  check(await imgOk(carte('Rouge').locator('img')), 'photo d’article affichée après migration')
  check(await carte('Blanc').locator('img').count() === 0, 'article sans photo : pas d’image')

  let idb = await lireIdb(page)
  check(idb.version === 2, 'IndexedDB passée en version 2')
  check(idb.photos.sort().join() === 'produits/1,salons/1', `photos rangées à part (${idb.photos})`)
  check(ops.photosInternes(new SQL.Database(Uint8Array.from(idb.main))).length === 0, 'plus aucune image dans la base enregistrée')
  check(idb.main.length < bytes.length / 2, `base enregistrée allégée : ${bytes.length} → ${idb.main.length} octets`)

  // Une vente : la base réécrite reste légère
  await carte('Rouge').click()
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('group', { name: 'Montants rapides' }).getByRole('button', { name: 'Exact' }).click()
  await page.getByRole('button', { name: 'Valider la vente' }).click()
  await page.getByText(/Ticket n°\d+ enregistré/).first().waitFor()
  idb = await lireIdb(page)
  check(idb.main.length < bytes.length / 2, `base réécrite après une vente : ${idb.main.length} octets`)

  // Export vers le PC : images réinjectées à l'identique
  await page.goto(url + 'admin')
  await page.getByRole('button', { name: 'Données' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exporter la base/ }).click()])
  const exp = new SQL.Database(readFileSync(await dl.path()))
  const pExp = ops.getPhoto(exp, 'produits', 1)
  check(pExp && Buffer.from(pExp).equals(Buffer.from(photo)), 'export .db : photo identique à l’originale')
  check(ops.getPhoto(exp, 'salons', 1)?.length > 100000, 'export .db : photo du salon présente')
  check(ops.getPhoto(exp, 'produits', 2) === null, 'export .db : article sans photo → NULL')
  check(ops.getVentes(exp, 1).length === 1, 'export .db : la vente est dans le fichier')

  // Ajout d'une photo via l'interface
  const fichier = join(dossier, 'photo.jpg')
  const { writeFileSync } = await import('fs')
  writeFileSync(fichier, photo)
  await page.getByRole('button', { name: 'Articles' }).click()
  await page.getByRole('button', { name: 'Modifier Blanc' }).click()
  await page.locator('form input[type=file]').setInputFiles(fichier)
  await page.getByAltText('Aperçu de l\'article').waitFor()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Modifier l’article').waitFor({ state: 'hidden' }) // formulaire fermé = enregistré
  await page.reload()
  await page.getByRole('link', { name: 'Vente' }).click()
  await carte('Blanc').locator('img').waitFor()
  check(await imgOk(carte('Blanc').locator('img')), 'photo ajoutée affichée après rechargement')
  idb = await lireIdb(page)
  check(idb.photos.includes('produits/2'), 'nouvelle photo rangée à part')

  // Restauration d'une sauvegarde : les photos restent
  await page.goto(url + 'admin')
  await page.getByRole('button', { name: 'Données' }).click()
  await page.getByRole('button', { name: 'Restaurer' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurer' }).click()
  await page.getByText('Choisir un salon').waitFor()
  check(await imgOk(photoSalon), 'photo du salon affichée après restauration')
  await ctx.close()
}
