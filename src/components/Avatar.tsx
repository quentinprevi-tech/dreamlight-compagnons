import { useState } from 'react'
import type { Character } from '../data/characters'
import { wikiPortrait } from '../data/portraits'

// Dégradés doux attribués à chaque univers, pour reconnaître les familles d'un coup d'œil.
const PALETTE = [
  'from-pink-300 to-rose-400',
  'from-violet-300 to-indigo-400',
  'from-sky-300 to-blue-400',
  'from-teal-300 to-emerald-400',
  'from-amber-200 to-orange-400',
  'from-fuchsia-300 to-purple-400',
  'from-lime-300 to-green-400',
  'from-cyan-200 to-sky-400',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function initials(name: string): string {
  const words = name
    .replace(/^(Le|La|Les|L’|L')\s*/i, '')
    .split(/[\s-]+/)
    .filter((w) => /^[\p{L}\d]/u.test(w) && !/^(l’|d’|de|du|la|le)$/i.test(w))
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2)
  return letters.toUpperCase()
}

interface Props {
  character: Character
  portrait?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'size-11 text-sm',
  md: 'size-14 text-base',
  lg: 'size-28 text-3xl',
}

export function Avatar({ character, portrait, size = 'md' }: Props) {
  const base = `${SIZES[size]} shrink-0 rounded-full ring-2 ring-gold-300/80 shadow-md overflow-hidden`
  const [failed, setFailed] = useState<string | null>(null)
  const src = portrait ?? wikiPortrait(character.nameEn)
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={character.name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={`${base} bg-gradient-to-b from-plum-100 to-plum-200 object-cover object-top`}
      />
    )
  }
  const gradient = PALETTE[hash(character.universe) % PALETTE.length]
  return (
    <div
      role="img"
      aria-label={`${character.name} (pas de portrait)`}
      className={`${base} grid place-items-center bg-gradient-to-br ${gradient} font-display font-semibold text-white`}
    >
      <span className="drop-shadow-sm">{initials(character.name)}</span>
    </div>
  )
}
