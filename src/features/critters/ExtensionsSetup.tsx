import { useState } from 'react'
import { COLLECTIONS, type CollectionId } from '../../data/characters'
import { CRITTER_DLC, CRITTER_VARIANTS } from './data'

interface Props {
  onConfirm: (owned: Record<string, boolean>) => void
}

const label = (id: CollectionId) => COLLECTIONS.find((c) => c.id === id)?.label ?? id

/**
 * Configuration initiale : quelles extensions la joueuse possède-t-elle ?
 * Rien n'est supposé : tant qu'elle n'a pas validé, seul le jeu de base est affiché et compté.
 * Les animaux d'une extension non cochée ne comptent jamais dans « Aujourd'hui ».
 */
export function ExtensionsSetup({ onConfirm }: Props) {
  const [choice, setChoice] = useState<Record<string, boolean>>(() => Object.fromEntries(CRITTER_DLC.map((c) => [c, false])))
  const chosen = CRITTER_DLC.filter((c) => choice[c]).length

  return (
    <section className="glass mt-3 rounded-3xl p-4" aria-labelledby="ext-setup-title" data-testid="extensions-setup">
      <h2 id="ext-setup-title" className="font-display text-lg font-bold text-plum-900">
        Quelles extensions possèdes-tu ?
      </h2>
      <p className="mt-1 text-sm text-plum-700">
        Le jeu de base est toujours inclus. Les animaux des extensions que tu ne coches pas restent masqués et ne comptent jamais dans « Aujourd’hui ». Tu pourras
        modifier ce choix à tout moment.
      </p>
      <ul className="mt-3 space-y-1" aria-label="Extensions">
        <li>
          <label className="flex items-center gap-3 py-1 text-sm font-semibold text-plum-500">
            <input type="checkbox" className="size-5 accent-plum-700" checked disabled />
            Jeu de base (toujours inclus)
          </label>
        </li>
        {CRITTER_DLC.map((c) => (
          <li key={c}>
            <label className="flex items-center gap-3 py-1 text-sm font-semibold text-plum-800">
              <input type="checkbox" className="size-5 accent-plum-700" checked={choice[c]} onChange={(e) => setChoice({ ...choice, [c]: e.target.checked })} />
              <span>
                {label(c)}
                <span className="ml-1.5 text-xs font-normal text-plum-500">{CRITTER_VARIANTS.filter((v) => v.collection === c).length} animaux</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setChoice(Object.fromEntries(CRITTER_DLC.map((c) => [c, true])))}
          className="rounded-full bg-plum-100 px-4 py-2 text-sm font-semibold text-plum-800 active:scale-95"
        >
          Tout sélectionner
        </button>
        <button onClick={() => onConfirm(choice)} className="rounded-full bg-plum-700 px-4 py-2 text-sm font-semibold text-white active:scale-95">
          {chosen === 0 ? 'Valider : jeu de base seulement' : 'Valider mes choix'}
        </button>
      </div>
    </section>
  )
}
