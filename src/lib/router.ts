import { useEffect, useState } from 'react'
import { isProfessionId, type ProfessionId } from '../data/professions'

export type Route =
  | { name: 'home' }
  | { name: 'profession'; id: ProfessionId }
  | { name: 'characters' }
  | { name: 'about' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'metier' && isProfessionId(parts[1])) return { name: 'profession', id: parts[1] }
  if (parts[0] === 'personnages') return { name: 'characters' }
  if (parts[0] === 'infos') return { name: 'about' }
  return { name: 'home' }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'profession':
      return `#/metier/${route.id}`
    case 'characters':
      return '#/personnages'
    case 'about':
      return '#/infos'
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
