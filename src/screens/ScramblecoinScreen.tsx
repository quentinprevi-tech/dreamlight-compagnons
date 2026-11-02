import { useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import {
  LEVEL_INFO,
  SCRAMBLECOIN_NOTES,
  SCRAMBLECOIN_SOURCE,
  SCRAMBLECOIN_VERIFIED_AT,
  figurineName,
  scramblecoinCharacters,
  type ScramblecoinLevel,
} from '../data/scramblecoin'
import { byName, matchesQuery } from '../lib/search'

export type LevelFilter = 'all' | ScramblecoinLevel

const LEVELS: ScramblecoinLevel[] = [1, 2, 3]

function Stars({ level }: { level: ScramblecoinLevel }) {
  return (
    <span aria-hidden className="tracking-tight text-gold-500">
      {'★'.repeat(level)}
      <span className="text-plum-200">{'★'.repeat(3 - level)}</span>
    </span>
  )
}

export function ScramblecoinScreen({ portraits }: { portraits: Record<string, string> }) {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const all = useMemo(() => scramblecoinCharacters().sort(byName), [])
  const counts = useMemo(() => {
    const c = { 1: 0, 2: 0, 3: 0 } as Record<ScramblecoinLevel, number>
    for (const ch of all) c[ch.level]++
    return c
  }, [all])
  const visible = all.filter((c) => (level === 'all' || c.level === level) && matchesQuery(c, query))

  const chips: { id: LevelFilter; label: string }[] = [
    { id: 'all', label: `Tous (${all.length})` },
    ...LEVELS.map((l) => ({ id: l, label: `${'★'.repeat(l)} ${LEVEL_INFO[l].hint} (${counts[l]})` })),
  ]

  return (
    <div className="animate-fade-up">
      <div className="sticky top-0 z-20 -mx-4 bg-night-900/80 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
        <h1 className="text-gold font-magic text-3xl font-bold">Numismagie</h1>
        <p className="text-xs text-plum-100/80">Le niveau de chaque habitant au Scramblecoin, pour choisir contre qui jouer.</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un adversaire…"
          aria-label="Rechercher un adversaire"
          className="mt-2 w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 shadow-sm ring-1 ring-gold-300/40 outline-none placeholder:text-plum-300 focus:ring-2 focus:ring-gold-400"
        />
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filtrer par niveau">
          {chips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => setLevel(chip.id)}
              aria-pressed={level === chip.id}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
                level === chip.id ? 'bg-gold-300 text-night-900 shadow-[0_0_12px_rgb(255_214_107/0.6)]' : 'bg-white/10 text-plum-50 ring-1 ring-white/20'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 mb-3 text-xs text-plum-200/80" aria-live="polite" data-testid="scramble-count">
        {visible.length} adversaire{visible.length > 1 ? 's' : ''} sur {all.length} recensés
      </p>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-label="Adversaires de Numismagie">
        {visible.map((c) => {
          const info = LEVEL_INFO[c.level]
          const open = openId === c.id
          return (
            <li key={c.id} className={open ? 'col-span-2 md:col-span-3' : ''}>
              <button
                onClick={() => setOpenId(open ? null : c.id)}
                aria-expanded={open}
                className={`glass flex w-full flex-col items-center gap-1.5 rounded-3xl p-3 text-center ring-2 transition active:scale-[0.98] ${info.ring}`}
              >
                <Avatar character={c} portrait={portraits[c.id]} />
                <span className="w-full truncate font-display text-base font-semibold text-plum-900">{c.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${info.badge}`}>
                  {info.label} · {info.hint}
                </span>
                <Stars level={c.level} />
                {open && (
                  <span className="mt-1 w-full border-t border-plum-100 pt-2 text-left text-sm text-plum-700">
                    <span className="block font-semibold text-plum-900">Ses 5 figurines</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {c.lineup.map((f, i) => (
                        <span key={i} className="rounded-full bg-plum-100 px-2 py-0.5 text-xs font-semibold text-plum-800">
                          {figurineName(f)}
                        </span>
                      ))}
                    </span>
                    {SCRAMBLECOIN_NOTES[c.id] && <span className="mt-2 block text-xs text-amber-700">⚠️ {SCRAMBLECOIN_NOTES[c.id]}</span>}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 && (
        <div className="mt-8 text-center text-plum-100/80">
          <p className="text-4xl" aria-hidden>🪙</p>
          <p className="mt-2">Aucun adversaire ne correspond.</p>
        </div>
      )}

      <p className="mt-6 px-1 text-center text-xs text-plum-200/70">
        Niveaux fixes du jeu (différents du niveau d’amitié), relevés le{' '}
        {new Date(`${SCRAMBLECOIN_VERIFIED_AT}T12:00:00`).toLocaleDateString('fr-FR')} sur le{' '}
        <a href={SCRAMBLECOIN_SOURCE} target="_blank" rel="noreferrer" className="underline">
          Dreamlight Valley Wiki
        </a>
        . Les habitants pas encore sortis n’ont pas de niveau connu.
      </p>
    </div>
  )
}
