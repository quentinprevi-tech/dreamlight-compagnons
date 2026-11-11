import { createPortal } from 'react-dom'
import { useEffect, type ReactNode } from 'react'

interface Props {
  onClose: () => void
  /** Nom accessible : id du titre affiché… */
  labelledBy?: string
  /** …ou texte direct */
  label?: string
  /** Classes du panneau (couleur, hauteur, marges) */
  panelClassName: string
  children: ReactNode
}

/**
 * Fiche qui monte du bas de l'écran.
 * Rendue dans `document.body` (portail) : sur iOS Safari, un `position: fixed`
 * placé dans un parent animé se positionne mal.
 */
export function BottomSheet({ onClose, labelledBy, label, panelClassName, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
    >
      <button aria-label="Fermer" className="absolute inset-0 animate-fade-in bg-night-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full max-w-md animate-sheet-up rounded-t-[2rem] shadow-2xl ${panelClassName}`}>{children}</div>
    </div>,
    document.body,
  )
}
