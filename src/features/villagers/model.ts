import { isCharacterId } from '../../data/characters'
import { isPlainObject } from '../../lib/db'

/**
 * Suivi des habitants dans la partie de la joueuse : débloqué, niveau d'amitié,
 * objet déjà demandé. Saisi à la main, jamais déduit du jeu.
 *
 * Niveaux d'amitié : 1 à 10 (le niveau 10 est le maximum, statut « Best Friend » sur
 * le wiki ; le libellé français officiel n'est pas vérifié, l'app affiche donc
 * « niveau maximum »). Source : https://dreamlightvalleywiki.com/Friendship,
 * vérifiée le 09/11/2026.
 *
 * Clé IndexedDB : `villagers` → { [idHabitant]: VillagerState }. Une entrée vide est retirée.
 */
export const VILLAGERS_KEY = 'villagers'
export const FRIENDSHIP_MIN = 1
export const FRIENDSHIP_MAX = 10
export const FRIENDSHIP_SOURCE = 'https://dreamlightvalleywiki.com/Friendship'
export const FRIENDSHIP_VERIFIED_AT = '2026-11-09'

export interface VillagerState {
  /** Débloqué dans la partie (coché par la joueuse) */
  unlocked?: true
  /** Niveau d'amitié saisi à la main (1 à 10) */
  friendship?: number
  /** Un objet a déjà été demandé à cet habitant (décoché seulement à la main) */
  askedItem?: true
}

export type Villagers = Record<string, VillagerState>

/** Modification d'un habitant : `null` efface le champ. Seuls les champs fournis changent. */
export interface VillagerPatch {
  unlocked?: boolean
  friendship?: number | null
  askedItem?: boolean
}

/** « Niveau 4 », « Niveau 10 (max) » ou « Non renseignée ». */
export function formatFriendship(v: number | undefined): string {
  return v === undefined ? 'Non renseignée' : v === FRIENDSHIP_MAX ? `Niveau ${v} (max)` : `Niveau ${v}`
}

export function isFriendshipLevel(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= FRIENDSHIP_MIN && v <= FRIENDSHIP_MAX
}

export function sanitizeVillagerState(raw: unknown): VillagerState {
  const out: VillagerState = {}
  if (!isPlainObject(raw)) return out
  if (raw.unlocked === true) out.unlocked = true
  if (isFriendshipLevel(raw.friendship)) out.friendship = raw.friendship
  if (raw.askedItem === true) out.askedItem = true
  return out
}

/** Ne garde que les habitants du catalogue et les valeurs valides. */
export function sanitizeVillagers(raw: unknown): Villagers {
  const out: Villagers = {}
  if (!isPlainObject(raw)) return out
  for (const [id, value] of Object.entries(raw)) {
    if (!isCharacterId(id)) continue
    const state = sanitizeVillagerState(value)
    if (Object.keys(state).length) out[id] = state
  }
  return out
}

export function isValidPatch(patch: VillagerPatch): boolean {
  if (patch.unlocked !== undefined && typeof patch.unlocked !== 'boolean') return false
  if (patch.askedItem !== undefined && typeof patch.askedItem !== 'boolean') return false
  if (patch.friendship !== undefined && patch.friendship !== null && !isFriendshipLevel(patch.friendship)) return false
  return true
}

/**
 * Applique une modification à l'entrée brute enregistrée. Les champs non concernés
 * sont gardés tels quels (deux onglets peuvent modifier deux champs du même habitant).
 */
export function applyPatch(raw: unknown, patch: VillagerPatch): Record<string, unknown> {
  const next: Record<string, unknown> = isPlainObject(raw) ? { ...raw } : {}
  if (patch.unlocked !== undefined) {
    if (patch.unlocked) next.unlocked = true
    else delete next.unlocked
  }
  if (patch.askedItem !== undefined) {
    if (patch.askedItem) next.askedItem = true
    else delete next.askedItem
  }
  if (patch.friendship !== undefined) {
    if (patch.friendship === null) delete next.friendship
    else next.friendship = patch.friendship
  }
  return next
}

/**
 * Débloqué tel qu'affiché : coché par la joueuse, ou implicite parce que l'habitant
 * a un métier (un rôle ne s'attribue qu'à un habitant présent dans la vallée).
 */
export function isUnlocked(villagers: Villagers, assignments: Record<string, unknown>, id: string): boolean {
  return villagers[id]?.unlocked === true || Object.hasOwn(assignments, id)
}

/** Habitants ayant un métier → débloqués (migration v3, puis à chaque attribution). */
export function unlockAssigned(villagersRaw: unknown, assignedIds: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = isPlainObject(villagersRaw) ? { ...villagersRaw } : {}
  for (const id of assignedIds) out[id] = applyPatch(out[id], { unlocked: true })
  return out
}
