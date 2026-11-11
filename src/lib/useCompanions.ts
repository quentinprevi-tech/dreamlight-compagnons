import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProfessionId } from '../data/professions'
import { readEntries } from './db'
import { MigrationError, prepareDatabase } from './migrations'
import { type Assignments, deletePortrait, loadAssignments, loadPortraits, requestPersistentStorage, savePortrait, updateAssignment } from './storage'
import { createSync, type Sync } from './sync'
import { type CustomNames, loadNames, NameError, updateCustomName } from './names'
import { type VillagerPatch, type Villagers, applyPatch, sanitizeVillagers } from '../features/villagers/model'
import { loadVillagers, updateVillager as saveVillager } from '../features/villagers/storage'

/** Le chargement initial n'a pas abouti : l'app est bloquée, rien ne peut être écrit. */
export interface LoadError {
  kind: 'migration' | 'load'
  detail: string
  /** Les données restent lisibles : une copie de secours est possible. */
  readable: boolean
}

export interface Companions {
  ready: boolean
  assignments: Assignments
  /** Débloqué, amitié, objet demandé (saisis par la joueuse) */
  villagers: Villagers
  /** Noms personnalisés par la joueuse (jamais des traductions officielles) */
  names: CustomNames
  /** URL d'objet des photos ajoutées par l'utilisatrice */
  portraits: Record<string, string>
  assign: (characterId: string, profession: ProfessionId | null) => void
  updateVillager: (characterId: string, patch: VillagerPatch) => void
  /** Nom personnalisé d'un élément (`null` : retire le nom) */
  setName: (key: string, name: string | null) => void
  /** Relit tout après une restauration ou une annulation faite dans cet onglet, et prévient les autres. */
  afterRestore: () => Promise<void>
  setPortrait: (characterId: string, blob: Blob | null) => Promise<void>
  saveError: string | null
  loadError: LoadError | null
}

const SAVE_FAILED = 'La sauvegarde a échoué. Vérifie l’espace disponible sur le téléphone.'

async function isReadable(): Promise<boolean> {
  try {
    await readEntries()
    return true
  } catch {
    return false
  }
}

export function useCompanions(): Companions {
  const [ready, setReady] = useState(false)
  const [assignments, setAssignments] = useState<Assignments>({})
  const [villagers, setVillagers] = useState<Villagers>({})
  const [names, setNames] = useState<CustomNames>({})
  const [portraits, setPortraits] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<LoadError | null>(null)
  const portraitsRef = useRef(portraits)
  portraitsRef.current = portraits
  /** Vrai seulement quand les données ont été entièrement chargées : aucune écriture avant. */
  const loadedRef = useRef(false)
  const syncRef = useRef<Sync | null>(null)

  const loadAll = useCallback(async () => {
    const [a, v, n, p] = await Promise.all([loadAssignments(), loadVillagers(), loadNames(), loadPortraits()])
    const previous = portraitsRef.current
    setAssignments(a)
    setVillagers(v)
    setNames(n)
    setPortraits(Object.fromEntries(Object.entries(p).map(([id, b]) => [id, URL.createObjectURL(b)])))
    Object.values(previous).forEach((u) => URL.revokeObjectURL(u))
  }, [])

  /** Relecture demandée par un autre onglet : n'écrit jamais rien. */
  const refresh = useCallback(() => {
    if (!loadedRef.current) return
    loadAll().catch(() => setSaveError('Impossible d’actualiser les données. Ferme puis rouvre l’app.'))
  }, [loadAll])

  useEffect(() => {
    let cancelled = false
    void requestPersistentStorage()
    const sync = createSync(() => refresh())
    syncRef.current = sync
    prepareDatabase()
      .then(() => loadAll())
      .then(() => {
        if (!cancelled) loadedRef.current = true
      })
      .catch(async (err: unknown) => {
        if (cancelled) return
        const readable = await isReadable()
        const detail = err instanceof Error ? err.message : String(err)
        if (!cancelled) setLoadError({ kind: err instanceof MigrationError ? 'migration' : 'load', detail, readable })
      })
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
      loadedRef.current = false
      sync.close()
      syncRef.current = null
      Object.values(portraitsRef.current).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [loadAll, refresh])

  const assign = useCallback(
    (characterId: string, profession: ProfessionId | null) => {
      if (!loadedRef.current) return
      // Affichage immédiat, puis état réellement enregistré (qui inclut les changements des autres onglets).
      setAssignments((prev) => {
        const next = { ...prev }
        if (profession) next[characterId] = profession
        else delete next[characterId]
        return next
      })
      updateAssignment(characterId, profession).then(
        (saved) => {
          setSaveError(null)
          setAssignments(saved.assignments)
          setVillagers(saved.villagers)
          syncRef.current?.notify('changed')
        },
        () => {
          setSaveError(SAVE_FAILED)
          refresh()
        },
      )
    },
    [refresh],
  )

  const updateVillager = useCallback(
    (characterId: string, patch: VillagerPatch) => {
      if (!loadedRef.current) return
      setVillagers((prev) => {
        const next = { ...prev }
        const entry = sanitizeVillagers({ [characterId]: applyPatch(prev[characterId], patch) })[characterId]
        if (entry) next[characterId] = entry
        else delete next[characterId]
        return next
      })
      saveVillager(characterId, patch).then(
        (saved) => {
          setSaveError(null)
          setVillagers(saved)
          syncRef.current?.notify('changed')
        },
        (err: unknown) => {
          setSaveError(err instanceof Error && err.name === 'VillagerError' ? err.message : SAVE_FAILED)
          refresh()
        },
      )
    },
    [refresh],
  )

  const setName = useCallback(
    (key: string, name: string | null) => {
      if (!loadedRef.current) return
      updateCustomName(key, name).then(
        (saved) => {
          setSaveError(null)
          setNames(saved)
          syncRef.current?.notify('changed')
        },
        (err: unknown) => {
          setSaveError(err instanceof NameError ? err.message : SAVE_FAILED)
          refresh()
        },
      )
    },
    [refresh],
  )

  const setPortrait = useCallback(async (characterId: string, blob: Blob | null) => {
    if (!loadedRef.current) return
    if (blob) await savePortrait(characterId, blob)
    else await deletePortrait(characterId)
    setPortraits((prev) => {
      const next = { ...prev }
      if (next[characterId]) URL.revokeObjectURL(next[characterId])
      if (blob) next[characterId] = URL.createObjectURL(blob)
      else delete next[characterId]
      return next
    })
    syncRef.current?.notify('changed')
  }, [])

  const afterRestore = useCallback(async () => {
    await loadAll()
    syncRef.current?.notify('restored')
  }, [loadAll])

  return useMemo(
    () => ({ ready, assignments, villagers, names, portraits, assign, updateVillager, setName, afterRestore, setPortrait, saveError, loadError }),
    [ready, assignments, villagers, names, portraits, assign, updateVillager, setName, afterRestore, setPortrait, saveError, loadError],
  )
}
