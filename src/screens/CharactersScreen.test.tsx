import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { CHARACTERS } from '../data/characters'
import { commit, resetStoreForTests } from '../lib/db'
import { loadVillagers } from '../features/villagers/storage'

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const SORTED_LIST = 'Triés par niveau d’amitié'
const firstNames = (n: number) =>
  within(screen.getByRole('list', { name: SORTED_LIST }))
    .getAllByRole('button')
    .slice(0, n)
    .map((b) => CHARACTERS.find((c) => b.textContent!.startsWith(c.name))?.id)
const count = () => screen.getByTestId('villagers-count').textContent

async function openScreen() {
  render(<App />)
  await go('#/personnages')
  await screen.findByRole('heading', { name: 'Habitants' })
}

describe('Habitants : tri par amitié et filtre « pas encore niveau 10 »', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
  })
  afterEach(() => vi.restoreAllMocks())

  it('par défaut : par extension, aucun filtre actif, inversion indisponible', async () => {
    await openScreen()
    expect(screen.getByRole('list', { name: 'Vallée (jeu de base)' })).toBeInTheDocument()
    expect(screen.queryByTestId('active-filters')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Inverser le tri/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '❤️ Amitié < 10' })).toHaveAttribute('aria-pressed', 'false')
    // Les filtres et la recherche existants sont toujours là
    expect(screen.getByRole('group', { name: 'Filtrer les habitants' })).toBeInTheDocument()
    expect(screen.getByLabelText('Rechercher par nom')).toBeInTheDocument()
  })

  it('tri du plus faible au plus élevé, inversé, puis retour à l’ordre par extension', async () => {
    const user = userEvent.setup()
    await commit({
      set: [['villagers', { aladdin: { unlocked: true, friendship: 7 }, jasmine: { unlocked: true, friendship: 2 }, alice: { unlocked: true }, belle: { friendship: 9 } }]],
    })
    await openScreen()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier' }), 'friendship')
    expect(await screen.findByRole('list', { name: SORTED_LIST })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Vallée (jeu de base)' })).not.toBeInTheDocument()
    // Faible → élevée ; puis les niveaux non renseignés ; Belle (non débloquée) ne montre pas son 9
    expect(firstNames(3)).toEqual(['jasmine', 'aladdin', 'alice'])
    expect(within(screen.getByRole('list', { name: SORTED_LIST })).getByRole('button', { name: /^Jasmine/ })).toHaveTextContent('❤️ 2')
    expect(screen.getByRole('button', { name: 'Retirer : Tri : Amitié (Faible → élevée)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inverser le tri (actuellement : Faible → élevée)' }))
    expect(firstNames(3)).toEqual(['aladdin', 'jasmine', 'alice'])
    expect(screen.getByRole('button', { name: 'Inverser le tri (actuellement : Élevée → faible)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Retirer : Tri/ }))
    expect(screen.getByRole('list', { name: 'Vallée (jeu de base)' })).toBeInTheDocument()
    expect(screen.queryByTestId('active-filters')).not.toBeInTheDocument()
  })

  it('« Amitié < 10 » : débloqués aux niveaux 1 à 9 ou non renseignés, jamais le niveau 10 ni les non débloqués', async () => {
    const user = userEvent.setup()
    await commit({
      set: [['villagers', { aladdin: { unlocked: true, friendship: 10 }, jasmine: { unlocked: true, friendship: 9 }, alice: { unlocked: true }, belle: { friendship: 3 } }]],
    })
    await openScreen()
    expect(count()).toBe(`${CHARACTERS.length} habitants`)
    await user.click(screen.getByRole('button', { name: '❤️ Amitié < 10' }))
    expect(screen.getByRole('button', { name: '❤️ Amitié < 10' })).toHaveAttribute('aria-pressed', 'true')
    expect(count()).toContain('2 habitants')
    const list = screen.getByRole('list', { name: 'Vallée (jeu de base)' })
    expect(within(list).getByRole('button', { name: /^Jasmine/ })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /^Alice/ })).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: /^Aladdin/ })).not.toBeInTheDocument() // niveau 10
    expect(within(list).queryByRole('button', { name: /^Belle/ })).not.toBeInTheDocument() // non débloquée
    expect(screen.getByRole('button', { name: /^Retirer : ❤️ Amitié < 10/ })).toBeInTheDocument()

    // Avec le tri par amitié : le plus avancé d'abord, les non renseignés ensuite
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier' }), 'friendship')
    await user.click(screen.getByRole('button', { name: /^Inverser le tri/ }))
    expect(firstNames(2)).toEqual(['jasmine', 'alice'])
  })

  it('se combine avec la recherche et avec un filtre existant (métier), puis « Tout réinitialiser » rend l’affichage complet', async () => {
    const user = userEvent.setup()
    await commit({
      set: [
        ['assignments', { jasmine: 'fishing', alice: 'gardening' }],
        ['villagers', { jasmine: { unlocked: true, friendship: 4 }, alice: { unlocked: true, friendship: 10 }, aladdin: { unlocked: true, friendship: 1 } }],
      ],
    })
    await openScreen()
    await user.click(screen.getByRole('button', { name: '❤️ Amitié < 10' }))
    await user.click(screen.getByRole('button', { name: /^🎣 Pêche$/ }))
    expect(count()).toContain('1 habitant ')
    expect(within(screen.getByRole('list', { name: 'Vallée (jeu de base)' })).getByRole('button', { name: /^Jasmine/ })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Rechercher par nom'), 'zzz')
    expect(screen.getByText('Aucun habitant ne correspond.')).toBeInTheDocument()
    const active = screen.getByTestId('active-filters')
    expect(within(active).getAllByRole('button').map((b) => b.textContent)).toEqual(['Recherche : « zzz » ✕', '🎣 Pêche ✕', '❤️ Amitié < 10 ✕', 'Tout réinitialiser'])

    await user.click(within(active).getByRole('button', { name: 'Tout réinitialiser' }))
    expect(count()).toBe(`${CHARACTERS.length} habitants`)
    expect(screen.getByLabelText('Rechercher par nom')).toHaveValue('')
    expect(screen.getByRole('button', { name: '❤️ Amitié < 10' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('active-filters')).not.toBeInTheDocument()
  })

  it('monter un habitant au niveau 10 depuis sa fiche le retire aussitôt de la liste filtrée', async () => {
    const user = userEvent.setup()
    await commit({ set: [['villagers', { jasmine: { unlocked: true, friendship: 9 } }]] })
    await openScreen()
    await user.click(screen.getByRole('button', { name: '❤️ Amitié < 10' }))
    await user.click(within(screen.getByRole('list', { name: 'Vallée (jeu de base)' })).getByRole('button', { name: /^Jasmine/ }))
    const sheet = screen.getByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: 'Augmenter : Niveau d’amitié' }))
    expect(within(sheet).getByRole('status', { name: 'Niveau d’amitié' })).toHaveTextContent('Niveau 10 (max)')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Jasmine/ })).not.toBeInTheDocument())
    expect((await loadVillagers()).jasmine?.friendship).toBe(10)
  })

  it('le tri n’écrit rien : les données des habitants restent identiques', async () => {
    const user = userEvent.setup()
    const seed = { aladdin: { unlocked: true, friendship: 7, askedItem: true }, jasmine: { unlocked: true } }
    await commit({ set: [['villagers', seed]] })
    await openScreen()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier' }), 'friendship')
    await user.click(screen.getByRole('button', { name: '❤️ Amitié < 10' }))
    await user.click(screen.getByRole('button', { name: /^Inverser le tri/ }))
    expect(await loadVillagers()).toEqual(seed)
  })
})
