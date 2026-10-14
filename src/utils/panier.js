/**
 * Brouillon de vente conservé par salon (panier, remises, paiement en cours), pour ne
 * rien perdre en changeant d'onglet ou si l'app se recharge. Stockage local
 * best effort : l'app fonctionne normalement s'il est indisponible.
 */
const key = salonId => `panier:${salonId}`

export const BROUILLON_VIDE = {
  panier: [],
  modePaiement: 'Especes',
  espClient: '',
  mixte: { especes: '', cb: '', cheque: '' },
  remiseTicket: null, // { type: 'pct' | 'eur', valeur: texte } en cours de saisie
}

export function lireBrouillon(salonId) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(salonId)))
    if (saved && Array.isArray(saved.panier)) return { ...BROUILLON_VIDE, ...saved }
  } catch { /* stockage indisponible ou contenu illisible */ }
  return BROUILLON_VIDE
}

export function ecrireBrouillon(salonId, brouillon) {
  try {
    if (brouillon.panier.length === 0) localStorage.removeItem(key(salonId))
    else localStorage.setItem(key(salonId), JSON.stringify(brouillon))
  } catch { /* quota ou navigation privée : non bloquant */ }
}

/**
 * Remplace les fiches article du panier par les fiches à jour (prix, stock)
 * et retire les lignes devenues impossibles : article retiré du salon,
 * ou carton supprimé de l'article.
 */
export function reconcilierPanier(panier, produits) {
  return panier.flatMap(item => {
    const frais = produits.find(p => p.produit_id === item.produit.produit_id)
    if (!frais) return []
    if (item.unite === 'carton' && !(frais.carton_taille && frais.carton_prix != null)) return []
    return [{ ...item, produit: frais }]
  })
}
