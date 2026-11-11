import { BottomSheet } from '../../components/BottomSheet'
import { Stepper } from '../../components/Stepper'
import { COLLECTIONS } from '../../data/characters'
import type { CustomNames } from '../../lib/names'
import { localDayKey, WEEKDAYS_FR } from '../tasks/recurrence'
import { availabilityAt, formatWindows, windowsOn } from './availability'
import { BIOME_BY_ID, CONDITION_TEXT, CRITTERS_SOURCE, CRITTERS_VERIFIED_AT, type CritterVariant } from './data'
import { biomeName, NAME_KIND_LABEL, speciesName, variantName } from './display'
import { MAX_FEEDINGS, type CritterProgress } from './model'
import { AvailabilityChip } from './CritterRow'
import { OBTAINED_RULE, feedingsLabel, reachedMessage, thresholdChip, thresholdExplanation, thresholdKind } from './thresholds'

interface Props {
  variant: CritterVariant
  progress?: CritterProgress
  names: CustomNames
  now: Date
  onFeed: () => void
  onUnfeed: () => void
  onObtained: (value: boolean) => void
  onSetFeedings: (count: number) => void
  onRename: () => void
  onClose: () => void
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dayText = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR')

const KIND_STYLE = { exact: 'bg-emerald-100 text-emerald-800', 'at-least': 'bg-amber-100 text-amber-800', unknown: 'bg-plum-100 text-plum-700' } as const

/** Détail d'une variante : noms, lieu, horaire, nourrissages, obtenu. */
export function CritterSheet({ variant, progress, names, now, onFeed, onUnfeed, onObtained, onSetFeedings, onRename, onClose }: Props) {
  const name = variantName(variant, names)
  const species = speciesName(variant.species)
  const biome = BIOME_BY_ID[variant.biome]
  const biomeLabel = biomeName(biome, names)
  const availability = availabilityAt(variant, now)
  const collection = COLLECTIONS.find((c) => c.id === variant.collection)
  const obtained = progress?.obtained === true
  const count = progress?.feedings ?? 0
  const fedToday = progress?.lastFed === localDayKey(now)
  const kind = thresholdKind(variant.feedings)
  const reached = obtained ? null : reachedMessage(variant.feedings, count)
  const action = 'w-full rounded-2xl px-4 py-3 text-left font-semibold transition active:scale-[0.98] disabled:opacity-50'

  return (
    <BottomSheet
      onClose={onClose}
      labelledBy="critter-title"
      panelClassName="max-h-[90dvh] overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <h2 id="critter-title" className="font-display text-2xl font-semibold text-plum-900">
        {name.text}
      </h2>
      <p className="text-sm text-plum-600">
        {variant.nameEn !== name.text && <>{variant.nameEn} · </>}
        {NAME_KIND_LABEL[name.kind]}
      </p>
      <button onClick={onRename} className="mt-2 rounded-full bg-plum-100 px-3 py-1.5 text-sm font-semibold text-plum-800 active:scale-95">
        ✎ {names[`critter:${variant.id}`] ? 'Modifier mon nom' : 'Mon nom'}
      </button>

      <dl className="mt-4 space-y-1 rounded-2xl bg-plum-50 p-3 text-sm text-plum-700">
        <div>
          <dt className="inline font-semibold text-plum-800">Espèce : </dt>
          <dd className="inline">
            {species.text}
            {species.kind === 'to-confirm' && ' (nom français à confirmer)'}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-plum-800">Biome : </dt>
          <dd className="inline">
            {biomeLabel.text}
            {biomeLabel.kind === 'to-confirm' && ' (nom français à confirmer)'}
            {variant.area && ` · zone ${variant.area}`}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-plum-800">Extension : </dt>
          <dd className="inline">{collection?.label ?? '—'}</dd>
        </div>
      </dl>

      {!obtained && (
        <section className="mt-4" aria-label="Aujourd’hui">
          <h3 className="font-semibold text-plum-800">Aujourd’hui</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <AvailabilityChip availability={availability} />
          </div>
          {variant.condition && <p className="mt-1 text-xs text-indigo-800">{CONDITION_TEXT[variant.condition]} Cette variante n’est pas comptée dans « Aujourd’hui ».</p>}
          <p className="mt-1 text-xs text-plum-500">« Présent selon l’horaire » est l’horaire annoncé (heure de ton téléphone) : l’animal n’apparaît pas forcément.</p>
        </section>
      )}

      <section className="mt-4" aria-label="Nourrissages">
        <h3 className="font-semibold text-plum-800">Nourrissages</h3>
        <p className="mt-1 text-sm text-plum-700">
          Comptés : <strong data-testid="critter-count">{feedingsLabel(count, variant.feedings)}</strong>
          {progress?.lastFed && <> · dernier : {dayText(progress.lastFed)}</>}
        </p>
        <p className="mt-2">
          <span data-testid="threshold-chip" className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${KIND_STYLE[kind]}`}>
            {thresholdChip(variant.feedings)}
          </span>
        </p>
        <p className="mt-1 text-xs text-plum-600" data-testid="threshold-explanation">
          {thresholdExplanation(variant.feedings)}
        </p>
        <p className="mt-1 text-xs text-plum-500">
          Un seul nourrissage réussi par jour compte (remise à zéro à minuit, heure locale). Ne le compte que si l’animal a accepté un aliment préféré ou apprécié.
        </p>
        {reached && (
          <p className="mt-2 rounded-xl bg-gold-200/70 p-2 text-sm text-plum-800" data-testid="threshold-reached">
            {reached}
          </p>
        )}
        <p className="mt-1 text-xs text-plum-500">{OBTAINED_RULE}</p>
        {!obtained && (
          <div className="mt-3 space-y-2">
            {fedToday ? (
              <button onClick={onUnfeed} className={`${action} bg-plum-100 text-plum-800`}>
                ↩️ Annuler le nourrissage d’aujourd’hui
              </button>
            ) : (
              <button onClick={onFeed} className={`${action} bg-plum-700 text-white`}>
                🐾 Nourri aujourd’hui
              </button>
            )}
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-plum-50 p-2 pl-3">
              <span className="text-sm font-semibold text-plum-800">Corriger le total</span>
              <Stepper
                label="Total des nourrissages"
                value={count || undefined}
                min={1}
                max={MAX_FEEDINGS}
                format={(v) => `${v ?? 0}`}
                onChange={(v) => onSetFeedings(v ?? 0)}
              />
            </div>
          </div>
        )}
      </section>

      <label className="mt-4 flex items-center gap-3 rounded-2xl bg-plum-50 p-3 text-sm font-semibold text-plum-800">
        <input type="checkbox" className="size-5 accent-plum-700" checked={obtained} onChange={(e) => onObtained(e.target.checked)} />
        Obtenu (dans ma collection)
      </label>

      <section className="mt-4" aria-label="Horaires de la semaine">
        <h3 className="font-semibold text-plum-800">Horaires (heure locale)</h3>
        {variant.schedule.status === 'known' ? (
          <ul className="mt-1 text-sm text-plum-700">
            {WEEK_ORDER.map((d) => (
              <li key={d} className={`flex justify-between gap-3 py-0.5 ${d === now.getDay() ? 'font-bold text-plum-900' : ''}`}>
                <span>{cap(WEEKDAYS_FR[d])}</span>
                <span>{formatWindows(windowsOn(variant, d) ?? [])}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-amber-800">{variant.schedule.note ?? 'Horaire inconnu.'}</p>
        )}
      </section>

      <p className="mt-4 text-xs text-plum-500">
        Données : Dreamlight Valley Wiki, vérifiées le {dayText(CRITTERS_VERIFIED_AT)} —{' '}
        <a href={variant.wikiUrl} target="_blank" rel="noreferrer" className="underline">
          fiche de la variante
        </a>
        ,{' '}
        <a href={CRITTERS_SOURCE} target="_blank" rel="noreferrer" className="underline">
          tableau des horaires
        </a>
        .
      </p>
    </BottomSheet>
  )
}
