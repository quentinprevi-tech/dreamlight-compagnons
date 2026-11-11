import { beforeEach, describe, expect, it } from 'vitest'
import { applyRestore, createBackup, parseBackupText, planRestore } from '../../lib/backup'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { loadNames, NameError, sanitizeNames, updateCustomName } from '../../lib/names'
import { CRITTER_BY_ID } from './data'
import { biomeName, speciesName, variantName } from './display'
import { BIOME_BY_ID } from './data'
import { emptyCritters } from './model'
import { loadCritters, updateCritters } from './storage'

const at = (iso: string) => new Date(iso)

describe('stockage atomique du suivi des animaux', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('enregistre, relit après redémarrage et conserve l’état', async () => {
    await updateCritters({ type: 'feed', id: 'calico-rabbit' }, at('2026-11-12T09:00:00'))
    await updateCritters({ type: 'obtained', id: 'black-rabbit', value: true }, at('2026-11-12T09:00:00'))
    await updateCritters({ type: 'owned', collection: 'storybook', value: false }, at('2026-11-12T09:00:00'))
    resetStoreForTests() // redémarrage
    expect(await loadCritters()).toEqual({
      owned: { storybook: false },
      configured: true,
      progress: { 'calico-rabbit': { feedings: 1, lastFed: '2026-11-12' }, 'black-rabbit': { obtained: true } },
    })
  })

  it('deux appuis simultanés sur « Nourri » (ou deux onglets) comptent un seul nourrissage', async () => {
    const now = at('2026-11-12T09:00:00')
    await Promise.all([
      updateCritters({ type: 'feed', id: 'calico-rabbit' }, now),
      updateCritters({ type: 'feed', id: 'calico-rabbit' }, now),
      updateCritters({ type: 'feed', id: 'calico-rabbit' }, now),
    ])
    expect((await loadCritters()).progress['calico-rabbit']).toEqual({ feedings: 1, lastFed: '2026-11-12' })
  })

  it('deux onglets nourrissent deux variantes en même temps : les deux sont conservées', async () => {
    const now = at('2026-11-12T09:00:00')
    await Promise.all([
      updateCritters({ type: 'feed', id: 'calico-rabbit' }, now),
      updateCritters({ type: 'feed', id: 'black-rabbit' }, now),
      updateCritters({ type: 'obtained', id: 'classic-rabbit', value: true }, now),
      updateCritters({ type: 'owned', collection: 'eternity', value: false }, now),
    ])
    const d = await loadCritters()
    expect(Object.keys(d.progress).sort()).toEqual(['black-rabbit', 'calico-rabbit', 'classic-rabbit'])
    expect(d.owned).toEqual({ eternity: false })
  })

  it('une opération refusée n’écrit rien', async () => {
    await updateCritters({ type: 'obtained', id: 'calico-rabbit', value: true }, at('2026-11-12T09:00:00'))
    const before = await readEntries()
    await expect(updateCritters({ type: 'feed', id: 'calico-rabbit' }, at('2026-11-13T09:00:00'))).rejects.toThrow('déjà obtenu')
    await expect(updateCritters({ type: 'feed', id: 'inconnu' }, at('2026-11-13T09:00:00'))).rejects.toThrow('inconnu')
    expect(await readEntries()).toEqual(before)
  })

  it('garde les champs écrits par une version plus récente', async () => {
    await commit({ set: [['critters', { ...emptyCritters(), futur: { x: 1 } }]] })
    await updateCritters({ type: 'feed', id: 'calico-rabbit' }, at('2026-11-12T09:00:00'))
    expect((await readEntries()).critters).toMatchObject({ futur: { x: 1 }, progress: { 'calico-rabbit': { feedings: 1 } } })
  })
})

describe('sauvegardes du suivi des animaux', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('aller-retour complet : suivi, extensions et noms personnalisés', async () => {
    const now = at('2026-11-12T09:00:00')
    await updateCritters({ type: 'feed', id: 'calico-rabbit' }, now)
    await updateCritters({ type: 'owned', collection: 'honeyglow', value: false }, now)
    await updateCustomName('critter:calico-rabbit', 'Lapin tacheté')
    await updateCustomName('biome:peaceful-meadow', 'Prairie paisible')
    const file = await createBackup({ includePhotos: false })
    expect(file.sections.critters).toEqual({
      v: 1,
      data: { owned: { honeyglow: false }, configured: true, progress: { 'calico-rabbit': { feedings: 1, lastFed: '2026-11-12' } } },
    })

    resetStoreForTests(`test-${Math.random()}`)
    await applyRestore(parseBackupText(JSON.stringify(file)))
    expect(await loadCritters()).toEqual({ owned: { honeyglow: false }, configured: true, progress: { 'calico-rabbit': { feedings: 1, lastFed: '2026-11-12' } } })
    expect(await loadNames()).toEqual({ 'critter:calico-rabbit': 'Lapin tacheté', 'biome:peaceful-meadow': 'Prairie paisible' })
  })

  it('une sauvegarde de la phase 2 (sans animaux) conserve le suivi du téléphone', async () => {
    await updateCritters({ type: 'feed', id: 'calico-rabbit' }, at('2026-11-12T09:00:00'))
    const phase2 = { app: 'dreamlight-compagnons', format: 2, type: 'complete', schema: 3, sections: { assignments: { v: 1, data: {} }, names: { v: 1, data: {} }, photos: null } }
    const parsed = parseBackupText(JSON.stringify(phase2))
    expect((await planRestore(parsed)).find((p) => p.id === 'critters')).toMatchObject({ action: 'keep' })
    await applyRestore(parsed)
    expect((await loadCritters()).progress['calico-rabbit']?.feedings).toBe(1)
  })

  it('refuse une section abîmée, écarte les variantes inconnues en les comptant', () => {
    const base = { app: 'dreamlight-compagnons', format: 2, type: 'partial', schema: 3 }
    expect(() => parseBackupText(JSON.stringify({ ...base, sections: { critters: { v: 1, data: 'abîmé' } } }))).toThrow('abîmée')
    expect(() => parseBackupText(JSON.stringify({ ...base, sections: { critters: { v: 1, data: ['x'] } } }))).toThrow('abîmée')
    const parsed = parseBackupText(
      JSON.stringify({
        ...base,
        sections: { critters: { v: 1, data: { owned: { eternity: false, base: false }, progress: { 'calico-rabbit': { obtained: true }, inconnu: { obtained: true }, 'black-rabbit': { feedings: 500 } } } } },
      }),
    )
    expect(parsed.sections[0]).toMatchObject({ data: { owned: { eternity: false }, configured: true, progress: { 'calico-rabbit': { obtained: true } } }, ignored: 3 })
  })
})

describe('noms personnalisés des animaux et des biomes', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('enregistrés, retirés, conservés après redémarrage ; refus des éléments et catalogues inconnus', async () => {
    expect(await updateCustomName('critter:calico-rabbit', '  Lapin   tacheté ')).toEqual({ 'critter:calico-rabbit': 'Lapin tacheté' })
    await updateCustomName('biome:wild-tangle', 'Enchevêtrement sauvage')
    resetStoreForTests()
    expect(await loadNames()).toEqual({ 'critter:calico-rabbit': 'Lapin tacheté', 'biome:wild-tangle': 'Enchevêtrement sauvage' })
    expect(await updateCustomName('critter:calico-rabbit', null)).toEqual({ 'biome:wild-tangle': 'Enchevêtrement sauvage' })
    await expect(updateCustomName('critter:inconnu', 'X')).rejects.toBeInstanceOf(NameError)
    await expect(updateCustomName('critter:constructor', 'X')).rejects.toBeInstanceOf(NameError)
    await expect(updateCustomName('recipe:soupe', 'X')).rejects.toBeInstanceOf(NameError)
    await expect(updateCustomName('critter:calico-rabbit', '   ')).rejects.toBeInstanceOf(NameError)
    await expect(updateCustomName('critter:calico-rabbit', 'x'.repeat(61))).rejects.toBeInstanceOf(NameError)
  })

  it('deux onglets nomment deux animaux en même temps : les deux noms sont conservés', async () => {
    await Promise.all([updateCustomName('critter:calico-rabbit', 'A'), updateCustomName('critter:black-rabbit', 'B'), updateCustomName('biome:plaza', 'C')])
    expect(Object.keys(await loadNames()).sort()).toEqual(['biome:plaza', 'critter:black-rabbit', 'critter:calico-rabbit'])
  })

  it('un nom personnalisé n’est jamais écrit dans le catalogue ni pris pour une traduction officielle', async () => {
    await updateCustomName('critter:calico-rabbit', 'Lapin tacheté')
    expect(CRITTER_BY_ID['calico-rabbit'].nameFr).toBe('Lapin calico')
    expect(sanitizeNames({ 'critter:calico-rabbit': 'Lapin tacheté' })).toEqual({ 'critter:calico-rabbit': 'Lapin tacheté' })
    const names = await loadNames()
    expect(variantName(CRITTER_BY_ID['calico-rabbit'], names)).toEqual({ text: 'Lapin tacheté', kind: 'custom' })
    expect(variantName(CRITTER_BY_ID['calico-rabbit'], {})).toEqual({ text: 'Lapin calico', kind: 'wiki' })
  })

  it('trois statuts d’affichage : nom du wiki, à confirmer (nom anglais), personnalisé', () => {
    expect(variantName(CRITTER_BY_ID['black-rabbit'], {})).toEqual({ text: 'Lapin noir', kind: 'wiki' })
    expect(variantName(CRITTER_BY_ID['white-rabbit'], {})).toEqual({ text: 'White Rabbit', kind: 'to-confirm' })
    expect(variantName(CRITTER_BY_ID['white-rabbit'], { 'critter:white-rabbit': 'Lapin blanc' })).toEqual({ text: 'Lapin blanc', kind: 'custom' })
    // Aucun biome n'a de nom français sur le wiki
    expect(biomeName(BIOME_BY_ID['peaceful-meadow'], {})).toEqual({ text: 'Peaceful Meadow', kind: 'to-confirm' })
    expect(biomeName(BIOME_BY_ID['peaceful-meadow'], { 'biome:peaceful-meadow': 'Prairie paisible' })).toEqual({ text: 'Prairie paisible', kind: 'custom' })
    expect(speciesName('rabbit')).toEqual({ text: 'Lapin', kind: 'wiki' })
    expect(speciesName('skunk')).toEqual({ text: 'Skunk', kind: 'to-confirm' })
  })
})
