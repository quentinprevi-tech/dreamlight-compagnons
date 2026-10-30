import { useEffect, useRef, useState } from 'react'
import { COLLECTIONS, isReleased, type Character } from '../data/characters'
import { PROFESSIONS, type ProfessionId } from '../data/professions'
import { toSquareThumbnail } from '../lib/image'
import { sparkleAt } from '../lib/sparkle'
import { Avatar } from './Avatar'

interface Props {
  character: Character
  current?: ProfessionId
  portrait?: string
  onAssign: (p: ProfessionId | null) => void
  onPortrait: (blob: Blob | null) => Promise<void>
  onClose: () => void
}

export function AssignSheet({ character, current, portrait, onAssign, onPortrait, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const collection = COLLECTIONS.find((c) => c.id === character.collection)

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
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button aria-label="Fermer" className="absolute inset-0 animate-fade-in bg-night-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md animate-sheet-up rounded-t-[2rem] bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-plum-200" />
        <div className="flex items-center gap-4">
          <Avatar character={character} portrait={portrait} size="lg" />
          <div className="min-w-0">
            <h2 id="sheet-title" className="font-display text-2xl font-semibold text-plum-900">
              {character.name}
            </h2>
            <p className="text-sm text-plum-600">{character.universe}</p>
            <p className="mt-1 text-xs text-plum-400">{collection?.label}</p>
            {!isReleased(character) && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Bientôt · {new Date(`${character.releaseDate}T12:00:00`).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
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
            📷 {portrait ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
          {portrait && (
            <button onClick={() => void onPortrait(null)} className="rounded-full px-3 py-2 font-semibold text-plum-500 active:scale-95">
              Retirer la photo
            </button>
          )}
          {photoError && <p className="w-full text-rose-600">{photoError}</p>}
        </div>
      </div>
    </div>
  )
}
