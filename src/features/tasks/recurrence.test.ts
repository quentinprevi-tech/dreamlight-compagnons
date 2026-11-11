import { describe, expect, it } from 'vitest'
import { describeRecurrence, isValidRecurrence, nextReset, periodKey, type Recurrence } from './recurrence'

/** Heure murale à Bruxelles (le fuseau des tests). */
const bxl = (iso: string) => new Date(iso) // sans « Z » : heure locale du fuseau Europe/Brussels

const DAILY_MIDNIGHT: Recurrence = { kind: 'daily', at: { zone: 'local', hour: 0, minute: 0 } }
const DAILY_5H_LOCAL: Recurrence = { kind: 'daily', at: { zone: 'local', hour: 5, minute: 0 } }
const DAILY_9H_UTC: Recurrence = { kind: 'daily', at: { zone: 'UTC', hour: 9, minute: 0 } }
const WEDNESDAY_14H_UTC: Recurrence = { kind: 'weekly', weekday: 3, at: { zone: 'UTC', hour: 14, minute: 0 } }

describe('fuseau des tests', () => {
  it('est bien Europe/Brussels (UTC+1 en hiver, UTC+2 en été)', () => {
    expect(bxl('2026-01-15T12:00:00').getTimezoneOffset()).toBe(-60)
    expect(bxl('2026-07-15T12:00:00').getTimezoneOffset()).toBe(-120)
  })
})

describe('récurrence quotidienne', () => {
  it('minuit heure locale', () => {
    expect(periodKey(DAILY_MIDNIGHT, bxl('2026-11-09T23:59:00'))).toBe('2026-11-09')
    expect(periodKey(DAILY_MIDNIGHT, bxl('2026-11-10T00:00:00'))).toBe('2026-11-10')
    expect(nextReset(DAILY_MIDNIGHT, bxl('2026-11-09T14:00:00'))).toEqual(bxl('2026-11-10T00:00:00'))
  })

  it('5 h heure locale : avant 5 h, c’est encore la journée de la veille', () => {
    expect(periodKey(DAILY_5H_LOCAL, bxl('2026-11-10T04:59:00'))).toBe('2026-11-09')
    expect(periodKey(DAILY_5H_LOCAL, bxl('2026-11-10T05:00:00'))).toBe('2026-11-10')
  })

  it('9 h UTC : 10 h à Bruxelles en hiver, 11 h en été', () => {
    expect(periodKey(DAILY_9H_UTC, bxl('2026-11-09T09:59:00'))).toBe('2026-11-08')
    expect(periodKey(DAILY_9H_UTC, bxl('2026-11-09T10:00:00'))).toBe('2026-11-09')
    expect(nextReset(DAILY_9H_UTC, bxl('2026-11-09T08:00:00'))).toEqual(bxl('2026-11-09T10:00:00'))
    expect(periodKey(DAILY_9H_UTC, bxl('2026-07-15T10:30:00'))).toBe('2026-07-14')
    expect(periodKey(DAILY_9H_UTC, bxl('2026-07-15T11:00:00'))).toBe('2026-07-15')
  })
})

describe('passage heure d’été / heure d’hiver (Bruxelles)', () => {
  it('passage à l’heure d’été (29/03/2026) : la remise à zéro UTC passe de 10 h à 11 h locale', () => {
    expect(periodKey(DAILY_9H_UTC, bxl('2026-03-28T10:30:00'))).toBe('2026-03-28') // 09:30 UTC
    expect(periodKey(DAILY_9H_UTC, bxl('2026-03-29T10:30:00'))).toBe('2026-03-28') // 08:30 UTC : pas encore
    expect(periodKey(DAILY_9H_UTC, bxl('2026-03-29T11:00:00'))).toBe('2026-03-29')
    expect(nextReset(DAILY_9H_UTC, bxl('2026-03-28T12:00:00'))).toEqual(bxl('2026-03-29T11:00:00'))
  })

  it('passage à l’heure d’hiver (25/10/2026) : la remise à zéro UTC passe de 11 h à 10 h locale', () => {
    expect(periodKey(DAILY_9H_UTC, bxl('2026-10-24T10:30:00'))).toBe('2026-10-23') // 08:30 UTC
    expect(periodKey(DAILY_9H_UTC, bxl('2026-10-25T10:30:00'))).toBe('2026-10-25') // 09:30 UTC
  })

  it('minuit local reste minuit, même la nuit du changement d’heure', () => {
    expect(periodKey(DAILY_MIDNIGHT, bxl('2026-03-29T00:30:00'))).toBe('2026-03-29')
    expect(periodKey(DAILY_MIDNIGHT, bxl('2026-03-29T03:30:00'))).toBe('2026-03-29') // 02 h → 03 h
    expect(periodKey(DAILY_MIDNIGHT, bxl('2026-10-25T02:30:00'))).toBe('2026-10-25') // heure vécue deux fois
    expect(nextReset(DAILY_MIDNIGHT, bxl('2026-03-29T12:00:00'))).toEqual(bxl('2026-03-30T00:00:00'))
    expect(nextReset(DAILY_MIDNIGHT, bxl('2026-10-25T12:00:00'))).toEqual(bxl('2026-10-26T00:00:00'))
  })
})

describe('récurrence hebdomadaire (DreamSnap : mercredi 14 h UTC)', () => {
  it('change de semaine le mercredi à 15 h à Bruxelles en hiver', () => {
    expect(periodKey(WEDNESDAY_14H_UTC, bxl('2026-11-09T12:00:00'))).toBe('2026-11-04') // lundi
    expect(periodKey(WEDNESDAY_14H_UTC, bxl('2026-11-11T14:59:00'))).toBe('2026-11-04')
    expect(periodKey(WEDNESDAY_14H_UTC, bxl('2026-11-11T15:00:00'))).toBe('2026-11-11')
    expect(periodKey(WEDNESDAY_14H_UTC, bxl('2026-11-17T23:00:00'))).toBe('2026-11-11') // mardi suivant
    expect(nextReset(WEDNESDAY_14H_UTC, bxl('2026-11-09T12:00:00'))).toEqual(bxl('2026-11-11T15:00:00'))
  })

  it('à 16 h en été', () => {
    expect(periodKey(WEDNESDAY_14H_UTC, bxl('2026-07-15T15:30:00'))).toBe('2026-07-08')
    expect(periodKey(WEDNESDAY_14H_UTC, bxl('2026-07-15T16:00:00'))).toBe('2026-07-15')
  })

  it('autour du changement d’heure', () => {
    // Mercredi 01/04/2026 (heure d'été) : 14 h UTC = 16 h à Bruxelles
    expect(nextReset(WEDNESDAY_14H_UTC, bxl('2026-03-27T12:00:00'))).toEqual(bxl('2026-04-01T16:00:00'))
  })
})

describe('description et validation', () => {
  it('décrit le rappel de l’app', () => {
    expect(describeRecurrence({ kind: 'once' })).toBe('Une seule fois')
    expect(describeRecurrence(DAILY_MIDNIGHT)).toBe('Chaque jour à minuit')
    expect(describeRecurrence(DAILY_5H_LOCAL)).toBe('Chaque jour à 5 h')
    expect(describeRecurrence(WEDNESDAY_14H_UTC)).toBe('Chaque mercredi à 14 h UTC')
  })

  it('refuse les récurrences invalides', () => {
    expect(isValidRecurrence({ kind: 'once' })).toBe(true)
    expect(isValidRecurrence(WEDNESDAY_14H_UTC)).toBe(true)
    expect(isValidRecurrence({ kind: 'daily', at: { zone: 'local', hour: 24, minute: 0 } })).toBe(false)
    expect(isValidRecurrence({ kind: 'weekly', weekday: 7, at: { zone: 'UTC', hour: 1, minute: 0 } })).toBe(false)
    expect(isValidRecurrence({ kind: 'daily', at: { zone: 'Europe/Paris', hour: 1, minute: 0 } })).toBe(false)
    expect(isValidRecurrence({ kind: 'monthly' })).toBe(false)
    expect(isValidRecurrence(null)).toBe(false)
  })
})
