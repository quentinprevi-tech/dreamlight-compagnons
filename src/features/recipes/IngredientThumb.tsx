import { useState } from 'react'

interface Props {
  /** Adresse de la vignette, ou undefined si aucune n'est connue */
  src: string | undefined
  /** Emoji affiché tant que l'image n'est pas arrivée, ou à sa place si elle est indisponible */
  fallback: string
  /** Côté en pixels (carré) */
  size?: number
}

/**
 * Miniature d'un ingrédient. Décorative : le nom de l'ingrédient est toujours écrit à côté,
 * donc l'image n'a pas de texte alternatif et l'emoji est caché des lecteurs d'écran.
 *
 * - `loading="lazy"` : le navigateur ne charge l'image que lorsqu'elle est (presque) visible,
 *   et jamais celles d'une liste repliée ; la fiche s'ouvre sans attendre le réseau ;
 * - tant que l'image n'est pas chargée (ou hors ligne, ou si le wiki ne répond pas), l'emoji reste affiché ;
 * - la place est réservée (carré de taille fixe) : rien ne bouge quand l'image arrive.
 */
export function IngredientThumb({ src, fallback, size = 40 }: Props) {
  // On retient quelle adresse a échoué / chargé : si `src` change (autre ingrédient), on repart de zéro.
  const [status, setStatus] = useState<{ src?: string; state: 'loaded' | 'failed' }>({ state: 'failed' })
  const state = src && status.src === src ? status.state : src ? 'loading' : 'failed'
  return (
    <span
      data-testid="ingredient-thumb"
      data-state={state}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-plum-200"
    >
      {state !== 'loaded' && (
        <span aria-hidden data-testid="ingredient-emoji" className="leading-none">
          {fallback}
        </span>
      )}
      {src && state !== 'failed' && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          width={size}
          height={size}
          onLoad={() => setStatus({ src, state: 'loaded' })}
          onError={() => setStatus({ src, state: 'failed' })}
          className={`absolute inset-0 size-full object-contain p-0.5 transition-opacity ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </span>
  )
}
