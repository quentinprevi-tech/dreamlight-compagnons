import { beforeEach, describe, expect, it } from 'vitest'
import { applyRestore, createBackup, parseBackupText, planRestore } from '../../lib/backup'
import { commit, resetStoreForTests } from '../../lib/db'
import { loadNames, updateCustomName } from '../../lib/names'
import { buildCatalog, type RecipeCatalog } from './catalog'
import * as data from './catalog.data'
import { describeValue, recipeName, shortValue } from './display'
import { INGREDIENT_IDS, RECIPE_IDS } from './ids'
import { isIngredientId, isRecipeId } from './identifiers'
import { applyRecipeOp, emptyRecipes, RecipeError, sanitizeRecipes, summarizeRecipes } from './model'
import { DEFAULT_FILTERS, filterRecipes, ingredientRole, matchesQuery, recipesUsingIngredient, searchIngredients, sortRecipes } from './query'
import { loadRecipes, updateRecipes } from './storage'

const catalog: RecipeCatalog = buildCatalog(data)
const recipe = (id: string) => {
  const r = catalog.byId.get(id)
  if (!r) throw new Error(`recette ${id} absente`)
  return r
}
const NOW = new Date('2026-11-09T12:00:00Z')

describe('catalogue : contrôles d’intégrité des 480 recettes', () => {
  it('480 recettes à identifiants uniques, identiques à l’index léger', () => {
    expect(catalog.recipes).toHaveLength(480)
    expect(new Set(catalog.recipes.map((r) => r.id)).size).toBe(480)
    expect(catalog.recipes.map((r) => r.id)).toEqual([...RECIPE_IDS])
    expect(catalog.ingredients.map((i) => i.id)).toEqual([...INGREDIENT_IDS])
    expect(new Set(INGREDIENT_IDS).size).toBe(INGREDIENT_IDS.length)
    for (const r of catalog.recipes) expect(r.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('répartition par collection et par type', () => {
    const count = (f: (r: (typeof catalog.recipes)[number]) => boolean) => catalog.recipes.filter(f).length
    const split = (c: string) => ['appetizer', 'entree', 'dessert'].map((t) => count((r) => r.collection === c && r.type === t))
    expect(split('base')).toEqual([46, 92, 81])
    expect(split('eternity')).toEqual([23, 53, 41])
    expect(split('storybook')).toEqual([16, 58, 22])
    expect(split('wishblossom')).toEqual([6, 20, 10])
    expect(split('honeyglow')).toEqual([4, 4, 4])
    expect(count((r) => r.collection !== 'base')).toBe(261)
    expect(new Set(catalog.recipes.map((r) => r.stars))).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  it('places : 1 à 5, quantités entières ≥ 1, références valides', () => {
    for (const r of catalog.recipes) {
      expect(r.slots.length, r.id).toBeGreaterThanOrEqual(1)
      expect(r.slots.reduce((n, s) => n + s.q, 0), r.id).toBeLessThanOrEqual(5)
      for (const s of r.slots) {
        expect(Number.isInteger(s.q) && s.q >= 1, r.id).toBe(true)
        if (s.k === 'f') expect(catalog.ingredientById.has(s.i), `${r.id} → ${s.i}`).toBe(true)
        else {
          expect(catalog.groupById.has(s.g), `${r.id} → ${s.g}`).toBe(true)
          for (const o of s.only ?? []) expect(catalog.ingredientById.has(o), `${r.id} → ${o}`).toBe(true)
        }
      }
    }
  })

  it('groupes : une seule source des membres, aucun ingrédient ne les duplique', () => {
    expect(catalog.groups).toHaveLength(11)
    for (const g of catalog.groups) for (const m of g.members) expect(catalog.ingredientById.has(m), `${g.id} → ${m}`).toBe(true)
    for (const i of catalog.ingredients) expect(Object.keys(i).sort()).toEqual(['en', 'fr', 'frStatus', 'id'])
    // Les appartenances sont DÉRIVÉES des groupes
    expect(catalog.groupsOfIngredient.get('bass')).toContain('fish')
    // Les ingrédients exigés par une recette existent tous ; une restriction n'est jamais plus large que le groupe
    for (const r of catalog.recipes) {
      for (const s of r.slots) {
        if (s.k === 'c' && s.only) {
          const members = catalog.groupById.get(s.g)!.members
          const outside = s.only.filter((o) => !members.includes(o))
          if (outside.length) expect(r.notes?.join(' '), r.id).toContain('hors du groupe')
        }
      }
    }
  })

  it('un choix est UNE place à quantité, jamais plusieurs ingrédients à posséder', () => {
    const waffles = recipe('waffles')
    expect(waffles.slots).toContainEqual({ k: 'c', g: 'sweet', q: 1, only: ['sugarcane'] })
    const veggie = recipe('grilled-veggie-platter')
    expect(veggie.slots).toEqual([{ k: 'c', g: 'vegetable', q: 3 }]) // 3 légumes au choix, pas 38
    const fixedAndChoice = recipe('arendellian-pickled-herring')
    expect(fixedAndChoice.slots.filter((s) => s.k === 'f')).toHaveLength(4)
    expect(fixedAndChoice.slots.filter((s) => s.k === 'c')).toHaveLength(1)
  })

  it('quantités exactes des places répétées (Fruitcake : 1 blé + 3 fruits au choix)', () => {
    expect(recipe('fruitcake').slots).toEqual([
      { k: 'f', i: 'wheat', q: 1 },
      { k: 'c', g: 'fruit', q: 3 },
    ])
    expect(recipe('s-mores').slots).toContainEqual({ k: 'f', i: 'wheat', q: 2 })
  })

  it('noms français : trois statuts, jamais « officiel », aucune recette retirée faute de nom', () => {
    const by = (s: string) => catalog.recipes.filter((r) => r.frStatus === s)
    expect(by('two-guides').length + by('one-guide').length + by('en-only').length).toBe(480)
    for (const r of by('en-only')) expect(r.fr).toBeNull()
    for (const r of [...by('two-guides'), ...by('one-guide')]) expect(r.fr, r.id).toBeTruthy()
    expect(by('en-only').map((r) => r.collection)).toContain('honeyglow')
    expect(JSON.stringify(catalog.recipes)).not.toMatch(/officiel/i)
    // même si le nom français est absent, la recette reste affichée en anglais « À confirmer »
    const en = by('en-only')[0]
    expect(recipeName(en, {})).toEqual({ text: en.en, kind: 'to-confirm' })
  })

  it('énergie et prix : statut de concordance indépendant, et minimum jamais présenté comme exact', () => {
    expect(catalog.recipes.some((r) => r.energy.s === 'agree' && r.sell.s === 'differs')).toBe(true)
    expect(catalog.recipes.some((r) => r.energy.s === 'differs' && r.sell.s === 'agree')).toBe(true)
    expect(catalog.recipes.some((r) => r.energy.s === 'wiki-only')).toBe(true)
    for (const r of catalog.recipes) for (const v of [r.energy, r.sell]) expect((v.s === 'differs') === (v.alt !== undefined), r.id).toBe(true)
    // 472 recettes publiées « or more » (minimum) ; 8 seulement sans mention (exactes), même quand les guides concordent
    const exact = catalog.recipes.filter((r) => r.energy.k === 'exact' || r.sell.k === 'exact')
    expect(exact.map((r) => r.id).sort()).toEqual(
      ['beauty-and-the-beets-napoleon', 'butter-chicken', 'fairy-boot-cake', 'garlic-chocolate-tart', 'grecian-baked-fish', 'lobster-roll', 'pixie-pizza', 'underworld-cake'].sort(),
    )
    expect(catalog.recipes.filter((r) => r.energy.k === 'min' && r.sell.k === 'min')).toHaveLength(472)
    // Une recette dont TOUS les guides concordent reste un minimum tant que la fiche du wiki dit « or more »
    const coffee = recipe('coffee')
    expect(coffee.sell.s).toBe('agree')
    expect(coffee.sell.k).toBe('min')
  })

  it('affichage : « à partir de » pour un minimum (même si les guides concordent), valeur seule pour un exact', () => {
    expect(describeValue({ v: 1200, k: 'min', s: 'agree' }).text).toBe('à partir de 1 200')
    expect(describeValue({ v: 1200, k: 'exact', s: 'agree' }).text).toBe('1 200')
    expect(describeValue({ v: 100, k: 'min', s: 'wiki-only' }).note).toContain('Minimum publié')
    expect(describeValue({ v: 1200, k: 'exact', s: 'wiki-only' }).note).toContain('exacte selon le wiki')
    expect(describeValue({ v: 100, k: 'min', s: 'differs', alt: 300 }).note).toContain('autre combinaison')
    const lower = describeValue({ v: 300, k: 'min', s: 'differs', alt: 100 })
    expect(lower.text).toBe('à partir de 300')
    expect(lower.note).toContain('désaccord')
    expect(shortValue({ v: 532, k: 'min', s: 'agree' })).toBe('dès 532')
    expect(shortValue({ v: 783, k: 'exact', s: 'agree' })).toBe('783')
  })

  it('Any Meat : composition déduite, jamais présentée comme vérifiée', () => {
    const meat = catalog.groupById.get('meat')!
    expect(meat.confirmed).toBe(false)
    expect(meat.note).toContain('À confirmer')
    // les groupes issus du tableau du wiki ne portent pas ce drapeau
    expect(catalog.groups.filter((g) => g.confirmed === false).map((g) => g.id)).toEqual(['meat'])
    expect(recipe('roast').slots).toEqual([{ k: 'c', g: 'meat', q: 1 }])
  })

  it('« Any Ice » (un seul membre, que liste la fiche du wiki) devient une place fixe', () => {
    expect(recipe('plain-snow-cones').slots).toEqual([{ k: 'f', i: 'slush-ice', q: 1 }])
    expect(recipe('plain-snow-cones').notes?.join(' ')).toContain('Slush Ice'.replace('Slush Ice', 'Glace pilée'))
  })

  it('doublons de nom français : les identifiants viennent de l’anglais', () => {
    const fries = catalog.recipes.filter((r) => r.fr === 'Frites')
    expect(fries.length).toBeGreaterThanOrEqual(1)
    expect(new Set(catalog.recipes.map((r) => r.id)).size).toBe(480)
  })
})

describe('suivi : connues, favorites, redécouverte', () => {
  it('marque connue, retire, redécouvre avec une nouvelle date ; favorite indépendante', () => {
    let d = applyRecipeOp(emptyRecipes(), { type: 'set-known', id: 'waffles', known: true }, NOW)
    expect(d.known.waffles).toBe(NOW.toISOString())
    d = applyRecipeOp(d, { type: 'set-favorite', id: 'waffles', favorite: true }, NOW)
    d = applyRecipeOp(d, { type: 'set-known', id: 'waffles', known: false }, NOW)
    expect(d.known).toEqual({})
    expect(Object.keys(d.favorites)).toEqual(['waffles']) // la favorite reste
    const later = new Date('2026-12-01T10:00:00Z')
    d = applyRecipeOp(d, { type: 'set-known', id: 'waffles', known: true }, later)
    expect(d.known.waffles).toBe(later.toISOString())
    // marquer deux fois ne change pas la date d'origine
    expect(applyRecipeOp(d, { type: 'set-known', id: 'waffles', known: true }, NOW).known.waffles).toBe(later.toISOString())
    expect(summarizeRecipes(d)).toEqual({ known: 1, favorites: 1, total: 480 })
  })

  it('refuse une recette inconnue et nettoie les données invalides', () => {
    expect(() => applyRecipeOp(emptyRecipes(), { type: 'set-known', id: '__proto__', known: true }, NOW)).toThrow(RecipeError)
    expect(
      sanitizeRecipes({ known: { waffles: NOW.toISOString(), fantome: NOW.toISOString(), coffee: 'pas une date' }, favorites: { coffee: NOW.toISOString(), x: 1 } }),
    ).toEqual({ known: { waffles: NOW.toISOString() }, favorites: { coffee: NOW.toISOString() } })
    expect(sanitizeRecipes(null)).toEqual(emptyRecipes())
    expect(isRecipeId('waffles') && !isRecipeId('constructor') && isIngredientId('wheat')).toBe(true)
  })
})

describe('tris, filtres et recherches', () => {
  const none = {}
  it('tri par nom, étoiles, type, prix, énergie (stable, à égalité par nom)', () => {
    const all = catalog.recipes
    const byName = sortRecipes(all, 'name', 'asc', none).map((r) => recipeName(r, none).text)
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })))
    expect(sortRecipes(all, 'stars', 'desc', none)[0].stars).toBe(5)
    expect(sortRecipes(all, 'sell', 'desc', none)[0].sell.v).toBe(Math.max(...all.map((r) => r.sell.v)))
    expect(sortRecipes(all, 'energy', 'asc', none)[0].energy.v).toBe(Math.min(...all.map((r) => r.energy.v)))
    const types = sortRecipes(all, 'type', 'asc', none).map((r) => r.type)
    expect(types.indexOf('dessert')).toBeGreaterThan(types.lastIndexOf('entree'))
  })

  it('filtres connues / inconnues / favorites / type / origine / étoiles', () => {
    const d = { known: { waffles: 'x', coffee: 'x' }, favorites: { coffee: 'x' } }
    const run = (f: Partial<typeof DEFAULT_FILTERS>) => filterRecipes(catalog, d, { ...DEFAULT_FILTERS, ...f }, none)
    expect(run({ known: 'known' }).map((r) => r.id).sort()).toEqual(['coffee', 'waffles'])
    expect(run({ known: 'unknown' })).toHaveLength(478)
    expect(run({ known: 'favorites' }).map((r) => r.id)).toEqual(['coffee'])
    expect(run({ type: 'dessert' })).toHaveLength(81 + 41 + 22 + 10 + 4)
    expect(run({ origin: 'base' })).toHaveLength(219)
    expect(run({ origin: 'dlc' })).toHaveLength(261)
    expect(run({ origin: 'honeyglow' })).toHaveLength(12)
    expect(run({ stars: 5 }).every((r) => r.stars === 5)).toBe(true)
    expect(run({ type: 'entree', origin: 'storybook', stars: 5 }).every((r) => r.type === 'entree' && r.collection === 'storybook' && r.stars === 5)).toBe(true)
  })

  it('recherche en français, en anglais, sans accents, et dans le nom personnalisé', () => {
    const q = (query: string, names = none) => filterRecipes(catalog, emptyRecipes(), { ...DEFAULT_FILTERS, query }, names).map((r) => r.id)
    expect(q('cafe')).toContain('coffee')
    expect(q('COFFEE')).toContain('coffee')
    expect(q('gaufres')).toContain('waffles')
    expect(q('waffle')).toContain('waffles')
    expect(q('zzzz')).toEqual([])
    expect(q('ma gaufre', { 'recipe:waffles': 'Ma gaufre secrète' })).toEqual(['waffles'])
    expect(matchesQuery(catalog, recipe('coffee'), '   ', none)).toBe(true)
  })

  it('recherche par ingrédient : exigé OU possible parmi un choix, jamais à posséder en même temps', () => {
    // Waffles : sucre de canne (choix restreint à CET ingrédient) → possible, pas exigé
    expect(ingredientRole(catalog, recipe('waffles'), 'sugarcane')).toBe('possible')
    // Wheat est exigé par Waffles
    expect(ingredientRole(catalog, recipe('waffles'), 'wheat')).toBe('required')
    // Bass : exigé par Pan-Seared Bass, simplement possible dans « Grilled Fish » (n'importe quel poisson)
    const bass = recipesUsingIngredient(catalog, 'bass')
    expect(bass.get('pan-seared-bass-vegetables')).toBe('required')
    expect(bass.get('grilled-fish')).toBe('possible')
    // un ingrédient hors du groupe n'est pas « possible »
    expect(ingredientRole(catalog, recipe('grilled-fish'), 'wheat')).toBeNull()
    // restriction de la recette : Crudités n'autorise que 5 légumes
    expect(ingredientRole(catalog, recipe('crudites'), 'carrot')).toBe('possible')
    expect(ingredientRole(catalog, recipe('crudites'), 'pumpkin')).toBeNull()
    const f = filterRecipes(catalog, emptyRecipes(), { ...DEFAULT_FILTERS, ingredient: 'bass' }, none)
    expect(f.map((r) => r.id)).toContain('grilled-fish')
    expect(f.map((r) => r.id)).toContain('pan-seared-bass-vegetables')
  })

  it('recherche d’ingrédient par nom français, anglais ou personnalisé', () => {
    expect(searchIngredients(catalog, 'wheat', none).map((i) => i.id)).toContain('wheat')
    expect(searchIngredients(catalog, 'ble', none).map((i) => i.id)).toContain('wheat')
    expect(searchIngredients(catalog, 'farine magique', { 'ingredient:wheat': 'Farine magique' }).map((i) => i.id)).toEqual(['wheat'])
    expect(searchIngredients(catalog, '', none)).toEqual([])
  })
})

describe('stockage, noms et sauvegarde', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('écritures atomiques : deux recettes cochées en même temps sont toutes deux conservées', async () => {
    await Promise.all([updateRecipes({ type: 'set-known', id: 'waffles', known: true }), updateRecipes({ type: 'set-known', id: 'coffee', known: true }), updateRecipes({ type: 'set-favorite', id: 'pasta', favorite: true })])
    const d = await loadRecipes()
    expect(Object.keys(d.known).sort()).toEqual(['coffee', 'waffles'])
    expect(Object.keys(d.favorites)).toEqual(['pasta'])
  })

  it('les noms personnalisés de recettes et d’ingrédients sont validés contre le catalogue', async () => {
    await updateCustomName('recipe:waffles', 'Gaufres de Nanie')
    await updateCustomName('ingredient:wheat', 'Farine')
    await expect(updateCustomName('recipe:fantome', 'x')).rejects.toThrow()
    expect(await loadNames()).toEqual({ 'recipe:waffles': 'Gaufres de Nanie', 'ingredient:wheat': 'Farine' })
    expect(recipeName(recipe('waffles'), await loadNames())).toEqual({ text: 'Gaufres de Nanie', kind: 'custom' })
  })

  it('export / import : section « recipes » sauvegardée, restaurée et nettoyée', async () => {
    await updateRecipes({ type: 'set-known', id: 'waffles', known: true })
    await updateRecipes({ type: 'set-favorite', id: 'coffee', favorite: true })
    const file = await createBackup({ includePhotos: false })
    expect(file.sections.recipes?.data).toMatchObject({ known: { waffles: expect.any(String) }, favorites: { coffee: expect.any(String) } })

    resetStoreForTests(`test-${Math.random()}`)
    await commit({ set: [['recipes', { known: { pasta: NOW.toISOString() }, favorites: {} }]] })
    const parsed = parseBackupText(JSON.stringify(file))
    expect((await planRestore(parsed)).find((p) => p.id === 'recipes')).toMatchObject({ action: 'replace' })
    await applyRestore(parsed)
    const d = await loadRecipes()
    expect(Object.keys(d.known)).toEqual(['waffles'])
    expect(Object.keys(d.favorites)).toEqual(['coffee'])
  })

  it('un fichier sans la section « recipes » (ancienne sauvegarde) conserve les recettes du téléphone', async () => {
    await updateRecipes({ type: 'set-known', id: 'waffles', known: true })
    const file = await createBackup({ includePhotos: false })
    delete (file.sections as Record<string, unknown>).recipes
    const parsed = parseBackupText(JSON.stringify({ ...file, type: 'partial' }))
    await applyRestore(parsed)
    expect(Object.keys((await loadRecipes()).known)).toEqual(['waffles'])
  })

  it('une section « recipes » abîmée est nettoyée (recettes inconnues écartées)', async () => {
    await commit({ set: [['recipes', { known: { waffles: NOW.toISOString(), fantome: NOW.toISOString() }, favorites: 'oups' }]] })
    expect(await loadRecipes()).toEqual({ known: { waffles: NOW.toISOString() }, favorites: {} })
  })
})
