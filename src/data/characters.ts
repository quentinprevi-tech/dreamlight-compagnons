/**
 * Base de données des habitants de Disney Dreamlight Valley.
 *
 * Pour l'actualiser : ajouter une entrée à CHARACTERS (un `id` unique, jamais
 * réutilisé, car les affectations sauvegardées y font référence) et, si besoin,
 * une collection à COLLECTIONS. Mettre à jour DATA_VERIFIED_AT.
 *
 * Sources (vérifiées le 30/10/2026) :
 * - Liste et collections : https://dreamlightvalleywiki.com/Characters
 *   (onglet Personnages de la Collection en jeu, groupé par zone)
 * - Noms français : gamosaurus.com (?p=198811, maj 11/09/2025),
 *   millenium.org (guide-1948), gamewave.fr (Lumière et Big Ben)
 * - Personnages annoncés : dexerto.com (maj 21/10/2026) – Showcase 2026
 *
 * `nameToVerify` signale un nom français que les sources consultées ne
 * confirmaient pas explicitement (traduction officielle du film utilisée).
 */

export type CollectionId =
  | 'base'
  | 'eternity'
  | 'storybook'
  | 'wishblossom'
  | 'honeyglow'
  | 'keepsake'
  | 'free-upcoming'

export interface Collection {
  id: CollectionId
  label: string
  description: string
  /** Contenu payant (extension ou pack) */
  paid: boolean
}

export const COLLECTIONS: Collection[] = [
  { id: 'base', label: 'Vallée (jeu de base)', description: 'Inclus dans le jeu, sans achat supplémentaire.', paid: false },
  { id: 'eternity', label: 'L’Île de l’Éternité', description: 'Extension « A Rift in Time ».', paid: true },
  { id: 'storybook', label: 'Le Vallon des contes', description: 'Extension « The Storybook Vale ».', paid: true },
  { id: 'wishblossom', label: 'Montagnes Wishblossom', description: 'Extension « Wishblossom Ranch ».', paid: true },
  { id: 'honeyglow', label: 'Bois Honeyglow', description: 'Pack d’aventure « Honeyglow Woods ».', paid: true },
  { id: 'keepsake', label: 'Keepsake Sea (annoncée)', description: 'Extension annoncée pour le 18/11/2026.', paid: true },
  { id: 'free-upcoming', label: 'Mise à jour gratuite (annoncée)', description: 'Mise à jour « ʻOhana Holidays » annoncée pour le 09/12/2026.', paid: false },
]

export interface Character {
  /** Identifiant stable (ne jamais le changer) */
  id: string
  name: string
  nameEn: string
  universe: string
  collection: CollectionId
  /** Date de sortie annoncée (AAAA-MM-JJ) pour un personnage pas encore sorti */
  releaseDate?: string
  nameToVerify?: boolean
}

export const DATA_VERIFIED_AT = '2026-10-30'

const c = (
  id: string,
  name: string,
  nameEn: string,
  universe: string,
  collection: CollectionId = 'base',
  extra: Partial<Character> = {},
): Character => ({ id, name, nameEn, universe, collection, ...extra })

export const CHARACTERS: Character[] = [
  // — Vallée (jeu de base)
  c('aladdin', 'Aladdin', 'Aladdin', 'Aladdin'),
  c('jasmine', 'Jasmine', 'Jasmine', 'Aladdin'),
  c('alice', 'Alice', 'Alice', 'Alice au pays des merveilles'),
  c('cheshire-cat', 'Le Chat du Cheshire', 'Cheshire Cat', 'Alice au pays des merveilles', 'base', { nameToVerify: true }),
  c('belle', 'Belle', 'Belle', 'La Belle et la Bête'),
  c('cogsworth', 'Big Ben', 'Cogsworth', 'La Belle et la Bête'),
  c('beast', 'La Bête', 'The Beast', 'La Belle et la Bête'),
  c('lumiere', 'Lumière', 'Lumiere', 'La Belle et la Bête'),
  c('cinderella', 'Cendrillon', 'Cinderella', 'Cendrillon'),
  c('fairy-godmother', 'La Bonne Fée', 'The Fairy Godmother', 'Cendrillon'),
  c('the-forgotten', 'L’Oublié', 'The Forgotten', 'Dreamlight Valley', 'base', { nameToVerify: true }),
  c('mirabel', 'Mirabel', 'Mirabel', 'Encanto'),
  c('anna', 'Anna', 'Anna', 'La Reine des neiges'),
  c('elsa', 'Elsa', 'Elsa', 'La Reine des neiges'),
  c('kristoff', 'Kristoff', 'Kristoff', 'La Reine des neiges'),
  c('olaf', 'Olaf', 'Olaf', 'La Reine des neiges'),
  c('hercules', 'Hercule', 'Hercules', 'Hercule'),
  c('phil', 'Phil', 'Phil', 'Hercule', 'base', { nameToVerify: true }),
  c('joy', 'Joie', 'Joy', 'Vice-Versa'),
  c('sadness', 'Tristesse', 'Sadness', 'Vice-Versa'),
  c('lady', 'Lady', 'Lady', 'La Belle et le Clochard'),
  c('tramp', 'Clochard', 'Tramp', 'La Belle et le Clochard'),
  c('stitch', 'Stitch', 'Stitch', 'Lilo et Stitch'),
  c('daisy', 'Daisy', 'Daisy', 'Mickey et ses amis'),
  c('donald', 'Donald', 'Donald Duck', 'Mickey et ses amis'),
  c('goofy', 'Dingo', 'Goofy', 'Mickey et ses amis'),
  c('mickey', 'Mickey', 'Mickey Mouse', 'Mickey et ses amis'),
  c('minnie', 'Minnie', 'Minnie Mouse', 'Mickey et ses amis'),
  c('scrooge', 'Picsou', 'Scrooge McDuck', 'Mickey et ses amis'),
  c('maui', 'Maui', 'Maui', 'Vaiana'),
  c('moana', 'Vaiana', 'Moana', 'Vaiana'),
  c('mike', 'Bob', 'Mike Wazowski', 'Monstres et Cie'),
  c('sulley', 'Sulli', 'Sulley', 'Monstres et Cie'),
  c('mulan', 'Mulan', 'Mulan', 'Mulan'),
  c('mushu', 'Mushu', 'Mushu', 'Mulan'),
  c('peter-pan', 'Peter Pan', 'Peter Pan', 'Peter Pan'),
  c('pocahontas', 'Pocahontas', 'Pocahontas', 'Pocahontas'),
  c('remy', 'Rémy', 'Remy', 'Ratatouille'),
  c('mother-gothel', 'Mère Gothel', 'Mother Gothel', 'Raiponce'),
  c('nala', 'Nala', 'Nala', 'Le Roi Lion'),
  c('pumbaa', 'Pumbaa', 'Pumbaa', 'Le Roi Lion'),
  c('scar', 'Scar', 'Scar', 'Le Roi Lion'),
  c('simba', 'Simba', 'Simba', 'Le Roi Lion'),
  c('timon', 'Timon', 'Timon', 'Le Roi Lion'),
  c('ariel', 'Ariel', 'Ariel', 'La Petite Sirène'),
  c('eric', 'Éric', 'Prince Eric', 'La Petite Sirène'),
  c('ursula', 'Ursula', 'Ursula', 'La Petite Sirène'),
  c('tiana', 'Tiana', 'Tiana', 'La Princesse et la Grenouille'),
  c('merlin', 'Merlin', 'Merlin', 'Merlin l’Enchanteur'),
  c('jack-skellington', 'Jack Skellington', 'Jack Skellington', 'L’Étrange Noël de Monsieur Jack'),
  c('oogie-boogie', 'Oogie Boogie', 'Oogie Boogie', 'L’Étrange Noël de Monsieur Jack'),
  c('sally', 'Sally', 'Sally', 'L’Étrange Noël de Monsieur Jack'),
  c('buzz', 'Buzz l’Éclair', 'Buzz Lightyear', 'Toy Story'),
  c('woody', 'Woody', 'Woody', 'Toy Story'),
  c('wall-e', 'WALL-E', 'WALL-E', 'WALL-E'),
  c('ralph', 'Ralph', 'Ralph', 'Les Mondes de Ralph'),
  c('vanellope', 'Vanellope', 'Vanellope', 'Les Mondes de Ralph'),

  // — L'Île de l'Éternité
  c('jafar', 'Jafar', 'Jafar', 'Aladdin', 'eternity'),
  c('gaston', 'Gaston', 'Gaston', 'La Belle et la Bête', 'eternity'),
  c('oswald', 'Oswald', 'Oswald', 'Oswald le lapin chanceux', 'eternity'),
  c('rapunzel', 'Raiponce', 'Rapunzel', 'Raiponce', 'eternity'),
  c('eve', 'EVE', 'EVE', 'WALL-E', 'eternity'),

  // — Le Vallon des contes
  c('merida', 'Merida', 'Merida', 'Rebelle', 'storybook'),
  c('hades', 'Hadès', 'Hades', 'Hercule', 'storybook'),
  c('aurora', 'Aurore', 'Aurora', 'La Belle au bois dormant', 'storybook', { nameToVerify: true }),
  c('maleficent', 'Maléfique', 'Maleficent', 'La Belle au bois dormant', 'storybook', { nameToVerify: true }),
  c('flynn', 'Flynn', 'Flynn', 'Raiponce', 'storybook'),

  // — Montagnes Wishblossom
  c('cruella', 'Cruella', 'Cruella', 'Les 101 Dalmatiens', 'wishblossom'),
  c('tinker-bell', 'Fée Clochette', 'Tinker Bell', 'Peter Pan', 'wishblossom', { nameToVerify: true }),
  c('snow-white', 'Blanche-Neige', 'Snow White', 'Blanche-Neige et les Sept Nains', 'wishblossom', { nameToVerify: true }),
  c('tigger', 'Tigrou', 'Tigger', 'Winnie l’Ourson', 'wishblossom', { nameToVerify: true }),

  // — Bois Honeyglow
  c('eeyore', 'Bourriquet', 'Eeyore', 'Winnie l’Ourson', 'honeyglow', { nameToVerify: true }),
  c('piglet', 'Porcinet', 'Piglet', 'Winnie l’Ourson', 'honeyglow', { nameToVerify: true }),
  c('winnie', 'Winnie l’Ourson', 'Winnie the Pooh', 'Winnie l’Ourson', 'honeyglow', { nameToVerify: true }),

  // — Annoncés (pas encore sortis au 30/10/2026)
  c('milo', 'Milo Thatch', 'Milo Thatch', 'Atlantide, l’empire perdu', 'keepsake', { releaseDate: '2026-11-18', nameToVerify: true }),
  c('jack-sparrow', 'Capitaine Jack Sparrow', 'Captain Jack Sparrow', 'Pirates des Caraïbes', 'keepsake', { releaseDate: '2026-11-18', nameToVerify: true }),
  c('megara', 'Mégara', 'Megara', 'Hercule', 'keepsake', { releaseDate: '2026-11-18', nameToVerify: true }),
  c('captain-hook', 'Capitaine Crochet', 'Captain Hook', 'Peter Pan', 'keepsake', { releaseDate: '2026-11-18', nameToVerify: true }),
  c('wendy', 'Wendy', 'Wendy', 'Peter Pan', 'keepsake', { releaseDate: '2026-11-18', nameToVerify: true }),
  c('lilo', 'Lilo', 'Lilo', 'Lilo et Stitch', 'free-upcoming', { releaseDate: '2026-12-09', nameToVerify: true }),
]

export const CHARACTERS_BY_ID: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((ch) => [ch.id, ch]),
)

/** Identifiant d'un habitant du catalogue (jamais une propriété héritée comme « constructor »). */
export function isCharacterId(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(CHARACTERS_BY_ID, id)
}

export function isReleased(ch: Character, today: Date = new Date()): boolean {
  if (!ch.releaseDate) return true
  return today >= new Date(`${ch.releaseDate}T00:00:00`)
}
