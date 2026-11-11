import { nameKey, type CustomNames } from '../../lib/names'
import type { AnigamiType, Tale } from './data'

/**
 * Nom affiché d'un puzzle ou d'un type d'anigami, avec son origine :
 * - `custom` : nom personnalisé par la joueuse (jamais une traduction officielle) ;
 * - `guide` : nom français relevé dans un guide, NON vérifié en jeu (« À confirmer ») ;
 * - `to-confirm` : aucun nom français connu → nom anglais du wiki, « À confirmer ».
 */
export type NameKind = 'custom' | 'guide' | 'to-confirm'

export interface DisplayName {
  text: string
  kind: NameKind
}

export function anigamiName(a: AnigamiType, names: CustomNames): DisplayName {
  const custom = names[nameKey('anigami', a.id)]
  if (custom) return { text: custom, kind: 'custom' }
  return a.nameFr ? { text: a.nameFr, kind: 'guide' } : { text: a.nameEn, kind: 'to-confirm' }
}

/** Aucun puzzle n'a de nom français connu : nom anglais « À confirmer » ou nom personnalisé. */
export function taleName(t: Tale, names: CustomNames): DisplayName {
  const custom = names[nameKey('tale', t.id)]
  return custom ? { text: custom, kind: 'custom' } : { text: t.nameEn, kind: 'to-confirm' }
}

export const NAME_KIND_LABEL: Record<NameKind, string> = {
  custom: 'Nom personnalisé',
  guide: 'Nom français d’après un guide (non vérifié en jeu)',
  'to-confirm': 'Nom français à confirmer',
}
