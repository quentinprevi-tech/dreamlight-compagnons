import { beforeEach, describe, expect, it } from 'vitest'
import { applyRestore, createBackup, parseBackupText, planRestore } from '../../lib/backup'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { loadNames, updateCustomName } from '../../lib/names'
import { ANIGAMI_BY_ID, ANIGAMI_TYPES, FAMILY_LABEL, TALES, TALE_BY_ID, isAnigamiId, isTaleId } from './data'
import { anigamiName, taleName } from './display'
import {
  LOG_LIMIT,
  MAX_COUNT,
  TaleError,
  applyTaleOp,
  emptyTales,
  lastUndoable,
  newOpId,
  puzzleView,
  sanitizeTales,
  summarizeTales,
  type TaleOp,
  type TalesData,
} from './model'
import { loadTales, updateTales } from './storage'

const NOW = new Date('2026-11-09T12:00:00')
const op = (taleId: string) => ({ type: 'validate', taleId, opId: newOpId() }) as const
const withCounts = (counts: Record<string, number>): TalesData => ({ ...emptyTales(), counts })
const run = (data: TalesData, ...ops: TaleOp[]) => ops.reduce((d, o) => applyTaleOp(d, o, NOW), data)
const total = (cost: Record<string, number>) => Object.values(cost).reduce((a, b) => a + b, 0)

describe('données : 39 puzzles et 21 types d’anigamis vérifiés sur le wiki', () => {
  it('identifiants uniques et coûts qui référencent des types existants', () => {
    expect(TALES).toHaveLength(39)
    expect(ANIGAMI_TYPES).toHaveLength(21)
    expect(new Set(TALES.map((t) => t.id)).size).toBe(39)
    expect(new Set(ANIGAMI_TYPES.map((a) => a.id)).size).toBe(21)
    for (const t of TALES) {
      expect(t.stars >= 1 && t.stars <= 5, t.id).toBe(true)
      expect(Object.keys(t.cost).length, t.id).toBeGreaterThan(0)
      for (const [type, qty] of Object.entries(t.cost)) {
        expect(isAnigamiId(type), `${t.id} → ${type}`).toBe(true)
        expect(Number.isInteger(qty) && qty > 0, `${t.id} ${type}`).toBe(true)
      }
      expect(t.reward, t.id).not.toBe('')
    }
  })

  it('types : 7 oiseaux, 7 démons, 7 grenouilles ; 16 capturables et 5 objets de quête', () => {
    for (const family of Object.keys(FAMILY_LABEL)) expect(ANIGAMI_TYPES.filter((a) => a.family === family)).toHaveLength(7)
    expect(ANIGAMI_TYPES.filter((a) => a.origin === 'catch')).toHaveLength(16)
    expect(ANIGAMI_TYPES.filter((a) => a.origin === 'quest').map((a) => a.id)).toEqual(['rainbow-bird', 'neverafter-demon', 'rainbow-demon', 'neverafter-frog', 'rainbow-frog'])
    for (const a of ANIGAMI_TYPES) expect(a.locations.length, a.id).toBeGreaterThan(0)
  })

  it('les objets de quête ne servent qu’aux deux puzzles « de quête » ; l’oiseau blanc à aucun', () => {
    const usedBy = (id: string) => TALES.filter((t) => Object.hasOwn(t.cost, id)).map((t) => t.id)
    expect(usedBy('neverafter-frog')).toEqual(['the-spark-of-spite'])
    expect(usedBy('neverafter-demon')).toEqual(['the-spark-of-spite'])
    for (const id of ['rainbow-bird', 'rainbow-frog', 'rainbow-demon']) expect(usedBy(id)).toEqual(['the-story-of-dreamlight-valley'])
    expect(usedBy('white-bird')).toEqual([])
    for (const a of ANIGAMI_TYPES.filter((a) => a.id !== 'white-bird')) expect(usedBy(a.id).length, a.id).toBeGreaterThan(0)
  })

  it('les 6 premiers puzzles sont débloqués par une quête', () => {
    expect(TALES.filter((t) => t.unlockQuest).map((t) => t.id)).toEqual(TALES.slice(0, 6).map((t) => t.id))
    expect(TALE_BY_ID['once-upon-a-time-in-the-storybook-vale'].unlockQuest).toBe('Welcome to the Storybook Vale')
  })

  it('vérification des coûts : 25 confirmés par deux sources, 2 contradictoires, 12 d’une seule source', () => {
    const count = (s: string) => TALES.filter((t) => t.costStatus === s).length
    expect([count('verified'), count('conflict'), count('single-source')]).toEqual([25, 2, 12])
    expect(TALES.filter((t) => t.costStatus === 'conflict').map((t) => t.id)).toEqual(['moana', 'sleeping-beauty'])
    for (const t of TALES) expect(Boolean(t.otherReading), t.id).toBe(t.costStatus === 'conflict')
    // Les 12 puzzles d'une seule source sont les plus récents du wiki
    expect(TALES.filter((t) => t.costStatus === 'single-source').map((t) => t.id)).toEqual([
      'maleficents-journey', 'the-story-of-dreamlight-valley', 'winnie-the-pooh', 'snow-white', 'peter-pan', 'lady-and-the-tramp',
      'robin-hood', 'alice-in-wonderland', 'one-hundred-and-one-dalmatians', 'coco', 'the-incredibles', 'inside-out',
    ])
  })

  it('coûts relevés : exemples du wiki', () => {
    expect(TALE_BY_ID.aladdin.cost).toEqual({ 'blue-bird': 25 })
    expect(TALE_BY_ID['the-sorcerers-apprentice'].cost).toEqual({ 'green-bird': 5, 'yellow-bird': 5, 'yellow-frog': 70 })
    expect(TALE_BY_ID['inside-out'].cost).toEqual({ 'shadowy-bird': 20, 'shadowy-frog': 20, 'shadowy-demon': 20 })
    expect(TALE_BY_ID['the-spark-of-spite'].cost).toEqual({ 'neverafter-frog': 4, 'neverafter-demon': 3 })
    expect(total(TALE_BY_ID.frozen.cost)).toBe(80)
    // Moana : lecture du wiki conservée, autre lecture notée
    expect(TALE_BY_ID.moana.cost).toEqual({ 'blue-bird': 10, 'green-frog': 15 })
    expect(TALE_BY_ID.moana.otherReading).toContain('Green Bird Snippet (15)')
  })

  it('noms : le français vient d’un guide pour 13 types, jamais déduit pour les autres ni pour les puzzles', () => {
    const withFr = ANIGAMI_TYPES.filter((a) => a.nameFr)
    expect(withFr).toHaveLength(13)
    for (const a of withFr) expect(a.nameFr!.startsWith('Anigami '), a.id).toBe(true)
    expect(new Set(withFr.map((a) => a.nameFr)).size).toBe(13)
    expect(ANIGAMI_TYPES.filter((a) => !a.nameFr).map((a) => a.id).sort()).toEqual(
      ['neverafter-demon', 'neverafter-frog', 'rainbow-bird', 'rainbow-demon', 'rainbow-frog', 'shadowy-bird', 'shadowy-demon', 'shadowy-frog'],
    )
    expect(ANIGAMI_BY_ID['blue-bird'].nameFr).toBe('Anigami oiseau bleu')
    expect(ANIGAMI_BY_ID['green-frog'].nameFr).toBe('Anigami grenouille vert') // relevé tel quel dans le guide, sans correction
    expect('nameFr' in TALES[0]).toBe(false)
  })

  it('validation des identifiants (propriétés héritées de JavaScript refusées)', () => {
    expect(isTaleId('aladdin')).toBe(true)
    expect(isTaleId('constructor')).toBe(false)
    expect(isAnigamiId('blue-bird')).toBe(true)
    expect(isAnigamiId('__proto__')).toBe(false)
  })
})

describe('compteurs indépendants par type, jamais négatifs', () => {
  it('chaque type a son propre compteur', () => {
    const d = run(emptyTales(), { type: 'adjust', id: 'blue-bird', delta: 5 }, { type: 'adjust', id: 'green-frog', delta: 2 }, { type: 'adjust', id: 'blue-bird', delta: 1 })
    expect(d.counts).toEqual({ 'blue-bird': 6, 'green-frog': 2 })
    expect(run(d, { type: 'adjust', id: 'blue-bird', delta: -6 }).counts).toEqual({ 'green-frog': 2 }) // zéro : retiré, autres intacts
  })

  it('refuse un compteur négatif, sans rien modifier', () => {
    const d = withCounts({ 'blue-bird': 3 })
    expect(() => applyTaleOp(d, { type: 'adjust', id: 'blue-bird', delta: -4 }, NOW)).toThrow('négatif')
    expect(() => applyTaleOp(emptyTales(), { type: 'adjust', id: 'blue-bird', delta: -1 }, NOW)).toThrow(TaleError)
    expect(() => applyTaleOp(d, { type: 'set-count', id: 'blue-bird', count: -1 }, NOW)).toThrow('négatif')
    expect(() => applyTaleOp(d, { type: 'set-count', id: 'blue-bird', count: 2.5 }, NOW)).toThrow(TaleError)
    expect(() => applyTaleOp(d, { type: 'set-count', id: 'blue-bird', count: MAX_COUNT + 1 }, NOW)).toThrow('maximum')
    expect(() => applyTaleOp(d, { type: 'adjust', id: 'inconnu', delta: 1 }, NOW)).toThrow('inconnu')
    expect(d.counts).toEqual({ 'blue-bird': 3 })
  })

  it('saisie directe d’un total', () => {
    expect(run(emptyTales(), { type: 'set-count', id: 'red-demon', count: 35 }).counts).toEqual({ 'red-demon': 35 })
    expect(run(withCounts({ 'red-demon': 35 }), { type: 'set-count', id: 'red-demon', count: 0 }).counts).toEqual({})
  })
})

describe('état des puzzles et progression globale', () => {
  it('réalisable, il manque, terminé, coûts à confirmer', () => {
    const aladdin = TALE_BY_ID.aladdin
    expect(puzzleView(withCounts({ 'blue-bird': 25 }), aladdin)).toMatchObject({ status: 'ready', missingTotal: 0, missing: {} })
    expect(puzzleView(withCounts({ 'blue-bird': 24 }), aladdin)).toMatchObject({ status: 'missing', missing: { 'blue-bird': 1 }, missingTotal: 1 })
    expect(puzzleView(emptyTales(), TALE_BY_ID['beauty-and-the-beast'])).toMatchObject({ status: 'missing', missing: { 'red-bird': 5, 'blue-bird': 20 }, missingTotal: 25 })
    expect(puzzleView(run(withCounts({ 'blue-bird': 25 }), op('aladdin')), aladdin).status).toBe('done')
    // Coûts contradictoires : ni réalisable ni manquant, même avec tout ce qu'il faut
    expect(puzzleView(withCounts({ 'blue-bird': 99, 'green-frog': 99, 'green-bird': 99 }), TALE_BY_ID.moana).status).toBe('to-confirm')
  })

  it('compteurs, nécessaires et manquants par type (hors puzzles à confirmer)', () => {
    const empty = summarizeTales(emptyTales())
    // Les totaux ne comptent que les anigamis CAPTURABLES : les 5 objets de quête n'y figurent pas
    const catchOnly = (cost: Record<string, number>) => Object.entries(cost).filter(([id]) => ANIGAMI_BY_ID[id].origin === 'catch').reduce((n, [, q]) => n + q, 0)
    const expectedNeeded = TALES.filter((t) => t.costStatus !== 'conflict').reduce((n, t) => n + catchOnly(t.cost), 0)
    expect(empty).toMatchObject({ total: 39, done: 0, ready: 0, missing: 37, toConfirm: 2, ownedTotal: 0, neededTotal: expectedNeeded, missingTotal: expectedNeeded })

    // 30 oiseaux bleus : Aladdin (25) réalisable, un puzzle terminé ne compte plus dans « nécessaires »
    let d = withCounts({ 'blue-bird': 30 })
    let s = summarizeTales(d)
    expect(s.ready).toBeGreaterThanOrEqual(1)
    const needBlue = TALES.filter((t) => t.costStatus !== 'conflict').reduce((n, t) => n + (t.cost['blue-bird'] ?? 0), 0)
    expect(s.perType['blue-bird']).toEqual({ owned: 30, needed: needBlue, missing: needBlue - 30 })
    expect(s.perType['green-frog'].owned).toBe(0)
    d = run(d, op('aladdin'))
    s = summarizeTales(d)
    expect(s.done).toBe(1)
    expect(s.perType['blue-bird']).toEqual({ owned: 5, needed: needBlue - 25, missing: needBlue - 25 - 5 })
    expect(s.ownedTotal).toBe(5)
  })
})

describe('validation d’un puzzle', () => {
  it('quantités insuffisantes : refusée, rien n’est déduit ni écrit, aucun compteur négatif', () => {
    const d = withCounts({ 'blue-bird': 24 })
    expect(() => applyTaleOp(d, op('aladdin'), NOW)).toThrow('insuffisants')
    expect(d).toEqual(withCounts({ 'blue-bird': 24 }))
    // Un seul type qui manque suffit à refuser
    expect(() => applyTaleOp(withCounts({ 'red-bird': 5, 'blue-bird': 19 }), op('beauty-and-the-beast'), NOW)).toThrow('insuffisants')
  })

  it('déduit exactement le coût de chaque type et enregistre l’opération', () => {
    const d = run(withCounts({ 'red-bird': 10, 'blue-bird': 30, 'green-frog': 4 }), op('beauty-and-the-beast'))
    expect(d.counts).toEqual({ 'red-bird': 5, 'blue-bird': 10, 'green-frog': 4 }) // les autres types ne bougent pas
    expect(d.log).toHaveLength(1)
    expect(d.log[0]).toMatchObject({ taleId: 'beauty-and-the-beast', deltas: { 'red-bird': 5, 'blue-bird': 20 } })
    expect(d.puzzles['beauty-and-the-beast']).toMatchObject({ opId: d.log[0].id })
    expect(lastUndoable(d)?.id).toBe(d.log[0].id)
  })

  it('un compteur qui tombe à zéro est retiré, jamais négatif', () => {
    expect(run(withCounts({ 'blue-bird': 25 }), op('aladdin')).counts).toEqual({})
  })

  it('un puzzle déjà terminé ne peut pas être validé deux fois', () => {
    const d = run(withCounts({ 'blue-bird': 100 }), op('aladdin'))
    expect(() => applyTaleOp(d, op('aladdin'), NOW)).toThrow('déjà terminé')
    expect(d.counts).toEqual({ 'blue-bird': 75 })
  })

  it('puzzle aux coûts contradictoires : aucune déduction automatique, même avec assez d’anigamis', () => {
    expect(() => applyTaleOp(withCounts({ 'blue-bird': 99, 'green-frog': 99 }), op('moana'), NOW)).toThrow('à confirmer')
    expect(() => applyTaleOp(withCounts({ 'blue-bird': 99, 'green-bird': 99, 'blue-demon': 99 }), op('sleeping-beauty'), NOW)).toThrow('à confirmer')
  })

  it('refuse un puzzle ou une opération invalides', () => {
    expect(() => applyTaleOp(emptyTales(), { type: 'validate', taleId: 'inconnu', opId: newOpId() }, NOW)).toThrow('inconnu')
    expect(() => applyTaleOp(withCounts({ 'blue-bird': 25 }), { type: 'validate', taleId: 'aladdin', opId: 'pas valide' }, NOW)).toThrow(TaleError)
  })
})

describe('marquer terminé sans déduire', () => {
  it('ne touche à aucun compteur et ne crée aucune opération annulable', () => {
    const d = run(withCounts({ 'blue-bird': 3 }), { type: 'mark-done', taleId: 'aladdin' })
    expect(d.counts).toEqual({ 'blue-bird': 3 })
    expect(d.log).toEqual([])
    expect(d.puzzles.aladdin).toEqual({ doneAt: NOW.toISOString() })
    expect(lastUndoable(d)).toBeUndefined()
    expect(() => applyTaleOp(d, { type: 'mark-done', taleId: 'aladdin' }, NOW)).toThrow('déjà terminé')
  })

  it('possible même pour un puzzle aux coûts à confirmer', () => {
    expect(run(emptyTales(), { type: 'mark-done', taleId: 'moana' }).puzzles.moana).toBeDefined()
  })

  it('remettre en cours un puzzle marqué à la main n’affecte rien d’autre', () => {
    const d = run(withCounts({ 'blue-bird': 3 }), { type: 'mark-done', taleId: 'aladdin' }, { type: 'reopen', taleId: 'aladdin' })
    expect(d).toEqual(withCounts({ 'blue-bird': 3 }))
    expect(() => applyTaleOp(d, { type: 'reopen', taleId: 'aladdin' }, NOW)).toThrow('pas terminé')
  })
})

describe('annulation exacte de la dernière validation', () => {
  it('rend ce qui avait été déduit aux compteurs ACTUELS : les modifications manuelles faites entre-temps sont conservées', () => {
    let d = run(withCounts({ 'red-bird': 10, 'blue-bird': 30 }), op('beauty-and-the-beast')) // 5 rouges, 10 bleus
    d = run(d, { type: 'adjust', id: 'blue-bird', delta: 7 }, { type: 'set-count', id: 'red-bird', count: 1 }, { type: 'adjust', id: 'green-frog', delta: 4 })
    expect(d.counts).toEqual({ 'red-bird': 1, 'blue-bird': 17, 'green-frog': 4 })
    d = run(d, { type: 'undo-last' })
    // 17 + 20 = 37 et 1 + 5 = 6 : PAS les anciennes valeurs 30 et 10
    expect(d.counts).toEqual({ 'red-bird': 6, 'blue-bird': 37, 'green-frog': 4 })
    expect(d.puzzles).toEqual({})
    expect(d.log).toEqual([])
  })

  it('annuler après avoir dépensé le reste à la main : le compteur ne devient jamais négatif', () => {
    let d = run(withCounts({ 'blue-bird': 25 }), op('aladdin')) // 0 en stock
    d = run(d, { type: 'adjust', id: 'blue-bird', delta: 2 }, { type: 'adjust', id: 'blue-bird', delta: -2 })
    d = run(d, { type: 'undo-last' })
    expect(d.counts).toEqual({ 'blue-bird': 25 })
    expect(Object.values(d.counts).every((n) => n >= 0)).toBe(true)
  })

  it('annule les validations dans l’ordre inverse, une à la fois', () => {
    let d = withCounts({ 'blue-bird': 60, 'red-bird': 10 })
    d = run(d, op('aladdin'), op('cinderella')) // 25 puis 15 bleus + 10 rouges
    expect(d.counts).toEqual({ 'blue-bird': 20 })
    expect(d.log.map((v) => v.taleId)).toEqual(['aladdin', 'cinderella'])
    d = run(d, { type: 'undo-last' })
    expect(d.counts).toEqual({ 'blue-bird': 35, 'red-bird': 10 })
    expect(d.puzzles.aladdin).toBeDefined()
    expect(d.puzzles.cinderella).toBeUndefined()
    d = run(d, { type: 'undo-last' })
    expect(d.counts).toEqual({ 'blue-bird': 60, 'red-bird': 10 })
    expect(() => applyTaleOp(d, { type: 'undo-last' }, NOW)).toThrow('Aucune validation')
  })

  it('remettre le puzzle en cours à la main retire sa validation du journal : plus d’annulation (pas de double remboursement)', () => {
    let d = run(withCounts({ 'blue-bird': 25 }), op('aladdin'))
    d = run(d, { type: 'reopen', taleId: 'aladdin' })
    expect(d.counts).toEqual({}) // jamais rendu automatiquement
    expect(d.log).toEqual([])
    expect(lastUndoable(d)).toBeUndefined()
    expect(() => applyTaleOp(d, { type: 'undo-last' }, NOW)).toThrow('Aucune validation')
  })

  it('journal de 20 validations : la plus ancienne n’est plus annulable mais son puzzle reste terminé', () => {
    const cheap = TALES.filter((t) => t.costStatus !== 'conflict').slice(0, LOG_LIMIT + 2)
    const everything = Object.fromEntries(ANIGAMI_TYPES.map((a) => [a.id, 500]))
    const d = cheap.reduce((acc, t) => applyTaleOp(acc, op(t.id), NOW), withCounts(everything))
    expect(d.log).toHaveLength(LOG_LIMIT)
    expect(d.log[0].taleId).toBe(cheap[2].id) // les deux plus anciennes sont sorties du journal
    expect(d.puzzles[cheap[0].id]).toBeDefined()
    expect(summarizeTales(d).done).toBe(LOG_LIMIT + 2)
  })
})

describe('nettoyage des données lues', () => {
  it('écarte les identifiants, quantités et opérations invalides', () => {
    const id = 'op-abcdef123'
    const raw = JSON.parse(
      JSON.stringify({
        counts: { 'blue-bird': 5, 'green-frog': 0, inconnu: 3, constructor: 2, 'red-bird': -1, 'red-demon': 2.5 },
        puzzles: { aladdin: { doneAt: '2026-11-09T10:00:00.000Z', opId: id }, moana: { doneAt: 'hier' }, inconnu: { doneAt: '2026-11-09T10:00:00.000Z' }, cinderella: { doneAt: '2026-11-09T11:00:00.000Z', opId: 'pas valide' } },
        log: [
          { id, at: '2026-11-09T10:00:00.000Z', taleId: 'aladdin', deltas: { 'blue-bird': 25, inconnu: 3, 'red-bird': 0 } },
          { id: 'op-orphelin12', at: '2026-11-09T10:00:00.000Z', taleId: 'hercules', deltas: { 'green-frog': 20 } }, // puzzle non terminé par cette validation
          { id, at: '2026-11-09T10:00:00.000Z', taleId: 'aladdin', deltas: { 'blue-bird': 25 } }, // doublon
        ],
        futur: { x: 1 },
      }),
    )
    expect(sanitizeTales(raw)).toEqual({
      counts: { 'blue-bird': 5 },
      puzzles: { aladdin: { doneAt: '2026-11-09T10:00:00.000Z', opId: id }, cinderella: { doneAt: '2026-11-09T11:00:00.000Z' } },
      log: [{ id, at: '2026-11-09T10:00:00.000Z', taleId: 'aladdin', deltas: { 'blue-bird': 25 } }],
    })
    expect(sanitizeTales(['x'])).toEqual(emptyTales())
    expect(sanitizeTales(null)).toEqual(emptyTales())
  })
})

describe('stockage atomique, concurrence et sauvegardes', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('enregistre, relit après redémarrage et conserve le journal', async () => {
    await updateTales({ type: 'set-count', id: 'blue-bird', count: 30 }, NOW)
    await updateTales(op('aladdin'), NOW)
    await updateTales({ type: 'adjust', id: 'blue-bird', delta: 3 }, NOW)
    resetStoreForTests() // redémarrage
    const d = await loadTales()
    expect(d.counts).toEqual({ 'blue-bird': 8 })
    expect(d.puzzles.aladdin?.opId).toBeDefined()
    expect(lastUndoable(d)?.taleId).toBe('aladdin')
    // Annulation après redémarrage : 8 + 25 = 33
    expect((await updateTales({ type: 'undo-last' }, NOW)).counts).toEqual({ 'blue-bird': 33 })
  })

  it('deux onglets ajoutent des anigamis en même temps : tous les ajouts sont conservés', async () => {
    await Promise.all(Array.from({ length: 10 }, () => updateTales({ type: 'adjust', id: 'pink-demon', delta: 1 }, NOW)))
    await Promise.all([updateTales({ type: 'adjust', id: 'red-demon', delta: 4 }, NOW), updateTales({ type: 'adjust', id: 'green-demon', delta: 6 }, NOW)])
    expect((await loadTales()).counts).toEqual({ 'pink-demon': 10, 'red-demon': 4, 'green-demon': 6 })
  })

  it('deux retraits simultanés depuis 1 : un seul réussit, le compteur ne devient jamais négatif', async () => {
    await updateTales({ type: 'set-count', id: 'blue-bird', count: 1 }, NOW)
    const results = await Promise.allSettled([updateTales({ type: 'adjust', id: 'blue-bird', delta: -1 }, NOW), updateTales({ type: 'adjust', id: 'blue-bird', delta: -1 }, NOW)])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect((await loadTales()).counts).toEqual({})
  })

  it('deux validations concurrentes qui se partagent les mêmes anigamis : une seule passe', async () => {
    // 30 oiseaux bleus : Aladdin (25) OU Cendrillon (15 + 10 rouges), pas les deux
    await updateTales({ type: 'set-count', id: 'blue-bird', count: 30 }, NOW)
    await updateTales({ type: 'set-count', id: 'red-bird', count: 10 }, NOW)
    const results = await Promise.allSettled([updateTales(op('aladdin'), NOW), updateTales(op('cinderella'), NOW)])
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    const failure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason).toBeInstanceOf(TaleError)
    const d = await loadTales()
    expect(Object.keys(d.puzzles)).toHaveLength(1)
    expect(d.log).toHaveLength(1)
    expect(Object.values(d.counts).every((n) => n >= 0)).toBe(true)
    expect(Object.values(d.counts).reduce((a, b) => a + b, 0)).toBeLessThan(40)
  })

  it('une opération refusée n’écrit rien', async () => {
    await updateTales({ type: 'set-count', id: 'blue-bird', count: 5 }, NOW)
    const before = await readEntries()
    await expect(updateTales(op('aladdin'), NOW)).rejects.toThrow('insuffisants')
    await expect(updateTales({ type: 'adjust', id: 'blue-bird', delta: -6 }, NOW)).rejects.toThrow('négatif')
    expect(await readEntries()).toEqual(before)
  })

  it('garde les champs écrits par une version plus récente', async () => {
    await commit({ set: [['tales', { ...emptyTales(), futur: { x: 1 } }]] })
    await updateTales({ type: 'adjust', id: 'blue-bird', delta: 1 }, NOW)
    expect((await readEntries()).tales).toMatchObject({ futur: { x: 1 }, counts: { 'blue-bird': 1 } })
  })

  it('export et import : compteurs, puzzles, journal (annulation encore possible) et noms personnalisés', async () => {
    await updateTales({ type: 'set-count', id: 'blue-bird', count: 30 }, NOW)
    await updateTales(op('aladdin'), NOW)
    await updateCustomName('tale:aladdin', 'Aladdin (mon nom)')
    await updateCustomName('anigami:blue-bird', 'Oiseau bleu')
    const file = await createBackup({ includePhotos: false })
    expect((file.sections.tales as { data: TalesData }).data.counts).toEqual({ 'blue-bird': 5 })

    resetStoreForTests(`test-${Math.random()}`)
    await applyRestore(parseBackupText(JSON.stringify(file)))
    const d = await loadTales()
    expect(d.counts).toEqual({ 'blue-bird': 5 })
    expect(d.puzzles.aladdin).toBeDefined()
    expect(lastUndoable(d)?.taleId).toBe('aladdin')
    expect(await loadNames()).toEqual({ 'tale:aladdin': 'Aladdin (mon nom)', 'anigami:blue-bird': 'Oiseau bleu' })
    expect((await updateTales({ type: 'undo-last' }, NOW)).counts).toEqual({ 'blue-bird': 30 })
  })

  it('une sauvegarde de la phase 3 (sans puzzles) conserve les puzzles du téléphone', async () => {
    await updateTales({ type: 'set-count', id: 'blue-bird', count: 7 }, NOW)
    const phase3 = { app: 'dreamlight-compagnons', format: 2, type: 'complete', schema: 3, sections: { assignments: { v: 1, data: {} }, names: { v: 1, data: {} }, photos: null } }
    const parsed = parseBackupText(JSON.stringify(phase3))
    expect((await planRestore(parsed)).find((p) => p.id === 'tales')).toMatchObject({ action: 'keep' })
    await applyRestore(parsed)
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 7 })
  })

  it('refuse une section abîmée, écarte les éléments inconnus en les comptant', () => {
    const base = { app: 'dreamlight-compagnons', format: 2, type: 'partial', schema: 3 }
    expect(() => parseBackupText(JSON.stringify({ ...base, sections: { tales: { v: 1, data: 'abîmé' } } }))).toThrow('abîmée')
    expect(() => parseBackupText(JSON.stringify({ ...base, sections: { tales: { v: 1, data: ['x'] } } }))).toThrow('abîmée')
    const parsed = parseBackupText(
      JSON.stringify({ ...base, sections: { tales: { v: 1, data: { counts: { 'blue-bird': 4, inconnu: 2, 'red-bird': -3 }, puzzles: { inconnu: { doneAt: '2026-11-09T10:00:00.000Z' } }, log: [] } } } }),
    )
    expect(parsed.sections[0]).toMatchObject({ data: { counts: { 'blue-bird': 4 } }, ignored: 3 })
  })
})

describe('noms : trois statuts, nom personnalisé jamais officiel', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('nom d’un guide, à confirmer (anglais) ou personnalisé', () => {
    expect(anigamiName(ANIGAMI_BY_ID['blue-bird'], {})).toEqual({ text: 'Anigami oiseau bleu', kind: 'guide' })
    expect(anigamiName(ANIGAMI_BY_ID['shadowy-bird'], {})).toEqual({ text: 'Shadowy Bird Snippet', kind: 'to-confirm' })
    expect(anigamiName(ANIGAMI_BY_ID['shadowy-bird'], { 'anigami:shadowy-bird': 'Anigami oiseau ombré' })).toEqual({ text: 'Anigami oiseau ombré', kind: 'custom' })
    expect(taleName(TALE_BY_ID.aladdin, {})).toEqual({ text: 'Aladdin', kind: 'to-confirm' })
    expect(taleName(TALE_BY_ID.aladdin, { 'tale:aladdin': 'Aladdin' })).toEqual({ text: 'Aladdin', kind: 'custom' })
  })

  it('enregistrement atomique, refus des éléments inconnus, catalogue jamais modifié', async () => {
    await Promise.all([updateCustomName('tale:coco', 'Coco (FR)'), updateCustomName('anigami:red-bird', 'Oiseau rouge')])
    expect(await loadNames()).toEqual({ 'tale:coco': 'Coco (FR)', 'anigami:red-bird': 'Oiseau rouge' })
    await expect(updateCustomName('tale:inconnu', 'X')).rejects.toThrow('inconnu')
    await expect(updateCustomName('anigami:constructor', 'X')).rejects.toThrow()
    expect(TALE_BY_ID.coco.nameEn).toBe('Coco')
    expect(ANIGAMI_BY_ID['red-bird'].nameFr).toBe('Anigami oiseau rouge')
  })
})
