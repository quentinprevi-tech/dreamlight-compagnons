import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NewerDataError, readEntries } from '../../lib/db'
import { MigrationError, prepareDatabase } from '../../lib/migrations'
import { createSync, type Sync } from '../../lib/sync'
import type { LoadError } from '../../lib/useCompanions'
import { applyLevelChange, emptyLevels, type CritterLevels } from './levels'
import { applyCritterOp, CritterError, emptyCritters, type CritterOp, type CrittersData } from './model'
import { loadCritterLevels, loadCritters, updateCritterLevel, updateCritters } from './storage'

export interface CrittersState {
  ready: boolean
  /** Le chargement a échoué : l'app doit rester bloquée */
  failure: LoadError | null
  data: CrittersData
  /** Niveaux des compagnons (clé `critterLevels`, séparée de `data`) */
  levels: CritterLevels
  apply: (op: CritterOp) => void
  /** Niveau (1 à 5) d'un compagnon obtenu ; `null` l'efface */
  setLevel: (id: string, level: number | null) => void
  /** Relit le suivi (après une restauration faite dans cet onglet) */
  reload: () => void
  error: string | null
}

const SAVE_FAILED = 'L’enregistrement a échoué. Vérifie l’espace disponible sur le téléphone.'
const saveMessage = (err: unknown) => (err instanceof CritterError || err instanceof NewerDataError ? err.message : SAVE_FAILED)

export function useCritters(): CrittersState {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<LoadError | null>(null)
  const [data, setData] = useState<CrittersData>(emptyCritters)
  const [levels, setLevels] = useState<CritterLevels>(emptyLevels)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const syncRef = useRef<Sync | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  /** Relit le suivi ET les niveaux : une modification faite dans un autre onglet (ou une restauration) touche l'un ou l'autre. */
  const refresh = useCallback(() => {
    if (!loadedRef.current) return
    Promise.all([loadCritters(), loadCritterLevels()]).then(
      ([d, l]) => {
        setData(d)
        setLevels(l)
      },
      () => setError('Impossible d’actualiser le suivi des animaux. Ferme puis rouvre l’app.'),
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = createSync(() => refresh())
    syncRef.current = sync
    prepareDatabase()
      .then(() => Promise.all([loadCritters(), loadCritterLevels()]))
      .then(([d, l]) => {
        if (cancelled) return
        setData(d)
        setLevels(l)
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
          setError(saveMessage(err))
          refresh()
        },
      )
    },
    [refresh],
  )

  const setLevel = useCallback(
    (id: string, level: number | null) => {
      if (!loadedRef.current) return
      setLevels((prev) => {
        try {
          return applyLevelChange(prev, dataRef.current.progress[id]?.obtained === true, id, level)
        } catch {
          return prev
        }
      })
      updateCritterLevel(id, level).then(
        (saved) => {
          setError(null)
          setLevels(saved)
          syncRef.current?.notify('changed')
        },
        (err: unknown) => {
          setError(saveMessage(err))
          refresh()
        },
      )
    },
    [refresh],
  )

  return useMemo(() => ({ ready, failure, data, levels, apply, setLevel, reload: refresh, error }), [ready, failure, data, levels, apply, setLevel, refresh, error])
}
