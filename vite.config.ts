/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { portraitCachePattern } from './src/data/portraits.ts'

export default defineConfig({
  // Chemins relatifs : l'app fonctionne aussi hébergée dans un sous-dossier.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dreamlight Compagnons',
        short_name: 'Compagnons',
        description: 'Qui pêche, qui jardine, qui mine ? Retrouve en un clin d’œil les métiers de tes habitants.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#120f38',
        theme_color: '#120f38',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Portraits du wiki : gardés en cache pour fonctionner hors ligne. Motif = les adresses exactes des portraits,
        // pas tout `/images/` : les vignettes d'ingrédients (même dossier) ne doivent pas entrer ici (voir portraits.ts).
        runtimeCaching: [
          {
            urlPattern: portraitCachePattern(),
            handler: 'CacheFirst',
            options: {
              cacheName: 'portraits-wiki',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { host: true, port: 5173 },
  test: {
    environment: 'jsdom',
    // Fuseau de la joueuse : les récurrences et le changement d'heure sont testés à Bruxelles.
    env: { TZ: 'Europe/Brussels' },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
