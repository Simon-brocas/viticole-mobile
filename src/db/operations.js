/**
 * Logique métier — portage fidèle de backend/app.py (Flask) sur une base sql.js.
 * Toutes les fonctions prennent l'instance de base en premier argument et sont
 * indépendantes du navigateur (testables sous Node, voir test/smoke.mjs).
 */

export const DEFAULT_PASSWORD = 'admin123'
export const PAY_MODES = ['Especes', 'CB', 'Cheque', 'Mixte']
export const SALE_TYPES = ['normal', 'degustation', 'offert']

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

// ── Helpers SQL ───────────────────────────────────────────────────────────────

export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

export function queryOne(db, sql, params = []) {
  return queryAll(db, sql, params)[0] ?? null
}

function run(db, sql, params = []) {
  db.run(sql, params)
}

function lastId(db) {
  return queryOne(db, 'SELECT last_insert_rowid() AS id').id
}

export const round2 = x => Math.round(x * 100) / 100

const pad = n => String(n).padStart(2, '0')

/** Vrai si s est une date AAAA-MM-JJ valide. */
export function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
}

/** Date du jour au format AAAA-MM-JJ en heure locale (toISOString donnerait l'UTC). */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nowDateTime() {
  const d = new Date()
  return {
    date: localDate(d),
    heure: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    stamp: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${String(d.getMilliseconds()).padStart(3, '0')}`,
  }
}

// ── Schéma (identique à init_db du desktop) ───────────────────────────────────

export function initSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin'
    );
    CREATE TABLE IF NOT EXISTS salons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        date_debut TEXT,
        date_fin TEXT,
        lieu TEXT DEFAULT '',
        actif INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        photo BLOB,
        photo_updated TEXT
    );
    CREATE TABLE IF NOT EXISTS produits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prix REAL NOT NULL,
        categorie TEXT DEFAULT '',
        actif INTEGER DEFAULT 1,
        carton_taille INTEGER,
        carton_prix REAL,
        photo BLOB,
        photo_updated TEXT
    );
    CREATE TABLE IF NOT EXISTS salon_produits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        salon_id INTEGER REFERENCES salons(id),
        produit_id INTEGER REFERENCES produits(id),
        selectionne INTEGER DEFAULT 0,
        stock_initial REAL DEFAULT 0,
        stock_restant REAL DEFAULT 0,
        UNIQUE(salon_id, produit_id)
    );
    CREATE TABLE IF NOT EXISTS ventes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        salon_id INTEGER REFERENCES salons(id),
        produit_id INTEGER REFERENCES produits(id),
        type_quantite TEXT DEFAULT 'normal',
        quantite REAL DEFAULT 1,
        unite TEXT DEFAULT 'bouteille',
        nb_bouteilles REAL DEFAULT 0,
        prix_unitaire REAL DEFAULT 0,
        mode_paiement TEXT,
        total REAL DEFAULT 0,
        montant_especes REAL DEFAULT 0,
        montant_cb REAL DEFAULT 0,
        montant_cheque REAL DEFAULT 0,
        date TEXT,
        heure TEXT,
        user_id INTEGER,
        sync_id TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fond_caisse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        salon_id INTEGER REFERENCES salons(id),
        date TEXT NOT NULL,
        montant_initial REAL DEFAULT 0,
        UNIQUE(salon_id, date)
    );
    -- Propre au mobile (ignorée par le desktop) : comptage de fin de journée
    CREATE TABLE IF NOT EXISTS comptage_caisse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        salon_id INTEGER REFERENCES salons(id),
        date TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '{}',
        montant REAL DEFAULT 0,
        heure TEXT,
        UNIQUE(salon_id, date)
    );
    -- Propres au mobile (ignorées par le desktop) : tickets et lignes associées.
    -- lignes = copie figée du reçu (JSON) ; ventes.total reste le montant net,
    -- donc le CA calculé par le desktop tient compte des remises.
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        salon_id INTEGER REFERENCES salons(id),
        numero INTEGER NOT NULL,
        date TEXT NOT NULL,
        heure TEXT,
        mode_paiement TEXT,
        total_brut REAL DEFAULT 0,
        remise_lignes REAL DEFAULT 0,
        remise_ticket REAL DEFAULT 0,
        remise_ticket_type TEXT,
        remise_ticket_valeur REAL,
        total REAL DEFAULT 0,
        montant_especes REAL DEFAULT 0,
        montant_cb REAL DEFAULT 0,
        montant_cheque REAL DEFAULT 0,
        montant_remis REAL,
        rendu REAL,
        lignes TEXT NOT NULL DEFAULT '[]',
        sync_id TEXT UNIQUE,
        annule INTEGER DEFAULT 0,
        annule_le TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(salon_id, numero)
    );
    CREATE TABLE IF NOT EXISTS ticket_ventes (
        vente_id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id)
    );
  `)
  // Migrations idempotentes pour les bases importées depuis le desktop
  const migrations = [
    "ALTER TABLE ventes ADD COLUMN montant_especes REAL DEFAULT 0",
    "ALTER TABLE ventes ADD COLUMN montant_cb REAL DEFAULT 0",
    "ALTER TABLE ventes ADD COLUMN montant_cheque REAL DEFAULT 0",
    "ALTER TABLE ventes ADD COLUMN unite TEXT DEFAULT 'bouteille'",
    "ALTER TABLE ventes ADD COLUMN nb_bouteilles REAL DEFAULT 0",
    "ALTER TABLE produits ADD COLUMN carton_taille INTEGER",
    "ALTER TABLE produits ADD COLUMN carton_prix REAL",
    "ALTER TABLE salons ADD COLUMN photo BLOB",
    "ALTER TABLE salons ADD COLUMN photo_updated TEXT",
    "ALTER TABLE produits ADD COLUMN photo BLOB",
    "ALTER TABLE produits ADD COLUMN photo_updated TEXT",
  ]
  for (const sql of migrations) {
    try {
      db.exec(sql)
    } catch (e) {
      if (!String(e.message || e).toLowerCase().includes('duplicate column')) throw e
    }
  }
  db.exec("UPDATE ventes SET nb_bouteilles = quantite WHERE nb_bouteilles = 0 OR nb_bouteilles IS NULL")
  db.exec("UPDATE ventes SET unite = 'bouteille' WHERE unite IS NULL")
  // Index des ventes (toutes les requêtes filtrent par salon). Sans effet sur
  // la compatibilité : le desktop ouvre une base indexée sans rien changer.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ventes_salon_date ON ventes(salon_id, date, heure);
    CREATE INDEX IF NOT EXISTS idx_ventes_salon_produit ON ventes(salon_id, produit_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_salon_date ON tickets(salon_id, date, heure);
    CREATE INDEX IF NOT EXISTS idx_ticket_ventes_ticket ON ticket_ventes(ticket_id);
  `)
}

export async function ensureAdmin(db, hashPassword) {
  const existing = queryOne(db, "SELECT id FROM users WHERE username = 'admin'")
  if (!existing) {
    const hash = await hashPassword(DEFAULT_PASSWORD)
    run(db, "INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')", [hash])
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

export async function authStatus(db, verifyPassword) {
  const user = queryOne(db, "SELECT password_hash FROM users WHERE username = 'admin'")
  return { default_password: !!user && await verifyPassword(user.password_hash, DEFAULT_PASSWORD) }
}

export async function login(db, verifyPassword, password) {
  const user = queryOne(db, "SELECT * FROM users WHERE username = 'admin'")
  if (!user || !(await verifyPassword(user.password_hash, password))) {
    throw new ApiError('Mot de passe incorrect', 401)
  }
  return user
}

export async function changePassword(db, { verifyPassword, hashPassword }, current, neu) {
  if (!neu || neu.length < 4) {
    throw new ApiError('Le nouveau mot de passe doit faire au moins 4 caractères.')
  }
  const user = queryOne(db, "SELECT * FROM users WHERE username = 'admin'")
  if (!user || !(await verifyPassword(user.password_hash, current))) {
    throw new ApiError('Mot de passe actuel incorrect', 401)
  }
  run(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(neu), user.id])
  return { ok: true }
}

// ── SALONS ────────────────────────────────────────────────────────────────────

const SALON_COLS = `id, nom, date_debut, date_fin, lieu, actif, created_at, photo_updated,
                    photo IS NOT NULL AS has_photo`

export function getSalons(db) {
  return queryAll(db, `SELECT ${SALON_COLS} FROM salons ORDER BY created_at DESC`)
}

export function createSalon(db, data) {
  const nom = (data.nom || '').trim()
  if (!nom) throw new ApiError('Le nom du salon est obligatoire.')
  run(db, 'INSERT INTO salons (nom, date_debut, date_fin, lieu) VALUES (?, ?, ?, ?)',
    [nom, data.date_debut || '', data.date_fin || '', data.lieu || ''])
  const salonId = lastId(db)
  for (const p of queryAll(db, 'SELECT id FROM produits WHERE actif = 1')) {
    run(db, 'INSERT OR IGNORE INTO salon_produits (salon_id, produit_id) VALUES (?, ?)', [salonId, p.id])
  }
  return { id: salonId }
}

export function updateSalon(db, salonId, data) {
  const nom = (data.nom || '').trim()
  if (!nom) throw new ApiError('Le nom du salon est obligatoire.')
  run(db, 'UPDATE salons SET nom=?, date_debut=?, date_fin=?, lieu=?, actif=? WHERE id=?',
    [nom, data.date_debut || '', data.date_fin || '', data.lieu || '',
     (data.actif ?? 1) ? 1 : 0, salonId])
  return { ok: true }
}

// ── PRODUITS ──────────────────────────────────────────────────────────────────

function validateProduit(data) {
  const nom = (data.nom || '').trim()
  if (!nom) throw new ApiError('Le nom du produit est obligatoire.')
  const prix = round2(parseFloat(data.prix))
  if (!Number.isFinite(prix)) throw new ApiError('Prix invalide.')
  if (prix < 0) throw new ApiError('Le prix ne peut pas être négatif.')
  let taille = data.carton_taille
  let cprix = data.carton_prix
  const empty = v => v === null || v === undefined || v === ''
  if (empty(taille) !== empty(cprix)) {
    throw new ApiError('Taille et prix du carton doivent être renseignés ensemble.')
  }
  if (!empty(taille)) {
    taille = parseInt(taille, 10)
    cprix = round2(parseFloat(cprix))
    if (!Number.isFinite(taille) || !Number.isFinite(cprix)) throw new ApiError('Carton invalide.')
    if (taille < 2) throw new ApiError('Un carton doit contenir au moins 2 unités.')
    if (cprix < 0) throw new ApiError('Le prix du carton ne peut pas être négatif.')
  } else {
    taille = null
    cprix = null
  }
  return { nom, prix, categorie: data.categorie || '', carton_taille: taille, carton_prix: cprix }
}

const PRODUIT_COLS = `id, nom, prix, categorie, actif, carton_taille, carton_prix, photo_updated,
                      photo IS NOT NULL AS has_photo`

export function getProduits(db, all = false) {
  const where = all ? '' : 'WHERE actif = 1'
  return queryAll(db, `SELECT ${PRODUIT_COLS} FROM produits ${where} ORDER BY nom`)
}

export function createProduit(db, data) {
  const p = validateProduit(data)
  run(db, 'INSERT INTO produits (nom, prix, categorie, carton_taille, carton_prix) VALUES (?, ?, ?, ?, ?)',
    [p.nom, p.prix, p.categorie, p.carton_taille, p.carton_prix])
  const produitId = lastId(db)
  for (const s of queryAll(db, 'SELECT id FROM salons WHERE actif = 1')) {
    run(db, 'INSERT OR IGNORE INTO salon_produits (salon_id, produit_id) VALUES (?, ?)', [s.id, produitId])
  }
  return { id: produitId }
}

export function updateProduit(db, produitId, data) {
  const p = validateProduit(data)
  run(db, 'UPDATE produits SET nom=?, prix=?, categorie=?, actif=?, carton_taille=?, carton_prix=? WHERE id=?',
    [p.nom, p.prix, p.categorie, (data.actif ?? 1) ? 1 : 0, p.carton_taille, p.carton_prix, produitId])
  return { ok: true }
}

// ── SALON PRODUITS (sélection + stock) ───────────────────────────────────────

export function getSalonProduits(db, salonId) {
  return queryAll(db, `
    SELECT sp.*, p.nom, p.prix, p.categorie, p.carton_taille, p.carton_prix,
           p.photo_updated, p.photo IS NOT NULL AS has_photo
    FROM salon_produits sp
    JOIN produits p ON p.id = sp.produit_id
    WHERE sp.salon_id = ? AND p.actif = 1
    ORDER BY p.nom
  `, [salonId])
}

export function updateSalonProduit(db, salonId, produitId, data) {
  const stockInitial = parseFloat(data.stock_initial ?? 0)
  const stockRestant = parseFloat(data.stock_restant ?? 0)
  if (!Number.isFinite(stockInitial) || !Number.isFinite(stockRestant)) {
    throw new ApiError('Stock invalide.')
  }
  if (stockInitial < 0 || stockRestant < 0) {
    throw new ApiError('Le stock ne peut pas être négatif.')
  }
  run(db, `
    INSERT INTO salon_produits (salon_id, produit_id, selectionne, stock_initial, stock_restant)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(salon_id, produit_id) DO UPDATE SET
        selectionne = excluded.selectionne,
        stock_initial = excluded.stock_initial,
        stock_restant = excluded.stock_restant
  `, [salonId, produitId, data.selectionne ? 1 : 0, stockInitial, stockRestant])
  return { ok: true }
}

// ── PHOTOS (salons & produits) ────────────────────────────────────────────────

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TABLES = ['salons', 'produits']

export function imageMime(data) {
  if (data.length > 2 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (data.length > 7 && png.every((b, i) => data[i] === b)) return 'image/png'
  if (data.length > 11 &&
      data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'image/webp'
  return null
}

function checkPhotoTable(table) {
  if (!PHOTO_TABLES.includes(table)) throw new ApiError('Type de photo inconnu.', 404)
}

/*
 * Les photos sont stockées hors de la base (IndexedDB, voir database.js) pour
 * que la base réécrite après chaque vente reste légère. Dans la base, la
 * colonne photo garde un marqueur : un BLOB vide (X'') = « photo stockée
 * ailleurs ». has_photo (photo IS NOT NULL) reste donc juste, et l'export
 * vers le PC réinjecte les vraies images (internaliserPhotos).
 */

export function getPhoto(db, table, rowId) {
  checkPhotoTable(table)
  const row = queryOne(db, `SELECT photo FROM ${table} WHERE id = ?`, [rowId])
  return row?.photo ?? null // Uint8Array (vide si stockée hors base) ou null
}

export function checkPhoto(table, bytes) {
  checkPhotoTable(table)
  if (!bytes || bytes.length === 0) throw new ApiError('Aucune image reçue.')
  if (bytes.length > MAX_PHOTO_BYTES) throw new ApiError('Image trop volumineuse (5 Mo maximum).', 413)
  if (!imageMime(bytes)) throw new ApiError("Format d'image non reconnu (JPEG, PNG ou WebP attendu).")
}

/** Enregistre dans la base qu'une photo (déjà stockée hors base) est présente. */
export function setPhotoExterne(db, table, rowId) {
  checkPhotoTable(table)
  run(db, `UPDATE ${table} SET photo = X'', photo_updated = ? WHERE id = ?`,
    [nowDateTime().stamp, rowId])
  return { ok: true }
}

/** Photos encore stockées dans la base (format desktop) : [{ table, id, bytes }]. */
export function photosInternes(db) {
  return PHOTO_TABLES.flatMap(table =>
    queryAll(db, `SELECT id, photo FROM ${table} WHERE length(photo) > 0`)
      .map(r => ({ table, id: r.id, bytes: r.photo })))
}

/** Remplace par le marqueur les photos listées, une fois copiées hors base. */
export function externaliserPhotos(db, photos) {
  db.exec('BEGIN')
  try {
    for (const { table, id } of photos) {
      checkPhotoTable(table)
      run(db, `UPDATE ${table} SET photo = X'' WHERE id = ?`, [id])
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  // SQLite garde la place libérée dans le fichier : on le compacte
  if (photos.length > 0) db.exec('VACUUM')
}

/**
 * Marqueurs dont l'image est introuvable hors base (ex. sauvegarde restaurée
 * après suppression de la photo) → NULL, pour que has_photo reste juste.
 */
export function retirerMarqueursOrphelins(db, existe) {
  for (const table of PHOTO_TABLES) {
    const marqueurs = queryAll(db, `SELECT id FROM ${table} WHERE photo IS NOT NULL AND length(photo) = 0`)
    for (const { id } of marqueurs) {
      if (!existe(table, id)) run(db, `UPDATE ${table} SET photo = NULL WHERE id = ?`, [id])
    }
  }
}

/**
 * Réinjecte les vraies images à la place des marqueurs (export vers le PC).
 * getBytes(table, id) → Uint8Array ou null ; une photo introuvable devient NULL.
 */
export function internaliserPhotos(db, getBytes) {
  for (const table of PHOTO_TABLES) {
    const marqueurs = queryAll(db, `SELECT id FROM ${table} WHERE photo IS NOT NULL AND length(photo) = 0`)
    for (const { id } of marqueurs) {
      run(db, `UPDATE ${table} SET photo = ? WHERE id = ?`, [getBytes(table, id) ?? null, id])
    }
  }
}

export function deletePhoto(db, table, rowId) {
  checkPhotoTable(table)
  run(db, `UPDATE ${table} SET photo = NULL, photo_updated = ? WHERE id = ?`,
    [nowDateTime().stamp, rowId])
  return { ok: true }
}

// ── VENTES ────────────────────────────────────────────────────────────────────

export function getVentes(db, salonId, { sansTicket = false } = {}) {
  return queryAll(db, `
    SELECT v.id, v.salon_id, v.produit_id, v.type_quantite, v.quantite, v.unite,
           v.nb_bouteilles, v.prix_unitaire, v.mode_paiement, v.total,
           v.montant_especes, v.montant_cb, v.montant_cheque,
           v.date, v.heure, v.sync_id, v.created_at, p.nom AS produit_nom
    FROM ventes v
    JOIN produits p ON p.id = v.produit_id
    WHERE v.salon_id = ? ${sansTicket ? 'AND v.id NOT IN (SELECT vente_id FROM ticket_ventes)' : ''}
    ORDER BY v.date DESC, v.heure DESC, v.id DESC
  `, [salonId])
}

function validateItem(db, item) {
  const produitId = parseInt(item.produit_id, 10)
  const quantite = parseFloat(item.quantite ?? 0)
  if (!Number.isFinite(produitId) || !Number.isFinite(quantite)) {
    throw new ApiError('Ligne de panier invalide.')
  }
  const typeQ = item.type_quantite || 'normal'
  const unite = item.unite || 'bouteille'
  if (!SALE_TYPES.includes(typeQ)) throw new ApiError(`Type de vente inconnu : ${typeQ}`)
  if (!['bouteille', 'carton'].includes(unite)) throw new ApiError(`Unité inconnue : ${unite}`)
  if (unite === 'carton' && typeQ !== 'normal') throw new ApiError('Le carton est réservé aux ventes normales.')
  if (quantite <= 0) throw new ApiError('La quantité doit être positive.')
  if (typeQ === 'degustation') {
    if (!Number.isInteger(Math.round(quantite * 2 * 1e6) / 1e6)) {
      throw new ApiError('La quantité de dégustation doit être un multiple de 0.5.')
    }
  } else if (!Number.isInteger(quantite)) {
    throw new ApiError('La quantité doit être un nombre entier.')
  }

  const produit = queryOne(db, 'SELECT * FROM produits WHERE id = ?', [produitId])
  if (!produit) throw new ApiError('Produit introuvable.')
  let prixUnitaire, nbBouteilles
  if (unite === 'carton') {
    if (!produit.carton_taille || produit.carton_prix === null || produit.carton_prix === undefined) {
      throw new ApiError(`Pas de carton défini pour ${produit.nom}.`)
    }
    prixUnitaire = produit.carton_prix
    nbBouteilles = quantite * produit.carton_taille
  } else {
    prixUnitaire = produit.prix
    nbBouteilles = quantite
  }
  const total = typeQ === 'normal' ? round2(prixUnitaire * quantite) : 0
  return {
    produit_id: produitId, produit_nom: produit.nom, type_quantite: typeQ,
    unite, quantite, nb_bouteilles: nbBouteilles, carton_taille: produit.carton_taille ?? null,
    prix_unitaire: prixUnitaire, total,
    sync_id: item.sync_id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  }
}

/** Répartit un montant (€) selon des poids, au centime près (plus fort reste). */
export function prorate(amount, weights) {
  const totalW = weights.reduce((s, w) => s + w, 0)
  if (totalW <= 0) return weights.map(() => 0)
  const cents = Math.round(amount * 100)
  const shares = weights.map(w => Math.floor(cents * w / totalW))
  const remainder = cents - shares.reduce((s, x) => s + x, 0)
  const order = weights
    .map((w, i) => ({ i, frac: (cents * w / totalW) % 1 }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < remainder; k++) shares[order[k].i] += 1
  return shares.map(s => s / 100)
}

// ── REMISES ───────────────────────────────────────────────────────────────────
// Remise = { type: 'pct' | 'eur', valeur }. Possible sur une ligne de vente
// normale et/ou sur tout le ticket ; la remise ticket est répartie sur les
// lignes au prorata (au centime près), pour que chaque ventes.total soit net.

export const REMISE_TYPES = ['pct', 'eur']

/** Normalise une remise (null si absente) et la valide. */
export function normaliserRemise(remise) {
  if (remise === null || remise === undefined || remise === '') return null
  if (typeof remise !== 'object' || !REMISE_TYPES.includes(remise.type)) throw new ApiError('Remise invalide.')
  const valeur = round2(parseFloat(remise.valeur))
  if (!Number.isFinite(valeur)) throw new ApiError('Remise invalide.')
  if (valeur <= 0) throw new ApiError('La remise doit être positive.')
  if (remise.type === 'pct' && valeur > 100) throw new ApiError('Une remise ne peut pas dépasser 100 %.')
  return { type: remise.type, valeur }
}

/** Montant (€) d'une remise normalisée appliquée à une base. */
export function montantRemise(remise, base, quoi = 'la ligne') {
  if (!remise) return 0
  if (remise.type === 'pct') return round2(base * remise.valeur / 100)
  if (remise.valeur > base + 0.005) {
    throw new ApiError(`La remise (${remise.valeur.toFixed(2)} €) dépasse le montant de ${quoi} (${base.toFixed(2)} €).`)
  }
  return remise.valeur
}

/**
 * Brut, remises et net de chaque ligne d'un panier, puis du ticket.
 * lignes : [{ type_quantite, prix_unitaire, quantite, remise }] (remise normalisée ou null)
 * Fonction pure, utilisée à l'identique par l'écran de vente pour l'affichage.
 */
export function calculerRemises(lignes, remiseTicket = null) {
  const res = lignes.map(l => {
    if (l.type_quantite !== 'normal') {
      if (l.remise) throw new ApiError('Une remise ne s’applique qu’à une vente (pas aux dégustations ni aux offerts).')
      return { brut: 0, remise_ligne: 0, part_ticket: 0, total: 0 }
    }
    const brut = round2(l.prix_unitaire * l.quantite)
    const remise_ligne = montantRemise(l.remise, brut)
    return { brut, remise_ligne, part_ticket: 0, total: round2(brut - remise_ligne) }
  })
  const sousTotal = round2(res.reduce((s, r) => s + r.total, 0))
  let remise_ticket = 0
  if (remiseTicket) {
    const payantes = lignes.map((l, i) => i).filter(i => lignes[i].type_quantite === 'normal')
    if (payantes.length === 0) throw new ApiError('Remise sur le ticket impossible sans vente.')
    remise_ticket = montantRemise(remiseTicket, sousTotal, 'du ticket')
    const parts = prorate(remise_ticket, payantes.map(i => res[i].total))
    payantes.forEach((i, k) => {
      res[i].part_ticket = parts[k]
      res[i].total = round2(res[i].total - parts[k])
    })
  }
  return {
    lignes: res,
    total_brut: round2(res.reduce((s, r) => s + r.brut, 0)),
    remise_lignes: round2(res.reduce((s, r) => s + r.remise_ligne, 0)),
    sous_total: sousTotal,
    remise_ticket,
    total: round2(sousTotal - remise_ticket),
  }
}

/** Enregistre un panier complet (lignes de vente + ticket) dans une transaction unique. */
export function ajouterVente(db, salonId, data) {
  const rawItems = data.items
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new ApiError('Panier vide.')

  // Idempotence : si toutes les lignes existent déjà, c'est un doublon de requête
  const syncIds = rawItems.map(i => i.sync_id).filter(Boolean)
  if (syncIds.length > 0) {
    const ph = syncIds.map(() => '?').join(',')
    const already = queryOne(db, `SELECT COUNT(*) AS n FROM ventes WHERE sync_id IN (${ph})`, syncIds).n
    if (already === rawItems.length) return { ok: true, duplicate: true }
  }

  const items = rawItems.map(raw => validateItem(db, raw))

  // Remises (lignes puis ticket) : chaque ligne normale porte son montant net
  const remiseTicket = normaliserRemise(data.remise)
  const remisesLignes = rawItems.map(r => normaliserRemise(r.remise))
  const calc = calculerRemises(items.map((i, k) => ({ ...i, remise: remisesLignes[k] })), remiseTicket)
  items.forEach((i, k) => Object.assign(i, calc.lignes[k], { remise: remisesLignes[k] }))

  // Validation du paiement (uniquement si au moins une vente normale)
  const normalItems = items.filter(i => i.type_quantite === 'normal')
  const totalPanier = calc.total
  const mode = data.mode_paiement
  const montants = { especes: 0, cb: 0, cheque: 0 }
  let remis = null
  if (normalItems.length > 0) {
    if (!PAY_MODES.includes(mode)) throw new ApiError('Mode de paiement invalide.')
    if (mode === 'Especes' && data.montant_remis !== undefined && data.montant_remis !== null) {
      remis = parseFloat(data.montant_remis)
      if (!Number.isFinite(remis)) throw new ApiError('Montant remis invalide.')
      if (remis < totalPanier - 0.005) {
        throw new ApiError(`Montant remis insuffisant (${remis.toFixed(2)} € pour ${totalPanier.toFixed(2)} €).`)
      }
    }
    if (mode === 'Mixte') {
      for (const k of Object.keys(montants)) {
        const v = round2(parseFloat(data[`montant_${k}`] || 0))
        if (!Number.isFinite(v)) throw new ApiError('Montants mixtes invalides.')
        montants[k] = v
      }
      if (Object.values(montants).some(v => v < 0)) {
        throw new ApiError('Les montants ne peuvent pas être négatifs.')
      }
      const somme = round2(Object.values(montants).reduce((s, v) => s + v, 0))
      if (Math.abs(somme - totalPanier) > 0.01) {
        throw new ApiError(`Le total des paiements (${somme.toFixed(2)} €) ne correspond pas au panier (${totalPanier.toFixed(2)} €).`)
      }
    }
  }

  // Vérification du stock, agrégée par produit
  const besoin = {}
  for (const i of items) besoin[i.produit_id] = (besoin[i.produit_id] || 0) + i.nb_bouteilles
  for (const [produitId, nb] of Object.entries(besoin)) {
    const sp = queryOne(db, 'SELECT stock_restant FROM salon_produits WHERE salon_id = ? AND produit_id = ?',
      [salonId, produitId])
    const restant = sp ? sp.stock_restant : 0
    if (restant < nb) {
      const nom = items.find(i => i.produit_id === Number(produitId)).produit_nom
      throw new ApiError(`Stock insuffisant pour « ${nom} » (restant : ${restant}, demandé : ${nb}).`, 409)
    }
  }

  // Répartition du paiement mixte au prorata des lignes normales
  if (normalItems.length > 0 && mode === 'Mixte') {
    const weights = normalItems.map(i => i.total)
    for (const key of Object.keys(montants)) {
      const parts = prorate(montants[key], weights)
      normalItems.forEach((i, idx) => { i[`montant_${key}`] = parts[idx] })
    }
  }

  const now = nowDateTime()
  const date = data.date || now.date
  const heure = data.heure || now.heure
  // Répartition par mode pour le ticket
  const parMode = { especes: 0, cb: 0, cheque: 0 }
  if (normalItems.length > 0) {
    if (mode === 'Mixte') Object.assign(parMode, montants)
    else parMode[{ Especes: 'especes', CB: 'cb', Cheque: 'cheque' }[mode]] = totalPanier
  }

  let ticket
  db.exec('BEGIN')
  try {
    for (const i of items) {
      run(db, `
        INSERT INTO ventes
          (salon_id, produit_id, type_quantite, quantite, unite, nb_bouteilles,
           prix_unitaire, mode_paiement, total, date, heure, sync_id,
           montant_especes, montant_cb, montant_cheque)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [salonId, i.produit_id, i.type_quantite, i.quantite, i.unite,
          i.nb_bouteilles, i.prix_unitaire,
          i.type_quantite === 'normal' ? mode : null,
          i.total, date, heure, i.sync_id,
          i.montant_especes || 0, i.montant_cb || 0, i.montant_cheque || 0])
      i.vente_id = lastId(db)
      run(db, `
        UPDATE salon_produits SET stock_restant = stock_restant - ?
        WHERE salon_id = ? AND produit_id = ?
      `, [i.nb_bouteilles, salonId, i.produit_id])
    }
    // Ticket : numéro suivant du salon + copie figée des lignes (le reçu)
    const numero = queryOne(db, 'SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM tickets WHERE salon_id = ?',
      [salonId]).n
    const lignes = items.map(i => ({
      vente_id: i.vente_id, produit_id: i.produit_id, nom: i.produit_nom,
      type: i.type_quantite, unite: i.unite, quantite: i.quantite, carton_taille: i.carton_taille,
      prix_unitaire: i.prix_unitaire, brut: i.brut, remise: i.remise,
      remise_ligne: i.remise_ligne, part_ticket: i.part_ticket, total: i.total,
    }))
    run(db, `
      INSERT INTO tickets
        (salon_id, numero, date, heure, mode_paiement, total_brut, remise_lignes, remise_ticket,
         remise_ticket_type, remise_ticket_valeur, total, montant_especes, montant_cb, montant_cheque,
         montant_remis, rendu, lignes, sync_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [salonId, numero, date, heure, normalItems.length > 0 ? mode : null,
        calc.total_brut, calc.remise_lignes, calc.remise_ticket,
        remiseTicket?.type ?? null, remiseTicket?.valeur ?? null, totalPanier,
        parMode.especes, parMode.cb, parMode.cheque,
        remis === null ? null : round2(remis), remis === null ? null : round2(remis - totalPanier),
        JSON.stringify(lignes),
        data.ticket_sync_id || `t-${Date.now()}-${Math.random().toString(36).slice(2)}`])
    ticket = { id: lastId(db), numero }
    for (const i of items) {
      run(db, 'INSERT INTO ticket_ventes (vente_id, ticket_id) VALUES (?, ?)', [i.vente_id, ticket.id])
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    if (String(e.message || e).includes('UNIQUE constraint failed')) {
      return { ok: true, duplicate: true }
    }
    throw e
  }
  return { ok: true, total: totalPanier, ticket }
}

export function supprimerVente(db, salonId, venteId) {
  const vente = queryOne(db, 'SELECT * FROM ventes WHERE id = ? AND salon_id = ?', [venteId, salonId])
  if (!vente) throw new ApiError('Vente introuvable', 404)
  const lien = queryOne(db, `
    SELECT t.numero FROM ticket_ventes tv JOIN tickets t ON t.id = tv.ticket_id WHERE tv.vente_id = ?
  `, [venteId])
  if (lien) {
    throw new ApiError(`Cette ligne fait partie du ticket n°${lien.numero} : annulez le ticket entier.`, 409)
  }
  db.exec('BEGIN')
  try {
    run(db, `
      UPDATE salon_produits SET stock_restant = stock_restant + ?
      WHERE salon_id = ? AND produit_id = ?
    `, [vente.nb_bouteilles, salonId, vente.produit_id])
    run(db, 'DELETE FROM ventes WHERE id = ?', [venteId])
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { ok: true }
}

// ── TICKETS ───────────────────────────────────────────────────────────────────

function lireTicket(row) {
  let lignes = []
  try { lignes = JSON.parse(row.lignes) } catch { /* copie illisible : ticket sans détail */ }
  return { ...row, lignes, annule: !!row.annule }
}

/** Tickets du salon (annulés compris), du plus récent au plus ancien. */
export function getTickets(db, salonId, date = null) {
  if (date !== null && !isDate(date)) throw new ApiError('Date invalide.')
  const where = date === null ? '' : 'AND date = ?'
  return queryAll(db, `
    SELECT * FROM tickets WHERE salon_id = ? ${where} ORDER BY date DESC, heure DESC, id DESC
  `, date === null ? [salonId] : [salonId, date]).map(lireTicket)
}

/** Un ticket et son salon (pour le reçu). */
export function getTicket(db, salonId, ticketId) {
  const row = queryOne(db, 'SELECT * FROM tickets WHERE id = ? AND salon_id = ?', [ticketId, salonId])
  if (!row) throw new ApiError('Ticket introuvable', 404)
  const salon = queryOne(db, 'SELECT id, nom, lieu FROM salons WHERE id = ?', [salonId])
  return { ...lireTicket(row), salon }
}

/** Lignes de vente enregistrées sans ticket (avant cette version, ou saisies sur le PC). */
export function getVentesSansTicket(db, salonId) {
  return getVentes(db, salonId, { sansTicket: true })
}

/**
 * Annule un ticket : ses lignes de vente sont supprimées (stock restauré, CA
 * recalculé) et le ticket reste dans l'historique, marqué annulé.
 */
export function annulerTicket(db, salonId, ticketId) {
  const ticket = queryOne(db, 'SELECT * FROM tickets WHERE id = ? AND salon_id = ?', [ticketId, salonId])
  if (!ticket) throw new ApiError('Ticket introuvable', 404)
  if (ticket.annule) throw new ApiError(`Le ticket n°${ticket.numero} est déjà annulé.`)
  const ventes = queryAll(db, `
    SELECT v.* FROM ticket_ventes tv JOIN ventes v ON v.id = tv.vente_id WHERE tv.ticket_id = ?
  `, [ticketId])
  db.exec('BEGIN')
  try {
    for (const v of ventes) {
      run(db, 'UPDATE salon_produits SET stock_restant = stock_restant + ? WHERE salon_id = ? AND produit_id = ?',
        [v.nb_bouteilles, salonId, v.produit_id])
      run(db, 'DELETE FROM ventes WHERE id = ?', [v.id])
    }
    run(db, 'DELETE FROM ticket_ventes WHERE ticket_id = ?', [ticketId])
    const now = nowDateTime()
    run(db, 'UPDATE tickets SET annule = 1, annule_le = ? WHERE id = ?', [`${now.date} ${now.heure}`, ticketId])
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { ok: true, numero: ticket.numero }
}

// ── STATS ─────────────────────────────────────────────────────────────────────

const STATS_SQL = `
    SELECT
        COALESCE(SUM(CASE WHEN type_quantite='normal' THEN total ELSE 0 END), 0) AS total_global,
        COALESCE(SUM(CASE WHEN type_quantite='normal' THEN
            CASE WHEN mode_paiement='Especes' THEN total
                 WHEN mode_paiement='Mixte'   THEN montant_especes
                 ELSE 0 END ELSE 0 END), 0) AS total_especes,
        COALESCE(SUM(CASE WHEN type_quantite='normal' THEN
            CASE WHEN mode_paiement='CB'    THEN total
                 WHEN mode_paiement='Mixte' THEN montant_cb
                 ELSE 0 END ELSE 0 END), 0) AS total_cb,
        COALESCE(SUM(CASE WHEN type_quantite='normal' THEN
            CASE WHEN mode_paiement='Cheque' THEN total
                 WHEN mode_paiement='Mixte'  THEN montant_cheque
                 ELSE 0 END ELSE 0 END), 0) AS total_cheque,
        COALESCE(SUM(CASE WHEN type_quantite='normal'      THEN nb_bouteilles ELSE 0 END), 0) AS nb_unites,
        COALESCE(SUM(CASE WHEN type_quantite='normal' AND unite='carton' THEN quantite ELSE 0 END), 0) AS nb_cartons,
        COALESCE(SUM(CASE WHEN type_quantite='degustation' THEN quantite ELSE 0 END), 0) AS nb_degustations,
        COALESCE(SUM(CASE WHEN type_quantite='offert'      THEN quantite ELSE 0 END), 0) AS nb_offerts
    FROM ventes WHERE salon_id = ?
`

/** Statistiques du salon, ou d'une seule journée si date (AAAA-MM-JJ) est fournie. */
export function getStats(db, salonId, date = null) {
  if (date !== null && !isDate(date)) throw new ApiError('Date invalide.')
  const row = date === null
    ? queryOne(db, STATS_SQL, [salonId])
    : queryOne(db, `${STATS_SQL} AND date = ?`, [salonId, date])
  for (const k of ['total_global', 'total_especes', 'total_cb', 'total_cheque']) {
    row[k] = round2(row[k])
  }
  return row
}

// ── FOND DE CAISSE ────────────────────────────────────────────────────────────

const ESPECES_JOUR_SQL = `
    SELECT COALESCE(SUM(
        CASE WHEN mode_paiement='Especes' THEN total
             WHEN mode_paiement='Mixte'   THEN montant_especes
             ELSE 0 END), 0) AS t
    FROM ventes
    WHERE salon_id = ? AND date = ? AND type_quantite = 'normal'
      AND mode_paiement IN ('Especes', 'Mixte')
`

export function getCaisse(db, salonId) {
  const rows = queryAll(db, 'SELECT * FROM fond_caisse WHERE salon_id = ? ORDER BY date', [salonId])
  return rows.map(row => {
    const especes = queryOne(db, ESPECES_JOUR_SQL, [salonId, row.date]).t
    const solde = round2(row.montant_initial + especes)
    const comptage = getComptage(db, salonId, row.date)
    return {
      ...row,
      especes_encaissees: round2(especes),
      solde,
      comptage,
      ecart: comptage ? round2(comptage.montant - solde) : null,
    }
  })
}

export function setCaisse(db, salonId, data) {
  const date = data.date || ''
  if (!isDate(date)) throw new ApiError('Date invalide.')
  const montant = round2(parseFloat(data.montant_initial ?? 0))
  if (!Number.isFinite(montant)) throw new ApiError('Montant invalide.')
  if (montant < 0) throw new ApiError('Le fond de caisse ne peut pas être négatif.')
  run(db, `
    INSERT INTO fond_caisse (salon_id, date, montant_initial) VALUES (?, ?, ?)
    ON CONFLICT(salon_id, date) DO UPDATE SET montant_initial = excluded.montant_initial
  `, [salonId, date, montant])
  return { ok: true }
}

// ── COMPTAGE DE CAISSE (fin de journée) ──────────────────────────────────────
// Billets et pièces comptés, en centimes pour éviter les arrondis flottants.
// L'écart (compté − solde théorique) est recalculé à la lecture : il suit les
// ventes ajoutées ou supprimées après le comptage.

export const COUPURES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1]
const MAX_PAR_COUPURE = 100000

/** Valide un détail { centimes: nombre } et renvoie { detail normalisé, montant en € }. */
export function totalComptage(detail) {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) throw new ApiError('Comptage invalide.')
  const propre = {}
  let centimes = 0
  for (const [k, v] of Object.entries(detail)) {
    const coupure = Number(k)
    if (!COUPURES.includes(coupure)) throw new ApiError(`Coupure inconnue : ${k}`)
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > MAX_PAR_COUPURE) {
      throw new ApiError('Le nombre de billets ou de pièces doit être un entier positif.')
    }
    if (n > 0) {
      propre[coupure] = n
      centimes += coupure * n
    }
  }
  return { detail: propre, montant: centimes / 100 }
}

export function getComptage(db, salonId, date) {
  const row = queryOne(db, 'SELECT detail, montant, heure FROM comptage_caisse WHERE salon_id = ? AND date = ?',
    [salonId, date])
  if (!row) return null
  let detail = {}
  try { detail = JSON.parse(row.detail) } catch { /* détail illisible : le montant fait foi */ }
  return { detail, montant: round2(row.montant), heure: row.heure }
}

export function setComptage(db, salonId, data) {
  const date = data.date || ''
  if (!isDate(date)) throw new ApiError('Date invalide.')
  const { detail, montant } = totalComptage(data.detail)
  run(db, `
    INSERT INTO comptage_caisse (salon_id, date, detail, montant, heure) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(salon_id, date) DO UPDATE SET
        detail = excluded.detail, montant = excluded.montant, heure = excluded.heure
  `, [salonId, date, JSON.stringify(detail), montant, nowDateTime().heure])
  return { ok: true, montant }
}

export function deleteComptage(db, salonId, date) {
  if (!isDate(date)) throw new ApiError('Date invalide.')
  run(db, 'DELETE FROM comptage_caisse WHERE salon_id = ? AND date = ?', [salonId, date])
  return { ok: true }
}

// ── Z DE CAISSE (rapport de clôture d'une journée) ───────────────────────────
// Rapport calculé à la demande à partir des ventes du jour : rien n'est figé
// ni numéroté en base (ce n'est pas un Z certifié au sens de la norme NF525).

export function getZ(db, salonId, date) {
  if (!isDate(date)) throw new ApiError('Date invalide.')
  const salon = queryOne(db, 'SELECT id, nom, lieu FROM salons WHERE id = ?', [salonId])
  if (!salon) throw new ApiError('Salon introuvable', 404)
  const stats = getStats(db, salonId, date)
  const articles = queryAll(db, `
    SELECT p.nom,
           SUM(CASE WHEN type_quantite='normal' THEN nb_bouteilles ELSE 0 END) AS unites,
           SUM(CASE WHEN type_quantite='normal' AND unite='carton' THEN quantite ELSE 0 END) AS cartons,
           SUM(CASE WHEN type_quantite='degustation' THEN quantite ELSE 0 END) AS degustations,
           SUM(CASE WHEN type_quantite='offert' THEN quantite ELSE 0 END) AS offerts,
           SUM(CASE WHEN type_quantite='normal' THEN total ELSE 0 END) AS total
    FROM ventes v
    JOIN produits p ON p.id = v.produit_id
    WHERE v.salon_id = ? AND v.date = ?
    GROUP BY v.produit_id
    ORDER BY total DESC, p.nom
  `, [salonId, date]).map(a => ({ ...a, total: round2(a.total) }))
  const bornes = queryOne(db, `
    SELECT MIN(heure) AS premiere, MAX(heure) AS derniere, COUNT(*) AS nb_lignes
    FROM ventes WHERE salon_id = ? AND date = ?
  `, [salonId, date])
  const fond = queryOne(db, 'SELECT montant_initial FROM fond_caisse WHERE salon_id = ? AND date = ?',
    [salonId, date])
  const soldeTheorique = round2((fond?.montant_initial ?? 0) + stats.total_especes)
  const comptage = getComptage(db, salonId, date)
  const t = queryOne(db, `
    SELECT COALESCE(SUM(annule = 0), 0) AS nb,
           COALESCE(SUM(annule = 0 AND total > 0), 0) AS nb_payants,
           COALESCE(SUM(CASE WHEN annule = 0 THEN total ELSE 0 END), 0) AS ca,
           COALESCE(SUM(CASE WHEN annule = 0 THEN remise_lignes + remise_ticket ELSE 0 END), 0) AS remises,
           COALESCE(SUM(annule = 1), 0) AS nb_annules
    FROM tickets WHERE salon_id = ? AND date = ?
  `, [salonId, date])
  const now = nowDateTime()
  return {
    salon,
    date,
    edite_le: { date: now.date, heure: now.heure },
    premiere: bornes.premiere,
    derniere: bornes.derniere,
    nb_lignes: bornes.nb_lignes,
    stats,
    articles,
    tickets: {
      nb: t.nb,
      nb_annules: t.nb_annules,
      // Ticket moyen sur les tickets payants (hors dégustations / offerts seuls)
      moyen: t.nb_payants > 0 ? round2(t.ca / t.nb_payants) : null,
      remises: round2(t.remises),
    },
    caisse: {
      fond_initial: fond ? round2(fond.montant_initial) : null,
      especes: stats.total_especes,
      solde_theorique: soldeTheorique,
      compte: comptage ? comptage.montant : null,
      compte_heure: comptage ? comptage.heure : null,
      ecart: comptage ? round2(comptage.montant - soldeTheorique) : null,
    },
  }
}

// ── DONNÉES POUR L'EXPORT EXCEL ───────────────────────────────────────────────

export function getExportData(db, salonId) {
  const salon = queryOne(db, 'SELECT id, nom FROM salons WHERE id = ?', [salonId])
  if (!salon) throw new ApiError('Salon introuvable', 404)
  const ventes = queryAll(db, `
    SELECT v.id, v.type_quantite, v.quantite, v.unite, v.nb_bouteilles, v.prix_unitaire,
           v.mode_paiement, v.total, v.date, v.heure, p.nom AS produit_nom
    FROM ventes v
    JOIN produits p ON p.id = v.produit_id
    WHERE v.salon_id = ? ORDER BY v.date, v.heure
  `, [salonId])
  const salonProduits = queryAll(db, `
    SELECT sp.produit_id, sp.stock_initial, sp.stock_restant, p.nom, p.prix
    FROM salon_produits sp
    JOIN produits p ON p.id = sp.produit_id
    WHERE sp.salon_id = ? AND sp.selectionne = 1 ORDER BY p.nom
  `, [salonId]).map(sp => ({
    ...sp,
    ...queryOne(db, `
      SELECT
          COALESCE(SUM(CASE WHEN type_quantite='normal'      THEN nb_bouteilles ELSE 0 END),0) AS vendu,
          COALESCE(SUM(CASE WHEN type_quantite='normal' AND unite='carton' THEN quantite ELSE 0 END),0) AS cartons,
          COALESCE(SUM(CASE WHEN type_quantite='degustation' THEN quantite ELSE 0 END),0) AS degu,
          COALESCE(SUM(CASE WHEN type_quantite='offert'      THEN quantite ELSE 0 END),0) AS offert
      FROM ventes WHERE salon_id = ? AND produit_id = ?
    `, [salonId, sp.produit_id]),
  }))
  const stats = getStats(db, salonId)
  const caisse = getCaisse(db, salonId)
  return { salon, ventes, salonProduits, stats, caisse }
}
