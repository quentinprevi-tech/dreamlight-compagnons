import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { createSync } from '../../lib/sync'
import { loadCritters } from './storage'
import { useCritters } from './useCritters'

async function openTab() {
  const tab = renderHook(() => useCritters())
  await waitFor(() => expect(tab.result.current.ready).toBe(true))
  expect(tab.result.current.failure).toBeNull()
  return tab
}

describe('animaux : plusieurs onglets', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-12T09:00:00'))
  })

  it('deux onglets nourrissent deux variantes en même temps : chacun voit les deux', async () => {
    const a = await openTab()
    const b = await openTab()
    act(() => {
      a.result.current.apply({ type: 'feed', id: 'calico-rabbit' })
      b.result.current.apply({ type: 'feed', id: 'black-rabbit' })
    })
    for (const tab of [a, b]) {
      await waitFor(() => expect(Object.keys(tab.result.current.data.progress).sort()).toEqual(['black-rabbit', 'calico-rabbit']))
    }
    a.unmount()
    b.unmount()
  })

  it('le même nourrissage dans deux onglets compte une seule fois', async () => {
    const a = await openTab()
    const b = await openTab()
    act(() => {
      a.result.current.apply({ type: 'feed', id: 'calico-rabbit' })
      b.result.current.apply({ type: 'feed', id: 'calico-rabbit' })
    })
    await waitFor(async () => expect((await loadCritters()).progress['calico-rabbit']?.feedings).toBe(1))
    await waitFor(() => expect(a.result.current.data.progress['calico-rabbit']?.feedings).toBe(1))
    await waitFor(() => expect(b.result.current.data.progress['calico-rabbit']?.feedings).toBe(1))
    // Un nouvel appui plus tard le même jour ne change toujours rien
    act(() => a.result.current.apply({ type: 'feed', id: 'calico-rabbit' }))
    await new Promise((r) => setTimeout(r, 50))
    expect((await loadCritters()).progress['calico-rabbit']?.feedings).toBe(1)
    a.unmount()
    b.unmount()
  })

  it('une restauration faite ailleurs actualise l’onglet ouvert sans rien écraser', async () => {
    const a = await openTab()
    // Un autre onglet restaure une sauvegarde : il écrit puis prévient les autres
    await commit({ set: [['critters', { owned: { eternity: false }, progress: { 'classic-fox': { obtained: true } } }]] })
    createSync(() => {}).notify('restored')
    await waitFor(() => expect(a.result.current.data.progress['classic-fox']?.obtained).toBe(true))
    expect(a.result.current.data.owned).toEqual({ eternity: false })
    // L'onglet A modifie ensuite une autre variante : la restauration est conservée
    act(() => a.result.current.apply({ type: 'feed', id: 'calico-rabbit' }))
    await waitFor(async () => expect(Object.keys((await loadCritters()).progress).sort()).toEqual(['calico-rabbit', 'classic-fox']))
    a.unmount()
  })

  it('une erreur de chargement bloque : aucune écriture possible', async () => {
    await commit({ set: [['critters', { owned: {}, progress: { 'calico-rabbit': { feedings: 2 } } }], ['bizarre', 1n]] })
    const tab = renderHook(() => useCritters())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    expect(tab.result.current.failure).toMatchObject({ kind: 'load', readable: true })
    act(() => tab.result.current.apply({ type: 'feed', id: 'black-rabbit' }))
    await new Promise((r) => setTimeout(r, 50))
    expect((await readEntries()).critters).toEqual({ owned: {}, progress: { 'calico-rabbit': { feedings: 2 } } })
    tab.unmount()
  })
})
