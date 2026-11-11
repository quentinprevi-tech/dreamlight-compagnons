import type { CollectionId } from '../../data/characters'
import { isPlainObject } from '../../lib/db'
import { localDayKey } from '../tasks/recurrence'
import { availabilityAt, type Availability } from './availability'
import { CRITTER_DLC, CRITTER_VARIANTS, isVariantId, type CritterVariant } from './data'

/**
 * Suivi des créatures apprivoisables (saisi à la main, jamais déduit du jeu).
 *
 * Clé IndexedDB : `critters` → { owned, progress }.
 * - `progress[idVariante]` : progression INDÉPENDANTE pour chaque variante de couleur
 *   (le wiki : chaque variante a sa fiche, son entrée de collection et son minimum).
 * - Un seul nourrissage par jour calendaire local augmente la progression d'une variante
 *   (le wiki : « only the first successful feeding each day … count[s] », remise à zéro
 *   à minuit, heure locale). Seul un nourrissage RÉUSSI (aliment préféré ou apprécié, accepté
 *   par l'animal) doit être enregistré : l'app ne peut pas le vérifier, c'est la joueuse qui l'indique.
 * - `owned` : extensions possédées, CHOISIES par la joueuse. Une extension non choisie est considérée
 *   comme NON possédée (jamais supposée) : ses variantes sont masquées et ne comptent pas dans « Aujourd'hui ».
 *   `configured` : la joueuse a fait sa configuration initiale (jeu de base seul = choix valide).
 */
export const CRITTERS_KEY = 'critters'
export const MAX_FEEDINGS = 99
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export interface CritterProgress {
  /** Dans la collection (coché par la joueuse) */
  obtained?: true
  /** Nourrissages réussis comptés (un par jour au plus, ou corrigés à la main) */
  feedings?: number
  /** Jour (AAAA-MM-JJ, heure locale) du dernier nourrissage compté */
  lastFed?: string
  /** Jour du nourrissage compté juste avant : permet d'annuler celui d'aujourd'hui */
  prevFed?: string
}

export interface CrittersData {
  /** Extensions possédées. Une extension absente ou à `false` n'est PAS possédée. */
  owned: Partial<Record<CollectionId, boolean>>
  /** Configuration initiale faite (le jeu de base seul est un choix valide) */
  configured: boolean
  progress: Record<string, CritterProgress>
}

export const emptyCritters = (): CrittersData => ({ owned: {}, configured: false, progress: {} })

function sanitizeProgress(raw: unknown): CritterProgress {
  const out: CritterProgress = {}
  if (!isPlainObject(raw)) return out
  if (raw.obtained === true) out.obtained = true
  if (typeof raw.feedings === 'number' && Number.isInteger(raw.feedings) && raw.feedings >= 1 && raw.feedings <= MAX_FEEDINGS) out.feedings = raw.feedings
  if (typeof raw.lastFed === 'string' && DAY_RE.test(raw.lastFed)) out.lastFed = raw.lastFed
  if (out.lastFed && typeof raw.prevFed === 'string' && DAY_RE.test(raw.prevFed) && raw.prevFed < out.lastFed) out.prevFed = raw.prevFed
  return out
}

/** Ne garde que les variantes du catalogue, les extensions connues et des valeurs valides. */
export function sanitizeCritters(raw: unknown): CrittersData {
  const out = emptyCritters()
  if (!isPlainObject(raw)) return out
  if (isPlainObject(raw.owned)) {
    for (const id of CRITTER_DLC) if (typeof raw.owned[id] === 'boolean') out.owned[id] = raw.owned[id]
  }
  // Un choix d'extension déjà enregistré vaut configuration faite.
  out.configured = raw.configured === true || Object.keys(out.owned).length > 0
  if (isPlainObject(raw.progress)) {
    for (const [id, value] of Object.entries(raw.progress)) {
      if (!isVariantId(id)) continue
      const progress = sanitizeProgress(value)
      if (Object.keys(progress).length) out.progress[id] = progress
    }
  }
  return out
}

/** Jamais supposée : une extension non cochée par la joueuse n'est pas possédée. */
export function isOwned(data: CrittersData, collection: CollectionId): boolean {
  return collection === 'base' || data.owned[collection] === true
}

/** Variantes visibles : celles des extensions possédées. */
export function ownedVariants(data: CrittersData): CritterVariant[] {
  return CRITTER_VARIANTS.filter((v) => isOwned(data, v.collection))
}

export function obtainedStats(data: CrittersData): { obtained: number; total: number } {
  const owned = ownedVariants(data)
  return { obtained: owned.filter((v) => data.progress[v.id]?.obtained).length, total: owned.length }
}

// — Opérations (fonctions pures, appliquées dans une transaction atomique) ——————————

export type CritterOp =
  | { type: 'obtained'; id: string; value: boolean }
  /** Nourrissage réussi aujourd'hui : compté UNE seule fois par jour */
  | { type: 'feed'; id: string }
  /** Annule le nourrissage compté aujourd'hui (erreur de saisie) */
  | { type: 'unfeed'; id: string }
  /** Correction manuelle du total (nourrissages faits avant d'utiliser l'app…) */
  | { type: 'set-feedings'; id: string; count: number }
  | { type: 'owned'; collection: CollectionId; value: boolean }
  /** Configuration initiale ou « tout sélectionner » : fixe les quatre extensions d'un coup */
  | { type: 'set-extensions'; owned: Partial<Record<CollectionId, boolean>> }

export class CritterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CritterError'
  }
}

export function applyCritterOp(data: CrittersData, op: CritterOp, now: Date): CrittersData {
  if (op.type === 'owned') {
    if (!CRITTER_DLC.includes(op.collection) || typeof op.value !== 'boolean') throw new CritterError('Extension inconnue.')
    return { ...data, configured: true, owned: { ...data.owned, [op.collection]: op.value } }
  }
  if (op.type === 'set-extensions') {
    const owned: Partial<Record<CollectionId, boolean>> = {}
    for (const c of CRITTER_DLC) {
      const value = op.owned[c]
      if (value !== undefined && typeof value !== 'boolean') throw new CritterError('Extension invalide.')
      owned[c] = value === true
    }
    return { ...data, configured: true, owned }
  }
  if (!isVariantId(op.id)) throw new CritterError('Animal inconnu.')
  const day = localDayKey(now)
  const current = data.progress[op.id] ?? {}
  let next: CritterProgress = { ...current }

  switch (op.type) {
    case 'obtained':
      if (op.value) next.obtained = true
      else delete next.obtained
      break
    case 'feed':
      if (current.obtained) throw new CritterError('Cet animal est déjà obtenu.')
      // Un seul nourrissage par jour : un second appui (ou l'autre onglet) ne change rien.
      if (current.lastFed === day) return data
      if (current.lastFed) next.prevFed = current.lastFed
      else delete next.prevFed
      next.lastFed = day
      next.feedings = Math.min(MAX_FEEDINGS, (current.feedings ?? 0) + 1)
      break
    case 'unfeed': {
      if (current.lastFed !== day) return data
      const count = (current.feedings ?? 1) - 1
      if (count > 0) next.feedings = count
      else delete next.feedings
      if (current.prevFed) next.lastFed = current.prevFed
      else delete next.lastFed
      delete next.prevFed
      break
    }
    case 'set-feedings':
      if (!Number.isInteger(op.count) || op.count < 0 || op.count > MAX_FEEDINGS) throw new CritterError(`Le total doit être entre 0 et ${MAX_FEEDINGS}.`)
      if (op.count === 0) delete next.feedings
      else next.feedings = op.count
      break
  }
  next = sanitizeProgress(next)
  const progress = { ...data.progress }
  if (Object.keys(next).length) progress[op.id] = next
  else delete progress[op.id]
  return { ...data, progress }
}

// — Aujourd'hui ———————————————————————————————————————————————————————————

export interface VariantToday {
  variant: CritterVariant
  availability: Availability
  fedToday: boolean
}

export interface CritterToday {
  /** Réalisables aujourd'hui et déjà nourris : comptent dans X */
  fed: VariantToday[]
  /** Présents ou disponibles plus tard, pas encore nourris : restent à faire */
  toFeed: VariantToday[]
  /** Créneau terminé sans nourrissage : « Occasion manquée », hors compteur */
  missed: VariantToday[]
  /** Météo ou quête requise : jamais comptés (l'app ne les connaît pas) */
  conditional: VariantToday[]
  /** Horaire inconnu ou contradictoire : jamais comptés */
  unknown: VariantToday[]
  /** Aucun créneau aujourd'hui */
  absent: VariantToday[]
  /** X : nourris aujourd'hui parmi les réalisables */
  done: number
  /** Y : nourris + encore à nourrir (les occasions manquées en sont exclues) */
  total: number
}

function byUrgency(a: VariantToday, b: VariantToday): number {
  const rank = (t: VariantToday) => (t.availability.state === 'present' ? t.availability.until : 100 + (t.availability.state === 'later' ? t.availability.from : 0))
  return rank(a) - rank(b) || a.variant.nameEn.localeCompare(b.variant.nameEn)
}

/**
 * Compteur du jour. Ne retient que les variantes non obtenues, des extensions possédées,
 * à horaire connu et sans condition externe. Les créneaux déjà passés sans nourrissage
 * sortent du compteur (« Occasion manquée ») : Y ne contient que ce qui est encore réalisable.
 */
export function summarizeToday(data: CrittersData, now: Date): CritterToday {
  const day = localDayKey(now)
  const out: CritterToday = { fed: [], toFeed: [], missed: [], conditional: [], unknown: [], absent: [], done: 0, total: 0 }
  for (const variant of ownedVariants(data)) {
    const progress = data.progress[variant.id]
    if (progress?.obtained) continue
    const entry: VariantToday = { variant, availability: availabilityAt(variant, now), fedToday: progress?.lastFed === day }
    if (entry.availability.state === 'unknown') out.unknown.push(entry)
    else if (variant.condition) out.conditional.push(entry)
    else if (entry.fedToday) out.fed.push(entry)
    else if (entry.availability.state === 'present' || entry.availability.state === 'later') out.toFeed.push(entry)
    else if (entry.availability.state === 'passed') out.missed.push(entry)
    else out.absent.push(entry)
  }
  out.toFeed.sort(byUrgency)
  out.done = out.fed.length
  out.total = out.fed.length + out.toFeed.length
  return out
}

