import type { Feedings } from './data'

/**
 * Seuil de nourrissages indiqué par le wiki (champ « Minimum Feedings »). Trois cas à ne jamais confondre :
 * - `exact` (« 3 ») : le wiki donne le nombre de nourrissages nécessaires ;
 * - `at-least` (« 3+ ») : le wiki indique « au moins 3 » (« a minimum of 3 ») ; le seuil réel est inconnu
 *   et peut être plus élevé ;
 * - `unknown` : le wiki n'indique rien (22 variantes).
 * Aucun nombre de nourrissages n'est présenté comme une garantie d'obtention pour `at-least` et `unknown` :
 * seule la case « Obtenu », cochée par la joueuse, confirme qu'un animal est dans sa collection.
 */
export type ThresholdKind = 'exact' | 'at-least' | 'unknown'

export function thresholdKind(f?: Feedings): ThresholdKind {
  return !f ? 'unknown' : f.exact ? 'exact' : 'at-least'
}

/** Compteur d'une ligne : « 2/3 » seulement pour un seuil exact ; jamais de fraction sinon. */
export function feedingsLabel(count: number, f?: Feedings): string {
  switch (thresholdKind(f)) {
    case 'exact':
      return `${count}/${f!.min}`
    case 'at-least':
      return `${count} · au moins ${f!.min}`
    default:
      return `${count} · seuil inconnu`
  }
}

/** Étiquette du seuil dans la fiche. */
export function thresholdChip(f?: Feedings): string {
  switch (thresholdKind(f)) {
    case 'exact':
      return `Seuil exact : ${f!.min}`
    case 'at-least':
      return `Au moins ${f!.min} (seuil exact inconnu)`
    default:
      return 'Seuil inconnu'
  }
}

export function thresholdExplanation(f?: Feedings): string {
  switch (thresholdKind(f)) {
    case 'exact':
      return `Le wiki indique qu’il faut nourrir cet animal ${f!.min} fois.`
    case 'at-least':
      return `Le wiki indique « au moins ${f!.min} » : le seuil réel n’est pas connu et peut être plus élevé. ${f!.min} nourrissages ne garantissent pas l’obtention.`
    default:
      return 'Le wiki n’indique aucun seuil pour cet animal : aucun nombre de nourrissages ne garantit son obtention.'
  }
}

/** Message quand le total atteint le nombre du wiki (rien pour un seuil inconnu : il n'y a rien à « atteindre »). */
export function reachedMessage(f: Feedings | undefined, count: number): string | null {
  if (!f || count < f.min) return null
  return f.exact
    ? `Tu as atteint le nombre de nourrissages indiqué par le wiki (${f.min}). Si l’animal n’est pas encore dans ta collection, vérifie en jeu : ne coche « Obtenu » que lorsqu’il y est.`
    : `Tu as atteint ${f.min}, mais le wiki indique seulement « au moins ${f.min} » : l’animal peut demander davantage. Ne coche « Obtenu » que lorsqu’il apparaît dans ta collection.`
}

export const OBTAINED_RULE = 'Seule la case « Obtenu », que tu coches quand l’animal est dans ta collection, fait foi.'
