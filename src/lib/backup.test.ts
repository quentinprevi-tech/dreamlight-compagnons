import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { CHARACTERS } from '../data/characters'
import { sanitizeAssignments } from './storage'
import {
  applyRestore,
  BackupError,
  createBackup,
  createRescueBackup,
  BACKUP_TOO_LARGE,
  dataUrlToBlob,
  MAX_BACKUP_BYTES,
  lastRestore,
  parseBackupText,
  planRestore,
  RESTORE_SNAPSHOT_KEY,
  undoLastRestore,
} from './backup'
import { commit, readEntries, resetStoreForTests } from './db'
import { CURRENT_SCHEMA, MIGRATION_KEY, SCHEMA_KEY, snapshotKey } from './migrations'

const jpeg = (text: string) => new NodeBlob([text], { type: 'image/jpeg' }) as unknown as Blob
const dataUrl = (text: string) => `data:image/jpeg;base64,${btoa(text)}`
const NAME = 'character:the-forgotten'

async function seed({ assignments = {}, names, photos = {} }: { assignments?: object; names?: object; photos?: Record<string, string> }) {
  const set: [string, unknown][] = [['assignments', assignments]]
  if (names) set.push(['names', names])
  for (const [id, text] of Object.entries(photos)) set.push([`portrait:${id}`, jpeg(text)])
  await commit({ set })
}

/** Photos du téléphone : id → contenu texte. */
async function phonePhotos(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(await readEntries())) {
    if (key.startsWith('portrait:')) out[key.slice(9)] = await (value as Blob).text()
  }
  return out
}

const restore = async (file: unknown) => applyRestore(parseBackupText(JSON.stringify(file)))

/** Fichier v2 écrit à la main (sans la copie de premier niveau, facultative). */
function v2(sections: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { app: 'dreamlight-compagnons', format: 2, type: 'complete', exportedAt: '2026-11-09T10:00:00.000Z', schema: 2, sections, ...extra }
}
const EMPTY = { assignments: { v: 1, data: {} }, names: { v: 1, data: {} } }

async function expectNothingWritten(before: Record<string, unknown>) {
  const after = await readEntries()
  expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort())
  expect(after.assignments).toEqual(before.assignments)
}

describe('export', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('une sauvegarde complète contient toutes les sections, même vides', async () => {
    const file = await createBackup({ includePhotos: true })
    expect(file).toMatchObject({ app: 'dreamlight-compagnons', format: 2, type: 'complete' })
    expect(file.sections).toEqual({
      assignments: { v: 1, data: {} },
      villagers: { v: 1, data: {} },
      tasks: { v: 1, data: { enabled: {}, custom: [], done: {}, removed: {}, postponed: [] } },
      critters: { v: 1, data: { owned: {}, configured: false, progress: {} } },
      critterLevels: { v: 1, data: {} },
      tales: { v: 1, data: { counts: {}, puzzles: {}, log: [] } },
      recipes: { v: 1, data: { known: {}, favorites: {} } },
      names: { v: 1, data: {} },
      photos: null,
    })
  })

  it('photos : null si non incluses ou si le téléphone n’en a aucune', async () => {
    await seed({ assignments: { mickey: 'fishing' }, photos: { ariel: 'A' } })
    expect((await createBackup({ includePhotos: false })).sections.photos).toBeNull()
    resetStoreForTests(`test-${Math.random()}`)
    await seed({ assignments: { mickey: 'fishing' } })
    expect((await createBackup({ includePhotos: true })).sections.photos).toBeNull()
  })

  it('aller-retour complet avec photos et noms vers un autre téléphone', async () => {
    await seed({ assignments: { mickey: 'fishing', elsa: 'mining' }, names: { [NAME]: 'L’Oubliée' }, photos: { ariel: 'A', belle: 'B' } })
    const file = await createBackup({ includePhotos: true })
    expect(Object.keys((file.sections.photos as { data: object }).data).sort()).toEqual(['ariel', 'belle'])

    resetStoreForTests(`test-${Math.random()}`)
    await restore(file)
    const all = await readEntries()
    expect(all.assignments).toEqual({ mickey: 'fishing', elsa: 'mining' })
    expect(all.names).toEqual({ [NAME]: 'L’Oubliée' })
    expect(await phonePhotos()).toEqual({ ariel: 'A', belle: 'B' })
  })

  it('reconvertit une photo à l’identique', async () => {
    expect(await dataUrlToBlob(dataUrl('xyz')).text()).toBe('xyz')
  })
})

describe('compatibilité avec la première version', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  /** Copie exacte de `parseBackup` de la première version (commit 66e987b). */
  function parseBackupV1App(text: string) {
    const data = JSON.parse(text) as { app?: string; assignments?: unknown }
    if (data?.app !== 'dreamlight-compagnons') throw new Error('Ce fichier ne vient pas de Dreamlight Compagnons.')
    return sanitizeAssignments(data.assignments)
  }

  it('un export v2 reste lisible par l’ancienne app, avec les mêmes métiers', async () => {
    await seed({ assignments: { mickey: 'fishing', goofy: 'gardening' } })
    const file = await createBackup({ includePhotos: false })
    expect(file.assignments).toEqual(file.sections.assignments!.data)
    expect(parseBackupV1App(JSON.stringify(file))).toEqual({ mickey: 'fishing', goofy: 'gardening' })
  })

  it('refuse un fichier dont les deux copies des métiers divergent', async () => {
    const file = v2({ ...EMPTY, assignments: { v: 1, data: { mickey: 'fishing' } } }, { assignments: { goofy: 'gardening' } })
    expect(() => parseBackupText(JSON.stringify(file))).toThrow('ne correspondent pas')
  })

  it('ancien fichier v1 : seuls les métiers sont remplacés', async () => {
    await seed({ assignments: { mickey: 'fishing' }, names: { [NAME]: 'Mon nom' }, photos: { ariel: 'A' } })
    const v1 = { app: 'dreamlight-compagnons', version: 1, exportedAt: '2026-10-31T10:00:00Z', assignments: { elsa: 'mining', inconnu: 'fishing' } }
    const parsed = parseBackupText(JSON.stringify(v1))
    expect(parsed).toMatchObject({ type: 'partial', format: 1 })

    const plan = await planRestore(parsed)
    expect(plan.map((p) => [p.id, p.action])).toEqual([
      ['assignments', 'replace'],
      ['villagers', 'keep'],
      ['tasks', 'keep'],
      ['critters', 'keep'],
      ['critterLevels', 'keep'],
      ['tales', 'keep'],
      ['recipes', 'keep'],
      ['names', 'keep'],
      ['photos', 'keep'],
    ])
    expect(plan[0].detail).toContain('1 entrée inconnue ignorée')

    await applyRestore(parsed)
    const all = await readEntries()
    expect(all.assignments).toEqual({ elsa: 'mining' })
    expect(all.names).toEqual({ [NAME]: 'Mon nom' })
    expect(await phonePhotos()).toEqual({ ariel: 'A' })
  })

  it('refuse un fichier v1 abîmé au lieu de vider les métiers', async () => {
    await seed({ assignments: { mickey: 'fishing' } })
    expect(() => parseBackupText(JSON.stringify({ app: 'dreamlight-compagnons', version: 1, assignments: 'abîmé' }))).toThrow('abîmée')
  })
})

describe('import : sections', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('une section absente du fichier (sauvegarde plus ancienne) est conservée', async () => {
    await seed({ assignments: { mickey: 'fishing' }, names: { [NAME]: 'Mon nom' } })
    await restore(v2({ assignments: { v: 1, data: { elsa: 'mining' } } }))
    const all = await readEntries()
    expect(all.assignments).toEqual({ elsa: 'mining' })
    expect(all.names).toEqual({ [NAME]: 'Mon nom' })
  })

  it('distingue restauration complète et import partiel', () => {
    expect(parseBackupText(JSON.stringify(v2(EMPTY))).type).toBe('complete')
    expect(parseBackupText(JSON.stringify(v2(EMPTY, { type: 'partial' }))).type).toBe('partial')
  })

  it.each([
    ['des données qui ne sont pas un objet', { v: 1, data: 'corrompu' }],
    ['une section nulle', null],
    ['une section sans version', { data: {} }],
    ['une liste à la place des données', { v: 1, data: ['fishing'] }],
  ])('refuse une section abîmée (%s) au lieu de la lire comme vide', async (_cas, section) => {
    await seed({ assignments: { mickey: 'fishing', goofy: 'gardening' } })
    const before = await readEntries()
    for (const type of ['complete', 'partial']) {
      expect(() => parseBackupText(JSON.stringify(v2({ ...EMPTY, assignments: section }, { type })))).toThrow(BackupError)
    }
    await expectNothingWritten(before)
  })

  it('restauration complète : refuse une section inconnue ou une version future, en les nommant', () => {
    expect(() => parseBackupText(JSON.stringify(v2({ ...EMPTY, photos: null, wishlist: { v: 1, data: {} } })))).toThrow('« wishlist »')
    expect(() => parseBackupText(JSON.stringify(v2({ ...EMPTY, photos: null }, { schema: CURRENT_SCHEMA + 1 })))).toThrow(
      'Restauration complète impossible',
    )
  })

  it('import partiel : section inconnue et version future signalées, données connues importées', async () => {
    await seed({ assignments: { mickey: 'fishing' } })
    const file = v2({ assignments: { v: 1, data: { elsa: 'mining' } }, wishlist: { v: 1, data: { x: 1 } } }, { type: 'partial', schema: CURRENT_SCHEMA + 1 })
    const parsed = parseBackupText(JSON.stringify(file))
    const plan = await planRestore(parsed)
    expect(plan.find((p) => p.id === 'unknown:wishlist')).toMatchObject({ action: 'ignore', label: 'Section « wishlist »' })
    expect(plan.find((p) => p.id === 'schema')).toMatchObject({ action: 'ignore' })
    await applyRestore(parsed)
    const all = await readEntries()
    expect(all.assignments).toEqual({ elsa: 'mining' })
    expect('wishlist' in all).toBe(false)
  })

  it('refuse les fichiers étrangers, illisibles ou de format trop récent', () => {
    expect(() => parseBackupText('pas du json')).toThrow(BackupError)
    expect(() => parseBackupText('{"foo":1}')).toThrow('ne vient pas de Dreamlight Compagnons')
    expect(() => parseBackupText(JSON.stringify({ ...v2({}), format: 3 }))).toThrow('plus récente')
    expect(() => parseBackupText(JSON.stringify(v2({ assignments: { v: 9, data: {} } })))).toThrow('plus récente')
  })

  it('n’accepte aucun habitant, métier ou nom inconnu (propriétés héritées comprises)', async () => {
    const raw = `{"app":"dreamlight-compagnons","format":2,"type":"complete","schema":2,"sections":{
      "assignments":{"v":1,"data":{"constructor":"fishing","toString":"mining","__proto__":"fishing","mickey":"constructor","elsa":"mining"}},
      "names":{"v":1,"data":{"recipe:soupe":"Soupe","critter:inconnu":"Y","character:constructor":"X","critter:calico-rabbit":"Lapin tacheté","${NAME}":"Nom"}},
      "photos":{"v":1,"data":{"toString":"${dataUrl('T')}","__proto__":"${dataUrl('P')}"}}}}`
    const parsed = parseBackupText(raw)
    expect(parsed.sections.find((s) => s.id === 'assignments')).toMatchObject({ data: { elsa: 'mining' }, ignored: 4 })
    expect(parsed.sections.find((s) => s.id === 'names')).toMatchObject({
      data: { [NAME]: 'Nom', 'critter:calico-rabbit': 'Lapin tacheté' },
      ignored: 3,
    })
    expect(parsed.photos).toMatchObject({ state: 'included', data: {}, unreadable: [], ignored: 2 })
  })
})

describe('import : photos', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('photos = null : les photos du téléphone sont conservées', async () => {
    await seed({ photos: { ariel: 'A' } })
    const file = v2({ ...EMPTY, photos: null })
    expect((await planRestore(parseBackupText(JSON.stringify(file)))).find((p) => p.id === 'photos')?.action).toBe('keep')
    await restore(file)
    expect(await phonePhotos()).toEqual({ ariel: 'A' })
  })

  it('photos = {} : les photos du téléphone sont supprimées, et c’est annoncé', async () => {
    await seed({ photos: { ariel: 'A', belle: 'B' } })
    const file = v2({ ...EMPTY, photos: { v: 1, data: {} } })
    const item = (await planRestore(parseBackupText(JSON.stringify(file)))).find((p) => p.id === 'photos')
    expect(item).toMatchObject({ action: 'delete', detail: expect.stringContaining('2 photos') })
    await restore(file)
    expect(await phonePhotos()).toEqual({})
  })

  it('photos renseignées : le téléphone a exactement les photos du fichier', async () => {
    await seed({ photos: { ariel: 'ancienne', belle: 'B' } })
    const file = v2({ ...EMPTY, photos: { v: 1, data: { ariel: dataUrl('nouvelle'), elsa: dataUrl('E') } } })
    const item = (await planRestore(parseBackupText(JSON.stringify(file)))).find((p) => p.id === 'photos')
    expect(item?.detail).toContain('dont 1 supprimée')
    await restore(file)
    expect(await phonePhotos()).toEqual({ ariel: 'nouvelle', elsa: 'E' })
  })

  it('une photo illisible ne supprime jamais celle du téléphone', async () => {
    await seed({ photos: { ariel: 'A', belle: 'B' } })
    // Seule photo du fichier, et illisible : ce n'est PAS un « {} »
    const parsed = parseBackupText(JSON.stringify(v2({ ...EMPTY, photos: { v: 1, data: { ariel: 'abîmée' } } })))
    expect(parsed.photos).toMatchObject({ state: 'included', data: {}, unreadable: ['ariel'] })
    const item = (await planRestore(parsed)).find((p) => p.id === 'photos')
    expect(item?.detail).toContain('1 photo illisible')
    await applyRestore(parsed)
    // Ariel gardée (photo illisible), Belle supprimée (absente du fichier, règle « ensemble exact »)
    expect(await phonePhotos()).toEqual({ ariel: 'A' })
  })

  it('mélange de photos lisibles, illisibles et d’habitants inconnus', async () => {
    await seed({ photos: { ariel: 'A', belle: 'B' } })
    const parsed = parseBackupText(
      JSON.stringify(v2({ ...EMPTY, photos: { v: 1, data: { belle: dataUrl('B2'), ariel: 'javascript:alert(1)', inconnu: dataUrl('X') } } })),
    )
    expect(parsed.photos).toMatchObject({ unreadable: ['ariel'], ignored: 1 })
    await applyRestore(parsed)
    expect(await phonePhotos()).toEqual({ ariel: 'A', belle: 'B2' })
  })

  it('refuse une section photos abîmée', () => {
    expect(() => parseBackupText(JSON.stringify(v2({ ...EMPTY, photos: { v: 1, data: 'x' } })))).toThrow('Photos personnelles')
    expect(() => parseBackupText(JSON.stringify(v2({ ...EMPTY, photos: ['x'] })))).toThrow('Photos personnelles')
  })
})

describe('restauration atomique et annulation', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('revient exactement à l’état d’avant, photos comprises, une seule fois', async () => {
    await seed({ assignments: { mickey: 'fishing' }, photos: { ariel: 'A' } })
    const before = await readEntries()
    await restore(v2({ assignments: { v: 1, data: { elsa: 'mining' } }, names: { v: 1, data: { [NAME]: 'Nom' } }, photos: { v: 1, data: { belle: dataUrl('B') } } }))
    expect(await lastRestore()).not.toBeNull()

    await undoLastRestore()
    const after = await readEntries()
    expect(after.assignments).toEqual(before.assignments)
    expect('names' in after).toBe(false) // n'existait pas avant
    expect(await phonePhotos()).toEqual({ ariel: 'A' })
    expect(RESTORE_SNAPSHOT_KEY in after).toBe(false)
    expect(await lastRestore()).toBeNull()
    await expect(undoLastRestore()).rejects.toThrow('Aucune restauration')
  })

  it('une restauration interrompue n’écrit rien, pas même la copie : pas d’annulation fantôme', async () => {
    await seed({ assignments: { mickey: 'fishing' }, photos: { ariel: 'A' } })
    const before = await readEntries()
    const parsed = parseBackupText(JSON.stringify(v2({ ...EMPTY, photos: { v: 1, data: { belle: dataUrl('B') } } })))
    await expect(
      applyRestore(parsed, {
        duringWrite: () => {
          throw new Error('fermeture de l’app')
        },
      }),
    ).rejects.toThrow('fermeture')
    await expectNothingWritten(before)
    expect(await phonePhotos()).toEqual({ ariel: 'A' })
    expect(await lastRestore()).toBeNull()
  })

  it('après un échec, l’annulation proposée reste celle de la dernière restauration réussie', async () => {
    await seed({ assignments: { mickey: 'fishing' } })
    await restore(v2({ ...EMPTY, assignments: { v: 1, data: { elsa: 'mining' } } }))
    const first = await lastRestore()
    const parsed = parseBackupText(JSON.stringify(v2({ ...EMPTY, assignments: { v: 1, data: { goofy: 'gardening' } } })))
    await expect(applyRestore(parsed, { duringWrite: () => { throw new Error('coupure') } })).rejects.toThrow()
    expect(await lastRestore()).toEqual(first)
    expect((await readEntries()).assignments).toEqual({ elsa: 'mining' })
    await undoLastRestore()
    expect((await readEntries()).assignments).toEqual({ mickey: 'fishing' })
  })

  it('une photo corrompue après lecture fait échouer la restauration avant toute écriture', async () => {
    await seed({ assignments: { mickey: 'fishing' } })
    const before = await readEntries()
    const bad = parseBackupText(JSON.stringify(v2({ ...EMPTY, assignments: { v: 1, data: { elsa: 'mining' } } })))
    bad.photos = { state: 'included', data: { ariel: 'data:image/jpeg;base64,@@' }, unreadable: [], ignored: 0 }
    await expect(applyRestore(bad)).rejects.toThrow()
    await expectNothingWritten(before)
  })
})

describe('copie de secours', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('part des données d’origine si une migration n’est pas allée au bout', async () => {
    await commit({
      set: [
        ['assignments', { goofy: 'gardening' }],
        [snapshotKey(CURRENT_SCHEMA), { from: 1, at: '2026-11-09T10:00:00Z', data: { assignments: { mickey: 'fishing' } } }],
        [MIGRATION_KEY, { step: 'written' }],
        ['portrait:ariel', jpeg('A')],
      ],
    })
    const file = await createRescueBackup()
    expect(file.sections.assignments).toEqual({ v: 1, data: { mickey: 'fishing' } })
    expect(Object.keys((file.sections.photos as { data: object }).data)).toEqual(['ariel'])
  })

  it('part des données actuelles quand la migration est terminée (copie ancienne ignorée)', async () => {
    await commit({
      set: [
        ['assignments', { goofy: 'gardening' }],
        [snapshotKey(CURRENT_SCHEMA), { from: 1, at: '2026-11-01T10:00:00Z', data: { assignments: { mickey: 'fishing' } } }],
        [SCHEMA_KEY, CURRENT_SCHEMA],
      ],
    })
    expect((await createRescueBackup()).sections.assignments).toEqual({ v: 1, data: { goofy: 'gardening' } })
  })
})

describe('import : taille maximale (25 Mo)', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('refuse un fichier trop gros avant tout JSON.parse, sans rien écrire', async () => {
    await seed({ assignments: { mickey: 'fishing' } })
    const before = await readEntries()
    expect(() => parseBackupText('x'.repeat(MAX_BACKUP_BYTES + 1))).toThrow(new BackupError(BACKUP_TOO_LARGE))
    await expectNothingWritten(before)
  })

  it('mesure les octets réels : des caractères multi-octets sous la limite en caractères mais au-dessus en octets sont refusés', () => {
    // « € » = 3 octets en UTF-8 : moins de 25 M de caractères, mais plus de 25 Mo.
    const over = '€'.repeat(Math.floor(MAX_BACKUP_BYTES / 3) + 1)
    expect(over.length).toBeLessThan(MAX_BACKUP_BYTES)
    expect(() => parseBackupText(over)).toThrow(new BackupError(BACKUP_TOO_LARGE))
    // Exactement à la limite : accepté par le contrôle de taille (puis refusé comme illisible, pas comme trop gros).
    const atLimit = '€'.repeat(Math.floor(MAX_BACKUP_BYTES / 3))
    expect(() => parseBackupText(atLimit)).toThrow(new BackupError('Ce fichier n’est pas une sauvegarde lisible.'))
  })

  it('accepte un export réaliste au maximum (80 photos d’environ 50 Ko), très en dessous de la limite', () => {
    const photo = `data:image/jpeg;base64,${'A'.repeat(50_000)}`
    const data = Object.fromEntries(CHARACTERS.slice(0, 80).map((c) => [c.id, photo]))
    const text = JSON.stringify(v2({ ...EMPTY, photos: { v: 1, data } }))
    expect(text.length).toBeLessThan(MAX_BACKUP_BYTES / 4)
    expect(() => parseBackupText(text)).not.toThrow()
  })
})
