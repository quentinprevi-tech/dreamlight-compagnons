import type { CritterVariant, TimeWindow } from './data'

/**
 * Disponibilité d'une variante AUJOURD'HUI, d'après l'horaire du wiki (heure locale du téléphone).
 *
 * « Présent selon l'horaire » ne garantit pas que la créature apparaîtra : c'est l'horaire
 * annoncé, pas une observation. Une variante dont l'horaire est inconnu ou contradictoire
 * est « unknown » : elle n'est jamais comptée comme réalisable.
 */
export type Availability =
  /** Dans un créneau en ce moment ; `until` = heure de fin du créneau (24 = minuit) */
  | { state: 'present'; until: number }
  /** Un créneau commence plus tard aujourd'hui ; `from` = heure de début */
  | { state: 'later'; from: number }
  /** Des créneaux aujourd'hui, tous terminés */
  | { state: 'passed' }
  /** Aucun créneau aujourd'hui */
  | { state: 'absent' }
  | { state: 'unknown'; reason: 'missing' | 'conflict'; note?: string }

export type AvailabilityState = Availability['state']

export function hourOf(now: Date): number {
  return now.getHours() + now.getMinutes() / 60
}

export function windowsOn(variant: CritterVariant, weekday: number): TimeWindow[] | undefined {
  return variant.schedule.status === 'known' ? variant.schedule.days[weekday] : undefined
}

export function availabilityAt(variant: CritterVariant, now: Date): Availability {
  const schedule = variant.schedule
  if (schedule.status === 'unknown') return { state: 'unknown', reason: schedule.reason, note: schedule.note }
  const windows = schedule.days[now.getDay()]
  if (windows.length === 0) return { state: 'absent' }
  const h = hourOf(now)
  const current = windows.find((w) => w.from <= h && h < w.to)
  if (current) return { state: 'present', until: current.to }
  const next = windows.filter((w) => w.from > h).sort((a, b) => a.from - b.from)[0]
  return next ? { state: 'later', from: next.from } : { state: 'passed' }
}

export function formatHour(h: number): string {
  if (h === 0 || h === 24) return 'minuit'
  return `${h} h`
}

export function formatWindows(windows: TimeWindow[]): string {
  if (windows.length === 0) return '—'
  if (windows.length === 1 && windows[0].from === 0 && windows[0].to === 24) return 'Toute la journée'
  return windows.map((w) => `${formatHour(w.from)}–${formatHour(w.to)}`).join(' et ')
}

export const AVAILABILITY_LABEL: Record<AvailabilityState, string> = {
  present: 'Présent selon l’horaire',
  later: 'Disponible plus tard',
  passed: 'Créneau passé',
  absent: 'Absent aujourd’hui',
  unknown: 'Horaire inconnu',
}

/** Texte court pour une ligne : « Présent selon l'horaire · jusqu'à 18 h », « Disponible plus tard · dès 15 h »… */
export function describeAvailability(a: Availability): string {
  switch (a.state) {
    case 'present':
      return `${AVAILABILITY_LABEL.present}${a.until < 24 ? ` · jusqu’à ${formatHour(a.until)}` : ''}`
    case 'later':
      return `${AVAILABILITY_LABEL.later} · dès ${formatHour(a.from)}`
    case 'unknown':
      return a.reason === 'conflict' ? 'Horaire à confirmer' : AVAILABILITY_LABEL.unknown
    default:
      return AVAILABILITY_LABEL[a.state]
  }
}
