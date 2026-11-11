import { hrefFor } from '../../lib/router'
import type { TaskOverride } from '../tasks/model'
import { summarizeToday, type CrittersData } from './model'

/** Identifiant de la tâche du catalogue qui devient la ligne agrégée (voir `tasks/catalog.ts`). */
export const CRITTERS_TASK_ID = 'feed-critters'

/**
 * Ligne « 🐾 Animaux à nourrir : X/Y » de l'écran Aujourd'hui.
 * Calculée depuis le suivi (jamais cochée à la main), donc mise à jour dès qu'un nourrissage est enregistré :
 * - rien à nourrir aujourd'hui (Y = 0) → la ligne disparaît ;
 * - il reste des animaux (présents ou à venir) → « À faire » ;
 * - tous les animaux réalisables sont nourris → « Terminées ».
 * Un animal obtenu, d'une extension non possédée, à horaire inconnu, sous condition ou dont le
 * créneau est passé n'est jamais dans X/Y.
 */
export function critterTaskOverride(data: CrittersData, now: Date): TaskOverride {
  const s = summarizeToday(data, now)
  if (s.total === 0) return { state: 'hidden' }
  const remaining = s.toFeed.length
  const parts: string[] = []
  if (remaining > 0) parts.push(`${remaining} à nourrir`)
  if (s.missed.length > 0) parts.push(`${s.missed.length} occasion${s.missed.length > 1 ? 's' : ''} manquée${s.missed.length > 1 ? 's' : ''}`)
  // Tant que les extensions ne sont pas choisies, seul le jeu de base est compté : on le dit.
  if (!data.configured) parts.push('extensions à choisir')
  return {
    state: remaining === 0 ? 'done' : 'todo',
    label: `🐾 Animaux à nourrir : ${s.done}/${s.total}`,
    meta: remaining === 0 ? 'Tout est nourri pour aujourd’hui' + (data.configured ? '' : ' · extensions à choisir') : parts.join(' · '),
    href: hrefFor({ name: 'critters', view: 'today' }),
  }
}
