import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyRestore, parseBackupText, undoLastRestore } from './backup'
import { commit, readEntries, resetStoreForTests } from './db'
import { SIGNAL_KEY } from './sync'
import { useCompanions } from './useCompanions'

/** Un « onglet » = une instance de l'état de l'app, avec son propre canal de synchronisation. */
async function openTab() {
  const tab = renderHook(() => useCompanions())
  await waitFor(() => expect(tab.result.current.ready).toBe(true))
  expect(tab.result.current.loadError).toBeNull()
  return tab
}

const stored = async () => (await readEntries()).assignments

describe('plusieurs onglets ouverts', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))
  afterEach(() => vi.unstubAllGlobals())

  it('deux onglets modifient deux habitants différents en même temps : rien n’est perdu', async () => {
    await commit({ set: [['assignments', { goofy: 'gardening' }]] })
    const a = await openTab()
    const b = await openTab()

    act(() => {
      a.result.current.assign('mickey', 'fishing')
      b.result.current.assign('elsa', 'mining')
    })
    await waitFor(async () => expect(await stored()).toEqual({ goofy: 'gardening', mickey: 'fishing', elsa: 'mining' }))
    // Chaque onglet affiche aussi la modification de l'autre (BroadcastChannel).
    await waitFor(() => expect(a.result.current.assignments).toEqual({ goofy: 'gardening', mickey: 'fishing', elsa: 'mining' }))
    await waitFor(() => expect(b.result.current.assignments).toEqual({ goofy: 'gardening', mickey: 'fishing', elsa: 'mining' }))
    a.unmount()
    b.unmount()
  })

  it('une restauration faite dans un onglet n’est pas écrasée par l’autre, qui se met à jour', async () => {
    await commit({ set: [['assignments', { goofy: 'gardening' }]] })
    const a = await openTab()
    const b = await openTab()

    await act(async () => {
      await applyRestore(parseBackupText(JSON.stringify({ app: 'dreamlight-compagnons', version: 1, assignments: { moana: 'fishing', elsa: 'mining' } })))
      await a.result.current.afterRestore()
    })
    await waitFor(() => expect(b.result.current.assignments).toEqual({ moana: 'fishing', elsa: 'mining' }))

    // L'onglet B modifie ensuite un habitant : la restauration est conservée.
    act(() => b.result.current.assign('remy', 'gardening'))
    await waitFor(async () => expect(await stored()).toEqual({ moana: 'fishing', elsa: 'mining', remy: 'gardening' }))
    await waitFor(() => expect(a.result.current.assignments).toEqual({ moana: 'fishing', elsa: 'mining', remy: 'gardening' }))

    // Annulation dans A : B revient lui aussi à l'état d'avant.
    await act(async () => {
      await undoLastRestore()
      await a.result.current.afterRestore()
    })
    await waitFor(() => expect(b.result.current.assignments).toEqual({ goofy: 'gardening' }))
    a.unmount()
    b.unmount()
  })

  it('suivi des habitants : deux onglets modifient le même habitant en même temps, et chacun voit l’autre', async () => {
    await commit({ set: [['villagers', { elsa: { unlocked: true } }]] })
    const a = await openTab()
    const b = await openTab()

    act(() => {
      a.result.current.updateVillager('elsa', { friendship: 6 })
      b.result.current.updateVillager('elsa', { askedItem: true })
      b.result.current.updateVillager('mickey', { unlocked: true })
    })
    const expected = { elsa: { unlocked: true, friendship: 6, askedItem: true }, mickey: { unlocked: true } }
    await waitFor(async () => expect((await readEntries()).villagers).toEqual(expected))
    await waitFor(() => expect(a.result.current.villagers).toEqual(expected))
    await waitFor(() => expect(b.result.current.villagers).toEqual(expected))

    // Un métier attribué dans A débloque l'habitant, et B l'affiche
    act(() => a.result.current.assign('goofy', 'gardening'))
    await waitFor(() => expect(b.result.current.villagers.goofy).toEqual({ unlocked: true }))
    await waitFor(() => expect(b.result.current.assignments).toEqual({ goofy: 'gardening' }))
    a.unmount()
    b.unmount()
  })

  it('une modification refusée (habitant avec métier) affiche l’explication et garde l’état réel', async () => {
    await commit({ set: [['assignments', { mickey: 'fishing' }], ['villagers', { mickey: { unlocked: true } }]] })
    const a = await openTab()
    act(() => a.result.current.updateVillager('mickey', { unlocked: false }))
    await waitFor(() => expect(a.result.current.saveError).toContain('forcément débloqué'))
    await waitFor(() => expect(a.result.current.villagers.mickey).toEqual({ unlocked: true }))
    a.unmount()
  })

  it('même un onglet resté sur un état périmé n’écrase pas les autres habitants', async () => {
    await commit({ set: [['assignments', { goofy: 'gardening' }]] })
    const b = await openTab()
    // Modification faite « ailleurs » sans aucun signal (cas extrême : message perdu)
    await commit({ set: [['assignments', { goofy: 'gardening', moana: 'fishing' }]] })
    act(() => b.result.current.assign('elsa', 'mining'))
    await waitFor(async () => expect(await stored()).toEqual({ goofy: 'gardening', moana: 'fishing', elsa: 'mining' }))
    await waitFor(() => expect(b.result.current.assignments).toEqual({ goofy: 'gardening', moana: 'fishing', elsa: 'mining' }))
    b.unmount()
  })

  it('sans BroadcastChannel : signal par localStorage, et relecture quand l’onglet redevient visible', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    await commit({ set: [['assignments', {}]] })
    const a = await openTab()
    const b = await openTab()

    act(() => a.result.current.assign('mickey', 'fishing'))
    await waitFor(async () => expect(await stored()).toEqual({ mickey: 'fishing' }))
    const signal = localStorage.getItem(SIGNAL_KEY)
    expect(signal).toContain('"reason":"changed"')
    // Le navigateur envoie l'événement « storage » aux AUTRES onglets (jsdom ne le fait pas tout seul).
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: SIGNAL_KEY, newValue: signal }))
    })
    await waitFor(() => expect(b.result.current.assignments).toEqual({ mickey: 'fishing' }))

    // Filet de sécurité : modification sans aucun signal, relue au retour sur l'onglet.
    await commit({ set: [['assignments', { mickey: 'fishing', elsa: 'mining' }]] })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(b.result.current.assignments).toEqual({ mickey: 'fishing', elsa: 'mining' }))
    a.unmount()
    b.unmount()
  })
})

describe('chargement initial', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))
  afterEach(() => vi.restoreAllMocks())

  it('une erreur imprévue au démarrage bloque l’app : aucune écriture possible', async () => {
    // Valeur que la vérification ne sait pas comparer : erreur qui n'est pas une MigrationError
    // (même chemin qu'un stockage plein ou une connexion fermée par Safari).
    await commit({ set: [['assignments', { mickey: 'fishing', goofy: 'gardening' }], ['bizarre', 1n]] })
    const tab = renderHook(() => useCompanions())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    expect(tab.result.current.loadError).toMatchObject({ kind: 'load', readable: true })

    act(() => tab.result.current.assign('elsa', 'mining'))
    await act(async () => tab.result.current.setPortrait('elsa', new Blob(['x'], { type: 'image/jpeg' })))
    await new Promise((r) => setTimeout(r, 30))
    const all = await readEntries()
    expect(all.assignments).toEqual({ mickey: 'fishing', goofy: 'gardening' })
    expect('portrait:elsa' in all).toBe(false)
    tab.unmount()
  })

  it('IndexedDB inaccessible : bloqué, et aucune copie de secours prétendue', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('Stockage bloqué', 'SecurityError')
    })
    resetStoreForTests(`test-${Math.random()}`)
    const tab = renderHook(() => useCompanions())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    expect(tab.result.current.loadError).toMatchObject({ kind: 'load', readable: false })
    tab.unmount()
  })
})
