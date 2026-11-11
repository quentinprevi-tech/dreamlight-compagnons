import type { Route } from '../../lib/router'

/**
 * Sections de l'onglet Collection. Pour en ajouter une (puzzles, recettes…) :
 * une entrée ici, puis passer son `status` à `available` avec sa route quand l'écran existe.
 * Une section `soon` s'affiche grisée et n'est pas cliquable : aucune fausse fonctionnalité.
 */
export interface CollectionSection {
  id: string
  label: string
  emoji: string
  description: string
  status: 'available' | 'soon'
  /** Obligatoire pour une section `available` */
  route?: Route
}

export const COLLECTION_SECTIONS: CollectionSection[] = [
  {
    id: 'critters',
    label: 'Animaux',
    emoji: '🐾',
    description: 'Les créatures sauvages à apprivoiser, par biome et par couleur.',
    status: 'available',
    route: { name: 'critters', view: 'all' },
  },
  {
    id: 'puzzles',
    label: 'Puzzles',
    emoji: '🧩',
    description: 'Tes anigamis et le coût de chaque puzzle.',
    status: 'available',
    route: { name: 'tales' },
  },
  {
    id: 'recipes',
    label: 'Recettes',
    emoji: '🍲',
    description: 'L’encyclopédie des 480 recettes et celles que tu connais.',
    status: 'available',
    route: { name: 'recipes' },
  },
]
