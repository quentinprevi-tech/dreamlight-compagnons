import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProfessionId } from '../data/professions'
import {
  type Assignments,
  deletePortrait,
  loadAssignments,
  loadPortraits,
  requestPersistentStorage,
  saveAssignments,
  savePortrait,
} from './storage'

export interface Companions {
  ready: boolean
  assignments: Assignments
  /** URL d'objet des photos ajoutées par l'utilisatrice */
  portraits: Record<string, string>
  assign: (characterId: string, profession: ProfessionId | null) => void
  replaceAll: (a: Assignments) => void
  setPortrait: (characterId: string, blob: Blob | null) => Promise<void>
  saveError: string | null
}

export function useCompanions(): Companions {
  const [ready, setReady] = useState(false)
  const [assignments, setAssignments] = useState<Assignments>({})
  const [portraits, setPortraits] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const portraitsRef = useRef(portraits)
  portraitsRef.current = portraits

  useEffect(() => {
    let cancelled = false
    void requestPersistentStorage()
    Promise.all([loadAssignments(), loadPortraits().catch(() => ({}) as Record<string, Blob>)])
      .then(([a, p]) => {
        if (cancelled) return
        setAssignments(a)
        setPortraits(Object.fromEntries(Object.entries(p).map(([id, b]) => [id, URL.createObjectURL(b)])))
      })
      .catch(() => setSaveError('Impossible de lire les données enregistrées sur cet appareil.'))
      .finally(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
      Object.values(portraitsRef.current).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const persist = useCallback((next: Assignments) => {
    saveAssignments(next).then(
      () => setSaveError(null),
      () => setSaveError('La sauvegarde a échoué. Vérifie l’espace disponible sur le téléphone.'),
    )
  }, [])

  const assign = useCallback(
    (characterId: string, profession: ProfessionId | null) => {
      setAssignments((prev) => {
        const next = { ...prev }
        if (profession) next[characterId] = profession
        else delete next[characterId]
        persist(next)
        return next
      })
    },
    [persist],
  )

  const replaceAll = useCallback(
    (a: Assignments) => {
      setAssignments(a)
      persist(a)
    },
    [persist],
  )

  const setPortrait = useCallback(async (characterId: string, blob: Blob | null) => {
    if (blob) await savePortrait(characterId, blob)
    else await deletePortrait(characterId)
    setPortraits((prev) => {
      const next = { ...prev }
      if (next[characterId]) URL.revokeObjectURL(next[characterId])
      if (blob) next[characterId] = URL.createObjectURL(blob)
      else delete next[characterId]
      return next
    })
  }, [])

  return useMemo(
    () => ({ ready, assignments, portraits, assign, replaceAll, setPortrait, saveError }),
    [ready, assignments, portraits, assign, replaceAll, setPortrait, saveError],
  )
}
