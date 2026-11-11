import { isPlainObject } from '../../lib/db'
import { isRecipeId, RECIPE_TOTAL } from './identifiers'

/**
 * Suivi des recettes : celles que la joueuse connaît et ses favorites.
 * Clé IndexedDB : `recipes` → { known, favorites }.
 * - `known[id]` : date (ISO) à laquelle la recette a été marquée « connue ». La retirer puis la remettre
 *   (redécouverte) enregistre une nouvelle date.
 * - `favorites[id]` : date d'ajout aux favoris. Indépendant de « connue ».
 * Le catalogue (480 recettes) n'est jamais écrit ici : seuls les identifiants le sont.
 */
export const RECIPES_KEY = 'recipes'

export interface RecipesData {
  known: Record<string, string>
  favorites: Record<string, string>
}

export const emptyRecipes = (): RecipesData => ({ known: {}, favorites: {} })

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

function cleanMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (isPlainObject(raw)) for (const [id, at] of Object.entries(raw)) if (isRecipeId(id) && isIso(at)) out[id] = at
  return out
}

/** Ne garde que des recettes du catalogue et des dates valides. */
export function sanitizeRecipes(raw: unknown): RecipesData {
  if (!isPlainObject(raw)) return emptyRecipes()
  return { known: cleanMap(raw.known), favorites: cleanMap(raw.favorites) }
}

export type RecipeOp = { type: 'set-known'; id: string; known: boolean } | { type: 'set-favorite'; id: string; favorite: boolean }

export class RecipeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeError'
  }
}

export function applyRecipeOp(data: RecipesData, op: RecipeOp, now: Date): RecipesData {
  if (!isRecipeId(op.id)) throw new RecipeError('Recette inconnue.')
  const field = op.type === 'set-known' ? 'known' : 'favorites'
  const on = op.type === 'set-known' ? op.known : op.favorite
  const next = { ...data[field] }
  if (on) next[op.id] = data[field][op.id] ?? now.toISOString()
  else delete next[op.id]
  return { ...data, [field]: next }
}

export interface RecipesSummary {
  known: number
  favorites: number
  total: number
}

export function summarizeRecipes(data: RecipesData): RecipesSummary {
  return { known: Object.keys(data.known).length, favorites: Object.keys(data.favorites).length, total: RECIPE_TOTAL }
}
