import { describe, expect, it } from 'vitest'
import { CHARACTERS, COLLECTIONS, isReleased } from './characters'

describe('base de données des personnages', () => {
  it('a des identifiants uniques et stables', () => {
    const ids = CHARACTERS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('n’a pas de doublon de nom', () => {
    const names = CHARACTERS.map((c) => c.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('rattache chaque personnage à une collection connue', () => {
    const known = new Set(COLLECTIONS.map((c) => c.id))
    for (const c of CHARACTERS) expect(known.has(c.collection)).toBe(true)
  })

  it('recense les 74 habitants de la collection en jeu (wiki, 30/10/2026)', () => {
    const counts = Object.fromEntries(COLLECTIONS.map((col) => [col.id, CHARACTERS.filter((c) => c.collection === col.id).length]))
    expect(counts).toMatchObject({ base: 57, eternity: 5, storybook: 5, wishblossom: 4, honeyglow: 3 })
  })

  it('distingue les personnages annoncés selon la date', () => {
    const lilo = CHARACTERS.find((c) => c.id === 'lilo')!
    expect(isReleased(lilo, new Date('2026-10-30T12:00:00'))).toBe(false)
    expect(isReleased(lilo, new Date('2026-12-10T12:00:00'))).toBe(true)
    expect(isReleased(CHARACTERS.find((c) => c.id === 'mickey')!)).toBe(true)
  })
})
