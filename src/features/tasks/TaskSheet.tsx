import { BottomSheet } from '../../components/BottomSheet'
import { RESET_STATUS_LABELS, type ResetStatus } from './catalog'
import type { TodayItem } from './model'
import { describeRecurrence, describeWhen, nextReset } from './recurrence'

export const STATUS_STYLE: Record<ResetStatus, string> = {
  official: 'bg-emerald-100 text-emerald-800',
  wiki: 'bg-sky-100 text-sky-800',
  'to-confirm': 'bg-amber-100 text-amber-800',
  unverified: 'bg-plum-100 text-plum-700',
}

interface Props {
  item: TodayItem
  state: 'todo' | 'done' | 'removed'
  now: Date
  onPostpone: () => void
  onRemove: () => void
  onRestore: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

/** Détail d'une tâche : rappel de l'app, remise à zéro du jeu (avec sources) et actions. */
export function TaskSheet({ item, state, now, onPostpone, onRemove, onRestore, onEdit, onDelete, onClose }: Props) {
  const recurring = item.recurrence.kind !== 'once'
  const next = nextReset(item.recurrence, now)
  const reset = item.template?.gameReset
  const action = 'w-full rounded-2xl px-4 py-3 text-left font-semibold transition active:scale-[0.98]'

  return (
    <BottomSheet onClose={onClose} labelledBy="task-title" panelClassName="max-h-[90dvh] overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-plum-200" />
      <h2 id="task-title" className="font-display text-2xl font-semibold text-plum-900">
        {item.label}
      </h2>

      <dl className="mt-3 space-y-2 rounded-2xl bg-plum-50 p-3 text-sm">
        <div>
          <dt className="font-semibold text-plum-800">Rappel dans l’app</dt>
          <dd className="text-plum-700">
            {describeRecurrence(item.recurrence)}
            {next && ` · revient ${describeWhen(next, now)}`}
          </dd>
        </div>
        {reset && (
          <div>
            <dt className="flex items-center gap-2 font-semibold text-plum-800">
              Remise à zéro dans le jeu
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[reset.status]}`}>{RESET_STATUS_LABELS[reset.status]}</span>
            </dt>
            <dd className="text-plum-700">{reset.summary}</dd>
            {reset.sources.length > 0 && (
              <dd className="mt-1 flex flex-wrap gap-x-3 text-xs">
                {reset.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-plum-500 underline">
                    {s.label}
                  </a>
                ))}
              </dd>
            )}
          </div>
        )}
        {item.custom && <dd className="text-xs text-plum-500">Tâche personnalisée</dd>}
        {item.computed && (
          <dd className="text-xs text-plum-500">
            Calculée d’après ton suivi des animaux : elle se met à jour toute seule et ne se coche pas à la main.
          </dd>
        )}
      </dl>

      <div className="mt-4 space-y-2">
        {recurring && state === 'todo' && !item.computed && (
          <button onClick={onPostpone} className={`${action} bg-plum-100 text-plum-800`}>
            ⏳ Reporter <span className="block text-xs font-normal text-plum-600">Elle reste dans « Reportées » jusqu’à ce que tu la fasses ou la supprimes.</span>
          </button>
        )}
        {recurring && state === 'todo' && (
          <button onClick={onRemove} className={`${action} bg-plum-50 text-plum-800`}>
            ➖ Retirer d’aujourd’hui <span className="block text-xs font-normal text-plum-600">Elle reviendra à la prochaine période ; la tâche reste active.</span>
          </button>
        )}
        {recurring && state === 'removed' && (
          <button onClick={onRestore} className={`${action} bg-plum-100 text-plum-800`}>
            ↩️ Remettre dans la liste d’aujourd’hui
          </button>
        )}
        {item.custom && (
          <>
            <button onClick={onEdit} className={`${action} bg-plum-50 text-plum-800`}>
              ✏️ Modifier
            </button>
            <button onClick={onDelete} className={`${action} bg-rose-50 text-rose-700`}>
              🗑️ Supprimer cette tâche
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
