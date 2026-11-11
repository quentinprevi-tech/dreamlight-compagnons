import { beforeEach, describe, expect, it } from 'vitest'
import { applyRestore, createBackup, parseBackupText, planRestore } from '../../lib/backup'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { CURRENT_SCHEMA, runMigrations, SCHEMA_KEY, snapshotKey } from '../../lib/migrations'
import { loadAssignments, updateAssignment } from '../../lib/storage'
import { applyPatch, formatFriendship, isUnlocked, sanitizeVillagers } from './model'
import { loadVillagers, updateVillager } from './storage'

describe('modèle', () => {
  it('ne garde que les habitants du catalogue et les valeurs valides', () => {
    const raw = JSON.parse(
      '{"mickey":{"unlocked":true,"friendship":4,"askedItem":true},"goofy":{"unlocked":"oui","friendship":11},"elsa":{"friendship":2.5},' +
        '"ariel":{"friendship":0,"askedItem":false},"inconnu":{"unlocked":true},"constructor":{"unlocked":true},"__proto__":{"unlocked":true}}',
    )
    expect(sanitizeVillagers(raw)).toEqual({ mickey: { unlocked: true, friendship: 4, askedItem: true } })
    expect(sanitizeVillagers(['x'])).toEqual({})
  })

  it('une modification ne touche que les champs fournis', () => {
    expect(applyPatch({ friendship: 3, futur: 'x' }, { askedItem: true })).toEqual({ friendship: 3, futur: 'x', askedItem: true })
    expect(applyPatch({ friendship: 3, askedItem: true }, { friendship: null, askedItem: false })).toEqual({})
  })

  it('un habitant avec métier est affiché débloqué', () => {
    expect(isUnlocked({}, { mickey: 'fishing' }, 'mickey')).toBe(true)
    expect(isUnlocked({}, {}, 'mickey')).toBe(false)
    expect(isUnlocked({ elsa: { unlocked: true } }, {}, 'elsa')).toBe(true)
    expect(isUnlocked({}, {}, 'constructor')).toBe(false)
  })

  it('affiche les niveaux sans inventer de libellé officiel', () => {
    expect(formatFriendship(undefined)).toBe('Non renseignée')
    expect(formatFriendship(4)).toBe('Niveau 4')
    expect(formatFriendship(10)).toBe('Niveau 10 (max)')
  })
})

describe('stockage atomique', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('débloqué, amitié et demande d’objet : enregistrés, modifiables et conservés après redémarrage', async () => {
    await updateVillager('elsa', { unlocked: true })
    await updateVillager('elsa', { friendship: 3 })
    await updateVillager('elsa', { askedItem: true })
    resetStoreForTests() // redémarrage
    expect(await loadVillagers()).toEqual({ elsa: { unlocked: true, friendship: 3, askedItem: true } })

    // Modification puis réinitialisation manuelle de la demande
    await updateVillager('elsa', { friendship: 7 })
    expect(await updateVillager('elsa', { askedItem: false })).toEqual({ elsa: { unlocked: true, friendship: 7 } })
    // Effacer l'amitié
    expect(await updateVillager('elsa', { friendship: null })).toEqual({ elsa: { unlocked: true } })
  })

  it('la demande d’objet n’est jamais remise à zéro automatiquement', async () => {
    await updateVillager('elsa', { unlocked: true, askedItem: true })
    await updateVillager('elsa', { friendship: 5 })
    await updateAssignment('elsa', 'mining')
    await updateAssignment('elsa', null)
    await runMigrations()
    resetStoreForTests()
    expect((await loadVillagers()).elsa?.askedItem).toBe(true)
  })

  it('refuse les valeurs et habitants invalides sans rien écrire', async () => {
    await expect(updateVillager('elsa', { friendship: 0 })).rejects.toThrow()
    await expect(updateVillager('elsa', { friendship: 11 })).rejects.toThrow()
    await expect(updateVillager('elsa', { friendship: 2.5 })).rejects.toThrow()
    await expect(updateVillager('inconnu', { unlocked: true })).rejects.toThrow()
    await expect(updateVillager('constructor', { unlocked: true })).rejects.toThrow()
    await expect(updateVillager('lilo', { unlocked: true })).rejects.toThrow('pas encore sorti')
    expect(await loadVillagers()).toEqual({})
  })

  it('un habitant qui a un métier ne peut pas être marqué non débloqué', async () => {
    await updateAssignment('mickey', 'fishing')
    await expect(updateVillager('mickey', { unlocked: false })).rejects.toThrow('forcément débloqué')
    expect((await loadVillagers()).mickey).toEqual({ unlocked: true })
  })

  it('attribuer un métier débloque l’habitant dans la même transaction, sans toucher aux autres', async () => {
    await updateVillager('elsa', { unlocked: true, friendship: 6 })
    const saved = await updateAssignment('mickey', 'fishing')
    expect(saved.villagers).toEqual({ elsa: { unlocked: true, friendship: 6 }, mickey: { unlocked: true } })
    expect(await loadAssignments()).toEqual({ mickey: 'fishing' })
  })

  it('modifications simultanées : deux habitants, ou deux champs du même habitant, tout est conservé', async () => {
    await Promise.all([
      updateVillager('mickey', { unlocked: true }),
      updateVillager('goofy', { unlocked: true }),
      updateVillager('mickey', { friendship: 4 }),
      updateVillager('mickey', { askedItem: true }),
      updateAssignment('goofy', 'gardening'),
    ])
    expect(await loadVillagers()).toEqual({ mickey: { unlocked: true, friendship: 4, askedItem: true }, goofy: { unlocked: true } })
    expect(await loadAssignments()).toEqual({ goofy: 'gardening' })
  })
})

describe('migration v3', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('base v1 avec métiers : ces habitants deviennent débloqués, aucun métier ajouté', async () => {
    await commit({ set: [['assignments', { mickey: 'fishing', goofy: 'gardening', inconnu: 'mining' }]] })
    expect(await runMigrations()).toMatchObject({ status: 'migrated', from: 1, to: CURRENT_SCHEMA })
    const all = await readEntries()
    expect(CURRENT_SCHEMA).toBe(3)
    expect(all.assignments).toEqual({ mickey: 'fishing', goofy: 'gardening', inconnu: 'mining' }) // jamais réécrite
    expect(all.villagers).toEqual({ mickey: { unlocked: true }, goofy: { unlocked: true } })
    expect(await loadVillagers()).toEqual({ mickey: { unlocked: true }, goofy: { unlocked: true } })
    expect((all[snapshotKey(3)] as { data: unknown }).data).toEqual({ assignments: { mickey: 'fishing', goofy: 'gardening', inconnu: 'mining' } })
  })

  it('base sans métier : aucun habitant marqué, aucune clé créée', async () => {
    await commit({ set: [['assignments', {}]] })
    await runMigrations()
    const all = await readEntries()
    expect('villagers' in all).toBe(false)
    expect(all[SCHEMA_KEY]).toBe(3)
  })

  it('base v2 avec un suivi déjà présent : complété sans rien perdre', async () => {
    await commit({
      set: [
        ['assignments', { mickey: 'fishing' }],
        ['villagers', { mickey: { friendship: 5 }, elsa: { unlocked: true, askedItem: true } }],
        [SCHEMA_KEY, 2],
      ],
    })
    expect(await runMigrations()).toMatchObject({ status: 'migrated', from: 2, to: 3 })
    expect(await loadVillagers()).toEqual({ mickey: { friendship: 5, unlocked: true }, elsa: { unlocked: true, askedItem: true } })
  })
})

describe('export et import', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('aller-retour du suivi des habitants vers un autre téléphone', async () => {
    await updateAssignment('mickey', 'fishing')
    await updateVillager('elsa', { unlocked: true, friendship: 8, askedItem: true })
    const file = await createBackup({ includePhotos: false })
    expect(file.sections.villagers).toEqual({ v: 1, data: { mickey: { unlocked: true }, elsa: { unlocked: true, friendship: 8, askedItem: true } } })

    resetStoreForTests(`test-${Math.random()}`)
    await applyRestore(parseBackupText(JSON.stringify(file)))
    expect(await loadVillagers()).toEqual({ mickey: { unlocked: true }, elsa: { unlocked: true, friendship: 8, askedItem: true } })
  })

  it('une sauvegarde de la phase 0 (sans suivi) conserve le suivi du téléphone', async () => {
    await updateVillager('elsa', { unlocked: true, friendship: 8 })
    const phase0 = {
      app: 'dreamlight-compagnons',
      format: 2,
      type: 'complete',
      schema: 2,
      assignments: { goofy: 'gardening' },
      sections: { assignments: { v: 1, data: { goofy: 'gardening' } }, names: { v: 1, data: {} }, photos: null },
    }
    const parsed = parseBackupText(JSON.stringify(phase0))
    expect((await planRestore(parsed)).find((p) => p.id === 'villagers')).toMatchObject({ action: 'keep' })
    await applyRestore(parsed)
    expect(await loadVillagers()).toEqual({ elsa: { unlocked: true, friendship: 8 } })
    // Goofy a un métier : il est affiché débloqué même sans case cochée
    expect(isUnlocked(await loadVillagers(), await loadAssignments(), 'goofy')).toBe(true)
  })

  it('refuse une section de suivi abîmée et écarte les entrées inconnues', async () => {
    const base = { app: 'dreamlight-compagnons', format: 2, type: 'partial', schema: 3, sections: {} as Record<string, unknown> }
    expect(() => parseBackupText(JSON.stringify({ ...base, sections: { villagers: { v: 1, data: 'abîmé' } } }))).toThrow('abîmée')
    const parsed = parseBackupText(
      JSON.stringify({ ...base, sections: { villagers: { v: 1, data: { elsa: { friendship: 3 }, inconnu: { unlocked: true }, mickey: { friendship: 42 } } } } }),
    )
    expect(parsed.sections[0]).toMatchObject({ data: { elsa: { friendship: 3 } }, ignored: 2 })
  })
})
