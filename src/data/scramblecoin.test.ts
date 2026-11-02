import { describe, expect, it } from 'vitest'
import { CHARACTERS, CHARACTERS_BY_ID, isReleased } from './characters'
import { SCRAMBLECOIN, figurineName, scramblecoinCharacters } from './scramblecoin'

describe('données de Numismagie', () => {
  it('ne référencent que des habitants connus', () => {
    expect(Object.keys(SCRAMBLECOIN).filter((id) => !CHARACTERS_BY_ID[id])).toEqual([])
  })

  it('donnent un niveau 1, 2 ou 3 et 5 figurines à chacun', () => {
    for (const [id, o] of Object.entries(SCRAMBLECOIN)) {
      expect([1, 2, 3], id).toContain(o.level)
      expect(o.lineup, id).toHaveLength(5)
    }
  })

  it('couvrent tous les habitants déjà sortis (74)', () => {
    const released = CHARACTERS.filter((c) => isReleased(c, new Date('2026-11-02T12:00:00')))
    expect(released.filter((c) => !SCRAMBLECOIN[c.id]).map((c) => c.id)).toEqual([])
    expect(scramblecoinCharacters()).toHaveLength(74)
  })

  it('reprend les valeurs du wiki', () => {
    expect(SCRAMBLECOIN.goofy).toEqual({ level: 1, lineup: ['Goofy', 'Goofy', 'Goofy', 'Goofy', 'Goofy'] })
    expect(SCRAMBLECOIN.scar.level).toBe(3)
    expect(SCRAMBLECOIN['mike'].level).toBe(2)
  })

  it('traduit les figurines en français', () => {
    expect(figurineName('Goofy')).toBe('Dingo')
    expect(figurineName('Forky')).toBe('Fourchette')
    expect(figurineName('Fairy Godmother')).toBe('La Bonne Fée')
  })
})
