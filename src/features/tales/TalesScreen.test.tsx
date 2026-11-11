import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { resetStoreForTests } from '../../lib/db'
import { TALES } from './data'
import { createSync } from '../../lib/sync'
import { loadTales, updateTales } from './storage'

type User = ReturnType<typeof userEvent.setup>

async function go(hash: string) {
  window.location.hash = hash
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
const settle = () => new Promise((r) => setTimeout(r, 60))

const view = async (user: User, name: '🧩 Puzzles' | '📜 Anigamis') => user.click(within(await screen.findByRole('group', { name: 'Vue' })).getByRole('button', { name }))
const counter = (name: string) => screen.getByRole('spinbutton', { name: `Possédés : ${name}` })

/** Saisit un total dans le compteur d'un type (vue Anigamis), puis valide en quittant le champ. */
async function setCount(user: User, name: string, n: number | string) {
  const input = counter(name)
  await user.clear(input)
  await user.type(input, String(n))
  await user.tab()
}

const BLUE = 'Anigami oiseau bleu'
const openPuzzle = async (user: User, pattern: RegExp) => user.click(await screen.findByRole('button', { name: pattern }))

describe('Puzzles et anigamis', () => {
  beforeEach(() => {
    resetStoreForTests(`test-${Math.random()}`)
    window.location.hash = ''
  })
  afterEach(() => vi.restoreAllMocks())

  it('résumé : progression globale, possédés, nécessaires, à obtenir ; 39 puzzles ; accueil Collection', async () => {
    render(<App />)
    await go('#/collection/puzzles')
    expect(await screen.findByRole('heading', { name: 'Puzzles' })).toBeInTheDocument()
    expect(screen.getByTestId('tales-progress')).toHaveTextContent('0 puzzle terminé sur 39')
    expect(screen.getByRole('progressbar', { name: 'Puzzles terminés' })).toHaveAttribute('aria-valuemax', '39')
    // Anigamis capturables seulement : les objets de quête ne comptent pas dans les totaux
    const needed = TALES.filter((t) => t.costStatus !== 'conflict').reduce(
      (n, t) => n + Object.entries(t.cost).filter(([id]) => !/^(neverafter|rainbow)-/.test(id)).reduce((a, [, q]) => a + q, 0),
      0,
    )
    expect(screen.getByTestId('stat-owned')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-needed')).toHaveTextContent(String(needed))
    expect(screen.getByTestId('stat-missing')).toHaveTextContent(String(needed))
    expect(screen.getByTestId('tales-counts')).toHaveTextContent('0 réalisable · 37 avec des anigamis manquants · 2 à coûts à confirmer')
    expect(within(screen.getByRole('list', { name: 'Puzzles' })).getAllByRole('button')).toHaveLength(39)
    expect(screen.getByText(/très probablement aux « Lorekeeper Tales »/)).toBeInTheDocument()

    await go('#/collection')
    expect(await screen.findByTestId('puzzles-progress')).toHaveTextContent('0 terminé sur 39')
    expect(screen.getByRole('link', { name: /Puzzles/ })).toHaveAttribute('href', '#/collection/puzzles')
    expect(within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole('link', { name: /Collection/ })).toHaveAttribute('aria-current', 'page')
  })

  it('compteurs indépendants par type, jamais négatifs, conservés après redémarrage', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    expect(screen.getAllByRole('spinbutton')).toHaveLength(21)
    for (const family of ['Oiseaux à capturer \\(6\\)', 'Démons à capturer \\(5\\)', 'Grenouilles à capturer \\(5\\)']) expect(screen.getByRole('heading', { name: new RegExp(family) })).toBeInTheDocument()

    // Chaque type a son propre compteur
    await user.click(screen.getByRole('button', { name: `Ajouter un : ${BLUE}` }))
    await user.click(screen.getByRole('button', { name: `Ajouter un : ${BLUE}` }))
    await setCount(user, 'Anigami grenouille rose', 12)
    expect(counter(BLUE)).toHaveValue(2)
    expect(counter('Anigami grenouille rose')).toHaveValue(12)
    expect(counter('Anigami démon rouge')).toHaveValue(0)
    expect(screen.getByTestId('stat-owned')).toHaveTextContent('14')

    // Jamais négatif : « − » bloqué à zéro, saisie négative ou non entière refusée
    expect(screen.getByRole('button', { name: 'Retirer un : Anigami démon rouge' })).toBeDisabled()
    await setCount(user, BLUE, -5)
    expect(await screen.findByRole('alert')).toHaveTextContent('Un compteur ne peut pas être négatif.')
    await waitFor(() => expect(counter(BLUE)).toHaveValue(2)) // valeur enregistrée inchangée
    await setCount(user, BLUE, '2.5')
    expect(await screen.findByText('Entre un nombre entier.')).toBeInTheDocument()
    expect(counter(BLUE)).toHaveValue(2)
    await user.click(screen.getByRole('button', { name: `Retirer un : ${BLUE}` }))
    await user.click(screen.getByRole('button', { name: `Retirer un : ${BLUE}` }))
    expect(counter(BLUE)).toHaveValue(0)
    expect(screen.getByRole('button', { name: `Retirer un : ${BLUE}` })).toBeDisabled()

    // Redémarrage
    await settle()
    unmount()
    resetStoreForTests()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    expect(counter('Anigami grenouille rose')).toHaveValue(12)
    expect((await loadTales()).counts).toEqual({ 'pink-frog': 12 })
  })

  it('les objets de quête sont signalés ; le nom français d’un guide est « À confirmer »', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    // 16 anigamis à capturer, visuellement séparés des 5 objets de quête
    const catchable = [...['Oiseaux', 'Démons', 'Grenouilles'].flatMap((f) => within(screen.getByRole('list', { name: `${f} à capturer` })).getAllByRole('listitem'))]
    expect(catchable).toHaveLength(16)
    const quest = screen.getByTestId('quest-items')
    expect(within(quest).getByRole('heading', { name: /Objets de quête \(5\)/ })).toBeInTheDocument()
    expect(quest).toHaveTextContent('ne sont pas des anigamis à capturer au filet')
    const questRows = within(screen.getByRole('list', { name: 'Objets de quête' })).getAllByRole('listitem')
    expect(questRows.map((r) => r.getAttribute('data-testid')).sort()).toEqual(
      ['anigami-neverafter-demon', 'anigami-neverafter-frog', 'anigami-rainbow-bird', 'anigami-rainbow-demon', 'anigami-rainbow-frog'],
    )
    for (const row of catchable) expect(quest.contains(row)).toBe(false)
    const blue = screen.getByTestId('anigami-blue-bird')
    expect(within(blue).getByText('À confirmer')).toBeInTheDocument()
    const shadowy = screen.getByTestId('anigami-shadowy-bird')
    expect(shadowy).toHaveTextContent('Shadowy Bird Snippet') // aucun nom français connu : nom anglais
    expect(within(shadowy).getByText('À confirmer')).toBeInTheDocument()
  })

  it('valider un puzzle : récapitulatif précis, confirmation, déduction, annulation proposée', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 30)
    await view(user, '🧩 Puzzles')
    expect(screen.getByTestId('tales-counts')).toHaveTextContent('1 réalisable')

    await openPuzzle(user, /^Aladdin/)
    let sheet = screen.getByRole('dialog', { name: 'Aladdin' })
    expect(within(sheet).getByTestId('puzzle-status')).toHaveTextContent('Réalisable')
    const cost = within(sheet).getByTestId('cost-blue-bird')
    expect(cost).toHaveTextContent('Nécessaires : 25')
    expect(cost).toHaveTextContent('Possédés : 30')
    expect(cost).toHaveTextContent('Suffisants ✓')
    expect(within(sheet).getByTestId('cost-status')).toHaveTextContent('Coûts confirmés par deux sources')

    await user.click(within(sheet).getByRole('button', { name: /Valider et déduire les anigamis/ }))
    // Récapitulatif AVANT validation : rien n'est encore déduit
    const confirm = screen.getByRole('dialog', { name: 'Valider « Aladdin » ?' })
    const recap = within(confirm).getByRole('list', { name: 'Récapitulatif' })
    expect(within(recap).getByText(BLUE)).toBeInTheDocument()
    expect(recap).toHaveTextContent('30 → 5 (−25)')
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 30 })

    await user.click(within(confirm).getByRole('button', { name: 'Valider et déduire' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Valider « Aladdin » ?' })).not.toBeInTheDocument())
    sheet = screen.getByRole('dialog', { name: 'Aladdin' })
    expect(within(sheet).getByTestId('puzzle-done-info')).toHaveTextContent(/Terminé le \d{2}\/\d{2}\/\d{4} — anigamis déduits/)
    expect(within(sheet).getByRole('button', { name: /Annuler cette validation/ })).toBeInTheDocument()
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 5 })
    await user.keyboard('{Escape}')
    expect(screen.getByTestId('tales-progress')).toHaveTextContent('1 puzzle terminé sur 39')
    expect(screen.getByTestId('undo-card')).toHaveTextContent('Aladdin')
  })

  it('quantités insuffisantes : validation impossible, rien n’est déduit', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 24)
    await view(user, '🧩 Puzzles')
    await openPuzzle(user, /^Aladdin/)
    const sheet = screen.getByRole('dialog', { name: 'Aladdin' })
    expect(within(sheet).getByTestId('puzzle-status')).toHaveTextContent('Il manque des anigamis (1)')
    expect(within(sheet).getByTestId('cost-blue-bird')).toHaveTextContent('Manquent : 1')
    const validate = within(sheet).getByRole('button', { name: /Valider et déduire les anigamis/ })
    expect(validate).toBeDisabled()
    expect(validate).toHaveTextContent('Il en manque 1')
    await user.click(validate)
    expect(screen.queryByRole('dialog', { name: /Valider/ })).not.toBeInTheDocument()
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 24 })
  })

  it('compteurs dépensés ailleurs pendant la confirmation : bloquée, sans afficher de valeur négative', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 30)
    await view(user, '🧩 Puzzles')
    await openPuzzle(user, /^Aladdin/)
    await user.click(within(screen.getByRole('dialog', { name: 'Aladdin' })).getByRole('button', { name: /Valider et déduire/ }))
    const confirm = screen.getByRole('dialog', { name: 'Valider « Aladdin » ?' })
    expect(within(confirm).getByRole('button', { name: 'Valider et déduire' })).toBeEnabled()

    // Un autre onglet dépense 20 oiseaux bleus pendant que la fiche est ouverte
    await updateTales({ type: 'adjust', id: 'blue-bird', delta: -20 })
    createSync(() => {}).notify('changed')
    expect(await within(confirm).findByTestId('confirm-blocked')).toHaveTextContent('Tes compteurs ont changé')
    expect(within(confirm).getByRole('button', { name: 'Valider et déduire' })).toBeDisabled()
    expect(within(confirm).getByRole('list', { name: 'Récapitulatif' })).toHaveTextContent('10 → —')
    expect(within(confirm).getByRole('list', { name: 'Récapitulatif' })).not.toHaveTextContent('-15')
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 10 })
    expect((await loadTales()).puzzles).toEqual({})
  })

  it('annulation exacte : les modifications manuelles faites entre-temps sont conservées', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 30)
    await view(user, '🧩 Puzzles')
    await openPuzzle(user, /^Aladdin/)
    await user.click(within(screen.getByRole('dialog', { name: 'Aladdin' })).getByRole('button', { name: /Valider et déduire/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Valider « Aladdin » ?' })).getByRole('button', { name: 'Valider et déduire' }))
    await user.keyboard('{Escape}')

    // Modifications manuelles APRÈS la validation : 5 → 8 bleus, 6 rouges ajoutés
    await view(user, '📜 Anigamis')
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: `Ajouter un : ${BLUE}` }))
    await setCount(user, 'Anigami oiseau rouge', 6)
    expect(counter(BLUE)).toHaveValue(8)
    await view(user, '🧩 Puzzles')

    await user.click(within(screen.getByTestId('undo-card')).getByRole('button', { name: /Annuler/ }))
    const confirm = screen.getByRole('dialog', { name: 'Annuler la validation de « Aladdin » ?' })
    expect(confirm).toHaveTextContent('tes modifications manuelles faites depuis sont conservées')
    expect(within(confirm).getByRole('list', { name: 'Récapitulatif' })).toHaveTextContent('8 → 33 (+25)') // 8 + 25, PAS l'ancien 30
    await user.click(within(confirm).getByRole('button', { name: 'Annuler la validation' }))
    await waitFor(() => expect(screen.queryByTestId('undo-card')).not.toBeInTheDocument())
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 33, 'red-bird': 6 })
    expect((await loadTales()).puzzles).toEqual({})
    expect(screen.getByTestId('tales-progress')).toHaveTextContent('0 puzzle terminé sur 39')
  })

  it('marquer terminé sans déduire : confirmation, aucun compteur modifié, remise en cours', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 3)
    await view(user, '🧩 Puzzles')
    await openPuzzle(user, /^Aladdin/)
    await user.click(within(screen.getByRole('dialog', { name: 'Aladdin' })).getByRole('button', { name: /Marquer terminé sans déduire/ }))
    const confirm = screen.getByRole('dialog', { name: 'Marquer « Aladdin » terminé ?' })
    expect(confirm).toHaveTextContent('Aucun anigami ne sera déduit')
    expect(within(confirm).queryByRole('list', { name: 'Récapitulatif' })).not.toBeInTheDocument()
    expect((await loadTales()).puzzles).toEqual({}) // pas encore confirmé
    await user.click(within(confirm).getByRole('button', { name: 'Marquer terminé' }))

    const sheet = await screen.findByRole('dialog', { name: 'Aladdin' })
    expect(within(sheet).getByTestId('puzzle-done-info')).toHaveTextContent('marqué terminé sans déduction')
    expect(within(sheet).queryByRole('button', { name: /Annuler cette validation/ })).not.toBeInTheDocument()
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 3 })
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('undo-card')).not.toBeInTheDocument() // rien à annuler : aucune déduction

    await openPuzzle(user, /^Aladdin/)
    await user.click(screen.getByRole('button', { name: /Remettre en cours/ }))
    await user.click(within(screen.getByRole('dialog', { name: /Remettre « Aladdin » en cours/ })).getByRole('button', { name: 'Remettre en cours' }))
    await waitFor(async () => expect((await loadTales()).puzzles).toEqual({}))
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 3 })
  })

  it('remettre en cours un puzzle validé : avertit que les anigamis ne sont pas rendus', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 25)
    await view(user, '🧩 Puzzles')
    await openPuzzle(user, /^Aladdin/)
    await user.click(within(screen.getByRole('dialog', { name: 'Aladdin' })).getByRole('button', { name: /Valider et déduire/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Valider « Aladdin » ?' })).getByRole('button', { name: 'Valider et déduire' }))
    await user.click(await screen.findByRole('button', { name: /Remettre en cours/ }))
    const confirm = screen.getByRole('dialog', { name: /Remettre « Aladdin » en cours/ })
    expect(confirm).toHaveTextContent('ne seront PAS rendus')
    await user.click(within(confirm).getByRole('button', { name: 'Remettre en cours' }))
    await waitFor(async () => expect((await loadTales()).puzzles).toEqual({}))
    expect((await loadTales()).counts).toEqual({}) // rien rendu
    expect((await loadTales()).log).toEqual([]) // plus d'annulation possible
  })

  it('indicateur « Source unique » sur les 12 puzzles dont les coûts ne sont pas recoupés', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await screen.findByRole('list', { name: 'Puzzles' })
    const badges = screen.getAllByTestId('single-source')
    expect(badges).toHaveLength(12)
    expect(badges.every((b) => /Source unique/.test(b.textContent ?? ''))).toBe(true)
    const rows = badges.map((b) => b.closest('li')!.textContent)
    for (const name of ['Maleficent\'s Journey', 'The Story of Dreamlight Valley', 'Inside Out', 'Coco']) expect(rows.some((r) => r?.includes(name)), name).toBe(true)
    // Aucun puzzle confirmé par deux sources, ni aucun puzzle contradictoire, ne porte cet indicateur
    for (const name of ['Aladdin', 'Frozen', 'Moana', 'Sleeping Beauty']) expect(rows.some((r) => r?.includes(name)), name).toBe(false)
    expect(screen.getByText(/« ① Source unique » : coûts relevés sur le wiki seulement/)).toBeInTheDocument()
    await openPuzzle(user, /^Coco/)
    expect(within(screen.getByRole('dialog', { name: 'Coco' })).getByTestId('cost-status')).toHaveTextContent('Coûts d’une seule source (le wiki)')
  })

  it('les deux puzzles contradictoires ne permettent JAMAIS de déduction, quels que soient les compteurs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    // Assez de tous les types pour n'importe quelle lecture des coûts
    for (const name of [BLUE, 'Anigami oiseau vert', 'Anigami grenouille vert', 'Anigami démon bleu']) await setCount(user, name, 99)
    await view(user, '🧩 Puzzles')
    for (const [pattern, title] of [[/^Moana/, 'Moana'], [/^Sleeping Beauty/, 'Sleeping Beauty']] as const) {
      await openPuzzle(user, pattern)
      const sheet = screen.getByRole('dialog', { name: title })
      expect(within(sheet).getByTestId('puzzle-status')).toHaveTextContent('Coûts à confirmer')
      expect(within(sheet).getByRole('button', { name: /Valider et déduire les anigamis/ })).toBeDisabled()
      expect(within(sheet).getByRole('button', { name: /Marquer terminé sans déduire/ })).toBeEnabled() // reste disponible
      await user.keyboard('{Escape}')
    }
    expect((await loadTales()).puzzles).toEqual({})
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 99, 'green-bird': 99, 'green-frog': 99, 'blue-demon': 99 })
  })

  it('coûts contradictoires (Moana) : à confirmer, jamais de déduction automatique', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 99)
    await setCount(user, 'Anigami grenouille vert', 99)
    await view(user, '🧩 Puzzles')
    await openPuzzle(user, /^Moana/)
    const sheet = screen.getByRole('dialog', { name: 'Moana' })
    expect(within(sheet).getByTestId('puzzle-status')).toHaveTextContent('Coûts à confirmer')
    expect(within(sheet).getByTestId('cost-status')).toHaveTextContent('les sources se contredisent')
    expect(within(sheet).getByTestId('cost-conflict')).toHaveTextContent('Autre source : Green Bird Snippet (15) ; Blue Bird Snippet (10)')
    expect(within(sheet).getByRole('button', { name: /Valider et déduire les anigamis/ })).toBeDisabled()
    // Marquer terminé reste possible
    expect(within(sheet).getByRole('button', { name: /Marquer terminé sans déduire/ })).toBeEnabled()
    expect((await loadTales()).counts).toEqual({ 'blue-bird': 99, 'green-frog': 99 })
  })

  it('filtres : réalisables, il manque, terminés, à confirmer ; recherche', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await view(user, '📜 Anigamis')
    await setCount(user, BLUE, 25)
    await view(user, '🧩 Puzzles')
    const filters = screen.getByRole('group', { name: 'Filtrer les puzzles' })
    const list = () => within(screen.getByRole('list', { name: 'Puzzles' })).getAllByRole('button')
    await user.click(within(filters).getByRole('button', { name: /Réalisables \(1\)/ }))
    expect(list()).toHaveLength(1)
    expect(list()[0]).toHaveTextContent('Aladdin')
    await user.click(within(filters).getByRole('button', { name: /Il manque \(36\)/ }))
    expect(list()).toHaveLength(36)
    await user.click(within(filters).getByRole('button', { name: /À confirmer \(2\)/ }))
    expect(list().map((b) => b.textContent)).toEqual([expect.stringContaining('Moana'), expect.stringContaining('Sleeping Beauty')])
    await user.click(within(filters).getByRole('button', { name: /Terminés \(0\)/ }))
    expect(screen.getByText('Aucun puzzle ne correspond.')).toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: /^Tous/ }))
    await user.type(screen.getByLabelText('Rechercher un puzzle'), 'agrabah') // trouvé par la récompense
    expect(list()).toHaveLength(1)
  })

  it('noms : personnalisation d’un puzzle et d’un type d’anigami, conservée, jamais « officielle »', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await go('#/collection/puzzles')
    await openPuzzle(user, /^Aladdin/)
    let sheet = screen.getByRole('dialog', { name: 'Aladdin' })
    expect(within(sheet).getByText(/Nom français à confirmer/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: '✎ Mon nom' }))
    const rename = screen.getByRole('dialog', { name: 'Mon nom pour « Aladdin »' })
    await user.type(within(rename).getByLabelText('Mon nom'), 'Aladdin et la lampe')
    await user.click(within(rename).getByRole('button', { name: 'Enregistrer' }))
    sheet = await screen.findByRole('dialog', { name: 'Aladdin et la lampe' })
    expect(within(sheet).getByText(/Aladdin · Nom personnalisé/)).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await view(user, '📜 Anigamis')
    await user.click(screen.getByRole('button', { name: `Renommer : ${BLUE}` }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Mon nom'), 'Oiseau bleu')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('spinbutton', { name: 'Possédés : Oiseau bleu' })).toBeInTheDocument()

    await settle()
    unmount()
    resetStoreForTests()
    render(<App />)
    await go('#/collection/puzzles')
    expect(await screen.findByRole('button', { name: /^Aladdin et la lampe/ })).toBeInTheDocument()
    await view(user, '📜 Anigamis')
    expect(screen.getByRole('spinbutton', { name: 'Possédés : Oiseau bleu' })).toBeInTheDocument()
  })

  it('puzzle d’une quête : débloqué pendant la quête, objets de quête indiqués', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/collection/puzzles')
    await openPuzzle(user, /^The Spark of Spite/)
    const sheet = screen.getByRole('dialog', { name: 'The Spark of Spite' })
    expect(within(sheet).getByText(/Débloqué pendant la quête « A Long-Awaited Invitation »/)).toBeInTheDocument()
    expect(within(sheet).getByTestId('cost-neverafter-frog')).toHaveTextContent('📜 Objet de quête (pas capturable au filet)')
    expect(within(sheet).getByRole('link', { name: 'Snippet Catching' })).toHaveAttribute('href', 'https://dreamlightvalleywiki.com/Snippet_Catching')
  })
})
