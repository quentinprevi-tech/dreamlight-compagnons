import { isPlainObject, readKey, transact } from '../../lib/db'
import { applyRecipeOp, RECIPES_KEY, sanitizeRecipes, type RecipeOp, type RecipesData } from './model'

export async function loadRecipes(): Promise<RecipesData> {
  return sanitizeRecipes(await readKey(RECIPES_KEY))
}

/**
 * Applique UNE opération par lecture-modification-écriture atomique : deux onglets qui cochent des recettes
 * différentes en même temps conservent les deux. Les champs inconnus d'une version plus récente sont gardés.
 */
export function updateRecipes(op: RecipeOp, now: Date = new Date()): Promise<RecipesData> {
  return transact({ keys: [RECIPES_KEY] }, (values) => {
    const raw = values[RECIPES_KEY]
    const next = applyRecipeOp(sanitizeRecipes(raw), op, now)
    const stored = { ...(isPlainObject(raw) ? raw : {}), ...next }
    return { ops: { set: [[RECIPES_KEY, stored]] }, result: next }
  })
}
