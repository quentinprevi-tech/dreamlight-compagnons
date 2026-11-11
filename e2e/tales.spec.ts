import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

/**
 * Ces tests utilisent le VRAI IndexedDB d'Edge : la clé `tales` est lue directement avec l'API `indexedDB`.
 * Fuseau : Europe/Brussels (voir playwright.config.ts).
 */
interface Tales {
  counts: Record<string, number>
  puzzles: Record<string, { doneAt: string; opId?: string }>
  log: { id: string; taleId: string; deltas: Record<string, number> }[]
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
const tales = async (page: Page): Promise<Tales> => (await stored<Tales>(page, 'tales')) ?? { counts: {}, puzzles: {}, log: [] }
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

const BLUE = 'Anigami oiseau bleu'
const RED = 'Anigami oiseau rouge'
const viewButton = (page: Page, name: string) => page.getByRole('group', { name: 'Vue' }).getByRole('button', { name })
const counter = (page: Page, name: string) => page.getByRole('spinbutton', { name: `Possédés : ${name}` })
async function setCount(page: Page, name: string, n: number | string) {
  await counter(page, name).fill(String(n))
  await counter(page, name).press('Tab')
}
async function openPuzzle(page: Page, pattern: RegExp) {
  await page.getByRole('button', { name: pattern }).click()
}
async function validate(page: Page, title: string) {
  await page.getByRole('dialog', { name: title }).getByRole('button', { name: /Valider et déduire les anigamis/ }).click()
}

test('valider un puzzle : récapitulatif avant, déduction exacte, annulation qui conserve les modifications manuelles', async ({ page }) => {
  await page.goto('/#/collection/puzzles')
  await expect(page.getByRole('heading', { name: 'Puzzles' })).toBeVisible()
  await viewButton(page, '📜 Anigamis').click()
  await setCount(page, BLUE, 30)
  await expect.poll(async () => (await tales(page)).counts).toEqual({ 'blue-bird': 30 })

  await viewButton(page, '🧩 Puzzles').click()
  await openPuzzle(page, /^Aladdin/)
  await expect(page.getByTestId('puzzle-status')).toHaveText(/Réalisable/)
  await validate(page, 'Aladdin')
  // Récapitulatif précis AVANT validation : rien n'est encore déduit
  const confirm = page.getByRole('dialog', { name: 'Valider « Aladdin » ?' })
  await expect(confirm.getByRole('list', { name: 'Récapitulatif' })).toContainText('30 → 5 (−25)')
  expect((await tales(page)).counts).toEqual({ 'blue-bird': 30 })
  await confirm.getByRole('button', { name: 'Valider et déduire' }).click()
  await expect(page.getByTestId('puzzle-done-info')).toContainText('anigamis déduits')
  await expect.poll(async () => (await tales(page)).counts).toEqual({ 'blue-bird': 5 })
  const afterValidation = await tales(page)
  expect(afterValidation.puzzles.aladdin?.opId).toBeDefined()
  expect(afterValidation.log).toHaveLength(1)
  expect(afterValidation.log[0]).toMatchObject({ taleId: 'aladdin', deltas: { 'blue-bird': 25 } })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tales-progress')).toHaveText('1 puzzle terminé sur 39')

  // Modifications manuelles APRÈS la validation
  await viewButton(page, '📜 Anigamis').click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: `Ajouter un : ${BLUE}` }).click()
  await setCount(page, RED, 6)
  await expect.poll(async () => (await tales(page)).counts).toEqual({ 'blue-bird': 8, 'red-bird': 6 })

  // Annulation : 8 + 25 = 33 (pas l'ancienne valeur 30), les 6 rouges sont conservés
  await viewButton(page, '🧩 Puzzles').click()
  await page.getByTestId('undo-card').getByRole('button', { name: /Annuler/ }).click()
  const undo = page.getByRole('dialog', { name: 'Annuler la validation de « Aladdin » ?' })
  await expect(undo.getByRole('list', { name: 'Récapitulatif' })).toContainText('8 → 33 (+25)')
  await undo.getByRole('button', { name: 'Annuler la validation' }).click()
  await expect.poll(async () => (await tales(page)).counts).toEqual({ 'blue-bird': 33, 'red-bird': 6 })
  const afterUndo = await tales(page)
  expect(afterUndo.puzzles).toEqual({})
  expect(afterUndo.log).toEqual([])
  await expect(page.getByTestId('undo-card')).toHaveCount(0)
})

test('jamais de compteur négatif, jamais de validation sans assez d’anigamis', async ({ page }) => {
  await page.goto('/#/collection/puzzles')
  await viewButton(page, '📜 Anigamis').click()
  await expect(page.getByRole('button', { name: `Retirer un : ${BLUE}` })).toBeDisabled() // « − » bloqué à 0
  await setCount(page, BLUE, 24)
  await expect.poll(async () => (await tales(page)).counts).toEqual({ 'blue-bird': 24 })
  await setCount(page, BLUE, -5)
  await expect(page.getByRole('alert')).toContainText('Un compteur ne peut pas être négatif.')
  await expect(counter(page, BLUE)).toHaveValue('24')
  expect((await tales(page)).counts).toEqual({ 'blue-bird': 24 })

  await viewButton(page, '🧩 Puzzles').click()
  await openPuzzle(page, /^Aladdin/)
  const button = page.getByRole('dialog', { name: 'Aladdin' }).getByRole('button', { name: /Valider et déduire les anigamis/ })
  await expect(button).toBeDisabled()
  await expect(button).toContainText('Il en manque 1')
  expect((await tales(page)).puzzles).toEqual({})
})

test('marquer terminé sans déduire, et coûts contradictoires sans déduction automatique', async ({ page }) => {
  await page.goto('/#/collection/puzzles')
  await viewButton(page, '📜 Anigamis').click()
  await setCount(page, BLUE, 3)
  await viewButton(page, '🧩 Puzzles').click()
  await openPuzzle(page, /^Aladdin/)
  await page.getByRole('dialog', { name: 'Aladdin' }).getByRole('button', { name: /Marquer terminé sans déduire/ }).click()
  await page.getByRole('dialog', { name: 'Marquer « Aladdin » terminé ?' }).getByRole('button', { name: 'Marquer terminé' }).click()
  await expect(page.getByTestId('puzzle-done-info')).toContainText('marqué terminé sans déduction')
  await expect.poll(async () => (await tales(page)).puzzles.aladdin).toBeDefined()
  expect(await tales(page)).toMatchObject({ counts: { 'blue-bird': 3 }, log: [] })
  await page.keyboard.press('Escape')

  // Moana : sources contradictoires
  await openPuzzle(page, /^Moana/)
  const sheet = page.getByRole('dialog', { name: 'Moana' })
  await expect(sheet.getByTestId('puzzle-status')).toContainText('Coûts à confirmer')
  await expect(sheet.getByTestId('cost-conflict')).toContainText('Autre source')
  await expect(sheet.getByRole('button', { name: /Valider et déduire les anigamis/ })).toBeDisabled()
})

test('deux onglets : synchronisation, et deux validations concurrentes qui se partagent les mêmes anigamis', async ({ context }) => {
  const one = await context.newPage()
  const two = await context.newPage()
  await one.goto('/#/collection/puzzles')
  await two.goto('/#/collection/puzzles')
  await viewButton(one, '📜 Anigamis').click()
  await viewButton(two, '📜 Anigamis').click()

  // L'onglet 1 saisit des compteurs : l'onglet 2 les voit sans rechargement
  await setCount(one, BLUE, 30)
  await setCount(one, RED, 10)
  await expect(counter(two, BLUE)).toHaveValue('30')
  await expect(counter(two, RED)).toHaveValue('10')

  // Deux ajouts en même temps sur le même compteur : aucun n'est perdu
  await Promise.all([one.getByRole('button', { name: `Ajouter un : ${RED}` }).click(), two.getByRole('button', { name: `Ajouter un : ${RED}` }).click()])
  await expect(counter(one, RED)).toHaveValue('12')
  await expect(counter(two, RED)).toHaveValue('12')
  await setCount(one, RED, 10)
  await expect(counter(two, RED)).toHaveValue('10')

  // 30 bleus : Aladdin (25) ou Cendrillon (15 + 10 rouges), pas les deux
  await viewButton(two, '🧩 Puzzles').click()
  await openPuzzle(two, /^Cinderella/)
  await validate(two, 'Cinderella')
  const confirmTwo = two.getByRole('dialog', { name: 'Valider « Cinderella » ?' })
  await expect(confirmTwo.getByRole('button', { name: 'Valider et déduire' })).toBeEnabled()

  await viewButton(one, '🧩 Puzzles').click()
  await openPuzzle(one, /^Aladdin/)
  await validate(one, 'Aladdin')
  await one.getByRole('dialog', { name: 'Valider « Aladdin » ?' }).getByRole('button', { name: 'Valider et déduire' }).click()
  await expect.poll(async () => Object.keys((await tales(one)).puzzles)).toEqual(['aladdin'])

  // L'onglet 2, resté sur sa fiche de confirmation, voit que les compteurs ont changé : bloqué, sans valeur négative
  await expect(confirmTwo.getByTestId('confirm-blocked')).toContainText('Tes compteurs ont changé')
  await expect(confirmTwo.getByRole('button', { name: 'Valider et déduire' })).toBeDisabled()
  await expect(confirmTwo.getByRole('list', { name: 'Récapitulatif' })).not.toContainText('-')
  const final = await tales(one)
  expect(final.counts).toEqual({ 'blue-bird': 5, 'red-bird': 10 })
  expect(final.log).toHaveLength(1)
})

test('export puis restauration : compteurs, puzzles terminés et annulation reviennent', async ({ page }) => {
  await page.goto('/#/collection/puzzles')
  await viewButton(page, '📜 Anigamis').click()
  await setCount(page, BLUE, 30)
  await viewButton(page, '🧩 Puzzles').click()
  await openPuzzle(page, /^Aladdin/)
  await validate(page, 'Aladdin')
  await page.getByRole('dialog', { name: 'Valider « Aladdin » ?' }).getByRole('button', { name: 'Valider et déduire' }).click()
  await expect.poll(async () => Object.keys((await tales(page)).puzzles)).toEqual(['aladdin'])

  await page.goto('/#/infos')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter une copie' }).click()])
  const file = JSON.parse(await readFile(await download.path(), 'utf-8'))
  expect(file.sections.tales.data.counts).toEqual({ 'blue-bird': 5 })
  expect(file.sections.tales.data.log).toHaveLength(1)

  // On annule la validation et on change les compteurs, puis on restaure le fichier
  await page.goto('/#/collection/puzzles')
  await page.getByTestId('undo-card').getByRole('button', { name: /Annuler/ }).click()
  await page.getByRole('dialog', { name: /Annuler la validation/ }).getByRole('button', { name: 'Annuler la validation' }).click()
  await expect.poll(async () => (await tales(page)).counts).toEqual({ 'blue-bird': 30 })

  await page.goto('/#/infos')
  await page.getByTestId('backup-input').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByRole('dialog')).toContainText('Puzzles et anigamis')
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByText('Sauvegarde restaurée ✓')).toBeVisible()
  await page.goto('/#/collection/puzzles')
  await expect(page.getByTestId('tales-progress')).toHaveText('1 puzzle terminé sur 39')
  await expect(page.getByTestId('undo-card')).toContainText('Aladdin') // l'annulation reste possible après restauration
  expect((await tales(page)).counts).toEqual({ 'blue-bird': 5 })
})

test('hors ligne : les puzzles fonctionnent et gardent leurs données', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.goto('/#/collection/puzzles')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Puzzles' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Aladdin/ })).toBeVisible() // les 39 puzzles sont dans l'app
  await viewButton(page, '📜 Anigamis').click()
  await setCount(page, BLUE, 25)
  await viewButton(page, '🧩 Puzzles').click()
  await openPuzzle(page, /^Aladdin/)
  await validate(page, 'Aladdin')
  await page.getByRole('dialog', { name: 'Valider « Aladdin » ?' }).getByRole('button', { name: 'Valider et déduire' }).click()
  await expect(page.getByTestId('puzzle-done-info')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByTestId('tales-progress')).toHaveText('1 puzzle terminé sur 39')
  await context.setOffline(false)
  expect(await tales(page)).toMatchObject({ counts: {}, puzzles: { aladdin: {} } })
})

test('rendu mobile à 360 px : accueil Collection, puzzles, anigamis, fiche et confirmation', async ({ page }) => {
  await page.goto('/#/collection')
  await expect(page.getByTestId('puzzles-progress')).toHaveText('0 terminé sur 39')
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/collection-puzzles-360.png', fullPage: true })

  await page.goto('/#/collection/puzzles')
  await expect(page.getByRole('heading', { name: 'Puzzles' })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/puzzles-360.png' })

  await viewButton(page, '📜 Anigamis').click()
  await setCount(page, BLUE, 30)
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/anigamis-360.png', fullPage: true })

  await viewButton(page, '🧩 Puzzles').click()
  await openPuzzle(page, /^Beauty and the Beast/)
  await expect(page.getByRole('dialog', { name: 'Beauty and the Beast' })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/puzzle-fiche-360.png' })
  await page.keyboard.press('Escape')

  await openPuzzle(page, /^Aladdin/)
  await validate(page, 'Aladdin')
  await expect(page.getByRole('dialog', { name: 'Valider « Aladdin » ?' })).toBeVisible()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/puzzle-confirmation-360.png' })
})
