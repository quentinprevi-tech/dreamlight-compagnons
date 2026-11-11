/**
 * Récurrences des tâches : QUAND une tâche revient dans l'app.
 *
 * C'est le rappel choisi par l'app, distinct de la remise à zéro du jeu (documentée
 * à part dans le catalogue, avec ses sources et son statut de vérification).
 *
 * Une heure de remise à zéro est exprimée soit en heure locale du téléphone
 * (`local` : suit le passage heure d'été / heure d'hiver), soit en UTC (`UTC` :
 * heure fixe dans le monde, donc 10 h ou 11 h à Bruxelles selon la saison).
 *
 * Pour ajouter un type de récurrence (tous les N jours, jours choisis…) : une
 * variante dans `Recurrence` et un cas dans `periodStartDay`.
 */

export type Zone = 'local' | 'UTC'

export interface ResetClock {
  zone: Zone
  hour: number
  minute: number
}

/** 0 = dimanche … 6 = samedi (comme `Date.getDay`) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Recurrence =
  /** Ne revient pas : visible jusqu'à ce qu'elle soit faite */
  | { kind: 'once' }
  | { kind: 'daily'; at: ResetClock }
  | { kind: 'weekly'; weekday: Weekday; at: ResetClock }

export const MIDNIGHT_LOCAL: ResetClock = { zone: 'local', hour: 0, minute: 0 }

export const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const

interface CalendarDay {
  y: number
  m: number
  d: number
}

/** Jour du calendrier et heure « murale » dans la zone choisie. */
function wallClock(now: Date, zone: Zone) {
  return zone === 'UTC'
    ? { day: { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() }, weekday: now.getUTCDay() as Weekday, minutes: now.getUTCHours() * 60 + now.getUTCMinutes() }
    : { day: { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }, weekday: now.getDay() as Weekday, minutes: now.getHours() * 60 + now.getMinutes() }
}

/** Arithmétique de calendrier pure (sans heure, donc sans effet du changement d'heure). */
function addDays({ y, m, d }: CalendarDay, delta: number): CalendarDay {
  const t = new Date(Date.UTC(y, m - 1, d + delta))
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = ({ y, m, d }: CalendarDay) => `${y}-${pad(m)}-${pad(d)}`

/** Jour (dans la zone de la remise à zéro) où a commencé la période en cours. */
function periodStartDay(rec: Exclude<Recurrence, { kind: 'once' }>, now: Date): CalendarDay {
  const { day, weekday, minutes } = wallClock(now, rec.at.zone)
  const beforeReset = minutes < rec.at.hour * 60 + rec.at.minute
  if (rec.kind === 'daily') return beforeReset ? addDays(day, -1) : day
  let back = (weekday - rec.weekday + 7) % 7
  if (back === 0 && beforeReset) back = 7
  return addDays(day, -back)
}

/**
 * Identifiant de la période en cours : deux instants de la même période ont la même
 * clé. `once` : une seule période. Exemple quotidien : `2026-11-09`.
 */
export function periodKey(rec: Recurrence, now: Date): string {
  if (rec.kind === 'once') return 'once'
  return dayKey(periodStartDay(rec, now))
}

/** Instant réel correspondant à une heure murale d'un jour donné dans la zone. */
function instantOf(day: CalendarDay, clock: ResetClock): Date {
  return clock.zone === 'UTC'
    ? new Date(Date.UTC(day.y, day.m - 1, day.d, clock.hour, clock.minute))
    : new Date(day.y, day.m - 1, day.d, clock.hour, clock.minute)
}

/** Prochain instant où la tâche reviendra (undefined pour une tâche ponctuelle). */
export function nextReset(rec: Recurrence, now: Date): Date | undefined {
  if (rec.kind === 'once') return undefined
  const start = periodStartDay(rec, now)
  return instantOf(addDays(start, rec.kind === 'daily' ? 1 : 7), rec.at)
}

/** Jour local (téléphone) d'un instant : sert aux tâches ponctuelles et à l'historique. */
export function localDayKey(at: Date): string {
  return dayKey({ y: at.getFullYear(), m: at.getMonth() + 1, d: at.getDate() })
}

export function isValidRecurrence(v: unknown): v is Recurrence {
  const r = v as Recurrence | undefined
  if (!r || typeof r !== 'object') return false
  if (r.kind === 'once') return true
  const at = (r as { at?: ResetClock }).at
  const okClock =
    !!at &&
    (at.zone === 'local' || at.zone === 'UTC') &&
    Number.isInteger(at.hour) &&
    at.hour >= 0 &&
    at.hour <= 23 &&
    Number.isInteger(at.minute) &&
    at.minute >= 0 &&
    at.minute <= 59
  if (r.kind === 'daily') return okClock
  if (r.kind === 'weekly') return okClock && Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6
  return false
}

const clockText = (c: ResetClock) => (c.zone === 'UTC' ? `${c.hour} h${c.minute ? pad(c.minute) : ''} UTC` : c.hour === 0 && c.minute === 0 ? 'minuit' : `${c.hour} h${c.minute ? pad(c.minute) : ''}`)

/** Description du rappel dans l'app : « Chaque jour à minuit », « Chaque mercredi à 14 h UTC »… */
export function describeRecurrence(rec: Recurrence): string {
  if (rec.kind === 'once') return 'Une seule fois'
  if (rec.kind === 'daily') return `Chaque jour à ${clockText(rec.at)}`
  return `Chaque ${WEEKDAYS_FR[rec.weekday]} à ${clockText(rec.at)}`
}

/** « aujourd'hui à 10:00 », « demain à 00:00 », « mercredi 18/11 à 15:00 » (heure locale). */
export function describeWhen(at: Date, now: Date): string {
  const time = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const today = localDayKey(now)
  const tomorrow = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const day = localDayKey(at)
  if (day === today) return `aujourd’hui à ${time}`
  if (day === tomorrow) return `demain à ${time}`
  return `${WEEKDAYS_FR[at.getDay()]} ${at.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${time}`
}
