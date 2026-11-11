import { unlockAssigned, VILLAGERS_KEY } from '../features/villagers/model'
import { sanitizeAssignments } from './storage'
import { commit, onStoreReset, pickData, readEntries, readKey, readKeys, sameJson, transact, type DataMap } from './db'

/**
 * Migrations des données enregistrées sur le téléphone.
 *
 * Déroulement, conçu pour résister à une fermeture de l'app à n'importe quel moment :
 *  1. Copie de sécurité `snapshot:pre-v<cible>` de toutes les données (photos exclues :
 *     une migration n'y touche jamais). Écrite seulement si elle n'existe pas (test et
 *     écriture dans la même transaction), puis relue. Jamais écrasée : si elle existe
 *     déjà, c'est l'état d'origine d'une migration interrompue ou menée par un autre onglet.
 *  2. Calcul de la nouvelle version par des fonctions pures, toujours à partir de la copie.
 *  3. Écriture, en une seule transaction, des seules clés modifiées et du marqueur
 *     `meta:migration` (« écrit, pas encore vérifié »). Si, dans cette même transaction,
 *     on constate qu'un autre onglet a déjà validé la migration, on n'écrit rien.
 *  4. Relecture et comparaison avec le calcul.
 *  5. Validation : `meta:schema = cible` et suppression du marqueur, en une transaction.
 *
 * Au démarrage, une migration non validée (marqueur présent ou version ancienne) est
 * reprise à l'étape 2 depuis la copie : le résultat final est toujours le même.
 *
 * Règle : une migration ne modifie jamais la clé `assignments` (format historique
 * lu aussi par les anciennes versions de l'app encore ouvertes dans un onglet).
 */

export interface Migration {
  /** Version atteinte après cette étape */
  to: number
  description: string
  /** Fonction pure : ne lit ni n'écrit la base */
  migrate: (data: DataMap) => DataMap
}

export const MIGRATIONS: Migration[] = [
  {
    to: 2,
    description: 'Numéro de version des données et copie de sécurité. Aucune donnée transformée.',
    migrate: (data) => data,
  },
  {
    to: 3,
    description: 'Phase 1 : les habitants qui ont déjà un métier sont marqués débloqués. Aucun métier attribué.',
    migrate: (data) => {
      const assigned = Object.keys(sanitizeAssignments(data.assignments))
      if (!assigned.length) return data
      return { ...data, [VILLAGERS_KEY]: unlockAssigned(data[VILLAGERS_KEY], assigned) }
    },
  },
]

export const CURRENT_SCHEMA = MIGRATIONS[MIGRATIONS.length - 1].to

export const SCHEMA_KEY = 'meta:schema'
export const MIGRATION_KEY = 'meta:migration'
export const snapshotKey = (target: number) => `snapshot:pre-v${target}`

export interface MigrationSnapshot {
  /** Version des données copiées */
  from: number
  at: string
  data: DataMap
}

export type MigrationStep = 'snapshot' | 'write' | 'verify'

export interface MigrationOptions {
  migrations?: Migration[]
  /** Tests : appelé après chaque étape réussie (lever une erreur simule une interruption). */
  afterStep?: (step: MigrationStep) => void
  /** Tests : appelé au milieu de la transaction d'écriture de l'étape 3. */
  duringWrite?: () => void
}

export type MigrationResult =
  | { status: 'up-to-date'; schema: number }
  | { status: 'migrated'; from: number; to: number; resumed: boolean }
  /** Données écrites par une version plus récente de l'app : on n'y touche pas. */
  | { status: 'newer'; schema: number }

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

function isSnapshot(v: unknown): v is MigrationSnapshot {
  const s = v as MigrationSnapshot | undefined
  return !!s && typeof s === 'object' && typeof s.from === 'number' && !!s.data && typeof s.data === 'object'
}

export function schemaOf(all: Record<string, unknown>): number {
  const v = all[SCHEMA_KEY]
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1
}

/** Applique les étapes nécessaires pour passer de `from` à `target` (fonction pure). */
export function computeMigration(data: DataMap, from: number, target: number, migrations: Migration[] = MIGRATIONS): DataMap {
  let next = structuredClone(data)
  for (const m of migrations) if (m.to > from && m.to <= target) next = m.migrate(next)
  return next
}

async function migrate({ migrations = MIGRATIONS, afterStep, duringWrite }: MigrationOptions): Promise<MigrationResult> {
  const target = migrations.length ? migrations[migrations.length - 1].to : 1
  const all = await readEntries()
  const schema = schemaOf(all)
  const pending = MIGRATION_KEY in all

  if (schema > target) return { status: 'newer', schema }
  if (schema === target && !pending) return { status: 'up-to-date', schema }

  // 1. Copie de sécurité : écrite seulement si absente (jamais écrasée), puis relue
  const key = snapshotKey(target)
  const resumed = isSnapshot(all[key])
  const fresh: MigrationSnapshot = { from: schema, at: new Date().toISOString(), data: pickData(all) }
  const kept = await transact({ keys: [key] }, (v) =>
    isSnapshot(v[key]) ? { result: v[key] } : { ops: { set: [[key, fresh]] }, result: fresh as unknown },
  )
  if (!isSnapshot(kept) || !sameJson(await readKey(key), kept)) throw new MigrationError('La copie de sécurité n’a pas pu être vérifiée.')
  const snap = kept
  afterStep?.('snapshot')

  // 2. Calcul depuis la copie
  const next = computeMigration(snap.data, snap.from, target, migrations)
  if (!sameJson(next.assignments, snap.data.assignments)) {
    throw new MigrationError('Une migration ne doit jamais modifier les métiers.')
  }

  // 3. Écriture atomique des seules clés modifiées + marqueur « écrit »,
  //    sauf si un autre onglet a validé la migration entre-temps.
  const toSet = Object.entries(next).filter(([k, v]) => !sameJson(snap.data[k], v))
  const toDel = Object.keys(snap.data).filter((k) => !Object.hasOwn(next, k))
  const marker = { from: snap.from, target, step: 'written', at: new Date().toISOString() }
  const written = await transact(
    { keys: [SCHEMA_KEY, MIGRATION_KEY] },
    (v) =>
      schemaOf(v) >= target && !(MIGRATION_KEY in v)
        ? { result: false }
        : { ops: { set: [...toSet, [MIGRATION_KEY, marker]], del: toDel }, result: true },
    duringWrite,
  )
  if (!written) return { status: 'up-to-date', schema: target }
  afterStep?.('write')

  // 4. Vérification : relecture de tout ce qui a été écrit ou supprimé
  const reread = await readKeys(toSet.map(([k]) => k))
  const deleted = await readKeys(toDel)
  if (toSet.some(([, v], i) => !sameJson(reread[i], v)) || deleted.some((v) => v !== undefined)) {
    throw new MigrationError('Les données migrées ne correspondent pas à ce qui était attendu.')
  }
  afterStep?.('verify')

  // 5. Validation
  await commit({ set: [[SCHEMA_KEY, target]], del: [MIGRATION_KEY] })
  return { status: 'migrated', from: snap.from, to: target, resumed }
}

/** Exécute les migrations (une seule fois à la fois, même avec plusieurs onglets ouverts). */
export function runMigrations(options: MigrationOptions = {}): Promise<MigrationResult> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (locks?.request) return locks.request('dreamlight-compagnons:migration', () => migrate(options))
  return migrate(options)
}

let preparing: Promise<MigrationResult> | undefined
onStoreReset(() => (preparing = undefined))

/** Prépare la base au démarrage de l'app (une seule exécution par chargement de page). */
export function prepareDatabase(): Promise<MigrationResult> {
  preparing ??= runMigrations().catch((err) => {
    preparing = undefined // un nouvel essai reste possible
    throw err
  })
  return preparing
}

/** Données d'origine conservées avant la dernière migration, si elles existent. */
export async function latestMigrationSnapshot(): Promise<MigrationSnapshot | undefined> {
  const v = await readKey(snapshotKey(CURRENT_SCHEMA))
  return isSnapshot(v) ? v : undefined
}
