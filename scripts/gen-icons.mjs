/**
 * Génère les icônes PWA (public/) à partir du monogramme de l'application.
 * Usage : npm run icons
 *
 * Le monogramme et le dégradé doivent rester cohérents avec
 * src/branding.js et src/components/Logo.jsx.
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUB = join(ROOT, 'public')
mkdirSync(PUB, { recursive: true })

const MONOGRAM = 'Z'
const GRADIENT = ['#44b483', '#276749']

// pad : marge autour du monogramme (les icônes « maskable » demandent ~20 % de marge)
function logoSvg({ pad = 0, rounded = true } = {}) {
  const s = 512
  const k = 1 - pad * 2
  const fontSize = 300 * k
  // librsvg (utilisé par sharp) ignore dominant-baseline : on place la ligne de
  // base explicitement pour centrer la hauteur de capitale (~0,72 × fontSize).
  const baseline = s / 2 + fontSize * 0.36
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GRADIENT[0]}"/>
      <stop offset="1" stop-color="${GRADIENT[1]}"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
  <text x="${s / 2}" y="${baseline.toFixed(1)}" text-anchor="middle"
        fill="#ffffff" font-size="${fontSize.toFixed(0)}" font-weight="700"
        font-family="DejaVu Sans, Segoe UI, Helvetica, Arial, sans-serif">${MONOGRAM}</text>
</svg>`
}

const standard = Buffer.from(logoSvg())
const maskable = Buffer.from(logoSvg({ pad: 0.12, rounded: false }))

await sharp(standard).resize(192, 192).png().toFile(join(PUB, 'pwa-192.png'))
await sharp(standard).resize(512, 512).png().toFile(join(PUB, 'pwa-512.png'))
await sharp(maskable).resize(512, 512).png().toFile(join(PUB, 'pwa-maskable-512.png'))
await sharp(standard).resize(180, 180).png().toFile(join(PUB, 'apple-touch-icon.png'))
writeFileSync(join(PUB, 'favicon.svg'), logoSvg())

console.log('Icônes générées dans public/')
