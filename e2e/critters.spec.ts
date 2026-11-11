import { expect, test, type Page } from '@playwright/test'

/**
 * Ces tests utilisent le VRAI IndexedDB d'Edge (lu directement avec l'API `indexedDB`) et, quand c'est
 * indiqué, l'horloge de Playwright. Fuseau : Europe/Brussels (voir playwright.config.ts).
 * Lundi 9 novembre 2026, midi à Bruxelles = 11:00 UTC.
 */
const NOON = new Date('2026-11-09T11:00:00Z')

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

type Progress = Record<string, { obtained?: true; feedings?: number; lastFed?: string; prevFed?: string }>
const progress = async (page: Page) => ((await stored<{ progress: Progress }>(page, 'critters'))?.progress ?? {}) as Progress

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
const todayCount = (page: Page) => page.getByTestId('critters-today-count')
/** Configuration initiale : « Tout sélectionner » puis « Valider mes choix » (par défaut, seul le jeu de base est affiché). */
async function chooseAllExtensions(page: Page) {
  const setup = page.getByTestId('extensions-setup')
  await setup.getByRole('button', { name: 'Tout sélectionner' }).click()
  await setup.getByRole('button', { name: 'Valider mes choix' }).click()
  await expect(setup).toHaveCount(0)
}
const lineLabel = (page: Page) => page.getByTestId('computed-task').getByText(/^🐾 Animaux à nourrir/)

test('Pets Tracker : nourrir une fois par jour, retrouver l’état après rechargement, nourrir à nouveau après minuit', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-09T22:50:00Z') }) // 23 h 50 à Bruxelles
  await page.goto('/#/collection/animaux')
  await expect(page.getByRole('heading', { name: 'Animaux' })).toBeVisible()
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 41') // jeu de base seul tant que rien n'est choisi
  await chooseAllExtensions(page)
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 90')

  // 23 h 50 : un nourrissage est compté ; un second appui le même jour ne change rien
  await page.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }).click()
  await expect(page.getByRole('button', { name: /^Capybara classique/ })).toContainText('🐾 1/3')
  await expect(page.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' })).toHaveCount(0)
  expect((await progress(page))['classic-capybara']).toEqual({ feedings: 1, lastFed: '2026-11-09' })

  // Rechargement : conservé
  await page.reload()
  await expect(page.getByRole('button', { name: /^Capybara classique/ })).toContainText('🐾 1/3')

  // Passage de minuit sans recharger : un nouveau nourrissage redevient possible
  await page.clock.fastForward('20:00') // 00 h 10 le mardi
  await expect(page.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' })).toBeVisible({ timeout: 40_000 })
  await page.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }).click()
  await expect(page.getByRole('button', { name: /^Capybara classique/ })).toContainText('🐾 2/3')
  expect((await progress(page))['classic-capybara']).toEqual({ feedings: 2, lastFed: '2026-11-10', prevFed: '2026-11-09' })
})

test('Aujourd’hui : ligne agrégée « Animaux à nourrir X/Y », vue du jour, obtenu, occasion manquée', async ({ page }) => {
  await page.clock.install({ time: NOON })
  await page.goto('/#/collection/animaux')
  await chooseAllExtensions(page)
  await page.goto('/#/')
  await expect(lineLabel(page)).toBeVisible()
  const total = Number(/0\/(\d+)/.exec((await lineLabel(page).textContent())!)![1])
  expect(total).toBeGreaterThan(0)
  await expect(page.getByTestId('computed-task')).toHaveAttribute('href', '#/collection/animaux/aujourdhui')
  await expect(page.getByTestId('computed-task')).toHaveCount(1)

  // La ligne ouvre directement le Pets Tracker, vue du jour
  await page.getByTestId('computed-task').click()
  await expect(todayCount(page)).toHaveText(`🐾 0/${total} nourris aujourd’hui`)
  await expect(page.getByTestId('section-missed').getByRole('button', { name: /^Oie noire/ })).toBeVisible() // 5 h–11 h : passé
  await expect(page.getByTestId('section-unknown').getByRole('button', { name: /^White Sweet Bee/ })).toBeVisible()
  await expect(page.getByTestId('section-conditional').getByRole('button', { name: /^Toon Capybara/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/animaux-aujourdhui-360.png', fullPage: true })

  // Chaque nourrissage met à jour X/Y ; l'occasion manquée nourrie revient dans le compteur
  await page.getByTestId('section-to-feed').getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }).click()
  await expect(todayCount(page)).toHaveText(`🐾 1/${total} nourris aujourd’hui`)
  await page.getByTestId('section-missed').getByRole('button', { name: 'Nourri aujourd’hui : Oie noire' }).click()
  await expect(todayCount(page)).toHaveText(`🐾 2/${total + 1} nourris aujourd’hui`)

  // Un animal obtenu disparaît de la tâche du jour
  await page.getByTestId('section-fed').getByRole('checkbox', { name: 'Obtenu : Capybara classique' }).click()
  await expect(todayCount(page)).toHaveText(`🐾 1/${total} nourris aujourd’hui`)
  await page.goto('/#/')
  await expect(lineLabel(page)).toHaveText(`🐾 Animaux à nourrir : 1/${total}`)
  await expect(page.getByTestId('computed-task')).toHaveCount(1)
  expect(Object.keys(await progress(page)).sort()).toEqual(['classic-capybara', 'black-goose'].sort())
})

test('deux onglets : un nourrissage fait dans l’un apparaît dans l’autre, sans double comptage', async ({ context }) => {
  await context.clock.install({ time: NOON })
  const one = await context.newPage()
  const two = await context.newPage()
  await one.goto('/#/collection/animaux')
  await chooseAllExtensions(one)
  await two.goto('/#/collection/animaux')
  await one.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }).click()
  // L'autre onglet l'affiche déjà nourri, sans rechargement : plus de bouton pour le compter une seconde fois
  await expect(two.getByRole('button', { name: /^Capybara classique/ })).toContainText('🐾 1/3')
  await expect(two.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' })).toHaveCount(0)
  expect((await progress(one))['classic-capybara']).toEqual({ feedings: 1, lastFed: '2026-11-09' })
  // (Le double appui strictement simultané est couvert au niveau de la base : tests unitaires de `updateCritters`.)

  // Deux animaux différents en même temps : les deux sont conservés
  await Promise.all([
    one.getByRole('button', { name: 'Nourri aujourd’hui : Cobra classique' }).click(),
    two.getByRole('button', { name: 'Nourri aujourd’hui : Singe classique' }).click(),
  ])
  for (const page of [one, two]) {
    await expect(page.getByRole('button', { name: /^Cobra classique/ })).toContainText('🐾 1/3')
    await expect(page.getByRole('button', { name: /^Singe classique/ })).toContainText('🐾 1 · seuil inconnu')
  }
})

test('noms personnalisés et extensions : enregistrés dans le vrai IndexedDB et conservés', async ({ page }) => {
  await page.goto('/#/collection/animaux')
  await chooseAllExtensions(page)
  await page.getByRole('button', { name: /^White Rabbit/ }).click()
  await page.getByRole('button', { name: '✎ Mon nom' }).click()
  await page.getByLabel('Mon nom', { exact: true }).fill('Lapin blanc')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('dialog', { name: 'Lapin blanc' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByText(/Mes extensions/).click()
  await page.getByRole('checkbox', { name: 'Bois Honeyglow' }).uncheck()
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 86')

  await page.reload()
  await expect(page.getByRole('button', { name: /^Lapin blanc/ })).toBeVisible()
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 86')
  expect(await stored(page, 'names')).toEqual({ 'critter:white-rabbit': 'Lapin blanc' })
  expect(await stored(page, 'critters')).toMatchObject({ configured: true, owned: { eternity: true, storybook: true, wishblossom: true, honeyglow: false } })
})

test('export puis restauration : le suivi des animaux revient', async ({ page }) => {
  await page.clock.install({ time: NOON })
  await page.goto('/#/collection/animaux')
  await chooseAllExtensions(page)
  await page.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }).click()
  await page.getByRole('checkbox', { name: 'Obtenu : Lapin noir' }).click()
  await expect.poll(async () => Object.keys(await progress(page)).length).toBe(2)

  await page.goto('/#/infos')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter une copie' }).click()])
  const file = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf-8'))
  expect(file.sections.critters.data.progress).toMatchObject({ 'classic-capybara': { feedings: 1 }, 'black-rabbit': { obtained: true } })

  // On efface le suivi, puis on restaure le fichier
  await page.goto('/#/collection/animaux')
  await page.getByRole('checkbox', { name: 'Obtenu : Lapin noir' }).click()
  await page.getByRole('button', { name: /^Capybara classique/ }).click()
  await page.getByRole('button', { name: /Annuler le nourrissage d’aujourd’hui/ }).click()
  await page.keyboard.press('Escape')
  await expect.poll(async () => Object.keys(await progress(page)).length).toBe(0)

  await page.goto('/#/infos')
  await page.getByTestId('backup-input').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByRole('dialog')).toContainText('Suivi des animaux')
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByText('Sauvegarde restaurée ✓')).toBeVisible()
  await page.goto('/#/collection/animaux')
  await expect(page.getByRole('button', { name: /^Capybara classique/ })).toContainText('🐾 1/3')
  await expect(page.getByTestId('critters-obtained')).toHaveText('1 obtenu sur 90')
})

test('hors ligne : le Pets Tracker fonctionne et garde ses données', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.goto('/#/collection/animaux')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Animaux' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Lapin calico/ })).toBeVisible() // les variantes sont dans l'app
  await chooseAllExtensions(page) // la configuration aussi fonctionne hors ligne
  await page.getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }).click()
  await expect(page.getByRole('button', { name: /^Capybara classique/ })).toContainText('🐾 1/3')
  await page.goto('/#/collection/animaux/aujourdhui')
  await page.reload()
  await expect(todayCount(page)).toBeVisible()
  await page.goto('/#/collection')
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible()
  await context.setOffline(false)
  expect((await progress(page))['classic-capybara']?.feedings).toBe(1)
})

test('rendu mobile à 360 px : accueil Collection, liste, fiche, extensions', async ({ page }) => {
  await page.clock.install({ time: NOON })
  await page.goto('/#/collection')
  await expect(page.getByRole('heading', { name: 'Collection' })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/collection-360.png', fullPage: true })

  await page.goto('/#/collection/animaux')
  await expect(page.getByRole('heading', { name: 'Animaux' })).toBeVisible()
  await expect(page.getByTestId('extensions-setup')).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/extensions-360.png', fullPage: true })
  await chooseAllExtensions(page)
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/animaux-360.png' })
  await page.getByText(/Mes extensions/).click()
  await noOverflow(page)

  await page.getByRole('button', { name: /^Patterned Skunk/ }).click()
  await expect(page.getByRole('dialog', { name: 'Patterned Skunk' })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/animal-fiche-360.png' })
  await page.keyboard.press('Escape')

  await page.goto('/#/')
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/aujourdhui-animaux-360.png', fullPage: true })
})

test('configuration initiale : rien n’est supposé, choix conservé après rechargement, modifiable ensuite', async ({ page }) => {
  await page.clock.install({ time: NOON })
  await page.goto('/#/collection')
  await expect(page.getByTestId('critters-progress')).toHaveText('0 obtenu sur 41')
  await page.goto('/#/collection/animaux')
  const setup = page.getByTestId('extensions-setup')
  await expect(setup).toBeVisible()
  await expect(setup.getByRole('checkbox', { name: 'Jeu de base (toujours inclus)' })).toBeDisabled()
  for (const name of [/Éternité/, /Vallon des contes/, /Wishblossom/, /Honeyglow/]) await expect(setup.getByRole('checkbox', { name })).not.toBeChecked()
  await expect(page.getByText('Capybara classique')).toHaveCount(0)
  expect(await stored(page, 'critters')).toBeUndefined() // rien d'enregistré tant qu'elle n'a pas validé

  // Une seule extension : ses animaux seulement
  await setup.getByRole('checkbox', { name: /Éternité/ }).check()
  await setup.getByRole('button', { name: 'Valider mes choix' }).click()
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 59')
  await expect(page.getByText('Oie noire')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('extensions-setup')).toHaveCount(0)
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 59')

  // Les extensions non choisies n'influencent jamais le compteur du jour
  await page.goto('/#/collection/animaux/aujourdhui')
  const first = Number(/\/(\d+)/.exec((await todayCount(page).textContent())!)![1])
  await page.goto('/#/collection/animaux')
  await page.getByText('Mes extensions (1/4)').click()
  await page.getByRole('button', { name: 'Tout sélectionner' }).click()
  await expect(page.getByTestId('critters-obtained')).toHaveText('0 obtenu sur 90')
  await page.goto('/#/collection/animaux/aujourdhui')
  const second = Number(/\/(\d+)/.exec((await todayCount(page).textContent())!)![1])
  expect(second).toBeGreaterThan(first)
  expect(await stored(page, 'critters')).toMatchObject({ configured: true, owned: { eternity: true, storybook: true, wishblossom: true, honeyglow: true } })
})

test('seuils de nourrissage : exact, « au moins » et inconnu, sans garantie d’obtention', async ({ page }) => {
  await page.clock.install({ time: NOON })
  await page.goto('/#/collection/animaux')
  await chooseAllExtensions(page)
  await expect(page.getByTestId('threshold-legend')).toContainText('Aucun nombre ne garantit l’obtention')
  await expect(page.getByRole('button', { name: /^Lapin noir/ })).toContainText('🐾 0/2')
  await expect(page.getByRole('button', { name: /^Passereau émeraude/ })).toContainText('🐾 0 · au moins 4')
  await expect(page.getByRole('button', { name: /^Singe beige/ })).toContainText('🐾 0 · seuil inconnu')

  await page.getByRole('button', { name: /^Singe beige/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Singe beige' })
  await expect(sheet.getByTestId('threshold-chip')).toHaveText('Seuil inconnu')
  for (let i = 0; i < 3; i++) await sheet.getByRole('button', { name: 'Augmenter : Total des nourrissages' }).click()
  await expect(sheet.getByTestId('critter-count')).toHaveText('3 · seuil inconnu')
  await expect(sheet.getByTestId('threshold-reached')).toHaveCount(0) // trois nourrissages ne sont jamais « suffisants »
  await expect(sheet.getByTestId('threshold-explanation')).toContainText('ne garantit son obtention')
  await page.screenshot({ path: 'test-results/seuil-inconnu-360.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
})
