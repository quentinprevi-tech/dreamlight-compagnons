import { isReleased, type Character } from '../data/characters'
import { PROFESSIONS_BY_ID, type ProfessionId } from '../data/professions'
import { Avatar } from './Avatar'

export interface RowStatus {
  unlocked: boolean
  friendship?: number
  askedItem?: boolean
}

interface Props {
  character: Character
  profession?: ProfessionId
  portrait?: string
  onClick: () => void
  showProfession?: boolean
  /** Suivi de la joueuse (liste Habitants) : non débloqué atténué, amitié, objet demandé */
  status?: RowStatus
}

export function CharacterRow({ character, profession, portrait, onClick, showProfession = true, status }: Props) {
  const p = profession ? PROFESSIONS_BY_ID[profession] : undefined
  const locked = status && !status.unlocked
  return (
    <li>
      <button
        onClick={onClick}
        className={`glass flex w-full items-center gap-3 rounded-3xl p-2.5 pr-3 text-left transition active:scale-[0.98] ${locked ? 'opacity-60' : ''}`}
      >
        <Avatar character={character} portrait={portrait} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-semibold text-plum-900">{character.name}</span>
          <span className="block truncate text-xs text-plum-500">
            {character.universe}
            {!isReleased(character) && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Bientôt</span>}
          </span>
          {status && (
            <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-plum-600">
              {locked ? (
                <span className="rounded-full bg-plum-100 px-1.5 py-0.5">🔒 Non débloqué</span>
              ) : (
                <>
                  {status.friendship !== undefined && (
                    <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-rose-700" aria-label={`Amitié niveau ${status.friendship}`}>
                      ❤️ {status.friendship}
                    </span>
                  )}
                  {status.askedItem && (
                    <span className="rounded-full bg-gold-200 px-1.5 py-0.5 text-plum-800" aria-label="Objet demandé">
                      🎁
                    </span>
                  )}
                </>
              )}
            </span>
          )}
        </span>
        {showProfession &&
          (p ? (
            <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${p.soft}`}>
              <span aria-hidden>{p.emoji}</span>
              {p.name}
            </span>
          ) : (
            <span className="shrink-0 rounded-full border border-dashed border-plum-200 px-2.5 py-1 text-xs text-plum-400">Sans métier</span>
          ))}
      </button>
    </li>
  )
}
