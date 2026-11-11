import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

const touch = (y: number, x = 100) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] })

function Demo({ onClose, closeButton }: { onClose: () => void; closeButton?: boolean }) {
  return (
    <BottomSheet onClose={onClose} label="Détail" panelClassName="bg-white overflow-y-auto" closeButton={closeButton}>
      <h2>Titre</h2>
      <input aria-label="Champ" />
    </BottomSheet>
  )
}

describe('BottomSheet : fermetures', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.style.overflow = ''
  })

  it('la croix « Fermer » est visible et ferme la fiche', async () => {
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('un clic à côté (fond sombre) ferme la fiche ; il n’est pas annoncé deux fois aux lecteurs d’écran', async () => {
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    expect(screen.getAllByRole('button', { name: 'Fermer' })).toHaveLength(1)
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Échap ferme la fiche', async () => {
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closeButton={false} retire la croix (la fiche a son propre bouton) mais pas les autres fermetures', async () => {
    const onClose = vi.fn()
    render(<Demo onClose={onClose} closeButton={false} />)
    expect(screen.queryByRole('button', { name: 'Fermer' })).toBeNull()
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('deux fiches superposées : Échap ne ferme que celle du dessus', async () => {
    const closeBottom = vi.fn()
    const closeTop = vi.fn()
    render(
      <>
        <Demo onClose={closeBottom} />
        <Demo onClose={closeTop} />
      </>,
    )
    await userEvent.keyboard('{Escape}')
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeBottom).not.toHaveBeenCalled()
  })

  it('une fiche qui refuse de se fermer (parent) reste fermable ensuite', async () => {
    let allow = false
    const onClose = vi.fn(() => {
      if (!allow) return
    })
    render(<Demo onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    allow = true
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('deux fiches superposées fermées dans le désordre : la page se débloque à la fermeture de la dernière', () => {
    function Two({ showA, showB }: { showA: boolean; showB: boolean }) {
      return (
        <>
          {showA && <Demo onClose={() => {}} />}
          {showB && <Demo onClose={() => {}} />}
        </>
      )
    }
    const { rerender } = render(<Two showA showB />)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Two showA={false} showB />) // la plus ancienne part en premier
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Two showA={false} showB={false} />)
    expect(document.body.style.overflow).toBe('')
  })

  it('le défilement de la page est bloqué pendant que la fiche est ouverte, puis rétabli', () => {
    const { unmount } = render(<Demo onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('BottomSheet : glissement vers le bas', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.style.overflow = ''
  })

  const drag = (el: Element, from: number, to: number, x = 100) => {
    fireEvent.touchStart(el, touch(from, x))
    fireEvent.touchMove(el, touch(from + (to - from) / 2, x))
    fireEvent.touchMove(el, touch(to, x))
  }

  it('un long glissement depuis la poignée ferme la fiche (après l’animation de sortie)', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const handle = screen.getByTestId('sheet-handle')
    drag(handle, 100, 300)
    fireEvent.touchEnd(handle, touch(300))
    expect(onClose).not.toHaveBeenCalled() // animation de sortie en cours
    act(() => void vi.advanceTimersByTime(250))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('un court glissement lent remet la fiche en place sans la fermer', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const handle = screen.getByTestId('sheet-handle')
    drag(handle, 100, 140)
    fireEvent.touchEnd(handle, touch(140))
    act(() => void vi.advanceTimersByTime(1000))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('sheet-mover').style.transform).toBe('')
  })

  it('un glissement vers le haut depuis la poignée ne ferme rien', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const handle = screen.getByTestId('sheet-handle')
    drag(handle, 300, 100)
    fireEvent.touchEnd(handle, touch(100))
    act(() => void vi.advanceTimersByTime(1000))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('depuis le contenu : ferme seulement quand le contenu est tout en haut', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const title = screen.getByRole('heading', { name: 'Titre' })
    const panel = title.parentElement!
    // contenu déjà défilé : le glissement appartient au défilement, la fiche ne bouge pas
    Object.defineProperty(panel, 'scrollTop', { value: 50, configurable: true })
    drag(title, 100, 400)
    fireEvent.touchEnd(title, touch(400))
    act(() => void vi.advanceTimersByTime(1000))
    expect(onClose).not.toHaveBeenCalled()
    // contenu tout en haut : le glissement ferme
    Object.defineProperty(panel, 'scrollTop', { value: 0, configurable: true })
    drag(title, 100, 400)
    fireEvent.touchEnd(title, touch(400))
    act(() => void vi.advanceTimersByTime(250))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('un geste commencé dans un champ de saisie garde son comportement habituel', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const field = screen.getByLabelText('Champ')
    drag(field, 100, 400)
    fireEvent.touchEnd(field, touch(400))
    act(() => void vi.advanceTimersByTime(1000))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('un geste plutôt horizontal est ignoré', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const handle = screen.getByTestId('sheet-handle')
    fireEvent.touchStart(handle, touch(100, 50))
    fireEvent.touchMove(handle, touch(160, 300))
    fireEvent.touchEnd(handle, touch(160, 300))
    act(() => void vi.advanceTimersByTime(1000))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('si le parent refuse de fermer après un glissement, la fiche revient à sa place', () => {
    vi.useFakeTimers()
    const onClose = vi.fn() // ne démonte rien : équivaut à un refus
    render(<Demo onClose={onClose} />)
    const handle = screen.getByTestId('sheet-handle')
    const mover = screen.getByTestId('sheet-mover')
    drag(handle, 100, 300)
    fireEvent.touchEnd(handle, touch(300))
    act(() => void vi.advanceTimersByTime(260))
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(100))
    expect(mover.style.transform).toBe('')
  })

  it('la fiche se démonte proprement pendant un glissement (aucune erreur ni minuterie qui traîne)', () => {
    vi.useFakeTimers()
    function Host() {
      const [open, setOpen] = useState(true)
      return open ? <Demo onClose={() => setOpen(false)} /> : <p>fermée</p>
    }
    render(<Host />)
    const handle = screen.getByTestId('sheet-handle')
    drag(handle, 100, 300)
    fireEvent.touchEnd(handle, touch(300))
    act(() => void vi.advanceTimersByTime(300))
    expect(screen.getByText('fermée')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('BottomSheet : accessibilité', () => {
  function Page({ children }: { children?: ReactNode }) {
    return (
      <>
        <div id="root">
          <button>Ouvrir la fiche</button>
          <button>Autre bouton de la page</button>
        </div>
        {children}
      </>
    )
  }

  function Opener({ extra, autoFocusField }: { extra?: boolean; autoFocusField?: boolean }) {
    const [open, setOpen] = useState(false)
    return (
      <Page>
        <button data-testid="opener" onClick={() => setOpen(true)}>
          Ouvrir
        </button>
        {open && (
          <BottomSheet onClose={() => setOpen(false)} labelledBy="t" panelClassName="bg-white">
            <h2 id="t">Titre</h2>
            <button>Premier</button>
            <input aria-label="Champ" autoFocus={autoFocusField} />
            <button disabled>Désactivé</button>
            <button>Dernier</button>
            <details>
              <summary>Plus</summary>
              <button>Caché dans la liste repliée</button>
            </details>
            {extra && <p>suite</p>}
          </BottomSheet>
        )}
      </Page>
    )
  }

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('rôle « dialog » modal, nommé par son titre ; croix nommée « Fermer » ; fond et poignée cachés des lecteurs d’écran', () => {
    render(
      <BottomSheet onClose={() => {}} labelledBy="t" panelClassName="bg-white">
        <h2 id="t">Mon titre</h2>
      </BottomSheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Mon titre' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByTestId('sheet-backdrop')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('sheet-handle')).toHaveAttribute('aria-hidden', 'true')
    expect(within(dialog).getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
  })

  it('à l’ouverture, le focus entre dans la fiche ; à la fermeture, il revient au bouton qui l’a ouverte', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    const opener = screen.getByTestId('opener')
    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Titre' })
    expect(dialog).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('un champ à autoFocus de la fiche garde le focus ; le retour se fait quand même vers l’élément d’origine', async () => {
    const user = userEvent.setup()
    render(<Opener autoFocusField />)
    await user.click(screen.getByTestId('opener'))
    expect(screen.getByLabelText('Champ')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.getByTestId('opener')).toHaveFocus()
  })

  it('Tab tourne à l’intérieur de la fiche (sans la liste repliée ni le bouton désactivé) ; Maj+Tab aussi', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByTestId('opener'))
    // Le <summary> d'une liste repliée est atteignable, pas son contenu ; le bouton désactivé non plus.
    const names = ['Fermer', 'Premier', 'Champ', 'Dernier', 'Plus']
    const focusedName = () => (document.activeElement as HTMLElement).getAttribute('aria-label') ?? document.activeElement!.textContent
    const seen: (string | null)[] = []
    for (let i = 0; i < names.length; i++) {
      await user.tab()
      seen.push(focusedName())
    }
    expect(seen).toEqual(names)
    // Après le dernier : retour au premier (jamais dans le contenu replié, ni hors de la fiche)
    await user.tab()
    expect(focusedName()).toBe('Fermer')
    await user.tab({ shift: true }) // avant le premier : le dernier
    expect(focusedName()).toBe('Plus')
    await user.tab({ shift: true })
    expect(focusedName()).toBe('Dernier')
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  it('la liste repliée devient atteignable une fois ouverte', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByTestId('opener'))
    await user.click(screen.getByText('Plus'))
    const reached: (string | null)[] = []
    for (let i = 0; i < 4; i++) {
      await user.tab()
      reached.push(document.activeElement!.textContent)
    }
    expect(reached).toContain('Caché dans la liste repliée')
  })

  it('le fond de l’application (#root) est inerte tant qu’une fiche est ouverte, puis rétabli', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    const root = document.getElementById('root')!
    expect(root).not.toHaveAttribute('inert')
    await user.click(screen.getByTestId('opener'))
    expect(root).toHaveAttribute('inert')
    await user.keyboard('{Escape}')
    expect(root).not.toHaveAttribute('inert')
  })

  it('fiches empilées : celle du dessous est inerte, celle du dessus piège le focus ; le focus revient à celle du dessous à la fermeture', async () => {
    const user = userEvent.setup()
    function Stacked() {
      const [top, setTop] = useState(false)
      return (
        <>
          <BottomSheet onClose={() => {}} label="Dessous" panelClassName="bg-white">
            <button onClick={() => setTop(true)}>Ouvrir par-dessus</button>
          </BottomSheet>
          {top && (
            <BottomSheet onClose={() => setTop(false)} label="Dessus" panelClassName="bg-white">
              <button>Dans la fiche du dessus</button>
            </BottomSheet>
          )}
        </>
      )
    }
    render(<Stacked />)
    const below = screen.getByRole('dialog', { name: 'Dessous' })
    await user.click(within(below).getByRole('button', { name: 'Ouvrir par-dessus' }))
    const above = screen.getByRole('dialog', { name: 'Dessus' })
    expect(above).toHaveFocus()
    expect(below.closest('[inert]')).not.toBeNull()
    expect(above.closest('[inert]')).toBeNull()
    for (let i = 0; i < 4; i++) {
      await user.tab()
      expect(above).toContainElement(document.activeElement as HTMLElement)
    }
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Dessus' })).toBeNull()
    expect(below.closest('[inert]')).toBeNull()
    expect(below.contains(document.activeElement)).toBe(true)
  })
})
