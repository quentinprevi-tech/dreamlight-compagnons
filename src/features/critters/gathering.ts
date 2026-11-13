import type { CritterVariant } from './data'

/**
 * Ce que chaque compagnon (animal obtenu) aide à ramasser : « capacité de collecte ».
 *
 * ATTENTION, DONNÉES DE SECONDE MAIN. Le catalogue des animaux (`data.ts`, wiki) ne contient AUCUNE capacité.
 * Le wiki (catégories « … Gathering Companions ») était inaccessible lors de la rédaction (vérification
 * anti-robot, non contournée). Les capacités viennent donc de trois guides de jeu qui concordent :
 *  - Destructoid, « All Companion abilities and rewards in Disney Dreamlight Valley » (31/10/2025) ;
 *  - GameGrin, « What Does Each Companion in Disney Dreamlight Valley Help With? » (22/06/2025) ;
 *  - guide Steam « Sharkke's Guide to Companions » (version d'août 2025).
 * Relevé le 12/11/2026. Ces guides ont plus d'un an : à recouper avec le wiki dès qu'il est accessible.
 *
 * Règles (rien n'est déduit ni deviné) :
 *  - une espèce n'a une capacité que si les trois guides la donnent ; sinon elle est « non renseignée » ;
 *  - espèces non couvertes par ces guides : oie, mouffette, abeille douce, hérisson ;
 *  - exception de variante : le bébé dragon bleu sarcelle (« Teal Baby Dragon ») collecterait des minerais
 *    selon un seul guide, des fragments (comme les autres bébés dragons) selon les autres : non renseigné ;
 *  - les trois variantes « Toon » (capybara, cobra, singe), obtenues par une quête : le guide Steam avertit que les
 *    compagnons de quête, d'événement, notables ou de boutique « peuvent avoir d'autres ressources » (ex. un renard
 *    arc-en-ciel et un écureuil effrayant ramassent des gemmes). Aucun guide ne donne celles des Toon : non renseigné ;
 *  - « Whimsical Creatures » (gemmes, selon deux guides) : aucune correspondance avec nos espèces n'est donnée,
 *    donc rien n'est supposé pour les espèces non couvertes ;
 *  - les trois guides ont probablement la même origine (la liste affichée en jeu) : leur accord ne vaut pas trois
 *    vérifications indépendantes ;
 *  - les compagnons « notables » (Disney, boutique, événements) ont des capacités propres : hors catalogue ;
 *  - les libellés français ci-dessous sont indicatifs, non vérifiés en jeu.
 *
 * Pour corriger : modifier SPECIES_GATHER ou VARIANT_GATHER_OVERRIDE (jamais un identifiant d'espèce ou de variante).
 */

export const GATHERING_VERIFIED_AT = '2026-11-12'
export const GATHERING_SOURCES = [
  { label: 'Destructoid (31/10/2025)', url: 'https://www.destructoid.com/all-companion-abilities-and-rewards-in-disney-dreamlight-valley/' },
  { label: 'GameGrin (22/06/2025)', url: 'https://www.gamegrin.com/news/what-does-each-companion-in-disney-dreamlight-valley-help-with/' },
  { label: 'guide Steam (08/2025)', url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=3542603620' },
] as const

export type GatherId = 'fruit' | 'vegetables' | 'seafood' | 'flowers' | 'fish' | 'gems' | 'soil' | 'timebending' | 'snippets'

export interface GatherType {
  id: GatherId
  /** Libellé français indicatif (non vérifié en jeu) */
  label: string
  emoji: string
  /** Terme anglais des guides */
  termEn: string
}

export const GATHER_TYPES: GatherType[] = [
  { id: 'fruit', label: 'Fruits', emoji: '🍎', termEn: 'Fruit' },
  { id: 'vegetables', label: 'Légumes', emoji: '🥕', termEn: 'Vegetables' },
  { id: 'seafood', label: 'Fruits de mer', emoji: '🐚', termEn: 'Seafood' },
  { id: 'flowers', label: 'Fleurs', emoji: '🌸', termEn: 'Flowers' },
  { id: 'fish', label: 'Poissons', emoji: '🐟', termEn: 'Fish' },
  { id: 'gems', label: 'Gemmes', emoji: '💎', termEn: 'Gems' },
  { id: 'soil', label: 'Terre', emoji: '🟫', termEn: 'Soil' },
  { id: 'timebending', label: 'Courbage temporel', emoji: '⏳', termEn: 'Timebending Parts' },
  { id: 'snippets', label: 'Fragments', emoji: '✨', termEn: 'Snippets' },
]

export const GATHER_BY_ID = Object.fromEntries(GATHER_TYPES.map((g) => [g.id, g])) as Record<GatherId, GatherType>

/** Capacité par identifiant d'espèce (`SPECIES` dans `data.ts`). Absente = non renseignée. */
export const SPECIES_GATHER: Record<string, GatherId> = {
  squirrel: 'fruit',
  rabbit: 'vegetables',
  'sea-turtle': 'seafood',
  sunbird: 'flowers',
  fox: 'fish',
  crocodile: 'fish',
  raccoon: 'gems',
  raven: 'soil',
  capybara: 'timebending',
  cobra: 'timebending',
  monkey: 'timebending',
  owl: 'snippets',
  'baby-dragon': 'snippets',
  pegasus: 'snippets',
}

/** Variantes dont la capacité est contestée entre sources : `null` = non renseignée malgré l'espèce. */
export const VARIANT_GATHER_OVERRIDE: Record<string, GatherId | null> = {
  'teal-baby-dragon': null,
  // Variantes obtenues par une quête : capacité non documentée (voir l'en-tête)
  'toon-capybara': null,
  'toon-cobra': null,
  'toon-monkey': null,
}

/** Capacité de collecte d'une variante, ou `undefined` si elle n'est pas renseignée. */
export function gatherOf(variant: Pick<CritterVariant, 'id' | 'species'>): GatherId | undefined {
  if (Object.hasOwn(VARIANT_GATHER_OVERRIDE, variant.id)) return VARIANT_GATHER_OVERRIDE[variant.id] ?? undefined
  return Object.hasOwn(SPECIES_GATHER, variant.species) ? SPECIES_GATHER[variant.species] : undefined
}

export function gatherLabel(id: GatherId): string {
  const g = GATHER_BY_ID[id]
  return `${g.emoji} ${g.label}`
}
