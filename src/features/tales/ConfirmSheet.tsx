import { useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'

export interface RecapRow {
  label: string
  before: number
  after: number
}

interface Props {
  title: string
  message: string
  /** Récapitulatif précis : compteur avant → après */
  rows?: RecapRow[]
  confirmLabel: string
  tone?: 'normal' | 'warning'
  /** Les compteurs ont changé depuis l'ouverture (autre onglet) : confirmation impossible, avec la raison */
  blockedReason?: string
  /** Résout avec `null` si l'opération a réussi, ou avec le message d'erreur (la fiche reste ouverte) */
  onConfirm: () => Promise<string | null>
  onClose: () => void
}

/** Confirmation avant une opération qui change des compteurs : montre exactement ce qui va changer. */
export function ConfirmSheet({ title, message, rows, confirmLabel, tone = 'normal', blockedReason, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    const result = await onConfirm()
    setBusy(false)
    if (result) setError(result)
    else onClose()
  }

  return (
    <BottomSheet onClose={() => !busy && onClose()} labelledBy="confirm-title" panelClassName="max-h-[90dvh] overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-plum-200" />
      <h2 id="confirm-title" className="font-display text-2xl font-semibold text-plum-900">
        {title}
      </h2>
      <p className="mt-1 text-sm text-plum-700">{message}</p>
      {rows && rows.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-2xl bg-plum-50 p-3" aria-label="Récapitulatif">
          {rows.map((r) => {
            const delta = r.after - r.before
            const impossible = r.after < 0 // jamais présenté comme un compteur : l'opération est bloquée
            return (
              <li key={r.label} className="flex items-baseline justify-between gap-3 text-sm text-plum-800">
                <span className="min-w-0 font-semibold">{r.label}</span>
                <span className="shrink-0 tabular-nums">
                  {r.before} → <strong>{impossible ? '—' : r.after}</strong>{' '}
                  <span className={delta < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    ({delta > 0 ? '+' : '−'}
                    {Math.abs(delta)})
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {blockedReason && (
        <p role="status" data-testid="confirm-blocked" className="mt-3 rounded-xl bg-amber-100 p-2 text-sm font-semibold text-amber-900">
          {blockedReason}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-100 p-2 text-sm font-semibold text-rose-800">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => void confirm()}
          disabled={busy || !!blockedReason}
          className={`flex-1 rounded-full px-4 py-3 font-semibold text-white active:scale-95 disabled:opacity-50 ${tone === 'warning' ? 'bg-rose-700' : 'bg-plum-700'}`}
        >
          {busy ? 'En cours…' : confirmLabel}
        </button>
        <button onClick={onClose} disabled={busy} className="rounded-full bg-plum-100 px-4 py-3 font-semibold text-plum-800 active:scale-95">
          Annuler
        </button>
      </div>
    </BottomSheet>
  )
}
