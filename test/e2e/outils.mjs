/**
 * Outils communs des tests navigateur (Playwright) : serveur de prévisualisation
 * du build, bases SQLite d'exemple injectées dans le navigateur, comptage des
 * vérifications.
 */
import { spawn } from 'child_process'
import { createServer } from 'net'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = '/viticole-mobile/'

/** Port libre sur la machine. */
function portLibre() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/** Lance `vite preview` sur le dossier build/ ; renvoie { url, stop }. */
export async function demarrerServeur() {
  const port = await portLibre()
  const proc = spawn(process.execPath,
    [join(RACINE, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'],
    { cwd: RACINE, stdio: 'ignore' })
  const url = `http://127.0.0.1:${port}${BASE}`
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: () => proc.kill() }
    } catch { /* pas encore prêt */ }
    await new Promise(r => setTimeout(r, 200))
  }
  proc.kill()
  throw new Error(`Le serveur de prévisualisation ne répond pas sur ${url} (build/ présent ?)`)
}

/** Compteur de vérifications partagé par tous les scénarios. */
export function creerVerif() {
  const v = { ok: 0, ko: 0, echecs: [] }
  v.check = (cond, label) => {
    if (cond) { v.ok++; console.log(`  ✓ ${label}`) }
    else { v.ko++; v.echecs.push(label); console.log(`  ✗ ${label}`) }
  }
  return v
}

/**
 * Page dont l'IndexedDB contient déjà une base (Uint8Array) avant le premier
 * chargement de l'app. version 1 = téléphone d'avant les photos séparées.
 */
export async function pageAvecBase(ctx, url, bytes, version = 2) {
  const page = await ctx.newPage()
  await page.route(url + '__vide', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }))
  await page.goto(url + '__vide')
  await page.evaluate(async ({ b64, version }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    await new Promise((res, rej) => {
      const req = indexedDB.open('viticole', version)
      req.onupgradeneeded = () => {
        for (const n of version === 1 ? ['sqlite', 'backups'] : ['sqlite', 'backups', 'photos']) {
          req.result.createObjectStore(n)
        }
      }
      req.onsuccess = () => {
        const tx = req.result.transaction('sqlite', 'readwrite')
        tx.objectStore('sqlite').put(bytes, 'main')
        tx.oncomplete = () => { req.result.close(); res() }
      }
      req.onerror = () => rej(req.error)
    })
  }, { b64: Buffer.from(bytes).toString('base64'), version })
  return page
}

/** Connexion avec le mot de passe initial, puis choix du salon (si nommé). */
export async function connecter(page, url, salon = null) {
  await page.goto(url)
  await page.fill('#password', 'admin123')
  await page.click('button[type=submit]')
  if (salon) await page.getByText(salon, { exact: true }).click()
}

/** Lit l'IndexedDB de l'app : { version, main (octets), photos (clés) }. */
export function lireIdb(page) {
  return page.evaluate(async () => {
    const d = await new Promise((res, rej) => {
      const r = indexedDB.open('viticole')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const get = (store, fn) => new Promise(res => {
      const q = fn(d.transaction(store).objectStore(store))
      q.onsuccess = () => res(q.result)
    })
    const out = {
      version: d.version,
      main: Array.from(await get('sqlite', s => s.get('main'))),
      photos: await get('photos', s => s.getAllKeys()),
    }
    d.close()
    return out
  })
}
