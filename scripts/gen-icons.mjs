/**
 * Génère les icônes PWA (public/) à partir d'un logo SVG dessiné ici.
 * Usage : npm run icons
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUB = join(ROOT, 'public')
mkdirSync(PUB, { recursive: true })

// pad : marge autour du verre (les icônes "maskable" demandent ~20 % de marge en plus)
function logoSvg({ pad = 0, rounded = true } = {}) {
  const s = 512
  const k = 1 - pad * 2 // facteur d'échelle du contenu
  const t = v => (v * k + s * pad).toFixed(1) // transforme une coordonnée
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f855a"/>
      <stop offset="1" stop-color="#153a28"/>
    </linearGradient>
    <linearGradient id="wine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a03050"/>
      <stop offset="1" stop-color="#6d1f38"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
  <!-- bol du verre -->
  <path d="M ${t(166)} ${t(108)} H ${t(346)} V ${t(196)} A ${90 * k} ${90 * k} 0 0 1 ${t(166)} ${t(196)} Z"
        fill="#ffffff" opacity="0.92"/>
  <!-- vin dans le verre -->
  <path d="M ${t(180)} ${t(150)} H ${t(332)} V ${t(196)} A ${76 * k} ${76 * k} 0 0 1 ${t(180)} ${t(196)} Z"
        fill="url(#wine)"/>
  <!-- pied -->
  <rect x="${t(247)}" y="${t(280)}" width="${18 * k}" height="${86 * k}" rx="${9 * k}" fill="#ffffff" opacity="0.92"/>
  <!-- base -->
  <rect x="${t(192)}" y="${t(366)}" width="${128 * k}" height="${22 * k}" rx="${11 * k}" fill="#ffffff" opacity="0.92"/>
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
