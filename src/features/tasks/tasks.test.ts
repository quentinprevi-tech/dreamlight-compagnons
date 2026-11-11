import { beforeEach, describe, expect, it } from 'vitest'
import { applyRestore, createBackup, parseBackupText, planRestore } from '../../lib/backup'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { TASK_TEMPLATES, TASK_TEMPLATES_BY_ID } from './catalog'
import { applyTaskOp, buildToday, emptyTasks, sanitizeTasks, TaskError, type TaskOp, type TasksData } from './model'
import { loadTasks, updateTasks } from './storage'

const bxl = (iso: string) => new Date(iso)
const ids = (items: { id: string }[]) => items.map((i) => i.id)

/** Applique une suite d'opérations à des heures données. */
function run(steps: [TaskOp, string][], start: TasksData = emptyTasks()): TasksData {
  return steps.reduce((d, [op, at]) => applyTaskOp(d, op, bxl(at)), start)
}

describe('catalogue', () => {
  it('identifiants uniques et figés', () => {
    expect(new Set(ids(TASK_TEMPLATES)).size).toBe(TASK_TEMPLATES.length)
    // Ces identifiants sont enregistrés sur le téléphone : ils ne doivent jamais disparaître.
    expect(ids(TASK_TEMPLATES)).toEqual([
      'feed-critters', 'harvest-roots', 'open-chests', 'give-gifts', 'scrooge-valley', 'scrooge-eternity', 'scrooge-storybook',
      'scrooge-wishblossom', 'daisy-boutique', 'dreamsnaps', 'star-path', 'moana-stall', 'beast-stall', 'hit-rocks', 'gather-wood',
      'pick-flowers', 'gather-fruit', 'gather-vegetables', 'clear-stones', 'ancient-biomes', 'ancient-bubbles', 'minigames',
      'catch-anigamis', 'feed-horses', 'play-bridges',
    ])
  })

  it('aucun doublon entre catégories (anigamis seulement dans DLC)', () => {
    const labels = TASK_TEMPLATES.map((t) => t.label.toLowerCase())
    expect(new Set(labels).size).toBe(labels.length)
    expect(TASK_TEMPLATES.filter((t) => /anigami/i.test(t.label)).map((t) => t.group)).toEqual(['dlc'])
  })

  it('DreamSnap est hebdomadaire ; les heures incertaines sont « à confirmer » et sourcées', () => {
    expect(TASK_TEMPLATES_BY_ID.dreamsnaps.recurrence).toMatchObject({ kind: 'weekly', weekday: 3 })
    for (const t of TASK_TEMPLATES) {
      if (t.gameReset.status === 'to-confirm' || t.gameReset.status === 'wiki' || t.gameReset.status === 'official') {
        expect(t.gameReset.sources.length, t.id).toBeGreaterThan(0)
      }
      if (t.gameReset.status === 'unverified') expect(t.gameReset.summary, t.id).toContain('Aucune source vérifiée')
    }
    for (const id of ['scrooge-valley', 'daisy-boutique', 'dreamsnaps']) expect(TASK_TEMPLATES_BY_ID[id].gameReset.status).toBe('to-confirm')
  })

  it('une boutique de Picsou par extension vérifiée', () => {
    expect(TASK_TEMPLATES.filter((t) => t.id.startsWith('scrooge-')).map((t) => t.collection)).toEqual(['base', 'eternity', 'storybook', 'wishblossom'])
  })

  it('« Nourrir les animaux » est prête pour la phase 3, sans progression animale', () => {
    expect(TASK_TEMPLATES_BY_ID['feed-critters']).toMatchObject({ futureLink: 'critters', recurrence: { kind: 'daily' } })
  })
})

describe('journée', () => {
  it('par défaut : les tâches principales sont actives, les autres non', () => {
    const today = buildToday(emptyTasks(), bxl('2026-11-09T12:00:00'))
    expect(ids(today.todo)).toEqual(ids(TASK_TEMPLATES.filter((t) => t.group === 'main')))
    expect(today.progress).toEqual({ done: 0, total: 11 })
  })

  it('cocher, décocher ; les tâches faites passent dans « Terminées »', () => {
    let d = run([[{ type: 'check', taskId: 'open-chests', done: true }, '2026-11-09T12:00:00']])
    let today = buildToday(d, bxl('2026-11-09T12:05:00'))
    expect(ids(today.done)).toEqual(['open-chests'])
    expect(ids(today.todo)).not.toContain('open-chests')
    expect(today.progress).toEqual({ done: 1, total: 11 })
    d = applyTaskOp(d, { type: 'check', taskId: 'open-chests', done: false }, bxl('2026-11-09T12:10:00'))
    today = buildToday(d, bxl('2026-11-09T12:10:00'))
    expect(ids(today.todo)).toContain('open-chests')
    expect(today.done).toEqual([])
  })

  it('chaque tâche revient selon SA remise à zéro', () => {
    const d = run([
      [{ type: 'check', taskId: 'open-chests', done: true }, '2026-11-09T23:00:00'], // minuit local
      [{ type: 'check', taskId: 'give-gifts', done: true }, '2026-11-09T23:00:00'], // 5 h local
      [{ type: 'check', taskId: 'scrooge-valley', done: true }, '2026-11-09T23:00:00'], // 9 h UTC = 10 h
      [{ type: 'check', taskId: 'dreamsnaps', done: true }, '2026-11-09T23:00:00'], // mercredi 15 h
    ])
    const doneAt = (at: string) => ids(buildToday(d, bxl(at)).done)
    expect(doneAt('2026-11-10T00:30:00')).toEqual(['give-gifts', 'scrooge-valley', 'dreamsnaps'])
    expect(doneAt('2026-11-10T05:30:00')).toEqual(['scrooge-valley', 'dreamsnaps'])
    expect(doneAt('2026-11-10T10:30:00')).toEqual(['dreamsnaps'])
    expect(doneAt('2026-11-11T14:59:00')).toEqual(['dreamsnaps'])
    expect(doneAt('2026-11-11T15:00:00')).toEqual([])
  })

  it('tâche ponctuelle : reste jusqu’à réalisation, visible le jour même, puis disparaît', () => {
    let d = run([[{ type: 'add-custom', id: 'perso-abcd', label: 'Finir la quête de Merlin', recurrence: { kind: 'once' } }, '2026-11-01T10:00:00']])
    expect(ids(buildToday(d, bxl('2026-11-09T12:00:00')).todo)).toContain('perso-abcd') // plusieurs jours après
    d = applyTaskOp(d, { type: 'check', taskId: 'perso-abcd', done: true }, bxl('2026-11-09T12:00:00'))
    expect(ids(buildToday(d, bxl('2026-11-09T23:59:00')).done)).toContain('perso-abcd')
    expect(ids(buildToday(d, bxl('2026-11-10T00:01:00')).done)).not.toContain('perso-abcd')
    expect(ids(buildToday(d, bxl('2026-11-10T00:01:00')).todo)).not.toContain('perso-abcd')
    expect(() => applyTaskOp(d, { type: 'postpone', taskId: 'perso-abcd' }, bxl('2026-11-09T12:00:00'))).toThrow(TaskError)
    expect(() => applyTaskOp(d, { type: 'remove', taskId: 'perso-abcd' }, bxl('2026-11-09T12:00:00'))).toThrow(TaskError)
  })

  it('reporter : quitte la journée, reste dans « Reportées » sans doublon jusqu’à réalisation', () => {
    let d = run([
      [{ type: 'enable', templateId: 'feed-horses', enabled: true }, '2026-11-09T08:00:00'],
      [{ type: 'postpone', taskId: 'feed-horses' }, '2026-11-09T20:00:00'],
      [{ type: 'postpone', taskId: 'feed-horses' }, '2026-11-09T20:01:00'], // deuxième clic : pas de doublon
    ])
    let today = buildToday(d, bxl('2026-11-09T20:05:00'))
    expect(ids(today.todo)).not.toContain('feed-horses')
    expect(today.postponed.map((p) => p.taskId)).toEqual(['feed-horses'])
    expect(today.removed).toEqual([]) // pas affichée deux fois
    // Le lendemain : la tâche quotidienne revient ET la reportée reste (une seule)
    d = applyTaskOp(d, { type: 'postpone', taskId: 'feed-horses' }, bxl('2026-11-10T21:00:00'))
    today = buildToday(d, bxl('2026-11-10T21:05:00'))
    expect(today.postponed).toHaveLength(1)
    expect(today.postponed[0].from).toBe('2026-11-09')
    // Faite : visible jusqu'à la fin du jour, puis disparaît
    d = applyTaskOp(d, { type: 'check-postponed', taskId: 'feed-horses', done: true }, bxl('2026-11-10T21:10:00'))
    expect(buildToday(d, bxl('2026-11-10T23:00:00')).postponed[0].doneAt).toBeDefined()
    expect(buildToday(d, bxl('2026-11-11T08:00:00')).postponed).toEqual([])
    // Une nouvelle reportée est possible après réalisation
    d = applyTaskOp(d, { type: 'postpone', taskId: 'feed-horses' }, bxl('2026-11-11T21:00:00'))
    expect(buildToday(d, bxl('2026-11-11T21:01:00')).postponed).toHaveLength(1)
    d = applyTaskOp(d, { type: 'delete-postponed', taskId: 'feed-horses' }, bxl('2026-11-11T21:02:00'))
    expect(buildToday(d, bxl('2026-11-11T21:03:00')).postponed).toEqual([])
  })

  it('retirer d’aujourd’hui ne désactive pas le modèle ; rétablir ; retour à la période suivante', () => {
    let d = run([[{ type: 'remove', taskId: 'star-path' }, '2026-11-09T09:00:00']])
    let today = buildToday(d, bxl('2026-11-09T09:01:00'))
    expect(ids(today.removed)).toEqual(['star-path'])
    expect(ids(today.todo)).not.toContain('star-path')
    expect(ids(buildToday(d, bxl('2026-11-10T00:01:00')).todo)).toContain('star-path')
    d = applyTaskOp(d, { type: 'restore', taskId: 'star-path' }, bxl('2026-11-09T09:02:00'))
    today = buildToday(d, bxl('2026-11-09T09:03:00'))
    expect(ids(today.todo)).toContain('star-path')
    expect(today.removed).toEqual([])
  })

  it('activer et désactiver un modèle', () => {
    let d = run([[{ type: 'enable', templateId: 'hit-rocks', enabled: true }, '2026-11-09T09:00:00']])
    expect(ids(buildToday(d, bxl('2026-11-09T09:00:00')).todo)).toContain('hit-rocks')
    d = applyTaskOp(d, { type: 'enable', templateId: 'open-chests', enabled: false }, bxl('2026-11-09T09:00:00'))
    expect(ids(buildToday(d, bxl('2026-11-09T09:00:00')).todo)).not.toContain('open-chests')
    expect(() => applyTaskOp(d, { type: 'enable', templateId: 'constructor', enabled: true }, bxl('2026-11-09T09:00:00'))).toThrow()
  })

  it('tâches personnalisées récurrentes : modifier, supprimer (avec leur suivi)', () => {
    let d = run([
      [{ type: 'add-custom', id: 'perso-weekly1', label: '  Vider la   boîte aux lettres ', recurrence: { kind: 'weekly', weekday: 1, at: { zone: 'local', hour: 0, minute: 0 } } }, '2026-11-09T09:00:00'],
      [{ type: 'check', taskId: 'perso-weekly1', done: true }, '2026-11-09T10:00:00'],
    ])
    expect(d.custom[0].label).toBe('Vider la boîte aux lettres')
    expect(ids(buildToday(d, bxl('2026-11-15T23:00:00')).done)).toContain('perso-weekly1') // dimanche : encore faite
    expect(ids(buildToday(d, bxl('2026-11-16T00:01:00')).todo)).toContain('perso-weekly1') // lundi : revient
    d = applyTaskOp(d, { type: 'edit-custom', id: 'perso-weekly1', label: 'Courrier', recurrence: { kind: 'daily', at: { zone: 'local', hour: 0, minute: 0 } } }, bxl('2026-11-09T11:00:00'))
    expect(d.custom[0]).toMatchObject({ label: 'Courrier', recurrence: { kind: 'daily' } })
    d = applyTaskOp(d, { type: 'postpone', taskId: 'perso-weekly1' }, bxl('2026-11-10T11:00:00'))
    d = applyTaskOp(d, { type: 'delete-custom', id: 'perso-weekly1' }, bxl('2026-11-10T12:00:00'))
    expect(d.custom).toEqual([])
    expect(Object.keys(d.done).filter((k) => k.startsWith('perso-'))).toEqual([])
    expect(d.postponed).toEqual([])
    expect(() => applyTaskOp(d, { type: 'add-custom', id: 'perso-x2y3', label: '   ', recurrence: { kind: 'once' } }, bxl('2026-11-10T12:00:00'))).toThrow('caractères')
  })

  it('historique des 7 derniers jours, nettoyage au-delà de 14 jours', () => {
    let d = emptyTasks()
    for (const day of ['2026-10-20', '2026-11-03', '2026-11-05', '2026-11-08', '2026-11-09']) {
      d = applyTaskOp(d, { type: 'check', taskId: 'open-chests', done: true }, bxl(`${day}T20:00:00`))
    }
    d = applyTaskOp(d, { type: 'check', taskId: 'give-gifts', done: true }, bxl('2026-11-09T20:00:00'))
    const today = buildToday(d, bxl('2026-11-09T21:00:00'))
    expect(today.history.map((h) => h.day)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'])
    expect(today.history.map((h) => h.count)).toEqual([1, 0, 1, 0, 0, 1, 2])
    expect(Object.keys(d.done)).not.toContain('open-chests@2026-10-20') // plus de 14 jours
  })

  it('nettoyage des données lues : identifiants et valeurs inconnus écartés', () => {
    const raw = JSON.parse(
      '{"enabled":{"hit-rocks":true,"constructor":true,"open-chests":"oui"},' +
        '"custom":[{"id":"perso-ok12","label":"OK","recurrence":{"kind":"once"},"createdAt":"2026-11-01T10:00:00.000Z"},' +
        '{"id":"pas-perso","label":"X","recurrence":{"kind":"once"},"createdAt":"2026-11-01T10:00:00.000Z"},' +
        '{"id":"perso-bad1","label":"X","recurrence":{"kind":"monthly"},"createdAt":"2026-11-01T10:00:00.000Z"}],' +
        '"done":{"open-chests@2026-11-09":"2026-11-09T10:00:00.000Z","inconnu@2026-11-09":"2026-11-09T10:00:00.000Z","perso-ok12@once":"pas une date"},' +
        '"postponed":[{"taskId":"open-chests","label":"Coffres","from":"2026-11-08","at":"2026-11-08T10:00:00.000Z"},{"taskId":"open-chests","label":"Doublon","from":"2026-11-09","at":"2026-11-09T10:00:00.000Z"}]}',
    )
    const clean = sanitizeTasks(raw)
    expect(clean.enabled).toEqual({ 'hit-rocks': true })
    expect(clean.custom.map((c) => c.id)).toEqual(['perso-ok12'])
    expect(Object.keys(clean.done)).toEqual(['open-chests@2026-11-09'])
    expect(clean.postponed.map((p) => p.label)).toEqual(['Coffres'])
  })
})

describe('stockage atomique et sauvegardes', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('deux onglets cochent deux tâches en même temps : les deux sont conservées', async () => {
    const at = bxl('2026-11-09T12:00:00')
    await Promise.all([
      updateTasks({ type: 'check', taskId: 'open-chests', done: true }, at),
      updateTasks({ type: 'check', taskId: 'give-gifts', done: true }, at),
      updateTasks({ type: 'enable', templateId: 'hit-rocks', enabled: true }, at),
      updateTasks({ type: 'postpone', taskId: 'star-path' }, at),
    ])
    resetStoreForTests() // redémarrage
    const d = await loadTasks()
    expect(Object.keys(d.done).sort()).toEqual(['give-gifts@2026-11-09', 'open-chests@2026-11-09'])
    expect(d.enabled).toEqual({ 'hit-rocks': true })
    expect(d.postponed.map((p) => p.taskId)).toEqual(['star-path'])
  })

  it('garde les champs écrits par une version plus récente', async () => {
    await commit({ set: [['tasks', { ...emptyTasks(), futur: { x: 1 } }]] })
    await updateTasks({ type: 'check', taskId: 'open-chests', done: true }, bxl('2026-11-09T12:00:00'))
    expect((await readEntries()).tasks).toMatchObject({ futur: { x: 1 }, done: { 'open-chests@2026-11-09': expect.any(String) } })
  })

  it('export et import des tâches ; une sauvegarde plus ancienne conserve les tâches du téléphone', async () => {
    const at = bxl('2026-11-09T12:00:00')
    await updateTasks({ type: 'add-custom', id: 'perso-abcd', label: 'Ma tâche', recurrence: { kind: 'once' } }, at)
    await updateTasks({ type: 'check', taskId: 'open-chests', done: true }, at)
    const file = await createBackup({ includePhotos: false })
    expect((file.sections.tasks as { data: TasksData }).data.custom.map((c) => c.label)).toEqual(['Ma tâche'])

    // Autre téléphone : tout revient
    resetStoreForTests(`test-${Math.random()}`)
    await applyRestore(parseBackupText(JSON.stringify(file)))
    expect((await loadTasks()).custom.map((c) => c.id)).toEqual(['perso-abcd'])

    // Sauvegarde de la phase 1 (sans tâches) : les tâches du téléphone sont conservées
    const phase1 = { ...file, sections: { ...file.sections } } as Record<string, unknown> & { sections: Record<string, unknown> }
    delete phase1.sections.tasks
    const parsed = parseBackupText(JSON.stringify(phase1))
    expect((await planRestore(parsed)).find((p) => p.id === 'tasks')).toMatchObject({ action: 'keep' })
    await applyRestore(parsed)
    expect((await loadTasks()).custom.map((c) => c.id)).toEqual(['perso-abcd'])
  })

  it('refuse une section de tâches abîmée', () => {
    const file = { app: 'dreamlight-compagnons', format: 2, type: 'partial', schema: 3, sections: { tasks: { v: 1, data: ['abîmé'] } } }
    expect(() => parseBackupText(JSON.stringify(file))).toThrow('abîmée')
  })
})
