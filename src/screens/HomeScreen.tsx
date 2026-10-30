import { CHARACTERS, isReleased } from '../data/characters'
import { PROFESSIONS, type ProfessionId } from '../data/professions'
import { hrefFor } from '../lib/router'
import type { Assignments } from '../lib/storage'

export function countByProfession(assignments: Assignments): Record<ProfessionId, number> {
  const counts = Object.fromEntries(PROFESSIONS.map((p) => [p.id, 0])) as Record<ProfessionId, number>
  for (const p of Object.values(assignments)) counts[p]++
  return counts
}

export function HomeScreen({ assignments }: { assignments: Assignments }) {
  const counts = countByProfession(assignments)
  const total = Object.keys(assignments).length
  const released = CHARACTERS.filter((c) => isReleased(c)).length

  return (
    <div className="animate-fade-up">
      <header className="px-1 pt-2 pb-5">
        <p className="text-sm font-semibold tracking-wide text-plum-500">✨ Dreamlight Compagnons</p>
        <h1 className="font-display text-3xl leading-tight font-bold text-plum-900">Qui fait quoi dans ta vallée ?</h1>
        <p className="mt-1 text-sm text-plum-600">
          {total === 0
            ? 'Touche un métier ou va dans Habitants pour attribuer les premiers rôles.'
            : `${total} habitant${total > 1 ? 's' : ''} sur ${released} ont un métier.`}
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3">
        {PROFESSIONS.map((p, i) => (
          <li key={p.id} className={i === 0 ? 'col-span-2' : ''}>
            <a
              href={hrefFor({ name: 'profession', id: p.id })}
              className={`group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${p.gradient} p-4 shadow-lg shadow-plum-900/10 ring-1 ring-white/60 transition active:scale-[0.97] ${
                i === 0 ? 'min-h-36' : 'min-h-40'
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-white/30 blur-xl" />
              <span className="text-5xl drop-shadow-sm transition group-hover:scale-110 group-active:rotate-6" aria-hidden>
                {p.emoji}
              </span>
              <span className="mt-auto pt-3 font-display text-2xl font-bold text-plum-950">{p.name}</span>
              <span className="text-xs font-medium text-plum-900/70">{p.tagline}</span>
              <span
                className="absolute top-3 right-3 grid min-w-9 place-items-center rounded-full bg-white/85 px-2 py-1 font-display text-lg font-bold text-plum-900 shadow-sm"
                aria-label={`${counts[p.id]} habitant${counts[p.id] > 1 ? 's' : ''}`}
                data-testid={`count-${p.id}`}
              >
                {counts[p.id]}
              </span>
            </a>
          </li>
        ))}
        <li className="col-span-2">
          <a
            href={hrefFor({ name: 'characters' })}
            className="flex items-center gap-4 rounded-[1.75rem] border-2 border-dashed border-plum-200 bg-white/60 p-4 text-plum-700 transition active:scale-[0.97]"
          >
            <span className="text-4xl" aria-hidden>🏡</span>
            <span>
              <span className="block font-display text-xl font-bold">Tous les habitants</span>
              <span className="text-xs">Attribuer ou modifier un métier</span>
            </span>
            <span className="ml-auto text-2xl" aria-hidden>›</span>
          </a>
        </li>
      </ul>
    </div>
  )
}
