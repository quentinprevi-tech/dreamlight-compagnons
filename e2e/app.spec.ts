import { expect, test, type Page } from '@playwright/test'

async function assignFromList(page: Page, name: string, profession: string) {
  await page.getByRole('link', { name: /Habitants/ }).first().click()
  const search = page.getByLabel('Rechercher par nom')
  await search.fill(name)
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(profession) }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('affectations conservées après actualisation et nouveau contexte de page', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByTestId('count-fishing')).toHaveText('0')

  await assignFromList(page, 'Dingo', 'Pêche')
  await assignFromList(page, 'Ariel', 'Pêche')
  await assignFromList(page, 'Rémy', 'Jardinage')

  await page.reload()
  await page.goto('/#/')
  await expect(page.getByTestId('count-fishing')).toHaveText('2')
  await expect(page.getByTestId('count-gardening')).toHaveText('1')

  // « Redémarrage » : on ferme la page et on en ouvre une nouvelle
  await page.close()
  const again = await context.newPage()
  await again.goto('/#/metier/fishing')
  const list = again.getByRole('list', { name: 'Habitants : Pêche' })
  await expect(list.getByRole('button')).toHaveCount(2)
  await expect(list).toContainText('Dingo')
  await expect(list).toContainText('Ariel')
})

test('aucun défilement horizontal sur petit écran', async ({ page }) => {
  for (const hash of ['#/', '#/personnages', '#/metier/digging', '#/infos']) {
    await page.goto('/' + hash)
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, hash).toBeLessThanOrEqual(0)
  }
  await page.goto('/#/')
  await page.screenshot({ path: 'test-results/accueil-360.png', fullPage: true })
  await page.goto('/#/personnages')
  await page.screenshot({ path: 'test-results/habitants-360.png' })
})

test('PWA : manifeste valide et fonctionnement hors ligne', async ({ page, context }) => {
  await page.goto('/')
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href')
    return href ? (await fetch(href)).json() : null
  })
  expect(manifest.name).toBe('Dreamlight Compagnons')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))

  // Le service worker doit prendre le contrôle et tout mettre en cache
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await assignFromList(page, 'Stitch', 'Creusage')

  await context.setOffline(true)
  await page.reload()
  await page.goto('/#/metier/digging')
  await expect(page.getByRole('list', { name: 'Habitants : Creusage' })).toContainText('Stitch')
  await page.goto('/#/personnages')
  await expect(page.getByLabel('Rechercher par nom')).toBeVisible()
  await context.setOffline(false)
})
