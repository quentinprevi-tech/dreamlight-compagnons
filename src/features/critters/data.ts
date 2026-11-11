import type { CollectionId } from '../../data/characters'

/**
 * Créatures sauvages apprivoisables (« critters »), par variante de couleur.
 *
 * Source : https://dreamlightvalleywiki.com/Critters (tableau des horaires) et la fiche de
 * chaque variante (https://dreamlightvalleywiki.com/<Nom_anglais>), relevées le 09/11/2026.
 * Les deux sources ont été recoupées variante par variante : horaires, biome, extension.
 *
 * Règles de ce fichier (aucune information n'est déduite) :
 * - 90 variantes. Le tableau du wiki compte 91 lignes : la dernière est le SECOND créneau
 *   de l'Oie dorée (7 h–8 h puis 19 h–20 h), pas une variante de plus.
 * - Nom français : copié de la section « Names in Other Languages » de la fiche du wiki.
 *   Absent (chaîne vide) sur 36 variantes : l'app affiche alors le nom anglais « À confirmer ».
 *   Ces noms sont « d'après le wiki », non vérifiés en jeu.
 * - Nom français d'espèce : seulement quand au moins deux noms français de variantes
 *   partagent le même début (Mouffette et Abeille douce : un seul exemple, donc aucun).
 * - Biomes et zones : noms anglais du wiki. Aucun biome n'a de nom français sur le wiki.
 * - Minimum de nourrissages (champ « Minimum Feedings » de la fiche) : « 3 » = nombre exact,
 *   « 3+ » = « a minimum of 3 » (le total exact n'est pas précisé), vide = non indiqué
 *   (22 variantes). Jamais complété.
 * - Horaires : jour de la semaine (dimanche → samedi) × créneaux d'heures, en HEURE LOCALE
 *   du joueur (le wiki : « All times and days are based on the player's local system time »).
 *   Format : `-` = absent ce jour-là, `0-24` = toute la journée, `7-8,19-20` = deux créneaux.
 * - Une seule contradiction entre le tableau et la fiche : l'Abeille douce blanche (tableau
 *   20 h–24 h, fiche 20 h–7 h). Son horaire est donc « à confirmer » et n'est pas utilisé.
 * - Conditions qui ne sont pas des horaires : météo (Mouffette à motifs, Abeille douce bleue)
 *   et quête (les trois variantes « Toon »). L'app ne les connaît pas : ces variantes ne sont
 *   jamais comptées dans « Aujourd'hui ».
 * - Keepsake Sea (annoncée le 18/11/2026) : aucune créature sauvage listée au 09/11/2026.
 *   À vérifier APRÈS la sortie effective ; rien n'est ajouté d'après les annonces.
 *
 * Pour ajouter une variante : une ligne dans VARIANT_ROWS (un `id` unique qui ne change
 * plus jamais, car les suivis enregistrés y font référence), et si besoin une espèce ou un biome.
 */

export const CRITTERS_VERIFIED_AT = '2026-11-09'
export const CRITTERS_SOURCE = 'https://dreamlightvalleywiki.com/Critters'
export const WIKI_PAGE = (nameEn: string) => `https://dreamlightvalleywiki.com/${nameEn.replace(/ /g, '_')}`

export interface CritterSpecies {
  id: string
  nameEn: string
  /** Absent : nom français à confirmer */
  nameFr?: string
}

export interface CritterBiome {
  id: string
  nameEn: string
  collection: CollectionId
}

/** Créneau de présence, en heures locales : de `from` (inclus) à `to` (exclu, 24 = minuit). */
export interface TimeWindow {
  from: number
  to: number
}

export type Schedule =
  | {
      status: 'known'
      /** Créneaux de chaque jour : index 0 = dimanche … 6 = samedi (comme `Date.getDay`) */
      days: TimeWindow[][]
    }
  | { status: 'unknown'; reason: 'missing' | 'conflict'; note?: string }

export type ConditionKind = 'rain' | 'clear' | 'quest'

export interface Feedings {
  min: number
  /** `true` : nombre exact ; `false` : « au moins `min` » (total exact non précisé) */
  exact: boolean
}

export interface CritterVariant {
  id: string
  nameEn: string
  nameFr?: string
  species: string
  biome: string
  /** Zone du biome (nom anglais du wiki) */
  area?: string
  collection: CollectionId
  feedings?: Feedings
  schedule: Schedule
  condition?: ConditionKind
  wikiUrl: string
}

export const SPECIES: CritterSpecies[] = [
  { id: 'sunbird', nameEn: 'Sunbird', nameFr: 'Passereau' },
  { id: 'squirrel', nameEn: 'Squirrel', nameFr: 'Écureuil' },
  { id: 'crocodile', nameEn: 'Crocodile', nameFr: 'Crocodile' },
  { id: 'rabbit', nameEn: 'Rabbit', nameFr: 'Lapin' },
  { id: 'raven', nameEn: 'Raven', nameFr: 'Corbeau' },
  { id: 'sea-turtle', nameEn: 'Sea Turtle', nameFr: 'Tortue de mer' },
  { id: 'fox', nameEn: 'Fox', nameFr: 'Renard' },
  { id: 'raccoon', nameEn: 'Raccoon', nameFr: 'Raton laveur' },
  { id: 'capybara', nameEn: 'Capybara', nameFr: 'Capybara' },
  { id: 'cobra', nameEn: 'Cobra', nameFr: 'Cobra' },
  { id: 'monkey', nameEn: 'Monkey', nameFr: 'Singe' },
  { id: 'owl', nameEn: 'Owl', nameFr: 'Hibou' },
  { id: 'baby-dragon', nameEn: 'Baby Dragon', nameFr: 'Bébé dragon' },
  { id: 'pegasus', nameEn: 'Pegasus', nameFr: 'Pégase' },
  { id: 'goose', nameEn: 'Goose', nameFr: 'Oie' },
  { id: 'skunk', nameEn: 'Skunk' },
  { id: 'sweet-bee', nameEn: 'Sweet Bee' },
  { id: 'hedgehog', nameEn: 'Hedgehog', nameFr: 'Hérisson' },
]

/** Biomes, dans l'ordre d'affichage (jeu de base d'abord, puis chaque extension). */
export const BIOMES: CritterBiome[] = [
  { id: 'sunlit-plateau', nameEn: 'Sunlit Plateau', collection: 'base' },
  { id: 'plaza', nameEn: 'Plaza', collection: 'base' },
  { id: 'glade-of-trust', nameEn: 'Glade of Trust', collection: 'base' },
  { id: 'peaceful-meadow', nameEn: 'Peaceful Meadow', collection: 'base' },
  { id: 'forgotten-lands', nameEn: 'Forgotten Lands', collection: 'base' },
  { id: 'dazzle-beach', nameEn: 'Dazzle Beach', collection: 'base' },
  { id: 'frosted-heights', nameEn: 'Frosted Heights', collection: 'base' },
  { id: 'forest-of-valor', nameEn: 'Forest of Valor', collection: 'base' },
  { id: 'wild-tangle', nameEn: 'Wild Tangle', collection: 'eternity' },
  { id: 'glittering-dunes', nameEn: 'Glittering Dunes', collection: 'eternity' },
  { id: 'ancients-landing', nameEn: 'Ancient\'s Landing', collection: 'eternity' },
  { id: 'the-bind', nameEn: 'The Bind', collection: 'storybook' },
  { id: 'everafter', nameEn: 'Everafter', collection: 'storybook' },
  { id: 'mythopia', nameEn: 'Mythopia', collection: 'storybook' },
  { id: 'wishing-alps', nameEn: 'Wishing Alps', collection: 'wishblossom' },
  { id: 'glamour-gulch', nameEn: 'Glamour Gulch', collection: 'wishblossom' },
  { id: 'pixie-acres', nameEn: 'Pixie Acres', collection: 'wishblossom' },
  { id: 'honeyglow-woods', nameEn: 'Honeyglow Woods', collection: 'honeyglow' },
]

/** Explications des horaires contradictoires (clé = id de la variante). */
const CONFLICT_NOTES: Record<string, string> = {
  'white-sweet-bee':
    'Le tableau des horaires du wiki indique 20 h–minuit, la fiche de la variante 20 h–7 h. Horaire à confirmer en jeu.',
}

// id, nom anglais, nom français ('' = absent du wiki), espèce, biome, zone, minimum, horaires dim→sam, condition
type Row = [id: string, nameEn: string, nameFr: string, species: string, biome: string, area: string, feedings: string, week: string, flag: string]

const VARIANT_ROWS: Row[] = [
  ['emerald-sunbird', 'Emerald Sunbird', 'Passereau émeraude', 'sunbird', 'sunlit-plateau', '', '4+', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['golden-sunbird', 'Golden Sunbird', 'Passereau doré', 'sunbird', 'sunlit-plateau', '', '4+', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['orchid-sunbird', 'Orchid Sunbird', 'Passereau orchidée', 'sunbird', 'sunlit-plateau', '', '4+', '-/-/-/-/-/0-24/-', ''],
  ['red-sunbird', 'Red Sunbird', '', 'sunbird', 'sunlit-plateau', '', '4+', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['turquoise-sunbird', 'Turquoise Sunbird', '', 'sunbird', 'sunlit-plateau', '', '4+', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['black-squirrel', 'Black Squirrel', 'Écureuil noir', 'squirrel', 'plaza', '', '2', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['classic-squirrel', 'Classic Squirrel', 'Écureuil classique', 'squirrel', 'plaza', '', '2', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['gray-squirrel', 'Gray Squirrel', 'Écureuil gris', 'squirrel', 'plaza', '', '2', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['red-squirrel', 'Red Squirrel', '', 'squirrel', 'plaza', '', '2', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['white-squirrel', 'White Squirrel', '', 'squirrel', 'plaza', '', '2', '0-24/-/-/-/-/-/-', ''],
  ['blue-crocodile', 'Blue Crocodile', 'Crocodile bleu', 'crocodile', 'glade-of-trust', '', '4+', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['classic-crocodile', 'Classic Crocodile', 'Crocodile classique', 'crocodile', 'glade-of-trust', '', '4+', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['golden-crocodile', 'Golden Crocodile', 'Crocodile doré', 'crocodile', 'glade-of-trust', '', '4+', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['pink-crocodile', 'Pink Crocodile', '', 'crocodile', 'glade-of-trust', '', '4+', '-/-/-/-/-/-/0-24', ''],
  ['red-crocodile', 'Red Crocodile', '', 'crocodile', 'glade-of-trust', '', '4+', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['white-crocodile', 'White Crocodile', '', 'crocodile', 'glade-of-trust', '', '4+', '0-24/-/-/-/-/-/-', ''],
  ['black-rabbit', 'Black Rabbit', 'Lapin noir', 'rabbit', 'peaceful-meadow', '', '2', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['brown-rabbit', 'Brown Rabbit', 'Lapin brun', 'rabbit', 'peaceful-meadow', '', '2', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['calico-rabbit', 'Calico Rabbit', 'Lapin calico', 'rabbit', 'peaceful-meadow', '', '2', '-/-/-/-/0-24/-/-', ''],
  ['classic-rabbit', 'Classic Rabbit', 'Lapin classique', 'rabbit', 'peaceful-meadow', '', '2', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['white-rabbit', 'White Rabbit', '', 'rabbit', 'peaceful-meadow', '', '2', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['blue-raven', 'Blue Raven', 'Corbeau bleu', 'raven', 'forgotten-lands', '', '5+', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['brown-raven', 'Brown Raven', 'Corbeau brun', 'raven', 'forgotten-lands', '', '5+', '-/-/0-24/-/-/-/-', ''],
  ['classic-raven', 'Classic Raven', 'Corbeau classique', 'raven', 'forgotten-lands', '', '5+', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['red-raven', 'Red Raven', '', 'raven', 'forgotten-lands', '', '5+', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['white-raven', 'White Raven', '', 'raven', 'forgotten-lands', '', '5+', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['black-sea-turtle', 'Black Sea Turtle', 'Tortue de mer noire', 'sea-turtle', 'dazzle-beach', '', '3+', '-/0-24/-/-/-/-/-', ''],
  ['brown-sea-turtle', 'Brown Sea Turtle', 'Tortue de mer brune', 'sea-turtle', 'dazzle-beach', '', '3+', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['classic-sea-turtle', 'Classic Sea Turtle', 'Tortue de mer classique', 'sea-turtle', 'dazzle-beach', '', '3+', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['purple-sea-turtle', 'Purple Sea Turtle', '', 'sea-turtle', 'dazzle-beach', '', '3+', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['white-sea-turtle', 'White Sea Turtle', '', 'sea-turtle', 'dazzle-beach', '', '3+', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['black-fox', 'Black Fox', 'Renard noir', 'fox', 'frosted-heights', '', '5+', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['blue-fox', 'Blue Fox', 'Renard bleu', 'fox', 'frosted-heights', '', '5+', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['classic-fox', 'Classic Fox', 'Renard classique', 'fox', 'frosted-heights', '', '5+', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['red-fox', 'Red Fox', '', 'fox', 'frosted-heights', '', '5+', '-/-/-/-/-/-/0-24', ''],
  ['white-fox', 'White Fox', '', 'fox', 'frosted-heights', '', '5+', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['black-raccoon', 'Black Raccoon', 'Raton laveur noir', 'raccoon', 'forest-of-valor', '', '3+', '12-24/-/0-24/0-24/-/-/0-24', ''],
  ['blue-raccoon', 'Blue Raccoon', 'Raton laveur bleu', 'raccoon', 'forest-of-valor', '', '3+', '-/-/-/0-24/-/-/-', ''],
  ['classic-raccoon', 'Classic Raccoon', 'Raton laveur classique', 'raccoon', 'forest-of-valor', '', '3+', '12-24/0-24/-/-/0-24/-/0-24', ''],
  ['red-raccoon', 'Red Raccoon', '', 'raccoon', 'forest-of-valor', '', '3+', '0-12/0-24/-/0-24/-/0-24/-', ''],
  ['white-raccoon', 'White Raccoon', '', 'raccoon', 'forest-of-valor', '', '3+', '0-12/-/0-24/-/0-24/0-24/-', ''],
  ['black-and-white-capybara', 'Black and White Capybara', 'Capybara noir et blanc', 'capybara', 'wild-tangle', 'The Promenade', '3', '12-24/-/0-24/-/0-24/12-24/12-24', ''],
  ['blue-striped-capybara', 'Blue Striped Capybara', 'Capybara rayé bleu', 'capybara', 'wild-tangle', 'The Grove', '3', '-/0-12/0-12/0-12/0-24/-/0-24', ''],
  ['classic-capybara', 'Classic Capybara', 'Capybara classique', 'capybara', 'wild-tangle', 'The Grasslands', '3', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', ''],
  ['gray-spotted-capybara', 'Gray Spotted Capybara', 'Capybara à pois gris', 'capybara', 'wild-tangle', 'The Lagoon', '3', '0-24/12-24/12-24/12-24/-/0-24/-', ''],
  ['red-and-white-striped-capybara', 'Red and White Striped Capybara', '', 'capybara', 'wild-tangle', 'The Lagoon', '3', '-/-/-/-/-/-/0-24', ''],
  ['toon-capybara', 'Toon Capybara', '', 'capybara', 'wild-tangle', 'The Grove', '4', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', 'quest'],
  ['blue-and-red-striped-cobra', 'Blue and Red Striped Cobra', 'Cobra rayé bleu et rouge', 'cobra', 'glittering-dunes', 'The Wastes', '3', '0-24/12-24/12-24/-/0-24/-/12-24', ''],
  ['classic-cobra', 'Classic Cobra', 'Cobra classique', 'cobra', 'glittering-dunes', 'The Plains', '3', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', ''],
  ['green-and-white-striped-cobra', 'Green and White Striped Cobra', 'Cobra rayé vert et blanc', 'cobra', 'glittering-dunes', 'The Borderlands', '3', '-/-/-/-/0-24/-/-', ''],
  ['pink-spotted-cobra', 'Pink Spotted Cobra', '', 'cobra', 'glittering-dunes', 'The Oasis', '3', '0-12/0-24/-/0-12/0-12/0-24/-', ''],
  ['toon-cobra', 'Toon Cobra', '', 'cobra', 'glittering-dunes', 'The Wastes', '4', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', 'quest'],
  ['yellow-and-purple-striped-cobra', 'Yellow and Purple Striped Cobra', '', 'cobra', 'glittering-dunes', 'The Borderlands', '3', '12-24/-/0-24/12-24/12-24/-/0-24', ''],
  ['beige-monkey', 'Beige Monkey', 'Singe beige', 'monkey', 'ancients-landing', 'The Ruins', '', '0-24/12-24/-/12-24/0-24/12-24/-', ''],
  ['black-and-brown-monkey', 'Black and Brown Monkey', 'Singe noir et brun', 'monkey', 'ancients-landing', 'The Courtyard', '', '12-24/-/12-24/0-24/12-24/-/0-24', ''],
  ['black-and-gray-monkey', 'Black and Gray Monkey', 'Singe noir et gris', 'monkey', 'ancients-landing', 'The Ruins', '', '-/-/0-24/-/-/-/-', ''],
  ['classic-monkey', 'Classic Monkey', 'Singe classique', 'monkey', 'ancients-landing', 'The Docks', '', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', ''],
  ['red-and-beige-monkey', 'Red and Beige Monkey', '', 'monkey', 'ancients-landing', 'The Overlook', '', '-/0-12/0-24/0-12/-/0-12/0-24', ''],
  ['toon-monkey', 'Toon Monkey', '', 'monkey', 'ancients-landing', 'The Docks', '4', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', 'quest'],
  ['brown-owl', 'Brown Owl', 'Hibou brun', 'owl', 'the-bind', 'The Library of Lore', '', '-/0-24/0-24/0-24/0-24/0-24/-', ''],
  ['dark-owl', 'Dark Owl', 'Hibou sombre', 'owl', 'the-bind', 'The Library of Lore', '', '0-24/-/-/-/-/-/0-24', ''],
  ['white-owl', 'White Owl', 'Hibou blanc', 'owl', 'the-bind', '', '', '15-20/15-20/15-20/15-20/15-20/15-20/15-20', ''],
  ['purple-owl', 'Purple Owl', '', 'owl', 'the-bind', '', '', '0-9/0-9/0-9/0-9/0-9/0-9/0-9', ''],
  ['blue-baby-dragon', 'Blue Baby Dragon', 'Bébé dragon bleu', 'baby-dragon', 'everafter', 'The Wild Woods', '', '-/-/0-24/0-24/0-24/0-24/-', ''],
  ['green-baby-dragon', 'Green Baby Dragon', 'Bébé dragon vert', 'baby-dragon', 'everafter', 'The Fallen Fortress', '', '10-18/10-18/10-18/10-18/10-18/-/-', ''],
  ['purple-baby-dragon', 'Purple Baby Dragon', '', 'baby-dragon', 'everafter', 'The Beanstalk Marshes', '', '0-12/0-12/0-12/0-12/0-12/0-12/0-12', ''],
  ['red-baby-dragon', 'Red Baby Dragon', '', 'baby-dragon', 'everafter', 'Teapot Falls', '', '0-24/0-24/-/-/-/-/0-24', ''],
  ['teal-baby-dragon', 'Teal Baby Dragon', 'Bébé dragon bleu sarcelle', 'baby-dragon', 'everafter', 'The Wild Woods', '', '0-24/-/-/0-24/0-24/0-24/0-24', ''],
  ['black-pegasus', 'Black Pegasus', 'Pégase noir', 'pegasus', 'mythopia', 'The Elysian Fields', '', '0-24/-/-/0-24/0-24/0-24/0-24', ''],
  ['blue-pegasus', 'Blue Pegasus', 'Pégase bleu', 'pegasus', 'mythopia', 'The Fiery Plains', '', '-/0-24/0-24/0-24/-/-/-', ''],
  ['peach-pegasus', 'Peach Pegasus', '', 'pegasus', 'mythopia', 'Mount Olympus', '', '6-14/6-14/6-14/6-14/6-14/6-14/6-14', ''],
  ['pink-pegasus', 'Pink Pegasus', '', 'pegasus', 'mythopia', 'The Elysian Fields', '', '0-24/-/-/-/0-24/0-24/0-24', ''],
  ['yellow-pegasus', 'Yellow Pegasus', '', 'pegasus', 'mythopia', 'The Statue\'s Shadow', '', '-/-/18-24/18-24/18-24/18-24/18-24', ''],
  ['black-goose', 'Black Goose', 'Oie noire', 'goose', 'wishing-alps', 'Silver Summit', '1', '5-11/5-11/5-11/5-11/5-11/5-11/5-11', ''],
  ['blue-goose', 'Blue Goose', 'Oie bleue', 'goose', 'wishing-alps', 'Wishing Way', '1', '18-20/18-20/18-20/18-20/18-20/18-20/18-20', ''],
  ['golden-goose', 'Golden Goose', 'Oie dorée', 'goose', 'wishing-alps', 'Delver Dale', '1', '7-8,19-20/7-8,19-20/7-8,19-20/7-8,19-20/7-8,19-20/7-8,19-20/7-8,19-20', ''],
  ['goose', 'Goose', 'Oie', 'goose', 'wishing-alps', 'Wishblossom Ranch', '1', '0-24/0-24/-/0-24/-/0-24/-', ''],
  ['true-north-goose', 'True North Goose', '', 'goose', 'wishing-alps', 'Ranch Highlands', '1', '-/-/0-24/-/0-24/-/0-24', ''],
  ['brown-skunk', 'Brown Skunk', 'Mouffette brune', 'skunk', 'glamour-gulch', 'Paisley Park', '2', '12-24/12-24/-/12-24/-/12-24/-', ''],
  ['patterned-skunk', 'Patterned Skunk', '', 'skunk', 'glamour-gulch', 'Haute Plateau', '2', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', 'rain'],
  ['skunk', 'Skunk', '', 'skunk', 'glamour-gulch', 'Runway River', '1', '0-12/0-12/0-12/0-12/0-12/0-12/0-12', ''],
  ['white-skunk', 'White Skunk', '', 'skunk', 'glamour-gulch', 'Modish Marsh', '2', '12-24/-/12-24/-/12-24/-/12-24', ''],
  ['blue-sweet-bee', 'Blue Sweet Bee', 'Abeille bleue', 'sweet-bee', 'pixie-acres', 'Hunny Falls', '3', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', 'clear'],
  ['pink-sweet-bee', 'Pink Sweet Bee', '', 'sweet-bee', 'pixie-acres', 'Pixie Flats', '3', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', ''],
  ['sweet-bee', 'Sweet Bee', '', 'sweet-bee', 'pixie-acres', 'Sundae Shores', '3', '7-20/7-20/7-20/7-20/7-20/7-20/7-20', ''],
  ['white-sweet-bee', 'White Sweet Bee', '', 'sweet-bee', 'pixie-acres', 'Hundred-Acre Fields', '3', '?', 'conflict'],
  ['classic-hedgehog', 'Classic Hedgehog', 'Hérisson classique', 'hedgehog', 'honeyglow-woods', 'Drowsybloom Acre', '3', '0-24/0-24/0-24/0-24/0-24/0-24/0-24', ''],
  ['green-hedgehog', 'Green Hedgehog', 'Hérisson vert', 'hedgehog', 'honeyglow-woods', 'Gloommeadow', '', '0-12/0-12/0-12/0-12/0-12/0-12/0-12', ''],
  ['orange-hedgehog', 'Orange Hedgehog', 'Hérisson orange', 'hedgehog', 'honeyglow-woods', 'Nectar Apiary', '', '12-24/-/-/12-24/-/-/12-24', ''],
  ['yellow-hedgehog', 'Yellow Hedgehog', 'Hérisson jaune', 'hedgehog', 'honeyglow-woods', 'Braveheart Grove', '', '12-24/12-24/12-24/12-24/12-24/12-24/12-24', ''],
]

function parseWeek(week: string): TimeWindow[][] {
  const days = week.split('/')
  if (days.length !== 7) throw new Error(`Horaire invalide : ${week}`)
  return days.map((day) =>
    day === '-'
      ? []
      : day.split(',').map((w) => {
          const [from, to] = w.split('-').map(Number)
          if (!(from >= 0 && to <= 24 && from < to)) throw new Error(`Créneau invalide : ${w}`)
          return { from, to }
        }),
  )
}

function parseFeedings(text: string): Feedings | undefined {
  if (!text) return undefined
  const match = /^(\d+)(\+?)$/.exec(text)
  if (!match) throw new Error(`Minimum invalide : ${text}`)
  return { min: Number(match[1]), exact: match[2] === '' }
}

const BIOME_COLLECTION = Object.fromEntries(BIOMES.map((b) => [b.id, b.collection]))

export const CRITTER_VARIANTS: CritterVariant[] = VARIANT_ROWS.map(([id, nameEn, nameFr, species, biome, area, feedings, week, flag]) => ({
  id,
  nameEn,
  ...(nameFr ? { nameFr } : {}),
  species,
  biome,
  ...(area ? { area } : {}),
  collection: BIOME_COLLECTION[biome],
  ...(parseFeedings(feedings) ? { feedings: parseFeedings(feedings) } : {}),
  schedule:
    week === '?'
      ? { status: 'unknown' as const, reason: 'conflict' as const, note: CONFLICT_NOTES[id] }
      : { status: 'known' as const, days: parseWeek(week) },
  ...(flag === 'rain' || flag === 'clear' || flag === 'quest' ? { condition: flag } : {}),
  wikiUrl: WIKI_PAGE(nameEn),
}))

export const CRITTER_BY_ID: Record<string, CritterVariant> = Object.fromEntries(CRITTER_VARIANTS.map((v) => [v.id, v]))
export const SPECIES_BY_ID: Record<string, CritterSpecies> = Object.fromEntries(SPECIES.map((s) => [s.id, s]))
export const BIOME_BY_ID: Record<string, CritterBiome> = Object.fromEntries(BIOMES.map((b) => [b.id, b]))

export function isVariantId(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(CRITTER_BY_ID, id)
}

export function isBiomeId(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(BIOME_BY_ID, id)
}

/** Extensions payantes qui ajoutent des créatures (l'utilisatrice indique celles qu'elle possède). */
export const CRITTER_DLC: CollectionId[] = ['eternity', 'storybook', 'wishblossom', 'honeyglow']

/** Textes des conditions qui ne sont pas des horaires (traduction libre du wiki, sans nom officiel). */
export const CONDITION_TEXT: Record<ConditionKind, string> = {
  rain: 'Seulement par temps très nuageux ou pluvieux (d’après le wiki).',
  clear: 'Seulement par temps dégagé ou peu nuageux (d’après le wiki).',
  quest: 'Disponible après la quête « The Spark of Imagination » (nom anglais de la quête, d’après le wiki).',
}
