import { BottomSheet } from '../../components/BottomSheet'
import { useState, type ReactNode } from 'react'
import type { CustomNames } from '../../lib/names'
import type { RecipeCatalog } from './catalog'
import { IngredientThumb } from './IngredientThumb'
import { COLLECTION_LABEL, describeValue, ingredientEmoji, ingredientImageUrl, ingredientName, NAME_KIND_BADGE, NAME_KIND_LABEL, recipeName, stars, TYPE_EMOJI, TYPE_LABEL } from './display'
import type { RecipeRecord, Slot } from './types'

interface Props {
  recipe: RecipeRecord
  catalog: RecipeCatalog
  names: CustomNames
  known: boolean
  favorite: boolean
  onKnown: (known: boolean) => void
  onFavorite: (favorite: boolean) => void
  onRename: () => void
  onRenameIngredient: (id: string) => void
  onFilterIngredient: (id: string) => void
  onClose: () => void
}

/**
 * Liste repliable des ingrédients possibles d'un choix. Les miniatures ne sont rendues (donc demandées au réseau)
 * qu'une fois la liste ouverte : un groupe comme « Fruit » compte 36 membres, inutile de tous les charger à l'ouverture de la fiche.
 */
function Possibilities({ members, note, thumb, ingName }: { members: string[]; note?: string; thumb: (id: string, size: number) => ReactNode; ingName: (id: string) => string }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="mt-1" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-xs font-semibold text-plum-700">Voir les {members.length} possibilité{members.length > 1 ? 's' : ''}</summary>
      <ul className="mt-1 flex flex-wrap gap-1">
        {members.map((m) => (
          <li key={m} className="flex items-center gap-1 rounded-full bg-white py-0.5 pr-2 pl-0.5 text-xs text-plum-800 ring-1 ring-amber-200">
            {open ? thumb(m, 24) : <span className="size-6 shrink-0" aria-hidden />}
            {ingName(m)}
          </li>
        ))}
      </ul>
      {note && <p className="mt-1 text-xs font-semibold text-amber-800">{note}</p>}
    </details>
  )
}

export function RecipeSheet({ recipe, catalog, names, known, favorite, onKnown, onFavorite, onRename, onRenameIngredient, onFilterIngredient, onClose }: Props) {
  const name = recipeName(recipe, names)
  const energy = describeValue(recipe.energy)
  const sell = describeValue(recipe.sell)

  const ingName = (id: string) => {
    const ing = catalog.ingredientById.get(id)
    return ing ? ingredientName(ing, names).text : id
  }

  const thumb = (id: string, size: number) => <IngredientThumb src={ingredientImageUrl(id)} fallback={ingredientEmoji(id, catalog.groupsOfIngredient.get(id))} size={size} />

  const renderSlot = (s: Slot, idx: number) => {
    if (s.k === 'f') {
      return (
        <li key={idx} className="flex items-center gap-2 rounded-2xl bg-plum-50 px-3 py-2" data-testid="slot-fixed">
          {thumb(s.i, 40)}
          <span className="font-display text-lg font-semibold text-plum-900">{s.q} ×</span>
          <span className="min-w-0 flex-1 break-words text-plum-900">{ingName(s.i)}</span>
          <button onClick={() => onFilterIngredient(s.i)} aria-label={`Voir les recettes avec ${ingName(s.i)}`} className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-plum-700 ring-1 ring-plum-200">
            🔍
          </button>
          <button onClick={() => onRenameIngredient(s.i)} aria-label={`Renommer ${ingName(s.i)}`} className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-plum-700 ring-1 ring-plum-200">
            ✎
          </button>
        </li>
      )
    }
    const group = catalog.groupById.get(s.g)
    const members = s.only ?? group?.members ?? []
    return (
      <li key={idx} className="rounded-2xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200" data-testid="slot-choice">
        <p className="text-plum-900">
          <span className="font-display text-lg font-semibold">{s.q} ×</span> au choix : <strong>{group?.fr ?? s.g}</strong>
          {group?.confirmed === false && (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 align-middle text-xs font-semibold text-rose-800" data-testid="unconfirmed">
              composition à confirmer
            </span>
          )}
        </p>
        <p className="text-xs text-plum-600">
          {s.q > 1 ? `${s.q} ingrédients à choisir` : 'Un seul ingrédient à choisir'}
          {s.only ? ', parmi cette liste seulement' : ' dans ce groupe'} — pas tous à la fois.
        </p>
        <Possibilities members={members} note={group?.note} thumb={thumb} ingName={ingName} />
      </li>
    )
  }

  return (
    <BottomSheet
      onClose={onClose}
      labelledBy="recipe-title"
      panelClassName="max-h-[90dvh] overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <h2 id="recipe-title" className="font-display text-2xl font-semibold text-plum-900">
        <span aria-hidden>{TYPE_EMOJI[recipe.type]}</span> {name.text}
      </h2>
      <p className="text-sm text-plum-600">
        {recipe.en !== name.text && <>{recipe.en} · </>}
        <span data-testid="name-kind">{NAME_KIND_LABEL[name.kind]}</span>
      </p>
      {recipe.frAlt && <p className="text-xs text-plum-500">Autre nom relevé dans l’autre guide : « {recipe.frAlt} ».</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onKnown(!known)}
          aria-pressed={known}
          data-testid="known-toggle"
          className={`rounded-full px-4 py-2 font-semibold active:scale-95 ${known ? 'bg-emerald-600 text-white' : 'bg-plum-100 text-plum-800'}`}
        >
          {known ? '✓ Connue' : 'Marquer comme connue'}
        </button>
        <button
          onClick={() => onFavorite(!favorite)}
          aria-pressed={favorite}
          data-testid="favorite-toggle"
          className={`rounded-full px-4 py-2 font-semibold active:scale-95 ${favorite ? 'bg-gold-300 text-night-900' : 'bg-plum-100 text-plum-800'}`}
        >
          {favorite ? '★ Favorite' : '☆ Ajouter aux favoris'}
        </button>
        <button onClick={onRename} className="rounded-full bg-plum-100 px-3 py-2 text-sm font-semibold text-plum-800 active:scale-95">
          ✎ {names[`recipe:${recipe.id}`] ? 'Modifier mon nom' : 'Mon nom'}
        </button>
      </div>

      {/* Les ingrédients d'abord : c'est ce qu'on vient chercher dans une recette, sans avoir à défiler. */}
      <h3 className="mt-4 font-display text-lg font-semibold text-plum-900">Ingrédients</h3>
      <ul className="mt-2 space-y-2" aria-label="Ingrédients">
        {recipe.slots.map(renderSlot)}
      </ul>
      <p className="mt-2 text-xs text-plum-500">Les ingrédients listés sont tous obligatoires. Aucune source consultée n’indique d’ingrédient polyvalent ou superflu.</p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-plum-50 p-2">
          <dt className="text-xs text-plum-600">Type</dt>
          <dd className="font-semibold text-plum-900">{TYPE_LABEL[recipe.type]}</dd>
        </div>
        <div className="rounded-2xl bg-plum-50 p-2">
          <dt className="text-xs text-plum-600">Étoiles</dt>
          <dd className="font-semibold text-gold-500" aria-label={`${recipe.stars} étoiles sur 5`}>
            {stars(recipe.stars)}
          </dd>
        </div>
        <div className="rounded-2xl bg-plum-50 p-2">
          <dt className="text-xs text-plum-600">Énergie</dt>
          <dd className="font-semibold text-plum-900" data-testid="energy">
            {energy.text}
          </dd>
          {energy.note && <dd className="text-xs text-plum-500">{energy.note}</dd>}
        </div>
        <div className="rounded-2xl bg-plum-50 p-2">
          <dt className="text-xs text-plum-600">Prix de vente</dt>
          <dd className="font-semibold text-plum-900" data-testid="sell">
            {sell.text}
          </dd>
          {sell.note && <dd className="text-xs text-plum-500">{sell.note}</dd>}
        </div>
        <div className="col-span-2 rounded-2xl bg-plum-50 p-2">
          <dt className="text-xs text-plum-600">Origine</dt>
          <dd className="font-semibold text-plum-900">
            {COLLECTION_LABEL[recipe.collection]}
            {recipe.collection !== 'base' && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">DLC</span>}
          </dd>
        </div>
      </dl>

      {recipe.notes && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-plum-600" aria-label="Remarques">
          {recipe.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-plum-400">Badge de nom : {NAME_KIND_BADGE[name.kind]}.</p>
    </BottomSheet>
  )
}
