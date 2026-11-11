import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Ces tests utilisent le VRAI IndexedDB d'Edge : l'app passe par idb-keyval, et
 * `rawDb` lit ou écrit la base directement avec l'API `indexedDB`, sans simulation.
 */
async function rawDb<T>(page: Page, action: 'dump' | 'seed-v1'): Promise<T> {
  return page.evaluate(async (what) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('dreamlight-compagnons')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const tx = db.transaction('kv', what === 'dump' ? 'readonly' : 'readwrite')
    const store = tx.objectStore('kv')
    let entries: [IDBValidKey, unknown][] = []
    if (what === 'seed-v1') {
      // État exact d'un téléphone avant la phase 0 : métiers + photo, sans numéro de version.
      store.clear()
      store.put({ mickey: 'fishing', goofy: 'gardening', elsa: 'mining' }, 'assignments')
      store.put(new Blob([new Uint8Array([255, 216, 255, 224])], { type: 'image/jpeg' }), 'portrait:ariel')
    } else {
      const keys = await new Promise<IDBValidKey[]>((resolve) => {
        const r = store.getAllKeys()
        r.onsuccess = () => resolve(r.result)
      })
      const values = await new Promise<unknown[]>((resolve) => {
        const r = store.getAll()
        r.onsuccess = () => resolve(r.result)
      })
      entries = keys.map((k, i) => [k, values[i]])
    }
    await new Promise((resolve) => (tx.oncomplete = resolve))
    db.close()
    if (what !== 'dump') return null
    const out: Record<string, unknown> = {}
    for (const [k, v] of entries) {
      if (v instanceof Blob) {
        // Empreinte du contenu réel de la photo (et pas seulement sa taille)
        const bytes = new Uint8Array(await v.arrayBuffer())
        let hash = 0
        for (const b of bytes) hash = (hash * 31 + b) >>> 0
        out[String(k)] = { blob: v.type, size: v.size, hash }
      } else out[String(k)] = v
    }
    return out
  }, action) as Promise<T>
}

type Dump = Record<string, unknown>
type Photo = { blob: string; size: number; hash: number }

const photosOf = (dump: Dump) =>
  Object.fromEntries(Object.entries(dump).filter(([k]) => k.startsWith('portrait:')).map(([k, v]) => [k.slice(9), v as Photo]))

async function openCharacter(page: Page, name: string) {
  await page.goto('/#/personnages')
  await page.getByLabel('Rechercher par nom').fill(name)
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  return page.getByRole('dialog')
}

async function setPhoto(page: Page, name: string, file: string) {
  const dialog = await openCharacter(page, name)
  await page.getByTestId('portrait-input').setInputFiles(file)
  await expect(dialog.getByRole('button', { name: 'Changer ma photo' })).toBeVisible()
  await page.keyboard.press('Escape')
}

async function exportFile(page: Page, withPhotos: boolean) {
  await page.goto('/#/infos')
  const box = page.getByRole('checkbox', { name: /Inclure ma photo|Inclure mes|Aucune photo personnelle/ })
  // Sans photo sur le téléphone, la case est désactivée (rien à inclure).
  if (await box.isEnabled()) {
    if (withPhotos) await box.check()
    else await box.uncheck()
  } else expect(withPhotos).toBe(false)
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter une copie' }).click()])
  return JSON.parse(await readFile(await download.path(), 'utf-8'))
}

/** Choisit le fichier dans Infos et renvoie la fiche de confirmation. */
async function chooseBackup(page: Page, content: unknown): Promise<Locator> {
  await page.goto('/#/infos')
  await page
    .getByTestId('backup-input')
    .setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)) })
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  return sheet
}

async function confirmRestore(page: Page, sheet: Locator) {
  await sheet.getByRole('button', { name: 'Restaurer' }).click()
  await expect(page.getByText('Sauvegarde restaurée ✓')).toBeVisible()
}

test('mise à jour d’une base v1 réelle : rien n’est perdu', async ({ page }) => {
  await page.goto('/#/metiers')
  await expect(page.getByTestId('count-fishing')).toHaveText('0')
  await rawDb(page, 'seed-v1')

  await page.reload()
  await expect(page.getByTestId('count-fishing')).toHaveText('1')
  await expect(page.getByTestId('count-gardening')).toHaveText('1')
  await expect(page.getByTestId('count-mining')).toHaveText('1')

  const dump = await rawDb<Dump>(page, 'dump')
  expect(dump['meta:schema']).toBe(3)
  expect(dump['meta:migration']).toBeUndefined()
  expect(dump['portrait:ariel']).toMatchObject({ blob: 'image/jpeg', size: 4 })
  expect(dump.assignments).toEqual({ mickey: 'fishing', goofy: 'gardening', elsa: 'mining' })
  // Phase 1 : les habitants qui avaient un métier sont débloqués, aucun autre
  expect(dump.villagers).toEqual({ mickey: { unlocked: true }, goofy: { unlocked: true }, elsa: { unlocked: true } })
  expect(dump['snapshot:pre-v3']).toMatchObject({ from: 1, data: { assignments: { mickey: 'fishing', goofy: 'gardening', elsa: 'mining' } } })

  // Dans l'interface : débloqués, et les autres non débloqués
  await page.goto('/#/personnages')
  const filters = page.getByRole('group', { name: 'Filtrer les habitants' })
  await filters.getByRole('button', { name: 'Débloqués', exact: true }).click()
  await expect(page.getByText('3 habitants')).toBeVisible()
})

test('photos : null conserve, renseignées remplace, illisible ne supprime pas, {} supprime ; l’annulation remet la vraie photo', async ({
  page,
}) => {
  // Ariel a une photo et un métier
  const ariel = await openCharacter(page, 'Ariel')
  await ariel.getByRole('button', { name: /Pêche/ }).click()
  await setPhoto(page, 'Ariel', 'public/pwa-192.png')

  const withoutPhotos = await exportFile(page, false)
  const withPhotos = await exportFile(page, true)
  await page.screenshot({ path: 'test-results/infos-360.png', fullPage: true })
  expect(withoutPhotos.sections.photos).toBeNull()
  expect(Object.keys(withPhotos.sections.photos.data)).toEqual(['ariel'])
  // Compatibilité : copie des métiers au premier niveau, identique à la section
  expect(withPhotos.assignments).toEqual({ ariel: 'fishing' })
  expect(withPhotos.assignments).toEqual(withPhotos.sections.assignments.data)

  // On change : plus de photo pour Ariel, une photo pour Belle
  const dialog = await openCharacter(page, 'Ariel')
  await dialog.getByRole('button', { name: 'Retirer ma photo' }).click()
  await page.keyboard.press('Escape')
  await setPhoto(page, 'Belle', 'public/pwa-512.png')
  const bellePhoto = photosOf(await rawDb<Dump>(page, 'dump')).belle
  expect(bellePhoto).toMatchObject({ blob: 'image/jpeg' })

  // 1. photos = null → photos du téléphone conservées
  let sheet = await chooseBackup(page, withoutPhotos)
  await expect(sheet).toContainText('Conservées (1 photo) : non incluses dans le fichier')
  await confirmRestore(page, sheet)
  expect(photosOf(await rawDb<Dump>(page, 'dump'))).toEqual({ belle: bellePhoto })

  // 2. photos renseignées → exactement celles du fichier (Belle supprimée, et c'est annoncé)
  sheet = await chooseBackup(page, withPhotos)
  await expect(sheet).toContainText('Remplacées : 1 actuellement → 1 dans le fichier (dont 1 supprimée)')
  await page.screenshot({ path: 'test-results/restauration-360.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await confirmRestore(page, sheet)
  expect(Object.keys(photosOf(await rawDb<Dump>(page, 'dump')))).toEqual(['ariel'])

  // 3. Annulation (avec avertissement) : la vraie photo de Belle revient, contenu identique
  page.once('dialog', (d) => {
    expect(d.message()).toContain('seront perdues')
    void d.accept()
  })
  await page.getByRole('button', { name: 'Annuler la dernière restauration' }).click()
  await expect(page.getByText('Restauration annulée ✓')).toBeVisible()
  expect(photosOf(await rawDb<Dump>(page, 'dump'))).toEqual({ belle: bellePhoto })

  // 4. Seule photo du fichier illisible → celle du téléphone est gardée
  const damaged = { ...withPhotos, sections: { ...withPhotos.sections, photos: { v: 1, data: { belle: 'abîmée' } } } }
  sheet = await chooseBackup(page, damaged)
  await expect(sheet).toContainText('1 photo illisible')
  await confirmRestore(page, sheet)
  expect(photosOf(await rawDb<Dump>(page, 'dump'))).toEqual({ belle: bellePhoto })

  // 5. photos = {} → photos du téléphone supprimées, et c'est annoncé
  const empty = { ...withPhotos, sections: { ...withPhotos.sections, photos: { v: 1, data: {} } } }
  sheet = await chooseBackup(page, empty)
  await expect(sheet).toContainText('Supprimées : 1 photo du téléphone')
  await confirmRestore(page, sheet)
  expect(photosOf(await rawDb<Dump>(page, 'dump'))).toEqual({})
})

test('ancien export v1 : seuls les métiers sont restaurés', async ({ page }) => {
  await setPhoto(page, 'Ariel', 'public/pwa-192.png')
  const sheet = await chooseBackup(page, {
    app: 'dreamlight-compagnons',
    version: 1,
    exportedAt: '2026-10-31T10:00:00.000Z',
    assignments: { goofy: 'gardening' },
  })
  await expect(sheet.getByRole('heading')).toHaveText('Import partiel')
  await expect(sheet).toContainText('Conservées (1 photo) : absentes du fichier')
  await confirmRestore(page, sheet)
  const dump = await rawDb<Dump>(page, 'dump')
  expect(dump.assignments).toEqual({ goofy: 'gardening' })
  expect(Object.keys(photosOf(dump))).toEqual(['ariel'])
})

test('restauration complète d’une version plus récente refusée, rien n’est modifié', async ({ page }) => {
  const sheetless = { app: 'dreamlight-compagnons', format: 2, type: 'complete', schema: 2, sections: { assignments: { v: 1, data: {} }, wishlist: { v: 1, data: {} } } }
  await page.goto('/#/infos')
  await page
    .getByTestId('backup-input')
    .setInputFiles({ name: 'futur.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sheetless)) })
  await expect(page.getByText(/Restauration complète impossible.*« wishlist »/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('deux onglets : modifications simultanées, puis restauration pendant que l’autre est ouvert', async ({ context }) => {
  const one = await context.newPage()
  const two = await context.newPage()
  await one.goto('/#/metiers')
  await two.goto('/#/metiers')
  await expect(one.getByTestId('count-fishing')).toHaveText('0')
  await expect(two.getByTestId('count-fishing')).toHaveText('0')

  const assign = async (page: Page, name: string, profession: RegExp) => {
    const dialog = await openCharacter(page, name)
    await dialog.getByRole('button', { name: profession }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }

  // Deux habitants différents, modifiés en même temps dans deux onglets
  await Promise.all([assign(one, 'Dingo', /Pêche/), assign(two, 'Ariel', /Pêche/)])
  await expect.poll(async () => (await rawDb<Dump>(one, 'dump')).assignments).toEqual({ goofy: 'fishing', ariel: 'fishing' })
  await one.goto('/#/metiers')
  await two.goto('/#/metiers')
  await expect(one.getByTestId('count-fishing')).toHaveText('2')
  await expect(two.getByTestId('count-fishing')).toHaveText('2')

  // Restauration dans l'onglet 1 pendant que l'onglet 2 reste ouvert sur l'accueil
  const sheet = await chooseBackup(one, { app: 'dreamlight-compagnons', version: 1, assignments: { elsa: 'mining', moana: 'fishing' } })
  await confirmRestore(one, sheet)
  // L'onglet 2 se met à jour sans rechargement (BroadcastChannel)
  await expect(two.getByTestId('count-mining')).toHaveText('1')
  await expect(two.getByTestId('count-fishing')).toHaveText('1')

  // L'onglet 2 modifie ensuite un habitant : la restauration n'est pas écrasée
  await assign(two, 'Rémy', /Jardinage/)
  await expect.poll(async () => (await rawDb<Dump>(two, 'dump')).assignments).toEqual({
    elsa: 'mining',
    moana: 'fishing',
    remy: 'gardening',
  })
})

test('IndexedDB inaccessible : app bloquée, sans copie de secours prétendue', async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Stockage bloqué', 'SecurityError')
    }
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tes données n’ont pas pu être chargées' })).toBeVisible()
  await expect(page.getByText(/Aucune copie de secours ne peut être créée/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger une copie de secours' })).toHaveCount(0)
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByTestId('count-fishing')).toHaveCount(0)
})

test('suivi des habitants : saisie, rechargement, export, import et deux onglets', async ({ page, context }) => {
  // Saisie dans la fiche
  let dialog = await openCharacter(page, 'Elsa')
  const group = dialog.getByRole('group', { name: 'Suivi dans ta partie' })
  await group.getByRole('checkbox', { name: 'Débloqué dans ma partie' }).check()
  const plus = group.getByRole('button', { name: 'Augmenter : Niveau d’amitié' })
  for (let i = 0; i < 4; i++) await plus.click()
  await group.getByRole('checkbox', { name: 'Objet déjà demandé' }).check()
  await expect(group.getByRole('status', { name: 'Niveau d’amitié' })).toHaveText('Niveau 4')
  await page.screenshot({ path: 'test-results/fiche-habitant-360.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await page.keyboard.press('Escape')

  // Rechargement : tout est conservé
  await page.reload()
  dialog = await openCharacter(page, 'Elsa')
  await expect(dialog.getByRole('checkbox', { name: 'Débloqué dans ma partie' })).toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: 'Objet déjà demandé' })).toBeChecked()
  await expect(dialog.getByRole('status', { name: 'Niveau d’amitié' })).toHaveText('Niveau 4')
  await page.keyboard.press('Escape')
  await page.getByLabel('Rechercher par nom').fill('')
  await page.getByRole('group', { name: 'Filtrer les habitants' }).getByRole('button', { name: 'Débloqués', exact: true }).click()
  await page.screenshot({ path: 'test-results/habitants-debloques-360.png' })
  await expect(page.getByRole('button', { name: /^Elsa/ })).toContainText('❤️ 4')

  // Export : la section existe et la copie de premier niveau des métiers reste cohérente
  const file = await exportFile(page, false)
  expect(file.sections.villagers).toEqual({ v: 1, data: { elsa: { unlocked: true, friendship: 4, askedItem: true } } })

  // Changement, puis restauration du fichier : le suivi revient
  dialog = await openCharacter(page, 'Elsa')
  await dialog.getByRole('checkbox', { name: 'Objet déjà demandé' }).uncheck()
  await page.keyboard.press('Escape')
  const sheet = await chooseBackup(page, file)
  await expect(sheet).toContainText('Suivi des habitants')
  await confirmRestore(page, sheet)
  expect((await rawDb<Dump>(page, 'dump')).villagers).toEqual({ elsa: { unlocked: true, friendship: 4, askedItem: true } })

  // Deux onglets : l'amitié modifiée dans l'un apparaît dans l'autre sans rechargement
  const other = await context.newPage()
  await other.goto('/#/personnages')
  await other.getByLabel('Rechercher par nom').fill('Elsa')
  await expect(other.getByRole('button', { name: /^Elsa/ })).toContainText('❤️ 4')
  dialog = await openCharacter(page, 'Elsa')
  await dialog.getByRole('button', { name: 'Augmenter : Niveau d’amitié' }).click()
  await expect(dialog.getByRole('status', { name: 'Niveau d’amitié' })).toHaveText('Niveau 5')
  await expect(other.getByRole('button', { name: /^Elsa/ })).toContainText('❤️ 5')
})
