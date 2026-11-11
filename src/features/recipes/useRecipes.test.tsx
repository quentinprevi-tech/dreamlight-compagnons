import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { commit, readEntries, resetStoreForTests } from '../../lib/db'
import { createSync } from '../../lib/sync'
import { loadRecipes } from './storage'
import { useRecipes } from './useRecipes'

async function openTab() {
  const tab = renderHook(() => useRecipes())
  await waitFor(() => expect(tab.result.current.ready).toBe(true))
  expect(tab.result.current.failure).toBeNull()
  return tab
}

describe('recettes : plusieurs onglets', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('deux onglets cochent des recettes différentes en même temps : chacun voit les deux', async () => {
    const a = await openTab()
    const b = await openTab()
    await act(async () => {
      await Promise.all([a.result.current.apply({ type: 'set-known', id: 'waffles', known: true }), b.result.current.apply({ type: 'set-known', id: 'coffee', known: true })])
    })
    for (const tab of [a, b]) await waitFor(() => expect(Object.keys(tab.result.current.data.known).sort()).toEqual(['coffee', 'waffles']))
    a.unmount()
    b.unmount()
  })

  it('un favori ajouté dans un onglet apparaît dans l’autre, puis un retrait aussi', async () => {
    const a = await openTab()
    const b = await openTab()
    await act(async () => {
      await a.result.current.apply({ type: 'set-favorite', id: 'pasta', favorite: true })
    })
    await waitFor(() => expect(Object.keys(b.result.current.data.favorites)).toEqual(['pasta']))
    await act(async () => {
      await b.result.current.apply({ type: 'set-favorite', id: 'pasta', favorite: false })
    })
    await waitFor(() => expect(a.result.current.data.favorites).toEqual({}))
    a.unmount()
    b.unmount()
  })

  it('une recette inconnue est refusée avec un message, sans rien écrire', async () => {
    const a = await openTab()
    let message: string | null = null
    await act(async () => {
      message = await a.result.current.apply({ type: 'set-known', id: 'fantome', known: true })
    })
    expect(message).toContain('inconnue')
    expect((await loadRecipes()).known).toEqual({})
    expect(a.result.current.error).toBeNull()
    a.unmount()
  })

  it('une restauration faite ailleurs actualise l’onglet ouvert sans rien écraser', async () => {
    const a = await openTab()
    await commit({ set: [['recipes', { known: { pasta: '2026-11-09T10:00:00.000Z' }, favorites: {} }]] })
    createSync(() => {}).notify('restored')
    await waitFor(() => expect(Object.keys(a.result.current.data.known)).toEqual(['pasta']))
    await act(async () => {
      await a.result.current.apply({ type: 'set-known', id: 'waffles', known: true })
    })
    expect(Object.keys((await loadRecipes()).known).sort()).toEqual(['pasta', 'waffles'])
    a.unmount()
  })

  it('une erreur de chargement bloque : aucune écriture possible', async () => {
    await commit({ set: [['recipes', { known: { waffles: '2026-11-09T10:00:00.000Z' }, favorites: {} }], ['bizarre', 1n]] })
    const tab = renderHook(() => useRecipes())
    await waitFor(() => expect(tab.result.current.ready).toBe(true))
    expect(tab.result.current.failure).toMatchObject({ kind: 'load', readable: true })
    let message: string | null = null
    await act(async () => {
      message = await tab.result.current.apply({ type: 'set-known', id: 'coffee', known: true })
    })
    expect(message).toContain('pas chargées')
    expect((await readEntries()).recipes).toEqual({ known: { waffles: '2026-11-09T10:00:00.000Z' }, favorites: {} })
    tab.unmount()
  })
})
