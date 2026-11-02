import { CHARACTERS, type Character } from './characters'

/**
 * Numismagie (Scramblecoin) : niveau de difficulté de chaque habitant et
 * les 5 figurines qu'il joue toujours. Ces données sont fixes dans le jeu
 * (ce n'est PAS le niveau d'amitié) : elles sont donc statiques.
 *
 * Source : tableau « Opponents » de https://dreamlightvalleywiki.com/Scramblecoin
 * relevé le 02/11/2026. Clé = `id` du personnage (voir characters.ts).
 * Pour ajouter un habitant : une ligne `id: { level, lineup }`.
 * Les figurines sont notées par leur nom anglais (traduites via FIGURINE_NAMES_FR).
 */
export type ScramblecoinLevel = 1 | 2 | 3

export interface ScramblecoinOpponent {
  level: ScramblecoinLevel
  lineup: string[]
}

export const SCRAMBLECOIN_VERIFIED_AT = '2026-11-02'
export const SCRAMBLECOIN_SOURCE = 'https://dreamlightvalleywiki.com/Scramblecoin'

export const SCRAMBLECOIN: Record<string, ScramblecoinOpponent> = {
  "aladdin": { level: 3, lineup: ['Kristoff', 'Olaf', 'Oswald', 'Ralph', 'Ursula'] },
  "jafar": { level: 3, lineup: ['EVE', 'Forky', 'Gaston', 'Merlin', 'Rapunzel'] },
  "jasmine": { level: 3, lineup: ['Anna', 'Daisy', 'Moana', 'Ralph', 'Scrooge McDuck'] },
  "alice": { level: 1, lineup: ['Cogsworth', 'Kristoff', 'Mickey Mouse', 'Oswald', 'Pumbaa'] },
  "cheshire-cat": { level: 1, lineup: ['Flynn', 'Jafar', 'Mike Wazowski', 'Rapunzel', 'Scrooge McDuck'] },
  "belle": { level: 3, lineup: ['Cogsworth', 'Fairy Godmother', 'Lumiere', 'Mickey Mouse', 'Remy'] },
  "cogsworth": { level: 2, lineup: ['Daisy', 'Rafiki', 'Remy', 'Scrooge McDuck', 'Ursula'] },
  "gaston": { level: 2, lineup: ['Gaston', 'Gaston', 'Gaston', 'Gaston', 'Gaston'] },
  "lumiere": { level: 2, lineup: ['Kristoff', 'Olaf', 'Mike Wazowski', 'Pumbaa', 'Simba'] },
  "beast": { level: 2, lineup: ['Cogsworth', 'Donald Duck', 'Lumiere', 'Olaf', 'Pumbaa'] },
  "merida": { level: 2, lineup: ['Donald Duck', 'Flynn', 'Forky', 'Jafar', 'Sulley'] },
  "cinderella": { level: 1, lineup: ['Elsa', 'Goofy', 'Mickey Mouse', 'Olaf', 'Oswald'] },
  "fairy-godmother": { level: 2, lineup: ['Cinderella', 'Donald Duck', 'Forky', 'Scrooge McDuck', 'Stitch'] },
  "the-forgotten": { level: 1, lineup: ['Donald Duck', 'Flynn', 'Kristoff', 'Mickey Mouse', 'Rapunzel'] },
  "mirabel": { level: 3, lineup: ['Fairy Godmother', 'Nala', 'Ralph', 'Rapunzel', 'Remy'] },
  "anna": { level: 3, lineup: ['Flynn', 'Gaston', 'Nala', 'Rapunzel', 'Simba'] },
  "elsa": { level: 2, lineup: ['Gaston', 'Merlin', 'Mickey Mouse', 'Scrooge McDuck', 'WALL-E'] },
  "kristoff": { level: 1, lineup: ['EVE', 'Fairy Godmother', 'Forky', 'Stitch', 'Ursula'] },
  "olaf": { level: 2, lineup: ['Cinderella', 'Gaston', 'Goofy', 'Rafiki', 'Remy'] },
  "hades": { level: 2, lineup: ['Cogsworth', 'EVE', 'Jafar', 'Olaf', 'Rapunzel'] },
  "hercules": { level: 2, lineup: ['Forky', 'Goofy', 'Mickey Mouse', 'Pumbaa', 'Sulley'] },
  "phil": { level: 3, lineup: ['Forky', 'Merlin', 'Mike Wazowski', 'Simba', 'Sulley'] },
  "joy": { level: 2, lineup: ['Daisy', 'Elsa', 'Jafar', 'Mickey Mouse', 'Mike Wazowski'] },
  "sadness": { level: 3, lineup: ['Fairy Godmother', 'Jafar', 'Minnie Mouse', 'Simba', 'Sulley'] },
  "lady": { level: 1, lineup: ['Lumiere', 'Minnie Mouse', 'Olaf', 'Rapunzel', 'Simba'] },
  "tramp": { level: 1, lineup: ['Lumiere', 'Minnie Mouse', 'Olaf', 'Rapunzel', 'Simba'] },
  "stitch": { level: 2, lineup: ['Cinderella', 'Mickey Mouse', 'Rafiki', 'Stitch', 'Ursula'] },
  "daisy": { level: 3, lineup: ['Elsa', 'Mike Wazowski', 'Minnie Mouse', 'Nala', 'Oswald'] },
  "donald": { level: 2, lineup: ['Donald Duck', 'EVE', 'Fairy Godmother', 'Moana', 'Nala'] },
  "goofy": { level: 1, lineup: ['Goofy', 'Goofy', 'Goofy', 'Goofy', 'Goofy'] },
  "mickey": { level: 1, lineup: ['Donald Duck', 'Goofy', 'Scrooge McDuck', 'Mickey Mouse', 'Minnie Mouse'] },
  "minnie": { level: 2, lineup: ['Cogsworth', 'Flynn', 'Lumiere', 'Nala', 'Simba'] },
  "scrooge": { level: 1, lineup: ['Flynn', 'Goofy', 'Merlin', 'Minnie Mouse', 'Scrooge McDuck'] },
  "maui": { level: 2, lineup: ['Anna', 'Donald Duck', 'EVE', 'Fairy Godmother', 'Goofy'] },
  "moana": { level: 1, lineup: ['Merlin', 'Nala', 'Olaf', 'Ursula', 'WALL-E'] },
  "mike": { level: 2, lineup: ['Anna', 'Flynn', 'Forky', 'Ralph', 'Remy'] },
  "sulley": { level: 1, lineup: ['Cinderella', 'Cogsworth', 'Fairy Godmother', 'Gaston', 'Lumiere'] },
  "mulan": { level: 1, lineup: ['Elsa', 'Kristoff', 'Mike Wazowski', 'Pumbaa', 'Sulley'] },
  "mushu": { level: 1, lineup: ['Daisy', 'Moana', 'Oswald', 'Simba', 'Ursula'] },
  "cruella": { level: 1, lineup: ['EVE', 'Goofy', 'Merlin', 'Rafiki', 'Ursula'] },
  "oswald": { level: 2, lineup: ['Daisy', 'Forky', 'Olaf', 'Rapunzel', 'Sulley'] },
  "peter-pan": { level: 1, lineup: ['Donald Duck', 'Elsa', 'Moana', 'Oswald', 'Ursula'] },
  "tinker-bell": { level: 3, lineup: ['Forky', 'Lumiere', 'Simba', 'Oswald', 'WALL-E'] },
  "pocahontas": { level: 2, lineup: ['Daisy', 'Mickey Mouse', 'Minnie Mouse', 'Rafiki', 'Ursula'] },
  "remy": { level: 1, lineup: ['Donald Duck', 'Flynn', 'Gaston', 'Nala', 'Stitch'] },
  "aurora": { level: 1, lineup: ['Merlin', 'Scrooge McDuck', 'Sulley', 'Ursula', 'WALL-E'] },
  "maleficent": { level: 1, lineup: ['Cinderella', 'Daisy', 'Jafar', 'Nala', 'Remy'] },
  "snow-white": { level: 1, lineup: ['Merlin', 'Mike Wazowski', 'Olaf', 'Oswald', 'Rafiki'] },
  "flynn": { level: 1, lineup: ['Daisy', 'Fairy Godmother', 'Moana', 'Rapunzel', 'Simba'] },
  "mother-gothel": { level: 3, lineup: ['Forky', 'Kristoff', 'Minnie Mouse', 'Remy', 'Ursula'] },
  "rapunzel": { level: 2, lineup: ['Anna', 'Fairy Godmother', 'Flynn', 'Lumiere', 'Olaf'] },
  "nala": { level: 1, lineup: ['Fairy Godmother', 'Olaf', 'Remy', 'Stitch', 'Ursula'] },
  "pumbaa": { level: 1, lineup: ['Cinderella', 'Elsa', 'Mike Wazowski', 'Moana', 'Simba'] },
  "scar": { level: 3, lineup: ['Anna', 'Donald Duck', 'Fairy Godmother', 'Lumiere', 'Minnie Mouse'] },
  "simba": { level: 2, lineup: ['Anna', 'Goofy', 'Lumiere', 'Olaf', 'WALL-E'] },
  "timon": { level: 1, lineup: ['Elsa', 'Gaston', 'Pumbaa', 'Stitch', 'Sulley'] },
  "ariel": { level: 2, lineup: ['Anna', 'EVE', 'Minnie Mouse', 'Rafiki', 'Simba'] },
  "eric": { level: 2, lineup: ['Anna', 'Elsa', 'Merlin', 'Minnie Mouse', 'Rapunzel'] },
  "ursula": { level: 2, lineup: ['Anna', 'Cinderella', 'Donald Duck', 'Goofy', 'Mickey Mouse'] },
  "tiana": { level: 2, lineup: ['Kristoff', 'Moana', 'Oswald', 'Ralph', 'Simba'] },
  "merlin": { level: 3, lineup: ['Flynn', 'Lumiere', 'Merlin', 'Simba', 'Stitch'] },
  "jack-skellington": { level: 3, lineup: ['Anna', 'Cinderella', 'EVE', 'Minnie Mouse', 'Scrooge McDuck'] },
  "oogie-boogie": { level: 3, lineup: ['Daisy', 'Jafar', 'Mike Wazowski', 'Scrooge McDuck', 'Stitch'] },
  "sally": { level: 3, lineup: ['Anna', 'Cinderella', 'EVE', 'Minnie Mouse', 'Scrooge McDuck'] },
  "buzz": { level: 2, lineup: ['Flynn', 'Lumiere', 'Merlin', 'Minnie Mouse', 'Stitch'] },
  "woody": { level: 2, lineup: ['Lumiere', 'Mickey Mouse', 'Rafiki', 'Remy', 'WALL-E'] },
  "eve": { level: 2, lineup: ['Flynn', 'Lumiere', 'Rafiki', 'Remy', 'WALL-E'] },
  "wall-e": { level: 1, lineup: ['EVE', 'Forky', 'Lumiere', 'Remy', 'Stitch'] },
  "eeyore": { level: 2, lineup: ['Merlin', 'Mike Wazowski', 'Remy', 'Scrooge McDuck', 'Sulley'] },
  "piglet": { level: 2, lineup: ['Daisy', 'Flynn', 'Minnie Mouse', 'Nala', 'Olaf'] },
  "tigger": { level: 1, lineup: ['EVE', 'Gaston', 'Pumbaa', 'Ralph', 'Sulley'] },
  "winnie": { level: 1, lineup: ['Flynn', 'Goofy', 'Pumbaa', 'Ralph', 'Ursula'] },
  "ralph": { level: 1, lineup: ['Cogsworth', 'Flynn', 'Forky', 'Merlin', 'Remy'] },
  "vanellope": { level: 3, lineup: ['Forky', 'Lumiere', 'Merlin', 'Rapunzel', 'WALL-E'] },
}

/** Remarques à afficher sur la fiche d'un adversaire. */
export const SCRAMBLECOIN_NOTES: Record<string, string> = {
  'the-forgotten':
    'D’après le wiki, les missions de rêve qui demandent de jouer contre L’Oublié ne peuvent pas être validées.',
}

export const LEVEL_INFO: Record<ScramblecoinLevel, { label: string; hint: string; badge: string; ring: string }> = {
  1: { label: 'Niveau 1', hint: 'Facile', badge: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-300' },
  2: { label: 'Niveau 2', hint: 'Moyen', badge: 'bg-amber-100 text-amber-800', ring: 'ring-amber-300' },
  3: { label: 'Niveau 3', hint: 'Difficile', badge: 'bg-rose-100 text-rose-800', ring: 'ring-rose-300' },
}

/** Figurines qui ne sont pas des habitants de la vallée. */
const EXTRA_FIGURINES_FR: Record<string, string> = {
  Rafiki: 'Rafiki',
  Forky: 'Fourchette',
  'Fairy Godmother': 'La Bonne Fée',
}

export function figurineName(nameEn: string): string {
  return EXTRA_FIGURINES_FR[nameEn] ?? CHARACTERS.find((c) => c.nameEn === nameEn)?.name ?? nameEn
}

/** Habitants qui ont un niveau connu. */
export function scramblecoinCharacters(): (Character & ScramblecoinOpponent)[] {
  return CHARACTERS.filter((c) => SCRAMBLECOIN[c.id]).map((c) => ({ ...c, ...SCRAMBLECOIN[c.id] }))
}
