// Récap par jour, Z de caisse (partage, impression) et comptage de caisse
import initSqlJs from 'sql.js'
import { readFileSync } from 'fs'
import { pageAvecBase, connecter } from '../outils.mjs'
import { baseDeuxJours } from '../bases.mjs'

export const titre = 'Récap par jour, Z de caisse, comptage'

export default async function ({ browser, url, check }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', acceptDownloads: true })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
  const page = await pageAvecBase(ctx, url, baseDeuxJours())
  await connecter(page, url, 'Salon des vins')
  await page.getByRole('link', { name: 'Récap' }).click()

  const total = () => page.locator('.text-3xl').first().innerText()
  await page.getByText('Total des ventes').waitFor()
  check(await total() === '177.20 €', `toutes les dates : 177.20 € (${await total()})`)
  const sel = page.getByLabel('Filtrer par date')
  await sel.selectOption({ index: 1 })
  await page.waitForFunction(() => document.querySelector('.text-3xl')?.innerText === '149.20 €')
  const modes = await page.locator('.grid-cols-3').first().innerText()
  check(modes.includes('49.70 €') && modes.includes('46.50 €') && modes.includes('53.00 €'), 'aujourd’hui : 149.20 €, espèces / CB / chèque')
  await sel.selectOption({ index: 2 })
  await page.waitForFunction(() => document.querySelector('.text-3xl')?.innerText === '28.00 €')
  check(true, 'hier : 28.00 €')

  // Z du jour
  await sel.selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Z du jour' }).click()
  const z = page.getByRole('dialog', { name: 'Z de caisse' })
  await z.getByText("Chiffre d'affaires").waitFor()
  const zt = await z.locator('.print-zone').innerText()
  check(zt.includes('149.20 €') && zt.includes('Ventes de 09:15 à 17:05'), 'Z : CA et plage horaire')
  check(zt.includes('9 unités dont 1 carton · 1 offert') && zt.includes('83.70 €'), 'Z : détail par article')
  check(zt.includes('150.00 €') && zt.includes('199.70 €') && zt.includes('Caisse non comptée'), 'Z : caisse 150 + 49.70, non comptée')
  check(zt.includes('Tickets') && zt.includes('Ticket moyen'), 'Z : tickets et ticket moyen')
  await z.getByRole('button', { name: 'Partager' }).click()
  await z.getByText('Z copié').waitFor()
  check((await page.evaluate(() => navigator.clipboard.readText())).includes('- Solde théorique : 199.70 €'), 'partage : texte copié')
  await page.emulateMedia({ media: 'print' })
  check(await page.locator('#root').isHidden() && await z.locator('.print-zone').isVisible() &&
    await z.getByRole('button', { name: 'Partager' }).isHidden(), 'impression : rapport seul')
  await page.emulateMedia({ media: 'screen' })
  await page.keyboard.press('Escape')
  check(await z.count() === 0, 'Échap ferme le Z')

  // Comptage : 199.70 attendus
  await page.getByRole('link', { name: 'Caisse' }).click()
  await page.getByRole('button', { name: 'Compter la caisse' }).click()
  const sheet = page.getByRole('dialog', { name: 'Comptage de caisse' })
  const plus = l => sheet.getByRole('button', { name: `Ajouter un ${l}`, exact: true })
  await plus('100 €').click(); await plus('50 €').click(); await plus('20 €').click(); await plus('20 €').click(); await plus('5 €').click()
  await sheet.getByLabel('Nombre de 0,50 €').fill('9')
  const ecart = () => sheet.locator('[aria-live=polite]').last().innerText()
  check((await ecart()).includes('Manquant') && (await ecart()).includes('−0.20 €'), '199.50 compté : manquant −0.20 €')
  await sheet.getByLabel('Nombre de 0,20 €').fill('1')
  check((await ecart()).includes('Caisse juste'), 'avec 0,20 € : caisse juste')
  await sheet.getByRole('button', { name: 'Enregistrer le comptage' }).click()
  await page.getByText('Caisse juste : 0.00 €').waitFor()
  await page.getByRole('button', { name: 'Recompter' }).click()
  await sheet.getByLabel('Nombre de 5 €').fill('0')
  await sheet.getByRole('button', { name: 'Enregistrer le comptage' }).click()
  await page.getByText('Manquant : −5.00 €').waitFor()
  check(true, 'recomptage : manquant −5.00 €')

  await page.getByRole('link', { name: 'Récap' }).click()
  await page.getByRole('button', { name: 'Z du jour' }).click()
  await z.getByText('Espèces comptées', { exact: false }).waitFor()
  check((await z.locator('.print-zone').innerText()).includes('−5.00 €'), 'Z : écart du comptage')
  await page.keyboard.press('Escape')

  // L'export .db contient le comptage, table du desktop inchangée
  await page.goto(url + 'admin')
  await page.getByRole('button', { name: 'Données' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exporter la base/ }).click()])
  const SQL = await initSqlJs()
  const exp = new SQL.Database(readFileSync(await dl.path()))
  check(exp.exec('SELECT montant FROM comptage_caisse')[0]?.values[0][0] === 194.7, 'export .db : comptage présent')
  check(exp.exec('PRAGMA table_info(fond_caisse)')[0].values.map(r => r[1]).join() === 'id,salon_id,date,montant_initial',
    'export .db : table fond_caisse du desktop inchangée')
  await ctx.close()
}
