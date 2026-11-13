import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NewerDataError, readEntries } from '../../lib/db'
import { MigrationError, prepareDatabase } from '../../lib/migrations'
import { createSync, type Sync } from '../../lib/sync'
import type { LoadError } from '../../lib/useCompanions'
import { applyRecipeOp, emptyRecipes, RecipeError, type RecipeOp, type RecipesData } from './model'
import { loadRecipes, updateRecipes } from './storage'

export interface RecipesState {
  ready: boolean
  /** Le chargement a échoué : l'app doit rester bloquée */
  failure: LoadError | null
  data: RecipesData
  /**
   * Applique une opération. Résout avec `null` si elle a été enregistrée, ou avec le message de refus
   * (recette inconnue…) : rien n'est alors écrit. L'appelant l'affiche.
   */
  apply: (op: RecipeOp) => Promise<string | null>
  /** Relit le suivi (après une restauration faite dans cet onglet) */
  reload: () => void
  error: string | null
}

export function useRecipes(): RecipesState {
  const [ready, setReady] = useState(false)
  const [failure, setFailure] = useState<LoadError | null>(null)
  const [data, setData] = useState<RecipesData>(emptyRecipes)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const syncRef = useRef<Sync | null>(null)

  const refresh = useCallback(() => {
    if (!loadedRef.current) return
    loadRecipes().then(setData, () => setError('Impossible d’actualiser les recettes. Ferme puis rouvre l’app.'))
  }, [])

  useEffect(() => {
    let cancelled = false
    const sync = createSync(() => refresh())
    syncRef.current = sync
    prepareDatabase()
      .then(() => loadRecipes())
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
    async (op: RecipeOp): Promise<string | null> => {
      if (!loadedRef.current) return 'Les données ne sont pas chargées.'
      const at = new Date()
      // Affichage immédiat quand l'opération est valable sur l'état affiché ; l'état ENREGISTRÉ fait toujours foi.
      setData((prev) => {
        try {
          return applyRecipeOp(prev, op, at)
        } catch {
          return prev
        }
      })
      try {
        const saved = await updateRecipes(op, at)
        setError(null)
        setData(saved)
        syncRef.current?.notify('changed')
        return null
      } catch (err) {
        const message = err instanceof RecipeError || err instanceof NewerDataError ? err.message : 'L’enregistrement a échoué. Vérifie l’espace disponible sur le téléphone.'
        // Un refus (négatif, insuffisant…) est affiché là où l'action a lieu (ligne, fiche de confirmation) :
        // le bandeau global ne sert qu'aux échecs inattendus.
        if (!(err instanceof RecipeError)) setError(message)
        refresh() // revient à l'état réellement enregistré
        return message
      }
    },
    [refresh],
  )

  return useMemo(() => ({ ready, failure, data, apply, reload: refresh, error }), [ready, failure, data, apply, refresh, error])
}
