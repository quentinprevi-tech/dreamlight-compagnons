import { hrefFor, type Route } from '../lib/router'

const VIEWS: { route: Route; label: string; match: Route['name'][] }[] = [
  { route: { name: 'characters' }, label: 'Habitants', match: ['characters'] },
  { route: { name: 'professions' }, label: 'Métiers', match: ['professions', 'profession'] },
  { route: { name: 'scramblecoin' }, label: 'Numismagie', match: ['scramblecoin'] },
]

/** Sélecteur de l'onglet « Habitants » : Habitants / Métiers / Numismagie. */
export function VillagerTabs({ current }: { current: Route['name'] }) {
  return (
    <nav aria-label="Vues des habitants" className="mb-6 pt-[env(safe-area-inset-top)]">
      <ul className="flex rounded-full bg-night-900/70 p-1 ring-1 ring-gold-300/40 backdrop-blur-md">
        {VIEWS.map((v) => {
          const active = v.match.includes(current)
          return (
            <li key={v.label} className="flex-1">
              <a
                href={hrefFor(v.route)}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-full py-2 text-center text-sm font-semibold transition ${
                  active ? 'bg-gold-300 text-night-900 shadow-[0_0_12px_rgb(255_214_107/0.5)]' : 'text-plum-100'
                }`}
              >
                {v.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
