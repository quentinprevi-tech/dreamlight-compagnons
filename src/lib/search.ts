import type { Character } from '../data/characters'

/** Minuscules sans accents ni ponctuation : « Buzz l’Éclair » → « buzz l eclair ». */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Recherche sur le nom français, le nom anglais et l'univers. */
export function matchesQuery(ch: Character, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const hay = normalize(`${ch.name} ${ch.nameEn} ${ch.universe}`)
  return q.split(' ').every((word) => hay.includes(word))
}

export function byName(a: Character, b: Character): number {
  return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
}
