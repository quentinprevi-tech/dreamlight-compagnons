import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { resetStoreForTests } from '../../lib/db'
import { loadTasks } from './storage'

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const todo = () => screen.getByRole('list', { name: 'À faire' })

describe('écran Aujourd’hui', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
    // Horloge fixée : le nombre d'animaux à nourrir dépend de l'heure (lundi 9 novembre 2026, midi à Bruxelles).
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-09T12:00:00'))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('est l’accueil : tâches principales, progression, cocher et décocher', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Aujourd’hui' })).toBeInTheDocument()
    // 10 tâches à cocher + la ligne « Animaux à nourrir » (calculée, sans case à cocher)
    expect(within(todo()).getAllByRole('checkbox')).toHaveLength(10)
    expect(within(todo()).getByTestId('computed-task')).toHaveTextContent(/^🐾 Animaux à nourrir : 0\/\d+/)
    expect(screen.getByTestId('today-progress')).toHaveTextContent('0 tâche faite sur 11')

    await user.click(within(todo()).getByRole('checkbox', { name: 'Ouvrir les coffres' }))
    const done = await screen.findByRole('list', { name: 'Terminées' })
    expect(within(done).getByRole('checkbox', { name: 'Ouvrir les coffres' })).toHaveAttribute('aria-checked', 'true')
    expect(within(done).getByText(/Revient demain à 00:00/)).toBeInTheDocument()
    expect(screen.getByTestId('today-progress')).toHaveTextContent('1 tâche faite sur 11')
    expect(screen.getByRole('progressbar', { name: 'Progression de la journée' })).toHaveAttribute('aria-valuenow', '1')

    // Décocher : retour dans « À faire »
    await user.click(within(done).getByRole('checkbox', { name: 'Ouvrir les coffres' }))
    expect(within(todo()).getByRole('checkbox', { name: 'Ouvrir les coffres' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Terminées' })).not.toBeInTheDocument()
  })

  it('fiche d’une tâche : rappel de l’app distinct de la remise à zéro du jeu, avec sources', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Options : Participer au DreamSnap' }))
    const sheet = screen.getByRole('dialog', { name: 'Participer au DreamSnap' })
    expect(within(sheet).getByText(/Chaque mercredi à 14 h UTC/)).toBeInTheDocument()
    expect(within(sheet).getByText('À confirmer')).toBeInTheDocument()
    expect(within(sheet).getByText(/13 h UTC dans son encart et à 14 h UTC dans son texte/)).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Wiki : DreamSnaps' })).toHaveAttribute('href', 'https://dreamlightvalleywiki.com/DreamSnaps')
  })

  it('reporter, retirer puis remettre une tâche', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Reporter
    await user.click(await screen.findByRole('button', { name: 'Options : Récolter les racines' }))
    await user.click(screen.getByRole('button', { name: /Reporter/ }))
    const postponed = await screen.findByRole('list', { name: 'Reportées' })
    expect(within(postponed).getByRole('checkbox', { name: 'Récolter les racines' })).toBeInTheDocument()
    expect(within(todo()).queryByRole('checkbox', { name: 'Récolter les racines' })).not.toBeInTheDocument()
    await user.click(within(postponed).getByRole('checkbox', { name: 'Récolter les racines' }))
    expect(within(postponed).getByRole('checkbox', { name: 'Récolter les racines' })).toHaveAttribute('aria-checked', 'true')

    // Retirer d'aujourd'hui, puis remettre
    await user.click(screen.getByRole('button', { name: 'Options : Avancer dans la Voie des étoiles' }))
    await user.click(screen.getByRole('button', { name: /Retirer d’aujourd’hui/ }))
    expect(within(todo()).queryByRole('checkbox', { name: 'Avancer dans la Voie des étoiles' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Retirées d’aujourd’hui \(1\)/ }))
    await user.click(within(screen.getByRole('list', { name: 'Retirées d’aujourd’hui' })).getByRole('button', { name: 'Remettre' }))
    expect(within(todo()).getByRole('checkbox', { name: 'Avancer dans la Voie des étoiles' })).toBeInTheDocument()

    // Le modèle est resté activé
    await new Promise((r) => setTimeout(r, 50))
    expect((await loadTasks()).enabled).toEqual({})
  })

  it('gérer les tâches : activer, ajouter, modifier et supprimer une tâche personnalisée', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    await user.click(await screen.findByRole('link', { name: /Gérer les tâches/ }))
    expect(await screen.findByRole('heading', { name: 'Gérer les tâches' })).toBeInTheDocument()

    // Activer une tâche « Autres » ; les DLC indiquent leur extension
    const others = screen.getByRole('list', { name: 'Autres' })
    await user.click(within(others).getByRole('checkbox', { name: /Taper les cailloux/ }))
    const dlc = screen.getByRole('list', { name: 'Extensions (DLC)' })
    expect(within(dlc).getByText('Montagnes Wishblossom')).toBeInTheDocument()
    expect(within(dlc).getAllByText('Extension à confirmer')).toHaveLength(2)

    // Ajouter une tâche hebdomadaire
    await user.click(screen.getByRole('button', { name: '+ Ajouter' }))
    let sheet = screen.getByRole('dialog', { name: 'Nouvelle tâche' })
    await user.type(within(sheet).getByLabelText('Nom de la tâche'), 'Arroser le potager')
    await user.click(within(sheet).getByRole('radio', { name: /Chaque semaine/ }))
    await user.selectOptions(within(sheet).getByLabelText('Jour de la semaine'), 'Chaque samedi')
    await user.click(within(sheet).getByRole('button', { name: 'Ajouter' }))
    const mine = screen.getByRole('list', { name: 'Mes tâches' })
    expect(within(mine).getByText('Chaque samedi à minuit')).toBeInTheDocument()

    // Modifier
    await user.click(within(mine).getByRole('button', { name: 'Modifier : Arroser le potager' }))
    sheet = screen.getByRole('dialog', { name: 'Modifier la tâche' })
    await user.clear(within(sheet).getByLabelText('Nom de la tâche'))
    await user.type(within(sheet).getByLabelText('Nom de la tâche'), 'Arroser les fleurs')
    await user.click(within(sheet).getByRole('radio', { name: /Une seule fois/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
    expect(within(mine).getByText('Arroser les fleurs')).toBeInTheDocument()

    // Visible dans Aujourd'hui
    await go('#/')
    expect(await screen.findByRole('checkbox', { name: 'Taper les cailloux' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Arroser les fleurs' })).toBeInTheDocument()

    // Supprimer
    await go('#/aujourdhui/taches')
    await user.click(await screen.findByRole('button', { name: 'Supprimer : Arroser les fleurs' }))
    expect(screen.queryByRole('list', { name: 'Mes tâches' })).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 50))
    expect((await loadTasks()).custom).toEqual([])
  })

  it('navigation : 4 onglets, sélecteur Habitants / Métiers / Numismagie, anciennes adresses', async () => {
    const user = userEvent.setup()
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['✨Aujourd’hui', '🏰Habitants', '🐾Collection', '📜Infos'])

    await user.click(within(nav).getByRole('link', { name: /Habitants/ }))
    const views = await screen.findByRole('navigation', { name: 'Vues des habitants' })
    expect(within(views).getByRole('link', { name: 'Habitants' })).toHaveAttribute('aria-current', 'page')
    await user.click(within(views).getByRole('link', { name: 'Métiers' }))
    expect(await screen.findByTestId('count-fishing')).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Habitants/ })).toHaveAttribute('aria-current', 'page')
    await user.click(within(screen.getByRole('navigation', { name: 'Vues des habitants' })).getByRole('link', { name: 'Numismagie' }))
    expect(await screen.findByTestId('scramble-count')).toBeInTheDocument()

    // Anciennes adresses
    await go('#/metier/fishing')
    expect(await screen.findByRole('link', { name: '‹ Métiers' })).toHaveAttribute('href', '#/metiers')
    expect(screen.queryByRole('navigation', { name: 'Vues des habitants' })).not.toBeInTheDocument()
    await go('#/numismagie')
    expect(await screen.findByTestId('scramble-count')).toBeInTheDocument()
    await go('#/infos')
    expect(await screen.findByRole('heading', { name: 'Infos' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Infos/ })).toHaveAttribute('aria-current', 'page')
  })
})
