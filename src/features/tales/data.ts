/**
 * Puzzles et anigamis du Vallon des contes.
 *
 * VOCABULAIRE ET CORRESPONDANCES (vérifiées le 09/11/2026, à confirmer en jeu) :
 * - « Anigami » est le terme de l'application et des guides français (Gamosaurus, PlayStation, Gamewave…)
 *   pour ce que le wiki anglais appelle « Snippet ».
 * - Les « puzzles » de l'application correspondent très probablement aux « Lorekeeper Tales » du wiki :
 *   · wiki (page Storybook Vale) : « Lorekeeper Tales which are puzzles to solve for rewards which can be
 *     unlocked using Snippets » ; page de chaque Snippet : « can used to unlock Lorekeeper Tales puzzles
 *     at The Lorekeeper » ;
 *   · notes de mise à jour officielles (20/11/2024) : « New puzzle and quest types! Complete beautiful
 *     tapestries that tell the stories behind classic Disney and Pixar films » ; les Snippets y sont
 *     décrits comme « the Lorekeeper's scattered pages ».
 *   Cette correspondance n'est PAS confirmée en jeu : le nom français des puzzles est inconnu.
 *   Le wiki n'a pas de page propre aux contes : « Lorekeeper Tales » redirige vers la section du même
 *   nom de https://dreamlightvalleywiki.com/Snippet_Catching.
 *
 * DONNÉES :
 * - 39 puzzles (tableau « Lorekeeper Tales » du wiki). Les 6 premiers sont débloqués par une quête.
 * - Coûts : relevés sur le wiki, puis comparés AUTOMATIQUEMENT à un second tableau indépendant
 *   (Destructoid, 27 puzzles, plus ancien ; seule normalisation : « Red Frog » = « Pink Frog », mêmes
 *   quantités à chaque fois) :
 *   · `verified`  : deux sources identiques (25 puzzles) ;
 *   · `conflict`  : les sources se contredisent (2 puzzles : Moana, Sleeping Beauty). Le coût du wiki est
 *                   gardé avec l'autre lecture, mais n'est PAS utilisé : pas de déduction automatique ;
 *   · `single-source` : le wiki seul (12 puzzles absents de la source de comparaison).
 * - 21 types d'anigamis : 16 capturables (tableau « Snippets » du wiki) + 5 objets de QUÊTE absents de ce
 *   tableau (« Neverafter » ×2, « Rainbow » ×3), indispensables aux puzzles « The Spark of Spite » et
 *   « The Story of Dreamlight Valley ».
 * - Noms français : le wiki n'en donne aucun. Un guide français (Gamosaurus, 15/04/2025) nomme 13 types
 *   (« Anigami oiseau bleu »…) : relevés tels quels, SANS correction, « à confirmer ». Les 8 autres types,
 *   tous les puzzles, récompenses, lieux et quêtes restent en anglais « À confirmer » (nom personnalisable).
 *
 * Pour ajouter un puzzle ou un type après une mise à jour du jeu : une ligne dans TALE_ROWS / ANIGAMI_TYPES
 * (un `id` unique qui ne change plus jamais : les comptes et puzzles terminés enregistrés y font référence).
 */

export const TALES_VERIFIED_AT = '2026-11-09'

export const TALES_SOURCES = {
  wiki: { label: 'Dreamlight Valley Wiki : Snippet Catching', url: 'https://dreamlightvalleywiki.com/Snippet_Catching' },
  wikiStorybook: { label: 'Dreamlight Valley Wiki : Storybook Vale', url: 'https://dreamlightvalleywiki.com/Storybook_Vale' },
  comparison: {
    label: 'Destructoid : Storybook Vale et Snippets (comparaison)',
    url: 'https://www.destructoid.com/how-to-unlock-every-area-of-storybook-vale-and-every-snippet-in-disney-dreamlight-valley/',
  },
  official: { label: 'Notes de mise à jour officielles (20/11/2024)', url: 'https://disneydreamlightvalley.com/news/update-nov-20-2024' },
  frenchGuide: {
    label: 'Gamosaurus : liste des anigamis (15/04/2025)',
    url: 'https://www.gamosaurus.com/guide/disney-dreamlight-valley-liste-des-anigamis-du-dlc-the-storybook-vale',
  },
} as const

export type AnigamiFamily = 'bird' | 'demon' | 'frog'

export interface AnigamiType {
  id: string
  /** Nom anglais du wiki (« Blue Bird Snippet ») */
  nameEn: string
  /** Nom d'un guide français, non vérifié en jeu ; absent = à confirmer */
  nameFr?: string
  family: AnigamiFamily
  /** `catch` : capturé au filet royal ; `quest` : objet de quête (hors tableau des Snippets du wiki) */
  origin: 'catch' | 'quest'
  /** Lieux du wiki (noms anglais) */
  locations: string[]
  note?: string
}

export type CostStatus = 'verified' | 'single-source' | 'conflict'

export interface Tale {
  id: string
  nameEn: string
  stars: 1 | 2 | 3 | 4 | 5
  /** Coût par type d'anigami (lecture du wiki) */
  cost: Record<string, number>
  /** Récompense (nom anglais) */
  reward: string
  /** Quête qui débloque ce puzzle (nom anglais) */
  unlockQuest?: string
  costStatus: CostStatus
  /** `conflict` : ce que dit l'autre source */
  otherReading?: string
}

const T = (id: string, nameEn: string, nameFr: string | undefined, family: AnigamiFamily, origin: 'catch' | 'quest', locations: string[], note?: string): AnigamiType => ({
  id,
  nameEn,
  ...(nameFr ? { nameFr } : {}),
  family,
  origin,
  locations,
  ...(note ? { note } : {}),
})

const QUEST_NOTE = (quest: string) => `Objet de quête (pas capturable au filet) : obtenu pendant la quête « ${quest} » (nom anglais).`

/** Dans l'ordre d'affichage : oiseaux, démons, grenouilles ; objets de quête à la fin de chaque famille. */
export const ANIGAMI_TYPES: AnigamiType[] = [
  T('blue-bird', 'Blue Bird Snippet', 'Anigami oiseau bleu', 'bird', 'catch', ['The Bind']),
  T('green-bird', 'Green Bird Snippet', 'Anigami oiseau vert', 'bird', 'catch', ['The Elysian Fields']),
  T('red-bird', 'Red Bird Snippet', 'Anigami oiseau rouge', 'bird', 'catch', ['The Library of Lore']),
  T('shadowy-bird', 'Shadowy Bird Snippet', undefined, 'bird', 'catch', ['The Library of Lore', 'The Bind']),
  T('yellow-bird', 'Yellow Bird Snippet', 'Anigami oiseau jaune', 'bird', 'catch', ['The Wild Woods']),
  T('white-bird', 'White Bird Snippet', 'Anigami oiseau blanc', 'bird', 'catch', ['Dreamlight Valley'], 'Aucun puzzle ne le demande : il sert à fabriquer d’autres anigamis (d’après le wiki).'),
  T('rainbow-bird', 'Rainbow Bird Snippet', undefined, 'bird', 'quest', ['Unwritten realms'], QUEST_NOTE('The Tales That Bind')),
  T('blue-demon', 'Blue Demon Snippet', 'Anigami démon bleu', 'demon', 'catch', ['The Fiery Plains', 'The Fallen Fortress']),
  T('green-demon', 'Green Demon Snippet', 'Anigami démon vert', 'demon', 'catch', ['Mount Olympus']),
  T('pink-demon', 'Pink Demon Snippet', 'Anigami démon rose', 'demon', 'catch', ['The Elysian Fields', 'The Fiery Plains']),
  T('red-demon', 'Red Demon Snippet', 'Anigami démon rouge', 'demon', 'catch', ['The Statue\'s Shadow']),
  T('shadowy-demon', 'Shadowy Demon Snippet', undefined, 'demon', 'catch', ['Mythopia']),
  T('neverafter-demon', 'Neverafter Demon Snippet', undefined, 'demon', 'quest', ['The Mythic Trial in Mount Olympus'], QUEST_NOTE('Mount Olympus')),
  T('rainbow-demon', 'Rainbow Demon Snippet', undefined, 'demon', 'quest', ['Unwritten realms'], QUEST_NOTE('The Tales That Bind')),
  T('green-frog', 'Green Frog Snippet', 'Anigami grenouille vert', 'frog', 'catch', ['The Wild Woods', 'Teapot Falls']),
  T('pink-frog', 'Pink Frog Snippet', 'Anigami grenouille rose', 'frog', 'catch', ['The Statue\'s Shadow', 'Teapot Falls']),
  T('purple-frog', 'Purple Frog Snippet', 'Anigami grenouille violet', 'frog', 'catch', ['The Fallen Fortress']),
  T('shadowy-frog', 'Shadowy Frog Snippet', undefined, 'frog', 'catch', ['Everafter']),
  T('yellow-frog', 'Yellow Frog Snippet', 'Anigami grenouille jaune', 'frog', 'catch', ['The Beanstalk Marshes']),
  T('neverafter-frog', 'Neverafter Frog Snippet', undefined, 'frog', 'quest', ['Throne room in Maleficent\'s Castle'], QUEST_NOTE('The Mistress of All Evil')),
  T('rainbow-frog', 'Rainbow Frog Snippet', undefined, 'frog', 'quest', ['Unwritten realms'], QUEST_NOTE('The Tales That Bind')),
]

export const FAMILY_LABEL: Record<AnigamiFamily, string> = { bird: 'Oiseaux', demon: 'Démons', frog: 'Grenouilles' }
export const FAMILY_EMOJI: Record<AnigamiFamily, string> = { bird: '🐦', demon: '😈', frog: '🐸' }

// id, nom anglais, étoiles, coût (type:quantité), récompense, quête de déblocage, vérification (« » wiki seul, « v » deux sources, « c » contradiction), autre lecture
type Row = [id: string, nameEn: string, stars: number, cost: string, reward: string, quest: string, check: string, other: string]

const TALE_ROWS: Row[] = [
  ['once-upon-a-time-in-the-storybook-vale', 'Once Upon a Time in the Storybook Vale...', 1, 'red-bird:10', 'Fairy Tale Tree', 'Welcome to the Storybook Vale', 'v', ''],
  ['aurora-and-the-teapot-falls', 'Aurora And The Teapot Falls', 3, 'green-frog:10,pink-frog:5,blue-bird:3', 'Broken Teacup', 'Curiouser and Curiouser...', 'v', ''],
  ['aurora-and-the-sacred-spring', 'Aurora and the Sacred Spring', 3, 'red-bird:10,pink-demon:5,blue-demon:2', 'Engraved Marble Wallpaper', 'A Moth to a Flame', 'v', ''],
  ['the-spark-of-spite', 'The Spark of Spite', 5, 'neverafter-frog:4,neverafter-demon:3', 'The Stained Glass Window to Imagination', 'A Long-Awaited Invitation', 'v', ''],
  ['maleficents-journey', 'Maleficent\'s Journey', 3, 'shadowy-bird:5,shadowy-frog:5,shadowy-demon:5', 'Straw and Wood Dragon Dummy', 'A Storm of Stories', '', ''],
  ['the-story-of-dreamlight-valley', 'The Story of Dreamlight Valley', 3, 'rainbow-bird:3,rainbow-frog:2,rainbow-demon:3', 'Aurora\'s Baby Bassinet', 'The Tales That Bind', '', ''],
  ['beauty-and-the-beast', 'Beauty and the Beast', 2, 'red-bird:5,blue-bird:20', 'Pocket Watch Necklace', '', 'v', ''],
  ['aladdin', 'Aladdin', 2, 'blue-bird:25', 'Agrabah Chair', '', 'v', ''],
  ['cinderella', 'Cinderella', 2, 'red-bird:10,blue-bird:15', 'Vintage Green Wallpaper', '', 'v', ''],
  ['encanto', 'Encanto', 2, 'blue-bird:15,pink-demon:10', 'Madrigal Family Door', '', 'v', ''],
  ['moana', 'Moana', 2, 'blue-bird:10,green-frog:15', 'Plumeria Flower Path', '', 'c', 'Green Bird Snippet (15) ; Blue Bird Snippet (10)'],
  ['the-lion-king', 'The Lion King', 3, 'red-bird:10,blue-bird:30', 'Giant Leaf Chair', '', 'v', ''],
  ['sleeping-beauty', 'Sleeping Beauty', 3, 'blue-bird:30,green-bird:5,blue-demon:5', 'Bard\'s Cap', '', 'c', 'Blue Bird Snippet (30) ; Green Frog Snippet (5) ; Blue Bird Snippet (5)'],
  ['monsters-inc', 'Monsters, Inc.', 3, 'red-bird:10,yellow-bird:5,pink-frog:10', 'Corporate Ceiling Lamp', '', 'v', ''],
  ['mulan', 'Mulan', 3, 'green-bird:5,blue-demon:5,red-demon:15', 'Garden Temple', '', 'v', ''],
  ['tim-burtons-the-nightmare-before-christmas', 'Tim Burton\'s The Nightmare Before Christmas', 3, 'yellow-bird:5,pink-frog:10,purple-frog:25', 'Halloween Town Clock', '', 'v', ''],
  ['the-princess-and-the-frog', 'The Princess and the Frog', 3, 'yellow-frog:20,green-demon:10', 'The Princess and the Frog Chest — Small', '', 'v', ''],
  ['lilo-stitch', 'Lilo & Stitch', 4, 'red-bird:10,blue-bird:35,pink-demon:15', 'Lilo\'s Bunk Bed', '', 'v', ''],
  ['tangled', 'Tangled', 4, 'red-bird:20,blue-bird:10,green-frog:30', 'Potted Blooming Tree', '', 'v', ''],
  ['wall-e', 'WALL-E', 4, 'green-bird:5,pink-demon:25,blue-demon:5', 'Transportation Table', '', 'v', ''],
  ['wreck-it-ralph', 'Wreck-It Ralph', 4, 'yellow-bird:5,green-frog:45,pink-frog:10', 'Royal Candy Doors', '', 'v', ''],
  ['the-sword-in-the-stone', 'The Sword in the Stone', 4, 'pink-demon:10,blue-demon:5,red-demon:20', 'Medieval Wooden Chair', '', 'v', ''],
  ['hercules', 'Hercules', 4, 'green-frog:20,pink-frog:10,purple-frog:30', 'Fountain of Thebes', '', 'v', ''],
  ['winnie-the-pooh', 'Winnie the Pooh', 4, 'shadowy-bird:5,red-bird:10,blue-bird:10', 'Decorative Honeypots', '', '', ''],
  ['snow-white', 'Snow White', 4, 'shadowy-frog:5,green-frog:10,pink-frog:5', 'Evil Queen\'s Lockbox', '', '', ''],
  ['peter-pan', 'Peter Pan', 4, 'shadowy-bird:10,red-bird:20,pink-frog:5', 'Jolly Roger Flag', '', '', ''],
  ['lady-and-the-tramp', 'Lady and the Tramp', 4, 'shadowy-bird:20,blue-bird:20,blue-demon:5', 'Striped Gift Box', '', '', ''],
  ['frozen', 'Frozen', 5, 'blue-bird:35,green-frog:30,pink-demon:15', 'Queen Iduna Costume Gown', '', 'v', ''],
  ['the-little-mermaid', 'The Little Mermaid', 5, 'red-bird:20,green-frog:30,pink-demon:15', 'Sea Palace Window', '', 'v', ''],
  ['ratatouille', 'Ratatouille', 5, 'purple-frog:35,blue-demon:5,red-demon:25', '"La Ratatouille" Sign', '', 'v', ''],
  ['toy-story', 'Toy Story', 5, 'pink-frog:10,purple-frog:35,red-demon:25', 'Dump Truck Armchair', '', 'v', ''],
  ['brave', 'Brave', 5, 'green-bird:5,yellow-bird:5,green-demon:35', 'Change of Fate Rug', '', 'v', ''],
  ['the-sorcerers-apprentice', 'The Sorcerer\'s Apprentice', 5, 'green-bird:5,yellow-bird:5,yellow-frog:70', 'Book Glider', '', 'v', ''],
  ['robin-hood', 'Robin Hood', 5, 'shadowy-frog:10,pink-frog:2,purple-frog:15', 'Archery Target Hutch', '', '', ''],
  ['alice-in-wonderland', 'Alice in Wonderland', 5, 'shadowy-frog:15,pink-frog:5,yellow-frog:20', 'Curious Doors', '', '', ''],
  ['one-hundred-and-one-dalmatians', 'One Hundred and One Dalmatians', 5, 'shadowy-demon:5,pink-demon:10,blue-demon:5', 'Standing Cello', '', '', ''],
  ['coco', 'Coco', 5, 'shadowy-demon:10,blue-demon:5,red-demon:15', 'Fall Leaves Rug', '', '', ''],
  ['the-incredibles', 'The Incredibles', 5, 'shadowy-demon:15,blue-demon:5,green-demon:20', 'Mirage Office Chair', '', '', ''],
  ['inside-out', 'Inside Out', 5, 'shadowy-bird:20,shadowy-frog:20,shadowy-demon:20', 'Bing Bong Glider', '', '', ''],
]

function parseCost(text: string): Record<string, number> {
  const cost: Record<string, number> = {}
  for (const part of text.split(',')) {
    const [type, qty] = part.split(':')
    const n = Number(qty)
    if (!Number.isInteger(n) || n < 1 || Object.hasOwn(cost, type)) throw new Error(`Coût invalide : ${text}`)
    cost[type] = n
  }
  return cost
}

export const TALES: Tale[] = TALE_ROWS.map(([id, nameEn, stars, cost, reward, quest, check, other]) => ({
  id,
  nameEn,
  stars: stars as Tale['stars'],
  cost: parseCost(cost),
  reward,
  ...(quest ? { unlockQuest: quest } : {}),
  costStatus: check === 'v' ? ('verified' as const) : check === 'c' ? ('conflict' as const) : ('single-source' as const),
  ...(other ? { otherReading: other } : {}),
}))

export const TALE_BY_ID: Record<string, Tale> = Object.fromEntries(TALES.map((t) => [t.id, t]))
export const ANIGAMI_BY_ID: Record<string, AnigamiType> = Object.fromEntries(ANIGAMI_TYPES.map((a) => [a.id, a]))

export function isTaleId(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(TALE_BY_ID, id)
}

export function isAnigamiId(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(ANIGAMI_BY_ID, id)
}

export const COST_STATUS_LABEL: Record<CostStatus, string> = {
  verified: 'Coûts confirmés par deux sources',
  'single-source': 'Coûts d’une seule source (le wiki)',
  conflict: 'Coûts à confirmer : les sources se contredisent',
}

export const CORRESPONDENCE_NOTE =
  'Les « puzzles » correspondent très probablement aux « Lorekeeper Tales » du wiki (le wiki les décrit comme des puzzles débloqués avec des Snippets ; les notes de mise à jour officielles parlent de « tapestries »). À confirmer en jeu : le nom français des puzzles est inconnu.'
