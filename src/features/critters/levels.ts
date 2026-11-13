import { isPlainObject } from '../../lib/db'
import { isVariantId } from './data'
import { CritterError } from './model'

/**
 * Niveau des compagnons (animaux obtenus) : 1 à 5, saisi à la main, jamais déduit du jeu.
 *
 * STOCKAGE SÉPARÉ, dans sa propre clé IndexedDB : `critterLevels` → { [idVariante]: niveau }.
 * Pourquoi : la version 3 de l'app (déjà publiée) réécrit toute la clé `critters` en ne gardant que les champs
 * qu'elle connaît ; un niveau rangé dans `critters` serait donc effacé dès qu'un onglet resté en version 3 modifie
 * un animal. Une clé que la version 3 ne lit ni n'écrit jamais ne peut pas être touchée par elle.
 * (Un numéro de version des données plus élevé n'aurait rien protégé : voir docs/suivi-habitants-animaux-2026-11.md.)
 *
 * Règles :
 * - niveau facultatif : absent = non renseigné, jamais supposé égal à 1 ;
 * - réservé aux animaux OBTENUS (vérifié à l'écriture, dans la même transaction que la lecture de `critters`) ;
 * - décocher « Obtenu » ne supprime pas le niveau : il est seulement masqué, et revient si on recoche ;
 * - `critters` ne contient jamais de niveau, et aucune opération sur `critters` ne lit ni n'écrit cette clé.
 *
 * Le maximum de 5 vient de guides de jeu (Destructoid 31/10/2025, GameGrin 22/06/2025, guide Steam 08/2025) :
 * à recouper avec le wiki, inaccessible lors de la rédaction.
 */
export const CRITTER_LEVELS_KEY = 'critterLevels'
export const COMPANION_LEVEL_MIN = 1
export const COMPANION_LEVEL_MAX = 5

/** Niveau par identifiant de variante. */
export type CritterLevels = Record<string, number>

export const emptyLevels = (): CritterLevels => ({})

export function isCompanionLevel(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= COMPANION_LEVEL_MIN && v <= COMPANION_LEVEL_MAX
}

/** « Niveau 3 », « Niveau 5 (max) » ou « Non renseigné ». */
export function formatCompanionLevel(v: number | undefined): string {
  return v === undefined ? 'Non renseigné' : v === COMPANION_LEVEL_MAX ? `Niveau ${v} (max)` : `Niveau ${v}`
}

/** Ne garde que les variantes du catalogue et les niveaux valides : tout le reste est ignoré à la lecture. */
export function sanitizeCritterLevels(raw: unknown): CritterLevels {
  const out: CritterLevels = {}
  if (!isPlainObject(raw)) return out
  for (const [id, level] of Object.entries(raw)) if (isVariantId(id) && isCompanionLevel(level)) out[id] = level
  return out
}

/**
 * Entrées de la valeur enregistrée que cette version ne connaît pas (animal d'une version plus récente) :
 * elles sont recopiées telles quelles à chaque écriture, jamais supprimées.
 */
export function unknownLevelEntries(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!isPlainObject(raw)) return out
  for (const [id, value] of Object.entries(raw)) if (!isVariantId(id)) out[id] = value
  return out
}

/**
 * Nouveau jeu de niveaux après le réglage du niveau d'UN animal (`null` efface). Fonction pure.
 * Refuse un animal inconnu, un animal non obtenu et un niveau hors de 1 à 5, sans rien changer.
 */
export function applyLevelChange(levels: CritterLevels, obtained: boolean, id: string, level: number | null): CritterLevels {
  if (!isVariantId(id)) throw new CritterError('Animal inconnu.')
  if (!obtained) throw new CritterError('Coche « Obtenu » pour suivre le niveau de ce compagnon.')
  if (level !== null && !isCompanionLevel(level)) throw new CritterError(`Le niveau doit être entre ${COMPANION_LEVEL_MIN} et ${COMPANION_LEVEL_MAX}.`)
  const next = { ...levels }
  if (level === null) delete next[id]
  else next[id] = level
  return next
}
