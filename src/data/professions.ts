export type ProfessionId = 'fishing' | 'gardening' | 'mining' | 'foraging' | 'digging'

export interface Profession {
  id: ProfessionId
  name: string
  emoji: string
  tagline: string
  /** Classes Tailwind du dégradé de la carte */
  gradient: string
  /** Couleur d'accent (pastilles, bordures) */
  accent: string
  soft: string
}

export const PROFESSIONS: Profession[] = [
  {
    id: 'fishing',
    name: 'Pêche',
    emoji: '🎣',
    tagline: 'Au bord de l’eau',
    gradient: 'from-sky-300 via-cyan-300 to-teal-200',
    accent: 'bg-sky-500',
    soft: 'bg-sky-100 text-sky-800',
  },
  {
    id: 'gardening',
    name: 'Jardinage',
    emoji: '🌱',
    tagline: 'Au potager',
    gradient: 'from-lime-300 via-emerald-300 to-green-200',
    accent: 'bg-emerald-500',
    soft: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'mining',
    name: 'Minage',
    emoji: '⛏️',
    tagline: 'Dans les mines',
    gradient: 'from-violet-300 via-purple-300 to-fuchsia-200',
    accent: 'bg-violet-500',
    soft: 'bg-violet-100 text-violet-800',
  },
  {
    id: 'foraging',
    name: 'Cueillette',
    emoji: '🍃',
    tagline: 'Dans les prés et les bois',
    gradient: 'from-amber-200 via-yellow-200 to-lime-200',
    accent: 'bg-amber-500',
    soft: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'digging',
    name: 'Creusage',
    emoji: '🪨',
    tagline: 'Pelle à la main',
    gradient: 'from-orange-300 via-rose-300 to-pink-200',
    accent: 'bg-orange-500',
    soft: 'bg-orange-100 text-orange-800',
  },
]

export const PROFESSIONS_BY_ID = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p])) as Record<
  ProfessionId,
  Profession
>

export function isProfessionId(v: unknown): v is ProfessionId {
  return typeof v === 'string' && v in PROFESSIONS_BY_ID
}
