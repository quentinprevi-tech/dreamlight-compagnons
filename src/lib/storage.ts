import { createStore, del, entries, get, set, type UseStore } from 'idb-keyval'
import { CHARACTERS_BY_ID } from '../data/characters'
import { isProfessionId, type ProfessionId } from '../data/professions'

/** Un personnage → un seul métier. */
export type Assignments = Record<string, ProfessionId>

const ASSIGNMENTS_KEY = 'assignments'
const PORTRAIT_PREFIX = 'portrait:'

let dbName = 'dreamlight-compagnons'
let store: UseStore | undefined
function db(): UseStore {
  store ??= createStore(dbName, 'kv')
  return store
}

/**
 * Réservé aux tests : oublie la connexion ouverte (comme un redémarrage).
 * Avec `freshName`, bascule sur une base vide portant ce nom.
 */
export function resetStoreForTests(freshName?: string) {
  store = undefined
  if (freshName) dbName = freshName
}

/** Ne garde que les entrées valides (personnage connu + métier connu). */
export function sanitizeAssignments(raw: unknown): Assignments {
  const out: Assignments = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, prof] of Object.entries(raw as Record<string, unknown>)) {
    if (CHARACTERS_BY_ID[id] && isProfessionId(prof)) out[id] = prof
  }
  return out
}

export async function loadAssignments(): Promise<Assignments> {
  return sanitizeAssignments(await get(ASSIGNMENTS_KEY, db()))
}

export async function saveAssignments(a: Assignments): Promise<void> {
  await set(ASSIGNMENTS_KEY, a, db())
}

export async function loadPortraits(): Promise<Record<string, Blob>> {
  const out: Record<string, Blob> = {}
  for (const [key, value] of await entries<IDBValidKey, Blob>(db())) {
    // Test « canard » plutôt que instanceof : un Blob relu peut venir d'un autre contexte JS.
    if (typeof key === 'string' && key.startsWith(PORTRAIT_PREFIX) && typeof value?.arrayBuffer === 'function') {
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

export interface Backup {
  app: 'dreamlight-compagnons'
  version: 1
  exportedAt: string
  assignments: Assignments
}

export function makeBackup(a: Assignments): Backup {
  return { app: 'dreamlight-compagnons', version: 1, exportedAt: new Date().toISOString(), assignments: a }
}

export function parseBackup(text: string): Assignments {
  const data = JSON.parse(text) as Partial<Backup>
  if (data?.app !== 'dreamlight-compagnons') throw new Error('Ce fichier ne vient pas de Dreamlight Compagnons.')
  return sanitizeAssignments(data.assignments)
}
