/**
 * Même interface que src/api.js de la version desktop, mais 100 % locale :
 * chaque appel exécute la logique métier (src/db/operations.js) sur la base
 * SQLite embarquée, puis persiste dans IndexedDB. Aucun réseau.
 */
import * as ops from './db/operations'
import {
  getDb, persist, exportBytes, importBytes,
  listBackups, restoreBackup, storageInfo,
  photoBytes, savePhoto, dropPhoto,
} from './db/database'
import { verifyPassword, hashPassword } from './db/auth'

const SESSION_HOURS = 48

/** Exécute une opération de lecture. */
function read(fn) {
  return Promise.resolve().then(() => fn(getDb()))
}

/** Exécute une opération d'écriture puis persiste la base. */
async function write(fn) {
  const result = await Promise.resolve(fn(getDb()))
  await persist()
  return result
}

// ── Photos : cache d'URLs blob (les <img> ont besoin d'une URL synchrone) ────

const photoUrlCache = new Map() // 'kind/id' → { version, url }

function invalidatePhoto(kind, id) {
  const key = `${kind}/${id}`
  const cached = photoUrlCache.get(key)
  if (cached) {
    URL.revokeObjectURL(cached.url)
    photoUrlCache.delete(key)
  }
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  login: async password => {
    await ops.login(getDb(), verifyPassword, password)
    const exp = Date.now() + SESSION_HOURS * 3600 * 1000
    return { token: `local.${exp}.${crypto.randomUUID()}` }
  },
  authStatus: () => ops.authStatus(getDb(), verifyPassword),
  changePassword: (current, neu) =>
    write(db => ops.changePassword(db, { verifyPassword, hashPassword }, current, neu)),

  // ── Salons ──────────────────────────────────────────────────────────────────
  getSalons: () => read(db => ops.getSalons(db)),
  createSalon: d => write(db => ops.createSalon(db, d)),
  updateSalon: (id, d) => write(db => ops.updateSalon(db, id, d)),

  // ── Produits ────────────────────────────────────────────────────────────────
  getProduits: (all = false) => read(db => ops.getProduits(db, all)),
  createProduit: d => write(db => ops.createProduit(db, d)),
  updateProduit: (id, d) => write(db => ops.updateProduit(db, id, d)),

  getSalonProduits: sid => read(db => ops.getSalonProduits(db, sid)),
  updateSalonProduit: (sid, pid, d) => write(db => ops.updateSalonProduit(db, sid, pid, d)),

  // ── Ventes / stats / caisse ─────────────────────────────────────────────────
  getVentes: sid => read(db => ops.getVentes(db, sid)),
  validerPanier: (sid, panier) => write(db => ops.ajouterVente(db, sid, panier)),
  supprimerVente: (sid, vid) => write(db => ops.supprimerVente(db, sid, vid)),

  getStats: sid => read(db => ops.getStats(db, sid)),

  getCaisse: sid => read(db => ops.getCaisse(db, sid)),
  setCaisse: (sid, d) => write(db => ops.setCaisse(db, sid, d)),

  // ── Photos ──────────────────────────────────────────────────────────────────
  // kind : 'salons' ou 'produits' — retourne une URL blob: (cache par version)
  photoUrl: (kind, id, version) => {
    const key = `${kind}/${id}`
    const v = version ?? null
    const cached = photoUrlCache.get(key)
    if (cached && cached.version === v) return cached.url
    const bytes = photoBytes(kind, id)
    if (!bytes) return ''
    if (cached) URL.revokeObjectURL(cached.url)
    const url = URL.createObjectURL(
      new Blob([bytes], { type: ops.imageMime(bytes) || 'application/octet-stream' })
    )
    photoUrlCache.set(key, { version: v, url })
    return url
  },

  // Image rangée hors base (store photos), la base ne garde qu'un marqueur
  uploadPhoto: async (kind, id, blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    ops.checkPhoto(kind, bytes)
    await savePhoto(kind, id, bytes)
    const result = await write(db => ops.setPhotoExterne(db, kind, id))
    invalidatePhoto(kind, id)
    return result
  },

  deletePhoto: async (kind, id) => {
    const result = await write(db => ops.deletePhoto(db, kind, id))
    await dropPhoto(kind, id)
    invalidatePhoto(kind, id)
    return result
  },

  // ── Export Excel (généré côté client, module chargé à la demande) ──────────
  exportExcel: async sid => {
    const data = ops.getExportData(getDb(), sid)
    const { buildWorkbook } = await import('./excel')
    const buffer = await buildWorkbook(data)
    const nom = data.salon.nom.replace(/ /g, '_').replace(/\//g, '-')
    await shareOrDownload(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `export_${nom}.xlsx`
    )
  },

  // ── Données (spécifique mobile) : échange du fichier .db avec le PC ────────
  exportDbFile: async () => {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    const name = `zeste-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.db`
    await shareOrDownload(new Blob([exportBytes()], { type: 'application/octet-stream' }), name)
  },

  importDbFile: async file => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    await importBytes(bytes)
    photoUrlCache.forEach(({ url }) => URL.revokeObjectURL(url))
    photoUrlCache.clear()
  },

  listBackups,
  restoreBackup: async key => {
    await restoreBackup(key)
    photoUrlCache.forEach(({ url }) => URL.revokeObjectURL(url))
    photoUrlCache.clear()
  },
  storageInfo,
}

/**
 * Sur mobile, la feuille de partage (Web Share API) est le moyen naturel
 * d'envoyer un fichier (WhatsApp, Drive, mail…) ; sinon téléchargement classique.
 */
async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if (e.name === 'AbortError') return // l'utilisateur a annulé la feuille de partage
      // sinon on retombe sur le téléchargement
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Révocation différée : révoquer immédiatement peut annuler le téléchargement
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

/** Jeton de session local : 'local.<expiration ms>.<uuid>' (48 h comme le desktop). */
export function tokenIsValid(token) {
  if (!token) return false
  const [prefix, exp] = token.split('.')
  return prefix === 'local' && Number(exp) > Date.now()
}
