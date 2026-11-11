import { useState } from 'react'
import { CHARACTERS } from '../data/characters'
import { PROFESSIONS_BY_ID, type ProfessionId } from '../data/professions'
import { CharacterRow } from '../components/CharacterRow'
import { PickerSheet } from '../components/PickerSheet'
import { byName } from '../lib/search'
import type { Companions } from '../lib/useCompanions'

interface Props {
  professionId: ProfessionId
  companions: Companions
  onOpenCharacter: (id: string) => void
}

export function ProfessionScreen({ professionId, companions, onOpenCharacter }: Props) {
  const p = PROFESSIONS_BY_ID[professionId]
  const { assignments, portraits, assign } = companions
  const [picking, setPicking] = useState(false)
  const members = CHARACTERS.filter((c) => assignments[c.id] === professionId).sort(byName)

  return (
    <div className="animate-fade-up">
      <header className={`relative -mx-4 -mt-4 mb-5 overflow-hidden rounded-b-[2.5rem] bg-gradient-to-br ${p.gradient} px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-6 shadow-lg shadow-plum-900/10`}>
        <span className="pointer-events-none absolute -right-8 -bottom-10 text-[9rem] opacity-25 select-none" aria-hidden>
          {p.emoji}
        </span>
        <a href="#/metiers" className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-plum-900 shadow-sm active:scale-95">
          ‹ Métiers
        </a>
        <h1 className="mt-4 font-magic text-4xl font-bold text-plum-950 drop-shadow-[0_1px_0_rgb(255_255_255/0.6)]">
          <span aria-hidden>{p.emoji}</span> {p.name}
        </h1>
        <p className="text-sm font-medium text-plum-900/75">
          {members.length === 0 ? 'Personne pour l’instant' : `${members.length} habitant${members.length > 1 ? 's' : ''}`}
        </p>
      </header>

      {members.length === 0 ? (
        <div className="glass rounded-3xl p-6 text-center">
          <p className="text-4xl" aria-hidden>🌙</p>
          <p className="mt-2 font-display text-lg font-bold text-plum-900">Aucun habitant n’a ce métier</p>
          <p className="mt-1 text-sm text-plum-600">Ajoute ceux à qui tu l’as confié dans ta partie.</p>
        </div>
      ) : (
        <ul className="space-y-2" aria-label={`Habitants : ${p.name}`}>
          {members.map((c) => (
            <CharacterRow
              key={c.id}
              character={c}
              portrait={portraits[c.id]}
              profession={professionId}
              showProfession={false}
              onClick={() => onOpenCharacter(c.id)}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setPicking(true)}
        className="magic-border mt-4 w-full rounded-full bg-gradient-to-r from-gold-300 via-gold-200 to-gold-400 px-5 py-3.5 font-display text-lg font-semibold text-night-900 transition active:scale-[0.97]"
      >
        + Ajouter des habitants
      </button>

      {picking && (
        <PickerSheet
          profession={p}
          assignments={assignments}
          portraits={portraits}
          onPick={(id) => assign(id, professionId)}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
