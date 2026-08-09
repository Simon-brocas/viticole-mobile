import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Hébergé sur GitHub Pages sous https://simon-brocas.github.io/viticole-mobile/
// (l'URL garde le nom du dépôt : la changer casserait les PWA déjà installées)
const BASE = '/viticole-mobile/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zeste — Caisse & stocks',
        short_name: 'Zeste',
        description: 'Caisse et stocks pour salons et marchés — fonctionne 100 % hors-ligne',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        scope: BASE,
        background_color: '#102d20',
        theme_color: '#1e5038',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout est précaché (y compris le wasm SQLite) : l'app démarre sans réseau
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    outDir: 'build',
    target: 'es2020',
  },
})
