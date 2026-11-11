/**
 * Types du catalogue des recettes (généré par scripts/build-recipes.py, chargé à la demande).
 *
 * Choix de conception :
 * - catalogue maître = le wiki (480 recettes) ; les identifiants viennent des noms ANGLAIS et ne changent jamais ;
 * - un nom français n'est jamais « officiel » : il indique dans combien de guides il a été relevé
 *   (cela ne prouve PAS deux vérifications indépendantes) ou, à défaut, reste l'anglais « À confirmer » ;
 * - les ingrédients sont dans un catalogue séparé ; les groupes « au choix » et leurs membres n'existent
 *   qu'à UN endroit (`GROUPS`), les recettes ne font que les référencer.
 */
export type RecipeType = 'appetizer' | 'entree' | 'dessert'
export type Collection = 'base' | 'eternity' | 'storybook' | 'wishblossom' | 'honeyglow'
export type GroupId = 'fruit' | 'grain' | 'dairy-oil' | 'fish' | 'protein' | 'seafood' | 'spice' | 'sweet' | 'vegetable' | 'ice' | 'meat'

/** Nombre de guides où le nom a été relevé (aucune garantie d'indépendance), ou aucun. */
export type FrStatus = 'two-guides' | 'one-guide' | 'en-only'

/**
 * Une place de la recette :
 * - `f` : ingrédient OBLIGATOIRE précis, en quantité exacte `q` ;
 * - `c` : choix — `q` ingrédient(s) À CHOISIR dans le groupe `g` (jamais tous les membres à la fois),
 *   éventuellement restreint par la recette à la liste `only`.
 */
export type Slot = { k: 'f'; i: string; q: number } | { k: 'c'; g: GroupId; q: number; only?: string[] }

/**
 * Statut d'une valeur, indépendant pour l'énergie et pour le prix de vente :
 * - `wiki-only` : seule la valeur du catalogue maître est connue ;
 * - `agree` : les guides consultés donnent la même valeur ;
 * - `differs` : un guide donne une autre valeur (`alt`) — on garde celle du catalogue maître.
 */
export type ValueStatus = 'agree' | 'differs' | 'wiki-only'
/**
 * - `k` : `min` = la fiche du wiki dit « or more » (valeur la plus basse possible, jamais présentée comme exacte) ;
 *   `exact` = la fiche ne dit pas « or more ».
 * - `s` : concordance avec les guides (indépendante de `k`).
 */
export interface Value {
  v: number
  k: 'min' | 'exact'
  s: ValueStatus
  alt?: number
}

export interface RecipeRecord {
  id: string
  en: string
  fr: string | null
  frStatus: FrStatus
  /** Autre nom français relevé dans l'autre guide, quand les deux guides divergent */
  frAlt?: string
  type: RecipeType
  stars: 1 | 2 | 3 | 4 | 5
  collection: Collection
  slots: Slot[]
  energy: Value
  sell: Value
  notes?: string[]
}

export interface IngredientRecord {
  id: string
  en: string
  fr: string | null
  frStatus: FrStatus
}

export interface GroupRecord {
  id: GroupId
  en: string
  fr: string
  members: string[]
  /** `false` : composition déduite, non vérifiée (« À confirmer ») */
  confirmed?: false
  note?: string
}
