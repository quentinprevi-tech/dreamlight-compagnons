import { useEffect, useMemo, useState } from 'react'
import { FilterChips } from '../../components/FilterChips'
import { ProgressBar } from '../../components/ProgressBar'
import { RenameSheet } from '../../components/RenameSheet'
import { nameKey } from '../../lib/names'
import { hrefFor } from '../../lib/router'
import type { Companions } from '../../lib/useCompanions'
import { loadRecipeCatalog, type RecipeCatalog } from './catalog'
import { COLLECTION_LABEL, ingredientName, NAME_KIND_BADGE, NAME_KIND_LABEL, recipeName, shortValue, stars, TYPE_EMOJI } from './display'
import { summarizeRecipes } from './model'
import { DEFAULT_FILTERS, filterRecipes, searchIngredients, sortRecipes, type KnownFilter, type OriginFilter, type RecipeFilters, type SortDir, type SortKey } from './query'
import { RecipeSheet } from './RecipeSheet'
import type { RecipeType } from './types'
import type { RecipesState } from './useRecipes'

const PAGE = 60
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Nom' },
  { id: 'stars', label: 'Étoiles' },
  { id: 'type', label: 'Type' },
  { id: 'sell', label: 'Prix de vente' },
  { id: 'energy', label: 'Énergie' },
]
type Renaming = { key: string; title: string; officialName: string; officialNote: string; value?: string } | null

function useCatalog() {
  const [state, setState] = useState<{ catalog: RecipeCatalog | null; failed: boolean }>({ catalog: null, failed: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    loadRecipeCatalog().then(
      (catalog) => !cancelled && setState({ catalog, failed: false }),
      () => !cancelled && setState({ catalog: null, failed: true }),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])
  return { ...state, retry: () => (setState({ catalog: null, failed: false }), setAttempt((n) => n + 1)) }
}

export function RecipesScreen({ recipes, companions }: { recipes: RecipesState; companions: Companions }) {
  const { data, apply, error } = recipes
  const { names, setName } = companions
  const { catalog, failed, retry } = useCatalog()
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortKey>('name')
  const [dir, setDir] = useState<SortDir>('asc')
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Renaming>(null)
  const [ingQuery, setIngQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const summary = summarizeRecipes(data)
  const set = <K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setLimit(PAGE)
  }

  const shown = useMemo(() => (catalog ? sortRecipes(filterRecipes(catalog, data, filters, names), sort, dir, names) : []), [catalog, data, filters, names, sort, dir])
  const suggestions = useMemo(() => (catalog ? searchIngredients(catalog, ingQuery, names) : []), [catalog, ingQuery, names])
  const open = catalog && openId ? catalog.byId.get(openId) : undefined
  const activeIngredient = catalog && filters.ingredient ? catalog.ingredientById.get(filters.ingredient) : undefined

  const run = async (op: Parameters<RecipesState['apply']>[0]) => setMessage(await apply(op))

  const renameRecipe = (id: string) => {
    const r = catalog?.byId.get(id)
    if (!r) return
    const key = nameKey('recipe', id)
    const official = recipeName(r, {})
    setRenaming({ key, title: `Mon nom pour « ${r.en} »`, officialName: official.text, officialNote: NAME_KIND_LABEL[official.kind].toLowerCase(), value: names[key] })
  }
  const renameIngredient = (id: string) => {
    const i = catalog?.ingredientById.get(id)
    if (!i) return
    const key = nameKey('ingredient', id)
    const official = ingredientName(i, {})
    setRenaming({ key, title: `Mon nom pour « ${i.en} »`, officialName: official.text, officialNote: NAME_KIND_LABEL[official.kind].toLowerCase(), value: names[key] })
  }

  const chip = <T extends string | number>(label: string, chips: { id: T; label: string }[], value: T, onChange: (v: T) => void) => (
    <FilterChips<T> label={label} chips={chips} value={value} onChange={onChange} />
  )

  const input = 'w-full rounded-2xl border-0 bg-white px-4 py-3 text-base text-plum-900 shadow-sm ring-1 ring-gold-300/40 outline-none placeholder:text-plum-300 focus:ring-2 focus:ring-gold-400'

  return (
    <div className="animate-fade-up">
      <div className="sticky top-0 z-20 -mx-4 bg-night-900/80 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
        <a href={hrefFor({ name: 'collection' })} className="text-xs font-semibold text-gold-200">
          ‹ Collection
        </a>
        <h1 className="text-gold font-magic text-3xl font-bold">Recettes</h1>
      </div>

      {(error || message) && (
        <p role="alert" className="mt-3 rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
          {error ?? message}
        </p>
      )}

      <section className="glass mt-3 rounded-3xl p-4" aria-label="Résumé">
        <ProgressBar done={summary.known} total={summary.total} label="Recettes connues" />
        <p className="mt-2 text-sm font-semibold text-plum-900" data-testid="recipes-progress">
          {summary.known} connue{summary.known > 1 ? 's' : ''} sur {summary.total} · {summary.favorites} favorite{summary.favorites > 1 ? 's' : ''}
        </p>
      </section>

      {failed ? (
        <div className="glass mt-4 rounded-3xl p-4 text-center" role="alert">
          <p className="text-plum-900">Le livre de recettes n’a pas pu être chargé (connexion ?). Tes recettes connues sont intactes.</p>
          <button onClick={retry} className="mt-3 rounded-full bg-plum-700 px-4 py-2 font-semibold text-white">
            Réessayer
          </button>
        </div>
      ) : !catalog ? (
        <p className="mt-10 animate-pulse text-center font-display text-lg text-gold-200">📖 Ouverture du livre de recettes…</p>
      ) : (
        <>
          <input type="search" value={filters.query} onChange={(e) => set('query', e.target.value)} placeholder="Rechercher une recette (français ou anglais)…" aria-label="Rechercher une recette" className={`mt-3 ${input}`} />
          {chip<KnownFilter>(
            'Statut',
            [
              { id: 'all', label: `Toutes (${summary.total})` },
              { id: 'known', label: `✓ Connues (${summary.known})` },
              { id: 'unknown', label: `Inconnues (${summary.total - summary.known})` },
              { id: 'favorites', label: `★ Favorites (${summary.favorites})` },
            ],
            filters.known,
            (v) => set('known', v),
          )}
          {chip<'all' | RecipeType>(
            'Type',
            [
              { id: 'all', label: 'Tous types' },
              { id: 'appetizer', label: '🥗 Hors-d’œuvre' },
              { id: 'entree', label: '🍲 Plats' },
              { id: 'dessert', label: '🍰 Desserts' },
            ],
            filters.type,
            (v) => set('type', v),
          )}
          {chip<OriginFilter>(
            'Origine',
            [
              { id: 'all', label: 'Toutes origines' },
              { id: 'base', label: 'Jeu de base' },
              { id: 'dlc', label: 'DLC' },
              { id: 'eternity', label: COLLECTION_LABEL.eternity },
              { id: 'storybook', label: COLLECTION_LABEL.storybook },
              { id: 'wishblossom', label: COLLECTION_LABEL.wishblossom },
              { id: 'honeyglow', label: COLLECTION_LABEL.honeyglow },
            ],
            filters.origin,
            (v) => set('origin', v),
          )}
          {chip<number>(
            'Étoiles',
            [{ id: 0, label: 'Toutes étoiles' }, ...[1, 2, 3, 4, 5].map((n) => ({ id: n, label: stars(n) }))],
            filters.stars,
            (v) => set('stars', v as RecipeFilters['stars']),
          )}

          <div className="mt-3">
            {activeIngredient ? (
              <p className="flex items-center gap-2 rounded-2xl bg-gold-300/20 px-3 py-2 text-sm text-gold-100" data-testid="ingredient-filter">
                Avec l’ingrédient : <strong>{ingredientName(activeIngredient, names).text}</strong>
                <span className="text-xs">(exigé ou possible)</span>
                {(catalog?.groupsOfIngredient.get(activeIngredient.id) ?? []).some((g) => catalog?.groupById.get(g)?.confirmed === false) && (
                  <span className="text-xs text-amber-200" data-testid="unconfirmed-group">Groupe « Viande » : composition à confirmer</span>
                )}
                <button onClick={() => set('ingredient', null)} aria-label="Retirer le filtre d’ingrédient" className="ml-auto rounded-full bg-white/20 px-2 py-0.5 font-semibold">
                  ✕
                </button>
              </p>
            ) : (
              <>
                <input type="search" value={ingQuery} onChange={(e) => setIngQuery(e.target.value)} placeholder="Filtrer par ingrédient…" aria-label="Filtrer par ingrédient" className={input} />
                {suggestions.length > 0 && (
                  <ul className="mt-1 overflow-hidden rounded-2xl bg-white shadow ring-1 ring-plum-200" aria-label="Ingrédients proposés">
                    {suggestions.map((i) => (
                      <li key={i.id}>
                        <button
                          onClick={() => {
                            set('ingredient', i.id)
                            setIngQuery('')
                          }}
                          className="w-full px-4 py-2 text-left text-plum-900 active:bg-plum-50"
                        >
                          {ingredientName(i, names).text} <span className="text-xs text-plum-500">{i.en !== ingredientName(i, names).text && i.en}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs font-semibold text-plum-100" htmlFor="recipe-sort">
              Trier par
            </label>
            <select id="recipe-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-xl bg-white px-3 py-2 text-sm text-plum-900">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} aria-label={dir === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'} className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-plum-900">
              {dir === 'asc' ? '↑' : '↓'}
            </button>
            <span className="ml-auto text-xs text-plum-100" data-testid="recipes-count">
              {shown.length} recette{shown.length > 1 ? 's' : ''}
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="mt-8 text-center text-plum-100/80">Aucune recette ne correspond.</p>
          ) : (
            <ul className="mt-3 space-y-2" aria-label="Recettes">
              {shown.slice(0, limit).map((r) => {
                const name = recipeName(r, names)
                const known = !!data.known[r.id]
                const fav = !!data.favorites[r.id]
                return (
                  <li key={r.id} data-testid="recipe-row" className="glass flex items-center gap-2 rounded-2xl p-2">
                    <button onClick={() => run({ type: 'set-known', id: r.id, known: !known })} role="checkbox" aria-checked={known} aria-label={`Connue : ${name.text}`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${known ? 'bg-emerald-600 text-white' : 'bg-plum-100 text-plum-400'}`}>
                      {known ? '✓' : '○'}
                    </button>
                    <button onClick={() => setOpenId(r.id)} className="min-w-0 flex-1 text-left" aria-label={`Ouvrir ${name.text}`}>
                      <span className="block truncate font-semibold text-plum-900">
                        <span aria-hidden>{TYPE_EMOJI[r.type]}</span> {name.text}
                      </span>
                      <span className="block truncate text-xs text-plum-600">
                        <span className="text-gold-500">{stars(r.stars)}</span> · {shortValue(r.sell)} 🪙 · {shortValue(r.energy)} ⚡
                        {r.collection !== 'base' && <span className="ml-1 rounded-full bg-indigo-100 px-1.5 text-indigo-800">DLC</span>}
                        <span className="ml-1 rounded-full bg-plum-100 px-1.5 text-plum-700">{NAME_KIND_BADGE[name.kind]}</span>
                      </span>
                    </button>
                    <button onClick={() => run({ type: 'set-favorite', id: r.id, favorite: !fav })} aria-pressed={fav} aria-label={`Favorite : ${name.text}`} className={`h-11 w-11 shrink-0 rounded-full text-xl ${fav ? 'text-gold-400' : 'text-plum-300'}`}>
                      {fav ? '★' : '☆'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {shown.length > limit && (
            <button onClick={() => setLimit((n) => n + PAGE)} className="mt-3 w-full rounded-full bg-white/15 px-4 py-3 font-semibold text-plum-50 ring-1 ring-white/20">
              Afficher plus ({shown.length - limit} restantes)
            </button>
          )}
          <p className="mt-6 px-1 pb-2 text-center text-xs text-plum-200/70">
            Catalogue : Dreamlight Valley Wiki (480 recettes), figé le {new Date(`${catalog.verified}T12:00:00`).toLocaleDateString('fr-FR')}. Noms français relevés dans des guides (Gamosaurus, Gameblog), non vérifiés en jeu ; deux guides ne valent pas deux vérifications. Un nom anglais est « À confirmer ». « dès X » : minimum publié par le wiki (« or more »), pas une valeur exacte.
          </p>
        </>
      )}

      {open && catalog && !renaming && (
        <RecipeSheet
          recipe={open}
          catalog={catalog}
          names={names}
          known={!!data.known[open.id]}
          favorite={!!data.favorites[open.id]}
          onKnown={(known) => run({ type: 'set-known', id: open.id, known })}
          onFavorite={(favorite) => run({ type: 'set-favorite', id: open.id, favorite })}
          onRename={() => renameRecipe(open.id)}
          onRenameIngredient={renameIngredient}
          onFilterIngredient={(id) => {
            set('ingredient', id)
            setOpenId(null)
          }}
          onClose={() => setOpenId(null)}
        />
      )}
      {renaming && (
        <RenameSheet
          title={renaming.title}
          officialName={renaming.officialName}
          officialNote={renaming.officialNote}
          value={renaming.value}
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            setName(renaming.key, name)
            setRenaming(null)
          }}
        />
      )}
    </div>
  )
}
