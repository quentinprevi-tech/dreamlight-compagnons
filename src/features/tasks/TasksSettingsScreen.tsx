import { useState } from 'react'
import { COLLECTIONS } from '../../data/characters'
import { hrefFor } from '../../lib/router'
import { GROUP_LABELS, RESET_STATUS_LABELS, TASK_TEMPLATES, type TaskGroup, type TaskTemplate } from './catalog'
import { CustomTaskSheet } from './CustomTaskSheet'
import { isEnabled, newCustomId, type CustomTask } from './model'
import { describeRecurrence } from './recurrence'
import { STATUS_STYLE } from './TaskSheet'
import type { TasksState } from './useTasks'

const GROUPS: TaskGroup[] = ['main', 'other', 'dlc']

function collectionLabel(t: TaskTemplate): string | null {
  if (!t.collection || t.collection === 'base') return null
  if (t.collection === 'unknown') return 'Extension à confirmer'
  return COLLECTIONS.find((c) => c.id === t.collection)?.label ?? null
}

/** Catalogue des tâches (activer / désactiver) et tâches personnalisées. */
export function TasksSettingsScreen({ tasks }: { tasks: TasksState }) {
  const { data, apply, error } = tasks
  const [editing, setEditing] = useState<CustomTask | 'new' | null>(null)

  return (
    <div className="animate-fade-up space-y-5 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <a href={hrefFor({ name: 'today' })} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-plum-900 shadow-sm active:scale-95">
        ‹ Aujourd’hui
      </a>
      <div>
        <h1 className="text-gold font-magic text-3xl font-bold">Gérer les tâches</h1>
        <p className="mt-1 text-sm text-plum-100/85">
          Coche les tâches à afficher chaque jour. Désactiver une tâche la retire de « Aujourd’hui » sans rien effacer.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <section className="glass rounded-3xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-plum-900">✏️ Mes tâches</h2>
          <button onClick={() => setEditing('new')} className="rounded-full bg-plum-700 px-4 py-2 text-sm font-semibold text-white active:scale-95">
            + Ajouter
          </button>
        </div>
        {data.custom.length === 0 ? (
          <p className="mt-2 text-sm text-plum-600">Ajoute tes propres tâches, ponctuelles ou récurrentes.</p>
        ) : (
          <ul className="mt-3 space-y-2" aria-label="Mes tâches">
            {data.custom.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-plum-50 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-plum-900">{c.label}</span>
                  <span className="block text-xs text-plum-500">{describeRecurrence(c.recurrence)}</span>
                </span>
                <button onClick={() => setEditing(c)} aria-label={`Modifier : ${c.label}`} className="rounded-full px-2 py-1 text-plum-600 active:scale-90">
                  ✏️
                </button>
                <button
                  onClick={() => confirm(`Supprimer définitivement « ${c.label} » ?`) && apply({ type: 'delete-custom', id: c.id })}
                  aria-label={`Supprimer : ${c.label}`}
                  className="rounded-full px-2 py-1 text-rose-600 active:scale-90"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {GROUPS.map((group) => (
        <section key={group} className="glass rounded-3xl p-4">
          <h2 className="font-display text-lg font-bold text-plum-900">{GROUP_LABELS[group]}</h2>
          <ul className="mt-2 divide-y divide-plum-100" aria-label={GROUP_LABELS[group]}>
            {TASK_TEMPLATES.filter((t) => t.group === group).map((t) => {
              const where = collectionLabel(t)
              return (
                <li key={t.id} className="py-2.5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 accent-plum-700"
                      checked={isEnabled(data, t)}
                      onChange={(e) => apply({ type: 'enable', templateId: t.id, enabled: e.target.checked })}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-plum-900">{t.label}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-plum-500">
                        <span>{describeRecurrence(t.recurrence)}</span>
                        <span className={`rounded-full px-1.5 py-0.5 ${STATUS_STYLE[t.gameReset.status]}`}>Jeu : {RESET_STATUS_LABELS[t.gameReset.status]}</span>
                        {where && <span className="rounded-full bg-plum-100 px-1.5 py-0.5 text-plum-700">{where}</span>}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <p className="px-2 text-center text-xs text-plum-200/80">
        « Jeu » indique si l’heure de remise à zéro dans le jeu est vérifiée. Le détail et les sources sont dans le menu ⋯ de chaque
        tâche, sur l’écran « Aujourd’hui ».
      </p>

      {editing && (
        <CustomTaskSheet
          task={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(label, recurrence) => {
            if (editing === 'new') apply({ type: 'add-custom', id: newCustomId(), label, recurrence })
            else apply({ type: 'edit-custom', id: editing.id, label, recurrence })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
