import { GATHERING_SOURCES } from './gathering'

/** Liens vers les guides d'où viennent les capacités de collecte (données provisoires, à confirmer avec le wiki). */
export function GatheringSources() {
  return (
    <span data-testid="gathering-sources">
      {GATHERING_SOURCES.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ', '}
          <a href={s.url} target="_blank" rel="noreferrer" className="underline">
            {s.label}
          </a>
        </span>
      ))}
    </span>
  )
}
