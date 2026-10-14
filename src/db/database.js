/**
 * Base SQLite locale (sql.js/WebAssembly) persistée dans IndexedDB.
 * - Même schéma que zeste.db du logiciel desktop : le fichier exporté ici
 *   s'ouvre dans Zeste.exe, et inversement.
 * - Une sauvegarde horodatée est créée à chaque démarrage (les 5 dernières
 *   + une par jour sur 14 jours), comme le dossier backups/ du desktop.
 */
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { initSchema, ensureAdmin } from './operations'
import { hashPassword } from './auth'
import { backupsToDelete } from './backups'

// Nom historique conservé : le renommer ferait perdre les données déjà
// saisies sur les téléphones (base IndexedDB distincte).
const IDB_NAME = 'viticole'
const IDB_VERSION = 1
const STORE_MAIN = 'sqlite'     // clé 'main' → Uint8Array de la base
const STORE_BACKUPS = 'backups' // clé horodatage → Uint8Array (conservation : voir backups.js)

let db = null
let SQL = null

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE_MAIN)) d.createObjectStore(STORE_MAIN)
      if (!d.objectStoreNames.contains(STORE_BACKUPS)) d.createObjectStore(STORE_BACKUPS)
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

// ── Cycle de vie de la base ───────────────────────────────────────────────────

export function getDb() {
  if (!db) throw new Error("La base de données n'est pas initialisée.")
  return db
}

/** Écrit la base dans IndexedDB. Appelé après chaque écriture métier. */
export async function persist() {
  await idbPut(STORE_MAIN, 'main', getDb().export())
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
  await ensureAdmin(db, hashPassword)
  await persist()
  // Demande au navigateur de ne jamais purger le stockage (best effort)
  try { await navigator.storage?.persist?.() } catch { /* non bloquant */ }
}

// ── Export / import du fichier .db (échange avec le desktop) ─────────────────

export function exportBytes() {
  return getDb().export()
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
