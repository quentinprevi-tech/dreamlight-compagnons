import { isReleased, type Character } from '../data/characters'
import { PROFESSIONS_BY_ID, type ProfessionId } from '../data/professions'
import { Avatar } from './Avatar'

interface Props {
  character: Character
  profession?: ProfessionId
  portrait?: string
  onClick: () => void
  showProfession?: boolean
}

export function CharacterRow({ character, profession, portrait, onClick, showProfession = true }: Props) {
  const p = profession ? PROFESSIONS_BY_ID[profession] : undefined
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-3xl bg-white/90 p-2.5 pr-3 text-left shadow-sm ring-1 ring-plum-100 transition hover:shadow-md active:scale-[0.98]"
      >
        <Avatar character={character} portrait={portrait} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold text-plum-900">{character.name}</span>
          <span className="block truncate text-xs text-plum-500">
            {character.universe}
            {!isReleased(character) && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">Bientôt</span>}
          </span>
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
