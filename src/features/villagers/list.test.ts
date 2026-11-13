import { describe, expect, it } from 'vitest'
import { CHARACTERS, CHARACTERS_BY_ID } from '../../data/characters'
import { belowMaxFriendship, shownFriendship, sortByFriendship } from './list'
import type { Villagers } from './model'

const pick = (...ids: string[]) => ids.map((id) => CHARACTERS_BY_ID[id])
const ids = (list: { id: string }[]) => list.map((c) => c.id)

// aladdin, jasmine, alice, belle : quatre habitants du catalogue
const villagers: Villagers = {
  aladdin: { unlocked: true, friendship: 7 },
  jasmine: { unlocked: true, friendship: 2 },
  alice: { unlocked: true }, // débloquée, niveau non renseigné
  belle: { friendship: 9 }, // niveau enregistré mais NON débloquée : non affiché
}

describe('niveau d’amitié affiché', () => {
  it('un habitant non débloqué n’affiche aucun niveau, même enregistré', () => {
    expect(shownFriendship(villagers, {}, 'belle')).toBeUndefined()
    expect(shownFriendship(villagers, { belle: 'fishing' }, 'belle')).toBe(9) // un métier le débloque
    expect(shownFriendship(villagers, {}, 'aladdin')).toBe(7)
    expect(shownFriendship(villagers, {}, 'alice')).toBeUndefined()
  })
})

describe('tri par niveau d’amitié', () => {
  const all = pick('aladdin', 'jasmine', 'alice', 'belle')

  it('du plus faible au plus élevé, puis les niveaux non renseignés, puis les non débloqués', () => {
    expect(ids(sortByFriendship(all, villagers, {}, 'asc'))).toEqual(['jasmine', 'aladdin', 'alice', 'belle'])
  })

  it('sens inversé : du plus élevé au plus faible ; les sans-niveau restent à la fin', () => {
    expect(ids(sortByFriendship(all, villagers, {}, 'desc'))).toEqual(['aladdin', 'jasmine', 'alice', 'belle'])
  })

  it('à niveau égal, l’ordre alphabétique départage (dans les deux sens)', () => {
    const same: Villagers = { aladdin: { unlocked: true, friendship: 5 }, jasmine: { unlocked: true, friendship: 5 }, alice: { unlocked: true, friendship: 5 } }
    const names = (d: 'asc' | 'desc') => sortByFriendship(pick('jasmine', 'aladdin', 'alice'), same, {}, d).map((c) => c.name)
    expect(names('asc')).toEqual(['Aladdin', 'Alice', 'Jasmine'])
    expect(names('desc')).toEqual(['Aladdin', 'Alice', 'Jasmine'])
  })

  it('niveau 10 en dernier (croissant) ou en premier (décroissant)', () => {
    const v: Villagers = { aladdin: { unlocked: true, friendship: 10 }, jasmine: { unlocked: true, friendship: 1 }, alice: { unlocked: true, friendship: 6 } }
    expect(ids(sortByFriendship(pick('aladdin', 'jasmine', 'alice'), v, {}, 'asc'))).toEqual(['jasmine', 'alice', 'aladdin'])
    expect(ids(sortByFriendship(pick('aladdin', 'jasmine', 'alice'), v, {}, 'desc'))).toEqual(['aladdin', 'alice', 'jasmine'])
  })

  it('ne modifie ni la liste d’origine ni les données', () => {
    const copy = [...all]
    const before = JSON.stringify(villagers)
    sortByFriendship(all, villagers, {}, 'asc')
    expect(all).toEqual(copy)
    expect(JSON.stringify(villagers)).toBe(before)
  })

  it('trie tout le catalogue sans perte ni doublon', () => {
    const sorted = sortByFriendship(CHARACTERS, villagers, {}, 'asc')
    expect(sorted).toHaveLength(CHARACTERS.length)
    expect(new Set(ids(sorted)).size).toBe(CHARACTERS.length)
  })
})

describe('filtre « pas encore niveau 10 »', () => {
  it('garde les débloqués aux niveaux 1 à 9 ou non renseignés', () => {
    const v: Villagers = { aladdin: { unlocked: true, friendship: 10 }, jasmine: { unlocked: true, friendship: 9 }, alice: { unlocked: true }, belle: { friendship: 3 } }
    expect(belowMaxFriendship(v, {}, 'aladdin')).toBe(false) // niveau 10
    expect(belowMaxFriendship(v, {}, 'jasmine')).toBe(true) // niveau 9
    expect(belowMaxFriendship(v, {}, 'alice')).toBe(true) // niveau inconnu : à vérifier
    expect(belowMaxFriendship(v, {}, 'belle')).toBe(false) // non débloquée : pas d'amitié à faire progresser
    expect(belowMaxFriendship(v, { belle: 'mining' }, 'belle')).toBe(true) // un métier la débloque
  })
})
