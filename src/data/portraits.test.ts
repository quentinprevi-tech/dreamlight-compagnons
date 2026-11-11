import { describe, expect, it } from 'vitest'
import { CHARACTERS, isReleased } from './characters'
import { INGREDIENTS } from '../features/recipes/catalog.data'
import { ingredientImageUrl } from '../features/recipes/display'
import { portraitCachePattern, WIKI_PORTRAIT_NAMES, wikiPortrait } from './portraits'

describe('portraits du wiki', () => {
  it('couvrent tous les habitants déjà sortis', () => {
    const missing = CHARACTERS.filter((c) => isReleased(c, new Date('2026-10-30T12:00:00')) && !wikiPortrait(c.nameEn))
    expect(missing.map((c) => c.nameEn)).toEqual([])
  })

  it('ne référencent que des personnages connus', () => {
    const known = new Set(CHARACTERS.map((c) => c.nameEn))
    expect(WIKI_PORTRAIT_NAMES.filter((n) => !known.has(n))).toEqual([])
  })

  it('cache hors ligne : le motif couvre tous les portraits et AUCUNE vignette d’ingrédient', () => {
    const pattern = portraitCachePattern()
    for (const name of WIKI_PORTRAIT_NAMES) expect(pattern.test(wikiPortrait(name)!), name).toBe(true)
    for (const ing of INGREDIENTS) expect(pattern.test(ingredientImageUrl(ing.id)!), ing.id).toBe(false)
    expect(pattern.test('https://dreamlightvalleywiki.com/images/thumb/e/e5/Goofy.png/120px-Goofy.png?x=1')).toBe(false)
    expect(pattern.test('https://autre-site.example/images/thumb/e/e5/Goofy.png/120px-Goofy.png')).toBe(false)
  })

  it('construisent l’URL de vignette', () => {
    expect(wikiPortrait('Goofy')).toBe('https://dreamlightvalleywiki.com/images/thumb/e/e5/Goofy.png/120px-Goofy.png')
    expect(wikiPortrait('Lilo')).toBeUndefined()
  })
})
