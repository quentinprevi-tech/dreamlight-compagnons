import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NewerDataError, readEntries } from '../../lib/db'
import { MigrationError, prepareDatabase } from '../../lib/migrations'
import type { LoadError } from '../../lib/useCompanions'
import { createSync, type Sync } from '../../lib/sync'
import { applyTaskOp, emptyTasks, TaskError, type TaskOp, type TasksData } from './model'
import { loadTasks, updateTasks } from './storage'

/** Fréquence de vérification de l'heure (une tâche peut revenir pendant que l'app est ouverte). */
export const CLOCK_TICK_MS = 30_000

export interface TasksState {
  ready: boolean
  /** Le chargement a échoué : l'app doit rester bloquée */
  failure: LoadError | null
  data: TasksData
  /** Heure courante, actualisée régulièrement et au retour sur l'onglet */
  now: Date
  apply: (op: TaskOp) => void
  /** Relit les tâches (après une restauration faite dans cet onglet) */
  reload: () => void
  error: string | null
}

/** Heure courante qui avance toute seule (minuit, remises à zéro UTC…). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, CLOCK_TICK_MS)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return now
}

export function useTasks(): TasksState {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<LoadError | null>(null)
  const [data, setData] = useState<TasksData>(emptyTasks)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const syncRef = useRef<Sync | null>(null)
  const now = useNow()

  const refresh = useCallback(() => {
    if (!loadedRef.current) return
    loadTasks().then(setData, () => setError('Impossible d’actualiser les tâches. Ferme puis rouvre l’app.'))
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = createSync(() => refresh())
    syncRef.current = sync
    prepareDatabase()
      .then(() => loadTasks())
      .then((d) => {
        if (cancelled) return
        setData(d)
        loadedRef.current = true
      })
      .catch(async (err: unknown) => {
        if (cancelled) return
        const readable = await readEntries().then(
          () => true,
          () => false,
        )
        const detail = err instanceof Error ? err.message : String(err)
        if (!cancelled) setFailure({ kind: err instanceof MigrationError ? 'migration' : 'load', detail, readable })
      })
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
      loadedRef.current = false
      sync.close()
      syncRef.current = null
    }
  }, [refresh])

  const apply = useCallback(
    (op: TaskOp) => {
      if (!loadedRef.current) return
      const at = new Date()
      // Affichage immédiat, puis état réellement enregistré (qui inclut les changements des autres onglets).
      setData((prev) => {
        try {
          return applyTaskOp(prev, op, at)
        } catch {
          return prev
        }
      })
      updateTasks(op, at).then(
        (saved) => {
          setError(null)
          setData(saved)
          syncRef.current?.notify('changed')
        },
        (err: unknown) => {
          setError(err instanceof TaskError || err instanceof NewerDataError ? err.message : 'L’enregistrement a échoué. Vérifie l’espace disponible sur le téléphone.')
          refresh()
        },
      )
    },
    [refresh],
  )

  return useMemo(() => ({ ready, failure, data, now, apply, reload: refresh, error }), [ready, failure, data, now, apply, refresh, error])
}
