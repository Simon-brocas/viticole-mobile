// TVA par article (20 % / 5,5 %) et remise saisie par le prix final
import { pageAvecBase, connecter } from '../outils.mjs'
import { baseTva } from '../bases.mjs'

export const titre = 'TVA et remise par le prix'

export default async function ({ browser, url, check }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin })
  const page = await pageAvecBase(ctx, url, baseTva())
  await connecter(page, url, 'Salon des vins')

  // Admin : le jus passe à 5,5 %
  await page.goto(url + 'admin')
  await page.getByRole('button', { name: 'Articles' }).click()
  await page.getByRole('button', { name: 'Modifier Jus de raisin' }).click()
  const tva = page.getByRole('group', { name: 'Taux de TVA' })
  check(await tva.getByRole('button', { name: '20 %' }).getAttribute('aria-pressed') === 'true', 'fiche article : 20 % par défaut')
  await tva.getByRole('button', { name: '5,5 %' }).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByText('Modifier l’article').waitFor({ state: 'hidden' })
  const carteAdmin = nom => page.locator('.card').filter({ hasText: nom }).first().innerText()
  check((await carteAdmin('Jus de raisin')).includes('TVA 5,5 %') && (await carteAdmin('Chinon rouge')).includes('TVA 20 %'),
    'liste des articles : taux affichés')

  // Vente : Chinon × 3 au prix de 25 €, jus × 2, ticket au prix de 30 €
  await page.getByRole('link', { name: 'Vente' }).click()
  const sheet = page.getByRole('dialog').last()
  await page.getByRole('button', { name: /^Chinon rouge/ }).click()
  await sheet.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await sheet.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await sheet.getByRole('button', { name: 'Prix', exact: true }).click()
  await sheet.getByLabel('Prix après remise').fill('30')
  check((await sheet.getByRole('alert').innerText()).includes('dépasse le montant de la ligne (29.70 €)') &&
    await sheet.getByRole('button', { name: 'Ajouter au panier' }).isDisabled(), 'prix au-dessus du montant : bloqué')
  await sheet.getByLabel('Prix après remise').fill('25')
  const st = await sheet.innerText()
  check(st.includes('soit une remise de 4.70 € (−15,8 %)') && st.includes('= 25.00 €'), 'prix 25 € : remise 4.70 € calculée')
  await sheet.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('button', { name: /^Jus de raisin/ }).click()
  await sheet.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await sheet.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('button', { name: 'Remise sur le ticket' }).click()
  await page.getByRole('button', { name: 'Prix', exact: true }).click()
  await page.getByLabel('Prix après remise').fill('30')
  const panier = await page.locator('.card').filter({ hasText: 'Panier' }).innerText()
  check(panier.includes('prix 25.00 €') && panier.includes('32.00 €') && panier.includes('30.00 €') &&
    panier.includes('dont 6.70 € de remises'), 'panier : 32.00 au prix de 30.00, dont 6.70 € de remises')
  await page.getByRole('button', { name: 'CB' }).click()
  await page.getByRole('button', { name: 'Valider la vente' }).click()
  await page.getByText('Ticket n°1 enregistré').first().waitFor()

  // Reçu : remises par le prix et TVA par taux
  await page.getByRole('button', { name: 'Reçu' }).click()
  const recu = page.getByRole('dialog', { name: 'Ticket n°1' })
  const rt = await recu.locator('.print-zone').innerText()
  check(rt.includes('Remise (prix 25.00 €)') && rt.includes('Remise ticket (prix 30.00 €)'), 'reçu : remises par le prix')
  const lignesTva = await recu.getByRole('table', { name: 'TVA par taux' }).locator('tbody tr').allInnerTexts()
  check(lignesTva.length === 2 && lignesTva[0].replace(/\s+/g, ' ') === '20 % 19.53 € 3.91 € 23.44 €' &&
    lignesTva[1].replace(/\s+/g, ' ') === '5,5 % 6.22 € 0.34 € 6.56 €', `reçu : TVA 20 % et 5,5 % (${lignesTva})`)
  await recu.getByRole('button', { name: 'Partager' }).click()
  check((await page.evaluate(() => navigator.clipboard.readText())).includes('dont TVA 5,5 % : 0.34 € (HT 6.22 €)'),
    'reçu partagé : TVA')
  await recu.getByRole('button', { name: 'Fermer' }).click()

  // Remise de 5 % puis prix arrondi en un appui (18.81 → 18.80) ou retapé
  await page.getByRole('button', { name: /^Chinon rouge/ }).click()
  await sheet.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await sheet.getByRole('button', { name: '%', exact: true }).click()
  await sheet.getByLabel('Remise en pourcentage').fill('5')
  check((await sheet.innerText()).includes('−0.99 € → 18.81 €'), '5 % sur 19.80 : prix obtenu 18.81 €')
  await sheet.getByRole('button', { name: 'Prix arrondi à 18.80 €' }).click()
  check(await sheet.getByLabel('Prix après remise').inputValue() === '18.80' &&
    (await sheet.innerText()).includes('soit une remise de 1.00 € (−5,1 %)'), 'appui sur 18.80 € : mode Prix, remise 1.00 €')
  await sheet.getByRole('button', { name: '%', exact: true }).click()
  await sheet.getByLabel('Remise en pourcentage').fill('5')
  await sheet.getByRole('button', { name: 'Autre prix' }).click()
  const champPrix = sheet.getByLabel('Prix après remise')
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Prix après remise')
  check(await champPrix.inputValue() === '18.81' && await champPrix.evaluate(e => e.selectionEnd - e.selectionStart === 5),
    '« Autre prix » : 18.81 repris, champ prêt à la saisie')
  await page.keyboard.type('18.5')
  check((await sheet.innerText()).includes('= 18.50 €'), 'prix retapé : 18.50 €')
  await sheet.getByRole('button', { name: 'Fermer' }).click()

  // Récap et Z : TVA collectée
  await page.getByRole('link', { name: 'Récap' }).click()
  await page.getByText('HT 25.75 € · TVA 4.25 €').waitFor()
  check(true, 'Récap : HT 25.75 € · TVA 4.25 €')
  await page.getByRole('button', { name: 'Z du jour' }).click()
  const z = page.getByRole('dialog', { name: 'Z de caisse' })
  await z.getByText("Chiffre d'affaires").waitFor()
  const zt = await z.locator('.print-zone').innerText()
  check(zt.toLowerCase().includes('tva collectée : 4.25 €') && zt.replace(/\s+/g, ' ').includes('Total 25.75 € 4.25 € 30.00 €'),
    'Z : TVA collectée par taux, avec total')
  await ctx.close()
}
