import { isPlainObject } from '../../lib/db'
import { ANIGAMI_TYPES, TALES, TALE_BY_ID, isAnigamiId, isTaleId, type Tale } from './data'

/**
 * Suivi des puzzles et des anigamis (saisi à la main, jamais déduit du jeu).
 *
 * Clé IndexedDB : `tales` → { counts, puzzles, log }.
 * - `counts[idType]` : nombre d'anigamis possédés, INDÉPENDANT pour chaque type (jamais négatif).
 * - `puzzles[idPuzzle]` : puzzle terminé. `opId` n'est présent que si le puzzle a été validé AVEC déduction.
 * - `log` : journal des 20 dernières validations avec déduction. Chaque entrée garde les quantités
 *   exactement déduites (`deltas`) : l'annulation les RENDS aux compteurs actuels (delta inverse), sans
 *   jamais réécrire un ancien compteur. Les modifications manuelles faites entre-temps sont donc conservées.
 */
export const TALES_KEY = 'tales'
/** Maximum accepté à la saisie */
export const MAX_COUNT = 9999
/** Maximum accepté à la lecture (laisse de la marge à une annulation qui rend des anigamis) */
const HARD_MAX = 999_999
export const LOG_LIMIT = 20

export interface PuzzleState {
  doneAt: string
  /** Présent seulement si validé avec déduction : relie le puzzle à l'entrée du journal */
  opId?: string
}

export interface Validation {
  id: string
  at: string
  taleId: string
  /** Quantités déduites, par type */
  deltas: Record<string, number>
}

export interface TalesData {
  counts: Record<string, number>
  puzzles: Record<string, PuzzleState>
  log: Validation[]
}

export const emptyTales = (): TalesData => ({ counts: {}, puzzles: {}, log: [] })

const OP_ID_RE = /^op-[a-z0-9]{6,24}$/
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= HARD_MAX

/** Ne garde que des données cohérentes : types, puzzles et validations du catalogue, quantités valides. */
export function sanitizeTales(raw: unknown): TalesData {
  const out = emptyTales()
  if (!isPlainObject(raw)) return out
  if (isPlainObject(raw.counts)) for (const [id, n] of Object.entries(raw.counts)) if (isAnigamiId(id) && isCount(n)) out.counts[id] = n
  if (isPlainObject(raw.puzzles)) {
    for (const [id, p] of Object.entries(raw.puzzles)) {
      if (!isTaleId(id) || !isPlainObject(p) || !isIso(p.doneAt)) continue
      out.puzzles[id] = { doneAt: p.doneAt, ...(typeof p.opId === 'string' && OP_ID_RE.test(p.opId) ? { opId: p.opId } : {}) }
    }
  }
  const seen = new Set<string>()
  for (const v of Array.isArray(raw.log) ? raw.log : []) {
    if (!isPlainObject(v) || typeof v.id !== 'string' || !OP_ID_RE.test(v.id) || seen.has(v.id) || !isTaleId(v.taleId) || !isIso(v.at) || !isPlainObject(v.deltas)) continue
    // Une validation n'existe que si son puzzle est toujours terminé par cette même validation.
    if (out.puzzles[v.taleId]?.opId !== v.id) continue
    const deltas: Record<string, number> = {}
    for (const [type, n] of Object.entries(v.deltas)) if (isAnigamiId(type) && isCount(n)) deltas[type] = n
    if (!Object.keys(deltas).length) continue
    seen.add(v.id)
    out.log.push({ id: v.id, at: v.at, taleId: v.taleId, deltas })
  }
  out.log = out.log.slice(-LOG_LIMIT)
  return out
}

// — Opérations (fonctions pures, appliquées dans une transaction atomique) ——————————

export type TaleOp =
  /** ± quantité relative : deux onglets qui ajoutent en même temps conservent les deux ajouts */
  | { type: 'adjust'; id: string; delta: number }
  | { type: 'set-count'; id: string; count: number }
  /** Valide un puzzle EN DÉDUISANT les anigamis (vérifie les quantités dans la transaction) */
  | { type: 'validate'; taleId: string; opId: string }
  /** Marque un puzzle terminé SANS rien déduire */
  | { type: 'mark-done'; taleId: string }
  /** Remet un puzzle en cours (ne rend jamais d'anigamis : pour cela, annuler la validation) */
  | { type: 'reopen'; taleId: string }
  /** Annule la dernière validation avec déduction : rend exactement ce qui avait été déduit */
  | { type: 'undo-last' }

export class TaleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaleError'
  }
}

const owned = (data: TalesData, id: string) => data.counts[id] ?? 0

function withCount(counts: Record<string, number>, id: string, n: number): Record<string, number> {
  const next = { ...counts }
  if (n > 0) next[id] = n
  else delete next[id]
  return next
}

export function applyTaleOp(data: TalesData, op: TaleOp, now: Date): TalesData {
  const at = now.toISOString()
  switch (op.type) {
    case 'adjust': {
      if (!isAnigamiId(op.id) || !Number.isInteger(op.delta)) throw new TaleError('Type d’anigami inconnu.')
      const n = owned(data, op.id) + op.delta
      if (n < 0) throw new TaleError('Un compteur ne peut pas être négatif.')
      if (n > MAX_COUNT) throw new TaleError(`Le maximum est ${MAX_COUNT}.`)
      return { ...data, counts: withCount(data.counts, op.id, n) }
    }
    case 'set-count': {
      if (!isAnigamiId(op.id)) throw new TaleError('Type d’anigami inconnu.')
      if (!Number.isInteger(op.count) || op.count < 0) throw new TaleError('Un compteur ne peut pas être négatif.')
      if (op.count > MAX_COUNT) throw new TaleError(`Le maximum est ${MAX_COUNT}.`)
      return { ...data, counts: withCount(data.counts, op.id, op.count) }
    }
    case 'validate': {
      const tale = isTaleId(op.taleId) ? TALE_BY_ID[op.taleId] : undefined
      if (!tale) throw new TaleError('Puzzle inconnu.')
      if (!OP_ID_RE.test(op.opId)) throw new TaleError('Identifiant d’opération invalide.')
      if (data.puzzles[tale.id]) throw new TaleError('Ce puzzle est déjà terminé.')
      if (tale.costStatus === 'conflict') throw new TaleError('Les coûts de ce puzzle sont à confirmer : aucune déduction automatique.')
      const lacking = Object.entries(tale.cost).filter(([type, qty]) => owned(data, type) < qty)
      if (lacking.length) throw new TaleError('Anigamis insuffisants : rien n’a été déduit.')
      let counts = data.counts
      for (const [type, qty] of Object.entries(tale.cost)) counts = withCount(counts, type, owned(data, type) - qty)
      const log = [...data.log, { id: op.opId, at, taleId: tale.id, deltas: { ...tale.cost } }].slice(-LOG_LIMIT)
      return { counts, puzzles: { ...data.puzzles, [tale.id]: { doneAt: at, opId: op.opId } }, log }
    }
    case 'mark-done': {
      if (!isTaleId(op.taleId)) throw new TaleError('Puzzle inconnu.')
      if (data.puzzles[op.taleId]) throw new TaleError('Ce puzzle est déjà terminé.')
      return { ...data, puzzles: { ...data.puzzles, [op.taleId]: { doneAt: at } } }
    }
    case 'reopen': {
      const state = isTaleId(op.taleId) ? data.puzzles[op.taleId] : undefined
      if (!state) throw new TaleError('Ce puzzle n’est pas terminé.')
      const puzzles = { ...data.puzzles }
      delete puzzles[op.taleId]
      // Sa validation n'est plus annulable (le puzzle n'est plus terminé par elle) : on la retire du journal.
      return { ...data, puzzles, log: state.opId ? data.log.filter((v) => v.id !== state.opId) : data.log }
    }
    case 'undo-last': {
      const last = data.log[data.log.length - 1]
      if (!last) throw new TaleError('Aucune validation à annuler.')
      if (data.puzzles[last.taleId]?.opId !== last.id) throw new TaleError('Cette validation ne peut plus être annulée : le puzzle a été modifié depuis.')
      // Delta inverse : on RENDS ce qui avait été déduit aux compteurs ACTUELS (modifications manuelles conservées).
      let counts = data.counts
      for (const [type, qty] of Object.entries(last.deltas)) counts = withCount(counts, type, Math.min(HARD_MAX, owned(data, type) + qty))
      const puzzles = { ...data.puzzles }
      delete puzzles[last.taleId]
      return { counts, puzzles, log: data.log.slice(0, -1) }
    }
  }
}

export function newOpId(): string {
  return `op-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

// — Lecture : état de chaque puzzle et progression ———————————————————————————

/**
 * - `done` : terminé ;
 * - `ready` : assez d'anigamis pour CE puzzle (plusieurs puzzles peuvent se partager les mêmes anigamis) ;
 * - `missing` : il manque des anigamis ;
 * - `to-confirm` : coûts contradictoires entre les sources : ni réalisable ni manquant, pas de déduction.
 */
export type PuzzleStatus = 'done' | 'ready' | 'missing' | 'to-confirm'

export interface PuzzleView {
  tale: Tale
  status: PuzzleStatus
  /** Anigamis manquants par type (seulement ceux qui manquent) */
  missing: Record<string, number>
  missingTotal: number
  state?: PuzzleState
}

export function puzzleView(data: TalesData, tale: Tale): PuzzleView {
  const state = data.puzzles[tale.id]
  const missing: Record<string, number> = {}
  for (const [type, qty] of Object.entries(tale.cost)) if (owned(data, type) < qty) missing[type] = qty - owned(data, type)
  const missingTotal = Object.values(missing).reduce((a, b) => a + b, 0)
  const status: PuzzleStatus = state ? 'done' : tale.costStatus === 'conflict' ? 'to-confirm' : missingTotal === 0 ? 'ready' : 'missing'
  return { tale, status, missing, missingTotal, ...(state ? { state } : {}) }
}

export interface TypeUsage {
  /** Possédés */
  owned: number
  /** Nécessaires pour terminer les puzzles restants (hors coûts à confirmer) */
  needed: number
  /** Encore à obtenir pour tous les terminer : max(0, nécessaires − possédés) */
  missing: number
}

export interface TalesSummary {
  total: number
  done: number
  ready: number
  missing: number
  toConfirm: number
  /** Totaux sur les 16 anigamis CAPTURABLES (les 5 objets de quête n'y figurent pas : ils ne se capturent pas) */
  ownedTotal: number
  neededTotal: number
  missingTotal: number
  perType: Record<string, TypeUsage>
}

export function summarizeTales(data: TalesData): TalesSummary {
  const views = TALES.map((t) => puzzleView(data, t))
  const count = (s: PuzzleStatus) => views.filter((v) => v.status === s).length
  const needed: Record<string, number> = {}
  for (const v of views) if (v.status === 'ready' || v.status === 'missing') for (const [type, qty] of Object.entries(v.tale.cost)) needed[type] = (needed[type] ?? 0) + qty
  const perType: Record<string, TypeUsage> = {}
  for (const a of ANIGAMI_TYPES) {
    const o = owned(data, a.id)
    const n = needed[a.id] ?? 0
    perType[a.id] = { owned: o, needed: n, missing: Math.max(0, n - o) }
  }
  const sum = (f: (u: TypeUsage) => number) => ANIGAMI_TYPES.filter((a) => a.origin === 'catch').reduce((acc, a) => acc + f(perType[a.id]), 0)
  return {
    total: TALES.length,
    done: count('done'),
    ready: count('ready'),
    missing: count('missing'),
    toConfirm: count('to-confirm'),
    ownedTotal: sum((u) => u.owned),
    neededTotal: sum((u) => u.needed),
    missingTotal: sum((u) => u.missing),
    perType,
  }
}

/** La dernière validation, si elle peut encore être annulée. */
export function lastUndoable(data: TalesData): Validation | undefined {
  const last = data.log[data.log.length - 1]
  return last && data.puzzles[last.taleId]?.opId === last.id ? last : undefined
}
