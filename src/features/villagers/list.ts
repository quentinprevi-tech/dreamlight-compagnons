import type { Character } from '../../data/characters'
import { compareNames, type SortDirection } from '../../lib/listSort'
import { FRIENDSHIP_MAX, isUnlocked, type Villagers } from './model'

/**
 * Tri et filtre de la liste des habitants selon l'amitié (fonctions pures, testées).
 * L'amitié est saisie à la main : « non renseignée » n'est jamais assimilée à un niveau.
 */

export type VillagerSortKey = 'collection' | 'friendship'

/** Niveau d'amitié tel qu'affiché : un habitant non débloqué n'en montre pas (même si une valeur est enregistrée). */
export function shownFriendship(villagers: Villagers, assignments: Record<string, unknown>, id: string): number | undefined {
  return isUnlocked(villagers, assignments, id) ? villagers[id]?.friendship : undefined
}

/**
 * Filtre « pas encore niveau max » : habitants débloqués dont l'amitié est inférieure à 10 OU non renseignée
 * (on ne sait pas qu'elle est au maximum). Les habitants non débloqués n'ont pas d'amitié à faire progresser.
 */
export function belowMaxFriendship(villagers: Villagers, assignments: Record<string, unknown>, id: string): boolean {
  return isUnlocked(villagers, assignments, id) && villagers[id]?.friendship !== FRIENDSHIP_MAX
}

/**
 * Tri par niveau d'amitié. `asc` : du plus faible (1) au plus élevé (10) ; `desc` : l'inverse.
 * Les habitants sans niveau affiché restent TOUJOURS à la fin, quel que soit le sens :
 * d'abord les débloqués au niveau non renseigné, puis les non débloqués. À égalité : ordre alphabétique.
 */
export function sortByFriendship(characters: Character[], villagers: Villagers, assignments: Record<string, unknown>, direction: SortDirection): Character[] {
  const sign = direction === 'asc' ? 1 : -1
  const rank = (c: Character) => {
    const level = shownFriendship(villagers, assignments, c.id)
    if (level !== undefined) return { group: 0, level }
    return { group: isUnlocked(villagers, assignments, c.id) ? 1 : 2, level: 0 }
  }
  return [...characters].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra.group !== rb.group) return ra.group - rb.group
    if (ra.level !== rb.level) return sign * (ra.level - rb.level)
    return compareNames(a.name, b.name)
  })
}
