import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { commit, readEntries, resetStoreForTests, type DataMap } from './db'
import {
  CURRENT_SCHEMA,
  MIGRATION_KEY,
  MigrationError,
  SCHEMA_KEY,
  runMigrations,
  snapshotKey,
  type Migration,
  type MigrationStep,
} from './migrations'

const ASSIGNMENTS = { mickey: 'fishing', goofy: 'gardening' }
const photo = () => new NodeBlob(['photo'], { type: 'image/jpeg' }) as unknown as Blob

/** Base telle qu'elle existe sur les téléphones avant la phase 0. */
async function seedV1() {
  await commit({
    set: [
      ['assignments', ASSIGNMENTS],
      ['legacy', { ancien: true }],
      ['portrait:ariel', photo()],
    ],
  })
}

/** Migrations de test, comme en aura la phase 1 : une clé dérivée des métiers, une clé retirée. */
const TEST_MIGRATIONS: Migration[] = [
  { to: 2, description: 'marqueur', migrate: (d) => d },
  {
    to: 3,
    description: 'test',
    migrate: ({ legacy: _legacy, ...rest }: DataMap) => ({
      ...rest,
      villagers: Object.fromEntries(Object.keys((rest.assignments as object) ?? {}).map((id) => [id, { unlocked: true }])),
    }),
  },
]

const EXPECTED_V3 = {
  assignments: ASSIGNMENTS,
  villagers: { mickey: { unlocked: true }, goofy: { unlocked: true } },
}

function failAt(step: MigrationStep) {
  return (s: MigrationStep) => {
    if (s === step) throw new Error(`interruption après « ${step} »`)
  }
}

/** Ce que voit l'app : données, version, marqueur et copie. */
async function state() {
  const all = await readEntries()
  return {
    data: { assignments: all.assignments, villagers: all.villagers, legacy: all.legacy },
    schema: all[SCHEMA_KEY],
    pending: MIGRATION_KEY in all,
    snapshot: all[snapshotKey(3)] as { from: number; at: string; data: DataMap } | undefined,
    photo: 'portrait:ariel' in all,
  }
}

async function expectFinalV3() {
  const s = await state()
  expect(s.data).toEqual({ ...EXPECTED_V3, legacy: undefined })
  expect(s.schema).toBe(3)
  expect(s.pending).toBe(false)
  expect(s.photo).toBe(true)
  expect(s.snapshot?.data).toEqual({ assignments: ASSIGNMENTS, legacy: { ancien: true } })
}

describe('migrations', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('installation neuve : pose la version actuelle', async () => {
    expect(await runMigrations()).toMatchObject({ status: 'migrated', from: 1, to: CURRENT_SCHEMA })
    const all = await readEntries()
    expect(all[SCHEMA_KEY]).toBe(CURRENT_SCHEMA)
    expect(MIGRATION_KEY in all).toBe(false)
    expect(await runMigrations()).toEqual({ status: 'up-to-date', schema: CURRENT_SCHEMA })
  })

  it('base v1 réelle : métiers et photos intacts, copie de sécurité de l’état d’origine', async () => {
    await seedV1()
    const before = await readEntries()
    expect(await runMigrations()).toMatchObject({ status: 'migrated', from: 1, to: CURRENT_SCHEMA, resumed: false })
    const after = await readEntries()
    expect(after.assignments).toEqual(before.assignments)
    expect(after['portrait:ariel']).toBeDefined()
    expect(after.legacy).toEqual({ ancien: true })
    expect((after[snapshotKey(CURRENT_SCHEMA)] as { data: DataMap }).data).toEqual({
      assignments: ASSIGNMENTS,
      legacy: { ancien: true },
    })
    // Deuxième lancement : rien à faire
    expect(await runMigrations()).toEqual({ status: 'up-to-date', schema: CURRENT_SCHEMA })
  })

  it('applique plusieurs étapes d’un coup (v1 → v3)', async () => {
    await seedV1()
    expect(await runMigrations({ migrations: TEST_MIGRATIONS })).toMatchObject({ status: 'migrated', from: 1, to: 3 })
    await expectFinalV3()
  })

  it.each<MigrationStep>(['snapshot', 'write', 'verify'])('reprend après une interruption juste après l’étape « %s »', async (step) => {
    await seedV1()
    await expect(runMigrations({ migrations: TEST_MIGRATIONS, afterStep: failAt(step) })).rejects.toThrow('interruption')

    const interrupted = await state()
    expect(interrupted.schema).toBeUndefined() // jamais déclarée terminée
    expect(interrupted.snapshot).toBeDefined()
    expect(interrupted.pending).toBe(step !== 'snapshot')

    // Redémarrage de l'app
    resetStoreForTests()
    expect(await runMigrations({ migrations: TEST_MIGRATIONS })).toMatchObject({ status: 'migrated', resumed: true })
    await expectFinalV3()
    expect((await state()).snapshot?.at).toBe(interrupted.snapshot?.at) // copie jamais écrasée
  })

  it('une interruption au milieu de l’écriture n’écrit rien (transaction annulée)', async () => {
    await seedV1()
    await expect(
      runMigrations({
        migrations: TEST_MIGRATIONS,
        duringWrite: () => {
          throw new Error('fermeture de l’app')
        },
      }),
    ).rejects.toThrow('fermeture')

    const s = await state()
    expect(s.data).toEqual({ assignments: ASSIGNMENTS, villagers: undefined, legacy: { ancien: true } })
    expect(s.pending).toBe(false)
    expect(s.schema).toBeUndefined()

    resetStoreForTests()
    await runMigrations({ migrations: TEST_MIGRATIONS })
    await expectFinalV3()
  })

  it('ne valide pas une migration dont la relecture ne correspond pas', async () => {
    await seedV1()
    const corrupt = (s: MigrationStep) => {
      // Une écriture parasite passe entre l'écriture et la vérification.
      if (s === 'write') void commit({ set: [['villagers', { abimé: true }]] })
    }
    await expect(runMigrations({ migrations: TEST_MIGRATIONS, afterStep: corrupt })).rejects.toBeInstanceOf(MigrationError)
    const s = await state()
    expect(s.schema).toBeUndefined()
    expect(s.pending).toBe(true)

    // Au lancement suivant, la migration est refaite depuis la copie.
    resetStoreForTests()
    await runMigrations({ migrations: TEST_MIGRATIONS })
    await expectFinalV3()
  })

  it('conserve un métier modifié par un autre onglet pendant l’interruption', async () => {
    await seedV1()
    await expect(runMigrations({ migrations: TEST_MIGRATIONS, afterStep: failAt('snapshot') })).rejects.toThrow()
    await commit({ set: [['assignments', { ...ASSIGNMENTS, elsa: 'mining' }]] })

    await runMigrations({ migrations: TEST_MIGRATIONS })
    expect((await readEntries()).assignments).toEqual({ ...ASSIGNMENTS, elsa: 'mining' })
  })

  it('refuse une migration qui modifierait les métiers', async () => {
    await seedV1()
    const bad: Migration[] = [{ to: 2, description: 'interdit', migrate: (d) => ({ ...d, assignments: {} }) }]
    await expect(runMigrations({ migrations: bad })).rejects.toBeInstanceOf(MigrationError)
    const all = await readEntries()
    expect(all.assignments).toEqual(ASSIGNMENTS)
    expect(all[SCHEMA_KEY]).toBeUndefined()
  })

  it('deux migrations simultanées sans verrou (vieux navigateurs) : aucune erreur, copie unique', async () => {
    expect(navigator.locks).toBeUndefined() // jsdom : chemin sans verrou
    await seedV1()
    const results = await Promise.all([runMigrations({ migrations: TEST_MIGRATIONS }), runMigrations({ migrations: TEST_MIGRATIONS })])
    for (const r of results) expect(['migrated', 'up-to-date']).toContain(r.status)
    await expectFinalV3()
  })

  it('la copie de sécurité n’est jamais remplacée, même par une migration lancée en parallèle', async () => {
    await seedV1()
    // Le premier onglet pose la copie puis « s'arrête » ; un second démarre avec d'autres données.
    await expect(
      runMigrations({
        migrations: TEST_MIGRATIONS,
        afterStep: (s) => {
          if (s === 'snapshot') throw new Error('onglet 1 fermé')
        },
      }),
    ).rejects.toThrow()
    const firstAt = (await state()).snapshot?.at
    await runMigrations({ migrations: TEST_MIGRATIONS })
    expect((await state()).snapshot?.at).toBe(firstAt)
    await expectFinalV3()
  })

  it('un onglet en retard n’écrase pas une migration validée ailleurs ni ce que la joueuse a modifié depuis', async () => {
    await seedV1()
    const result = await runMigrations({
      migrations: TEST_MIGRATIONS,
      afterStep: (s) => {
        // Pendant que cet onglet calcule, un autre valide la migration et la joueuse y modifie une donnée.
        // (Transaction créée avant celle de l'étape 3 : IndexedDB l'exécute avant.)
        if (s === 'snapshot') void commit({ set: [[SCHEMA_KEY, 3], ['villagers', { mickey: { unlocked: false } }]] })
      },
    })
    expect(result).toEqual({ status: 'up-to-date', schema: 3 })
    const all = await readEntries()
    expect(all.villagers).toEqual({ mickey: { unlocked: false } })
    expect(MIGRATION_KEY in all).toBe(false)
  })

  it('utilise le verrou entre onglets quand le navigateur le propose', async () => {
    let queue = Promise.resolve()
    const names: string[] = []
    const locks = {
      request: (name: string, cb: () => Promise<unknown>) => {
        names.push(name)
        const run = queue.then(cb)
        queue = run.then(
          () => undefined,
          () => undefined,
        )
        return run
      },
    }
    Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
    try {
      await seedV1()
      const results = await Promise.all([runMigrations({ migrations: TEST_MIGRATIONS }), runMigrations({ migrations: TEST_MIGRATIONS })])
      expect(names).toEqual(['dreamlight-compagnons:migration', 'dreamlight-compagnons:migration'])
      // Le second attend le premier puis constate que tout est fait.
      expect(results.map((r) => r.status)).toEqual(['migrated', 'up-to-date'])
      await expectFinalV3()
    } finally {
      Reflect.deleteProperty(navigator, 'locks')
    }
  })

  it('ne touche pas aux données d’une version plus récente de l’app', async () => {
    await seedV1()
    await commit({ set: [[SCHEMA_KEY, 99]] })
    const before = await readEntries()
    expect(await runMigrations()).toEqual({ status: 'newer', schema: 99 })
    expect(Object.keys(await readEntries()).sort()).toEqual(Object.keys(before).sort())
  })
})
