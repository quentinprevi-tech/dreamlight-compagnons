import { CHARACTERS, isReleased } from '../data/characters'
import { PROFESSIONS, type ProfessionId } from '../data/professions'
import { ValleyScene } from '../components/Sky'
import { hrefFor } from '../lib/router'
import { sparkleAt } from '../lib/sparkle'
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
      <header className="relative -mx-4 -mt-4 mb-5 overflow-hidden px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs font-bold tracking-[0.25em] text-gold-300/90 uppercase">✦ Dreamlight Compagnons ✦</p>
        <h1 className="text-gold mt-1 font-magic text-[2rem] leading-tight font-bold">Qui fait quoi dans ta vallée&nbsp;?</h1>
        <p className="mt-2 max-w-[22rem] text-sm text-plum-100/85">
          {total === 0
            ? 'Touche un métier ou va dans Habitants pour confier les premiers rôles.'
            : `${total} habitant${total > 1 ? 's' : ''} sur ${released} ont un métier.`}
        </p>
        <ValleyScene className="mt-2 -mb-1 h-28 w-full animate-float" />
      </header>

      <ul className="grid grid-cols-2 gap-3">
        {PROFESSIONS.map((p, i) => (
          <li key={p.id} className={`animate-fade-up ${i === 0 ? 'col-span-2' : ''}`} style={{ animationDelay: `${80 + i * 60}ms` }}>
            <a
              href={hrefFor({ name: 'profession', id: p.id })}
              onClick={sparkleAt}
              className={`magic-border group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${p.gradient} p-4 transition active:scale-[0.97] ${
                i === 0 ? 'min-h-36' : 'min-h-40'
              }`}
            >
              <span className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-white/40 blur-2xl" />
              <span className="pointer-events-none absolute right-10 bottom-4 text-xs text-white/80" aria-hidden>✦</span>
              <span className="pointer-events-none absolute right-5 bottom-10 text-[10px] text-white/70" aria-hidden>✧</span>
              <span className="text-5xl drop-shadow-md transition group-hover:scale-110 group-active:rotate-6" aria-hidden>
                {p.emoji}
              </span>
              <span className="mt-auto pt-3 font-display text-2xl font-semibold text-plum-950">{p.name}</span>
              <span className="text-xs font-semibold text-plum-900/70">{p.tagline}</span>
              <span
                className="absolute top-3 right-3 grid min-w-9 place-items-center rounded-full bg-night-900/85 px-2 py-1 font-display text-lg font-semibold text-gold-300 shadow-md ring-1 ring-gold-300/50"
                aria-label={`${counts[p.id]} habitant${counts[p.id] > 1 ? 's' : ''}`}
                data-testid={`count-${p.id}`}
              >
                {counts[p.id]}
              </span>
            </a>
          </li>
        ))}
        <li className="col-span-2 animate-fade-up" style={{ animationDelay: '400ms' }}>
          <a
            href={hrefFor({ name: 'characters' })}
            className="flex items-center gap-4 rounded-[1.75rem] border border-gold-300/40 bg-white/10 p-4 text-plum-50 backdrop-blur-sm transition active:scale-[0.97]"
          >
            <span className="text-4xl" aria-hidden>🏰</span>
            <span>
              <span className="block font-display text-xl font-semibold">Tous les habitants</span>
              <span className="text-xs text-plum-100/80">Attribuer ou modifier un métier</span>
            </span>
            <span className="ml-auto text-2xl text-gold-300" aria-hidden>›</span>
          </a>
        </li>
      </ul>
    </div>
  )
}
