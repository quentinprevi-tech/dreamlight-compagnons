import { useMemo, useState } from 'react'
import { ProgressBar } from '../../components/ProgressBar'
import { hrefFor } from '../../lib/router'
import { critterTaskOverride, CRITTERS_TASK_ID } from '../critters/today'
import type { CrittersState } from '../critters/useCritters'
import { sparkleAt } from '../../lib/sparkle'
import { CustomTaskSheet } from './CustomTaskSheet'
import { buildToday, type TodayItem } from './model'
import { describeWhen, nextReset, WEEKDAYS_FR } from './recurrence'
import { TaskSheet } from './TaskSheet'
import type { TasksState } from './useTasks'

interface RowProps {
  label: string
  checked: boolean
  meta?: string
  onToggle: (e: React.MouseEvent) => void
  onMore?: () => void
}

function TaskRow({ label, checked, meta, onToggle, onMore }: RowProps) {
  return (
    <li className={`glass flex items-center gap-3 rounded-3xl p-3 transition ${checked ? 'opacity-70' : ''}`}>
      <button
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={`grid size-9 shrink-0 place-items-center rounded-full text-lg font-bold ring-2 transition active:scale-90 ${
          checked ? 'bg-gold-300 text-night-900 ring-gold-400' : 'bg-white text-transparent ring-plum-200'
        }`}
      >
        ✓
      </button>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold text-plum-900 ${checked ? 'line-through decoration-plum-300' : ''}`}>{label}</span>
        {meta && <span className="block text-xs text-plum-500">{meta}</span>}
      </span>
      {onMore && (
        <button onClick={onMore} aria-label={`Options : ${label}`} className="grid size-9 shrink-0 place-items-center rounded-full text-xl text-plum-500 active:scale-90">
          ⋯
        </button>
      )}
    </li>
  )
}

/** Ligne dont l'état est calculé (ex. animaux à nourrir) : pas de case à cocher, un lien. */
function ComputedRow({ item, onMore }: { item: TodayItem; onMore: () => void }) {
  const computed = item.computed!
  const done = computed.state === 'done'
  return (
    <li className={`glass flex items-center gap-3 rounded-3xl p-3 transition ${done ? 'opacity-70' : ''}`}>
      <a href={computed.href} data-testid="computed-task" className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full text-lg ring-2 ${done ? 'bg-gold-300 font-bold text-night-900 ring-gold-400' : 'bg-white ring-plum-200'}`}
          aria-hidden
        >
          {done ? '✓' : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold text-plum-900 ${done ? 'line-through decoration-plum-300' : ''}`}>{computed.label ?? item.label}</span>
          {computed.meta && <span className="block text-xs text-plum-500">{computed.meta}</span>}
        </span>
        <span className="text-2xl text-plum-400" aria-hidden>
          ›
        </span>
      </a>
      <button onClick={onMore} aria-label={`Options : ${item.label}`} className="grid size-9 shrink-0 place-items-center rounded-full text-xl text-plum-500 active:scale-90">
        ⋯
      </button>
    </li>
  )
}

const longDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

export function TodayScreen({ tasks, critters }: { tasks: TasksState; critters: CrittersState }) {
  const { data, now, apply, error } = tasks
  // « Nourrir les animaux » : une seule ligne agrégée, calculée d'après le suivi des animaux.
  const overrides = useMemo(() => ({ [CRITTERS_TASK_ID]: critterTaskOverride(critters.data, now) }), [critters.data, now])
  const today = useMemo(() => buildToday(data, now, overrides), [data, now, overrides])
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<TodayItem | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)

  const all = [...today.todo.map((i) => ({ i, s: 'todo' as const })), ...today.done.map((i) => ({ i, s: 'done' as const })), ...today.removed.map((i) => ({ i, s: 'removed' as const }))]
  const open = all.find((x) => x.i.key === openKey)
  const maxHistory = Math.max(1, ...today.history.map((h) => h.count))

  const metaFor = (item: TodayItem, done: boolean) => {
    const next = nextReset(item.recurrence, now)
    if (!next) return done ? 'Faite · tâche ponctuelle' : 'Tâche ponctuelle'
    const weekly = item.recurrence.kind === 'weekly' ? `Chaque ${WEEKDAYS_FR[item.recurrence.weekday]} · ` : ''
    return done ? `${weekly}Revient ${describeWhen(next, now)}` : `${weekly}Jusqu’à ${describeWhen(next, now)}`
  }

  return (
    <div className="animate-fade-up space-y-5 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header>
        <p className="text-xs font-bold tracking-[0.2em] text-gold-300/90 uppercase">✦ {longDate(now)} ✦</p>
        <h1 className="text-gold mt-1 font-magic text-3xl font-bold">Aujourd’hui</h1>
        {today.progress.total > 0 ? (
          <div className="mt-3 space-y-1.5">
            <ProgressBar done={today.progress.done} total={today.progress.total} label="Progression de la journée" />
            <p className="text-sm text-plum-100/90" data-testid="today-progress">
              {today.progress.done} tâche{today.progress.done > 1 ? 's' : ''} faite{today.progress.done > 1 ? 's' : ''} sur {today.progress.total}
              {today.progress.done === today.progress.total && ' ✨ Tout est fait !'}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-plum-100/85">Aucune tâche active : choisis-en dans « Gérer les tâches ».</p>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      {today.todo.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 font-display text-lg font-semibold text-gold-200">✦ À faire</h2>
          <ul className="space-y-2" aria-label="À faire">
            {today.todo.map((item) =>
              item.computed ? (
                <ComputedRow key={item.key} item={item} onMore={() => setOpenKey(item.key)} />
              ) : (
              <TaskRow
                key={item.key}
                label={item.label}
                checked={false}
                meta={metaFor(item, false)}
                onToggle={(e) => {
                  sparkleAt(e)
                  apply({ type: 'check', taskId: item.id, done: true })
                }}
                onMore={() => setOpenKey(item.key)}
              />
              ),
            )}
          </ul>
        </section>
      )}

      {today.postponed.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 font-display text-lg font-semibold text-gold-200">⏳ Reportées</h2>
          <ul className="space-y-2" aria-label="Reportées">
            {today.postponed.map((p) => (
              <li key={p.taskId} className="glass flex items-center gap-3 rounded-3xl p-3">
                <button
                  role="checkbox"
                  aria-checked={!!p.doneAt}
                  aria-label={p.label}
                  onClick={() => apply({ type: 'check-postponed', taskId: p.taskId, done: !p.doneAt })}
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-lg font-bold ring-2 transition active:scale-90 ${
                    p.doneAt ? 'bg-gold-300 text-night-900 ring-gold-400' : 'bg-white text-transparent ring-plum-200'
                  }`}
                >
                  ✓
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold text-plum-900 ${p.doneAt ? 'line-through decoration-plum-300' : ''}`}>{p.label}</span>
                  <span className="block text-xs text-plum-500">Reportée le {new Date(p.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                </span>
                <button
                  onClick={() => apply({ type: 'delete-postponed', taskId: p.taskId })}
                  aria-label={`Supprimer de la liste des reportées : ${p.label}`}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-plum-400 active:scale-90"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {today.done.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 font-display text-lg font-semibold text-gold-200">✓ Terminées</h2>
          <ul className="space-y-2" aria-label="Terminées">
            {today.done.map((item) =>
              item.computed ? (
                <ComputedRow key={item.key} item={item} onMore={() => setOpenKey(item.key)} />
              ) : (
                <TaskRow
                  key={item.key}
                  label={item.label}
                  checked
                  meta={metaFor(item, true)}
                  onToggle={() => apply({ type: 'check', taskId: item.id, done: false })}
                  onMore={() => setOpenKey(item.key)}
                />
              ),
            )}
          </ul>
        </section>
      )}

      {today.removed.length > 0 && (
        <section className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/15">
          <button onClick={() => setShowRemoved((v) => !v)} aria-expanded={showRemoved} className="w-full text-left text-sm font-semibold text-plum-100">
            ➖ Retirées d’aujourd’hui ({today.removed.length}) {showRemoved ? '▴' : '▾'}
          </button>
          {showRemoved && (
            <ul className="mt-2 space-y-1.5" aria-label="Retirées d’aujourd’hui">
              {today.removed.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2 text-sm text-plum-50">
                  <span className="min-w-0 truncate">{item.label}</span>
                  <button
                    onClick={() => apply({ type: 'restore', taskId: item.id })}
                    className="shrink-0 rounded-full bg-white/15 px-3 py-1 font-semibold text-gold-200 active:scale-95"
                  >
                    Remettre
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="glass rounded-3xl p-4" aria-label="7 derniers jours">
        <h2 className="font-display text-base font-semibold text-plum-900">📅 Les 7 derniers jours</h2>
        <ol className="mt-3 flex items-end justify-between gap-1.5" data-testid="history">
          {today.history.map((h, i) => {
            const date = new Date(`${h.day}T12:00:00`)
            const isToday = i === today.history.length - 1
            return (
              <li key={h.day} className="flex flex-1 flex-col items-center gap-1" aria-label={`${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} : ${h.count} tâche${h.count > 1 ? 's' : ''}`}>
                <span className="text-xs font-semibold text-plum-700">{h.count}</span>
                <span
                  className={`w-full rounded-full ${isToday ? 'bg-gold-400' : 'bg-plum-300'}`}
                  style={{ height: `${6 + (h.count / maxHistory) * 40}px` }}
                />
                <span className={`text-xs ${isToday ? 'font-bold text-plum-900' : 'text-plum-500'}`}>{WEEKDAYS_FR[date.getDay()].slice(0, 3)}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <a
        href={hrefFor({ name: 'tasks-settings' })}
        className="flex items-center gap-3 rounded-[1.75rem] border border-gold-300/40 bg-white/10 p-4 text-plum-50 backdrop-blur-sm transition active:scale-[0.97]"
      >
        <span className="text-3xl" aria-hidden>
          ⚙️
        </span>
        <span>
          <span className="block font-display text-lg font-semibold">Gérer les tâches</span>
          <span className="text-xs text-plum-100/80">Activer, désactiver, ajouter tes propres tâches</span>
        </span>
        <span className="ml-auto text-2xl text-gold-300" aria-hidden>
          ›
        </span>
      </a>

      {open && (
        <TaskSheet
          item={open.i}
          state={open.s}
          now={now}
          onClose={() => setOpenKey(null)}
          onPostpone={() => {
            apply({ type: 'postpone', taskId: open.i.id })
            setOpenKey(null)
          }}
          onRemove={() => {
            apply({ type: 'remove', taskId: open.i.id })
            setOpenKey(null)
          }}
          onRestore={() => {
            apply({ type: 'restore', taskId: open.i.id })
            setOpenKey(null)
          }}
          onEdit={() => {
            setEditing(open.i)
            setOpenKey(null)
          }}
          onDelete={() => {
            if (confirm(`Supprimer définitivement « ${open.i.label} » ?`)) {
              apply({ type: 'delete-custom', id: open.i.id })
              setOpenKey(null)
            }
          }}
        />
      )}
      {editing?.custom && (
        <CustomTaskSheet
          task={editing.custom}
          onClose={() => setEditing(null)}
          onSave={(label, recurrence) => {
            apply({ type: 'edit-custom', id: editing.custom!.id, label, recurrence })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
