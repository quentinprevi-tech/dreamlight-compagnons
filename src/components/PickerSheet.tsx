import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import { CHARACTERS } from '../data/characters'
import type { Profession } from '../data/professions'
import { byName, matchesQuery } from '../lib/search'
import type { Assignments } from '../lib/storage'
import { CharacterRow } from './CharacterRow'

interface Props {
  profession: Profession
  assignments: Assignments
  portraits: Record<string, string>
  onPick: (characterId: string) => void
  onClose: () => void
}

/** Ajout rapide d'habitants à un métier, depuis l'écran du métier. */
export function PickerSheet({ profession, assignments, portraits, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const candidates = useMemo(
    () =>
      CHARACTERS.filter((c) => assignments[c.id] !== profession.id && matchesQuery(c, query)).sort((a, b) => {
        // Les habitants sans métier d'abord : ce sont les plus probables.
        const free = Number(!!assignments[a.id]) - Number(!!assignments[b.id])
        return free || byName(a, b)
      }),
    [assignments, profession.id, query],
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Ajouter à ${profession.name}`}>
      <button aria-label="Fermer" className="absolute inset-0 animate-fade-in bg-night-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[85dvh] w-full max-w-md animate-sheet-up flex-col rounded-t-[2rem] bg-plum-50 shadow-2xl">
        <div className="px-5 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-plum-200" />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-plum-900">
              {profession.emoji} Ajouter à {profession.name}
            </h2>
            <button onClick={onClose} className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-plum-700 shadow-sm">
              Terminé
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un habitant…"
            aria-label="Rechercher un habitant à ajouter"
            className="mt-3 w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 shadow-sm ring-1 ring-plum-100 outline-none placeholder:text-plum-300 focus:ring-2 focus:ring-plum-400"
          />
          <p className="mt-2 text-xs text-plum-500">Un habitant qui a déjà un autre métier en changera.</p>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {candidates.map((c) => (
            <CharacterRow
              key={c.id}
              character={c}
              profession={assignments[c.id]}
              portrait={portraits[c.id]}
              onClick={() => onPick(c.id)}
            />
          ))}
          {candidates.length === 0 && <li className="py-8 text-center text-plum-500">Aucun habitant trouvé.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
