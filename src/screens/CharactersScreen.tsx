import { useMemo, useState } from 'react'
import { CHARACTERS, COLLECTIONS } from '../data/characters'
import { PROFESSIONS, type ProfessionId } from '../data/professions'
import { CharacterRow } from '../components/CharacterRow'
import { FilterChips } from '../components/FilterChips'
import { isUnlocked } from '../features/villagers/model'
import { byName, matchesQuery } from '../lib/search'
import type { Companions } from '../lib/useCompanions'

export type Filter = 'all' | 'unlocked' | 'locked' | 'not-asked' | 'none' | ProfessionId

interface Props {
  companions: Companions
  onOpenCharacter: (id: string) => void
}

export function CharactersScreen({ companions, onOpenCharacter }: Props) {
  const { assignments, villagers, portraits } = companions
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const visible = CHARACTERS.filter((c) => {
      if (!matchesQuery(c, query)) return false
      const unlocked = isUnlocked(villagers, assignments, c.id)
      switch (filter) {
        case 'all':
          return true
        case 'unlocked':
          return unlocked
        case 'locked':
          return !unlocked
        case 'not-asked':
          // On ne peut demander un objet qu'à un habitant présent dans la vallée.
          return unlocked && villagers[c.id]?.askedItem !== true
        case 'none':
          return !assignments[c.id]
        default:
          return assignments[c.id] === filter
      }
    })
    return COLLECTIONS.map((col) => ({
      collection: col,
      items: visible.filter((c) => c.collection === col.id).sort(byName),
    })).filter((g) => g.items.length > 0)
  }, [assignments, villagers, filter, query])

  const count = groups.reduce((n, g) => n + g.items.length, 0)

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'unlocked', label: 'Débloqués' },
    { id: 'locked', label: '🔒 Non débloqués' },
    { id: 'not-asked', label: '🎁 Pas encore demandé' },
    { id: 'none', label: 'Sans métier' },
    ...PROFESSIONS.map((p) => ({ id: p.id, label: `${p.emoji} ${p.name}` })),
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
        <FilterChips label="Filtrer les habitants" chips={chips} value={filter} onChange={setFilter} />
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
                status={{ ...villagers[c.id], unlocked: isUnlocked(villagers, assignments, c.id) }}
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
