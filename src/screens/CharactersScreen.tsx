import { useMemo, useState } from 'react'
import { CHARACTERS, COLLECTIONS } from '../data/characters'
import { PROFESSIONS, type ProfessionId } from '../data/professions'
import { CharacterRow } from '../components/CharacterRow'
import { byName, matchesQuery } from '../lib/search'
import type { Companions } from '../lib/useCompanions'

export type Filter = 'all' | 'none' | ProfessionId

interface Props {
  companions: Companions
  onOpenCharacter: (id: string) => void
}

export function CharactersScreen({ companions, onOpenCharacter }: Props) {
  const { assignments, portraits } = companions
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const visible = CHARACTERS.filter((c) => {
      if (!matchesQuery(c, query)) return false
      if (filter === 'all') return true
      if (filter === 'none') return !assignments[c.id]
      return assignments[c.id] === filter
    })
    return COLLECTIONS.map((col) => ({
      collection: col,
      items: visible.filter((c) => c.collection === col.id).sort(byName),
    })).filter((g) => g.items.length > 0)
  }, [assignments, filter, query])

  const count = groups.reduce((n, g) => n + g.items.length, 0)

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    ...PROFESSIONS.map((p) => ({ id: p.id, label: `${p.emoji} ${p.name}` })),
    { id: 'none', label: 'Sans métier' },
  ]

  return (
    <div className="animate-fade-up">
      <div className="sticky top-0 z-20 -mx-4 bg-night-900/80 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
        <h1 className="text-gold font-magic text-3xl font-bold">Habitants</h1>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par nom…"
          aria-label="Rechercher par nom"
          className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 shadow-sm ring-1 ring-gold-300/40 outline-none placeholder:text-plum-300 focus:ring-2 focus:ring-gold-400"
        />
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrer par métier">
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              aria-pressed={filter === chip.id}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
                filter === chip.id ? 'bg-gold-300 text-night-900 shadow-[0_0_12px_rgb(255_214_107/0.6)]' : 'bg-white/10 text-plum-50 ring-1 ring-white/20'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 mb-1 text-xs text-plum-200/80" aria-live="polite">
        {count} habitant{count > 1 ? 's' : ''}
      </p>

      {groups.map(({ collection, items }) => (
        <section key={collection.id} className="mt-4">
          <h2 className="mb-2 flex items-baseline gap-2 px-1">
            <span className="font-display text-lg font-semibold text-gold-200">✦ {collection.label}</span>
            {collection.paid && <span className="text-xs text-plum-200/70">payant</span>}
          </h2>
          <ul className="space-y-2">
            {items.map((c) => (
              <CharacterRow
                key={c.id}
                character={c}
                profession={assignments[c.id]}
                portrait={portraits[c.id]}
                onClick={() => onOpenCharacter(c.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      {count === 0 && (
        <div className="mt-8 text-center text-plum-100/80">
          <p className="text-4xl" aria-hidden>🔍</p>
          <p className="mt-2">Aucun habitant ne correspond.</p>
        </div>
      )}
    </div>
  )
}
