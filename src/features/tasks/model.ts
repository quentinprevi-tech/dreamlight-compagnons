import { isPlainObject } from '../../lib/db'
import { isTemplateId, TASK_TEMPLATES, TASK_TEMPLATES_BY_ID, type TaskTemplate } from './catalog'
import { isValidRecurrence, localDayKey, periodKey, type Recurrence } from './recurrence'

/**
 * Tâches du jour. Trois notions bien distinctes :
 * 1. les MODÈLES disponibles : catalogue (`catalog.ts`) + tâches personnalisées ;
 * 2. les modèles ACTIVÉS par la joueuse (`enabled`, sinon valeur par défaut du catalogue) ;
 * 3. les OCCURRENCES : une par période de la récurrence (`<id>@<période>`), avec leur état
 *    (faite, retirée). Rien n'est « généré » : l'occurrence en cours est calculée à partir
 *    de l'heure, ce qui évite toute perte au changement de date.
 *
 * Reportées : liste à part, une entrée par tâche au plus, jusqu'à réalisation ou suppression.
 * Clé IndexedDB : `tasks`. Les entrées de plus de 14 jours sont nettoyées.
 */
export const TASKS_KEY = 'tasks'
export const HISTORY_DAYS = 7
const KEEP_DAYS = 14
export const MAX_LABEL = 80

export interface CustomTask {
  id: string
  label: string
  recurrence: Recurrence
  createdAt: string
}

export interface Postponed {
  /** Tâche d'origine */
  taskId: string
  /** Libellé au moment du report */
  label: string
  /** Période d'où elle a été reportée */
  from: string
  at: string
  doneAt?: string
}

export interface TasksData {
  /** Modèles du catalogue activés ou désactivés par la joueuse (sinon : valeur par défaut) */
  enabled: Record<string, boolean>
  custom: CustomTask[]
  /** `<id>@<période>` → date de réalisation */
  done: Record<string, string>
  /** `<id>@<période>` → date du retrait (pour la période seulement) */
  removed: Record<string, string>
  postponed: Postponed[]
}

export const emptyTasks = (): TasksData => ({ enabled: {}, custom: [], done: {}, removed: {}, postponed: [] })

const CUSTOM_ID_RE = /^perso-[a-z0-9]{4,24}$/
const isIsoDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const cleanLabel = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

export function isValidLabel(label: string): boolean {
  const l = cleanLabel(label)
  return l.length > 0 && l.length <= MAX_LABEL
}

function sanitizeCustom(raw: unknown): CustomTask | undefined {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || !CUSTOM_ID_RE.test(raw.id)) return undefined
  const label = cleanLabel(raw.label)
  if (!isValidLabel(label) || !isValidRecurrence(raw.recurrence) || !isIsoDate(raw.createdAt)) return undefined
  return { id: raw.id, label, recurrence: raw.recurrence, createdAt: raw.createdAt }
}

/** Ne garde que des entrées cohérentes avec le catalogue et les tâches personnalisées existantes. */
export function sanitizeTasks(raw: unknown): TasksData {
  const out = emptyTasks()
  if (!isPlainObject(raw)) return out
  const seen = new Set<string>()
  for (const c of Array.isArray(raw.custom) ? raw.custom : []) {
    const task = sanitizeCustom(c)
    if (task && !seen.has(task.id)) {
      seen.add(task.id)
      out.custom.push(task)
    }
  }
  const known = (id: string) => isTemplateId(id) || seen.has(id)
  const occKnown = (key: string) => {
    const at = key.lastIndexOf('@')
    return at > 0 && known(key.slice(0, at)) && key.length - at > 1
  }
  if (isPlainObject(raw.enabled)) for (const [id, v] of Object.entries(raw.enabled)) if (isTemplateId(id) && typeof v === 'boolean') out.enabled[id] = v
  if (isPlainObject(raw.done)) for (const [k, v] of Object.entries(raw.done)) if (occKnown(k) && isIsoDate(v)) out.done[k] = v
  if (isPlainObject(raw.removed)) for (const [k, v] of Object.entries(raw.removed)) if (occKnown(k) && isIsoDate(v)) out.removed[k] = v
  const postponedIds = new Set<string>()
  for (const p of Array.isArray(raw.postponed) ? raw.postponed : []) {
    if (!isPlainObject(p) || typeof p.taskId !== 'string' || !known(p.taskId) || postponedIds.has(p.taskId)) continue
    const label = cleanLabel(p.label)
    if (!isValidLabel(label) || typeof p.from !== 'string' || !isIsoDate(p.at)) continue
    postponedIds.add(p.taskId)
    out.postponed.push({ taskId: p.taskId, label, from: p.from, at: p.at, ...(isIsoDate(p.doneAt) ? { doneAt: p.doneAt } : {}) })
  }
  return out
}

// — Tâches actives et occurrences ————————————————————————————————————————

export interface ActiveTask {
  id: string
  label: string
  recurrence: Recurrence
  template?: TaskTemplate
  custom?: CustomTask
}

export function isEnabled(data: TasksData, template: TaskTemplate): boolean {
  return Object.hasOwn(data.enabled, template.id) ? data.enabled[template.id] : template.enabledByDefault
}

export function activeTasks(data: TasksData): ActiveTask[] {
  return [
    ...TASK_TEMPLATES.filter((t) => isEnabled(data, t)).map((t) => ({ id: t.id, label: t.label, recurrence: t.recurrence, template: t })),
    ...data.custom.map((c) => ({ id: c.id, label: c.label, recurrence: c.recurrence, custom: c })),
  ]
}

export const occurrenceKey = (task: { id: string; recurrence: Recurrence }, now: Date) => `${task.id}@${periodKey(task.recurrence, now)}`

/**
 * Tâche dont l'état est CALCULÉ ailleurs (ex. « Nourrir les animaux » d'après le suivi des
 * animaux) : elle n'est pas cochable à la main et peut afficher un libellé et un lien.
 * `hidden` : la tâche n'apparaît pas aujourd'hui (rien à faire).
 */
export interface TaskOverride {
  state: 'todo' | 'done' | 'hidden'
  label?: string
  meta?: string
  /** Adresse ouverte au toucher (ex. `#/collection/animaux/aujourdhui`) */
  href?: string
}

export type TaskOverrides = Record<string, TaskOverride>

export interface TodayItem extends ActiveTask {
  key: string
  doneAt?: string
  computed?: TaskOverride
}

export interface Today {
  todo: TodayItem[]
  done: TodayItem[]
  removed: TodayItem[]
  postponed: Postponed[]
  /** Progression de la journée : faites / (faites + à faire) — hors reportées */
  progress: { done: number; total: number }
  /** 7 derniers jours (le plus ancien d'abord) : tâches cochées ce jour-là */
  history: { day: string; count: number }[]
}

export function buildToday(data: TasksData, now: Date, overrides: TaskOverrides = {}): Today {
  const today = localDayKey(now)
  const todo: TodayItem[] = []
  const done: TodayItem[] = []
  const removed: TodayItem[] = []
  for (const task of activeTasks(data)) {
    const key = occurrenceKey(task, now)
    const doneAt = data.done[key]
    if (task.recurrence.kind === 'once') {
      // Ponctuelle : visible jusqu'à réalisation, puis jusqu'à la fin du jour où elle a été faite.
      if (!doneAt) todo.push({ ...task, key })
      else if (localDayKey(new Date(doneAt)) === today) done.push({ ...task, key, doneAt })
      continue
    }
    if (Object.hasOwn(data.removed, key)) {
      // Reportée depuis cette période : elle est déjà dans « Reportées », pas dans « Retirées ».
      const period = key.slice(key.lastIndexOf('@') + 1)
      if (!data.postponed.some((p) => p.taskId === task.id && p.from === period)) removed.push({ ...task, key })
    }
    else if (Object.hasOwn(overrides, task.id)) {
      const computed = overrides[task.id]
      if (computed.state === 'todo') todo.push({ ...task, key, computed })
      else if (computed.state === 'done') done.push({ ...task, key, doneAt: now.toISOString(), computed })
    } else if (doneAt) done.push({ ...task, key, doneAt })
    else todo.push({ ...task, key })
  }
  done.sort((a, b) => (a.doneAt! < b.doneAt! ? -1 : 1))
  const postponed = data.postponed.filter((p) => !p.doneAt || localDayKey(new Date(p.doneAt)) === today)

  const history: Today['history'] = []
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const day = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))
    const count =
      Object.values(data.done).filter((at) => localDayKey(new Date(at)) === day).length +
      data.postponed.filter((p) => p.doneAt && localDayKey(new Date(p.doneAt)) === day).length
    history.push({ day, count })
  }
  return { todo, done, removed, postponed, progress: { done: done.length, total: done.length + todo.length }, history }
}

// — Opérations (fonctions pures, appliquées dans une transaction atomique) ——————————

export type TaskOp =
  | { type: 'check'; taskId: string; done: boolean }
  | { type: 'remove'; taskId: string }
  | { type: 'restore'; taskId: string }
  | { type: 'postpone'; taskId: string }
  | { type: 'check-postponed'; taskId: string; done: boolean }
  | { type: 'delete-postponed'; taskId: string }
  | { type: 'enable'; templateId: string; enabled: boolean }
  | { type: 'add-custom'; id: string; label: string; recurrence: Recurrence }
  | { type: 'edit-custom'; id: string; label: string; recurrence: Recurrence }
  | { type: 'delete-custom'; id: string }

export class TaskError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaskError'
  }
}

function findTask(data: TasksData, taskId: string): ActiveTask {
  const custom = data.custom.find((c) => c.id === taskId)
  if (custom) return { id: custom.id, label: custom.label, recurrence: custom.recurrence, custom }
  if (isTemplateId(taskId)) {
    const t = TASK_TEMPLATES_BY_ID[taskId]
    return { id: t.id, label: t.label, recurrence: t.recurrence, template: t }
  }
  throw new TaskError('Tâche inconnue.')
}

/** Nettoyage des entrées de plus de 14 jours (l'historique n'en affiche que 7). */
function prune(data: TasksData, now: Date): TasksData {
  const limit = now.getTime() - KEEP_DAYS * 24 * 3600 * 1000
  const recent = (at: string) => Date.parse(at) >= limit
  return {
    ...data,
    done: Object.fromEntries(Object.entries(data.done).filter(([k, at]) => k.endsWith('@once') || recent(at))),
    removed: Object.fromEntries(Object.entries(data.removed).filter(([, at]) => recent(at))),
    postponed: data.postponed.filter((p) => !p.doneAt || recent(p.doneAt)),
  }
}

export function applyTaskOp(data: TasksData, op: TaskOp, now: Date): TasksData {
  const at = now.toISOString()
  const next: TasksData = { ...data, enabled: { ...data.enabled }, done: { ...data.done }, removed: { ...data.removed }, custom: [...data.custom], postponed: [...data.postponed] }
  switch (op.type) {
    case 'check': {
      const key = occurrenceKey(findTask(data, op.taskId), now)
      if (op.done) next.done[key] = next.done[key] ?? at
      else delete next.done[key]
      break
    }
    case 'remove':
    case 'restore': {
      const task = findTask(data, op.taskId)
      if (task.recurrence.kind === 'once') throw new TaskError('Une tâche ponctuelle se supprime, elle ne se retire pas.')
      const key = occurrenceKey(task, now)
      if (op.type === 'remove') next.removed[key] = at
      else delete next.removed[key]
      break
    }
    case 'postpone': {
      const task = findTask(data, op.taskId)
      if (task.recurrence.kind === 'once') throw new TaskError('Une tâche ponctuelle reste déjà jusqu’à ce qu’elle soit faite.')
      const key = occurrenceKey(task, now)
      // Sans doublon : une seule entrée reportée en attente par tâche.
      if (!next.postponed.some((p) => p.taskId === task.id && !p.doneAt)) {
        next.postponed = next.postponed.filter((p) => p.taskId !== task.id)
        next.postponed.push({ taskId: task.id, label: task.label, from: key.slice(key.lastIndexOf('@') + 1), at })
      }
      next.removed[key] = at // elle quitte la liste du jour, sans désactiver le modèle
      break
    }
    case 'check-postponed':
      next.postponed = next.postponed.map((p) => {
        if (p.taskId !== op.taskId) return p
        if (op.done) return { ...p, doneAt: p.doneAt ?? at }
        const { doneAt: _doneAt, ...rest } = p
        return rest
      })
      break
    case 'delete-postponed':
      next.postponed = next.postponed.filter((p) => p.taskId !== op.taskId)
      break
    case 'enable':
      if (!isTemplateId(op.templateId)) throw new TaskError('Tâche inconnue.')
      next.enabled[op.templateId] = op.enabled
      break
    case 'add-custom':
    case 'edit-custom': {
      const label = cleanLabel(op.label)
      if (!isValidLabel(label)) throw new TaskError(`Le nom doit faire entre 1 et ${MAX_LABEL} caractères.`)
      if (!isValidRecurrence(op.recurrence)) throw new TaskError('Récurrence invalide.')
      if (op.type === 'add-custom') {
        if (!CUSTOM_ID_RE.test(op.id) || next.custom.some((c) => c.id === op.id)) throw new TaskError('Identifiant invalide.')
        next.custom.push({ id: op.id, label, recurrence: op.recurrence, createdAt: at })
      } else {
        const i = next.custom.findIndex((c) => c.id === op.id)
        if (i < 0) throw new TaskError('Tâche inconnue.')
        next.custom[i] = { ...next.custom[i], label, recurrence: op.recurrence }
      }
      break
    }
    case 'delete-custom': {
      const prefix = `${op.id}@`
      next.custom = next.custom.filter((c) => c.id !== op.id)
      for (const k of Object.keys(next.done)) if (k.startsWith(prefix)) delete next.done[k]
      for (const k of Object.keys(next.removed)) if (k.startsWith(prefix)) delete next.removed[k]
      next.postponed = next.postponed.filter((p) => p.taskId !== op.id)
      break
    }
  }
  return prune(next, now)
}

export function newCustomId(): string {
  return `perso-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
