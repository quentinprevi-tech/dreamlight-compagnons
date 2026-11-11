import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readEntries } from '../../lib/db'
import { MigrationError, prepareDatabase } from '../../lib/migrations'
import { createSync, type Sync } from '../../lib/sync'
import type { LoadError } from '../../lib/useCompanions'
import { applyTaleOp, emptyTales, TaleError, type TaleOp, type TalesData } from './model'
import { loadTales, updateTales } from './storage'

export interface TalesState {
  ready: boolean
  /** Le chargement a échoué : l'app doit rester bloquée */
  failure: LoadError | null
  data: TalesData
  /**
   * Applique une opération. Résout avec `null` si elle a été enregistrée, ou avec le message de refus
   * (quantités insuffisantes, compteur négatif…) : rien n'est alors écrit. L'appelant l'affiche.
   */
  apply: (op: TaleOp) => Promise<string | null>
  /** Relit le suivi (après une restauration faite dans cet onglet) */
  reload: () => void
  error: string | null
}

export function useTales(): TalesState {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<LoadError | null>(null)
  const [data, setData] = useState<TalesData>(emptyTales)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const syncRef = useRef<Sync | null>(null)

  const refresh = useCallback(() => {
    if (!loadedRef.current) return
    loadTales().then(setData, () => setError('Impossible d’actualiser les puzzles. Ferme puis rouvre l’app.'))
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = createSync(() => refresh())
    syncRef.current = sync
    prepareDatabase()
      .then(() => loadTales())
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
    async (op: TaleOp): Promise<string | null> => {
      if (!loadedRef.current) return 'Les données ne sont pas chargées.'
      const at = new Date()
      // Affichage immédiat quand l'opération est valable sur l'état affiché ; l'état ENREGISTRÉ fait toujours foi.
      setData((prev) => {
        try {
          return applyTaleOp(prev, op, at)
        } catch {
          return prev
        }
      })
      try {
        const saved = await updateTales(op, at)
        setError(null)
        setData(saved)
        syncRef.current?.notify('changed')
        return null
      } catch (err) {
        const message = err instanceof TaleError ? err.message : 'L’enregistrement a échoué. Vérifie l’espace disponible sur le téléphone.'
        // Un refus (négatif, insuffisant…) est affiché là où l'action a lieu (ligne, fiche de confirmation) :
        // le bandeau global ne sert qu'aux échecs inattendus.
        if (!(err instanceof TaleError)) setError(message)
        refresh() // revient à l'état réellement enregistré
        return message
      }
    },
    [refresh],
  )

  return useMemo(() => ({ ready, failure, data, apply, reload: refresh, error }), [ready, failure, data, apply, refresh, error])
}
