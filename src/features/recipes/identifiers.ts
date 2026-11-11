import { INGREDIENT_IDS, RECIPE_IDS } from './ids'

const RECIPE_SET = new Set<string>(RECIPE_IDS)
const INGREDIENT_SET = new Set<string>(INGREDIENT_IDS)

/** Validation des identifiants sans charger le catalogue complet (sauvegardes, noms personnalisés). */
export const isRecipeId = (id: unknown): id is string => typeof id === 'string' && RECIPE_SET.has(id)
export const isIngredientId = (id: unknown): id is string => typeof id === 'string' && INGREDIENT_SET.has(id)
export const RECIPE_TOTAL = RECIPE_IDS.length
