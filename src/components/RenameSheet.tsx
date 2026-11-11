import { useState } from 'react'
import { MAX_NAME_LENGTH } from '../lib/names'
import { BottomSheet } from './BottomSheet'

interface Props {
  title: string
  /** Nom du catalogue (français du wiki ou anglais) */
  officialName: string
  /** D'où vient le nom du catalogue (« d'après le wiki », « à confirmer »…) */
  officialNote: string
  /** Nom personnalisé actuel */
  value?: string
  onSave: (name: string | null) => void
  onClose: () => void
}

/**
 * Donne un nom personnalisé à un élément. Ce nom est à la joueuse : il reste dans ses données
 * et ses sauvegardes, et ne remplace jamais le nom du catalogue (ni ne devient une traduction officielle).
 */
export function RenameSheet({ title, officialName, officialNote, value, onSave, onClose }: Props) {
  const [text, setText] = useState(value ?? '')
  const valid = text.trim().length > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (valid) onSave(text)
  }

  return (
    <BottomSheet onClose={onClose} labelledBy="rename-title" panelClassName="bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <h2 id="rename-title" className="font-display text-2xl font-semibold text-plum-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-plum-600">
        Nom du catalogue : <strong>{officialName}</strong> ({officialNote}).
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          aria-label="Mon nom"
          placeholder="Le nom que tu vois dans ton jeu"
          className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 ring-1 ring-plum-200 outline-none focus:ring-2 focus:ring-plum-400"
        />
        <p className="text-xs text-plum-500">Ton nom reste dans tes données et tes sauvegardes. Il ne remplace pas le nom du catalogue.</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!valid} className="flex-1 rounded-full bg-plum-700 px-4 py-3 font-semibold text-white active:scale-95 disabled:opacity-50">
            Enregistrer
          </button>
          {value && (
            <button type="button" onClick={() => onSave(null)} className="rounded-full bg-rose-50 px-4 py-3 font-semibold text-rose-700 active:scale-95">
              Retirer mon nom
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full bg-plum-100 px-4 py-3 font-semibold text-plum-800 active:scale-95">
            Annuler
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
