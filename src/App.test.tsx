import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CHARACTERS } from './data/characters'
import { commit, readEntries } from './lib/db'
import { CURRENT_SCHEMA } from './lib/migrations'
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
  afterEach(() => vi.restoreAllMocks())

  it('affiche les sept métiers avec un compteur à zéro', async () => {
    render(<App />)
    await go('#/metiers')
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

    await go('#/metiers')
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
    await go('#/metiers')
    expect(await screen.findByTestId('count-fishing')).toHaveTextContent('1')
    expect(screen.getByTestId('count-gardening')).toHaveTextContent('1')

    // Suppression
    dialog = await openCharacter(user, 'Vaiana')
    await user.click(within(dialog).getByRole('button', { name: /Aucun métier/ }))
    await go('#/metiers')
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

  it('suit débloqué, amitié et demande d’objet depuis la fiche, avec filtres et conservation', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    const total = CHARACTERS.length

    let dialog = await openCharacter(user, 'Elsa')
    let group = within(dialog).getByRole('group', { name: 'Suivi dans ta partie' })
    const unlock = within(group).getByRole('checkbox', { name: 'Débloqué dans ma partie' })
    expect(unlock).not.toBeChecked()
    expect(within(group).getByRole('checkbox', { name: 'Objet déjà demandé' })).toBeDisabled()
    expect(within(group).getByRole('button', { name: 'Augmenter : Niveau d’amitié' })).toBeDisabled()

    await user.click(unlock)
    const plus = within(group).getByRole('button', { name: 'Augmenter : Niveau d’amitié' })
    await user.click(plus)
    await user.click(plus)
    await user.click(plus)
    expect(within(group).getByLabelText('Niveau d’amitié')).toHaveTextContent('Niveau 3')
    await user.click(within(group).getByRole('checkbox', { name: 'Objet déjà demandé' }))
    await user.keyboard('{Escape}')

    // La ligne affiche le suivi, sans toucher au métier
    const row = screen.getByRole('button', { name: /^Elsa/ })
    expect(within(row).getByLabelText('Amitié niveau 3')).toBeInTheDocument()
    expect(within(row).getByLabelText('Objet demandé')).toBeInTheDocument()
    expect(within(row).getByText('Sans métier')).toBeInTheDocument()

    // Un métier débloque l'habitant (case cochée et verrouillée)
    dialog = await openCharacter(user, 'Dingo')
    await user.click(within(dialog).getByRole('button', { name: /Pêche/ }))
    dialog = await openCharacter(user, 'Dingo')
    const dingoUnlock = within(dialog).getByRole('checkbox', { name: 'Débloqué dans ma partie' })
    expect(dingoUnlock).toBeChecked()
    expect(dingoUnlock).toBeDisabled()
    expect(within(dialog).getByText('Il a un métier : il est forcément débloqué.')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Filtres
    await user.clear(screen.getByLabelText('Rechercher par nom'))
    const filters = screen.getByRole('group', { name: 'Filtrer les habitants' })
    await user.click(within(filters).getByRole('button', { name: 'Débloqués' }))
    expect(screen.getByText('2 habitants')).toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: '🔒 Non débloqués' }))
    expect(screen.getByText(`${total - 2} habitants`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Elsa/ })).not.toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: '🎁 Pas encore demandé' }))
    expect(screen.getByText('1 habitant')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Dingo/ })).toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Sans métier' }))
    expect(screen.getByText(`${total - 1} habitants`)).toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: '🎣 Pêche' }))
    expect(screen.getByText('1 habitant')).toBeInTheDocument()
    await user.click(within(filters).getByRole('button', { name: 'Tous' }))

    // Réinitialisation manuelle de la demande et effacement de l'amitié
    dialog = await openCharacter(user, 'Elsa')
    group = within(dialog).getByRole('group', { name: 'Suivi dans ta partie' })
    await user.click(within(group).getByRole('checkbox', { name: 'Objet déjà demandé' }))
    await user.click(within(group).getByRole('checkbox', { name: 'Objet déjà demandé' }))
    const minus = within(group).getByRole('button', { name: 'Baisser : Niveau d’amitié' })
    await user.click(minus)
    expect(within(group).getByLabelText('Niveau d’amitié')).toHaveTextContent('Niveau 2')

    // Redémarrage : tout est relu depuis IndexedDB
    await new Promise((r) => setTimeout(r, 50))
    unmount()
    resetStoreForTests()
    render(<App />)
    dialog = await openCharacter(user, 'Elsa')
    group = within(dialog).getByRole('group', { name: 'Suivi dans ta partie' })
    expect(within(group).getByRole('checkbox', { name: 'Débloqué dans ma partie' })).toBeChecked()
    expect(within(group).getByRole('checkbox', { name: 'Objet déjà demandé' })).toBeChecked()
    expect(within(group).getByLabelText('Niveau d’amitié')).toHaveTextContent('Niveau 2')
  })

  it('un habitant pas encore sorti ne peut pas être débloqué', async () => {
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openCharacter(user, 'Lilo')
    expect(within(dialog).getByRole('checkbox', { name: 'Débloqué dans ma partie' })).toBeDisabled()
    expect(within(dialog).getByText('Pas encore sorti dans le jeu.')).toBeInTheDocument()
  })

  it('met à jour la version des données au premier lancement', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Aujourd’hui' })).toBeInTheDocument()
    expect((await readEntries())['meta:schema']).toBe(CURRENT_SCHEMA)
  })

  it('restaure une ancienne sauvegarde après confirmation, puis annule la restauration', async () => {
    const user = userEvent.setup()
    await commit({ set: [['assignments', { goofy: 'gardening' }]] })
    render(<App />)
    await go('#/infos')

    const v1 = JSON.stringify({ app: 'dreamlight-compagnons', version: 1, exportedAt: '2026-10-31T10:00:00Z', assignments: { moana: 'fishing', elsa: 'mining' } })
    await user.upload(await screen.findByTestId('backup-input'), new File([v1], 'ancienne.json', { type: 'application/json' }))

    // Confirmation : ce qui est remplacé et ce qui est conservé
    const sheet = await screen.findByRole('dialog', { name: 'Import partiel' })
    expect(within(sheet).getByText('Ancienne sauvegarde : seuls les métiers seront restaurés.', { exact: false })).toBeInTheDocument()
    const plan = within(sheet).getByRole('list', { name: 'Ce que la restauration va faire' })
    expect(within(plan).getByText('Remplacés : 1 actuellement → 2 dans le fichier')).toBeInTheDocument()
    expect(within(plan).getByText('Conservées (0 photo) : absentes du fichier')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Restaurer' }))
    expect(await screen.findByText('Sauvegarde restaurée ✓')).toBeInTheDocument()
    await go('#/metiers')
    expect(await screen.findByTestId('count-fishing')).toHaveTextContent('1')
    expect(screen.getByTestId('count-gardening')).toHaveTextContent('0')

    // Annulation : la confirmation prévient que les modifications faites depuis seront perdues
    await go('#/infos')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(await screen.findByRole('button', { name: 'Annuler la dernière restauration' }))
    expect(confirmSpy.mock.calls[0][0]).toContain('toutes les modifications faites depuis cette restauration')
    expect(await screen.findByText('Restauration annulée ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annuler la dernière restauration' })).not.toBeInTheDocument()
    await go('#/metiers')
    expect(await screen.findByTestId('count-gardening')).toHaveTextContent('1')
    expect(screen.getByTestId('count-fishing')).toHaveTextContent('0')
  })

  it('n’applique rien si l’import est annulé', async () => {
    const user = userEvent.setup()
    await commit({ set: [['assignments', { goofy: 'gardening' }]] })
    render(<App />)
    await go('#/infos')
    const file = JSON.stringify({ app: 'dreamlight-compagnons', version: 1, assignments: { elsa: 'mining' } })
    await user.upload(await screen.findByTestId('backup-input'), new File([file], 'f.json', { type: 'application/json' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await readEntries()).assignments).toEqual({ goofy: 'gardening' })
  })

  it('signale un fichier qui n’est pas une sauvegarde', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/infos')
    await user.upload(await screen.findByTestId('backup-input'), new File(['{"foo":1}'], 'autre.json', { type: 'application/json' }))
    expect(await screen.findByText('Ce fichier ne vient pas de Dreamlight Compagnons.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refuse un fichier de plus de 25 Mo sans le lire ni ouvrir la restauration', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/infos')
    const big = new File(['{"app":"dreamlight-compagnons"}'], 'enorme.json', { type: 'application/json' })
    Object.defineProperty(big, 'size', { value: 25 * 1024 * 1024 + 1 }) // sans allouer 25 Mo
    const read = vi.spyOn(big, 'text')
    await user.upload(await screen.findByTestId('backup-input'), big)
    expect(await screen.findByText('Ce fichier dépasse la limite de 25 Mo : ce n’est pas une sauvegarde de Dreamlight Compagnons.')).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bloque l’app si les données ne se chargent pas, avec copie de secours quand elles sont lisibles', async () => {
    const user = userEvent.setup()
    await commit({ set: [['assignments', { mickey: 'fishing' }], ['bizarre', 1n]] })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    // Seule fonction du navigateur simulée : Vitest ne sait pas créer d'adresse pour le Blob de test.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Tes données n’ont pas pu être chargées' })).toBeInTheDocument()
    // Aucun écran modifiable, aucune navigation
    expect(screen.queryByTestId('count-fishing')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Télécharger une copie de secours' }))
    expect(await screen.findByText(/Copie de secours téléchargée/)).toBeInTheDocument()
    expect(click).toHaveBeenCalled()
  })

  it('ne propose aucune copie de secours si IndexedDB est inaccessible', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('Stockage bloqué', 'SecurityError')
    })
    resetStoreForTests(`test-${Math.random()}`)
    render(<App />)
    expect(await screen.findByText(/Aucune copie de secours ne peut être créée/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Télécharger une copie de secours' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('refuse une restauration complète venant d’une version plus récente', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/infos')
    const file = JSON.stringify({
      app: 'dreamlight-compagnons', format: 2, type: 'complete', schema: 2,
      sections: { assignments: { v: 1, data: {} }, names: { v: 1, data: {} }, photos: null, wishlist: { v: 1, data: {} } },
    })
    await user.upload(await screen.findByTestId('backup-input'), new File([file], 'futur.json', { type: 'application/json' }))
    expect(await screen.findByText(/Restauration complète impossible.*« wishlist »/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('affiche la Numismagie avec filtre par niveau, recherche et détail', async () => {
    const user = userEvent.setup()
    render(<App />)
    await go('#/personnages')
    await user.click(await screen.findByRole('link', { name: 'Numismagie' }))
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
