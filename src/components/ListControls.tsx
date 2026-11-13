import { useId } from 'react'
import type { SortDirection } from '../lib/listSort'

/** Commandes communes aux listes (Habitants, Animaux) : tri et sens, bascule de filtre, filtres actifs. */

export interface SortOption<K extends string> {
  id: K
  label: string
  /** Libellés du sens (« A → Z », « Z → A »). Absent : l'ordre n'a pas de sens à inverser (ordre par défaut). */
  directions?: Record<SortDirection, string>
}

export interface SortState<K extends string> {
  key: K
  direction: SortDirection
}

interface SortBarProps<K extends string> {
  /** Nom du groupe pour les lecteurs d'écran */
  label: string
  options: SortOption<K>[]
  value: SortState<K>
  onChange: (value: SortState<K>) => void
}

const pill =
  'rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition active:scale-95 disabled:opacity-40 disabled:active:scale-100'
const pillIdle = 'bg-white/10 text-plum-50 ring-1 ring-white/20'

/** Liste déroulante du critère de tri + bouton qui en inverse le sens. */
export function SortBar<K extends string>({ label, options, value, onChange }: SortBarProps<K>) {
  const selectId = useId()
  const current = options.find((o) => o.id === value.key) ?? options[0]
  const dirLabel = current.directions?.[value.direction]
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <label htmlFor={selectId} className="shrink-0 text-sm font-semibold text-plum-100">
        Trier
      </label>
      <select
        id={selectId}
        value={current.id}
        onChange={(e) => onChange({ key: e.target.value as K, direction: 'asc' })}
        className={`${pill} ${pillIdle} min-w-0 flex-1 appearance-none truncate pr-8 [&>option]:text-plum-900`}
        style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)', backgroundPosition: 'calc(100% - 1.15rem) 55%, calc(100% - 0.8rem) 55%', backgroundSize: '0.35rem 0.35rem', backgroundRepeat: 'no-repeat' }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!dirLabel}
        onClick={() => onChange({ key: current.id, direction: value.direction === 'asc' ? 'desc' : 'asc' })}
        aria-label={dirLabel ? `Inverser le tri (actuellement : ${dirLabel})` : 'Inverser le tri (indisponible pour cet ordre)'}
        className={`${pill} ${pillIdle} shrink-0`}
      >
        <span aria-hidden>↕</span> {dirLabel ?? 'Sens'}
      </button>
    </div>
  )
}

interface ToggleChipProps {
  label: string
  pressed: boolean
  onChange: (pressed: boolean) => void
}

/** Filtre qu'on active ou désactive (indépendant des autres filtres). */
export function ToggleChip({ label, pressed, onChange }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={`${pill} ${pressed ? 'bg-gold-300 text-night-900 shadow-[0_0_12px_rgb(255_214_107/0.6)]' : pillIdle}`}
    >
      {label}
    </button>
  )
}

export interface ActiveFilter {
  id: string
  label: string
}

interface ActiveFiltersProps {
  items: ActiveFilter[]
  onRemove: (id: string) => void
  onReset: () => void
}

/** Rappel des filtres et tris en cours, chacun retirable, avec retour à l'affichage complet. N'affiche rien si aucun. */
export function ActiveFilters({ items, onRemove, onReset }: ActiveFiltersProps) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtres actifs" data-testid="active-filters">
      <span className="text-xs font-semibold text-plum-100">Actifs :</span>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Retirer : ${item.label}`}
          className="rounded-full bg-gold-300/90 px-2.5 py-1 text-xs font-semibold text-night-900 transition active:scale-95"
        >
          {item.label} <span aria-hidden>✕</span>
        </button>
      ))}
      <button type="button" onClick={onReset} className="rounded-full px-2.5 py-1 text-xs font-semibold text-gold-200 underline active:scale-95">
        Tout réinitialiser
      </button>
    </div>
  )
}
