import { nameKey, type CustomNames } from '../../lib/names'
import type { Collection, FrStatus, IngredientRecord, RecipeRecord, RecipeType, Value } from './types'

/**
 * Nom affiché, avec son origine. AUCUN nom français n'est présenté comme officiel ou vérifié en jeu :
 * - `custom` : nom choisi par la joueuse ;
 * - `two-guides` / `one-guide` : nom relevé dans 2 / 1 guide(s) (deux guides ne valent pas deux vérifications) ;
 * - `to-confirm` : aucun nom français relevé → anglais, « À confirmer ».
 */
export type NameKind = 'custom' | 'two-guides' | 'one-guide' | 'to-confirm'

export interface DisplayName {
  text: string
  kind: NameKind
}

export const NAME_KIND_LABEL: Record<NameKind, string> = {
  custom: 'Nom personnalisé',
  'two-guides': 'Nom relevé dans 2 guides (non vérifié en jeu)',
  'one-guide': 'Nom relevé dans 1 guide (non vérifié en jeu)',
  'to-confirm': 'Nom français à confirmer',
}

/** Libellé court pour un badge */
export const NAME_KIND_BADGE: Record<NameKind, string> = {
  custom: 'Mon nom',
  'two-guides': '2 guides',
  'one-guide': '1 guide',
  'to-confirm': 'À confirmer',
}

const kindOf = (status: FrStatus): NameKind => (status === 'en-only' ? 'to-confirm' : status)

export function recipeName(r: RecipeRecord, names: CustomNames): DisplayName {
  const custom = names[nameKey('recipe', r.id)]
  if (custom) return { text: custom, kind: 'custom' }
  return { text: r.fr ?? r.en, kind: kindOf(r.frStatus) }
}

export function ingredientName(i: IngredientRecord, names: CustomNames): DisplayName {
  const custom = names[nameKey('ingredient', i.id)]
  if (custom) return { text: custom, kind: 'custom' }
  return { text: i.fr ?? i.en, kind: kindOf(i.frStatus) }
}

export const TYPE_LABEL: Record<RecipeType, string> = { appetizer: 'Hors-d’œuvre', entree: 'Plat', dessert: 'Dessert' }
export const TYPE_EMOJI: Record<RecipeType, string> = { appetizer: '🥗', entree: '🍲', dessert: '🍰' }
export const TYPE_ORDER: Record<RecipeType, number> = { appetizer: 0, entree: 1, dessert: 2 }

export const COLLECTION_LABEL: Record<Collection, string> = {
  base: 'Jeu de base',
  eternity: 'A Rift in Time',
  storybook: 'Storybook Vale',
  wishblossom: 'Wishblossom Ranch',
  honeyglow: 'Honeyglow Woods',
}

export const stars = (n: number) => '★'.repeat(n)

const fmt = (x: number) => x.toLocaleString('fr-FR')

/** Texte court d'une valeur (liste) : un minimum n'est jamais présenté comme une valeur exacte. */
export const shortValue = (v: Value): string => (v.k === 'min' ? `dès ${fmt(v.v)}` : fmt(v.v))

/**
 * Affichage d'une valeur (énergie ou prix), statuts indépendants :
 * - `k = min` (la fiche du wiki dit « or more ») : toujours « à partir de X », même si les guides concordent ;
 * - `k = exact` : la valeur, indiquée exacte par la fiche du wiki ;
 * - un guide qui relève une autre valeur est signalé ; la valeur du catalogue est conservée.
 */
export function describeValue(v: Value): { text: string; note?: string } {
  const text = v.k === 'min' ? `à partir de ${fmt(v.v)}` : fmt(v.v)
  const base = v.k === 'min' ? 'Minimum publié par le wiki (« or more »).' : 'Valeur exacte selon le wiki.'
  if (v.s === 'differs' && v.alt !== undefined) {
    const other = v.k === 'min' && v.alt > v.v ? `un guide relève ${fmt(v.alt)} (autre combinaison possible)` : `un guide relève ${fmt(v.alt)} (désaccord, valeur du catalogue conservée)`
    return { text, note: `${base} ${other[0].toUpperCase()}${other.slice(1)}.` }
  }
  return { text, note: base }
}
