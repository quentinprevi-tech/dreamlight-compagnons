import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { resetStoreForTests } from './lib/storage'

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

async function openCharacter(user: ReturnType<typeof userEvent.setup>, name: string) {
  await go('#/personnages')
  const search = await screen.findByLabelText('Rechercher par nom')
  await user.clear(search)
  await user.type(search, name)
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
  return screen.getByRole('dialog')
}

describe('Dreamlight Compagnons', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
  })

  it('affiche les sept métiers avec un compteur à zéro', async () => {
    render(<App />)
    for (const name of ['Pêche', 'Jardinage', 'Extraction', 'Cueillette', 'Excavation', 'Chasse aux anigamis', 'Courbage temporel']) {
      expect(await screen.findByText(name)).toBeInTheDocument()
    }
    expect(screen.getByTestId('count-fishing')).toHaveTextContent('0')
  })

  it('attribue, modifie et retire un métier, et le conserve après redémarrage', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    // Attribution
    let dialog = await openCharacter(user, 'Dingo')
    await user.click(within(dialog).getByRole('button', { name: /Pêche/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    dialog = await openCharacter(user, 'Vaiana')
    await user.click(within(dialog).getByRole('button', { name: /Pêche/ }))

    await go('#/')
    expect(await screen.findByTestId('count-fishing')).toHaveTextContent('2')

    // Page du métier
    await go('#/metier/fishing')
    const list = await screen.findByRole('list', { name: 'Habitants : Pêche' })
    expect(within(list).getByRole('button', { name: /^Dingo/ })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /^Vaiana/ })).toBeInTheDocument()

    // Modification : un seul métier par personnage
    dialog = await openCharacter(user, 'Dingo')
    expect(within(dialog).getByRole('button', { name: /Pêche/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(dialog).getByRole('button', { name: /Jardinage/ }))
    await go('#/')
    expect(await screen.findByTestId('count-fishing')).toHaveTextContent('1')
    expect(screen.getByTestId('count-gardening')).toHaveTextContent('1')

    // Suppression
    dialog = await openCharacter(user, 'Vaiana')
    await user.click(within(dialog).getByRole('button', { name: /Aucun métier/ }))
    await go('#/')
    expect(await screen.findByTestId('count-fishing')).toHaveTextContent('0')

    // Redémarrage : les données sont relues depuis IndexedDB
    await new Promise((r) => setTimeout(r, 50))
    unmount()
    resetStoreForTests()
    render(<App />)
    expect(await screen.findByTestId('count-gardening')).toHaveTextContent('1')
    expect(screen.getByTestId('count-fishing')).toHaveTextContent('0')
  })

  it('filtre les habitants par métier et ajoute depuis la page du métier', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/metier/mining')
    await user.click(await screen.findByRole('button', { name: '+ Ajouter des habitants' }))
    const picker = screen.getByRole('dialog', { name: 'Ajouter à Extraction' })
    await user.type(within(picker).getByLabelText('Rechercher un habitant à ajouter'), 'elsa')
    await user.click(within(picker).getByRole('button', { name: /^Elsa/ }))
    await user.click(within(picker).getByRole('button', { name: 'Terminé' }))
    expect(within(await screen.findByRole('list', { name: 'Habitants : Extraction' })).getByText('Elsa')).toBeInTheDocument()

    await go('#/personnages')
    await user.click(await screen.findByRole('button', { name: '⛏️ Extraction' }))
    expect(screen.getByText('1 habitant')).toBeInTheDocument()
    expect(screen.getByText('Elsa')).toBeInTheDocument()
  })

  it('affiche la Numismagie avec filtre par niveau, recherche et détail', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: /Numismagie/ }))
    expect(await screen.findByTestId('scramble-count')).toHaveTextContent('74 adversaires sur 74 recensés')
    const list = screen.getByRole('list', { name: 'Adversaires de Numismagie' })
    expect(within(list).getAllByRole('button')).toHaveLength(74)

    // Filtre par niveau : chaque carte visible est du bon niveau
    const filters = screen.getByRole('group', { name: 'Filtrer par niveau' })
    await user.click(within(filters).getByRole('button', { name: /Difficile/ }))
    const hard = within(list).getAllByRole('button')
    expect(hard.length).toBeGreaterThan(0)
    for (const card of hard) expect(card).toHaveTextContent('Niveau 3')
    expect(screen.getByTestId('scramble-count')).toHaveTextContent(`${hard.length} adversaires sur 74`)

    // Recherche combinée au filtre
    await user.type(screen.getByLabelText('Rechercher un adversaire'), 'dingo')
    expect(screen.getByText('Aucun adversaire ne correspond.')).toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: /^Tous/ }))
    const goofy = within(list).getByRole('button', { name: /Dingo/ })
    expect(goofy).toHaveTextContent('Niveau 1')

    // Détail : les 5 figurines
    await user.click(goofy)
    expect(goofy).toHaveAttribute('aria-expanded', 'true')
    expect(within(goofy).getAllByText('Dingo').length).toBeGreaterThanOrEqual(5)
  })
})
