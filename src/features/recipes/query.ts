import type { CustomNames } from '../../lib/names'
import { nameKey } from '../../lib/names'
import { normalize } from '../../lib/search'
import type { RecipeCatalog } from './catalog'
import { ingredientName, recipeName, TYPE_ORDER } from './display'
import type { RecipesData } from './model'
import type { Collection, RecipeRecord, RecipeType, Slot } from './types'

export type KnownFilter = 'all' | 'known' | 'unknown' | 'favorites'
export type OriginFilter = 'all' | 'base' | 'dlc' | Collection
export type SortKey = 'name' | 'stars' | 'type' | 'sell' | 'energy'
export type SortDir = 'asc' | 'desc'

export interface RecipeFilters {
  known: KnownFilter
  type: 'all' | RecipeType
  origin: OriginFilter
  /** 0 = toutes */
  stars: 0 | 1 | 2 | 3 | 4 | 5
  /** Identifiant d'ingrédient : recettes où il est exigé OU possible */
  ingredient: string | null
  query: string
}

export const DEFAULT_FILTERS: RecipeFilters = { known: 'all', type: 'all', origin: 'all', stars: 0, ingredient: null, query: '' }

/**
 * Rôle d'un ingrédient dans une recette :
 * - `required` : place obligatoire pour cet ingrédient précis ;
 * - `possible` : un choix l'autorise (il appartient au groupe, et à la restriction éventuelle de la recette).
 */
export type IngredientRole = 'required' | 'possible'

export function slotAllows(catalog: RecipeCatalog, slot: Slot, ingredientId: string): IngredientRole | null {
  if (slot.k === 'f') return slot.i === ingredientId ? 'required' : null
  if (slot.only) return slot.only.includes(ingredientId) ? 'possible' : null
  return catalog.groupById.get(slot.g)?.members.includes(ingredientId) ? 'possible' : null
}

/** Rôle de l'ingrédient dans la recette (`required` l'emporte sur `possible`), ou null s'il n'y figure pas. */
export function ingredientRole(catalog: RecipeCatalog, recipe: RecipeRecord, ingredientId: string): IngredientRole | null {
  let role: IngredientRole | null = null
  for (const s of recipe.slots) {
    const r = slotAllows(catalog, s, ingredientId)
    if (r === 'required') return 'required'
    if (r) role = r
  }
  return role
}

/** Recettes où l'ingrédient est exigé ou simplement possible (un choix parmi d'autres). */
export function recipesUsingIngredient(catalog: RecipeCatalog, ingredientId: string): Map<string, IngredientRole> {
  const out = new Map<string, IngredientRole>()
  for (const r of catalog.recipes) {
    const role = ingredientRole(catalog, r, ingredientId)
    if (role) out.set(r.id, role)
  }
  return out
}

/** Recherche (français, anglais, autre nom, nom personnalisé) : tous les mots doivent apparaître. */
export function matchesQuery(catalog: RecipeCatalog, r: RecipeRecord, query: string, names: CustomNames): boolean {
  const q = normalize(query)
  if (!q) return true
  const hay = `${catalog.searchText.get(r.id) ?? ''} ${normalize(names[nameKey('recipe', r.id)] ?? '')}`
  return q.split(' ').every((w) => hay.includes(w))
}

/** Ingrédients dont le nom (français, anglais ou personnalisé) correspond à la saisie. */
export function searchIngredients(catalog: RecipeCatalog, query: string, names: CustomNames, limit = 8) {
  const q = normalize(query)
  if (!q) return []
  return catalog.ingredients
    .filter((i) => {
      const hay = normalize(`${i.fr ?? ''} ${i.en} ${names[nameKey('ingredient', i.id)] ?? ''}`)
      return q.split(' ').every((w) => hay.includes(w))
    })
    .sort((a, b) => ingredientName(a, names).text.localeCompare(ingredientName(b, names).text, 'fr', { sensitivity: 'base' }))
    .slice(0, limit)
}

export function filterRecipes(catalog: RecipeCatalog, data: RecipesData, f: RecipeFilters, names: CustomNames): RecipeRecord[] {
  const usage = f.ingredient ? recipesUsingIngredient(catalog, f.ingredient) : null
  return catalog.recipes.filter((r) => {
    if (f.known === 'known' && !data.known[r.id]) return false
    if (f.known === 'unknown' && data.known[r.id]) return false
    if (f.known === 'favorites' && !data.favorites[r.id]) return false
    if (f.type !== 'all' && r.type !== f.type) return false
    if (f.origin === 'base' && r.collection !== 'base') return false
    if (f.origin === 'dlc' && r.collection === 'base') return false
    if (f.origin !== 'all' && f.origin !== 'base' && f.origin !== 'dlc' && r.collection !== f.origin) return false
    if (f.stars && r.stars !== f.stars) return false
    if (usage && !usage.has(r.id)) return false
    return matchesQuery(catalog, r, f.query, names)
  })
}

/** Tri stable : à égalité, ordre alphabétique du nom affiché. */
export function sortRecipes(list: RecipeRecord[], key: SortKey, dir: SortDir, names: CustomNames): RecipeRecord[] {
  const label = (r: RecipeRecord) => recipeName(r, names).text
  const byName = (a: RecipeRecord, b: RecipeRecord) => label(a).localeCompare(label(b), 'fr', { sensitivity: 'base' })
  const value = (r: RecipeRecord) => (key === 'stars' ? r.stars : key === 'type' ? TYPE_ORDER[r.type] : key === 'sell' ? r.sell.v : key === 'energy' ? r.energy.v : 0)
  const sign = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => (key === 'name' ? sign * byName(a, b) : sign * (value(a) - value(b)) || byName(a, b)))
}
