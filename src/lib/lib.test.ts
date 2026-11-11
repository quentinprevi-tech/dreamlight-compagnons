import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTERS_BY_ID } from '../data/characters'
import { parseHash } from './router'
import { matchesQuery, normalize } from './search'
import {
  loadAssignments,
  loadPortraits,
  resetStoreForTests,
  sanitizeAssignments,
  updateAssignment,
  savePortrait,
  deletePortrait,
} from './storage'
import { initials } from '../components/Avatar'
import { parseBackupText } from './backup'

describe('recherche', () => {
  it('ignore accents, casse et apostrophes', () => {
    expect(normalize('Buzz l’Éclair')).toBe('buzz l eclair')
    expect(matchesQuery(CHARACTERS_BY_ID.buzz, 'eclair')).toBe(true)
    expect(matchesQuery(CHARACTERS_BY_ID.remy, 'REMY')).toBe(true)
  })
  it('trouve aussi par nom anglais et par univers', () => {
    expect(matchesQuery(CHARACTERS_BY_ID.goofy, 'goofy')).toBe(true)
    expect(matchesQuery(CHARACTERS_BY_ID.simba, 'roi lion')).toBe(true)
    expect(matchesQuery(CHARACTERS_BY_ID.simba, 'stitch')).toBe(false)
  })
})

describe('routage', () => {
  it('ignore les métiers hérités de JavaScript', () => {
    expect(parseHash('#/metier/constructor')).toEqual({ name: 'today' })
  })

  it('lit les adresses', () => {
    // Anciennes adresses : toujours valides
    expect(parseHash('#/metier/fishing')).toEqual({ name: 'profession', id: 'fishing' })
    expect(parseHash('#/personnages')).toEqual({ name: 'characters' })
    expect(parseHash('#/numismagie')).toEqual({ name: 'scramblecoin' })
    expect(parseHash('#/infos')).toEqual({ name: 'about' })
    // Nouvelles adresses : « Aujourd'hui » est l'accueil, les métiers ont leur propre adresse
    expect(parseHash('')).toEqual({ name: 'today' })
    expect(parseHash('#/')).toEqual({ name: 'today' })
    expect(parseHash('#/aujourdhui')).toEqual({ name: 'today' })
    expect(parseHash('#/aujourdhui/taches')).toEqual({ name: 'tasks-settings' })
    expect(parseHash('#/metiers')).toEqual({ name: 'professions' })
    // Adresse inconnue : retour à l'accueil
    expect(parseHash('#/metier/cuisine')).toEqual({ name: 'today' })
  })
})

describe('initiales', () => {
  it('donne deux lettres lisibles', () => {
    expect(initials('Mickey')).toBe('MI')
    expect(initials('Jack Skellington')).toBe('JS')
    expect(initials('L’Oublié')).toBe('OU')
    expect(initials('La Bête')).toBe('BÊ')
  })
})

describe('stockage local', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
  })

  it('enregistre et relit les affectations', async () => {
    expect(await loadAssignments()).toEqual({})
    await updateAssignment('mickey', 'fishing')
    expect((await updateAssignment('goofy', 'gardening')).assignments).toEqual({ mickey: 'fishing', goofy: 'gardening' })
    resetStoreForTests() // simule un redémarrage de l'application
    expect(await loadAssignments()).toEqual({ mickey: 'fishing', goofy: 'gardening' })
    // Retirer un métier ne change pas « débloqué »
    expect(await updateAssignment('mickey', null)).toEqual({
      assignments: { goofy: 'gardening' },
      villagers: { mickey: { unlocked: true }, goofy: { unlocked: true } },
    })
  })

  it('deux modifications simultanées d’habitants différents sont toutes les deux conservées', async () => {
    await Promise.all([updateAssignment('mickey', 'fishing'), updateAssignment('goofy', 'gardening'), updateAssignment('elsa', 'mining')])
    expect(await loadAssignments()).toEqual({ mickey: 'fishing', goofy: 'gardening', elsa: 'mining' })
  })

  it('refuse un habitant ou un métier inconnu, y compris les propriétés héritées de JavaScript', async () => {
    await expect(updateAssignment('inconnu', 'fishing')).rejects.toThrow('inconnu')
    await expect(updateAssignment('constructor', 'fishing')).rejects.toThrow()
    await expect(updateAssignment('mickey', 'toString' as never)).rejects.toThrow()
    expect(await loadAssignments()).toEqual({})
  })

  it('écarte les entrées invalides', () => {
    expect(sanitizeAssignments({ mickey: 'fishing', inconnu: 'mining', goofy: 'cuisine' })).toEqual({ mickey: 'fishing' })
    expect(sanitizeAssignments({ constructor: 'fishing', toString: 'mining', mickey: 'constructor', goofy: 'hasOwnProperty' })).toEqual({})
    expect(sanitizeAssignments(JSON.parse('{"__proto__":"fishing"}'))).toEqual({})
    expect(sanitizeAssignments(null)).toEqual({})
    expect(sanitizeAssignments(['fishing'])).toEqual({})
  })

  it('stocke et supprime les photos', async () => {
    await savePortrait('ariel', new NodeBlob(['x'], { type: 'image/jpeg' }) as unknown as Blob)
    await updateAssignment('ariel', 'fishing')
    expect(Object.keys(await loadPortraits())).toEqual(['ariel'])
    await deletePortrait('ariel')
    expect(await loadPortraits()).toEqual({})
  })

  it('relit les sauvegardes exportées par la première version', () => {
    // Fichier tel que l'export v1 le produisait
    const text = JSON.stringify({ app: 'dreamlight-compagnons', version: 1, exportedAt: '2026-10-31T10:00:00.000Z', assignments: { elsa: 'mining' } })
    expect(parseBackupText(text).sections).toEqual([expect.objectContaining({ id: 'assignments', data: { elsa: 'mining' } })])
    expect(() => parseBackupText('{"foo":1}')).toThrow()
  })
})
