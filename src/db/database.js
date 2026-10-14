/**
 * Base SQLite locale (sql.js/WebAssembly) persistée dans IndexedDB.
 * - Même schéma que zeste.db du logiciel desktop : le fichier exporté ici
 *   s'ouvre dans Zeste.exe, et inversement.
 * - Une sauvegarde horodatée est créée à chaque démarrage (les 5 dernières
 *   + une par jour sur 14 jours), comme le dossier backups/ du desktop.
 * - Les photos sont rangées à part (store 'photos') : la base réécrite après
 *   chaque vente ne pèse que quelques centaines de Ko au lieu de plusieurs Mo.
 *   L'export .db réinjecte les images, le fichier reste lisible par Zeste.exe.
 *   Les sauvegardes ne contiennent pas les photos : en restaurer une conserve
 *   les photos actuelles.
 */
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import {
  initSchema, ensureAdmin, getPhoto, photosInternes, externaliserPhotos,
  internaliserPhotos, retirerMarqueursOrphelins,
} from './operations'
import { hashPassword } from './auth'
import { backupsToDelete } from './backups'

// Nom historique conservé : le renommer ferait perdre les données déjà
// saisies sur les téléphones (base IndexedDB distincte).
const IDB_NAME = 'viticole'
const IDB_VERSION = 2
const STORE_MAIN = 'sqlite'     // clé 'main' → Uint8Array de la base
const STORE_BACKUPS = 'backups' // clé horodatage → Uint8Array (conservation : voir backups.js)
const STORE_PHOTOS = 'photos'   // clé 'table/id' → Uint8Array de l'image (depuis la v2)

let db = null
let SQL = null
// Copie mémoire du store photos : les <img> ont besoin d'une URL synchrone
const photos = new Map()
const photoKey = (table, id) => `${table}/${id}`

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE_MAIN)) d.createObjectStore(STORE_MAIN)
      if (!d.objectStoreNames.contains(STORE_BACKUPS)) d.createObjectStore(STORE_BACKUPS)
      if (!d.objectStoreNames.contains(STORE_PHOTOS)) d.createObjectStore(STORE_PHOTOS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbOp(store, mode, fn) {
  return openIdb().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => { d.close(); resolve(result.result ?? result) }
    tx.onerror = () => { d.close(); reject(tx.error) }
  }))
}

const idbGet = (store, key) => idbOp(store, 'readonly', s => s.get(key))
const idbPut = (store, key, value) => idbOp(store, 'readwrite', s => s.put(value, key))
const idbDelete = (store, key) => idbOp(store, 'readwrite', s => s.delete(key))
const idbKeys = store => idbOp(store, 'readonly', s => s.getAllKeys())

/** Écrit plusieurs entrées dans une seule transaction (tout ou rien). */
const idbPutMany = (store, entries) => idbOp(store, 'readwrite', s => {
  for (const [key, value] of entries) s.put(value, key)
  return {}
})

/** Lit tout un store : [[clé, valeur], …]. */
function idbEntries(store) {
  return openIdb().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readonly')
    const keys = tx.objectStore(store).getAllKeys()
    const values = tx.objectStore(store).getAll()
    tx.oncomplete = () => { d.close(); resolve(keys.result.map((k, i) => [k, values.result[i]])) }
    tx.onerror = () => { d.close(); reject(tx.error) }
  }))
}

// ── Cycle de vie de la base ───────────────────────────────────────────────────

export function getDb() {
  if (!db) throw new Error("La base de données n'est pas initialisée.")
  return db
}

/** Écrit la base dans IndexedDB. Appelé après chaque écriture métier. */
export async function persist() {
  await idbPut(STORE_MAIN, 'main', getDb().export())
}

// ── Photos hors base ──────────────────────────────────────────────────────────

/** Image d'un salon / article, ou null. */
export function photoBytes(table, id) {
  const stored = photos.get(photoKey(table, id))
  if (stored) return stored
  // Repli : photo encore dans la base (migration impossible, ex. stockage plein)
  const inline = getPhoto(getDb(), table, id)
  return inline?.length ? inline : null
}

/** Range l'image hors base (à appeler avant d'écrire le marqueur dans la base). */
export async function savePhoto(table, id, bytes) {
  await idbPut(STORE_PHOTOS, photoKey(table, id), bytes)
  photos.set(photoKey(table, id), bytes)
}

export async function dropPhoto(table, id) {
  photos.delete(photoKey(table, id))
  await idbDelete(STORE_PHOTOS, photoKey(table, id))
}

/**
 * Sort de la base les photos encore stockées dedans (base d'avant la v2, ou
 * fichier venant du PC), puis retire les marqueurs sans image.
 * Les images sont écrites hors base AVANT d'être retirées de la base : une
 * interruption ne perd rien. En cas d'échec, elles restent dans la base et
 * l'app fonctionne comme avant.
 */
async function sortirPhotos(target) {
  const list = photosInternes(target)
  if (list.length > 0) {
    try {
      await idbPutMany(STORE_PHOTOS, list.map(p => [photoKey(p.table, p.id), p.bytes]))
      for (const p of list) photos.set(photoKey(p.table, p.id), p.bytes)
      externaliserPhotos(target, list)
    } catch (e) {
      console.warn('Photos laissées dans la base :', e)
    }
  }
  retirerMarqueursOrphelins(target, (table, id) => photos.has(photoKey(table, id)))
}

async function saveStartupBackup(bytes) {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  await idbPut(STORE_BACKUPS, `viticole-${stamp}`, bytes)
  for (const old of backupsToDelete(await idbKeys(STORE_BACKUPS))) {
    await idbDelete(STORE_BACKUPS, old)
  }
}

export async function initDatabase() {
  SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const saved = await idbGet(STORE_MAIN, 'main')
  if (saved && saved.length > 0) {
    await saveStartupBackup(saved)
    db = new SQL.Database(saved)
  } else {
    db = new SQL.Database()
  }
  initSchema(db)
  for (const [key, bytes] of await idbEntries(STORE_PHOTOS)) photos.set(key, bytes)
  await sortirPhotos(db)
  await ensureAdmin(db, hashPassword)
  await persist()
  // Demande au navigateur de ne jamais purger le stockage (best effort)
  try { await navigator.storage?.persist?.() } catch { /* non bloquant */ }
}

// ── Export / import du fichier .db (échange avec le desktop) ─────────────────

/** Fichier .db complet, photos réinjectées (format attendu par le desktop). */
export function exportBytes() {
  const copy = new SQL.Database(getDb().export())
  try {
    internaliserPhotos(copy, (table, id) => photos.get(photoKey(table, id)))
    return copy.export()
  } finally {
    copy.close()
  }
}

/** Remplace la base courante par le contenu d'un fichier .db (avec validation). */
export async function importBytes(bytes) {
  let candidate
  try {
    candidate = new SQL.Database(bytes)
    const tables = candidate.exec(
      "SELECT name FROM sqlite_master WHERE type='table'"
    )[0]?.values.flat() ?? []
    for (const required of ['salons', 'produits', 'ventes']) {
      if (!tables.includes(required)) throw new Error(`table ${required} absente`)
    }
  } catch (e) {
    candidate?.close()
    throw new Error('Fichier non reconnu : ce n’est pas une base Zeste valide.')
  }
  // Sauvegarde de l'ancienne base avant remplacement
  await saveStartupBackup(db.export())
  db.close()
  db = candidate
  initSchema(db) // migrations si la base vient d'une version plus ancienne
  await sortirPhotos(db)
  await ensureAdmin(db, hashPassword)
  await persist()
}

// ── Sauvegardes automatiques ──────────────────────────────────────────────────

export async function listBackups() {
  const keys = (await idbKeys(STORE_BACKUPS)).sort().reverse()
  const out = []
  for (const key of keys) {
    const bytes = await idbGet(STORE_BACKUPS, key)
    out.push({ key, size: bytes?.length ?? 0 })
  }
  return out
}

export async function restoreBackup(key) {
  const bytes = await idbGet(STORE_BACKUPS, key)
  if (!bytes) throw new Error('Sauvegarde introuvable.')
  await importBytes(bytes)
}

// ── Infos stockage ────────────────────────────────────────────────────────────

export async function storageInfo() {
  const info = { persisted: null, usage: null, quota: null }
  try { info.persisted = await navigator.storage?.persisted?.() ?? null } catch { /* ignore */ }
  try {
    const est = await navigator.storage?.estimate?.()
    if (est) { info.usage = est.usage; info.quota = est.quota }
  } catch { /* ignore */ }
  return info
}
