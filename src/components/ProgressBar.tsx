interface Props {
  done: number
  total: number
  label: string
}

/** Barre de progression dorée (journée, collections…). */
export function ProgressBar({ done, total, label }: Props) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} sur ${total}`}
      className="h-3 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-gold-300/40"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-200 shadow-[0_0_10px_rgb(255_214_107/0.7)] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
