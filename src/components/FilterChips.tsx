interface Chip<T> {
  id: T
  label: string
}

interface Props<T> {
  /** Nom du groupe pour les lecteurs d'écran (« Filtrer par métier »…) */
  label: string
  chips: Chip<T>[]
  value: T
  onChange: (value: T) => void
}

/** Rangée de filtres défilant horizontalement, sous la barre de recherche. */
export function FilterChips<T extends string | number>({ label, chips, value, onChange }: Props<T>) {
  return (
    <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={label}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onChange(chip.id)}
          aria-pressed={value === chip.id}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
            value === chip.id ? 'bg-gold-300 text-night-900 shadow-[0_0_12px_rgb(255_214_107/0.6)]' : 'bg-white/10 text-plum-50 ring-1 ring-white/20'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
