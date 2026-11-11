import { speciesName, type DisplayName } from './display'
import { describeAvailability, type Availability } from './availability'
import type { CritterVariant } from './data'
import type { CritterProgress } from './model'
import { feedingsLabel } from './thresholds'

const CHIP: Record<Availability['state'], string> = {
  present: 'bg-emerald-100 text-emerald-800',
  later: 'bg-sky-100 text-sky-800',
  passed: 'bg-amber-100 text-amber-800',
  absent: 'bg-plum-100 text-plum-600',
  unknown: 'bg-plum-100 text-plum-700',
}
const ICON: Record<Availability['state'], string> = { present: '🟢', later: '🕐', passed: '⌛', absent: '⛔', unknown: '❔' }

export function AvailabilityChip({ availability }: { availability: Availability }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP[availability.state]}`}>
      <span aria-hidden>{ICON[availability.state]}</span>
      {describeAvailability(availability)}
    </span>
  )
}

export function NameBadge({ name }: { name: DisplayName }) {
  if (name.kind === 'custom') return <span className="ml-1.5 text-xs text-plum-500" title="Nom personnalisé">✎</span>
  if (name.kind === 'to-confirm')
    return <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-amber-800">À confirmer</span>
  return null
}

interface Props {
  variant: CritterVariant
  progress?: CritterProgress
  name: DisplayName
  availability: Availability
  fedToday: boolean
  onOpen: () => void
  onObtained: (value: boolean) => void
  onFeed: () => void
}

/** Ligne d'une variante : obtenue ?, nom, horaire du jour, nourrissage rapide. */
export function CritterRow({ variant, progress, name, availability, fedToday, onOpen, onObtained, onFeed }: Props) {
  const obtained = progress?.obtained === true
  const count = progress?.feedings ?? 0
  const species = speciesName(variant.species)

  return (
    <li className={`glass rounded-3xl p-3 transition ${obtained ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          role="checkbox"
          aria-checked={obtained}
          aria-label={`Obtenu : ${name.text}`}
          onClick={() => onObtained(!obtained)}
          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-lg font-bold ring-2 transition active:scale-90 ${
            obtained ? 'bg-gold-300 text-night-900 ring-gold-400' : 'bg-white text-transparent ring-plum-200'
          }`}
        >
          ✓
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block font-display text-base leading-tight font-semibold text-plum-900">
            {name.text}
            <NameBadge name={name} />
          </span>
          <span className="block truncate text-xs text-plum-500">
            {species.text}
            {variant.area ? ` · ${variant.area}` : ''}
          </span>
          {!obtained && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <AvailabilityChip availability={availability} />
              {variant.condition && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                  {variant.condition === 'quest' ? '📜 Après une quête' : '☁️ Selon la météo'}
                </span>
              )}
              <span className="text-xs font-semibold text-plum-700" aria-label={`Nourrissages comptés : ${feedingsLabel(count, variant.feedings)}`}>
                🐾 {feedingsLabel(count, variant.feedings)}
              </span>
            </span>
          )}
          {obtained && <span className="mt-1 block text-xs font-semibold text-plum-600">Dans ta collection ✨</span>}
        </button>
        {!obtained &&
          (fedToday ? (
            <span className="shrink-0 self-center rounded-full bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">✓ Nourri</span>
          ) : (
            <button
              onClick={onFeed}
              aria-label={`Nourri aujourd’hui : ${name.text}`}
              className="shrink-0 self-center rounded-full bg-plum-700 px-3 py-2 text-sm font-semibold text-white transition active:scale-95"
            >
              🐾 Nourri
            </button>
          ))}
      </div>
    </li>
  )
}
