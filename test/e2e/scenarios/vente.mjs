// Vente depuis une base vide : arrondis, stock au panier, mixte, montants rapides, panier conservé, fond de caisse
import { connecter } from '../outils.mjs'

export const titre = 'Vente : création, paiement, panier conservé'

export default async function ({ browser, url, check }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  const page = await ctx.newPage()
  await connecter(page, url)
  await page.getByRole('button', { name: 'Nouveau' }).click()
  await page.fill('input[placeholder="Nom du salon *"]', 'Test')
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.getByText('Test', { exact: true }).click()
  await page.goto(url + 'admin')
  await page.getByRole('button', { name: 'Nouvel article' }).click()
  await page.fill('input[placeholder="Nom de l\'article *"]', 'Rouge')
  await page.fill('input[placeholder="0.00"]', '9.90')
  await page.locator('form button[type=submit]').click()
  await page.getByRole('button', { name: 'Salon' }).click()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.getByRole('button', { name: 'Stock', exact: true }).click()
  await page.fill('#adm-stock-init', '4')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByRole('link', { name: 'Vente' }).click()

  const carte = () => page.getByRole('button', { name: /^Rouge/ })
  const plus = page.getByRole('button', { name: 'Augmenter la quantité' })
  await carte().click()
  await plus.click(); await plus.click()
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  check(!(await carte().innerText()).trim().startsWith('0'), 'carte sans « 0 » parasite (article sans photo)')

  // Montants rapides pour 3 × 9.90 = 29.70
  const rapides = page.getByRole('group', { name: 'Montants rapides' })
  const labels = await rapides.getByRole('button').allInnerTexts()
  check(labels.join('|') === 'Exact|30 €|40 €|50 €', `montants rapides : ${labels.join(' | ')}`)
  await rapides.getByRole('button', { name: '30 €' }).click()
  check(await page.inputValue('#esp-client') === '30.00', 'un appui remplit le montant remis')
  check((await page.getByText('Rendu monnaie').locator('..').innerText()).includes('0.30'), 'rendu 0.30 €')

  // Panier conservé : changement d'onglet puis rechargement
  await page.getByRole('link', { name: 'Stocks' }).click()
  await page.getByRole('link', { name: 'Vente' }).click()
  check(await page.inputValue('#esp-client') === '30.00', 'panier et montant conservés après changement d’onglet')
  await page.reload()
  await page.getByPlaceholder('Rechercher un article…').waitFor()
  check(await page.getByText('× 3').count() === 1, 'panier conservé après rechargement')
  check((await carte().innerText()).includes('1'), 'stock affiché déduit du panier (4 − 3 = 1)')

  // 29.70 exact accepté (arrondi au centime)
  await rapides.getByRole('button', { name: 'Exact' }).click()
  await page.getByRole('button', { name: 'Valider la vente' }).click()
  check(await page.getByText(/Ticket n°1 enregistré/).first().waitFor({ timeout: 5000 }).then(() => true, () => false),
    '3 × 9.90 payé 29.70 : accepté, ticket n°1')

  // Stock : + bloqué au dernier exemplaire, article épuisé non cliquable
  await carte().click()
  check(await plus.isDisabled(), 'bouton + bloqué au dernier exemplaire')
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  check(await page.getByRole('button', { name: /Rouge — épuisé/ }).isDisabled(), 'article épuisé (panier déduit) non cliquable')

  // Mixte : trop-perçu signalé
  await page.getByRole('button', { name: 'Mixte' }).click()
  await page.fill('#mixte-cb', '15')
  check(await page.getByText('Trop-perçu').isVisible(), 'mixte : trop-perçu affiché')
  await page.fill('#mixte-cb', '9.90')
  check(await page.getByText('Reste à répartir').isVisible(), 'mixte : écart nul')

  // Vider le panier efface aussi le brouillon
  await page.getByRole('button', { name: 'Vider' }).click()
  await page.reload()
  await page.getByPlaceholder('Rechercher un article…').waitFor()
  check(!(await page.getByText('Panier', { exact: true }).isVisible()), 'Vider : panier effacé, même après rechargement')

  // Fond de caisse : date du jour en heure locale
  await page.getByRole('link', { name: 'Caisse' }).click()
  await page.getByRole('button', { name: 'Ajouter un jour' }).click()
  const d = new Date(), pad = n => String(n).padStart(2, '0')
  check(await page.inputValue('input[type=date]') === `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    'fond de caisse : date du jour en heure locale')
  await ctx.close()
}
