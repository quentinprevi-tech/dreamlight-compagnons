import { expect, test, type Page } from '@playwright/test'

/**
 * Tri, filtres et niveaux sur écran de téléphone (360 px, tactile), avec le VRAI IndexedDB d'Edge.
 * Captures d'écran seulement si la variable DDV_SHOTS désigne un dossier (contrôle visuel manuel).
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

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
const shot = async (page: Page, name: string) => {
  if (process.env.DDV_SHOTS) await page.screenshot({ path: `${process.env.DDV_SHOTS}/${name}.png` })
}
async function chooseAllExtensions(page: Page) {
  const setup = page.getByTestId('extensions-setup')
  await setup.getByRole('button', { name: 'Tout sélectionner' }).click()
  await setup.getByRole('button', { name: 'Valider mes choix' }).click()
  await expect(setup).toHaveCount(0)
}
const animalRows = (page: Page) => page.getByRole('checkbox', { name: /^Obtenu :/ })

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOON })
})

test('Animaux : tri A → Z / Z → A et filtre de capacité, sans débordement à 360 px', async ({ page }) => {
  await page.goto('/#/collection/animaux')
  await expect(page.getByRole('heading', { name: 'Animaux' })).toBeVisible()
  await chooseAllExtensions(page)
  await shot(page, 'animaux-defaut')

  // Les commandes sont visibles sans défilement horizontal et assez grandes pour le doigt
  const select = page.getByRole('combobox', { name: 'Trier' })
  await expect(select).toBeVisible()
  expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(32)
  await select.selectOption('name')
  const asc = (await animalRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace('Obtenu : ', ''))))
  expect(asc).toHaveLength(90)
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })))
  await noOverflow(page)
  await shot(page, 'animaux-tri-az')

  await page.getByRole('button', { name: /^Inverser le tri/ }).click()
  const desc = await animalRows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.replace('Obtenu : ', '')))
  expect(desc).toEqual([...asc].reverse())

  await page.getByRole('button', { name: '🍎 Fruits' }).click()
  await expect(animalRows(page)).toHaveCount(5)
  await expect(page.getByTestId('active-filters')).toContainText('Collecte : 🍎 Fruits')
  await noOverflow(page)
  await shot(page, 'animaux-filtre-fruits')

  await page.getByRole('button', { name: 'Tout réinitialiser' }).click()
  await expect(animalRows(page)).toHaveCount(90)
  await expect(page.getByTestId('active-filters')).toHaveCount(0)
  await expect(page.getByTestId('biome-plaza')).toBeVisible()
})

test('Animaux : le niveau du compagnon (1 à 5) est conservé après rechargement, les autres données aussi', async ({ page }) => {
  await page.goto('/#/collection/animaux')
  await chooseAllExtensions(page)
  // Donnée préexistante : un nourrissage
  await page.getByRole('button', { name: 'Nourri aujourd’hui : Lapin noir' }).click()
  await page.getByRole('checkbox', { name: 'Obtenu : Capybara classique' }).click()
  await page.getByRole('button', { name: /^Capybara classique/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Capybara classique' })
  await expect(sheet.getByRole('status', { name: 'Niveau du compagnon' })).toHaveText('Non renseigné')
  const up = sheet.getByRole('button', { name: 'Augmenter : Niveau du compagnon' })
  for (let i = 0; i < 5; i++) await up.click() // le bouton se désactive au niveau 5 : on ne peut pas dépasser
  await expect(sheet.getByRole('status', { name: 'Niveau du compagnon' })).toHaveText('Niveau 5 (max)')
  await expect(up).toBeDisabled()
  await sheet.getByRole('button', { name: 'Baisser : Niveau du compagnon' }).click()
  await expect(sheet.getByRole('status', { name: 'Niveau du compagnon' })).toHaveText('Niveau 4')
  await shot(page, 'animal-fiche-niveau')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Capybara classique/ }).getByTestId('critter-level')).toHaveText('❤️ 4/5')

  await page.reload()
  await expect(page.getByRole('button', { name: /^Capybara classique/ }).getByTestId('critter-level')).toHaveText('❤️ 4/5')
  await expect(page.getByRole('button', { name: /^Lapin noir/ })).toContainText('🐾 1/2')
  const data = await stored<{ progress: Record<string, unknown> }>(page, 'critters')
  expect(data?.progress['classic-capybara']).toEqual({ obtained: true }) // le niveau est dans sa propre clé
  expect(await stored(page, 'critterLevels')).toEqual({ 'classic-capybara': 4 })
  expect(data?.progress['black-rabbit']).toEqual({ feedings: 1, lastFed: '2026-11-09' })
  await noOverflow(page)
})

test('Habitants : tri par amitié, inversion et filtre « Amitié < 10 » après saisie par l’interface', async ({ page }) => {
  await page.goto('/#/personnages')
  await expect(page.getByRole('heading', { name: 'Habitants' })).toBeVisible()

  const setFriendship = async (name: string, level: number) => {
    await page.getByLabel('Rechercher par nom').fill(name)
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
    const dialog = page.getByRole('dialog')
    if (!(await dialog.getByRole('checkbox', { name: 'Débloqué dans ma partie' }).isChecked())) await dialog.getByRole('checkbox', { name: 'Débloqué dans ma partie' }).check()
    for (let i = 0; i < level; i++) await dialog.getByRole('button', { name: 'Augmenter : Niveau d’amitié' }).click()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
  await setFriendship('Jasmine', 2)
  await setFriendship('Aladdin', 10)
  await setFriendship('Alice', 6)
  await page.getByLabel('Rechercher par nom').fill('')

  await page.getByRole('combobox', { name: 'Trier' }).selectOption('friendship')
  const first = async (n: number) =>
    page.getByRole('list', { name: 'Triés par niveau d’amitié' }).getByRole('button').evaluateAll((els, k) => els.slice(0, k).map((e) => e.textContent!), n)
  const [a, b, c] = await first(3)
  expect(a).toMatch(/^Jasmine/) // niveau 2
  expect(b).toMatch(/^Alice/) // niveau 6
  expect(c).toMatch(/^Aladdin/) // niveau 10
  await shot(page, 'habitants-tri-amitie')

  await page.getByRole('button', { name: /^Inverser le tri/ }).click()
  expect((await first(1))[0]).toMatch(/^Aladdin/)

  await page.getByRole('button', { name: '❤️ Amitié < 10' }).click()
  await expect(page.getByTestId('villagers-count')).toContainText('2 habitants')
  await expect(page.getByRole('button', { name: /^Aladdin/ })).toHaveCount(0) // niveau 10
  await noOverflow(page)
  await shot(page, 'habitants-filtre-niveau10')

  // Les saisies, pas le tri, sont enregistrées : après rechargement, les niveaux sont là
  await page.reload()
  const villagers = await stored<Record<string, { friendship?: number }>>(page, 'villagers')
  expect(villagers?.jasmine?.friendship).toBe(2)
  expect(villagers?.aladdin?.friendship).toBe(10)
  expect(villagers?.alice?.friendship).toBe(6)
  // Le tri et les filtres ne sont pas enregistrés : après rechargement, l'affichage est complet
  await expect(page.getByTestId('active-filters')).toHaveCount(0)
})
