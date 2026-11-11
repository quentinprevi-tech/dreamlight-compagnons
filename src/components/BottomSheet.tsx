import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { registerSheet } from '../lib/sheetHistory'

interface Props {
  onClose: () => void
  /** Nom accessible : id du titre affiché… */
  labelledBy?: string
  /** …ou texte direct */
  label?: string
  /** Classes du panneau (couleur, hauteur, marges) */
  panelClassName: string
  /** Croix « Fermer » visible en haut à droite (par défaut oui ; une fiche qui a déjà son propre bouton « Terminé » la retire). */
  closeButton?: boolean
  children: ReactNode
}

/** Distance (px) au-delà de laquelle un glissement ferme la fiche. */
const CLOSE_DISTANCE = 100
/** Vitesse (px/ms) à partir de laquelle un geste court mais vif ferme aussi la fiche. */
const CLOSE_VELOCITY = 0.5
const SNAP_MS = 200

interface OpenSheet {
  id: symbol
  /** Enveloppe plein écran (fond + panneau) : c'est elle qu'on rend inerte quand une autre fiche est par-dessus */
  root: HTMLElement
  /** Panneau (`role="dialog"`) : reçoit le focus à l'ouverture */
  panel: HTMLElement
}

/**
 * Fiches ouvertes en ce moment, de la plus ancienne à la plus récente.
 * Seule la dernière réagit à Échap et à Tab : si une fiche en ouvre une autre par-dessus, la fiche du dessous
 * est inerte (ni clavier, ni lecteur d'écran) jusqu'à la fermeture de celle du dessus.
 */
const openSheets: OpenSheet[] = []
/** Valeur de `overflow` de la page avant l'ouverture de la première fiche (rétablie à la fermeture de la dernière). */
let pageOverflow = ''
/** Élément qui avait le focus quand la première fiche s'est ouverte : c'est là que le focus revient à la fin. */
let baseOpener: Element | null = null

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]'

/** Éléments atteignables à la touche Tab dans la fiche (sans ceux d'une liste repliée, désactivés ou masqués). */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.getAttribute('tabindex') === '-1' || el.hidden || (el as HTMLButtonElement).disabled) return false
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
      if (p.hidden || p.hasAttribute('inert')) return false
      // contenu d'un <details> replié : seul son <summary> reste atteignable
      if (p instanceof HTMLDetailsElement && !p.open && !(el.tagName === 'SUMMARY' && el.parentElement === p)) return false
    }
    return true
  })
}

/** Le fond de l'application et les fiches du dessous deviennent inertes tant qu'une fiche est au premier plan. */
function syncInert() {
  document.getElementById('root')?.toggleAttribute('inert', openSheets.length > 0)
  openSheets.forEach((sheet, i) => sheet.root.toggleAttribute('inert', i !== openSheets.length - 1))
}

const prefersReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Fiche qui monte du bas de l'écran. Quatre façons de la fermer, dont aucune n'est obligatoire :
 * la croix ✕ (toujours visible, même quand la fiche défile), un clic à côté, la touche Échap,
 * et le glissement vers le bas (depuis la poignée, ou depuis n'importe où quand le contenu est tout en haut).
 *
 * Rendue dans `document.body` (portail) : sur iOS Safari, un `position: fixed`
 * placé dans un parent animé se positionne mal.
 *
 * Le glissement déplace l'enveloppe extérieure (`dragRef`), pas le panneau : le panneau porte déjà
 * l'animation d'ouverture, et une animation CSS l'emporterait sur un `transform` posé à la main.
 */
export function BottomSheet({ onClose, labelledBy, label, panelClassName, closeButton = true, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLButtonElement>(null)
  /** Vrai pendant l'animation de sortie d'un glissement : plus aucun geste n'est pris en compte. */
  const closing = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  // `onClose` change à chaque rendu du parent : on garde la dernière version sans refaire les écouteurs.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Le parent peut refuser (ex. : opération en cours) : la fiche reste alors affichée, la croix refonctionne.
  const requestClose = useCallback(() => onCloseRef.current(), [])

  // Élément qui avait le focus juste avant l'ouverture (lu pendant le rendu : un champ à `autoFocus` de la fiche
  // prendrait le focus avant l'exécution des effets). Pour la première fiche, on le garde aussi à part (`baseOpener`) :
  // quand une fiche en remplace une autre (recette → renommage), l'élément d'origine de la seconde a disparu.
  const [opener] = useState(() => {
    const active = document.activeElement
    if (openSheets.length === 0) baseOpener = active
    return active
  })

  // Vie de la fiche : pile des fiches, défilement de la page, inertie du fond, historique (bouton « Retour »),
  // focus (entrée, piège à la touche Tab, retour à l'élément d'origine) et Échap (la fiche du dessus seulement).
  useEffect(() => {
    const root = rootRef.current
    const panel = panelRef.current
    if (!root || !panel) return
    const me: OpenSheet = { id: Symbol('sheet'), root, panel }
    if (openSheets.length === 0) {
      pageOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openSheets.push(me)
    syncInert()
    const unregisterHistory = registerSheet(() => onCloseRef.current())
    // Le focus entre dans la fiche (sauf si un champ de la fiche l'a déjà pris)
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== me) return
      if (e.key === 'Escape') return requestClose()
      if (e.key !== 'Tab') return
      // Piège du focus : Tab et Maj+Tab tournent à l'intérieur de la fiche
      const items = focusablesIn(panel)
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!first) {
        e.preventDefault()
        panel.focus({ preventScroll: true })
      } else if (!panel.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      unregisterHistory()
      const at = openSheets.indexOf(me)
      if (at >= 0) openSheets.splice(at, 1)
      syncInert()
      // Quelle que soit la fiche fermée en premier, la page ne se débloque qu'à la fermeture de la dernière.
      if (openSheets.length === 0) document.body.style.overflow = pageOverflow
      // Le focus revient : à la fiche qui reste dessous, sinon à l'élément qui a ouvert la première fiche.
      // (Après un clic ailleurs, le focus n'est plus perdu : on ne le vole pas.)
      const lost = !document.activeElement || document.activeElement === document.body
      if (lost) {
        const remaining = openSheets[openSheets.length - 1]
        const target = [opener, baseOpener].find((el): el is HTMLElement => el instanceof HTMLElement && el.isConnected)
        if (remaining) remaining.panel.focus({ preventScroll: true })
        else target?.focus({ preventScroll: true })
      }
    }
  }, [requestClose, opener])

  // Glissement vers le bas (écouteurs natifs : « non passifs », pour pouvoir bloquer le défilement pendant le geste)
  useEffect(() => {
    const drag = dragRef.current
    const panel = panelRef.current
    const handle = handleRef.current
    if (!drag || !panel || !handle) return
    let start: { x: number; y: number; t: number; fromHandle: boolean } | null = null
    let mode: 'pending' | 'drag' | 'ignore' = 'pending'
    let dy = 0

    const paint = (distance: number, animated: boolean) => {
      drag.style.transition = animated ? `transform ${SNAP_MS}ms ease-out` : 'none'
      drag.style.transform = distance ? `translateY(${distance}px)` : ''
      if (backdropRef.current) backdropRef.current.style.opacity = String(Math.max(0, 1 - distance / 400))
    }

    const onStart = (e: TouchEvent) => {
      if (closing.current || e.touches.length !== 1) {
        mode = 'ignore'
        start = null
        return
      }
      const target = e.target as Element
      const fromHandle = handle.contains(target)
      // Un champ, un curseur ou un contenu qui a déjà défilé gardent leur geste habituel.
      const keepsGesture = !!target.closest('input, textarea, select, [role="slider"]')
      mode = keepsGesture || (!fromHandle && panel.scrollTop > 0) ? 'ignore' : 'pending'
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp, fromHandle }
      dy = 0
    }

    const onMove = (e: TouchEvent) => {
      if (!start || mode === 'ignore') return
      const t = e.touches[0]
      const moveX = t.clientX - start.x
      const moveY = t.clientY - start.y
      if (mode === 'pending') {
        if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) return
        // Geste horizontal, ou vers le haut depuis le contenu : on laisse faire le navigateur.
        if (Math.abs(moveX) > Math.abs(moveY) || (moveY < 0 && !start.fromHandle)) {
          mode = 'ignore'
          return
        }
        mode = 'drag'
      }
      if (e.cancelable) e.preventDefault()
      dy = Math.max(0, moveY)
      paint(dy, false)
    }

    const onEnd = (e: TouchEvent) => {
      const wasDragging = mode === 'drag'
      const began = start
      start = null
      mode = 'pending'
      if (!wasDragging || !began) return
      const elapsed = Math.max(1, e.timeStamp - began.t)
      if (dy > CLOSE_DISTANCE || (dy > 40 && dy / elapsed > CLOSE_VELOCITY)) {
        if (prefersReducedMotion()) return requestClose()
        closing.current = true
        paint(panel.offsetHeight, true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          requestClose()
          // Si le parent a refusé de fermer, la fiche revient à sa place au lieu de rester hors de l'écran.
          timer.current = window.setTimeout(() => {
            closing.current = false
            paint(0, true)
          }, 50)
        }, SNAP_MS)
      } else {
        paint(0, true)
      }
    }

    const onCancel = () => {
      if (mode === 'drag') paint(0, true)
      start = null
      mode = 'pending'
    }

    drag.addEventListener('touchstart', onStart, { passive: true })
    drag.addEventListener('touchmove', onMove, { passive: false })
    drag.addEventListener('touchend', onEnd)
    drag.addEventListener('touchcancel', onCancel)
    return () => {
      drag.removeEventListener('touchstart', onStart)
      drag.removeEventListener('touchmove', onMove)
      drag.removeEventListener('touchend', onEnd)
      drag.removeEventListener('touchcancel', onCancel)
      window.clearTimeout(timer.current)
    }
  }, [requestClose])

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Clic à côté pour fermer. Masqué pour les lecteurs d'écran : la croix et Échap font le même travail. */}
      <button
        ref={backdropRef}
        type="button"
        tabIndex={-1}
        aria-hidden
        data-testid="sheet-backdrop"
        className="absolute inset-0 animate-fade-in bg-night-950/60 backdrop-blur-[2px]"
        onClick={requestClose}
      />
      <div ref={dragRef} data-testid="sheet-mover" className="relative w-full max-w-md">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : label}
          tabIndex={-1}
          className={`animate-sheet-up rounded-t-[2rem] shadow-2xl outline-none ${panelClassName}`}
        >
          {closeButton && (
            // Hauteur nulle + « sticky » : la croix reste visible en haut quand la fiche défile, sans prendre de place.
            <div className="sticky top-2 z-10 flex h-0 justify-end">
              <button
                type="button"
                onClick={requestClose}
                aria-label="Fermer"
                data-testid="sheet-close"
                className="-mt-1 -mr-2 grid size-9 place-items-center rounded-full bg-plum-100 text-lg font-bold text-plum-700 shadow-sm ring-1 ring-plum-200 active:scale-95"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>
          )}
          {/* Poignée : zone de saisie large (28 px de haut) pour le glissement ; « touch-none » empêche le défilement de la voler. */}
          <div ref={handleRef} data-testid="sheet-handle" aria-hidden className="mx-auto flex h-7 w-full shrink-0 touch-none justify-center">
            <div className="h-1.5 w-12 rounded-full bg-plum-200" />
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
