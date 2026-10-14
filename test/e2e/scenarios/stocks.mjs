// Filtres par catégorie et alertes de stock bas
import { pageAvecBase, connecter } from '../outils.mjs'
import { baseCategories } from '../bases.mjs'

export const titre = 'Catégories et stock bas'

export default async function ({ browser, url, check }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  const page = await pageAvecBase(ctx, url, baseCategories())
  await connecter(page, url, 'Salon des vins')
  const chips = page.getByRole('group', { name: 'Filtrer les articles' })
  await chips.waitFor()
  check((await chips.getByRole('button').allInnerTexts()).join('|') === 'Tous|Blancs|Bulles|Rouges|Sans catégorie|Stock bas (1)',
    'puces : catégories, sans catégorie, stock bas')
  const cartes = async () => (await page.locator('.grid > button').allInnerTexts()).map(t => t.split('\n')[0]).join()
  await chips.getByRole('button', { name: 'Rouges' }).click()
  check(await cartes() === 'Chinon rouge,Saumur-Champigny', 'filtre Rouges')
  await chips.getByRole('button', { name: /Stock bas/ }).click()
  check(await cartes() === 'Vouvray sec', 'filtre Stock bas')
  await chips.getByRole('button', { name: 'Rouges' }).click()
  await page.getByLabel('Rechercher un article').fill('saumur')
  check(await cartes() === 'Saumur-Champigny', 'filtre + recherche')
  await page.getByLabel('Rechercher un article').fill('')
  await page.reload()
  await chips.waitFor()
  check(await chips.getByRole('button', { name: 'Rouges' }).getAttribute('aria-pressed') === 'true', 'filtre mémorisé')

  // Vente qui fait passer Chinon sous le seuil (7 − 2 = 5)
  await page.getByRole('button', { name: /^Chinon rouge/ }).click()
  await page.getByRole('button', { name: 'Augmenter la quantité' }).click()
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('button', { name: 'CB' }).click()
  await page.getByRole('button', { name: 'Valider la vente' }).click()
  const alerte = page.getByRole('status').filter({ hasText: 'Stock bas' })
  await alerte.waitFor()
  check((await alerte.innerText()).includes('Chinon rouge (5 restants)'), 'alerte après la vente')

  // Seuil réglable dans Stocks
  await page.getByRole('link', { name: 'Stocks' }).click()
  const bandeau = page.getByRole('status')
  await bandeau.waitFor()
  check((await bandeau.innerText()).includes('Chinon rouge (5)') && (await bandeau.innerText()).includes('Vouvray sec (3)'), 'bandeau Stocks')
  const ligne = page.locator('.card').filter({ hasText: 'Crémant de Loire' })
  await ligne.getByRole('button', { name: 'Modifier' }).click()
  await page.getByLabel('Alerte de stock bas à partir de').fill('25')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await ligne.getByText('alerte ≤ 25').waitFor()
  check((await bandeau.innerText()).includes('Crémant de Loire (20)'), 'seuil 25 : Crémant en stock bas')
  await page.getByRole('link', { name: 'Vente' }).click()
  check(await chips.getByRole('button', { name: 'Stock bas (3)' }).isVisible(), 'Vente : « Stock bas (3) »')
  await ctx.close()
}
