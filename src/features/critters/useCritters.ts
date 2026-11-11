import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readEntries } from '../../lib/db'
import { MigrationError, prepareDatabase } from '../../lib/migrations'
import { createSync, type Sync } from '../../lib/sync'
import type { LoadError } from '../../lib/useCompanions'
import { applyCritterOp, CritterError, emptyCritters, type CritterOp, type CrittersData } from './model'
import { loadCritters, updateCritters } from './storage'

export interface CrittersState {
  ready: boolean
  /** Le chargement a échoué : l'app doit rester bloquée */
  failure: LoadError | null
  data: CrittersData
  apply: (op: CritterOp) => void
  /** Relit le suivi (après une restauration faite dans cet onglet) */
  reload: () => void
  error: string | null
}

export function useCritters(): CrittersState {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<LoadError | null>(null)
  const [data, setData] = useState<CrittersData>(emptyCritters)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const syncRef = useRef<Sync | null>(null)

  const refresh = useCallback(() => {
    if (!loadedRef.current) return
    loadCritters().then(setData, () => setError('Impossible d’actualiser le suivi des animaux. Ferme puis rouvre l’app.'))
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = createSync(() => refresh())
    syncRef.current = sync
    prepareDatabase()
      .then(() => loadCritters())
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
    (op: CritterOp) => {
      if (!loadedRef.current) return
      const at = new Date()
      // Affichage immédiat, puis état réellement enregistré (qui inclut les changements des autres onglets).
      setData((prev) => {
        try {
          return applyCritterOp(prev, op, at)
        } catch {
          return prev
        }
      })
      updateCritters(op, at).then(
        (saved) => {
          setError(null)
          setData(saved)
          syncRef.current?.notify('changed')
        },
        (err: unknown) => {
          setError(err instanceof CritterError ? err.message : 'L’enregistrement a échoué. Vérifie l’espace disponible sur le téléphone.')
          refresh()
        },
      )
    },
    [refresh],
  )

  return useMemo(() => ({ ready, failure, data, apply, reload: refresh, error }), [ready, failure, data, apply, refresh, error])
}
