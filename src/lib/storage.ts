import { del, entries, get, set } from 'idb-keyval'
import { isCharacterId } from '../data/characters'
import { isProfessionId, type ProfessionId } from '../data/professions'
import { sanitizeVillagers, unlockAssigned, VILLAGERS_KEY, type Villagers } from '../features/villagers/model'
import { db, isPlainObject, PORTRAIT_PREFIX, transact } from './db'

export { resetStoreForTests } from './db'

/** Un personnage → un seul métier. */
export type Assignments = Record<string, ProfessionId>

export const ASSIGNMENTS_KEY = 'assignments'

/** Ne garde que les entrées valides : habitant du catalogue + métier du catalogue. */
export function sanitizeAssignments(raw: unknown): Assignments {
  const out: Assignments = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, prof] of Object.entries(raw as Record<string, unknown>)) {
    if (isCharacterId(id) && isProfessionId(prof)) out[id] = prof
  }
  return out
}

export async function loadAssignments(): Promise<Assignments> {
  return sanitizeAssignments(await get(ASSIGNMENTS_KEY, db()))
}

/**
 * Attribue (ou retire) le métier d'UN habitant, par lecture-modification-écriture
 * atomique : on ne réenregistre jamais un état complet gardé en mémoire, donc un
 * autre onglet ne peut pas perdre ses propres modifications.
 * Un habitant qui reçoit un métier est aussi marqué débloqué (même transaction) ;
 * retirer le métier ne change pas « débloqué ». Renvoie l'état enregistré.
 */
export function updateAssignment(
  characterId: string,
  profession: ProfessionId | null,
): Promise<{ assignments: Assignments; villagers: Villagers }> {
  if (!isCharacterId(characterId) || (profession !== null && !isProfessionId(profession))) {
    return Promise.reject(new Error('Habitant ou métier inconnu.'))
  }
  return transact({ keys: [ASSIGNMENTS_KEY, VILLAGERS_KEY] }, (values) => {
    const current = values[ASSIGNMENTS_KEY]
    const next: Record<string, unknown> = isPlainObject(current) ? { ...current } : {}
    const set: [string, unknown][] = [[ASSIGNMENTS_KEY, next]]
    let villagers = values[VILLAGERS_KEY]
    if (profession) {
      next[characterId] = profession
      villagers = unlockAssigned(villagers, [characterId])
      set.push([VILLAGERS_KEY, villagers])
    } else delete next[characterId]
    return { ops: { set }, result: { assignments: sanitizeAssignments(next), villagers: sanitizeVillagers(villagers) } }
  })
}

/** Test « canard » plutôt que instanceof : un Blob relu peut venir d'un autre contexte JS. */
export function isBlobLike(value: unknown): value is Blob {
  return typeof (value as Blob | undefined)?.arrayBuffer === 'function'
}

export async function loadPortraits(): Promise<Record<string, Blob>> {
  const out: Record<string, Blob> = {}
  for (const [key, value] of await entries<IDBValidKey, Blob>(db())) {
    if (typeof key === 'string' && key.startsWith(PORTRAIT_PREFIX) && isBlobLike(value)) {
      out[key.slice(PORTRAIT_PREFIX.length)] = value
    }
  }
  return out
}

export async function savePortrait(characterId: string, blob: Blob): Promise<void> {
  await set(PORTRAIT_PREFIX + characterId, blob, db())
}

export async function deletePortrait(characterId: string): Promise<void> {
  await del(PORTRAIT_PREFIX + characterId, db())
}

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    // Pas disponible (navigation privée, vieux navigateur) : on continue sans.
  }
  return false
}
