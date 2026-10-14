/**
 * Niveaux de stock, catégories et alertes de stock bas — fonctions pures,
 * testables sous Node (voir test/smoke.mjs).
 */

/** 'epuise' (≤ 0), 'bas' (≤ seuil) ou 'ok'. */
export function niveauStock(dispo, seuil) {
  if (dispo <= 0) return 'epuise'
  if (dispo <= seuil) return 'bas'
  return 'ok'
}

export const SANS_CATEGORIE = '__sans'
export const STOCK_BAS = '__bas'

/** Catégories présentes (triées), et s'il existe des articles sans catégorie. */
export function categoriesDe(produits) {
  const noms = new Set()
  let sans = false
  for (const p of produits) {
    const c = (p.categorie || '').trim()
    if (c) noms.add(c)
    else sans = true
  }
  return {
    categories: [...noms].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    sansCategorie: sans,
  }
}

/** Filtre de la grille : toutes, une catégorie, sans catégorie, ou stock bas / épuisé. */
export function filtrerProduits(produits, filtre, dispo) {
  if (!filtre) return produits
  if (filtre === STOCK_BAS) return produits.filter(p => niveauStock(dispo(p), p.seuil_alerte) !== 'ok')
  if (filtre === SANS_CATEGORIE) return produits.filter(p => !(p.categorie || '').trim())
  return produits.filter(p => (p.categorie || '').trim() === filtre)
}

/**
 * Articles qui passent sous leur seuil (ou s'épuisent) avec une vente :
 * avant = stock avant la vente, vendus = unités de la vente, par article.
 * → [{ nom, restant, niveau }]
 */
export function alertesFranchies(produits, vendus) {
  const out = []
  for (const p of produits) {
    const n = vendus[p.produit_id]
    if (!n) continue
    const restant = p.stock_restant - n
    const avant = niveauStock(p.stock_restant, p.seuil_alerte)
    const apres = niveauStock(restant, p.seuil_alerte)
    if (apres !== 'ok' && apres !== avant) out.push({ nom: p.nom, restant, niveau: apres })
  }
  return out
}

/** « Stock bas : Chinon (3 restants) · Épuisé : Vouvray » */
export function messageAlertes(alertes) {
  const bas = alertes.filter(a => a.niveau === 'bas').map(a => `${a.nom} (${a.restant} restant${a.restant > 1 ? 's' : ''})`)
  const epuises = alertes.filter(a => a.niveau === 'epuise').map(a => a.nom)
  return [
    bas.length && `Stock bas : ${bas.join(', ')}`,
    epuises.length && `Épuisé : ${epuises.join(', ')}`,
  ].filter(Boolean).join(' · ')
}
