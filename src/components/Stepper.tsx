interface Props {
  /** Nom de la valeur, pour les lecteurs d'écran (« Niveau d'amitié »…) */
  label: string
  /** `undefined` : non renseignée */
  value: number | undefined
  min: number
  max: number
  disabled?: boolean
  format: (value: number | undefined) => string
  /** `undefined` quand on descend sous le minimum : la valeur est effacée */
  onChange: (value: number | undefined) => void
}

/** Compteur − / + (amitié, quantités…). Descendre sous le minimum efface la valeur. */
export function Stepper({ label, value, min, max, disabled = false, format, onChange }: Props) {
  const down = () => onChange(value === undefined || value <= min ? undefined : value - 1)
  const up = () => onChange(value === undefined ? min : Math.min(max, value + 1))
  const button =
    'grid size-10 place-items-center rounded-full bg-white text-xl font-bold text-plum-800 shadow-sm ring-1 ring-plum-100 transition active:scale-90 disabled:opacity-40'

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={down} disabled={disabled || value === undefined} aria-label={`Baisser : ${label}`} className={button}>
        −
      </button>
      <output aria-label={label} aria-live="polite" className="min-w-[6.5rem] text-center text-sm font-semibold text-plum-900">
        {format(value)}
      </output>
      <button type="button" onClick={up} disabled={disabled || value === max} aria-label={`Augmenter : ${label}`} className={button}>
        +
      </button>
    </div>
  )
}
