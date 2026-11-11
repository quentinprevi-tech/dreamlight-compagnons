import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { createSync } from '../../lib/sync'
import { newOpId } from './model'
import { loadTales } from './storage'
import { useTales } from './useTales'

async function openTab() {
  const tab = renderHook(() => useTales())
  await waitFor(() => expect(tab.result.current.ready).toBe(true))
  expect(tab.result.current.failure).toBeNull()
  return tab
}

describe('puzzles : plusieurs onglets', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('deux onglets ajoutent des anigamis en même temps : chacun voit le total', async () => {
    const a = await openTab()
    const b = await openTab()
    await act(async () => {
      await Promise.all([a.result.current.apply({ type: 'adjust', id: 'blue-bird', delta: 3 }), b.result.current.apply({ type: 'adjust', id: 'blue-bird', delta: 4 })])
    })
    for (const tab of [a, b]) await waitFor(() => expect(tab.result.current.data.counts).toEqual({ 'blue-bird': 7 }))
    a.unmount()
    b.unmount()
  })

  it('une validation faite dans un onglet apparaît dans l’autre ; l’annulation aussi', async () => {
    const a = await openTab()
    const b = await openTab()
    await act(async () => {
      await a.result.current.apply({ type: 'set-count', id: 'blue-bird', count: 30 })
    })
    await waitFor(() => expect(b.result.current.data.counts).toEqual({ 'blue-bird': 30 }))
    await act(async () => {
      expect(await a.result.current.apply({ type: 'validate', taleId: 'aladdin', opId: newOpId() })).toBeNull()
    })
    await waitFor(() => expect(b.result.current.data.puzzles.aladdin).toBeDefined())
    expect(b.result.current.data.counts).toEqual({ 'blue-bird': 5 })
    // L'onglet B modifie à la main, puis annule : les deux onglets finissent avec 5 + 3 + 25
    await act(async () => {
      await b.result.current.apply({ type: 'adjust', id: 'blue-bird', delta: 3 })
      await b.result.current.apply({ type: 'undo-last' })
    })
    await waitFor(() => expect(a.result.current.data.counts).toEqual({ 'blue-bird': 33 }))
    expect(a.result.current.data.puzzles).toEqual({})
    a.unmount()
    b.unmount()
  })

  it('une validation qui échoue (quantités dépensées ailleurs) renvoie le message et revient à l’état réel', async () => {
    const a = await openTab()
    const b = await openTab()
    await act(async () => {
      await a.result.current.apply({ type: 'set-count', id: 'blue-bird', count: 25 })
    })
    await waitFor(() => expect(b.result.current.data.counts).toEqual({ 'blue-bird': 25 }))
    // L'autre onglet dépense les anigamis juste avant la validation de l'onglet A
    await act(async () => {
      await b.result.current.apply({ type: 'adjust', id: 'blue-bird', delta: -10 })
    })
    let message: string | null = null
    await act(async () => {
      message = await a.result.current.apply({ type: 'validate', taleId: 'aladdin', opId: newOpId() })
    })
    expect(message).toContain('insuffisants')
    await waitFor(() => expect(a.result.current.data.counts).toEqual({ 'blue-bird': 15 }))
    expect(a.result.current.data.puzzles).toEqual({})
    expect(a.result.current.error).toBeNull() // le refus est affiché par l'appelant, pas par un bandeau global
    a.unmount()
    b.unmount()
  })

  it('une restauration faite ailleurs actualise l’onglet ouvert sans rien écraser', async () => {
    const a = await openTab()
    await commit({ set: [['tales', { counts: { 'red-demon': 12 }, puzzles: {}, log: [] }]] })
    createSync(() => {}).notify('restored')
    await waitFor(() => expect(a.result.current.data.counts).toEqual({ 'red-demon': 12 }))
    await act(async () => {
      await a.result.current.apply({ type: 'adjust', id: 'blue-bird', delta: 2 })
    })
    expect((await loadTales()).counts).toEqual({ 'red-demon': 12, 'blue-bird': 2 })
    a.unmount()
  })

  it('une erreur de chargement bloque : aucune écriture possible', async () => {
    await commit({ set: [['tales', { counts: { 'blue-bird': 4 }, puzzles: {}, log: [] }], ['bizarre', 1n]] })
    const tab = renderHook(() => useTales())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    expect(tab.result.current.failure).toMatchObject({ kind: 'load', readable: true })
    let message: string | null = null
    await act(async () => {
      message = await tab.result.current.apply({ type: 'adjust', id: 'blue-bird', delta: 1 })
    })
    expect(message).toContain('pas chargées')
    expect((await readEntries()).tales).toEqual({ counts: { 'blue-bird': 4 }, puzzles: {}, log: [] })
    tab.unmount()
  })
})
