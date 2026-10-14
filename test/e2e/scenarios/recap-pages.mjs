// Récap paginé : 50 entrées à la fois, « Afficher les suivantes », filtre par jour, annulation en page 2
import { pageAvecBase, connecter } from '../outils.mjs'
import { baseGrandSalon } from '../bases.mjs'

export const titre = 'Récap paginé'

export default async function ({ browser, url, check }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' })
  const page = await pageAvecBase(ctx, url, baseGrandSalon(130))
  await connecter(page, url, 'Grand salon')
  await page.getByRole('link', { name: 'Récap' }).click()
  const tickets = page.getByRole('button', { name: /^Ticket n°/ })
  const plus = page.getByRole('button', { name: /^Afficher les \d+ suivantes/ })
  await plus.waitFor()
  check(await tickets.count() === 50, `première page : 50 tickets (${await tickets.count()})`)
  check((await tickets.first().getAttribute('aria-label')).startsWith('Ticket n°130,'), 'le plus récent en premier (n°130)')
  check((await plus.innerText()).includes('50 sur 130'), 'compteur « 50 sur 130 »')
  await plus.click()
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Ticket n°"]').length === 100)
  check((await plus.innerText()).startsWith('Afficher les 30 suivantes'), 'deuxième page : 100, reste 30')
  await plus.click()
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Ticket n°"]').length === 130)
  check(await plus.count() === 0, 'tout affiché : plus de bouton')
  const nums = (await tickets.evaluateAll(els => els.map(e => Number(e.getAttribute('aria-label').match(/n°(\d+)/)[1]))))
  check(nums.every((n, i) => i === 0 || nums[i - 1] > n) && new Set(nums).size === 130, 'ordre décroissant, sans doublon')

  // Annuler un ticket de la page 2 : la liste garde ses 130 entrées
  await page.getByRole('button', { name: /^Ticket n°60,/ }).click()
  const recu = page.getByRole('dialog', { name: 'Ticket n°60' })
  await recu.getByRole('button', { name: 'Annuler le ticket' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Annuler le ticket' }).click()
  await recu.getByText(/Ticket annulé/).waitFor()
  await recu.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: /^Ticket n°60 \(annulé\)/ }).waitFor()
  check(await tickets.count() === 130, 'après annulation : les 130 entrées restent affichées')

  // Filtre par jour : 100 tickets aujourd'hui, paginés aussi
  await page.getByLabel('Filtrer par date').selectOption({ index: 1 })
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Ticket n°"]').length === 50)
  check((await plus.innerText()).includes('50 sur 100'), 'aujourd’hui : 50 sur 100')
  await page.getByLabel('Filtrer par date').selectOption({ index: 2 })
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Ticket n°"]').length === 30)
  check(await plus.count() === 0, 'hier : 30 tickets, pas de bouton')
  await ctx.close()
}
