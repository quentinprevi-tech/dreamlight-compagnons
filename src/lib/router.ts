import { useEffect, useState } from 'react'
import { isProfessionId, type ProfessionId } from '../data/professions'

/**
 * Navigation par adresse (#/…). Les anciennes adresses restent valides :
 * `#/metier/<id>`, `#/personnages`, `#/numismagie`, `#/infos`.
 * `#/` ouvre désormais « Aujourd'hui » ; l'ancien accueil des métiers est `#/metiers`.
 * Collection : `#/collection` (accueil), `#/collection/animaux`, `#/collection/animaux/aujourdhui`,
 * `#/collection/puzzles`, `#/collection/recettes`.
 */
export type Route =
  | { name: 'today' }
  | { name: 'tasks-settings' }
  | { name: 'professions' }
  | { name: 'collection' }
  /** Puzzles (Lorekeeper Tales) et anigamis */
  | { name: 'tales' }
  /** Encyclopédie des recettes */
  | { name: 'recipes' }
  /** Pets Tracker ; `today` : vue « À nourrir aujourd'hui » */
  | { name: 'critters'; view: 'all' | 'today' }
  | { name: 'profession'; id: ProfessionId }
  | { name: 'characters' }
  | { name: 'about' }
  | { name: 'scramblecoin' }

/** Écrans rangés sous l'onglet « Habitants » (sélecteur Habitants / Métiers / Numismagie). */
export const VILLAGER_ROUTES: Route['name'][] = ['characters', 'professions', 'profession', 'scramblecoin']

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'metier' && isProfessionId(parts[1])) return { name: 'profession', id: parts[1] }
  if (parts[0] === 'metiers') return { name: 'professions' }
  if (parts[0] === 'personnages') return { name: 'characters' }
  if (parts[0] === 'infos') return { name: 'about' }
  if (parts[0] === 'numismagie') return { name: 'scramblecoin' }
  if (parts[0] === 'aujourdhui' && parts[1] === 'taches') return { name: 'tasks-settings' }
  if (parts[0] === 'collection') {
    if (parts[1] === 'animaux') return { name: 'critters', view: parts[2] === 'aujourdhui' ? 'today' : 'all' }
    if (parts[1] === 'puzzles') return { name: 'tales' }
    if (parts[1] === 'recettes') return { name: 'recipes' }
    return { name: 'collection' }
  }
  return { name: 'today' }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'profession':
      return `#/metier/${route.id}`
    case 'professions':
      return '#/metiers'
    case 'characters':
      return '#/personnages'
    case 'about':
      return '#/infos'
    case 'scramblecoin':
      return '#/numismagie'
    case 'tasks-settings':
      return '#/aujourdhui/taches'
    case 'collection':
      return '#/collection'
    case 'tales':
      return '#/collection/puzzles'
    case 'recipes':
      return '#/collection/recettes'
    case 'critters':
      return route.view === 'today' ? '#/collection/animaux/aujourdhui' : '#/collection/animaux'
    default:
      return '#/'
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
