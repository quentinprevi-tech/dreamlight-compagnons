import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildCatalog } from './catalog'
import * as data from './catalog.data'
import { ingredientEmoji, ingredientImageUrl } from './display'
import { INGREDIENT_IMAGE_PATHS } from './ingredientImages'
import { RecipeSheet } from './RecipeSheet'

const catalog = buildCatalog(data)

function show(id: string, props: Partial<Parameters<typeof RecipeSheet>[0]> = {}) {
  const recipe = catalog.byId.get(id)!
  const onClose = vi.fn()
  render(
    <RecipeSheet recipe={recipe} catalog={catalog} names={{}} known={false} favorite={false} onKnown={() => {}} onFavorite={() => {}} onRename={() => {}} onRenameIngredient={() => {}} onFilterIngredient={() => {}} onClose={onClose} {...props} />,
  )
  return { onClose, dialog: screen.getByRole('dialog') }
}

describe('table des images d’ingrédients', () => {
  it('couvre exactement les 198 ingrédients du catalogue, sans image partagée', () => {
    expect(Object.keys(INGREDIENT_IMAGE_PATHS).sort()).toEqual(catalog.ingredients.map((i) => i.id).sort())
    const urls = catalog.ingredients.map((i) => ingredientImageUrl(i.id))
    expect(urls.every((u) => u?.startsWith('https://dreamlightvalleywiki.com/images/'))).toBe(true)
    expect(new Set(urls).size).toBe(198)
  })

  it('le nom du fichier est celui de l’ingrédient anglais (contrôle de correspondance)', () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
    for (const ing of catalog.ingredients) {
      const file = ingredientImageUrl(ing.id)!.match(/\/([^/]+)\.png$/)![1].replace(/^\d+px-/, '')
      expect(norm(file), ing.id).toBe(norm(ing.en))
    }
  })

  it('un identifiant inconnu (ou « constructor ») n’a pas d’image', () => {
    expect(ingredientImageUrl('inconnu')).toBeUndefined()
    expect(ingredientImageUrl('constructor')).toBeUndefined()
    expect(ingredientImageUrl('__proto__')).toBeUndefined()
  })

  it('emoji de repli : celui de l’ingrédient, sinon celui du groupe, sinon une assiette', () => {
    expect(ingredientEmoji('lemon')).toBe('🍋')
    expect(ingredientEmoji('raspberry', ['fruit'])).toBe('🍎')
    expect(ingredientEmoji('sea-wolf', ['fish'])).toBe('🐟')
    expect(ingredientEmoji('inconnu')).toBe('🍽️')
    expect(ingredientEmoji('constructor')).toBe('🍽️')
  })
})

describe('fiche de recette : ingrédients avec images', () => {
  it('chaque ingrédient obligatoire montre sa miniature, sa quantité et son nom', () => {
    const { dialog } = show('bunuelos')
    const slots = within(dialog).getAllByTestId('slot-fixed')
    expect(slots).toHaveLength(4)
    for (const slot of slots) {
      const img = slot.querySelector('img')!
      expect(img.getAttribute('src')).toMatch(/^https:\/\/dreamlightvalleywiki\.com\/images\/thumb\/.+\.png$/)
      expect(img).toHaveAttribute('loading', 'lazy')
      expect(img).toHaveAttribute('alt', '') // décorative : le nom est écrit à côté
      expect(slot).toHaveTextContent(/1 ×/)
    }
    expect(slots[0]).toHaveTextContent('Blé')
    expect(slots[0].querySelector('img')!.getAttribute('src')).toContain('Wheat.png')
    expect(slots[1].querySelector('img')!.getAttribute('src')).toContain('Cheese.png')
  })

  it('tant que l’image n’est pas chargée, l’emoji est affiché ; une fois chargée, il disparaît', () => {
    const { dialog } = show('cheese-platter')
    const thumb = within(dialog).getByTestId('ingredient-thumb')
    expect(thumb).toHaveAttribute('data-state', 'loading')
    expect(within(thumb).getByTestId('ingredient-emoji')).toHaveTextContent('🧀')
    fireEvent.load(thumb.querySelector('img')!)
    expect(thumb).toHaveAttribute('data-state', 'loaded')
    expect(within(thumb).queryByTestId('ingredient-emoji')).toBeNull()
  })

  it('image en échec (hors ligne, wiki indisponible) : l’emoji reste, l’image est retirée, le nom et la quantité aussi', () => {
    const { dialog } = show('bunuelos')
    const slot = within(dialog).getAllByTestId('slot-fixed')[0]
    fireEvent.error(slot.querySelector('img')!)
    const thumb = within(slot).getByTestId('ingredient-thumb')
    expect(thumb).toHaveAttribute('data-state', 'failed')
    expect(thumb.querySelector('img')).toBeNull()
    expect(within(thumb).getByTestId('ingredient-emoji')).toHaveTextContent('🌾')
    expect(slot).toHaveTextContent(/1 ×.*Blé/)
  })

  it('les boutons de l’ingrédient (voir les recettes, renommer) restent accessibles', async () => {
    const onFilterIngredient = vi.fn()
    const { dialog } = show('cheese-platter', { onFilterIngredient })
    await userEvent.click(within(dialog).getByRole('button', { name: /Voir les recettes avec/ }))
    expect(onFilterIngredient).toHaveBeenCalledWith('cheese')
    expect(within(dialog).getByRole('button', { name: /Renommer/ })).toBeInTheDocument()
  })

  it('« au choix » : les miniatures des possibilités ne sont demandées qu’à l’ouverture de la liste', () => {
    const { dialog } = show('gazpacho')
    const choice = within(dialog).getByTestId('slot-choice')
    expect(choice.querySelectorAll('img')).toHaveLength(0)
    const details = choice.querySelector('details')!
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(choice.querySelectorAll('img').length).toBeGreaterThan(5)
    for (const img of choice.querySelectorAll('img')) expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('recette avec plusieurs ingrédients et un choix : tout est présent, la fiche se ferme par la croix', async () => {
    const { dialog, onClose } = show('arendellian-pickled-herring')
    expect(within(dialog).getAllByTestId('slot-fixed')).toHaveLength(4)
    expect(within(dialog).getAllByTestId('slot-choice')).toHaveLength(1)
    expect(within(dialog).getAllByTestId('ingredient-thumb')).toHaveLength(4)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
