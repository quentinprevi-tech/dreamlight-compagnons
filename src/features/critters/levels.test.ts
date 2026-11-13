import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyRestore, BackupError, createBackup, DATA_SECTIONS, parseBackupText, planRestore, undoLastRestore, type BackupFile } from '../../lib/backup'
import { commit, MAX_WRITABLE_SCHEMA, NewerDataError, pickData, readEntries, readKey, resetStoreForTests, sameJson } from '../../lib/db'
import { CURRENT_SCHEMA, SCHEMA_KEY } from '../../lib/migrations'
import { updateAssignment } from '../../lib/storage'
import { COMPANION_LEVEL_MAX, CRITTER_LEVELS_KEY, applyLevelChange, formatCompanionLevel, isCompanionLevel, sanitizeCritterLevels } from './levels'
import { CritterError, sanitizeCritters } from './model'
import { loadCritterLevels, loadCritters, updateCritterLevel, updateCritters } from './storage'
import { useCritters } from './useCritters'

const NOW = new Date('2026-11-13T09:00:00')
const obtain = (id: string, value = true) => updateCritters({ type: 'obtained', id, value }, NOW)
const stored = async (key: string) => (await readEntries())[key]

beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

describe('niveaux : règles du modèle (fonctions pures)', () => {
  it('seuls les entiers de 1 à 5 sont des niveaux', () => {
    for (const ok of [1, 2, 3, 4, 5]) expect(isCompanionLevel(ok)).toBe(true)
    for (const bad of [0, 6, -1, 2.5, NaN, Infinity, '3', null, undefined, true, {}]) expect(isCompanionLevel(bad)).toBe(false)
    expect(COMPANION_LEVEL_MAX).toBe(5)
  })

  it('libellés cohérents avec ceux des habitants', () => {
    expect(formatCompanionLevel(undefined)).toBe('Non renseigné')
    expect(formatCompanionLevel(3)).toBe('Niveau 3')
    expect(formatCompanionLevel(5)).toBe('Niveau 5 (max)')
  })

  it('lecture : seuls les animaux du catalogue et les niveaux valides sont gardés', () => {
    expect(
      sanitizeCritterLevels({ 'classic-fox': 3, 'black-rabbit': 9, 'calico-rabbit': '2', inconnu: 4, constructor: 2, 'classic-cobra': 1.5, 'classic-owl': 5 }),
    ).toEqual({ 'classic-fox': 3 })
    expect(sanitizeCritterLevels(['x'])).toEqual({})
    expect(sanitizeCritterLevels(null)).toEqual({})
  })

  it('applyLevelChange : règle, remplace, efface, refuse sans rien changer', () => {
    const start = { 'classic-fox': 2 }
    expect(applyLevelChange(start, true, 'classic-fox', 4)).toEqual({ 'classic-fox': 4 })
    expect(applyLevelChange(start, true, 'classic-rabbit', 1)).toEqual({ 'classic-fox': 2, 'classic-rabbit': 1 })
    expect(applyLevelChange(start, true, 'classic-fox', null)).toEqual({})
    expect(() => applyLevelChange(start, false, 'classic-fox', 3)).toThrow('Coche « Obtenu »')
    expect(() => applyLevelChange(start, true, 'classic-fox', 6)).toThrow('entre 1 et 5')
    expect(() => applyLevelChange(start, true, 'inconnu', 3)).toThrow('inconnu')
    expect(start).toEqual({ 'classic-fox': 2 })
  })

  it('POURQUOI une clé séparée : le nettoyeur de la version 3 effacerait un niveau rangé dans « critters »', () => {
    // sanitizeCritters est identique à celui de la version publiée 8f9a85e (model.ts n'a pas été modifié) :
    const v3 = sanitizeCritters({ owned: {}, configured: true, progress: { 'classic-fox': { obtained: true, level: 3 } } })
    expect(v3.progress['classic-fox']).toEqual({ obtained: true }) // le niveau est perdu
  })
})

describe('niveaux : stockage dans la clé « critterLevels »', () => {
  it('lecture depuis critterLevels (valeurs invalides ignorées, sans rien supprimer de la base)', async () => {
    await commit({ set: [[CRITTER_LEVELS_KEY, { 'classic-fox': 3, 'black-rabbit': 9, inconnu: 2 }]] })
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3 })
    expect(await stored(CRITTER_LEVELS_KEY)).toEqual({ 'classic-fox': 3, 'black-rabbit': 9, inconnu: 2 }) // lecture seule
  })

  it('écriture d’un niveau valide : critterLevels seul est écrit, critters n’est pas réécrit et ne contient aucun niveau', async () => {
    await obtain('classic-fox')
    const crittersBefore = await stored('critters')
    expect(await updateCritterLevel('classic-fox', 3)).toEqual({ 'classic-fox': 3 })
    expect(await stored(CRITTER_LEVELS_KEY)).toEqual({ 'classic-fox': 3 })
    expect(await stored('critters')).toEqual(crittersBefore)
    expect(JSON.stringify(await stored('critters'))).not.toContain('level')
    resetStoreForTests() // redémarrage
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3 })
  })

  it('remplacer, puis effacer un niveau ; les autres animaux ne sont pas touchés', async () => {
    await obtain('classic-fox')
    await obtain('classic-rabbit')
    await updateCritterLevel('classic-fox', 2)
    await updateCritterLevel('classic-rabbit', 5)
    expect(await updateCritterLevel('classic-fox', 4)).toEqual({ 'classic-fox': 4, 'classic-rabbit': 5 })
    expect(await updateCritterLevel('classic-fox', null)).toEqual({ 'classic-rabbit': 5 })
    expect(await stored(CRITTER_LEVELS_KEY)).toEqual({ 'classic-rabbit': 5 })
  })

  it('refus d’un niveau hors de 1 à 5 : rien n’est écrit', async () => {
    await obtain('classic-fox')
    await updateCritterLevel('classic-fox', 2)
    const before = await readEntries()
    for (const bad of [0, 6, -1, 2.5, NaN, '3' as unknown as number]) {
      await expect(updateCritterLevel('classic-fox', bad)).rejects.toBeInstanceOf(CritterError)
    }
    expect(await readEntries()).toEqual(before)
  })

  it('refus d’un niveau pour un animal non obtenu ou inconnu : rien n’est écrit', async () => {
    await obtain('classic-fox')
    await updateCritterLevel('classic-fox', 2)
    const before = await readEntries()
    await expect(updateCritterLevel('classic-rabbit', 3)).rejects.toThrow('Coche « Obtenu »')
    await expect(updateCritterLevel('classic-rabbit', null)).rejects.toThrow('Coche « Obtenu »')
    await expect(updateCritterLevel('inconnu', 3)).rejects.toThrow('inconnu')
    await expect(updateCritterLevel('constructor', 3)).rejects.toThrow('inconnu')
    expect(await readEntries()).toEqual(before)
  })

  it('décocher « Obtenu » garde le niveau (masqué) ; il n’est plus modifiable tant que l’animal n’est pas recoché', async () => {
    await obtain('classic-fox')
    await updateCritterLevel('classic-fox', 4)
    await obtain('classic-fox', false)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 4 })
    await expect(updateCritterLevel('classic-fox', 2)).rejects.toThrow('Coche « Obtenu »')
    await obtain('classic-fox', true)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 4 })
  })

  it('« Obtenu » décoché dans un autre onglet pendant le réglage : la transaction relit critters et refuse', async () => {
    await obtain('classic-fox')
    // Les transactions d'écriture s'exécutent l'une après l'autre, dans l'ordre : le décochage passe en premier.
    const results = await Promise.allSettled([obtain('classic-fox', false), updateCritterLevel('classic-fox', 3)])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1]).toMatchObject({ status: 'rejected' })
    expect((await loadCritters()).progress['classic-fox']?.obtained).toBeUndefined()
    expect(await loadCritterLevels()).toEqual({}) // jamais de niveau créé sur un animal non obtenu
  })

  it('les entrées d’une version plus récente (animal inconnu ici) sont conservées à chaque écriture', async () => {
    await commit({ set: [[CRITTER_LEVELS_KEY, { animalFutur: 4, 'classic-fox': 9 }]] })
    await obtain('classic-fox')
    await updateCritterLevel('classic-fox', 2)
    expect(await stored(CRITTER_LEVELS_KEY)).toEqual({ animalFutur: 4, 'classic-fox': 2 })
  })
})

describe('niveaux : les opérations sur « critters » ne touchent jamais critterLevels', () => {
  it('nourrir, obtenir, décocher, extensions : critterLevels reste strictement identique', async () => {
    await obtain('classic-fox')
    await obtain('classic-rabbit')
    await updateCritterLevel('classic-fox', 3)
    await updateCritterLevel('classic-rabbit', 5)
    const before = JSON.stringify(await stored(CRITTER_LEVELS_KEY))
    await updateCritters({ type: 'feed', id: 'calico-rabbit' }, NOW)
    await updateCritters({ type: 'set-feedings', id: 'black-rabbit', count: 2 }, NOW)
    await updateCritters({ type: 'owned', collection: 'eternity', value: true }, NOW)
    await updateCritters({ type: 'set-extensions', owned: { eternity: true, storybook: false } }, NOW)
    await obtain('classic-fox', false)
    expect(JSON.stringify(await stored(CRITTER_LEVELS_KEY))).toBe(before)
  })
})

describe('ancienne version publiée (v3) : elle peut réécrire « critters », jamais effacer critterLevels', () => {
  /**
   * La version 3 ignore totalement critterLevels. Son code de suivi des animaux est identique à celui d'aujourd'hui :
   * `model.ts` n'a pas été modifié (git diff vide par rapport à 8f9a85e) et `updateCritters` non plus. Appeler
   * `updateCritters` ou réécrire la clé `critters` en bloc EST donc exactement ce que fait une page restée en version 3.
   */
  async function seedWithLevels() {
    await obtain('classic-fox')
    await obtain('classic-rabbit')
    await updateCritterLevel('classic-fox', 3)
    await updateCritterLevel('classic-rabbit', 5)
    await commit({ set: [[CRITTER_LEVELS_KEY, { ...((await stored(CRITTER_LEVELS_KEY)) as object), animalFutur: 2 }]] })
    return JSON.stringify(await stored(CRITTER_LEVELS_KEY))
  }

  it('NON-RÉGRESSION du scénario révélé par l’audit : la version 3 modifie un animal ; les niveaux de TOUS les animaux restent', async () => {
    const before = await seedWithLevels()
    await updateCritters({ type: 'feed', id: 'calico-rabbit' }, NOW) // écriture complète de « critters » par le code de la v3
    await updateCritters({ type: 'obtained', id: 'classic-fox', value: false }, NOW)
    await updateCritters({ type: 'obtained', id: 'classic-fox', value: true }, NOW)
    expect(JSON.stringify(await stored(CRITTER_LEVELS_KEY))).toBe(before)
    // La v3 a bien réécrit « critters » (les nourrissages y sont) ...
    expect((await loadCritters()).progress['calico-rabbit']?.feedings).toBe(1)
    // ... et la version actuelle retrouve les niveaux
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3, 'classic-rabbit': 5 })
  })

  it('la version 3 remplace entièrement la clé « critters » : critterLevels est identique', async () => {
    const before = await seedWithLevels()
    await commit({ set: [['critters', { owned: {}, configured: true, progress: { 'black-rabbit': { feedings: 1, lastFed: '2026-11-13' } } }]] })
    expect(JSON.stringify(await stored(CRITTER_LEVELS_KEY))).toBe(before)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3, 'classic-rabbit': 5 })
  })

  it('la version 3 attribue un métier (autre écriture qu’elle sait faire) : critterLevels est identique', async () => {
    const before = await seedWithLevels()
    await updateAssignment('aladdin', 'fishing')
    expect(JSON.stringify(await stored(CRITTER_LEVELS_KEY))).toBe(before)
  })

  it('restauration par la version 3 d’un fichier qu’elle sait lire (sans section critterLevels) : critterLevels est identique', async () => {
    const before = await seedWithLevels()
    const file = await createBackup({ includePhotos: false })
    delete file.sections.critterLevels // une v3 n'écrit que les sections qu'elle connaît
    await updateCritters({ type: 'feed', id: 'black-rabbit' }, NOW)
    await applyRestore(parseBackupText(JSON.stringify(file)))
    expect(JSON.stringify(await stored(CRITTER_LEVELS_KEY))).toBe(before)
    // ... et l'annulation de cette restauration ne touche pas non plus critterLevels
    await undoLastRestore()
    expect(JSON.stringify(await stored(CRITTER_LEVELS_KEY))).toBe(before)
  })

  it('une version 3 refuse une restauration COMPLÈTE d’un fichier contenant critterLevels (section inconnue pour elle)', async () => {
    // Le contrôle de la v3 : toute section absente de sa liste fait refuser un fichier « complete ».
    // On l'exerce avec le vrai analyseur en lui donnant une section que lui-même ne connaît pas.
    const file = await createBackup({ includePhotos: false })
    const withFuture = { ...file, sections: { ...file.sections, sectionDuFutur: { v: 1, data: {} } } }
    expect(() => parseBackupText(JSON.stringify(withFuture))).toThrow('Restauration complète impossible')
    // Et la liste des sections de la version actuelle contient bien critterLevels : c'est ce qui la rend « inconnue » pour la v3.
    expect(DATA_SECTIONS.map((s) => s.id)).toContain('critterLevels')
  })
})

describe('sauvegarde et restauration des niveaux', () => {
  async function seed() {
    await obtain('classic-fox')
    await obtain('classic-rabbit')
    await updateCritterLevel('classic-fox', 3)
    await updateCritterLevel('classic-rabbit', 5)
    await commit({ set: [['futureKey', { garde: true }], ['tasks', { enabled: ['x'] }]] })
  }

  it('export : la sauvegarde contient la section critterLevels et les niveaux', async () => {
    await seed()
    const file = await createBackup({ includePhotos: false })
    expect(file.sections.critterLevels).toEqual({ v: 1, data: { 'classic-fox': 3, 'classic-rabbit': 5 } })
    expect(JSON.stringify(file.sections.critters)).not.toContain('level') // jamais dans « critters »
  })

  it('export sans aucun niveau : section présente et vide (pas d’invention)', async () => {
    const file = await createBackup({ includePhotos: false })
    expect(file.sections.critterLevels).toEqual({ v: 1, data: {} })
  })

  it('restauration d’une sauvegarde avec niveaux : exactement les mêmes niveaux, annulation possible', async () => {
    await seed()
    const file = await createBackup({ includePhotos: false })
    resetStoreForTests(`test-${Math.random()}`)
    await commit({ set: [[CRITTER_LEVELS_KEY, { 'classic-fox': 1, animalFutur: 4 }]] })
    const parsed = parseBackupText(JSON.stringify(file))
    const plan = await planRestore(parsed)
    expect(plan.find((p) => p.id === 'critterLevels')).toMatchObject({ action: 'replace', label: 'Niveaux des compagnons' })
    await applyRestore(parsed)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3, 'classic-rabbit': 5 })
    // Annuler remet EXACTEMENT l'état d'avant, entrées inconnues comprises
    await undoLastRestore()
    expect(await stored(CRITTER_LEVELS_KEY)).toEqual({ 'classic-fox': 1, animalFutur: 4 })
  })

  it('ancienne sauvegarde SANS critterLevels : restaurée sans inventer de niveau, les niveaux du téléphone sont gardés', async () => {
    await seed()
    const old = await createBackup({ includePhotos: false })
    delete old.sections.critterLevels
    delete (old as Partial<BackupFile>).schema
    await updateCritterLevel('classic-fox', 5) // état du téléphone différent du fichier
    const parsed = parseBackupText(JSON.stringify(old))
    const plan = await planRestore(parsed)
    expect(plan.find((p) => p.id === 'critterLevels')).toMatchObject({ action: 'keep' })
    await applyRestore(parsed)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 5, 'classic-rabbit': 5 })
    // Sur un téléphone sans niveau : toujours aucun niveau inventé
    resetStoreForTests(`test-${Math.random()}`)
    await applyRestore(parseBackupText(JSON.stringify(old)))
    expect(await loadCritterLevels()).toEqual({})
    expect(await stored(CRITTER_LEVELS_KEY)).toBeUndefined()
  })

  it('sauvegarde invalide : refus explicite, rien n’est écrit ni supprimé', async () => {
    await seed()
    const file = await createBackup({ includePhotos: false })
    const before = await readEntries()
    const broken = (patch: (f: BackupFile) => void) => {
      const copy = JSON.parse(JSON.stringify(file)) as BackupFile
      patch(copy)
      return JSON.stringify(copy)
    }
    expect(() => parseBackupText(broken((f) => (f.sections.critterLevels = { v: 1, data: 'abîmé' })))).toThrow('abîmée')
    expect(() => parseBackupText(broken((f) => (f.sections.critterLevels = { v: 1, data: ['x'] })))).toThrow(BackupError)
    expect(() => parseBackupText(broken((f) => (f.sections.critterLevels = { v: 'x' as never, data: {} })))).toThrow('abîmée')
    expect(() => parseBackupText(broken((f) => (f.sections.critterLevels = { v: 2, data: {} })))).toThrow('version plus récente')
    expect(() => parseBackupText('pas du json')).toThrow('lisible')
    expect(await readEntries()).toEqual(before)
  })

  it('niveaux invalides dans le fichier : écartés et comptés, les valides sont restaurés', async () => {
    const file = await createBackup({ includePhotos: false })
    file.sections.critterLevels = { v: 1, data: { 'classic-fox': 4, 'black-rabbit': 9, inconnu: 2, 'calico-rabbit': '3' } }
    const parsed = parseBackupText(JSON.stringify(file))
    expect(parsed.sections.find((s) => s.id === 'critterLevels')).toMatchObject({ data: { 'classic-fox': 4 }, ignored: 3 })
    expect((await planRestore(parsed)).find((p) => p.id === 'critterLevels')!.detail).toContain('3 entrées inconnues ignorées')
    await applyRestore(parsed)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 4 })
  })

  it('une restauration ne supprime aucune donnée non concernée (clés inconnues, tâches, photos)', async () => {
    await seed()
    await commit({ set: [['portrait:aladdin', new Blob(['x'], { type: 'image/jpeg' })]] })
    const file = await createBackup({ includePhotos: false })
    // Fichier partiel : seulement critterLevels
    const partial = { ...file, type: 'partial' as const, sections: { critterLevels: { v: 1, data: { 'classic-fox': 1 } } } }
    delete (partial as Partial<BackupFile>).assignments
    const before = await readEntries()
    await applyRestore(parseBackupText(JSON.stringify(partial)))
    const after = await readEntries()
    expect(after.critterLevels).toEqual({ 'classic-fox': 1 })
    for (const key of Object.keys(before)) {
      if (key === CRITTER_LEVELS_KEY || key === 'snapshot:pre-import') continue
      expect(after[key], key).toEqual(before[key])
    }
    expect(after.futureKey).toEqual({ garde: true })
    expect(Object.keys(after).sort()).toEqual([...Object.keys(before), 'snapshot:pre-import'].sort()) // rien de supprimé, seule la copie d'annulation s'ajoute
  })

  it('les copies de sécurité de migration incluent critterLevels (ce n’est ni une photo, ni une copie, ni une méta)', () => {
    expect(Object.keys(pickData({ critterLevels: { 'classic-fox': 3 }, 'portrait:x': 1, 'snapshot:y': 1, 'meta:schema': 3 }))).toEqual(['critterLevels'])
  })
})

describe('niveaux : plusieurs onglets', () => {
  async function openTab() {
    const tab = renderHook(() => useCritters())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    expect(tab.result.current.failure).toBeNull()
    return tab
  }

  it('un niveau réglé dans un onglet apparaît dans l’autre, sans rien écraser', async () => {
    await obtain('classic-fox')
    await obtain('classic-rabbit')
    const a = await openTab()
    const b = await openTab()
    await waitFor(() => expect(a.result.current.data.progress['classic-fox']?.obtained).toBe(true))
    act(() => {
      a.result.current.setLevel('classic-fox', 3)
      b.result.current.setLevel('classic-rabbit', 4)
    })
    for (const tab of [a, b]) await waitFor(() => expect(tab.result.current.levels).toEqual({ 'classic-fox': 3, 'classic-rabbit': 4 }))
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3, 'classic-rabbit': 4 })
    // Un nourrissage dans l'onglet B ne fait pas perdre les niveaux
    act(() => b.result.current.apply({ type: 'feed', id: 'calico-rabbit' }))
    await waitFor(async () => expect((await loadCritters()).progress['calico-rabbit']?.feedings).toBe(1))
    await waitFor(() => expect(a.result.current.data.progress['calico-rabbit']?.feedings).toBe(1))
    expect(a.result.current.levels).toEqual({ 'classic-fox': 3, 'classic-rabbit': 4 })
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3, 'classic-rabbit': 4 })
    a.unmount()
    b.unmount()
  })

  it('un onglet qui croit l’animal obtenu alors qu’il a été décoché ailleurs : refus, message clair, retour à l’état enregistré', async () => {
    await obtain('classic-fox')
    const tab = await openTab()
    await commit({ set: [['critters', { owned: {}, configured: true, progress: {} }]] }) // décoché dans un autre onglet, sans prévenir
    act(() => tab.result.current.setLevel('classic-fox', 3))
    await waitFor(() => expect(tab.result.current.error).toContain('Coche « Obtenu »'))
    await waitFor(() => expect(tab.result.current.levels).toEqual({}))
    expect(await stored(CRITTER_LEVELS_KEY)).toBeUndefined()
    tab.unmount()
  })

  it('une restauration faite ailleurs actualise aussi les niveaux de l’onglet ouvert', async () => {
    const a = await openTab()
    await commit({ set: [[CRITTER_LEVELS_KEY, { 'classic-fox': 2 }]] })
    const { createSync } = await import('../../lib/sync')
    createSync(() => {}).notify('restored')
    await waitFor(() => expect(a.result.current.levels).toEqual({ 'classic-fox': 2 }))
    a.unmount()
  })
})

describe('garde-fou des futures versions : version des données plus récente que le code', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('MAX_WRITABLE_SCHEMA suit CURRENT_SCHEMA (à augmenter ensemble)', () => {
    expect(MAX_WRITABLE_SCHEMA).toBe(CURRENT_SCHEMA)
  })

  it('données déclarées plus récentes : toute écriture est refusée sans rien modifier ; les lectures restent possibles', async () => {
    await obtain('classic-fox')
    await updateCritterLevel('classic-fox', 3)
    await commit({ set: [[SCHEMA_KEY, CURRENT_SCHEMA + 1]] }) // une version plus récente a migré les données
    const before = await readEntries()
    await expect(updateCritters({ type: 'feed', id: 'black-rabbit' }, NOW)).rejects.toBeInstanceOf(NewerDataError)
    await expect(updateCritterLevel('classic-fox', 5)).rejects.toBeInstanceOf(NewerDataError)
    await expect(updateAssignment('aladdin', 'fishing')).rejects.toBeInstanceOf(NewerDataError)
    await expect(commit({ set: [['critterLevels', {}]] })).rejects.toBeInstanceOf(NewerDataError)
    expect(await readEntries()).toEqual(before)
    // lectures : toujours possibles
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 3 })
    expect(sameJson(await readKey('critters'), (before as Record<string, unknown>).critters)).toBe(true)
  })

  it('même version ou version plus ancienne : les écritures passent normalement', async () => {
    await commit({ set: [[SCHEMA_KEY, CURRENT_SCHEMA]] })
    await obtain('classic-fox')
    await updateCritterLevel('classic-fox', 2)
    expect(await loadCritterLevels()).toEqual({ 'classic-fox': 2 })
  })

  it('l’écran affiche un message précis (recharger l’app) au lieu d’un faux problème d’espace', async () => {
    await obtain('classic-fox')
    const tab = renderHook(() => useCritters())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    await commit({ set: [[SCHEMA_KEY, CURRENT_SCHEMA + 1]] })
    act(() => tab.result.current.apply({ type: 'feed', id: 'black-rabbit' }))
    await waitFor(() => expect(tab.result.current.error).toContain('version plus récente'))
    expect(tab.result.current.error).not.toContain('espace')
    tab.unmount()
  })
})
