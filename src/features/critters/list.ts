import { compareNames, type SortDirection } from '../../lib/listSort'
import type { CustomNames } from '../../lib/names'
import type { CritterVariant } from './data'
import { variantName } from './display'
import { gatherOf, type GatherId } from './gathering'

/** Tri et filtre de la liste des animaux (fonctions pures, testées). */

export type CritterSortKey = 'biome' | 'name'

/** Filtre de capacité : tout, un type d'objet, ou `unknown` (capacité non renseignée). */
export type GatherFilter = 'all' | GatherId | 'unknown'

export function matchesGather(variant: Pick<CritterVariant, 'id' | 'species'>, filter: GatherFilter): boolean {
  if (filter === 'all') return true
  const gather = gatherOf(variant)
  return filter === 'unknown' ? gather === undefined : gather === filter
}

/**
 * Tri alphabétique sur le nom AFFICHÉ (nom personnalisé, sinon nom français du wiki, sinon nom anglais).
 * `asc` : A → Z ; `desc` : Z → A. À égalité de nom, l'identifiant départage (ordre stable).
 */
export function sortVariantsByName(variants: CritterVariant[], names: CustomNames, direction: SortDirection): CritterVariant[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...variants].sort((a, b) => sign * compareNames(variantName(a, names).text, variantName(b, names).text) || a.id.localeCompare(b.id))
}
