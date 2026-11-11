import { useState } from 'react'
import type { AnigamiType } from './data'
import type { DisplayName } from './display'
import { MAX_COUNT, type TypeUsage } from './model'

interface Props {
  type: AnigamiType
  name: DisplayName
  count: number
  usage: TypeUsage
  onAdjust: (delta: number) => Promise<string | null>
  onSet: (count: number) => Promise<string | null>
  onRename: () => void
}

export function NameBadge({ name }: { name: DisplayName }) {
  if (name.kind === 'custom') return <span className="ml-1.5 text-xs text-plum-500" title="Nom personnalisé">✎</span>
  return <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-amber-800">À confirmer</span>
}

/**
 * Compteur d'un type d'anigami : − / saisie / +. Jamais négatif : « − » est bloqué à 0 et toute saisie
 * négative ou non entière est refusée (rien n'est enregistré).
 */
export function AnigamiRow({ type, name, count, usage, onAdjust, onSet, onRename }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const commit = async () => {
    if (draft === null) return
    const n = Number(draft)
    setDraft(null)
    if (draft.trim() === '' || !Number.isInteger(n)) {
      setError('Entre un nombre entier.')
      return
    }
    setError(await onSet(n))
  }
  const adjust = async (delta: number) => setError(await onAdjust(delta))
  const btn = 'grid size-10 place-items-center rounded-full bg-white text-xl font-bold text-plum-800 shadow-sm ring-1 ring-plum-100 transition active:scale-90 disabled:opacity-40'

  return (
    <li className={`rounded-3xl p-3 ${type.origin === 'quest' ? 'bg-indigo-50 ring-2 ring-indigo-300/70' : 'glass'}`} data-testid={`anigami-${type.id}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <button onClick={onRename} className="text-left" aria-label={`Renommer : ${name.text}`}>
            <span className="font-display text-base leading-tight font-semibold text-plum-900">
              {name.text}
              <NameBadge name={name} />
            </span>
          </button>
          <span className="mt-0.5 block text-xs text-plum-500">
            {usage.needed > 0 ? (
              <>
                Nécessaires pour les puzzles restants : {usage.needed}
                {usage.missing > 0 ? <strong className="text-rose-700"> · manquent {usage.missing}</strong> : <span className="text-emerald-700"> · suffisants</span>}
              </>
            ) : (
              'Aucun puzzle restant ne le demande'
            )}
          </span>
        </div>
        <button onClick={() => void adjust(-1)} disabled={count <= 0} aria-label={`Retirer un : ${name.text}`} className={btn}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_COUNT}
          value={draft ?? String(count)}
          aria-label={`Possédés : ${name.text}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-16 rounded-xl border-0 bg-white py-2 text-center text-base font-semibold text-plum-900 ring-1 ring-plum-200 outline-none focus:ring-2 focus:ring-plum-400"
        />
        <button onClick={() => void adjust(1)} disabled={count >= MAX_COUNT} aria-label={`Ajouter un : ${name.text}`} className={btn}>
          +
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}
    </li>
  )
}
