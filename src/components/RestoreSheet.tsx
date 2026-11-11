import type { ParsedBackup, PlanAction, PlanItem } from '../lib/backup'
import { BottomSheet } from './BottomSheet'

const ACTION: Record<PlanAction, { icon: string; label: string; className: string }> = {
  replace: { icon: '🔁', label: 'Remplacé', className: 'bg-plum-100 text-plum-800' },
  keep: { icon: '🛡️', label: 'Conservé', className: 'bg-emerald-100 text-emerald-800' },
  delete: { icon: '🗑️', label: 'Supprimé', className: 'bg-rose-100 text-rose-800' },
  ignore: { icon: '⚠️', label: 'Ignoré', className: 'bg-amber-100 text-amber-800' },
}

interface Props {
  parsed: ParsedBackup
  plan: PlanItem[]
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Confirmation d'un import : ce qui sera remplacé, conservé ou supprimé. */
export function RestoreSheet({ parsed, plan, busy, onConfirm, onClose }: Props) {
  const complete = parsed.type === 'complete'
  const date = parsed.exportedAt ? new Date(parsed.exportedAt) : undefined

  return (
    <BottomSheet
      onClose={onClose}
      labelledBy="restore-title"
      panelClassName="flex max-h-[90dvh] flex-col overflow-y-auto overscroll-contain bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <h2 id="restore-title" className="font-display text-2xl font-semibold text-plum-900">
        {complete ? 'Restauration complète' : 'Import partiel'}
      </h2>
      <p className="mt-1 text-sm text-plum-600">
        {date && !Number.isNaN(date.getTime()) ? `Sauvegarde du ${date.toLocaleDateString('fr-FR')}. ` : ''}
        {parsed.format === 1
          ? 'Ancienne sauvegarde : seuls les métiers seront restaurés.'
          : complete
            ? 'Les données du fichier remplacent celles du téléphone.'
            : 'Seules les données présentes dans le fichier remplacent celles du téléphone.'}
      </p>

      <ul className="mt-4 space-y-2" aria-label="Ce que la restauration va faire">
        {plan.map((item) => (
          <li key={item.id} className="rounded-2xl bg-plum-50 p-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTION[item.action].className}`}>
                <span aria-hidden>{ACTION[item.action].icon}</span> {ACTION[item.action].label}
              </span>
              <span className="font-semibold text-plum-900">{item.label}</span>
            </div>
            <p className="mt-1 text-sm text-plum-700">{item.detail}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-plum-500">
        Une copie de l’état actuel est gardée sur le téléphone : tu pourras annuler cette restauration depuis Infos.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-full bg-plum-700 px-4 py-3 font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {busy ? 'Restauration…' : 'Restaurer'}
        </button>
        <button onClick={onClose} disabled={busy} className="rounded-full bg-plum-100 px-4 py-3 font-semibold text-plum-800 active:scale-95">
          Annuler
        </button>
      </div>
    </BottomSheet>
  )
}
