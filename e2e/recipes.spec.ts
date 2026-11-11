import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/**
 * Ces tests utilisent le VRAI IndexedDB d'Edge : la clé `recipes` est lue directement avec l'API `indexedDB`.
 */
interface Recipes {
  known: Record<string, string>
  favorites: Record<string, string>
}

async function stored<T>(page: Page, key: string): Promise<T | undefined> {
  return page.evaluate(async (k) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('dreamlight-compagnons')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const value = await new Promise<unknown>((resolve) => {
      const r = db.transaction('kv').objectStore('kv').get(k)
      r.onsuccess = () => resolve(r.result)
    })
    db.close()
    return value as never
  }, key)
}
const recipes = async (page: Page): Promise<Recipes> => (await stored<Recipes>(page, 'recipes')) ?? { known: {}, favorites: {} }
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
const search = (page: Page) => page.getByLabel('Rechercher une recette')
const count = (page: Page) => page.getByTestId('recipes-count')
const rows = (page: Page) => page.getByTestId('recipe-row')

async function openRecipes(page: Page) {
  await page.goto('/#/collection/recettes')
  await expect(page.getByRole('heading', { name: 'Recettes' })).toBeVisible()
  await expect(search(page)).toBeVisible()
}

test('depuis Collection : la carte Recettes ouvre l’encyclopédie de 480 recettes sans débordement à 360 px', async ({ page }) => {
  await page.goto('/#/collection')
  await expect(page.getByTestId('recipes-card-progress')).toHaveText('0 connue sur 480')
  await page.getByRole('link', { name: /Recettes/ }).click()
  await expect(search(page)).toBeVisible()
  await expect(count(page)).toHaveText('480 recettes')
  await noOverflow(page)
  await page.getByRole('button', { name: /Afficher plus/ }).click()
  await noOverflow(page)
})

test('cocher une recette connue et une favorite : enregistré dans IndexedDB, conservé après rechargement', async ({ page }) => {
  await openRecipes(page)
  await search(page).fill('waffles')
  await rows(page).first().getByRole('checkbox', { name: /^Connue/ }).click()
  await rows(page).first().getByRole('button', { name: /^Favorite/ }).click()
  await expect.poll(async () => Object.keys((await recipes(page)).known)).toEqual(['waffles'])
  await expect.poll(async () => Object.keys((await recipes(page)).favorites)).toEqual(['waffles'])
  await page.reload()
  await expect(page.getByTestId('recipes-progress')).toHaveText('1 connue sur 480 · 1 favorite')
  await page.getByRole('button', { name: /✓ Connues \(1\)/ }).click()
  await expect(count(page)).toHaveText('1 recette')
  // Redécouverte : décocher puis recocher
  await rows(page).first().getByRole('checkbox', { name: /^Connue/ }).click()
  await expect.poll(async () => (await recipes(page)).known).toEqual({})
  await page.getByRole('button', { name: /Toutes \(480\)/ }).click()
  await search(page).fill('waffles')
  await rows(page).first().getByRole('checkbox', { name: /^Connue/ }).click()
  await expect.poll(async () => Object.keys((await recipes(page)).known)).toEqual(['waffles'])
})

test('fiche : choix en une seule place, nom « à confirmer », renommage et recherche par ingrédient', async ({ page }) => {
  await openRecipes(page)
  await search(page).fill("Pooh's Birthday Cake")
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('À confirmer')
  await rows(page).first().getByRole('button', { name: /Ouvrir/ }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByTestId('slot-choice').first()).toContainText('Un seul ingrédient à choisir')
  await expect(sheet).toContainText('DLC')
  await sheet.getByRole('button', { name: /^Voir les recettes avec/ }).first().click()
  await expect(page.getByTestId('ingredient-filter')).toBeVisible()
  await noOverflow(page)

  await page.getByRole('button', { name: 'Retirer le filtre d’ingrédient' }).click()
  await search(page).fill('waffles')
  await rows(page).first().getByRole('button', { name: /Ouvrir/ }).click()
  await page.getByRole('button', { name: /Mon nom/ }).click()
  await page.getByRole('textbox', { name: 'Mon nom' }).fill('Gaufres de Nanie')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect.poll(async () => (await stored<Record<string, string>>(page, 'names'))?.['recipe:waffles']).toBe('Gaufres de Nanie')
})

test('export / import : les recettes sont sauvegardées puis restaurées', async ({ page }) => {
  await openRecipes(page)
  await search(page).fill('coffee')
  await rows(page).first().getByRole('checkbox', { name: /^Connue/ }).click()
  await expect.poll(async () => Object.keys((await recipes(page)).known)).toEqual(['coffee'])

  await page.goto('/#/infos')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter une copie' }).click()])
  const file = JSON.parse(await readFile(await download.path(), 'utf-8'))
  expect(Object.keys(file.sections.recipes.data.known)).toEqual(['coffee'])

  await openRecipes(page)
  await search(page).fill('coffee')
  await rows(page).first().getByRole('checkbox', { name: /^Connue/ }).click() // décoche coffee
  await expect.poll(async () => (await recipes(page)).known).toEqual({})

  await page.goto('/#/infos')
  await page.getByTestId('backup-input').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByRole('dialog')).toContainText('Recettes')
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByText('Sauvegarde restaurée ✓')).toBeVisible()
  await expect.poll(async () => Object.keys((await recipes(page)).known)).toEqual(['coffee'])
})

test('hors ligne : le livre de recettes (chargé à la demande) est disponible et enregistre', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // Le fichier de données doit être pré-chargé par le service worker AVANT de couper le réseau
  await page.goto('/#/collection/recettes')
  await expect(count(page)).toHaveText('480 recettes')

  await context.setOffline(true)
  await page.reload()
  await expect(count(page)).toHaveText('480 recettes')
  await search(page).fill('pasta')
  await rows(page).first().getByRole('checkbox', { name: /^Connue/ }).click()
  await expect.poll(async () => Object.keys((await recipes(page)).known).length).toBe(1)
  await context.setOffline(false)
})

/**
 * Scénario « recettes jamais ouvertes » : le catalogue (`catalog.data`) est un module chargé à la demande.
 * Le test précédent l'ouvre en ligne AVANT de couper le réseau ; celui-ci prouve que le pré-cache du service
 * worker suffit : le module n'est jamais demandé par la page avant la coupure, et pourtant la première ouverture
 * des recettes fonctionne hors ligne.
 */
test('hors ligne : première ouverture des recettes, module jamais demandé avant la coupure', async ({ page, context }) => {
  const requested: string[] = []
  page.on('request', (r) => requested.push(r.url()))
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  // Navigation en ligne dans d'autres écrans, jamais dans les recettes.
  await page.goto('/#/collection')
  await page.goto('/#/infos')
  // 1. Le module n'a jamais été demandé par la page…
  expect(requested.filter((u) => /catalog\.data/.test(u)), 'catalog.data demandé avant la coupure').toEqual([])
  // 2. …mais il est déjà dans le cache du service worker (pré-cache à l'installation).
  const cached = await page.evaluate(async () => {
    const hits: string[] = []
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) if (/catalog\.data/.test(req.url)) hits.push(name)
    }
    return hits
  })
  expect(cached.length, 'catalog.data absent du cache du service worker').toBeGreaterThan(0)

  await context.setOffline(true)
  await page.reload() // page neuve : le module n'est toujours pas en mémoire
  await page.goto('/#/collection/recettes')
  await expect(count(page)).toHaveText('480 recettes')
  expect(requested.filter((u) => /catalog\.data/.test(u)).length).toBeGreaterThan(0) // servi par le service worker
  await search(page).fill('pasta')
  await expect(count(page)).not.toHaveText('480 recettes')
  await context.setOffline(false)
})

test('hors ligne sans service worker : l’échec du chargement est géré, puis « Réessayer » fonctionne', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const page = await context.newPage()
  await page.goto('/')
  await page.goto('/#/infos')
  await context.setOffline(true)
  await page.goto('/#/collection/recettes')
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Réessayer' }).click()
  await expect(count(page)).toHaveText('480 recettes')
  await context.close()
})
