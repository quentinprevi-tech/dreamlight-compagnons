import { useCallback, useState } from 'react'
import { CHARACTERS_BY_ID } from './data/characters'
import { AssignSheet } from './components/AssignSheet'
import { isUnlocked } from './features/villagers/model'
import { LoadErrorScreen } from './components/LoadErrorScreen'
import { Sky } from './components/Sky'
import { VillagerTabs } from './components/VillagerTabs'
import { CollectionScreen } from './features/collection/CollectionScreen'
import { CrittersScreen } from './features/critters/CrittersScreen'
import { RecipesScreen } from './features/recipes/RecipesScreen'
import { useRecipes } from './features/recipes/useRecipes'
import { TalesScreen } from './features/tales/TalesScreen'
import { useTales } from './features/tales/useTales'
import { useCritters } from './features/critters/useCritters'
import { TasksSettingsScreen } from './features/tasks/TasksSettingsScreen'
import { TodayScreen } from './features/tasks/TodayScreen'
import { useTasks } from './features/tasks/useTasks'
import { hrefFor, useRoute, VILLAGER_ROUTES, type Route } from './lib/router'
import { useCompanions } from './lib/useCompanions'
import { AboutScreen } from './screens/AboutScreen'
import { CharactersScreen } from './screens/CharactersScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ProfessionScreen } from './screens/ProfessionScreen'
import { ScramblecoinScreen } from './screens/ScramblecoinScreen'

const TABS: { route: Route; label: string; icon: string; match: Route['name'][] }[] = [
  { route: { name: 'today' }, label: 'Aujourd’hui', icon: '✨', match: ['today', 'tasks-settings'] },
  { route: { name: 'characters' }, label: 'Habitants', icon: '🏰', match: VILLAGER_ROUTES },
  { route: { name: 'collection' }, label: 'Collection', icon: '🐾', match: ['collection', 'critters', 'tales', 'recipes'] },
  { route: { name: 'about' }, label: 'Infos', icon: '📜', match: ['about'] },
]

export default function App() {
  const route = useRoute()
  const companions = useCompanions()
  const tasks = useTasks()
  const critters = useCritters()
  const tales = useTales()
  const recipes = useRecipes()
  const ready = companions.ready && tasks.ready && critters.ready && tales.ready && recipes.ready
  // Toute erreur de chargement bloque l'app (habitants, tâches ou animaux).
  const loadError = companions.loadError ?? tasks.failure ?? critters.failure ?? tales.failure ?? recipes.failure
  const [openId, setOpenId] = useState<string | null>(null)
  const closeSheet = useCallback(() => setOpenId(null), [])
  const open = openId ? CHARACTERS_BY_ID[openId] : undefined

  return (
    <div className={`mx-auto flex min-h-dvh max-w-md flex-col ${route.name === 'scramblecoin' ? 'md:max-w-3xl' : ''}`}>
      <Sky />
      <main className="flex-1 px-4 pt-4 pb-28">
        {ready && !loadError && route.name !== 'profession' && VILLAGER_ROUTES.includes(route.name) && <VillagerTabs current={route.name} />}
        {!ready ? (
          <p className="mt-24 animate-pulse text-center font-display text-xl text-gold-200">✨ Ouverture de la vallée…</p>
        ) : loadError ? (
          <LoadErrorScreen error={loadError} />
        ) : route.name === 'today' ? (
          <TodayScreen tasks={tasks} critters={critters} />
        ) : route.name === 'collection' ? (
          <CollectionScreen critters={critters} tales={tales} recipes={recipes} />
        ) : route.name === 'tales' ? (
          <TalesScreen tales={tales} companions={companions} />
        ) : route.name === 'recipes' ? (
          <RecipesScreen recipes={recipes} companions={companions} />
        ) : route.name === 'critters' ? (
          <CrittersScreen critters={critters} companions={companions} now={tasks.now} view={route.view} />
        ) : route.name === 'tasks-settings' ? (
          <TasksSettingsScreen tasks={tasks} />
        ) : route.name === 'profession' ? (
          <ProfessionScreen key={route.id} professionId={route.id} companions={companions} onOpenCharacter={setOpenId} />
        ) : route.name === 'characters' ? (
          <CharactersScreen companions={companions} onOpenCharacter={setOpenId} />
        ) : route.name === 'scramblecoin' ? (
          <ScramblecoinScreen portraits={companions.portraits} />
        ) : route.name === 'about' ? (
          <AboutScreen
            companions={companions}
            onRestored={() => {
              tasks.reload()
              critters.reload()
              tales.reload()
              recipes.reload()
            }}
          />
        ) : (
          <HomeScreen assignments={companions.assignments} />
        )}
        {companions.saveError && (
          <p role="alert" className="mt-4 rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
            {companions.saveError}
          </p>
        )}
      </main>

      {!loadError && (
        <nav
          aria-label="Navigation principale"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <ul className="flex justify-around rounded-full bg-night-900/85 p-1.5 shadow-xl shadow-night-950/60 ring-1 ring-gold-300/40 backdrop-blur-md">
            {TABS.map((t) => {
              const active = t.match.includes(route.name)
              return (
                <li key={t.label} className="flex-1">
                  <a
                    href={hrefFor(t.route)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center rounded-full py-1.5 text-xs font-semibold transition ${
                      active ? 'bg-gold-300/20 text-gold-200 ring-1 ring-gold-300/50' : 'text-plum-200/80'
                    }`}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {t.icon}
                    </span>
                    {t.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {open && !loadError && (
        <AssignSheet
          character={open}
          current={companions.assignments[open.id]}
          portrait={companions.portraits[open.id]}
          villager={companions.villagers[open.id] ?? {}}
          unlocked={isUnlocked(companions.villagers, companions.assignments, open.id)}
          onVillager={(patch) => companions.updateVillager(open.id, patch)}
          onAssign={(p) => companions.assign(open.id, p)}
          onPortrait={(blob) => companions.setPortrait(open.id, blob)}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}
