import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStoreForTests } from '../../lib/db'
import { buildToday } from './model'
import { loadTasks } from './storage'
import { CLOCK_TICK_MS, useTasks } from './useTasks'

async function openTab() {
  const tab = renderHook(() => useTasks())
  await waitFor(() => expect(tab.result.current.ready).toBe(true))
  expect(tab.result.current.failure).toBeNull()
  return tab
}

describe('tâches : plusieurs onglets', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))

  it('deux onglets cochent deux tâches différentes en même temps : chacun voit les deux', async () => {
    const a = await openTab()
    const b = await openTab()
    act(() => {
      a.result.current.apply({ type: 'check', taskId: 'open-chests', done: true })
      b.result.current.apply({ type: 'check', taskId: 'give-gifts', done: true })
      b.result.current.apply({ type: 'add-custom', id: 'perso-tab2', label: 'Tâche de l’onglet 2', recurrence: { kind: 'once' } })
    })
    await waitFor(async () => expect(Object.keys((await loadTasks()).done)).toHaveLength(2))
    for (const tab of [a, b]) {
      await waitFor(() => expect(Object.keys(tab.result.current.data.done)).toHaveLength(2))
      await waitFor(() => expect(tab.result.current.data.custom.map((c) => c.id)).toEqual(['perso-tab2']))
    }
    a.unmount()
    b.unmount()
  })
})

describe('app laissée ouverte', () => {
  beforeEach(() => resetStoreForTests(`test-${Math.random()}`))
  afterEach(() => vi.useRealTimers())

  it('après minuit, une tâche quotidienne faite la veille revient sans rechargement', async () => {
    // Horloge simulée (Date + setInterval) ; IndexedDB garde ses vrais minuteurs.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-09T23:58:00'))
    const tab = await openTab()
    act(() => tab.result.current.apply({ type: 'check', taskId: 'open-chests', done: true }))
    await waitFor(() => expect(buildToday(tab.result.current.data, tab.result.current.now).done.map((i) => i.id)).toEqual(['open-chests']))

    vi.setSystemTime(new Date('2026-11-10T00:00:30'))
    act(() => {
      vi.advanceTimersByTime(CLOCK_TICK_MS)
    })
    const today = buildToday(tab.result.current.data, tab.result.current.now)
    expect(today.done).toEqual([])
    expect(today.todo.map((i) => i.id)).toContain('open-chests')
    tab.unmount()
  })
})
