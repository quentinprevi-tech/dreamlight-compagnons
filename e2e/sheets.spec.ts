import { expect, test, type Page } from '@playwright/test'

/**
 * Fermeture des fiches (croix, clic à côté, Échap, glissement) et images des ingrédients.
 * Les images du wiki sont SIMULÉES (aucune requête réelle vers le wiki) : un petit PNG, une erreur réseau, ou un compteur.
 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const WIKI_IMAGES = '**/dreamlightvalleywiki.com/images/**'

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

async function openRecipe(page: Page, query = 'Buñuelos') {
  await page.goto('/#/collection/recettes')
  await page.getByLabel('Rechercher une recette').fill(query)
  await page.getByTestId('recipe-row').first().getByRole('button', { name: /Ouvrir/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

/** Glissement tactile réel (événements de toucher du navigateur, pas des clics). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 }] })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}
const center = async (page: Page, testId: string) => {
  const box = (await page.getByTestId(testId).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('fermer une fiche sur mobile (360 px, tactile)', () => {
  test('la croix est visible, assez grande pour le doigt, dans l’écran, et ferme la fiche', async ({ page }) => {
    const dialog = await openRecipe(page)
    const close = dialog.getByRole('button', { name: 'Fermer' })
    await expect(close).toBeVisible()
    const box = (await close.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(36)
    expect(box.height).toBeGreaterThanOrEqual(36)
    expect(box.x + box.width).toBeLessThanOrEqual(360)
    expect(box.y).toBeGreaterThanOrEqual(0)
    await noOverflow(page)
    await close.click()
    await expect(dialog).toHaveCount(0)
    // La page redevient défilable
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })

  test('un appui à côté de la fiche (fond sombre) la ferme', async ({ page }) => {
    const dialog = await openRecipe(page)
    await page.touchscreen.tap(180, 20)
    await expect(dialog).toHaveCount(0)
  })

  test('la touche Échap ferme aussi la fiche (clavier physique)', async ({ page }) => {
    const dialog = await openRecipe(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })

  test('glissement vers le bas depuis la poignée : ferme', async ({ page }) => {
    const dialog = await openRecipe(page)
    const from = await center(page, 'sheet-handle')
    await swipe(page, from, { x: from.x, y: from.y + 250 })
    await expect(dialog).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })

  test('glissement vers le bas depuis le haut du contenu : ferme', async ({ page }) => {
    const dialog = await openRecipe(page)
    const title = (await dialog.getByRole('heading', { level: 2 }).boundingBox())!
    await swipe(page, { x: title.x + 40, y: title.y + 10 }, { x: title.x + 40, y: title.y + 300 })
    await expect(dialog).toHaveCount(0)
  })

  test('un petit glissement ne ferme pas : la fiche revient à sa place', async ({ page }) => {
    const dialog = await openRecipe(page)
    await page.waitForTimeout(500) // fin de l'animation d'ouverture
    const from = await center(page, 'sheet-handle')
    const before = (await dialog.getByRole('heading', { level: 2 }).boundingBox())!.y
    await swipe(page, from, { x: from.x, y: from.y + 40 })
    await page.waitForTimeout(400)
    await expect(dialog).toBeVisible()
    expect((await dialog.getByRole('heading', { level: 2 }).boundingBox())!.y).toBeCloseTo(before, 0)
  })

  test('contenu défilé : glisser vers le bas fait défiler vers le haut, sans fermer ; la croix reste visible', async ({ page }) => {
    const dialog = await openRecipe(page, 'Arendellian')
    await page.waitForTimeout(500) // fin de l'animation d'ouverture : les mesures qui suivent sont stables
    const scrolled = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]') as HTMLElement
      panel.scrollTop = 120
      return { top: panel.scrollTop, canScroll: panel.scrollHeight > panel.clientHeight }
    })
    expect(scrolled.canScroll).toBe(true)
    expect(scrolled.top).toBeGreaterThan(0)
    // La croix suit : toujours visible en haut de la fiche, même défilée
    const close = dialog.getByRole('button', { name: 'Fermer' })
    const panelBox = (await dialog.boundingBox())!
    const closeBox = (await close.boundingBox())!
    expect(closeBox.y).toBeGreaterThanOrEqual(panelBox.y)
    expect(closeBox.y).toBeLessThan(panelBox.y + 60)
    // Glisser vers le bas depuis le milieu du contenu défilé : ne ferme pas
    await swipe(page, { x: 180, y: panelBox.y + 250 }, { x: 180, y: panelBox.y + 450 })
    await expect(dialog).toBeVisible()
    await close.click()
    await expect(dialog).toHaveCount(0)
  })

  test('un bouton de la fiche reste cliquable (la zone de glissement ne le recouvre pas)', async ({ page }) => {
    const dialog = await openRecipe(page)
    await dialog.getByTestId('known-toggle').click()
    await expect(dialog.getByTestId('known-toggle')).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByTestId('favorite-toggle').click()
    await expect(dialog.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  test('la fiche d’un animal se ferme elle aussi par la croix, Échap et le glissement', async ({ page }) => {
    await page.goto('/#/collection/animaux')
    const setup = page.getByTestId('extensions-setup')
    await setup.getByRole('button', { name: 'Tout sélectionner' }).click()
    await setup.getByRole('button', { name: 'Valider mes choix' }).click()
    const open = async () => {
      await page.getByRole('button', { name: /^Capybara classique/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    }
    await open()
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await open()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await open()
    const from = await center(page, 'sheet-handle')
    await swipe(page, from, { x: from.x, y: from.y + 250 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('renommer depuis une fiche : un seul panneau à la fois ; Échap ou la croix ferme le renommage et ramène à la fiche, puis la ferme', async ({ page }) => {
    const dialog = await openRecipe(page)
    await dialog.getByRole('button', { name: /Mon nom/ }).click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(page.getByRole('dialog', { name: /Mon nom pour/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /Mon nom pour/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(1) // la fiche de la recette est de retour
    await page.getByRole('dialog').getByRole('button', { name: /Mon nom/ }).click()
    await page.getByRole('dialog', { name: /Mon nom pour/ }).getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByRole('dialog', { name: /Mon nom pour/ })).toHaveCount(0)
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })
})

/** Ouvre la liste des recettes depuis l'accueil Collection (deux entrées d'historique : Collection, puis Recettes). */
async function openRecipesFromCollection(page: Page) {
  await page.goto('/#/collection')
  await page.getByRole('link', { name: /Recettes/ }).click()
  await expect(page.getByLabel('Rechercher une recette')).toBeVisible()
  await page.getByLabel('Rechercher une recette').fill('Buñuelos')
}
const openFirst = async (page: Page) => {
  await page.getByTestId('recipe-row').first().getByRole('button', { name: /Ouvrir/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
const onRecipes = async (page: Page) => {
  await expect(page).toHaveURL(/#\/collection\/recettes$/)
  await expect(page.getByLabel('Rechercher une recette')).toBeVisible()
}
const bodyUnlocked = async (page: Page) => expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
/** Nombre d'entrées « fiche » au sommet de l'historique (0 = entrée ordinaire) */
const sheetDepth = (page: Page) => page.evaluate(() => (history.state as { ddvSheets?: number } | null)?.ddvSheets ?? 0)

test.describe('bouton « Retour » (Android, navigateur) et fiches', () => {
  test('Retour ferme la fiche et reste sur l’écran ; un second Retour quitte l’écran', async ({ page }) => {
    await openRecipesFromCollection(page)
    await openFirst(page)
    await expect.poll(() => sheetDepth(page)).toBe(1)
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await onRecipes(page)
    await bodyUnlocked(page)
    expect(await sheetDepth(page)).toBe(0)
    await expect(page.getByLabel('Rechercher une recette')).toHaveValue('Buñuelos') // l'écran n'a pas été rechargé ni réinitialisé
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })

  for (const [name, close] of [
    ['la croix', (page: Page) => page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()],
    ['un appui à côté', (page: Page) => page.touchscreen.tap(180, 20)],
    ['Échap', (page: Page) => page.keyboard.press('Escape')],
    [
      'le glissement',
      async (page: Page) => {
        const from = await center(page, 'sheet-handle')
        await swipe(page, from, { x: from.x, y: from.y + 250 })
      },
    ],
  ] as const) {
    test(`fermeture par ${name} : aucune entrée orpheline, un seul Retour quitte l’écran`, async ({ page }) => {
      await openRecipesFromCollection(page)
      await openFirst(page)
      await expect.poll(() => sheetDepth(page)).toBe(1)
      await close(page)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect.poll(() => sheetDepth(page)).toBe(0)
      await onRecipes(page)
      await bodyUnlocked(page)
      await page.goBack() // UN seul Retour suffit : aucune entrée « fiche » ne reste
      await expect(page).toHaveURL(/#\/collection$/)
    })
  }

  test('ouvrir et fermer plusieurs fois (croix, Retour, Échap) : aucune accumulation d’entrées', async ({ page }) => {
    await openRecipesFromCollection(page)
    const start = await page.evaluate(() => history.length)
    await openFirst(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
    await expect.poll(() => sheetDepth(page)).toBe(0)
    await openFirst(page)
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await openFirst(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => sheetDepth(page)).toBe(0)
    await onRecipes(page)
    // Chaque ouverture écrase l'entrée « fiche » précédente (elle était retirée) : au plus une entrée en plus
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(start + 1)
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })

  test('renommer depuis une fiche : Retour ferme le renommage et ramène à la fiche, Retour de nouveau la ferme, puis on quitte l’écran', async ({ page }) => {
    await openRecipesFromCollection(page)
    await openFirst(page)
    await page.getByRole('dialog').getByRole('button', { name: /Mon nom/ }).click()
    await expect(page.getByRole('dialog', { name: /Mon nom pour/ })).toBeVisible()
    await expect.poll(() => sheetDepth(page)).toBe(1) // remplacer une fiche par une autre ne change pas l'historique
    await page.goBack()
    await expect(page.getByRole('dialog', { name: /Mon nom pour/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toBeVisible() // la fiche de la recette est de retour
    await expect.poll(() => sheetDepth(page)).toBe(1)
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await onRecipes(page)
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })

  test('changer d’écran pendant qu’une fiche est ouverte, puis Retour : on retrouve l’écran précédent sans entrée à vide', async ({ page }) => {
    await openRecipesFromCollection(page)
    await openFirst(page)
    await page.evaluate(() => {
      window.location.hash = '#/collection/animaux'
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/#\/collection\/animaux$/)
    await bodyUnlocked(page)
    await page.goBack() // retombe sur l'entrée « fiche » orpheline : elle est sautée tout de suite
    await onRecipes(page)
    await expect.poll(() => sheetDepth(page)).toBe(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })

  test('rechargement avec une fiche ouverte : la fiche est fermée, et un Retour quitte l’écran', async ({ page }) => {
    await openRecipesFromCollection(page)
    await openFirst(page)
    await page.reload()
    await onRecipes(page)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => sheetDepth(page)).toBe(0)
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })

  test('Retour puis Suivant : la fiche ne revient pas toute seule et l’écran reste cohérent', async ({ page }) => {
    await openRecipesFromCollection(page)
    await openFirst(page)
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goForward()
    await onRecipes(page)
    await expect.poll(() => sheetDepth(page)).toBe(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })

  test('fiche d’un animal : Retour la ferme et reste sur l’écran', async ({ page }) => {
    await page.goto('/#/collection')
    await page.getByRole('link', { name: /Animaux/ }).click()
    const setup = page.getByTestId('extensions-setup')
    await setup.getByRole('button', { name: 'Tout sélectionner' }).click()
    await setup.getByRole('button', { name: 'Valider mes choix' }).click()
    await page.getByRole('button', { name: /^Capybara classique/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/#\/collection\/animaux$/)
    await page.goBack()
    await expect(page).toHaveURL(/#\/collection$/)
  })
})

test.describe('clavier et focus dans les fiches (ordinateur)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })

  test('Entrée ouvre la fiche, le focus y entre, Tab reste dedans, Échap ferme et rend le focus au bouton d’origine', async ({ page }) => {
    await page.goto('/#/collection/recettes')
    await page.getByLabel('Rechercher une recette').fill('Buñuelos')
    const opener = page.getByTestId('recipe-row').first().getByRole('button', { name: /Ouvrir/ })
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toBeFocused()
    // Beaucoup plus de Tab qu'il n'y a d'éléments : le focus ne sort jamais de la fiche
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
    }
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('le fond de la page est inerte pendant qu’une fiche est ouverte, rétabli ensuite', async ({ page }) => {
    await page.goto('/#/collection/recettes')
    await page.getByLabel('Rechercher une recette').fill('Buñuelos')
    await page.getByTestId('recipe-row').first().getByRole('button', { name: /Ouvrir/ }).click()
    await expect(page.locator('#root')).toHaveAttribute('inert', '')
    await page.keyboard.press('Escape')
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
    await page.getByLabel('Rechercher une recette').fill('Gazpacho') // la page répond de nouveau
    await expect(page.getByTestId('recipes-count')).toHaveText('1 recette')
  })

  test('renommer depuis la fiche : le focus entre dans le champ, puis revient à la fiche, puis au bouton d’origine', async ({ page }) => {
    await page.goto('/#/collection/recettes')
    await page.getByLabel('Rechercher une recette').fill('Buñuelos')
    const opener = page.getByTestId('recipe-row').first().getByRole('button', { name: /Ouvrir/ })
    await opener.click()
    await page.getByRole('dialog').getByRole('button', { name: /Mon nom/ }).click()
    const rename = page.getByRole('dialog', { name: /Mon nom pour/ })
    await expect(rename).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(opener).toBeFocused() // le bouton d'origine, même après le détour par le renommage
  })
})

test.describe('fermer une fiche sur ordinateur (souris, clavier)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false })

  test('Échap, croix et clic à côté ferment ; la fiche reste étroite et centrée', async ({ page }) => {
    const dialog = await openRecipe(page)
    const panel = (await dialog.boundingBox())!
    expect(panel.width).toBeLessThanOrEqual(448)
    expect(Math.abs(panel.x + panel.width / 2 - 640)).toBeLessThan(2)
    await noOverflow(page)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await openRecipe(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await openRecipe(page)
    await page.mouse.click(100, 100)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('tablette (768 px)', () => {
  test.use({ viewport: { width: 768, height: 1024 } })
  test('la fiche s’affiche sans débordement et se ferme par la croix', async ({ page }) => {
    const dialog = await openRecipe(page)
    await noOverflow(page)
    await dialog.getByRole('button', { name: 'Fermer' }).click()
    await expect(dialog).toHaveCount(0)
  })
})

test.describe('images des ingrédients (wiki simulé)', () => {
  test('miniature, quantité et nom pour chaque ingrédient, sans débordement à 360 px', async ({ page }) => {
    await page.route(WIKI_IMAGES, (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
    const dialog = await openRecipe(page)
    const slots = dialog.getByTestId('slot-fixed')
    await expect(slots).toHaveCount(4)
    await expect(dialog.locator('[data-testid="ingredient-thumb"][data-state="loaded"]')).toHaveCount(4)
    await expect(slots.first()).toContainText('1 ×')
    await expect(slots.first()).toContainText('Blé')
    await noOverflow(page)
    // Rien ne dépasse de la ligne : la miniature, la quantité et le nom tiennent à 360 px
    for (const slot of await slots.all()) {
      const li = (await slot.boundingBox())!
      for (const child of await slot.locator('> *').all()) {
        const b = (await child.boundingBox())!
        expect(b.x + b.width).toBeLessThanOrEqual(li.x + li.width + 0.5)
      }
    }
  })

  test('images indisponibles (hors ligne, wiki en panne) : emoji de repli, nom et quantité intacts, fiche utilisable', async ({ page }) => {
    await page.route(WIKI_IMAGES, (route) => route.abort('failed'))
    const dialog = await openRecipe(page)
    await expect(dialog.locator('[data-testid="ingredient-thumb"][data-state="failed"]')).toHaveCount(4)
    await expect(dialog.getByTestId('ingredient-emoji').first()).toHaveText('🌾')
    await expect(dialog.getByTestId('slot-fixed').first()).toContainText('1 ×')
    await expect(dialog.getByTestId('slot-fixed').first()).toContainText('Blé')
    await expect(dialog.locator('img')).toHaveCount(0)
    await noOverflow(page)
    await dialog.getByRole('button', { name: 'Fermer' }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('chargement différé : aucune image avant l’ouverture d’une fiche, seulement celles de la recette ensuite', async ({ page }) => {
    const requested: string[] = []
    await page.route(WIKI_IMAGES, (route) => {
      requested.push(route.request().url())
      return route.fulfill({ contentType: 'image/png', body: PNG })
    })
    await page.goto('/#/collection/recettes')
    await page.getByLabel('Rechercher une recette').fill('Buñuelos')
    await expect(page.getByTestId('recipe-row')).toHaveCount(1)
    await page.getByRole('button', { name: /Afficher plus/ }).count()
    await page.waitForTimeout(500)
    expect(requested).toEqual([]) // la liste n'appelle jamais le wiki
    await page.getByTestId('recipe-row').first().getByRole('button', { name: /Ouvrir/ }).click()
    await expect(page.locator('[data-testid="ingredient-thumb"][data-state="loaded"]')).toHaveCount(4)
    expect(requested).toHaveLength(4)
    expect(requested.every((u) => /\/images\/thumb\/.+\/120px-.+\.png$/.test(u))).toBe(true)
  })

  test('« au choix » : les miniatures des possibilités ne sont demandées qu’à l’ouverture de la liste', async ({ page }) => {
    const requested: string[] = []
    await page.route(WIKI_IMAGES, (route) => {
      requested.push(route.request().url())
      return route.fulfill({ contentType: 'image/png', body: PNG })
    })
    const dialog = await openRecipe(page, 'Gazpacho')
    await expect(dialog.getByTestId('slot-choice')).toBeVisible()
    await expect(dialog.locator('[data-testid="ingredient-thumb"][data-state="loaded"]')).toHaveCount(3)
    const fixedOnly = requested.length
    expect(fixedOnly).toBe(3)
    await dialog.getByTestId('slot-choice').getByText(/Voir les \d+ possibilité/).click()
    await expect.poll(() => requested.length).toBeGreaterThan(fixedOnly)
    await noOverflow(page)
  })
})
