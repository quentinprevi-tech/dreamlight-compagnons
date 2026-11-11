// Les `id` sont enregistrés sur le téléphone : ne jamais les changer, seulement les libellés.
export type ProfessionId =
  | 'fishing'
  | 'gardening'
  | 'mining'
  | 'foraging'
  | 'digging'
  | 'anigami-hunting'
  | 'time-bending'

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
    name: 'Extraction',
    emoji: '⛏️',
    tagline: 'Gemmes et minerais',
    gradient: 'from-violet-300 via-purple-300 to-fuchsia-200',
    accent: 'bg-violet-500',
    soft: 'bg-violet-100 text-violet-800',
  },
  {
    id: 'foraging',
    name: 'Cueillette',
    emoji: '🧺',
    tagline: 'Dans les prés et les bois',
    gradient: 'from-amber-200 via-yellow-200 to-lime-200',
    accent: 'bg-amber-500',
    soft: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'digging',
    name: 'Excavation',
    emoji: '🪏',
    tagline: 'Pelle à la main',
    gradient: 'from-orange-300 via-rose-300 to-pink-200',
    accent: 'bg-orange-500',
    soft: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'anigami-hunting',
    name: 'Chasse aux anigamis',
    emoji: '🦊',
    tagline: 'Sur la piste des anigamis',
    gradient: 'from-rose-300 via-pink-300 to-orange-200',
    accent: 'bg-rose-500',
    soft: 'bg-rose-100 text-rose-800',
  },
  {
    id: 'time-bending',
    name: 'Courbage temporel',
    emoji: '⏳',
    tagline: 'Le temps au creux de la main',
    gradient: 'from-indigo-300 via-blue-300 to-cyan-200',
    accent: 'bg-indigo-500',
    soft: 'bg-indigo-100 text-indigo-800',
  },
]

export const PROFESSIONS_BY_ID = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p])) as Record<
  ProfessionId,
  Profession
>

export function isProfessionId(v: unknown): v is ProfessionId {
  // `Object.hasOwn` et non `in` : « constructor » ou « toString » ne sont pas des métiers.
  return typeof v === 'string' && Object.hasOwn(PROFESSIONS_BY_ID, v)
}
