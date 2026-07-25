/**
 * Déploie build/ sur la branche gh-pages de GitHub Pages.
 * Usage : npm run deploy   (fait aussi le build)
 */
import { execSync } from 'child_process'
import { copyFileSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = join(ROOT, 'build')
const REMOTE = 'https://github.com/Simon-brocas/viticole-mobile.git'

const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: 'inherit' })

// Fallback SPA + désactivation de Jekyll pour GitHub Pages
copyFileSync(join(BUILD, 'index.html'), join(BUILD, '404.html'))
writeFileSync(join(BUILD, '.nojekyll'), '')

rmSync(join(BUILD, '.git'), { recursive: true, force: true })
run('git init -b gh-pages', BUILD)
run('git add -A', BUILD)
run('git commit -m "Deploiement build production"', BUILD)
run(`git push --force ${REMOTE} gh-pages`, BUILD)
rmSync(join(BUILD, '.git'), { recursive: true, force: true })

console.log('\n✓ Déployé — en ligne d\'ici ~1 minute sur https://simon-brocas.github.io/viticole-mobile/')
