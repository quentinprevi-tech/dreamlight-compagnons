import { ProgressBar } from '../../components/ProgressBar'
import { hrefFor } from '../../lib/router'
import { obtainedStats } from '../critters/model'
import type { CrittersState } from '../critters/useCritters'
import { summarizeRecipes } from '../recipes/model'
import type { RecipesState } from '../recipes/useRecipes'
import { summarizeTales } from '../tales/model'
import type { TalesState } from '../tales/useTales'
import { COLLECTION_SECTIONS, type CollectionSection } from './sections'

/** Accueil de l'onglet Collection : un accès par type d'élément à suivre. */
export function CollectionScreen({ critters, tales, recipes }: { critters: CrittersState; tales: TalesState; recipes: RecipesState }) {
  const stats = obtainedStats(critters.data)
  const puzzles = summarizeTales(tales.data)
  const cookbook = summarizeRecipes(recipes.data)

  const card = 'glass flex items-center gap-4 rounded-[1.75rem] p-4 text-left'

  const body = (s: CollectionSection) => (
    <>
      <span className="text-4xl" aria-hidden>
        {s.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-semibold text-plum-900">
          {s.label}
          {s.status === 'soon' && <span className="ml-2 rounded-full bg-plum-100 px-2 py-0.5 align-middle text-xs font-semibold text-plum-600">À venir</span>}
        </span>
        <span className="block text-xs text-plum-600">{s.description}</span>
        {s.id === 'puzzles' && (
          <span className="mt-2 block space-y-1">
            <ProgressBar done={puzzles.done} total={puzzles.total} label="Puzzles terminés" />
            <span className="block text-xs font-semibold text-plum-700" data-testid="puzzles-progress">
              {puzzles.done} terminé{puzzles.done > 1 ? 's' : ''} sur {puzzles.total}
              {puzzles.ready > 0 && ` · ${puzzles.ready} réalisable${puzzles.ready > 1 ? 's' : ''}`}
            </span>
          </span>
        )}
        {s.id === 'recipes' && (
          <span className="mt-2 block space-y-1">
            <ProgressBar done={cookbook.known} total={cookbook.total} label="Recettes connues" />
            <span className="block text-xs font-semibold text-plum-700" data-testid="recipes-card-progress">
              {cookbook.known} connue{cookbook.known > 1 ? 's' : ''} sur {cookbook.total}
              {cookbook.favorites > 0 && ` · ${cookbook.favorites} favorite${cookbook.favorites > 1 ? 's' : ''}`}
            </span>
          </span>
        )}
        {s.id === 'critters' && (
          <span className="mt-2 block space-y-1">
            <ProgressBar done={stats.obtained} total={stats.total} label="Animaux obtenus" />
            <span className="block text-xs font-semibold text-plum-700" data-testid="critters-progress">
              {stats.obtained} obtenu{stats.obtained > 1 ? 's' : ''} sur {stats.total}
            </span>
            {!critters.data.configured && <span className="block text-xs text-amber-800">Choisis tes extensions pour voir tous tes animaux.</span>}
          </span>
        )}
      </span>
      {s.status === 'available' && (
        <span className="text-2xl text-plum-500" aria-hidden>
          ›
        </span>
      )}
    </>
  )

  return (
    <div className="animate-fade-up space-y-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header>
        <h1 className="text-gold font-magic text-3xl font-bold">Collection</h1>
        <p className="mt-1 text-sm text-plum-100/85">Ce que tu as déjà trouvé dans la vallée, et ce qu’il te reste à découvrir.</p>
      </header>
      <ul className="space-y-3" aria-label="Sections de la collection">
        {COLLECTION_SECTIONS.map((s) => (
          <li key={s.id}>
            {s.status === 'available' && s.route ? (
              <a href={hrefFor(s.route)} className={`${card} transition active:scale-[0.97]`}>
                {body(s)}
              </a>
            ) : (
              <div className={`${card} opacity-60`} aria-disabled="true">
                {body(s)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
