import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../../App'
import { commit, resetStoreForTests } from '../../lib/db'
import { loadNames } from '../../lib/names'
import { loadRecipes } from './storage'

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
const rows = () => screen.queryAllByTestId('recipe-row')
const count = () => screen.getByTestId('recipes-count').textContent
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<App />)
  await go('#/collection/recettes')
  await screen.findByRole('heading', { name: 'Recettes' })
  await screen.findByLabelText('Rechercher une recette')
  void user
}

describe('Recettes', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
  })

  it('charge le catalogue à la demande et affiche 480 recettes (60 à la fois)', async () => {
    const user = userEvent.setup()
    await open(user)
    expect(count()).toBe('480 recettes')
    expect(rows()).toHaveLength(60)
    await user.click(screen.getByRole('button', { name: /Afficher plus/ }))
    expect(rows()).toHaveLength(120)
    expect(screen.getByTestId('recipes-progress')).toHaveTextContent('0 connue sur 480 · 0 favorite')
  })

  it('recherche en français et en anglais', async () => {
    const user = userEvent.setup()
    await open(user)
    const search = screen.getByLabelText('Rechercher une recette')
    await user.type(search, 'gaufres')
    expect(within(rows()[0]).getByRole('button', { name: /Ouvrir/ }).getAttribute('aria-label')).toMatch(/Gaufres/i)
    await user.clear(search)
    await user.type(search, 'waffles')
    expect(rows().length).toBeGreaterThanOrEqual(1)
    await user.clear(search)
    await user.type(search, 'zzzz')
    expect(screen.getByText('Aucune recette ne correspond.')).toBeInTheDocument()
  })

  it('cocher « connue » enregistre, se synchronise avec le résumé et la carte Collection', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Rechercher une recette'), 'waffles')
    await user.click(within(rows()[0]).getByRole('checkbox', { name: /^Connue/ }))
    await waitFor(async () => expect(Object.keys((await loadRecipes()).known)).toEqual(['waffles']))
    expect(screen.getByTestId('recipes-progress')).toHaveTextContent('1 connue sur 480')
    await user.click(screen.getByRole('button', { name: /✓ Connues \(1\)/ }))
    expect(count()).toBe('1 recette')
    await go('#/collection')
    expect(await screen.findByTestId('recipes-card-progress')).toHaveTextContent('1 connue sur 480')
  })

  it('favorites, filtres de type, d’origine et d’étoiles', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.click(screen.getByRole('button', { name: 'DLC' }))
    expect(count()).toBe('261 recettes')
    await user.click(screen.getByRole('button', { name: '🍰 Desserts' }))
    expect(count()).toBe('77 recettes')
    await user.click(screen.getByRole('button', { name: '★★★★★' }))
    const n = rows().length
    expect(n).toBeGreaterThan(0)
    await user.click(within(rows()[0]).getByRole('button', { name: /^Favorite/ }))
    await waitFor(async () => expect(Object.keys((await loadRecipes()).favorites)).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: /★ Favorites \(1\)/ }))
    expect(count()).toBe('1 recette')
  })

  it('tri par prix de vente décroissant', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.selectOptions(screen.getByLabelText('Trier par'), 'sell')
    await user.click(screen.getByRole('button', { name: 'Ordre croissant' }))
    expect(within(rows()[0]).getByText(/5[\s ]?038/)).toBeInTheDocument() // Lightning Bolt
  })

  it('fiche : ingrédients obligatoires, choix en une seule place, origine DLC, nom à confirmer', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Rechercher une recette'), 'Waffles')
    await user.click(within(rows()[0]).getByRole('button', { name: /Ouvrir/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByTestId('slot-fixed')).toHaveLength(3)
    const choice = within(dialog).getByTestId('slot-choice')
    expect(choice).toHaveTextContent('1 × au choix')
    expect(choice).toHaveTextContent('Un seul ingrédient à choisir')
    expect(within(dialog).getByTestId('name-kind').textContent).toMatch(/guide/)
    expect(within(dialog).getByText('Jeu de base')).toBeInTheDocument()
    expect(within(dialog).getByTestId('known-toggle')).toHaveAttribute('aria-pressed', 'false')
    await user.click(within(dialog).getByTestId('known-toggle'))
    await waitFor(() => expect(within(dialog).getByTestId('known-toggle')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('une recette sans nom français reste visible en anglais « À confirmer »', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Rechercher une recette'), "Pooh's Birthday Cake")
    expect(rows()).toHaveLength(1)
    expect(within(rows()[0]).getByText('À confirmer')).toBeInTheDocument()
  })

  it('filtre par ingrédient : recettes où il est exigé ou simplement possible', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Filtrer par ingrédient'), 'bass')
    await user.click(within(await screen.findByRole('list', { name: 'Ingrédients proposés' })).getAllByRole('button')[0])
    expect(screen.getByTestId('ingredient-filter')).toHaveTextContent('exigé ou possible')
    const exigeOuPossible = Number(count()!.split(' ')[0])
    expect(exigeOuPossible).toBeGreaterThan(5)
    await user.click(screen.getByRole('button', { name: 'Retirer le filtre d’ingrédient' }))
    expect(count()).toBe('480 recettes')
  })

  it('renommer une recette : le nom personnalisé est cherchable et ne devient pas un nom officiel', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Rechercher une recette'), 'waffles')
    await user.click(within(rows()[0]).getByRole('button', { name: /Ouvrir/ }))
    await user.click(await screen.findByRole('button', { name: /Mon nom/ }))
    await user.type(screen.getByLabelText('Mon nom'), 'Gaufres de Nanie')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect((await loadNames())['recipe:waffles']).toBe('Gaufres de Nanie'))
    await user.clear(screen.getByLabelText('Rechercher une recette'))
    await user.type(screen.getByLabelText('Rechercher une recette'), 'nanie')
    expect(rows()).toHaveLength(1)
    expect(within(rows()[0]).getByText('Mon nom')).toBeInTheDocument()
  })

  it('minima : « dès X » dans la liste, « à partir de X » dans la fiche ; valeur exacte seulement si le wiki le dit', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Rechercher une recette'), 'coffee')
    expect(within(rows()[0]).getByText(/dès 43/)).toBeInTheDocument()
    await user.click(within(rows()[0]).getByRole('button', { name: /Ouvrir/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('sell')).toHaveTextContent('à partir de 43')
    expect(within(dialog).getByTestId('energy')).toHaveTextContent('à partir de 730')
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    const search = screen.getByLabelText('Rechercher une recette')
    await user.clear(search)
    await user.type(search, 'lobster roll')
    await user.click(within(rows()[0]).getByRole('button', { name: /Ouvrir/ }))
    const exact = await screen.findByRole('dialog')
    expect(within(exact).getByTestId('sell')).toHaveTextContent(/^1[\s ]959$/)
    expect(within(exact).getByTestId('energy')).not.toHaveTextContent('à partir de')
  })

  it('« Any Meat » : la composition déduite est signalée « à confirmer » dans la fiche et le filtre', async () => {
    const user = userEvent.setup()
    await open(user)
    await user.type(screen.getByLabelText('Rechercher une recette'), 'burrito')
    await user.click(within(rows()[0]).getByRole('button', { name: /Ouvrir/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('unconfirmed')).toHaveTextContent('composition à confirmer')
    expect(within(dialog).getByText(/NON vérifiée/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    await user.clear(screen.getByLabelText('Rechercher une recette'))
    await user.type(screen.getByLabelText('Filtrer par ingrédient'), 'pork')
    await user.click(within(await screen.findByRole('list', { name: 'Ingrédients proposés' })).getAllByRole('button')[0])
    expect(screen.getByTestId('unconfirmed-group')).toBeInTheDocument()
  })

  it('les recettes connues déjà enregistrées sont affichées au chargement', async () => {
    await commit({ set: [['recipes', { known: { waffles: '2026-11-09T10:00:00.000Z', coffee: '2026-11-09T10:00:00.000Z' }, favorites: {} }]] })
    const user = userEvent.setup()
    await open(user)
    expect(screen.getByTestId('recipes-progress')).toHaveTextContent('2 connues sur 480')
  })
})
