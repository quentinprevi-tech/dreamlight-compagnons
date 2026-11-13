import { describe, expect, it } from 'vitest'
import { CRITTER_BY_ID, CRITTER_VARIANTS, SPECIES } from './data'
import { gatherOf, GATHER_BY_ID, GATHER_TYPES, SPECIES_GATHER, VARIANT_GATHER_OVERRIDE } from './gathering'
import { matchesGather, sortVariantsByName } from './list'
import { variantName } from './display'

const shownNames = (list: typeof CRITTER_VARIANTS, names = {}) => list.map((v) => variantName(v, names).text)

describe('capacité de collecte : table espèce → type d’objet', () => {
  it('ne référence que des espèces et des variantes du catalogue, et des types connus', () => {
    const speciesIds = new Set(SPECIES.map((s) => s.id))
    for (const [species, gather] of Object.entries(SPECIES_GATHER)) {
      expect(speciesIds.has(species), `espèce inconnue : ${species}`).toBe(true)
      expect(GATHER_BY_ID[gather], `type inconnu : ${gather}`).toBeDefined()
    }
    for (const [id, gather] of Object.entries(VARIANT_GATHER_OVERRIDE)) {
      expect(CRITTER_BY_ID[id], `variante inconnue : ${id}`).toBeDefined()
      if (gather !== null) expect(GATHER_BY_ID[gather]).toBeDefined()
    }
  })

  it('les espèces non couvertes par les guides restent « non renseignées » (rien n’est deviné)', () => {
    const unknownSpecies = SPECIES.filter((s) => !(s.id in SPECIES_GATHER)).map((s) => s.id)
    expect(unknownSpecies.sort()).toEqual(['goose', 'hedgehog', 'skunk', 'sweet-bee'])
    for (const v of CRITTER_VARIANTS.filter((v) => unknownSpecies.includes(v.species))) expect(gatherOf(v)).toBeUndefined()
  })

  it('les variantes de quête « Toon » (capacité non documentée) restent non renseignées', () => {
    for (const id of ['toon-capybara', 'toon-cobra', 'toon-monkey']) expect(gatherOf(CRITTER_BY_ID[id]), id).toBeUndefined()
    expect(CRITTER_VARIANTS.filter((v) => v.condition === 'quest').map((v) => v.id).sort()).toEqual(['toon-capybara', 'toon-cobra', 'toon-monkey'])
    expect(gatherOf(CRITTER_BY_ID['classic-capybara'])).toBe('timebending') // les autres capybaras gardent la capacité de l'espèce
  })

  it('le bébé dragon bleu sarcelle (contradiction entre sources) n’a pas de capacité affichée', () => {
    expect(gatherOf(CRITTER_BY_ID['teal-baby-dragon'])).toBeUndefined()
    expect(gatherOf(CRITTER_BY_ID['blue-baby-dragon'])).toBe('snippets')
  })

  it('exemples relevés dans les guides', () => {
    expect(gatherOf(CRITTER_BY_ID['classic-squirrel'])).toBe('fruit')
    expect(gatherOf(CRITTER_BY_ID['classic-fox'])).toBe('fish')
    expect(gatherOf(CRITTER_BY_ID['classic-crocodile'])).toBe('fish')
    expect(gatherOf(CRITTER_BY_ID['classic-cobra'])).toBe('timebending')
    expect(gatherOf(CRITTER_BY_ID['classic-capybara'])).toBe('timebending')
  })

  it('chaque type de la liste est porté par au moins une variante (pas de filtre vide)', () => {
    for (const g of GATHER_TYPES) expect(CRITTER_VARIANTS.some((v) => gatherOf(v) === g.id), g.id).toBe(true)
  })

  it('« constructor » ou « toString » ne sont pas des espèces', () => {
    expect(gatherOf({ id: 'x', species: 'constructor' })).toBeUndefined()
    expect(gatherOf({ id: 'toString', species: 'squirrel' })).toBe('fruit')
  })

  it('le filtre : tout, un type, ou non renseignée ; la somme des filtres couvre les 90 variantes', () => {
    expect(CRITTER_VARIANTS.filter((v) => matchesGather(v, 'all'))).toHaveLength(90)
    const perType = GATHER_TYPES.reduce((n, g) => n + CRITTER_VARIANTS.filter((v) => matchesGather(v, g.id)).length, 0)
    const unknown = CRITTER_VARIANTS.filter((v) => matchesGather(v, 'unknown')).length
    expect(perType + unknown).toBe(90)
    expect(CRITTER_VARIANTS.filter((v) => matchesGather(v, 'fruit')).map((v) => v.species)).toEqual(Array(5).fill('squirrel'))
  })
})

describe('tri alphabétique des animaux', () => {
  it('A → Z puis Z → A sur le nom affiché, sans accent ni casse', () => {
    const asc = shownNames(sortVariantsByName(CRITTER_VARIANTS, {}, 'asc'))
    const desc = shownNames(sortVariantsByName(CRITTER_VARIANTS, {}, 'desc'))
    expect(asc).toHaveLength(90)
    for (let i = 1; i < asc.length; i++) expect(asc[i - 1].localeCompare(asc[i], 'fr', { sensitivity: 'base' })).toBeLessThanOrEqual(0)
    expect(desc).toEqual([...asc].reverse())
  })

  it('utilise le nom personnalisé quand il existe', () => {
    const rabbit = CRITTER_BY_ID['classic-rabbit']
    const list = [CRITTER_BY_ID['black-rabbit'], rabbit, CRITTER_BY_ID['calico-rabbit']]
    expect(shownNames(sortVariantsByName(list, {}, 'asc'))).toEqual(['Lapin calico', 'Lapin classique', 'Lapin noir'])
    const custom = { 'critter:classic-rabbit': 'Zébulon' }
    expect(shownNames(sortVariantsByName(list, custom, 'asc'), custom)).toEqual(['Lapin calico', 'Lapin noir', 'Zébulon'])
    expect(shownNames(sortVariantsByName(list, custom, 'desc'), custom)).toEqual(['Zébulon', 'Lapin noir', 'Lapin calico'])
  })

  it('ne modifie pas la liste d’origine', () => {
    const copy = [...CRITTER_VARIANTS]
    sortVariantsByName(CRITTER_VARIANTS, {}, 'desc')
    expect(CRITTER_VARIANTS).toEqual(copy)
  })
})
