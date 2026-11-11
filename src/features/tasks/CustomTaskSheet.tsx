import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { isValidLabel, MAX_LABEL, type CustomTask } from './model'
import { MIDNIGHT_LOCAL, WEEKDAYS_FR, type Recurrence, type Weekday } from './recurrence'

type Frequency = 'once' | 'daily' | 'weekly'

interface Props {
  /** Tâche à modifier ; absente pour une création */
  task?: CustomTask
  onSave: (label: string, recurrence: Recurrence) => void
  onClose: () => void
}

/** Création ou modification d'une tâche personnalisée (ponctuelle, quotidienne ou hebdomadaire). */
export function CustomTaskSheet({ task, onSave, onClose }: Props) {
  const [label, setLabel] = useState(task?.label ?? '')
  const [frequency, setFrequency] = useState<Frequency>(task?.recurrence.kind ?? 'daily')
  const [weekday, setWeekday] = useState<Weekday>(task?.recurrence.kind === 'weekly' ? task.recurrence.weekday : 1)
  const valid = isValidLabel(label)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const recurrence: Recurrence =
      frequency === 'once' ? { kind: 'once' } : frequency === 'daily' ? { kind: 'daily', at: MIDNIGHT_LOCAL } : { kind: 'weekly', weekday, at: MIDNIGHT_LOCAL }
    onSave(label, recurrence)
  }

  const choice = (value: Frequency, text: string, hint: string) => (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ${frequency === value ? 'bg-plum-100 ring-2 ring-plum-400' : 'bg-plum-50'}`}>
      <input type="radio" name="frequency" value={value} checked={frequency === value} onChange={() => setFrequency(value)} className="mt-1 size-4 accent-plum-700" />
      <span>
        <span className="block font-semibold text-plum-900">{text}</span>
        <span className="block text-xs text-plum-600">{hint}</span>
      </span>
    </label>
  )

  return (
    <BottomSheet onClose={onClose} labelledBy="custom-title" panelClassName="max-h-[90dvh] overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <h2 id="custom-title" className="font-display text-2xl font-semibold text-plum-900">
        {task ? 'Modifier la tâche' : 'Nouvelle tâche'}
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={MAX_LABEL}
          placeholder="Ex. : Arroser le potager de Rémy"
          aria-label="Nom de la tâche"
          className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 ring-1 ring-plum-200 outline-none focus:ring-2 focus:ring-plum-400"
        />
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-plum-700">Quand revient-elle ?</legend>
          {choice('once', 'Une seule fois', 'Elle reste jusqu’à ce que tu la fasses, puis disparaît.')}
          {choice('daily', 'Chaque jour', 'Elle revient chaque jour à minuit.')}
          {choice('weekly', 'Chaque semaine', 'Elle revient le jour choisi, à minuit.')}
        </fieldset>
        {frequency === 'weekly' && (
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
            aria-label="Jour de la semaine"
            className="w-full rounded-2xl bg-plum-50 px-4 py-3 text-base text-plum-900 ring-1 ring-plum-200"
          >
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <option key={d} value={d}>
                Chaque {WEEKDAYS_FR[d]}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={!valid} className="flex-1 rounded-full bg-plum-700 px-4 py-3 font-semibold text-white active:scale-95 disabled:opacity-50">
            {task ? 'Enregistrer' : 'Ajouter'}
          </button>
          <button type="button" onClick={onClose} className="rounded-full bg-plum-100 px-4 py-3 font-semibold text-plum-800 active:scale-95">
            Annuler
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
