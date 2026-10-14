/**
 * Lecture d'un catalogue d'articles (CSV ou tableau Excel déjà extrait) —
 * fonctions pures, testables sous Node (voir test/smoke.mjs).
 * Les colonnes sont reconnues par leur titre, dans n'importe quel ordre.
 */

/** Titre de colonne → forme comparable : « Prix carton (€) » → « prix carton » */
export function normaliserEntete(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
}

// Titres acceptés pour chaque champ (déjà normalisés)
export const COLONNES = {
  nom: ['nom', 'article', 'produit', 'designation', 'libelle', 'nom article', 'nom produit', 'vin', 'cuvee'],
  prix: ['prix', 'prix unitaire', 'prix ttc', 'prix de vente', 'prix vente', 'tarif', 'pu', 'prix bouteille', 'prix unite'],
  categorie: ['categorie', 'famille', 'type', 'rayon', 'couleur'],
  carton_taille: ['carton', 'taille carton', 'taille du carton', 'carton taille', 'unites par carton',
    'bouteilles par carton', 'nb par carton', 'colisage'],
  carton_prix: ['prix carton', 'prix du carton', 'carton prix', 'tarif carton'],
  stock: ['stock', 'stock initial', 'quantite', 'qte'],
}

/** Index de chaque champ dans la ligne de titres (absent = pas de clé). */
export function trouverColonnes(entetes) {
  const idx = {}
  entetes.forEach((t, i) => {
    const n = normaliserEntete(t)
    for (const [champ, noms] of Object.entries(COLONNES)) {
      if (idx[champ] === undefined && noms.includes(n)) idx[champ] = i
    }
  })
  if (idx.nom === undefined || idx.prix === undefined) {
    throw new Error('Colonnes « Nom » et « Prix » introuvables : la première ligne doit contenir les titres des colonnes.')
  }
  return idx
}

const ligneVide = r => r.every(c => c === null || c === undefined || String(c).trim() === '')

/**
 * Tableau 2D (lignes × cellules) → lignes du catalogue pour ops.importerCatalogue.
 * La première ligne non vide contient les titres ; ligne = numéro dans le fichier.
 */
export function lignesCatalogue(tableau) {
  const debut = tableau.findIndex(r => !ligneVide(r))
  if (debut < 0) throw new Error('Le fichier est vide.')
  const idx = trouverColonnes(tableau[debut])
  const out = []
  for (let i = debut + 1; i < tableau.length; i++) {
    const r = tableau[i]
    if (ligneVide(r)) continue
    const l = { ligne: i + 1 }
    for (const [champ, j] of Object.entries(idx)) l[champ] = r[j] ?? ''
    out.push(l)
  }
  if (out.length === 0) throw new Error('Aucun article sous la ligne de titres.')
  return out
}

/** Octets → texte : UTF-8 (BOM retiré), sinon Windows-1252 (CSV d'Excel français). */
export function decoderTexte(bytes) {
  let texte
  try {
    texte = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    texte = new TextDecoder('windows-1252').decode(bytes)
  }
  return texte.replace(/^﻿/, '')
}

/** CSV → tableau 2D. Séparateur détecté (; , ou tabulation), guillemets gérés. */
export function lireCsv(texte) {
  const premiere = texte.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '')
  const sep = [';', ',', '\t'].reduce((best, s) =>
    premiere.split(s).length > premiere.split(best).length ? s : best, ';')
  const lignes = []
  let ligne = []
  let champ = ''
  let guillemets = false
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++ }
      else if (c === '"') guillemets = false
      else champ += c
    } else if (c === '"') {
      guillemets = true
    } else if (c === sep) {
      ligne.push(champ); champ = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++
      ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''
    } else {
      champ += c
    }
  }
  if (champ !== '' || ligne.length > 0) { ligne.push(champ); lignes.push(ligne) }
  return lignes
}
