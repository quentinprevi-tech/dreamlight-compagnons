import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { commit, resetStoreForTests } from '../../lib/db'
import { CRITTER_VARIANTS } from './data'
import { gatherOf } from './gathering'
import { loadCritterLevels, loadCritters } from './storage'

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
const settle = () => new Promise((r) => setTimeout(r, 60))
const ALL = { eternity: true, storybook: true, wishblossom: true, honeyglow: true }
const seed = (progress: object = {}) => commit({ set: [['critters', { owned: ALL, configured: true, progress }]] })
const rows = () => screen.getAllByRole('checkbox', { name: /^Obtenu :/ })
const rowNames = () => rows().map((r) => r.getAttribute('aria-label')!.replace('Obtenu : ', ''))
const sorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))

describe('Animaux : tri, filtre par capacité de collecte et niveau du compagnon', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('tri alphabétique A → Z, inversé Z → A, puis retour à l’ordre par biome', async () => {
    const user = userEvent.setup()
    await seed()
    render(<App />)
    await go('#/collection/animaux')
    await screen.findByRole('heading', { name: 'Animaux' })
    expect(screen.getByTestId('biome-peaceful-meadow')).toBeInTheDocument()
    expect(screen.queryByTestId('critters-sorted')).not.toBeInTheDocument()
    // Ordre par défaut : le bouton d'inversion n'a pas de sens
    expect(screen.getByRole('button', { name: /^Inverser le tri/ })).toBeDisabled()
    expect(screen.queryByTestId('active-filters')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier' }), 'name')
    expect(await screen.findByTestId('critters-sorted')).toBeInTheDocument()
    expect(screen.queryByTestId('biome-peaceful-meadow')).not.toBeInTheDocument()
    const asc = rowNames()
    expect(asc).toHaveLength(90)
    expect(asc).toEqual(sorted(asc))
    expect(screen.getByRole('heading', { name: /Triés par nom \(A → Z\)/ })).toBeInTheDocument()
    expect(within(screen.getByTestId('active-filters')).getByRole('button', { name: 'Retirer : Tri : Nom (A → Z)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inverser le tri (actuellement : A → Z)' }))
    expect(rowNames()).toEqual([...asc].reverse())
    expect(screen.getByRole('heading', { name: /Triés par nom \(Z → A\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inverser le tri (actuellement : Z → A)' })).toBeInTheDocument()

    // Retrait du tri depuis le rappel des filtres actifs
    await user.click(screen.getByRole('button', { name: 'Retirer : Tri : Nom (Z → A)' }))
    expect(screen.queryByTestId('critters-sorted')).not.toBeInTheDocument()
    expect(screen.getByTestId('biome-peaceful-meadow')).toBeInTheDocument()
    expect(screen.queryByTestId('active-filters')).not.toBeInTheDocument()
  })

  it('le tri se combine avec la recherche et les filtres « À obtenir » / « Obtenus »', async () => {
    const user = userEvent.setup()
    await seed({ 'black-rabbit': { obtained: true } })
    render(<App />)
    await go('#/collection/animaux')
    await screen.findByRole('heading', { name: 'Animaux' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier' }), 'name')
    await user.type(screen.getByLabelText('Rechercher un animal'), 'lapin')
    // « lapin » trouve aussi le White Rabbit : la recherche porte sur le nom de l'espèce
    expect(rowNames()).toEqual(['Lapin brun', 'Lapin calico', 'Lapin classique', 'Lapin noir', 'White Rabbit'])
    await user.click(screen.getByRole('button', { name: 'Obtenus' }))
    expect(rowNames()).toEqual(['Lapin noir'])
    await user.click(screen.getByRole('button', { name: 'À obtenir' }))
    expect(rowNames()).toEqual(['Lapin brun', 'Lapin calico', 'Lapin classique', 'White Rabbit'])
    const active = screen.getByTestId('active-filters')
    expect(within(active).getAllByRole('button').map((b) => b.textContent)).toEqual(['Recherche : « lapin » ✕', 'À obtenir ✕', 'Tri : Nom (A → Z) ✕', 'Tout réinitialiser'])
  })

  it('filtre par capacité de collecte : Fruits, Non renseignée, rappel du filtre actif et retour à tout afficher', async () => {
    const user = userEvent.setup()
    await seed()
    render(<App />)
    await go('#/collection/animaux')
    await screen.findByRole('heading', { name: 'Animaux' })
    expect(rows()).toHaveLength(90)
    expect(screen.queryByTestId('gather-note')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '🍎 Fruits' }))
    expect(rowNames().sort()).toEqual(['Écureuil noir', 'Écureuil classique', 'Écureuil gris', 'Red Squirrel', 'White Squirrel'].sort())
    expect(screen.getByTestId('gather-note')).toHaveTextContent('Donnée provisoire')
    expect(screen.getByTestId('gather-note')).toHaveTextContent('à confirmer avec le wiki')
    expect(within(screen.getByTestId('gather-note')).getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '🍎 Fruits' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByTestId('active-filters')).getByRole('button', { name: 'Retirer : Collecte : 🍎 Fruits' })).toBeInTheDocument()

    // Capacité non renseignée : espèces non couvertes + variante contradictoire
    await user.click(screen.getByRole('button', { name: '❔ Non renseignée' }))
    const unknownCount = CRITTER_VARIANTS.filter((v) => gatherOf(v) === undefined).length
    expect(unknownCount).toBeGreaterThan(0)
    expect(rows()).toHaveLength(unknownCount)
    expect(screen.getByTestId('gather-note')).toHaveTextContent('Non renseignée')

    // Combinaison avec la recherche, puis retour à l'affichage complet
    await user.click(screen.getByRole('button', { name: '🍎 Fruits' }))
    await user.type(screen.getByLabelText('Rechercher un animal'), 'renard')
    expect(screen.getByText('Aucun animal ne correspond.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tout afficher' }))
    expect(rows()).toHaveLength(90)
    expect(screen.getByLabelText('Rechercher un animal')).toHaveValue('')
    expect(screen.queryByTestId('active-filters')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Toutes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filtre de capacité : chaque type de la liste retrouve exactement ses animaux (pas d’invention)', async () => {
    const user = userEvent.setup()
    await seed()
    render(<App />)
    await go('#/collection/animaux')
    await screen.findByRole('heading', { name: 'Animaux' })
    await user.click(screen.getByRole('button', { name: '🐟 Poissons' }))
    const expected = CRITTER_VARIANTS.filter((v) => gatherOf(v) === 'fish').map((v) => v.species)
    expect(new Set(expected)).toEqual(new Set(['fox', 'crocodile']))
    expect(rows()).toHaveLength(expected.length)
    expect(screen.getByTestId('biome-glade-of-trust')).toBeInTheDocument() // les crocodiles
    expect(screen.getByTestId('biome-frosted-heights')).toBeInTheDocument() // les renards
    expect(screen.queryByTestId('biome-plaza')).not.toBeInTheDocument()
  })

  it('niveau du compagnon : désactivé tant que l’animal n’est pas obtenu, 1 à 5, effaçable, visible dans la liste et conservé après redémarrage', async () => {
    const user = userEvent.setup()
    await seed()
    const { unmount } = render(<App />)
    await go('#/collection/animaux')
    await user.click(await screen.findByRole('button', { name: /^Lapin noir/ }))
    let sheet = screen.getByRole('dialog', { name: 'Lapin noir' })
    const level = () => within(sheet).getByRole('status', { name: 'Niveau du compagnon' })
    expect(level()).toHaveTextContent('Non renseigné')
    expect(within(sheet).getByRole('button', { name: 'Augmenter : Niveau du compagnon' })).toBeDisabled()
    expect(within(sheet).getByText('Coche « Obtenu » pour suivre le niveau de ce compagnon.')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('checkbox', { name: /Obtenu/ }))
    const up = within(sheet).getByRole('button', { name: 'Augmenter : Niveau du compagnon' })
    expect(up).toBeEnabled()
    await user.click(up)
    expect(level()).toHaveTextContent('Niveau 1')
    await user.click(up)
    await user.click(up)
    expect(level()).toHaveTextContent('Niveau 3')
    // Jamais au-delà de 5
    await user.click(up)
    await user.click(up)
    expect(level()).toHaveTextContent('Niveau 5 (max)')
    expect(up).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: 'Baisser : Niveau du compagnon' }))
    expect(level()).toHaveTextContent('Niveau 4')
    await user.keyboard('{Escape}')

    // Affichage cohérent avec les habitants : pastille ❤️ dans la liste
    const badge = within(screen.getByRole('button', { name: /^Lapin noir/ })).getByTestId('critter-level')
    expect(badge).toHaveTextContent('❤️ 4/5')
    expect(badge).toHaveAccessibleName('Niveau 4 sur 5')
    // Un autre animal n'est pas touché
    expect(screen.getAllByTestId('critter-level')).toHaveLength(1)

    // Redémarrage : le niveau est conservé
    await settle()
    unmount()
    resetStoreForTests()
    expect((await loadCritters()).progress['black-rabbit']).toEqual({ obtained: true }) // « critters » ne contient aucun niveau
    expect(await loadCritterLevels()).toEqual({ 'black-rabbit': 4 })
    render(<App />)
    await go('#/collection/animaux')
    expect(await within(await screen.findByRole('button', { name: /^Lapin noir/ })).findByTestId('critter-level')).toHaveTextContent('❤️ 4/5')

    // Effacer le niveau : « Baisser » sous 1
    await user.click(screen.getByRole('button', { name: /^Lapin noir/ }))
    sheet = screen.getByRole('dialog', { name: 'Lapin noir' })
    for (let i = 0; i < 4; i++) await user.click(within(sheet).getByRole('button', { name: 'Baisser : Niveau du compagnon' }))
    expect(level()).toHaveTextContent('Non renseigné')
    await waitFor(async () => expect(await loadCritterLevels()).toEqual({}))
    expect((await loadCritters()).progress['black-rabbit']).toEqual({ obtained: true })
  })

  it('décocher « Obtenu » masque le niveau mais ne l’efface pas', async () => {
    const user = userEvent.setup()
    await seed({ 'black-rabbit': { obtained: true } })
    await commit({ set: [['critterLevels', { 'black-rabbit': 2 }]] })
    render(<App />)
    await go('#/collection/animaux')
    await screen.findByRole('heading', { name: 'Animaux' })
    expect(screen.getByTestId('critter-level')).toHaveTextContent('❤️ 2/5')
    await user.click(screen.getByRole('checkbox', { name: 'Obtenu : Lapin noir' }))
    expect(screen.queryByTestId('critter-level')).not.toBeInTheDocument()
    await waitFor(async () => expect((await loadCritters()).progress['black-rabbit']).toBeUndefined())
    expect(await loadCritterLevels()).toEqual({ 'black-rabbit': 2 }) // masqué, pas supprimé
    await user.click(screen.getByRole('checkbox', { name: 'Obtenu : Lapin noir' }))
    expect(await screen.findByTestId('critter-level')).toHaveTextContent('❤️ 2/5')
  })

  it('fiche : capacité de collecte avec sa source, « non renseigné » sans rien supposer', async () => {
    const user = userEvent.setup()
    await seed()
    render(<App />)
    await go('#/collection/animaux')
    await user.click(await screen.findByRole('button', { name: /^Écureuil classique/ }))
    let sheet = screen.getByRole('dialog', { name: 'Écureuil classique' })
    expect(within(sheet).getByTestId('critter-gather')).toHaveTextContent('🍎 Fruits')
    expect(within(sheet).getByTestId('critter-gather')).toHaveTextContent('Donnée provisoire, d’après des guides de jeu')
    // Les sources sont accessibles : un lien par guide
    const links = within(within(sheet).getByTestId('gathering-sources')).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Destructoid (31/10/2025)', 'GameGrin (22/06/2025)', 'guide Steam (08/2025)'])
    for (const l of links) expect(l).toHaveAttribute('href', expect.stringContaining('https://'))
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: /^Hérisson classique/ }))
    sheet = screen.getByRole('dialog', { name: 'Hérisson classique' })
    expect(within(sheet).getByTestId('critter-gather')).toHaveTextContent('non renseigné')
    expect(within(sheet).getByTestId('critter-gather')).toHaveTextContent('rien n’est supposé')
  })

  it('vue « À nourrir aujourd’hui » : pas de tri, mais le filtre de capacité reste disponible', async () => {
    await seed()
    render(<App />)
    await go('#/collection/animaux/aujourdhui')
    await screen.findByTestId('critters-today-count')
    expect(screen.queryByRole('combobox', { name: 'Trier' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filtrer par capacité de collecte' })).toBeInTheDocument()
  })
})
