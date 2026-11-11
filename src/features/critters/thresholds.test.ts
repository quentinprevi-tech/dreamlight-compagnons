import { describe, expect, it } from 'vitest'
import { CRITTER_BY_ID, CRITTER_VARIANTS } from './data'
import { OBTAINED_RULE, feedingsLabel, reachedMessage, thresholdChip, thresholdExplanation, thresholdKind } from './thresholds'

describe('seuil de nourrissages : exact, « au moins » ou inconnu', () => {
  const exact = CRITTER_BY_ID['black-rabbit'].feedings // « 2 »
  const atLeast = CRITTER_BY_ID['emerald-sunbird'].feedings // « 4+ »
  const unknown = CRITTER_BY_ID['beige-monkey'].feedings // non indiqué

  it('trois statuts distincts, déduits des données du wiki sans rien compléter', () => {
    expect(thresholdKind(exact)).toBe('exact')
    expect(thresholdKind(atLeast)).toBe('at-least')
    expect(thresholdKind(unknown)).toBe('unknown')
    expect(unknown).toBeUndefined() // jamais complété
    const kinds = CRITTER_VARIANTS.map((v) => thresholdKind(v.feedings))
    expect([kinds.filter((k) => k === 'exact').length, kinds.filter((k) => k === 'at-least').length, kinds.filter((k) => k === 'unknown').length]).toEqual([37, 31, 22])
  })

  it('une fraction « n/N » n’est affichée que pour un seuil exact', () => {
    expect(feedingsLabel(1, exact)).toBe('1/2')
    expect(feedingsLabel(2, atLeast)).toBe('2 · au moins 4')
    expect(feedingsLabel(3, unknown)).toBe('3 · seuil inconnu')
    for (const v of CRITTER_VARIANTS) {
      for (const count of [0, 3, 12]) expect(feedingsLabel(count, v.feedings).includes('/'), `${v.id} ${count}`).toBe(thresholdKind(v.feedings) === 'exact')
    }
  })

  it('étiquettes et explications : le seuil réel inconnu n’est jamais une garantie', () => {
    expect(thresholdChip(exact)).toBe('Seuil exact : 2')
    expect(thresholdChip(atLeast)).toBe('Au moins 4 (seuil exact inconnu)')
    expect(thresholdChip(unknown)).toBe('Seuil inconnu')
    expect(thresholdExplanation(exact)).toBe('Le wiki indique qu’il faut nourrir cet animal 2 fois.')
    expect(thresholdExplanation(atLeast)).toContain('peut être plus élevé')
    expect(thresholdExplanation(atLeast)).toContain('4 nourrissages ne garantissent pas l’obtention')
    expect(thresholdExplanation(unknown)).toContain('aucun nombre de nourrissages ne garantit son obtention')
    // Un seuil exact n'est pas présenté comme une garantie non plus : la case « Obtenu » fait foi
    expect(OBTAINED_RULE).toContain('fait foi')
  })

  it('message « seuil atteint » : prudent pour « au moins », absent si le seuil est inconnu', () => {
    expect(reachedMessage(exact, 1)).toBeNull()
    expect(reachedMessage(exact, 2)).toContain('indiqué par le wiki (2)')
    expect(reachedMessage(exact, 2)).toContain('ne coche « Obtenu » que lorsqu’il y est')
    expect(reachedMessage(atLeast, 3)).toBeNull()
    expect(reachedMessage(atLeast, 4)).toContain('seulement « au moins 4 »')
    expect(reachedMessage(atLeast, 4)).toContain('peut demander davantage')
    // Seuil inconnu : trois nourrissages (ou cent) ne déclenchent jamais « atteint »
    for (const count of [0, 1, 3, 5, 99]) expect(reachedMessage(unknown, count)).toBeNull()
  })
})
