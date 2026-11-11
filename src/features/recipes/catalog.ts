import { normalize } from '../../lib/search'
import type { GroupId, GroupRecord, IngredientRecord, RecipeRecord } from './types'

export interface CatalogData {
  RECIPES: RecipeRecord[]
  INGREDIENTS: IngredientRecord[]
  GROUPS: GroupRecord[]
  RECIPES_VERIFIED: string
}

/** Catalogue indexé : construit une fois au chargement, jamais enregistré en base. */
export interface RecipeCatalog {
  verified: string
  recipes: RecipeRecord[]
  byId: Map<string, RecipeRecord>
  ingredients: IngredientRecord[]
  ingredientById: Map<string, IngredientRecord>
  groups: GroupRecord[]
  groupById: Map<GroupId, GroupRecord>
  /** Groupes auxquels appartient chaque ingrédient (dérivé de GROUPS, source unique) */
  groupsOfIngredient: Map<string, GroupId[]>
  /** Texte de recherche normalisé (noms français, autre nom, anglais) */
  searchText: Map<string, string>
}

export function buildCatalog(data: CatalogData): RecipeCatalog {
  const groupsOfIngredient = new Map<string, GroupId[]>()
  for (const g of data.GROUPS) {
    for (const m of g.members) groupsOfIngredient.set(m, [...(groupsOfIngredient.get(m) ?? []), g.id])
  }
  return {
    verified: data.RECIPES_VERIFIED,
    recipes: data.RECIPES,
    byId: new Map(data.RECIPES.map((r) => [r.id, r])),
    ingredients: data.INGREDIENTS,
    ingredientById: new Map(data.INGREDIENTS.map((i) => [i.id, i])),
    groups: data.GROUPS,
    groupById: new Map(data.GROUPS.map((g) => [g.id, g])),
    groupsOfIngredient,
    searchText: new Map(data.RECIPES.map((r) => [r.id, normalize([r.fr, r.frAlt, r.en].filter(Boolean).join(' '))])),
  }
}

let cache: Promise<RecipeCatalog> | null = null

/** Charge le catalogue à la demande (fichier séparé du paquet principal, mis en cache hors ligne). */
export function loadRecipeCatalog(): Promise<RecipeCatalog> {
  cache ??= import('./catalog.data').then(
    (m) => buildCatalog(m),
    (err: unknown) => {
      cache = null // permet de réessayer
      throw err
    },
  )
  return cache
}
