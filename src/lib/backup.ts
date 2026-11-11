import { isCharacterId } from '../data/characters'
import { isPlainObject, PORTRAIT_PREFIX, readEntries, readKey, readKeys, sameJson, transact, type DataMap } from './db'
import { CURRENT_SCHEMA, MIGRATION_KEY, schemaOf, snapshotKey } from './migrations'
import { NAMES_KEY, sanitizeNames } from './names'
import { CRITTERS_KEY, sanitizeCritters } from '../features/critters/model'
import { RECIPES_KEY, sanitizeRecipes } from '../features/recipes/model'
import { sanitizeTales, TALES_KEY } from '../features/tales/model'
import { sanitizeTasks, TASKS_KEY } from '../features/tasks/model'
import { sanitizeVillagers, VILLAGERS_KEY } from '../features/villagers/model'
import { ASSIGNMENTS_KEY, isBlobLike, sanitizeAssignments } from './storage'

/**
 * Sauvegarde JSON (export / import).
 *
 * C'est la seule vraie sauvegarde : le fichier exporté se garde hors du téléphone.
 * Les copies `snapshot:*` restent sur le téléphone et ne protègent que contre une
 * erreur de migration ou de restauration.
 *
 * Format 2 :
 * {
 *   app: 'dreamlight-compagnons', format: 2, type: 'complete' | 'partial',
 *   exportedAt, schema,
 *   assignments: { … },          ← copie des métiers lisible par la première version de l'app
 *   sections: {
 *     assignments: { v, data }, names: { v, data }, …      ← toujours présentes si « complete »
 *     photos: null              ← photos non incluses : celles du téléphone sont conservées
 *           | { v, data: {} }   ← aucune photo : celles du téléphone sont supprimées
 *           | { v, data: { id: 'data:image/jpeg;base64,…' } } ← le téléphone aura exactement ces photos
 *   }
 * }
 * Format 1 (anciennes sauvegardes) : { app, version: 1, assignments } → ne restaure que les métiers.
 *
 * Règles de lecture :
 * - une section abîmée (pas un objet, données illisibles) fait refuser le fichier : elle n'est
 *   jamais lue comme une section vide ;
 * - une section inconnue ou une version de données plus récente : restauration complète refusée,
 *   import partiel possible en la signalant ;
 * - un habitant, un métier ou un nom inconnu du catalogue est écarté et signalé ;
 * - une photo illisible d'un habitant connu ne supprime jamais celle du téléphone.
 *
 * Pour ajouter une fonctionnalité : une entrée dans DATA_SECTIONS.
 */

export const APP_ID = 'dreamlight-compagnons'
export const BACKUP_FORMAT = 2
export const RESTORE_SNAPSHOT_KEY = 'snapshot:pre-import'
const PHOTOS_VERSION = 1
/** Au-delà, une photo est jugée illisible (les photos de l'app font quelques dizaines de Ko). */
const MAX_PHOTO_DATA_URL = 1_500_000
/**
 * Taille maximale d'un fichier de sauvegarde (25 Mo). Une photo fait 256 px en JPEG (environ 20 à 55 Ko en
 * base64) et il y a au plus quelques dizaines d'habitants : un export réaliste pèse environ 4 Mo, la marge est
 * donc d'environ 5. Le refus a lieu avant tout `JSON.parse` et avant toute écriture.
 */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024
export const BACKUP_TOO_LARGE = 'Ce fichier dépasse la limite de 25 Mo : ce n’est pas une sauvegarde de Dreamlight Compagnons.'

/**
 * Taille réelle en octets (UTF-8), sans supposer que le texte est de l'ASCII.
 * Une unité de texte (UTF-16) occupe au moins 1 octet en UTF-8 : `text.length > MAX` suffit donc à conclure
 * sans rien allouer. Sinon, le texte peut peser jusqu'à 3 octets par unité : on mesure alors précisément.
 */
function utf8Size(text: string): number {
  if (text.length > MAX_BACKUP_BYTES) return text.length
  if (text.length * 3 <= MAX_BACKUP_BYTES) return text.length * 3 // borne haute, déjà sous la limite
  return new TextEncoder().encode(text).byteLength
}

interface DataSection<T> {
  /** Nom de la section dans le fichier */
  id: string
  /** Clé IndexedDB */
  key: string
  label: string
  version: number
  sanitize: (raw: unknown) => T
  count: (data: T) => number
  /** Nombre d'entrées d'une valeur brute (sert à compter les entrées écartées). Par défaut : clés de l'objet. */
  size?: (raw: unknown) => number
  unit: [singulier: string, pluriel: string]
}

const objectCount = (raw: unknown) => (isPlainObject(raw) ? Object.keys(raw).length : 0)

/** Taille du suivi des animaux : extensions renseignées + variantes suivies. */
function crittersSize(raw: unknown): number {
  return isPlainObject(raw) ? objectCount(raw.owned) + objectCount(raw.progress) : 0
}

/** Taille du suivi des puzzles : types comptés, puzzles terminés, validations du journal. */
function talesSize(raw: unknown): number {
  return isPlainObject(raw) ? objectCount(raw.counts) + objectCount(raw.puzzles) + (Array.isArray(raw.log) ? raw.log.length : 0) : 0
}

/** Taille du suivi des recettes : recettes connues + favorites. */
function recipesSize(raw: unknown): number {
  return isPlainObject(raw) ? objectCount(raw.known) + objectCount(raw.favorites) : 0
}

/** Taille des tâches : réglages, tâches personnalisées, occurrences cochées ou retirées, reportées. */
function tasksSize(raw: unknown): number {
  if (!isPlainObject(raw)) return 0
  const len = (v: unknown) => (Array.isArray(v) ? v.length : objectCount(v))
  return len(raw.enabled) + len(raw.custom) + len(raw.done) + len(raw.removed) + len(raw.postponed)
}

export const DATA_SECTIONS: DataSection<Record<string, unknown>>[] = [
  {
    id: 'assignments',
    key: ASSIGNMENTS_KEY,
    label: 'Métiers des habitants',
    version: 1,
    sanitize: sanitizeAssignments,
    count: objectCount,
    unit: ['habitant', 'habitants'],
  },
  {
    id: 'villagers',
    key: VILLAGERS_KEY,
    label: 'Suivi des habitants (débloqués, amitié, demandes)',
    version: 1,
    sanitize: sanitizeVillagers,
    count: objectCount,
    unit: ['habitant', 'habitants'],
  },
  {
    id: 'tasks',
    key: TASKS_KEY,
    label: 'Tâches du jour (réglages, tâches personnalisées, suivi)',
    version: 1,
    sanitize: sanitizeTasks as unknown as (raw: unknown) => Record<string, unknown>,
    count: tasksSize,
    size: tasksSize,
    unit: ['élément', 'éléments'],
  },
  {
    id: 'critters',
    key: CRITTERS_KEY,
    label: 'Suivi des animaux (obtenus, nourrissages, extensions)',
    version: 1,
    sanitize: sanitizeCritters as unknown as (raw: unknown) => Record<string, unknown>,
    count: crittersSize,
    size: crittersSize,
    unit: ['élément', 'éléments'],
  },
  {
    id: 'tales',
    key: TALES_KEY,
    label: 'Puzzles et anigamis (compteurs, puzzles terminés, journal)',
    version: 1,
    sanitize: sanitizeTales as unknown as (raw: unknown) => Record<string, unknown>,
    count: talesSize,
    size: talesSize,
    unit: ['élément', 'éléments'],
  },
  {
    id: 'recipes',
    key: RECIPES_KEY,
    label: 'Recettes (connues et favorites)',
    version: 1,
    sanitize: sanitizeRecipes as unknown as (raw: unknown) => Record<string, unknown>,
    count: recipesSize,
    size: recipesSize,
    unit: ['élément', 'éléments'],
  },
  {
    id: 'names',
    key: NAMES_KEY,
    label: 'Noms personnalisés',
    version: 1,
    sanitize: sanitizeNames,
    count: objectCount,
    unit: ['nom', 'noms'],
  },
]

const KNOWN_SECTIONS = new Set([...DATA_SECTIONS.map((s) => s.id), 'photos'])

export interface BackupFile {
  app: typeof APP_ID
  format: typeof BACKUP_FORMAT
  type: 'complete' | 'partial'
  exportedAt: string
  schema: number
  /** Copie des métiers au premier niveau, pour la première version de l'app (identique à sections.assignments.data) */
  assignments: Record<string, unknown>
  sections: Record<string, { v: number; data: unknown } | null>
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

const plural = (n: number, [one, many]: [string, string]) => `${n} ${n > 1 ? many : one}`
const NEWER_APP = 'Ce fichier vient d’une version plus récente de l’application. Mets-la à jour avant de restaurer.'

// — Photos ———————————————————————————————————————————————————————————————

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`
}

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/

export function isPhotoDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_PHOTO_DATA_URL && DATA_URL_RE.test(value)
}

export function dataUrlToBlob(url: string): Blob {
  const [, type, b64] = DATA_URL_RE.exec(url) ?? []
  if (!type) throw new BackupError('Photo illisible.')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Taille approximative des photos une fois incluses dans le fichier (base64 : +33 %). */
export function estimatePhotosSize(blobs: Blob[]): number {
  return blobs.reduce((n, b) => n + Math.ceil(b.size / 3) * 4 + 40, 0)
}

function portraitsOf(all: Record<string, unknown>): Record<string, Blob> {
  const out: Record<string, Blob> = {}
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PORTRAIT_PREFIX) && isBlobLike(value)) out[key.slice(PORTRAIT_PREFIX.length)] = value
  }
  return out
}

// — Export ———————————————————————————————————————————————————————————————

/**
 * Sauvegarde complète : toutes les sections, même vides.
 * `data` permet de partir d'autres données que celles en place (copie de secours).
 * Sans photo sur le téléphone, la section vaut `null` : restaurer ce fichier ne
 * supprimera donc jamais des photos ajoutées depuis.
 */
export async function createBackup({ includePhotos, data }: { includePhotos: boolean; data?: DataMap }): Promise<BackupFile> {
  const all = await readEntries()
  const source = data ?? all
  const sections: BackupFile['sections'] = {}
  for (const s of DATA_SECTIONS) sections[s.id] = { v: s.version, data: s.sanitize(source[s.key]) }

  const portraits = portraitsOf(all)
  if (includePhotos && Object.keys(portraits).length > 0) {
    const photos: Record<string, string> = {}
    for (const [id, blob] of Object.entries(portraits)) photos[id] = await blobToDataUrl(blob)
    sections.photos = { v: PHOTOS_VERSION, data: photos }
  } else {
    sections.photos = null
  }
  return {
    app: APP_ID,
    format: BACKUP_FORMAT,
    type: 'complete',
    exportedAt: new Date().toISOString(),
    schema: schemaOf(all),
    // Même objet que la section : les deux copies ne peuvent pas diverger.
    assignments: sections.assignments!.data as Record<string, unknown>,
    sections,
  }
}

/**
 * Copie de secours quand l'app ne peut pas démarrer. Si une migration n'est pas allée
 * au bout, on part des données d'origine conservées avant cette migration ; sinon des
 * données actuelles. Échoue (sans rien prétendre) si la base est illisible.
 */
export async function createRescueBackup(): Promise<BackupFile> {
  const all = await readEntries()
  const unfinished = schemaOf(all) < CURRENT_SCHEMA || MIGRATION_KEY in all
  const snapshot = all[snapshotKey(CURRENT_SCHEMA)] as { data?: unknown } | undefined
  const data = unfinished && isPlainObject(snapshot?.data) ? snapshot.data : undefined
  return createBackup({ includePhotos: true, data })
}

export function backupFileName(date = new Date()): string {
  return `dreamlight-compagnons-${date.toISOString().slice(0, 10)}.json`
}

// — Lecture d'un fichier ————————————————————————————————————————————————

export interface ParsedSection {
  id: string
  key: string
  label: string
  data: Record<string, unknown>
  unit: [string, string]
  /** Entrées du fichier écartées (habitant, métier ou élément inconnu du catalogue) */
  ignored: number
}

export type ParsedPhotos =
  | { state: 'absent' }
  | { state: 'not-included' }
  | {
      state: 'included'
      /** Photos lisibles d'habitants connus */
      data: Record<string, string>
      /** Habitants connus dont la photo du fichier est illisible : la photo du téléphone est gardée */
      unreadable: string[]
      /** Photos d'habitants inconnus, écartées */
      ignored: number
    }

export interface ParsedBackup {
  type: 'complete' | 'partial'
  format: 1 | 2
  exportedAt?: string
  /** Sections présentes dans le fichier, déjà nettoyées */
  sections: ParsedSection[]
  photos: ParsedPhotos
  /** Sections que cette version ne connaît pas (import partiel uniquement : signalées puis ignorées) */
  unknownSections: string[]
  /** Données écrites par une version plus récente (import partiel uniquement) */
  newerSchema: boolean
}

function parseSection(def: DataSection<Record<string, unknown>>, raw: unknown): ParsedSection {
  const data = def.sanitize(raw)
  const size = def.size ?? objectCount
  return { id: def.id, key: def.key, label: def.label, unit: def.unit, data, ignored: Math.max(0, size(raw) - size(data)) }
}

const damaged = (label: string) => new BackupError(`La section « ${label} » du fichier est abîmée. Rien n’a été restauré.`)

function parsePhotos(sections: Record<string, unknown>): ParsedPhotos {
  if (!Object.hasOwn(sections, 'photos')) return { state: 'absent' }
  const raw = sections.photos
  if (raw === null) return { state: 'not-included' }
  if (!isPlainObject(raw) || typeof raw.v !== 'number' || !isPlainObject(raw.data)) throw damaged('Photos personnelles')
  if (raw.v > PHOTOS_VERSION) throw new BackupError(NEWER_APP)
  const data: Record<string, string> = {}
  const unreadable: string[] = []
  let ignored = 0
  for (const [id, url] of Object.entries(raw.data)) {
    if (!isCharacterId(id)) ignored++
    else if (isPhotoDataUrl(url)) data[id] = url
    else unreadable.push(id)
  }
  return { state: 'included', data, unreadable, ignored }
}

export function parseBackupText(text: string): ParsedBackup {
  if (utf8Size(text) > MAX_BACKUP_BYTES) throw new BackupError(BACKUP_TOO_LARGE)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('Ce fichier n’est pas une sauvegarde lisible.')
  }
  if (!isPlainObject(raw) || raw.app !== APP_ID) throw new BackupError('Ce fichier ne vient pas de Dreamlight Compagnons.')
  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : undefined

  // Ancien format (version 1) : uniquement les métiers.
  if (raw.format === undefined && raw.version === 1) {
    const def = DATA_SECTIONS.find((s) => s.id === 'assignments')!
    if (!isPlainObject(raw.assignments)) throw damaged(def.label)
    return { type: 'partial', format: 1, exportedAt, sections: [parseSection(def, raw.assignments)], photos: { state: 'absent' }, unknownSections: [], newerSchema: false }
  }
  if (typeof raw.format === 'number' && raw.format > BACKUP_FORMAT) throw new BackupError(NEWER_APP)
  if (raw.format !== BACKUP_FORMAT || !isPlainObject(raw.sections)) throw new BackupError('Ce fichier n’est pas une sauvegarde lisible.')

  const type = raw.type === 'complete' ? 'complete' : 'partial'
  const fileSections = raw.sections
  const unknownSections = Object.keys(fileSections).filter((id) => !KNOWN_SECTIONS.has(id))
  const newerSchema = typeof raw.schema === 'number' && raw.schema > CURRENT_SCHEMA
  if (type === 'complete' && (unknownSections.length || newerSchema)) {
    const what = unknownSections.length ? ` (${unknownSections.map((s) => `« ${s} »`).join(', ')})` : ''
    throw new BackupError(
      `Restauration complète impossible : ce fichier contient des données que cette version de l’app ne sait pas lire${what}. Mets l’app à jour avant de restaurer.`,
    )
  }

  const sections: ParsedSection[] = []
  for (const def of DATA_SECTIONS) {
    if (!Object.hasOwn(fileSections, def.id)) continue
    const s = fileSections[def.id]
    if (!isPlainObject(s) || typeof s.v !== 'number' || !isPlainObject(s.data)) throw damaged(def.label)
    if (s.v > def.version) throw new BackupError(NEWER_APP)
    sections.push(parseSection(def, s.data))
  }

  // Copie des métiers pour l'ancienne version : doit être identique à la section.
  if (Object.hasOwn(raw, 'assignments')) {
    const section = fileSections.assignments as { data?: unknown } | undefined
    if (!section || !sameJson(raw.assignments, section.data)) {
      throw new BackupError('Les deux copies des métiers contenues dans le fichier ne correspondent pas : fichier modifié ou abîmé.')
    }
  }

  return { type, format: 2, exportedAt, sections, photos: parsePhotos(fileSections), unknownSections, newerSchema }
}

// — Ce que la restauration va faire ———————————————————————————————————

export type PlanAction = 'replace' | 'keep' | 'delete' | 'ignore'

export interface PlanItem {
  id: string
  label: string
  action: PlanAction
  detail: string
}

const ignoredNote = (n: number) => (n ? ` · ${n} entrée${n > 1 ? 's' : ''} inconnue${n > 1 ? 's' : ''} ignorée${n > 1 ? 's' : ''}` : '')

/** Photos du téléphone après restauration : celles du fichier + celles gardées faute de photo lisible. */
function photoOutcome(photos: Extract<ParsedPhotos, { state: 'included' }>, current: string[]) {
  const kept = current.filter((id) => photos.unreadable.includes(id))
  const removed = current.filter((id) => !Object.hasOwn(photos.data, id) && !photos.unreadable.includes(id))
  return { kept, removed }
}

export async function planRestore(parsed: ParsedBackup): Promise<PlanItem[]> {
  const all = await readEntries()
  const items: PlanItem[] = []

  for (const def of DATA_SECTIONS) {
    const incoming = parsed.sections.find((s) => s.id === def.id)
    const now = def.count(def.sanitize(all[def.key]))
    if (!incoming) {
      items.push({ id: def.id, label: def.label, action: 'keep', detail: `Conservés (${plural(now, def.unit)}) : absents du fichier` })
      continue
    }
    const next = def.count(incoming.data)
    items.push({ id: def.id, label: def.label, action: 'replace', detail: `Remplacés : ${now} actuellement → ${next} dans le fichier${ignoredNote(incoming.ignored)}` })
  }

  const current = Object.keys(portraitsOf(all))
  const photos = parsed.photos
  if (photos.state === 'absent' || photos.state === 'not-included') {
    const why = photos.state === 'absent' ? 'absentes du fichier' : 'non incluses dans le fichier'
    items.push({ id: 'photos', label: 'Photos personnelles', action: 'keep', detail: `Conservées (${plural(current.length, ['photo', 'photos'])}) : ${why}` })
  } else {
    const incoming = Object.keys(photos.data).length
    const { removed } = photoOutcome(photos, current)
    const notes =
      (photos.unreadable.length
        ? ` · ${plural(photos.unreadable.length, ['photo illisible', 'photos illisibles'])} dans le fichier : celle du téléphone est gardée`
        : '') + ignoredNote(photos.ignored)
    if (incoming === 0) {
      items.push({
        id: 'photos',
        label: 'Photos personnelles',
        action: removed.length ? 'delete' : 'keep',
        detail: removed.length
          ? `Supprimées : ${plural(removed.length, ['photo', 'photos'])} du téléphone (la sauvegarde n’en contient aucune)${notes}`
          : `Aucune photo supprimée${notes}`,
      })
    } else {
      const removedNote = removed.length ? ` (dont ${removed.length} supprimée${removed.length > 1 ? 's' : ''})` : ''
      items.push({ id: 'photos', label: 'Photos personnelles', action: 'replace', detail: `Remplacées : ${current.length} actuellement → ${incoming} dans le fichier${removedNote}${notes}` })
    }
  }

  for (const id of parsed.unknownSections) {
    items.push({ id: `unknown:${id}`, label: `Section « ${id} »`, action: 'ignore', detail: 'Ignorée : cette version de l’app ne la connaît pas.' })
  }
  if (parsed.newerSchema) {
    items.push({
      id: 'schema',
      label: 'Version du fichier',
      action: 'ignore',
      detail: 'Créé par une version plus récente de l’app : seules les données connues seront importées.',
    })
  }
  return items
}

// — Restauration et annulation ———————————————————————————————————————

interface RestoreSnapshot {
  at: string
  /** Valeurs d'avant la restauration, pour les clés remplacées */
  data: Record<string, unknown>
  /** Clés remplacées qui n'existaient pas avant */
  absent: string[]
  /** Photos d'avant, si la restauration les a modifiées */
  photos?: Record<string, Blob>
}

function isRestoreSnapshot(v: unknown): v is RestoreSnapshot {
  const s = v as RestoreSnapshot | undefined
  return !!s && typeof s === 'object' && typeof s.at === 'string' && isPlainObject(s.data) && Array.isArray(s.absent)
}

export interface RestoreOptions {
  /** Tests : appelé au milieu de la transaction (lever une erreur simule une interruption). */
  duringWrite?: () => void
}

/**
 * Restaure le fichier. Dans UNE seule transaction : lecture de l'état actuel, copie
 * de sécurité (`snapshot:pre-import`) et remplacement des sections concernées.
 * Si quoi que ce soit échoue, rien n'est écrit, pas même la copie : l'annulation
 * ne peut donc pas être proposée à tort. Le résultat est ensuite relu et vérifié.
 */
export async function applyRestore(parsed: ParsedBackup, { duringWrite }: RestoreOptions = {}): Promise<void> {
  const photos = parsed.photos.state === 'included' ? parsed.photos : undefined
  // Préparé AVANT la transaction : on ne peut rien attendre d'autre pendant une transaction IndexedDB.
  const incomingBlobs = photos ? Object.entries(photos.data).map(([id, url]) => [id, dataUrlToBlob(url)] as const) : []
  const keys = parsed.sections.map((s) => s.key)

  const expectedPhotos = await transact(
    { keys, prefixes: photos ? [PORTRAIT_PREFIX] : [] },
    (values) => {
      const snapshot: RestoreSnapshot = { at: new Date().toISOString(), data: {}, absent: [] }
      for (const key of keys) {
        if (Object.hasOwn(values, key)) snapshot.data[key] = values[key]
        else snapshot.absent.push(key)
      }
      const set: [string, unknown][] = parsed.sections.map((s) => [s.key, s.data])
      const del: string[] = []
      let finalPhotos: string[] | undefined
      if (photos) {
        const current = portraitsOf(values)
        snapshot.photos = current
        const { kept, removed } = photoOutcome(photos, Object.keys(current))
        for (const [id, blob] of incomingBlobs) set.push([PORTRAIT_PREFIX + id, blob])
        for (const id of removed) del.push(PORTRAIT_PREFIX + id)
        finalPhotos = [...Object.keys(photos.data), ...kept].sort()
      }
      set.unshift([RESTORE_SNAPSHOT_KEY, snapshot])
      return { ops: { set, del }, result: finalPhotos }
    },
    duringWrite,
  )

  // Vérification : relecture de ce qui vient d'être écrit
  const reread = await readKeys(keys)
  let ok = parsed.sections.every((s, i) => sameJson(reread[i], s.data))
  if (expectedPhotos) ok &&= sameJson(Object.keys(portraitsOf(await readEntries())).sort(), expectedPhotos)
  if (!ok) throw new BackupError('La restauration n’a pas pu être vérifiée. Utilise « Annuler la dernière restauration ».')
}

export async function lastRestore(): Promise<{ at: string } | null> {
  const s = await readKey(RESTORE_SNAPSHOT_KEY)
  return isRestoreSnapshot(s) ? { at: s.at } : null
}

/** Revient exactement à l'état d'avant la dernière restauration (une seule fois), en une transaction. */
export async function undoLastRestore(): Promise<void> {
  await transact({ keys: [RESTORE_SNAPSHOT_KEY], prefixes: [PORTRAIT_PREFIX] }, (values) => {
    const snap = values[RESTORE_SNAPSHOT_KEY]
    if (!isRestoreSnapshot(snap)) throw new BackupError('Aucune restauration à annuler.')
    const set: [string, unknown][] = Object.entries(snap.data)
    const del: string[] = [...snap.absent, RESTORE_SNAPSHOT_KEY]
    if (snap.photos) {
      for (const id of Object.keys(portraitsOf(values))) if (!Object.hasOwn(snap.photos, id)) del.push(PORTRAIT_PREFIX + id)
      for (const [id, blob] of Object.entries(snap.photos)) set.push([PORTRAIT_PREFIX + id, blob])
    }
    return { ops: { set, del }, result: undefined }
  })
}
