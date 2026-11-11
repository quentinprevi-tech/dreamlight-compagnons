import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { commit, resetStoreForTests } from '../../lib/db'
import { CRITTER_VARIANTS } from './data'
import { loadCritters } from './storage'

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const settle = () => new Promise((r) => setTimeout(r, 60))
const ALL = { eternity: true, storybook: true, wishblossom: true, honeyglow: true }
/** État de départ : toutes les extensions choisies (par défaut, seul le jeu de base est affiché). */
const seedAllExtensions = (progress: object = {}) => commit({ set: [['critters', { owned: ALL, configured: true, progress }]] })
/** Configuration initiale par l'interface : « Tout sélectionner » puis « Valider ». */
async function selectAllExtensions(user: ReturnType<typeof userEvent.setup>) {
  const setup = await screen.findByTestId('extensions-setup')
  await user.click(within(setup).getByRole('button', { name: 'Tout sélectionner' }))
  await user.click(within(setup).getByRole('button', { name: 'Valider mes choix' }))
  await waitFor(() => expect(screen.queryByTestId('extensions-setup')).not.toBeInTheDocument())
}
const rows = () => screen.getAllByRole('checkbox', { name: /^Obtenu :/ })
/** Libellé de la ligne agrégée seul (le texte de la ligne y ajoute la méta : « 0/38 » puis « 38 à nourrir »). */
const lineLabel = () => within(screen.getByTestId('computed-task')).getByText(/^🐾 Animaux à nourrir/).textContent!

describe('Collection et Pets Tracker', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
    // Lundi 9 novembre 2026, midi à Bruxelles : l'horaire des animaux dépend du jour et de l'heure.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('accueil Collection : Animaux, Puzzles et Recettes disponibles', async () => {
    render(<App />)
    await go('#/collection')
    expect(await screen.findByRole('heading', { name: 'Collection' })).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Sections de la collection' })
    const links = within(list).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#/collection/animaux', '#/collection/puzzles', '#/collection/recettes'])
    expect(within(list).queryByText('À venir')).toBeNull()
    expect(screen.getByTestId('recipes-card-progress')).toHaveTextContent('0 connue sur 480')
    expect(screen.getByTestId('puzzles-progress')).toHaveTextContent('0 terminé sur 39')
    // Rien n'est supposé : tant que les extensions ne sont pas choisies, seul le jeu de base est compté
    expect(screen.getByTestId('critters-progress')).toHaveTextContent('0 obtenu sur 41')
    expect(screen.getByText('Choisis tes extensions pour voir tous tes animaux.')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole('link', { name: /Collection/ })).toHaveAttribute('aria-current', 'page')
  })

  it('liste par biome : noms du wiki, « À confirmer », recherche en français et en anglais', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/animaux')
    expect(await screen.findByRole('heading', { name: 'Animaux' })).toBeInTheDocument()
    expect(rows()).toHaveLength(41) // jeu de base seul tant que les extensions ne sont pas choisies
    await selectAllExtensions(user)
    expect(rows()).toHaveLength(90)

    // Nom français du wiki, sans badge ; sans nom français : nom anglais + « À confirmer »
    const meadow = within(screen.getByTestId('biome-peaceful-meadow'))
    expect(meadow.getByRole('button', { name: /^Lapin calico/ })).not.toHaveTextContent('À confirmer')
    expect(meadow.getByRole('button', { name: /^White Rabbit/ })).toHaveTextContent('À confirmer')
    // Aucun biome n'a de nom français : nom anglais « À confirmer »
    expect(screen.getByTestId('biome-peaceful-meadow').querySelector('h2')).toHaveTextContent('Peaceful MeadowÀ confirmer')

    const search = screen.getByLabelText('Rechercher un animal')
    await user.type(search, 'calico')
    expect(rows()).toHaveLength(1)
    await user.clear(search)
    await user.type(search, 'white rabbit')
    expect(rows()).toHaveLength(1) // trouvé par le nom anglais
    await user.clear(search)
    await user.type(search, 'oie')
    expect(rows()).toHaveLength(5) // Oie noire, bleue, dorée, Oie, True North Goose (zone/espèce « Oie »)
  })

  it('nourrir : un seul comptage par jour, détail, annulation, conservation après redémarrage', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await go('#/collection/animaux')
    const feed = await screen.findByRole('button', { name: 'Nourri aujourd’hui : Lapin noir' })
    await user.click(feed)
    const row = screen.getByRole('button', { name: /^Lapin noir/ })
    expect(row).toHaveTextContent('🐾 1/2')
    expect(screen.queryByRole('button', { name: 'Nourri aujourd’hui : Lapin noir' })).not.toBeInTheDocument()
    expect(within(row.closest('li')!).getByText('✓ Nourri')).toBeInTheDocument()

    // Détail : total, dernier nourrissage, règles
    await user.click(row)
    const sheet = screen.getByRole('dialog', { name: 'Lapin noir' })
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('1/2')
    expect(within(sheet).getByText(/dernier : 09\/11\/2026/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Un seul nourrissage réussi par jour compte/)).toBeInTheDocument()
    expect(within(sheet).getByTestId('threshold-chip')).toHaveTextContent('Seuil exact : 2')
    expect(within(sheet).getByTestId('threshold-explanation')).toHaveTextContent('Le wiki indique qu’il faut nourrir cet animal 2 fois.')
    expect(within(sheet).queryByRole('button', { name: /Nourri aujourd’hui$/ })).not.toBeInTheDocument()

    // Annulation du nourrissage d'aujourd'hui, puis nouveau comptage
    await user.click(within(sheet).getByRole('button', { name: /Annuler le nourrissage d’aujourd’hui/ }))
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('0/2')
    await user.click(within(sheet).getByRole('button', { name: /Nourri aujourd’hui/ }))
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('1/2')
    // Correction manuelle du total
    await user.click(within(sheet).getByRole('button', { name: 'Augmenter : Total des nourrissages' }))
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('2/2')
    expect(within(sheet).getByTestId('threshold-reached')).toHaveTextContent(/Tu as atteint le nombre de nourrissages indiqué par le wiki \(2\)/)
    await user.keyboard('{Escape}')

    // Redémarrage
    await settle()
    unmount()
    resetStoreForTests()
    render(<App />)
    expect(await screen.findByRole('button', { name: /^Lapin noir/ })).toHaveTextContent('🐾 2/2')
    expect((await loadCritters()).progress['lapin-noir' as never]).toBeUndefined()
    expect((await loadCritters()).progress['black-rabbit']).toEqual({ feedings: 2, lastFed: '2026-11-09', prevFed: undefined })
  })

  it('seuils : exact, « au moins » et inconnu sont présentés distinctement, jamais comme une garantie', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/animaux')
    await selectAllExtensions(user)
    expect(screen.getByTestId('threshold-legend')).toHaveTextContent('Aucun nombre ne garantit l’obtention')
    const sheetFor = async (pattern: RegExp, title: string) => {
      await user.click(screen.getByRole('button', { name: pattern }))
      return screen.getByRole('dialog', { name: title })
    }
    const stepUp = async (sheet: HTMLElement, times: number) => {
      for (let i = 0; i < times; i++) await user.click(within(sheet).getByRole('button', { name: 'Augmenter : Total des nourrissages' }))
    }

    // « 3+ » (Passereau émeraude, « 4+ ») : pas de fraction, ni dans la ligne ni dans la fiche
    expect(screen.getByRole('button', { name: /^Passereau émeraude/ })).toHaveTextContent('🐾 0 · au moins 4')
    let sheet = await sheetFor(/^Passereau émeraude/, 'Passereau émeraude')
    expect(within(sheet).getByTestId('threshold-chip')).toHaveTextContent('Au moins 4 (seuil exact inconnu)')
    expect(within(sheet).getByTestId('threshold-explanation')).toHaveTextContent(/peut être plus élevé.*4 nourrissages ne garantissent pas l’obtention/)
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('0 · au moins 4')
    await stepUp(sheet, 3)
    expect(within(sheet).queryByTestId('threshold-reached')).not.toBeInTheDocument()
    await stepUp(sheet, 1)
    expect(within(sheet).getByTestId('threshold-reached')).toHaveTextContent(/Tu as atteint 4, mais le wiki indique seulement « au moins 4 ».*peut demander davantage/)
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('4 · au moins 4')
    expect(within(sheet).queryByText(/Minimum atteint/)).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Seuil inconnu (Singe beige) : « 3 nourrissages » ne sont jamais présentés comme suffisants
    expect(screen.getByRole('button', { name: /^Singe beige/ })).toHaveTextContent('🐾 0 · seuil inconnu')
    sheet = await sheetFor(/^Singe beige/, 'Singe beige')
    expect(within(sheet).getByTestId('threshold-chip')).toHaveTextContent('Seuil inconnu')
    expect(within(sheet).getByTestId('threshold-explanation')).toHaveTextContent('aucun nombre de nourrissages ne garantit son obtention')
    await stepUp(sheet, 3)
    expect(within(sheet).getByTestId('critter-count')).toHaveTextContent('3 · seuil inconnu')
    expect(within(sheet).queryByTestId('threshold-reached')).not.toBeInTheDocument()
    expect(within(sheet).queryByText(/atteint/)).not.toBeInTheDocument()
    await stepUp(sheet, 7)
    expect(within(sheet).queryByTestId('threshold-reached')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Seuil exact (Lapin noir, « 2 ») : seule variante à afficher une fraction
    expect(screen.getByRole('button', { name: /^Lapin noir/ })).toHaveTextContent('🐾 0/2')
  })

  it('obtenu, filtres « À obtenir » et « Obtenus », progression', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/animaux')
    await user.click(await screen.findByRole('checkbox', { name: 'Obtenu : Lapin noir' }))
    await user.click(screen.getByRole('checkbox', { name: 'Obtenu : Lapin brun' }))
    expect(screen.getByTestId('critters-obtained')).toHaveTextContent('2 obtenus sur 41')
    const filters = screen.getByRole('group', { name: 'Filtrer les animaux' })
    await user.click(within(filters).getByRole('button', { name: 'Obtenus' }))
    expect(rows()).toHaveLength(2)
    await user.click(within(filters).getByRole('button', { name: 'À obtenir' }))
    expect(rows()).toHaveLength(39)
    expect(screen.queryByRole('button', { name: 'Nourri aujourd’hui : Lapin noir' })).not.toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Tous' }))
    // Un animal obtenu n'a plus de bouton de nourrissage mais reste décochable
    expect(screen.queryByRole('button', { name: 'Nourri aujourd’hui : Lapin noir' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Obtenu : Lapin noir' }))
    expect(screen.getByRole('button', { name: 'Nourri aujourd’hui : Lapin noir' })).toBeInTheDocument()
  })

  it('configuration initiale : rien n’est supposé, le jeu de base est toujours inclus, le choix reste modifiable', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await go('#/collection/animaux')
    const setup = await screen.findByTestId('extensions-setup')
    expect(within(setup).getByRole('heading', { name: 'Quelles extensions possèdes-tu ?' })).toBeInTheDocument()
    // Jeu de base activé et verrouillé ; aucune extension cochée d'office
    expect(within(setup).getByRole('checkbox', { name: 'Jeu de base (toujours inclus)' })).toBeChecked()
    expect(within(setup).getByRole('checkbox', { name: 'Jeu de base (toujours inclus)' })).toBeDisabled()
    for (const name of [/Éternité/, /Vallon des contes/, /Wishblossom/, /Honeyglow/]) expect(within(setup).getByRole('checkbox', { name })).not.toBeChecked()
    expect(screen.queryByText('Capybara classique')).not.toBeInTheDocument()
    expect(screen.queryByText(/Mes extensions \(/)).not.toBeInTheDocument() // pas encore de panneau de modification
    expect(screen.getByTestId('critters-obtained')).toHaveTextContent('0 obtenu sur 41')
    expect(within(setup).getByRole('button', { name: 'Valider : jeu de base seulement' })).toBeInTheDocument()

    // Tant qu'elle n'est pas validée, la configuration n'est pas enregistrée (elle se représente au prochain lancement)
    await settle()
    unmount()
    resetStoreForTests()
    render(<App />)
    await go('#/collection/animaux')
    const again = await screen.findByTestId('extensions-setup')

    // Choix d'une extension : ses animaux apparaissent
    await user.click(within(again).getByRole('checkbox', { name: /Éternité/ }))
    await user.click(within(again).getByRole('button', { name: 'Valider mes choix' }))
    expect(screen.queryByTestId('extensions-setup')).not.toBeInTheDocument()
    expect(screen.getByText('Capybara classique')).toBeInTheDocument()
    expect(screen.queryByText('Oie noire')).not.toBeInTheDocument() // Wishblossom non choisie
    expect(screen.getByTestId('critters-obtained')).toHaveTextContent('0 obtenu sur 59')
    expect(screen.getByText('Mes extensions (1/4)')).toBeInTheDocument()

    // Modifiable plus tard : « Tout sélectionner », puis décocher une extension
    await user.click(screen.getByText('Mes extensions (1/4)'))
    await user.click(screen.getByRole('button', { name: 'Tout sélectionner' }))
    expect(screen.getByTestId('critters-obtained')).toHaveTextContent('0 obtenu sur 90')
    await user.click(screen.getByRole('checkbox', { name: 'L’Île de l’Éternité' }))
    expect(screen.queryByText('Capybara classique')).not.toBeInTheDocument()
    expect(screen.queryByTestId('biome-wild-tangle')).not.toBeInTheDocument()
    expect(screen.getByTestId('critters-obtained')).toHaveTextContent('0 obtenu sur 72')
    expect(screen.getByText('Mes extensions (3/4)')).toBeInTheDocument()
    await settle()
    expect(await loadCritters()).toMatchObject({ configured: true, owned: { eternity: false, storybook: true, wishblossom: true, honeyglow: true } })
  })

  it('jeu de base seulement : un choix valide, qui ferme la configuration', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/animaux')
    await user.click(within(await screen.findByTestId('extensions-setup')).getByRole('button', { name: 'Valider : jeu de base seulement' }))
    expect(screen.queryByTestId('extensions-setup')).not.toBeInTheDocument()
    expect(screen.getByText('Mes extensions (0/4)')).toBeInTheDocument()
    expect(screen.getByTestId('critters-obtained')).toHaveTextContent('0 obtenu sur 41')
    await settle()
    expect(await loadCritters()).toMatchObject({ configured: true, owned: { eternity: false, storybook: false, wishblossom: false, honeyglow: false } })
  })

  it('les extensions non possédées ne comptent jamais dans la ligne du jour', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Avant configuration : jeu de base seul, avec un rappel dans la ligne
    await screen.findByTestId('computed-task')
    const before = Number(/0\/(\d+)/.exec(lineLabel())![1])
    expect(screen.getByTestId('computed-task')).toHaveTextContent('extensions à choisir')
    await go('#/collection/animaux/aujourdhui')
    await selectAllExtensions(user)
    await go('#/')
    await screen.findByTestId('computed-task')
    const after = Number(/0\/(\d+)/.exec(lineLabel())![1])
    expect(after).toBeGreaterThan(before) // les animaux des extensions s'ajoutent seulement une fois choisies
    expect(screen.getByTestId('computed-task')).not.toHaveTextContent('extensions à choisir')
  })

  it('noms : un nom personnalisé pour un animal et pour un biome, conservés et jamais « officiels »', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await go('#/collection/animaux')
    await user.click(await screen.findByRole('button', { name: /^White Rabbit/ }))
    let sheet = screen.getByRole('dialog', { name: 'White Rabbit' })
    expect(within(sheet).getByText(/Nom français à confirmer/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: '✎ Mon nom' }))
    const rename = screen.getByRole('dialog', { name: 'Mon nom pour « White Rabbit »' })
    expect(within(rename).getByText(/nom français à confirmer/)).toBeInTheDocument()
    await user.type(within(rename).getByLabelText('Mon nom'), 'Lapin blanc')
    await user.click(within(rename).getByRole('button', { name: 'Enregistrer' }))
    // La fiche revient avec le nom personnalisé, et le nom anglais reste visible
    sheet = await screen.findByRole('dialog', { name: 'Lapin blanc' })
    expect(within(sheet).getByText(/White Rabbit · Nom personnalisé/)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /^Lapin blanc/ })).not.toHaveTextContent('À confirmer')

    // Biome
    await user.click(screen.getByRole('button', { name: 'Renommer le biome Peaceful Meadow' }))
    await user.type(screen.getByLabelText('Mon nom'), 'Prairie paisible')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: /Prairie paisible/ })).toBeInTheDocument()

    await settle()
    unmount()
    resetStoreForTests()
    render(<App />)
    await go('#/collection/animaux')
    expect(await screen.findByRole('button', { name: /^Lapin blanc/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Prairie paisible/ })).toBeInTheDocument()
  })

  it('conditions et horaire contradictoire : jamais présentés comme certains', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/animaux')
    await selectAllExtensions(user)
    const skunk = await screen.findByRole('button', { name: /^Patterned Skunk/ })
    expect(skunk).toHaveTextContent('☁️ Selon la météo')
    await user.click(skunk)
    let sheet = screen.getByRole('dialog', { name: 'Patterned Skunk' })
    expect(within(sheet).getByText(/Seulement par temps très nuageux ou pluvieux/)).toBeInTheDocument()
    expect(within(sheet).getByText(/n’est pas comptée dans « Aujourd’hui »/)).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: /^White Sweet Bee/ }))
    sheet = screen.getByRole('dialog', { name: 'White Sweet Bee' })
    expect(within(sheet).getByText('Horaire à confirmer')).toBeInTheDocument()
    expect(within(sheet).getByText(/20 h–minuit, la fiche de la variante 20 h–7 h/)).toBeInTheDocument() // une seule fois
    // Aucune pastille d'état « présent » (le texte d'avertissement général, lui, cite cette expression)
    expect(within(sheet).queryByText('Présent selon l’horaire')).not.toBeInTheDocument()
    expect(within(sheet).queryByText(/^Présent selon l’horaire ·/)).not.toBeInTheDocument()
  })

  it('vue « À nourrir aujourd’hui » : sections, occasion manquée, mise à jour après chaque nourrissage', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/animaux/aujourdhui')
    await selectAllExtensions(user)
    await screen.findByTestId('critters-today-count')
    const total = Number(/0\/(\d+)/.exec(screen.getByTestId('critters-today-count').textContent!)![1])
    expect(total).toBeGreaterThan(0)
    expect(screen.getByTestId('critters-today-count')).toHaveTextContent(`🐾 0/${total} nourris aujourd’hui`)

    // Lundi midi : l'Oie noire (5 h–11 h) est une occasion manquée ; l'Abeille douce blanche est à confirmer ;
    // le Capybara « Toon » dépend d'une quête ; le Lapin calico (jeudi) est absent
    expect(within(screen.getByTestId('section-missed')).getByRole('button', { name: /^Oie noire/ })).toBeInTheDocument()
    expect(within(screen.getByTestId('section-unknown')).getByRole('button', { name: /^White Sweet Bee/ })).toBeInTheDocument()
    expect(within(screen.getByTestId('section-conditional')).getByRole('button', { name: /^Toon Capybara/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Lapin calico/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('absent-count')).toBeInTheDocument()
    expect(within(screen.getByTestId('section-to-feed')).getByRole('button', { name: /^Capybara classique/ })).toBeInTheDocument()

    // Nourrir : l'animal passe dans « Nourris aujourd'hui », X augmente, Y ne change pas
    await user.click(within(screen.getByTestId('section-to-feed')).getByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }))
    expect(screen.getByTestId('critters-today-count')).toHaveTextContent(`🐾 1/${total} nourris aujourd’hui`)
    expect(within(screen.getByTestId('section-fed')).getByRole('button', { name: /^Capybara classique/ })).toBeInTheDocument()
    expect(within(screen.getByTestId('section-to-feed')).queryByRole('button', { name: /^Capybara classique/ })).not.toBeInTheDocument()

    // Nourrir une occasion manquée la fait revenir dans le compteur (Y + 1)
    await user.click(within(screen.getByTestId('section-missed')).getByRole('button', { name: 'Nourri aujourd’hui : Oie noire' }))
    expect(screen.getByTestId('critters-today-count')).toHaveTextContent(`🐾 2/${total + 1} nourris aujourd’hui`)

    // Un animal obtenu disparaît de la vue
    await user.click(within(screen.getByTestId('section-fed')).getByRole('checkbox', { name: 'Obtenu : Capybara classique' }))
    expect(screen.getByTestId('critters-today-count')).toHaveTextContent(`🐾 1/${total} nourris aujourd’hui`)
    expect(screen.queryByRole('button', { name: /^Capybara classique/ })).not.toBeInTheDocument()
  })

  it('Aujourd’hui : une seule ligne « Animaux à nourrir X/Y » qui ouvre le Pets Tracker et se met à jour', async () => {
    const user = userEvent.setup()
    await seedAllExtensions()
    render(<App />)
    const line = await screen.findByTestId('computed-task')
    const total = Number(/0\/(\d+)/.exec(lineLabel())![1])
    expect(lineLabel()).toBe(`🐾 Animaux à nourrir : 0/${total}`)
    expect(screen.getAllByTestId('computed-task')).toHaveLength(1) // pas une multitude de tâches
    expect(line).toHaveAttribute('href', '#/collection/animaux/aujourdhui')
    expect(within(line.closest('li')!).queryByRole('checkbox')).not.toBeInTheDocument() // non cochable à la main

    // Elle ouvre directement la vue du jour
    await user.click(line)
    await screen.findByTestId('critters-today-count')
    await user.click(await screen.findByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }))
    await user.click(screen.getByRole('button', { name: 'Nourri aujourd’hui : Cobra classique' }))

    await go('#/')
    await screen.findByTestId('computed-task')
    expect(lineLabel()).toBe(`🐾 Animaux à nourrir : 2/${total}`)
    // Le nombre de tâches comptées par la progression du jour est inchangé (une seule ligne)
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0 tâche faite sur 11')
  })

  it('Aujourd’hui : la ligne passe dans « Terminées » quand tout est nourri, et disparaît quand rien n’est à nourrir', async () => {
    const user = userEvent.setup()
    // Tout est obtenu sauf deux animaux présents à midi le lundi
    const progress = Object.fromEntries(
      CRITTER_VARIANTS.filter((v) => !['classic-capybara', 'classic-cobra'].includes(v.id)).map((v) => [v.id, { obtained: true }]),
    )
    await seedAllExtensions(progress)
    render(<App />)
    const line = await screen.findByTestId('computed-task')
    expect(line).toHaveTextContent('🐾 Animaux à nourrir : 0/2')
    expect(line.closest('ul')).toHaveAccessibleName('À faire')

    await go('#/collection/animaux/aujourdhui')
    await user.click(await screen.findByRole('button', { name: 'Nourri aujourd’hui : Capybara classique' }))
    await user.click(screen.getByRole('button', { name: 'Nourri aujourd’hui : Cobra classique' }))
    await go('#/')
    const done = await screen.findByRole('list', { name: 'Terminées' })
    expect(within(done).getByTestId('computed-task')).toHaveTextContent('🐾 Animaux à nourrir : 2/2')
    expect(screen.getByTestId('today-progress')).toHaveTextContent('1 tâche faite sur 11')

    // Plus rien à nourrir (tout obtenu) : la ligne disparaît et ne compte plus
    await go('#/collection/animaux')
    await user.click(await screen.findByRole('checkbox', { name: 'Obtenu : Capybara classique' }))
    await user.click(screen.getByRole('checkbox', { name: 'Obtenu : Cobra classique' }))
    await go('#/')
    await screen.findByRole('heading', { name: 'Aujourd’hui' })
    expect(screen.queryByTestId('computed-task')).not.toBeInTheDocument()
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0 tâche faite sur 10')
  })

  it('Aujourd’hui : la ligne se retire sans désactiver le modèle, sans proposer de report', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('computed-task')
    await user.click(screen.getByRole('button', { name: 'Options : Nourrir les animaux' }))
    const sheet = screen.getByRole('dialog', { name: 'Nourrir les animaux' })
    expect(within(sheet).getByText(/Calculée d’après ton suivi des animaux/)).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Reporter/ })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /Retirer d’aujourd’hui/ }))
    expect(screen.queryByTestId('computed-task')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Retirées d’aujourd’hui \(1\)/ }))
    await user.click(within(screen.getByRole('list', { name: 'Retirées d’aujourd’hui' })).getByRole('button', { name: 'Remettre' }))
    expect(await screen.findByTestId('computed-task')).toBeInTheDocument()
  })
})
