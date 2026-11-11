import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomSheet } from '../components/BottomSheet'
import { sheetHistorySettled } from './sheetHistory'

/**
 * Bouton « Retour » et fiches, avec le VRAI historique (simulé) de jsdom : pushState, history.go, popstate.
 * Le comportement en vrai navigateur est couvert par e2e/sheets.spec.ts.
 */
const depth = () => (window.history.state as { ddvSheets?: number } | null)?.ddvSheets ?? 0
const url = () => window.location.href

function Sheet({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} label={name} panelClassName="bg-white">
      <h2>{name}</h2>
    </BottomSheet>
  )
}

/** Fiche qui se ferme quand le parent le décide ; `refuse.current = true` simule « opération en cours ». */
function Host({ name = 'Fiche', refuse = { current: false } }: { name?: string; refuse?: { current: boolean } }) {
  const [open, setOpen] = useState(true)
  return open ? <Sheet name={name} onClose={() => !refuse.current && setOpen(false)} /> : <p>{name} fermée</p>
}

describe('fiches et historique du navigateur', () => {
  let base: string

  beforeEach(async () => {
    window.history.replaceState(null, '', '#/base')
    await sheetHistorySettled()
    base = url()
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await sheetHistorySettled()
  })

  it('ouvrir une fiche ajoute UNE entrée de même adresse ; « Retour » la ferme sans changer d’écran', async () => {
    const before = window.history.length
    render(<Host />)
    await waitFor(() => expect(depth()).toBe(1))
    expect(window.history.length).toBe(before + 1)
    expect(url()).toBe(base)

    act(() => window.history.back())
    expect(await screen.findByText('Fiche fermée')).toBeInTheDocument()
    expect(url()).toBe(base)
    expect(depth()).toBe(0)
  })

  it('fermer par la croix retire l’entrée : aucune entrée « fiche » ne reste sous l’écran', async () => {
    render(<Host />)
    await waitFor(() => expect(depth()).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    await screen.findByText('Fiche fermée')
    await waitFor(() => expect(depth()).toBe(0))
    expect(url()).toBe(base)
  })

  it('clic à côté et Échap font de même', async () => {
    const { unmount } = render(<Host />)
    await waitFor(() => expect(depth()).toBe(1))
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    await screen.findByText('Fiche fermée')
    await waitFor(() => expect(depth()).toBe(0))
    unmount()

    render(<Host />)
    await waitFor(() => expect(depth()).toBe(1))
    await userEvent.keyboard('{Escape}')
    await screen.findByText('Fiche fermée')
    await waitFor(() => expect(depth()).toBe(0))
  })

  it('ouvrir, fermer, rouvrir : toujours une seule entrée, jamais d’accumulation', async () => {
    const first = window.history.length
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(<Host />)
      await waitFor(() => expect(depth()).toBe(1))
      await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
      await waitFor(() => expect(depth()).toBe(0))
      unmount()
    }
    // Les entrées retirées restent « devant » (historique avant/arrière), mais on est revenu sur l’entrée de l’écran
    expect(url()).toBe(base)
    expect(window.history.length).toBeLessThanOrEqual(first + 1)
  })

  it('fiches empilées : Retour ferme celle du dessus seulement, puis la suivante', async () => {
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    function Stack() {
      const [a, setA] = useState(true)
      const [b, setB] = useState(true)
      return (
        <>
          {a && <Sheet name="Dessous" onClose={() => (closeBottom(), setA(false))} />}
          {b && <Sheet name="Dessus" onClose={() => (closeTop(), setB(false))} />}
        </>
      )
    }
    render(<Stack />)
    await waitFor(() => expect(depth()).toBe(2))

    act(() => window.history.back())
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dessus' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Dessous' })).toBeInTheDocument()
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
    expect(depth()).toBe(1)

    act(() => window.history.back())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(depth()).toBe(0)
    expect(url()).toBe(base)
  })

  it('fiches empilées : la croix de celle du dessus retire une seule entrée', async () => {
    function Stack() {
      const [b, setB] = useState(true)
      return (
        <>
          <Sheet name="Dessous" onClose={() => {}} />
          {b && <Sheet name="Dessus" onClose={() => setB(false)} />}
        </>
      )
    }
    render(<Stack />)
    await waitFor(() => expect(depth()).toBe(2))
    await userEvent.click(screen.getAllByRole('button', { name: 'Fermer' })[1])
    await waitFor(() => expect(depth()).toBe(1))
    expect(screen.getByRole('dialog', { name: 'Dessous' })).toBeInTheDocument()
  })

  it('une fiche qui en remplace une autre dans le même rendu (recette → renommage) ne touche pas à l’historique', async () => {
    function Swap() {
      const [renaming, setRenaming] = useState(false)
      return renaming ? (
        <Sheet name="Renommer" onClose={() => setRenaming(false)} />
      ) : (
        <Sheet name="Recette" onClose={() => {}} />
      )
    }
    const { rerender } = render(<Swap />)
    await waitFor(() => expect(depth()).toBe(1))
    const push = vi.spyOn(window.history, 'pushState')
    const go = vi.spyOn(window.history, 'go')
    // Le parent remplace la fiche : on change le nom du composant affiché dans le même rendu
    rerender(<Sheet name="Renommer" onClose={() => {}} />)
    await sheetHistorySettled()
    expect(push).not.toHaveBeenCalled()
    expect(go).not.toHaveBeenCalled()
    expect(depth()).toBe(1)
  })

  it('si le parent refuse la fermeture (opération en cours), la fiche reste ouverte et l’entrée est rétablie', async () => {
    const refuse = { current: true }
    render(<Host refuse={refuse} />)
    await waitFor(() => expect(depth()).toBe(1))
    act(() => window.history.back())
    await waitFor(() => expect(depth()).toBe(1)) // entrée remise
    expect(screen.getByRole('dialog', { name: 'Fiche' })).toBeInTheDocument()
    // La fermeture fonctionne ensuite normalement
    refuse.current = false
    act(() => window.history.back())
    expect(await screen.findByText('Fiche fermée')).toBeInTheDocument()
    expect(depth()).toBe(0)
  })

  it('navigation vers un autre écran pendant qu’une fiche est ouverte : aucune entrée orpheline ne reste sous le nouvel écran', async () => {
    const { unmount } = render(<Host />)
    await waitFor(() => expect(depth()).toBe(1))
    // L'écran change (adresse différente) : la fiche disparaît avec lui
    act(() => {
      window.location.hash = '#/autre'
      unmount()
    })
    await sheetHistorySettled()
    expect(url()).toContain('#/autre')
    expect(depth()).toBe(0)
    // « Retour » depuis le nouvel écran : on retombe sur l’entrée « fiche » orpheline, qui est sautée aussitôt
    act(() => window.history.back())
    await waitFor(() => expect(url()).toBe(base))
    await sheetHistorySettled()
    expect(depth()).toBe(0)
  })

  it('un navigateur qui refuse pushState : les fiches fonctionnent comme avant, sans erreur', async () => {
    vi.spyOn(window.history, 'pushState').mockImplementation(() => {
      throw new DOMException('refusé', 'SecurityError')
    })
    render(<Host />)
    await sheetHistorySettled()
    expect(depth()).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(await screen.findByText('Fiche fermée')).toBeInTheDocument()
  })
})
