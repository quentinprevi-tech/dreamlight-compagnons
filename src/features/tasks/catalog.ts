import type { CollectionId } from '../../data/characters'
import { MIDNIGHT_LOCAL, type Recurrence } from './recurrence'

/**
 * Catalogue des tâches proposées. Pour chaque tâche, deux informations distinctes :
 *
 * - `recurrence` : le RAPPEL choisi par l'app (quand la tâche revient dans « Aujourd'hui ») ;
 * - `gameReset` : la vraie remise à zéro DU JEU, telle que documentée, avec son statut
 *   de vérification et ses sources. Elle n'est jamais inventée.
 *
 * Règle quand les sources se contredisent : statut « à confirmer », et le rappel de
 * l'app est placé à l'heure la PLUS TARDIVE des sources : il ne revient jamais avant
 * la vraie remise à zéro (au pire avec un peu de retard).
 *
 * Hypothèse non vérifiée (à ne pas utiliser sans confirmation) : les heures du wiki en
 * heure du Pacifique (1 h PST, 6 h PST, 22 h PST) expliqueraient les écarts d'une heure
 * entre sources si la remise à zéro suit l'heure d'été américaine.
 *
 * Sources consultées le 09/11/2026 :
 * - Support officiel Gameloft, boutique de Picsou : « 8AM UTC each day », boutiques de
 *   l'Île de l'Éternité et du Vallon des contes (page mise à jour il y a ~713 jours).
 * - Wiki : pages Time, Scrooge's Store, DreamSnaps, Boutique, Critters, Snippet Catching,
 *   Wishblossom Ranch.
 *
 * Pour ajouter une tâche : une entrée avec un `id` unique qui ne change plus jamais.
 */

export type TaskGroup = 'main' | 'other' | 'dlc'

export type ResetStatus = 'official' | 'wiki' | 'to-confirm' | 'unverified'

export interface SourceRef {
  label: string
  url: string
}

export interface GameReset {
  status: ResetStatus
  /** Ce que disent les sources, en français */
  summary: string
  sources: SourceRef[]
}

export interface TaskTemplate {
  /** Identifiant stable (ne jamais le changer) */
  id: string
  label: string
  group: TaskGroup
  /** Extension concernée ; `unknown` : extension à confirmer */
  collection?: CollectionId | 'unknown'
  /** Rappel dans l'app */
  recurrence: Recurrence
  /** Remise à zéro dans le jeu */
  gameReset: GameReset
  enabledByDefault: boolean
  /** La tâche est reliée au suivi des animaux (phase 3) : une ligne agrégée calculée, voir `critters/today.ts`. */
  futureLink?: 'critters'
}

export const TASKS_VERIFIED_AT = '2026-11-09'

const WIKI = 'https://dreamlightvalleywiki.com'
const SRC = {
  gameloftScrooge: {
    label: 'Support Gameloft : boutique de Picsou',
    url: 'https://gameloft.helpshift.com/hc/en/66-disney-dreamlight-valley/faq/4347-how-often-does-stock-in-scrooge-mcduck-s-store-refresh',
  },
  wikiTime: { label: 'Wiki : Time', url: `${WIKI}/Time` },
  wikiScrooge: { label: 'Wiki : Scrooge’s Store', url: `${WIKI}/Scrooge%27s_Store` },
  wikiDreamSnaps: { label: 'Wiki : DreamSnaps', url: `${WIKI}/DreamSnaps` },
  wikiBoutique: { label: 'Wiki : The Boutique', url: `${WIKI}/Boutique` },
  wikiCritters: { label: 'Wiki : Critters', url: `${WIKI}/Critters` },
  wikiSnippets: { label: 'Wiki : Snippet Catching', url: `${WIKI}/Snippets` },
  wikiWishblossom: { label: 'Wiki : Wishblossom Ranch', url: `${WIKI}/Wishblossom_Ranch` },
} satisfies Record<string, SourceRef>

const UNVERIFIED: GameReset = {
  status: 'unverified',
  summary: 'Aucune source vérifiée pour l’instant : l’app propose un rappel chaque jour à minuit.',
  sources: [],
}

const daily = (zone: 'local' | 'UTC', hour: number): Recurrence => ({ kind: 'daily', at: { zone, hour, minute: 0 } })
const EVERY_DAY: Recurrence = { kind: 'daily', at: MIDNIGHT_LOCAL }

const SCROOGE_RESET: GameReset = {
  status: 'to-confirm',
  summary:
    'Le support Gameloft indique 8 h UTC ; le wiki donne 8 h UTC dans son encart et 9 h UTC dans son texte. L’app fait revenir la tâche à 9 h UTC (10 h à Bruxelles en hiver, 11 h en été).',
  sources: [SRC.gameloftScrooge, SRC.wikiScrooge, SRC.wikiTime],
}

const scrooge = (id: string, place: string, collection: CollectionId, official: boolean): TaskTemplate => ({
  id,
  label: `Boutique de Picsou — ${place}`,
  group: 'main',
  collection,
  recurrence: daily('UTC', 9),
  gameReset: {
    ...SCROOGE_RESET,
    summary: official
      ? SCROOGE_RESET.summary
      : `${SCROOGE_RESET.summary} Boutique attestée par le wiki (page Scrooge’s Store) ; la page officielle est antérieure à cette extension.`,
  },
  enabledByDefault: true,
})

export const TASK_TEMPLATES: TaskTemplate[] = [
  // — Principales
  {
    id: 'feed-critters',
    // Dans « Aujourd'hui », cette tâche devient la ligne « 🐾 Animaux à nourrir : X/Y » (calculée, non cochable).
    label: 'Nourrir les animaux',
    group: 'main',
    recurrence: EVERY_DAY,
    gameReset: {
      status: 'wiki',
      summary: 'Un seul nourrissage compte par animal et par jour ; remise à zéro à minuit, heure locale du joueur.',
      sources: [SRC.wikiCritters, SRC.wikiTime],
    },
    enabledByDefault: true,
    futureLink: 'critters',
  },
  { id: 'harvest-roots', label: 'Récolter les racines', group: 'main', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: true },
  {
    id: 'open-chests',
    label: 'Ouvrir les coffres',
    group: 'main',
    recurrence: EVERY_DAY,
    gameReset: {
      status: 'wiki',
      summary: 'Les coffres bleus et verts réapparaissent à minuit, heure locale.',
      sources: [SRC.wikiTime],
    },
    enabledByDefault: true,
  },
  {
    id: 'give-gifts',
    label: 'Offrir des cadeaux aux habitants',
    group: 'main',
    recurrence: daily('local', 5),
    gameReset: {
      status: 'wiki',
      summary: 'Les objets préférés du jour des habitants changent à 5 h, heure locale.',
      sources: [SRC.wikiTime],
    },
    enabledByDefault: true,
  },
  scrooge('scrooge-valley', 'Vallée', 'base', true),
  scrooge('scrooge-eternity', 'Île de l’Éternité', 'eternity', true),
  scrooge('scrooge-storybook', 'Vallon des contes', 'storybook', true),
  scrooge('scrooge-wishblossom', 'Montagnes Wishblossom', 'wishblossom', false),
  {
    id: 'daisy-boutique',
    label: 'Boutique de Daisy',
    group: 'main',
    recurrence: daily('UTC', 6),
    gameReset: {
      status: 'to-confirm',
      summary:
        'Défi de la boutique : le wiki indique 5 h UTC dans son encart et 6 h UTC dans son texte. L’app fait revenir la tâche à 6 h UTC (7 h à Bruxelles en hiver, 8 h en été).',
      sources: [SRC.wikiBoutique, SRC.wikiTime],
    },
    enabledByDefault: true,
  },
  {
    id: 'dreamsnaps',
    label: 'Participer au DreamSnap',
    group: 'main',
    recurrence: { kind: 'weekly', weekday: 3, at: { zone: 'UTC', hour: 14, minute: 0 } },
    gameReset: {
      status: 'to-confirm',
      summary:
        'Défi hebdomadaire. Le wiki indique le mercredi à 13 h UTC dans son encart et à 14 h UTC dans son texte. L’app fait revenir la tâche le mercredi à 14 h UTC (15 h à Bruxelles en hiver, 16 h en été).',
      sources: [SRC.wikiDreamSnaps, SRC.wikiTime],
    },
    enabledByDefault: true,
  },
  { id: 'star-path', label: 'Avancer dans la Voie des étoiles', group: 'main', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: true },

  // — Autres
  { id: 'moana-stall', label: 'Récupérer les poissons du stand de Vaiana', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'beast-stall', label: 'Récupérer les fleurs du stand de la Bête', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'hit-rocks', label: 'Taper les cailloux', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'gather-wood', label: 'Ramasser les bois', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'pick-flowers', label: 'Cueillir les fleurs', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'gather-fruit', label: 'Ramasser les fruits', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'gather-vegetables', label: 'Ramasser les légumes', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'clear-stones', label: 'Retirer les pierres', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'ancient-biomes', label: 'Récupérer les objets anciens dans les biomes', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  { id: 'ancient-bubbles', label: 'Récupérer les objets anciens dans les bulles', group: 'other', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },

  // — DLC (« Attraper des anigamis » n'existe qu'ici : pas de doublon avec « Autres »)
  { id: 'minigames', label: 'Faire les mini-jeux', group: 'dlc', collection: 'unknown', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
  {
    id: 'catch-anigamis',
    label: 'Attraper des anigamis',
    group: 'dlc',
    collection: 'storybook',
    recurrence: EVERY_DAY,
    gameReset: { ...UNVERIFIED, summary: `${UNVERIFIED.summary} Activité du Vallon des contes (filet royal) d’après le wiki.`, sources: [SRC.wikiSnippets] },
    enabledByDefault: false,
  },
  {
    id: 'feed-horses',
    label: 'Nourrir les chevaux',
    group: 'dlc',
    collection: 'wishblossom',
    recurrence: EVERY_DAY,
    gameReset: {
      ...UNVERIFIED,
      summary: `${UNVERIFIED.summary} Le wiki décrit des soins quotidiens aux chevaux de Wishblossom Ranch, sans heure de remise à zéro.`,
      sources: [SRC.wikiWishblossom],
    },
    enabledByDefault: false,
  },
  { id: 'play-bridges', label: 'Jouer sur les ponts', group: 'dlc', collection: 'unknown', recurrence: EVERY_DAY, gameReset: UNVERIFIED, enabledByDefault: false },
]

export const TASK_TEMPLATES_BY_ID: Record<string, TaskTemplate> = Object.fromEntries(TASK_TEMPLATES.map((t) => [t.id, t]))

export function isTemplateId(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(TASK_TEMPLATES_BY_ID, id)
}

export const GROUP_LABELS: Record<TaskGroup, string> = { main: 'Principales', other: 'Autres', dlc: 'Extensions (DLC)' }

export const RESET_STATUS_LABELS: Record<ResetStatus, string> = {
  official: 'Source officielle',
  wiki: 'D’après le wiki',
  'to-confirm': 'À confirmer',
  unverified: 'Non vérifié',
}
