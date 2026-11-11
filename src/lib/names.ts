import { isCharacterId } from '../data/characters'
import { isBiomeId, isVariantId } from '../features/critters/data'
import { isIngredientId, isRecipeId } from '../features/recipes/identifiers'
import { isAnigamiId, isTaleId } from '../features/tales/data'
import { isPlainObject, readKey, transact } from './db'

/**
 * Noms personnalisés par la joueuse pour un élément de catalogue (animal, biome, puzzle,
 * recette…), quand le nom français officiel n'est pas connu ou qu'elle préfère celui
 * qu'elle voit en jeu.
 *
 * Ces noms font partie de SES données (et de ses sauvegardes). Ils ne sont jamais
 * écrits dans les catalogues ni considérés comme des traductions officielles.
 * Clé : `<catalogue>:<id>`, par exemple `critter:calico-rabbit` ou `biome:wild-tangle`.
 */
export const NAMES_KEY = 'names'
export const MAX_NAME_LENGTH = 60

export type CustomNames = Record<string, string>

/**
 * Catalogues dont les éléments peuvent recevoir un nom personnalisé, avec la
 * vérification de leurs identifiants. Chaque nouvelle collection (puzzles,
 * recettes…) ajoute ici sa ligne.
 */
const NAME_CATALOGS: Record<string, (id: string) => boolean> = {
  character: isCharacterId,
  critter: isVariantId,
  biome: isBiomeId,
  tale: isTaleId,
  anigami: isAnigamiId,
  recipe: isRecipeId,
  ingredient: isIngredientId,
}

export const nameKey = (catalog: 'character' | 'critter' | 'biome' | 'tale' | 'anigami' | 'recipe' | 'ingredient', id: string) => `${catalog}:${id}`

export function isNameKey(key: string): boolean {
  const sep = key.indexOf(':')
  if (sep <= 0) return false
  const catalog = key.slice(0, sep)
  return Object.hasOwn(NAME_CATALOGS, catalog) && NAME_CATALOGS[catalog](key.slice(sep + 1))
}

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

/** Ne garde que les noms d'éléments réellement présents dans les catalogues. */
export function sanitizeNames(raw: unknown): CustomNames {
  const out: CustomNames = {}
  if (!isPlainObject(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (!isNameKey(key)) continue
    const name = cleanName(value)
    if (name && name.length <= MAX_NAME_LENGTH) out[key] = name
  }
  return out
}

export class NameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NameError'
  }
}

export async function loadNames(): Promise<CustomNames> {
  return sanitizeNames(await readKey(NAMES_KEY))
}

/**
 * Enregistre (ou efface avec `null`) le nom personnalisé d'UN élément, par
 * lecture-modification-écriture atomique. Renvoie les noms enregistrés.
 */
export function updateCustomName(key: string, name: string | null): Promise<CustomNames> {
  const clean = name === null ? null : cleanName(name)
  if (!isNameKey(key)) return Promise.reject(new NameError('Élément inconnu.'))
  if (clean !== null && (clean.length === 0 || clean.length > MAX_NAME_LENGTH)) {
    return Promise.reject(new NameError(`Le nom doit faire entre 1 et ${MAX_NAME_LENGTH} caractères.`))
  }
  return transact({ keys: [NAMES_KEY] }, (values) => {
    const next: Record<string, unknown> = isPlainObject(values[NAMES_KEY]) ? { ...values[NAMES_KEY] } : {}
    if (clean === null) delete next[key]
    else next[key] = clean
    return { ops: { set: [[NAMES_KEY, next]] }, result: sanitizeNames(next) }
  })
}
