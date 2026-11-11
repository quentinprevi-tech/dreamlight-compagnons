import { expect, test, type Page } from '@playwright/test'

/** Tâches enregistrées, lues directement dans le vrai IndexedDB d'Edge. */
async function storedTasks(page: Page): Promise<{ done: Record<string, string>; custom: { label: string }[]; postponed: { taskId: string }[] }> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('dreamlight-compagnons')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const value = await new Promise<unknown>((resolve) => {
      const r = db.transaction('kv').objectStore('kv').get('tasks')
      r.onsuccess = () => resolve(r.result)
    })
    db.close()
    return (value ?? { done: {}, custom: [], postponed: [] }) as never
  })
}

const todo = (page: Page) => page.getByRole('list', { name: 'À faire' })
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

test('Aujourd’hui : cocher, reporter, gérer, puis tout retrouver après rechargement', async ({ page }) => {
  // Horloge fixée : le nombre d'animaux à nourrir dépend du jour et de l'heure (lundi, midi à Bruxelles)
  await page.clock.install({ time: new Date('2026-11-09T11:00:00Z') })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible()
  // 10 tâches à cocher + la ligne « Animaux à nourrir » (calculée, sans case à cocher)
  await expect(todo(page).getByRole('checkbox')).toHaveCount(10)
  await expect(todo(page).getByTestId('computed-task')).toBeVisible()

  await todo(page).getByRole('checkbox', { name: 'Ouvrir les coffres' }).click()
  await expect(page.getByRole('list', { name: 'Terminées' }).getByRole('checkbox', { name: 'Ouvrir les coffres' })).toBeVisible()
  await expect(page.getByTestId('today-progress')).toHaveText('1 tâche faite sur 11')

  await page.getByRole('button', { name: 'Options : Récolter les racines' }).click()
  await page.getByRole('button', { name: /Reporter/ }).click()
  await expect(page.getByRole('list', { name: 'Reportées' })).toContainText('Récolter les racines')
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/aujourdhui-taches-360.png', fullPage: true })

  // Gestion : une tâche « Autres » et une tâche personnalisée
  await page.getByRole('link', { name: /Gérer les tâches/ }).click()
  await page.getByRole('list', { name: 'Autres' }).getByRole('checkbox', { name: /Ramasser les bois/ }).check()
  await page.getByRole('button', { name: '+ Ajouter' }).click()
  await page.getByLabel('Nom de la tâche').fill('Finir la quête de Merlin')
  await page.getByRole('radio', { name: /Une seule fois/ }).check()
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Mes tâches' })).toContainText('Finir la quête de Merlin')
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/gerer-taches-360.png', fullPage: true })

  // Rechargement : tout est conservé
  await page.reload()
  await page.goto('/#/')
  await expect(page.getByRole('list', { name: 'Terminées' })).toContainText('Ouvrir les coffres')
  await expect(page.getByRole('list', { name: 'Reportées' })).toContainText('Récolter les racines')
  await expect(todo(page).getByRole('checkbox', { name: 'Ramasser les bois' })).toBeVisible()
  await expect(todo(page).getByRole('checkbox', { name: 'Finir la quête de Merlin' })).toBeVisible()
  const stored = await storedTasks(page)
  expect(stored.custom.map((c) => c.label)).toEqual(['Finir la quête de Merlin'])
  expect(stored.postponed.map((p) => p.taskId)).toEqual(['harvest-roots'])
})

test('app restée ouverte : à minuit, les tâches quotidiennes reviennent ; le DreamSnap attend mercredi', async ({ page }) => {
  // Lundi 9 novembre 2026, 23 h 58 à Bruxelles
  await page.clock.install({ time: new Date('2026-11-09T22:58:00Z') })
  await page.goto('/')
  await todo(page).getByRole('checkbox', { name: 'Ouvrir les coffres' }).click()
  await todo(page).getByRole('checkbox', { name: 'Participer au DreamSnap' }).click()
  await expect(page.getByRole('list', { name: 'Terminées' }).getByRole('checkbox')).toHaveCount(2)

  // L'horloge avance de 3 minutes sans rechargement : 00 h 01 le mardi
  await page.clock.fastForward('03:00')
  await expect(todo(page).getByRole('checkbox', { name: 'Ouvrir les coffres' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Terminées' }).getByRole('checkbox')).toHaveCount(1)
  await expect(page.getByRole('list', { name: 'Terminées' })).toContainText('Participer au DreamSnap')
  await expect(page.getByRole('list', { name: 'Terminées' })).toContainText('Revient demain à 15:00') // mardi 00 h 01 → mercredi 15 h (14 h UTC)
})

test('deux onglets : chacun coche une tâche, l’autre la voit sans rechargement', async ({ context }) => {
  await context.clock.install({ time: new Date('2026-11-09T11:00:00Z') })
  const one = await context.newPage()
  const two = await context.newPage()
  await one.goto('/')
  await two.goto('/')
  await Promise.all([
    todo(one).getByRole('checkbox', { name: 'Ouvrir les coffres' }).click(),
    todo(two).getByRole('checkbox', { name: 'Offrir des cadeaux aux habitants' }).click(),
  ])
  for (const page of [one, two]) {
    await expect(page.getByRole('list', { name: 'Terminées' }).getByRole('checkbox')).toHaveCount(2)
    await expect(page.getByTestId('today-progress')).toHaveText('2 tâches faites sur 11')
  }
  expect(Object.keys((await storedTasks(one)).done).sort()).toEqual([expect.stringMatching(/^give-gifts@/), expect.stringMatching(/^open-chests@/)])
})

test('navigation : 4 onglets et sélecteur Habitants / Métiers / Numismagie à 360 px', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link')).toHaveText(['✨Aujourd’hui', '🏰Habitants', '🐾Collection', '📜Infos'])
  await nav.getByRole('link', { name: /Habitants/ }).click()
  const views = page.getByRole('navigation', { name: 'Vues des habitants' })
  await views.getByRole('link', { name: 'Métiers' }).click()
  await expect(page.getByTestId('count-fishing')).toBeVisible()
  await noOverflow(page)
  await views.getByRole('link', { name: 'Numismagie' }).click()
  await expect(page.getByTestId('scramble-count')).toBeVisible()
  await page.screenshot({ path: 'test-results/numismagie-selecteur-360.png' })
  // Ancienne adresse d'un métier : retour vers « Métiers »
  await page.goto('/#/metier/fishing')
  await page.getByRole('link', { name: '‹ Métiers' }).click()
  await expect(page).toHaveURL(/#\/metiers$/)
})
