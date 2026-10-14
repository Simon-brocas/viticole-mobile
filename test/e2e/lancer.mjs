/**
 * Tests navigateur de bout en bout : npm run test:e2e
 * Construit l'app au préalable (build/), la sert avec `vite preview` et joue
 * chaque scénario de test/e2e/scenarios dans Chromium (écran de téléphone).
 * En cas d'échec, une capture d'écran est enregistrée dans test-results/.
 */
import { chromium } from 'playwright'
import { mkdtempSync, mkdirSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { RACINE, demarrerServeur, creerVerif } from './outils.mjs'

const filtre = process.argv[2] // npm run test:e2e -- tickets
const dossierScenarios = join(RACINE, 'test/e2e/scenarios')
const fichiers = readdirSync(dossierScenarios).filter(f => f.endsWith('.mjs') && (!filtre || f.includes(filtre))).sort()

const serveur = await demarrerServeur()
const browser = await chromium.launch()
const verif = creerVerif()
const resultats = join(RACINE, 'test-results')
let erreurs = 0

try {
  for (const f of fichiers) {
    const scenario = await import(join(dossierScenarios, f))
    console.log(`\n— ${scenario.titre} (${f})`)
    const dossier = mkdtempSync(join(tmpdir(), 'zeste-e2e-'))
    const debut = Date.now()
    try {
      await scenario.default({ browser, url: serveur.url, check: verif.check, dossier })
    } catch (e) {
      erreurs++
      console.error(`  ✗ ${f} interrompu : ${e.message.split('\n')[0]}`)
      // Capture de chaque page encore ouverte pour comprendre l'échec
      mkdirSync(resultats, { recursive: true })
      let n = 0
      for (const ctx of browser.contexts()) {
        for (const p of ctx.pages()) {
          await p.screenshot({ path: join(resultats, `${f.replace('.mjs', '')}-${++n}.png`), fullPage: true }).catch(() => {})
        }
        await ctx.close().catch(() => {})
      }
    }
    console.log(`  (${((Date.now() - debut) / 1000).toFixed(1)} s)`)
  }
} finally {
  await browser.close()
  serveur.stop()
}

console.log(`\n${verif.ok} réussis, ${verif.ko} échoués, ${erreurs} scénario(s) interrompu(s)`)
process.exit(verif.ko > 0 || erreurs > 0 ? 1 : 0)
