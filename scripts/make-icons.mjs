// Génère les icônes PNG de la PWA à partir de public/favicon.svg.
// Utilise Microsoft Edge (déjà présent sous Windows) via Playwright.
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' })
const page = await browser.newPage()

for (const [file, size, radius] of [
  ['pwa-192.png', 192, true],
  ['pwa-512.png', 512, false], // plein cadre : sert aussi d'icône « maskable »
  ['apple-touch-icon.png', 180, false],
]) {
  const markup = radius ? svg : svg.replace('rx="112"', 'rx="0"')
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), omitBackground: true })
  console.log('✓', file)
}
await browser.close()
