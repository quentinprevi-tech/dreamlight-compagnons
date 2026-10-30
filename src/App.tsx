import { useCallback, useState } from 'react'
import { CHARACTERS_BY_ID } from './data/characters'
import { AssignSheet } from './components/AssignSheet'
import { hrefFor, useRoute, type Route } from './lib/router'
import { useCompanions } from './lib/useCompanions'
import { AboutScreen } from './screens/AboutScreen'
import { CharactersScreen } from './screens/CharactersScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ProfessionScreen } from './screens/ProfessionScreen'

const TABS: { route: Route; label: string; icon: string; match: Route['name'][] }[] = [
  { route: { name: 'home' }, label: 'Accueil', icon: '✨', match: ['home', 'profession'] },
  { route: { name: 'characters' }, label: 'Habitants', icon: '🏡', match: ['characters'] },
  { route: { name: 'about' }, label: 'Infos', icon: '💾', match: ['about'] },
]

export default function App() {
  const route = useRoute()
  const companions = useCompanions()
  const [openId, setOpenId] = useState<string | null>(null)
  const closeSheet = useCallback(() => setOpenId(null), [])
  const open = openId ? CHARACTERS_BY_ID[openId] : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-4 pb-28">
        {!companions.ready ? (
          <p className="mt-24 animate-pulse text-center font-display text-xl text-plum-500">✨ Ouverture de la vallée…</p>
        ) : route.name === 'profession' ? (
          <ProfessionScreen key={route.id} professionId={route.id} companions={companions} onOpenCharacter={setOpenId} />
        ) : route.name === 'characters' ? (
          <CharactersScreen companions={companions} onOpenCharacter={setOpenId} />
        ) : route.name === 'about' ? (
          <AboutScreen companions={companions} />
        ) : (
          <HomeScreen assignments={companions.assignments} />
        )}
        {companions.saveError && (
          <p role="alert" className="mt-4 rounded-2xl bg-rose-100 p-3 text-sm text-rose-800">
            {companions.saveError}
          </p>
        )}
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <ul className="flex justify-around rounded-full bg-white/90 p-1.5 shadow-xl shadow-plum-900/15 ring-1 ring-plum-100 backdrop-blur-md">
          {TABS.map((t) => {
            const active = t.match.includes(route.name)
            return (
              <li key={t.label} className="flex-1">
                <a
                  href={hrefFor(t.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center rounded-full py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-plum-100 text-plum-900' : 'text-plum-500'
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

      {open && (
        <AssignSheet
          character={open}
          current={companions.assignments[open.id]}
          portrait={companions.portraits[open.id]}
          onAssign={(p) => companions.assign(open.id, p)}
          onPortrait={(blob) => companions.setPortrait(open.id, blob)}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}
