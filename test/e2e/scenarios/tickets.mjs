// Remises (article + ticket), reçu, annulation de ticket
import { pageAvecBase, connecter } from '../outils.mjs'
import { baseTickets } from '../bases.mjs'

export const titre = 'Tickets et remises'

export default async function ({ browser, url, check }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
  const page = await pageAvecBase(ctx, url, baseTickets())
  await connecter(page, url, 'Salon des vins')
  const carte = nom => page.getByRole('button', { name: new RegExp('^' + nom) })
  const sheet = page.getByRole('dialog').last()

  // Chinon × 3 −10 % = 26.73
  await carte('Chinon').click()
  await sheet.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await sheet.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await sheet.getByRole('button', { name: '%', exact: true }).click()
  await sheet.getByLabel('Remise en pourcentage').fill('10')
  check((await sheet.innerText()).includes('= 26.73 €'), 'remise −10 % : 26.73 €')
  await sheet.getByRole('button', { name: 'Ajouter au panier' }).click()

  // Remise trop forte bloquée
  await carte('Crémant').click()
  await sheet.getByRole('button', { name: '€', exact: true }).click()
  await sheet.getByLabel('Remise en euros').fill('20')
  check((await sheet.getByRole('alert').innerText()).includes('dépasse') &&
    await sheet.getByRole('button', { name: 'Ajouter au panier' }).isDisabled(), 'remise 20 € sur 14 € : bloquée')
  await sheet.getByRole('button', { name: 'Fermer' }).click()

  // Vouvray −2.50 €, puis −5 % sur le ticket
  await carte('Vouvray').click()
  await sheet.getByRole('button', { name: '€', exact: true }).click()
  await sheet.getByLabel('Remise en euros').fill('2,50')
  await sheet.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('button', { name: 'Remise sur le ticket' }).click()
  await page.getByLabel('Remise en pourcentage').fill('5')
  const panier = await page.locator('.card').filter({ hasText: 'Panier' }).innerText()
  check(panier.includes('36.73 €') && panier.includes('−1.84 €') && panier.includes('34.89 €') &&
    panier.includes('dont 7.31 € de remises'), 'ticket : 36.73 − 5 % = 34.89, dont 7.31 € de remises')
  await page.getByRole('group', { name: 'Montants rapides' }).getByRole('button', { name: '40 €' }).click()
  await page.getByRole('button', { name: 'Valider la vente' }).click()
  await page.getByText('Ticket n°1 enregistré').first().waitFor()

  // Reçu
  await page.getByRole('button', { name: 'Reçu' }).click()
  const recu = page.getByRole('dialog', { name: 'Ticket n°1' })
  const rt = await recu.locator('.print-zone').innerText()
  check(rt.includes('Remise −10 %') && rt.includes('Remise ticket −5 %') && rt.includes('34.89 €') &&
    rt.includes('remis 40.00 € · rendu 5.11 €'), 'reçu : remises, total, rendu')
  await recu.getByRole('button', { name: 'Partager' }).click()
  check((await page.evaluate(() => navigator.clipboard.readText())).includes('TOTAL : 34.89 €'), 'reçu partagé en texte')
  await recu.getByRole('button', { name: 'Fermer' }).click()

  // Récap : ticket + ligne sans ticket
  await page.getByRole('link', { name: 'Récap' }).click()
  await page.getByText('Total des ventes').waitFor()
  check(await page.locator('.text-3xl').first().innerText() === '62.89 €', 'Récap : 34.89 + 28.00 (ligne PC)')
  const ticketCarte = page.getByRole('button', { name: /^Ticket n°1/ })
  check((await ticketCarte.innerText()).includes('remise −7.31 €'), 'Récap : carte du ticket avec la remise')
  check(await page.getByRole('button', { name: 'Supprimer la vente de Crémant de Loire' }).isVisible(), 'ligne PC supprimable à l’unité')

  // Annulation
  await ticketCarte.click()
  await recu.getByRole('button', { name: 'Annuler le ticket' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Annuler le ticket' }).click()
  await recu.getByText(/Ticket annulé/).waitFor()
  await recu.getByRole('button', { name: 'Fermer' }).click()
  await page.waitForFunction(() => document.querySelector('.text-3xl')?.innerText === '28.00 €')
  check((await page.getByRole('button', { name: /^Ticket n°1 \(annulé\)/ }).innerText()).includes('Annulé'), 'ticket annulé, CA 28.00')
  await page.getByRole('link', { name: 'Stocks' }).click()
  await page.getByText('Chinon rouge 2022').waitFor()
  check((await page.locator('.card').filter({ hasText: 'Chinon rouge 2022' }).innerText()).includes('100'), 'stock restauré (100)')
  await ctx.close()
}
