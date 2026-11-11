import { useRef, useState } from 'react'
import { COLLECTIONS, isReleased, type Character } from '../data/characters'
import { PROFESSIONS, type ProfessionId } from '../data/professions'
import { toSquareThumbnail } from '../lib/image'
import { sparkleAt } from '../lib/sparkle'
import { FRIENDSHIP_MAX, FRIENDSHIP_MIN, formatFriendship, type VillagerPatch, type VillagerState } from '../features/villagers/model'
import { Avatar } from './Avatar'
import { BottomSheet } from './BottomSheet'
import { Stepper } from './Stepper'

interface Props {
  character: Character
  current?: ProfessionId
  portrait?: string
  /** Suivi saisi par la joueuse */
  villager: VillagerState
  /** Débloqué tel qu'affiché (coché, ou implicite avec un métier) */
  unlocked: boolean
  onVillager: (patch: VillagerPatch) => void
  onAssign: (p: ProfessionId | null) => void
  onPortrait: (blob: Blob | null) => Promise<void>
  onClose: () => void
}

export function AssignSheet({ character, current, portrait, villager, unlocked, onVillager, onAssign, onPortrait, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const collection = COLLECTIONS.find((c) => c.id === character.collection)
  const released = isReleased(character)
  const lockReason = current
    ? 'Il a un métier : il est forcément débloqué.'
    : !released
      ? 'Pas encore sorti dans le jeu.'
      : null

  const pick = (p: ProfessionId | null) => {
    onAssign(p)
    onClose()
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPhotoError(null)
      await onPortrait(await toSquareThumbnail(file))
    } catch {
      setPhotoError('Cette image n’a pas pu être utilisée.')
    }
  }

  return (
    <BottomSheet onClose={onClose} labelledBy="sheet-title" panelClassName="bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-plum-200" />
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label={portrait ? 'Changer la photo' : 'Choisir ma propre photo'}
          className="relative shrink-0 rounded-full active:scale-95"
        >
          <Avatar character={character} portrait={portrait} size="lg" />
          <span className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-full bg-gold-300 text-lg shadow-md ring-2 ring-white" aria-hidden>
            📷
          </span>
        </button>
        <div className="min-w-0">
          <h2 id="sheet-title" className="font-display text-2xl font-semibold text-plum-900">
            {character.name}
          </h2>
          <p className="text-sm text-plum-600">{character.universe}</p>
          <p className="mt-1 text-xs text-plum-400">{collection?.label}</p>
          {!released && (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Bientôt · {new Date(`${character.releaseDate}T12:00:00`).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl bg-plum-50 p-3" role="group" aria-label="Suivi dans ta partie">
        <label className="flex items-center gap-3 text-sm font-semibold text-plum-800">
          <input
            type="checkbox"
            className="size-5 accent-plum-700"
            checked={unlocked}
            disabled={lockReason !== null}
            onChange={(e) => onVillager({ unlocked: e.target.checked })}
          />
          Débloqué dans ma partie
        </label>
        {lockReason && <p className="-mt-2 pl-8 text-xs text-plum-500">{lockReason}</p>}

        <label className={`flex items-center gap-3 text-sm font-semibold ${unlocked ? 'text-plum-800' : 'text-plum-400'}`}>
          <input
            type="checkbox"
            className="size-5 accent-plum-700"
            checked={villager.askedItem === true}
            disabled={!unlocked}
            onChange={(e) => onVillager({ askedItem: e.target.checked })}
          />
          Objet déjà demandé
        </label>

        <div className={`flex items-center justify-between gap-2 ${unlocked ? '' : 'opacity-60'}`}>
          <span className="text-sm font-semibold text-plum-800">
            <span aria-hidden>❤️</span> Amitié
          </span>
          <Stepper
            label="Niveau d’amitié"
            value={villager.friendship}
            min={FRIENDSHIP_MIN}
            max={FRIENDSHIP_MAX}
            disabled={!unlocked}
            format={formatFriendship}
            onChange={(v) => onVillager({ friendship: v ?? null })}
          />
        </div>
        {!unlocked && <p className="text-xs text-plum-500">Débloque l’habitant pour suivre son amitié et tes demandes d’objets.</p>}
      </div>

      <p className="mt-5 mb-2 text-sm font-semibold text-plum-700">Son métier dans ta partie</p>
      <div className="grid grid-cols-2 gap-2">
        {PROFESSIONS.map((p) => {
          const active = current === p.id
          return (
            <button
              key={p.id}
              onClick={(e) => {
                sparkleAt(e)
                pick(p.id)
              }}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left font-semibold transition active:scale-95 ${
                active ? `bg-gradient-to-br ${p.gradient} text-plum-950 ring-2 ring-plum-500` : 'bg-plum-50 text-plum-800 hover:bg-plum-100'
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {p.emoji}
              </span>
              {p.name}
              {active && <span className="ml-auto text-plum-700" aria-hidden>✓</span>}
            </button>
          )
        })}
        <button
          onClick={() => pick(null)}
          disabled={!current}
          className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-plum-200 px-3 py-3 font-semibold text-plum-500 transition active:scale-95 disabled:opacity-40"
        >
          <span className="text-xl" aria-hidden>✕</span>
          Aucun métier
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-plum-100 pt-4 text-sm">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="portrait-input" />
        <button onClick={() => fileRef.current?.click()} className="rounded-full bg-plum-100 px-3 py-2 font-semibold text-plum-800 active:scale-95">
          📷 {portrait ? 'Changer ma photo' : 'Mettre ma propre photo'}
        </button>
        {portrait && (
          <button onClick={() => void onPortrait(null)} className="rounded-full px-3 py-2 font-semibold text-plum-500 active:scale-95">
            Retirer ma photo
          </button>
        )}
        {photoError && <p className="w-full text-rose-600">{photoError}</p>}
      </div>
    </BottomSheet>
  )
}
