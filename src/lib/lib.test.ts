import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTERS_BY_ID } from '../data/characters'
import { parseHash } from './router'
import { matchesQuery, normalize } from './search'
import {
  loadAssignments,
  loadPortraits,
  makeBackup,
  parseBackup,
  resetStoreForTests,
  sanitizeAssignments,
  saveAssignments,
  savePortrait,
  deletePortrait,
} from './storage'
import { initials } from '../components/Avatar'

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
  it('lit les adresses', () => {
    expect(parseHash('#/metier/fishing')).toEqual({ name: 'profession', id: 'fishing' })
    expect(parseHash('#/metier/cuisine')).toEqual({ name: 'home' })
    expect(parseHash('#/personnages')).toEqual({ name: 'characters' })
    expect(parseHash('')).toEqual({ name: 'home' })
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
    await saveAssignments({ mickey: 'fishing', goofy: 'gardening' })
    resetStoreForTests() // simule un redémarrage de l'application
    expect(await loadAssignments()).toEqual({ mickey: 'fishing', goofy: 'gardening' })
  })

  it('écarte les entrées invalides', () => {
    expect(sanitizeAssignments({ mickey: 'fishing', inconnu: 'mining', goofy: 'cuisine' })).toEqual({ mickey: 'fishing' })
    expect(sanitizeAssignments(null)).toEqual({})
  })

  it('stocke et supprime les photos', async () => {
    await savePortrait('ariel', new NodeBlob(['x'], { type: 'image/jpeg' }) as unknown as Blob)
    await saveAssignments({ ariel: 'fishing' })
    expect(Object.keys(await loadPortraits())).toEqual(['ariel'])
    await deletePortrait('ariel')
    expect(await loadPortraits()).toEqual({})
  })

  it('exporte et restaure une sauvegarde', () => {
    const text = JSON.stringify(makeBackup({ elsa: 'mining' }))
    expect(parseBackup(text)).toEqual({ elsa: 'mining' })
    expect(() => parseBackup('{"foo":1}')).toThrow()
  })
})
