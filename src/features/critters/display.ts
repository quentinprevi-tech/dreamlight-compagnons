import { nameKey, type CustomNames } from '../../lib/names'
import { BIOME_BY_ID, SPECIES_BY_ID, type CritterBiome, type CritterVariant } from './data'

/**
 * Nom affiché d'un élément, avec son origine :
 * - `custom` : nom personnalisé par la joueuse (jamais une traduction officielle) ;
 * - `wiki` : nom français relevé sur le wiki (non vérifié en jeu) ;
 * - `to-confirm` : pas de nom français connu → nom anglais, « À confirmer ».
 */
export type NameKind = 'custom' | 'wiki' | 'to-confirm'

export interface DisplayName {
  text: string
  kind: NameKind
}

export function variantName(v: CritterVariant, names: CustomNames): DisplayName {
  const custom = names[nameKey('critter', v.id)]
  if (custom) return { text: custom, kind: 'custom' }
  return v.nameFr ? { text: v.nameFr, kind: 'wiki' } : { text: v.nameEn, kind: 'to-confirm' }
}

/** Aucun biome n'a de nom français sur le wiki : nom anglais « À confirmer » ou nom personnalisé. */
export function biomeName(b: CritterBiome, names: CustomNames): DisplayName {
  const custom = names[nameKey('biome', b.id)]
  return custom ? { text: custom, kind: 'custom' } : { text: b.nameEn, kind: 'to-confirm' }
}

export function speciesName(id: string): DisplayName {
  const s = SPECIES_BY_ID[id]
  return s.nameFr ? { text: s.nameFr, kind: 'wiki' } : { text: s.nameEn, kind: 'to-confirm' }
}

export function biomeOf(v: CritterVariant): CritterBiome {
  return BIOME_BY_ID[v.biome]
}

export const NAME_KIND_LABEL: Record<NameKind, string> = {
  custom: 'Nom personnalisé',
  wiki: 'Nom français d’après le wiki (non vérifié en jeu)',
  'to-confirm': 'Nom français à confirmer',
}
