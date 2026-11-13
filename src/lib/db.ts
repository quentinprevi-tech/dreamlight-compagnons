import { createStore, entries, get, getMany, type UseStore } from 'idb-keyval'

/**
 * Accès bas niveau à la base IndexedDB de l'application.
 *
 * Une seule base (`dreamlight-compagnons`) et un seul magasin (`kv`), comme
 * depuis la première version : on n'ajoute jamais de magasin (idb-keyval ouvre
 * la base en version 1 fixe), seulement de nouvelles clés.
 *
 * Familles de clés :
 * - données de la joueuse : `assignments`, `names`, puis les clés des prochaines fonctionnalités ;
 * - `portrait:<id>` : photos personnelles (Blob) ;
 * - `snapshot:<nom>` : copies de sécurité locales (migrations, restaurations) ;
 * - `meta:<nom>` : version des données et migration en cours.
 */

export const PORTRAIT_PREFIX = 'portrait:'
export const SNAPSHOT_PREFIX = 'snapshot:'
export const META_PREFIX = 'meta:'

/** Valeurs JSON des données de la joueuse, par clé (photos exclues). */
export type DataMap = Record<string, unknown>

let dbName = 'dreamlight-compagnons'
let store: UseStore | undefined
const resetListeners = new Set<() => void>()

export function db(): UseStore {
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
  resetListeners.forEach((fn) => fn())
}

/** Permet aux modules qui gardent un état en mémoire de l'oublier au « redémarrage » des tests. */
export function onStoreReset(fn: () => void) {
  resetListeners.add(fn)
}

export function isDataKey(key: IDBValidKey): key is string {
  return (
    typeof key === 'string' && !key.startsWith(PORTRAIT_PREFIX) && !key.startsWith(SNAPSHOT_PREFIX) && !key.startsWith(META_PREFIX)
  )
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/** Toutes les entrées à clé texte de la base. */
export async function readEntries(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of await entries(db())) if (typeof key === 'string') out[key] = value
  return out
}

/** Ne garde que les données de la joueuse (ni photo, ni copie, ni méta). */
export function pickData(all: Record<string, unknown>): DataMap {
  const out: DataMap = {}
  for (const [key, value] of Object.entries(all)) if (isDataKey(key)) out[key] = value
  return out
}

export function readKey<T = unknown>(key: string): Promise<T | undefined> {
  return get<T>(key, db())
}

export function readKeys(keys: string[]): Promise<unknown[]> {
  return getMany(keys, db())
}

/**
 * Garde-fou des FUTURES versions : version des données au-delà de laquelle ce code refuse d'écrire.
 *
 * `meta:schema` est relu DANS chaque transaction d'écriture ; s'il est plus récent que ce code, la transaction est
 * annulée (rien n'est écrit) avec `NewerDataError`. À augmenter en même temps que `CURRENT_SCHEMA`
 * (migrations.ts) : un test vérifie que les deux valeurs restent égales.
 *
 * LIMITE : ce contrôle n'existe que dans le code qui le contient. Il ne protège PAS contre la version 3 déjà publiée,
 * qui ne vérifie jamais la version avant d'écrire. Les écritures directes de photos (`savePortrait`, `deletePortrait`)
 * ne passent pas par `transact` et ne sont pas gardées.
 */
export const DATA_SCHEMA_KEY = 'meta:schema'
export const MAX_WRITABLE_SCHEMA = 3

export class NewerDataError extends Error {
  constructor() {
    super('Tes données ont été enregistrées par une version plus récente de l’app. Recharge l’app (ou mets-la à jour) avant de modifier quoi que ce soit.')
    this.name = 'NewerDataError'
  }
}

export interface CommitOps {
  set?: [string, unknown][]
  del?: string[]
}

export interface TxReads {
  keys?: string[]
  /** Toutes les clés commençant par ces préfixes (ex. `portrait:`) */
  prefixes?: string[]
}

/**
 * Lecture → décision → écriture dans UNE seule transaction IndexedDB `readwrite`.
 *
 * C'est le mécanisme d'`update()` d'idb-keyval, étendu à plusieurs clés, aux
 * préfixes et aux suppressions. Aucun autre onglet ne peut écrire entre la
 * lecture et l'écriture, et si quoi que ce soit échoue (exception de `plan`,
 * valeur non enregistrable, fermeture de l'app), rien n'est écrit.
 *
 * `plan` reçoit les valeurs lues (clés absentes = non définies) et doit rester
 * synchrone : attendre autre chose qu'IndexedDB fermerait la transaction.
 * `duringWrite` (tests uniquement) simule une interruption au milieu des écritures.
 */
export function transact<T>(
  reads: TxReads,
  plan: (values: Record<string, unknown>) => { ops?: CommitOps; result: T },
  duringWrite?: () => void,
): Promise<T> {
  return db()('readwrite', (s) => {
    return new Promise<T>((resolve, reject) => {
      const tx = s.transaction
      const values: Record<string, unknown> = {}
      let result: T
      let storedSchema: unknown
      let pending = 1 // jeton libéré après l'envoi des lectures

      tx.oncomplete = () => resolve(result)
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Transaction annulée'))

      const step = () => {
        if (--pending > 0) return
        try {
          if (typeof storedSchema === 'number' && storedSchema > MAX_WRITABLE_SCHEMA) throw new NewerDataError()
          const out = plan(values)
          result = out.result
          for (const [key, value] of out.ops?.set ?? []) s.put(value, key)
          duringWrite?.()
          for (const key of out.ops?.del ?? []) s.delete(key)
        } catch (err) {
          reject(err)
          try {
            tx.abort()
          } catch {
            // déjà terminée
          }
        }
      }

      pending++
      const rs = s.get(DATA_SCHEMA_KEY)
      rs.onsuccess = () => {
        storedSchema = rs.result
        step()
      }
      for (const key of reads.keys ?? []) {
        pending++
        const r = s.get(key)
        r.onsuccess = () => {
          if (r.result !== undefined) values[key] = r.result
          step()
        }
      }
      for (const prefix of reads.prefixes ?? []) {
        pending++
        const range = IDBKeyRange.bound(prefix, `${prefix}￿`)
        const rk = s.getAllKeys(range)
        rk.onsuccess = () => {
          const keys = rk.result
          const rv = s.getAll(range)
          rv.onsuccess = () => {
            keys.forEach((k, i) => {
              if (typeof k === 'string') values[k] = rv.result[i]
            })
            step()
          }
        }
      }
      step()
    })
  })
}

/** Écrit et supprime plusieurs clés dans une seule transaction : tout ou rien. */
export function commit(ops: CommitOps, duringWrite?: () => void): Promise<void> {
  return transact({}, () => ({ ops, result: undefined }), duringWrite)
}

/** JSON à clés triées : deux valeurs équivalentes donnent le même texte. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

export function sameJson(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}
