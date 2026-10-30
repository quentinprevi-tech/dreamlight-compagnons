/**
 * Portraits affichés depuis le Dreamlight Valley Wiki (communautaire, non commercial).
 * Les images restent hébergées sur le wiki : elles ne sont pas copiées dans ce projet.
 * Les droits des personnages appartiennent à Disney et Gameloft.
 *
 * Clé : `nameEn` du personnage. Chemins relevés sur
 * https://dreamlightvalleywiki.com/Characters le 30/10/2026.
 * Un personnage absent de cette liste garde son médaillon à initiales.
 */
export const WIKI_BASE = 'https://dreamlightvalleywiki.com'

const PATHS: Record<string, string> = {
  Aladdin: 'c/c3/Aladdin.png',
  Jasmine: 'c/c1/Jasmine.png',
  Alice: '8/82/Alice.png',
  'Cheshire Cat': 'e/e6/Cheshire_Cat.png',
  Belle: '5/53/Belle.png',
  Cogsworth: 'a/a8/Cogsworth.png',
  'The Beast': '2/29/The_Beast.png',
  Lumiere: '1/19/Lumiere.png',
  Cinderella: '0/07/Cinderella.png',
  'The Fairy Godmother': '2/20/The_Fairy_Godmother.png',
  'The Forgotten': '0/0c/The_Forgotten.png',
  Mirabel: '3/3c/Mirabel.png',
  Anna: 'a/ae/Anna.png',
  Elsa: '4/4a/Elsa.png',
  Kristoff: 'b/b0/Kristoff.png',
  Olaf: 'd/d2/Olaf.png',
  Hercules: '7/76/Hercules.png',
  Phil: '2/21/Phil.png',
  Joy: '4/41/Joy.png',
  Sadness: 'b/bc/Sadness.png',
  Lady: 'c/c6/Lady.png',
  Tramp: '6/67/Tramp.png',
  Stitch: '5/5f/Stitch.png',
  Daisy: 'c/c1/Daisy.png',
  'Donald Duck': '6/6f/Donald_Duck.png',
  Goofy: 'e/e5/Goofy.png',
  'Mickey Mouse': 'd/d4/Mickey_Mouse.png',
  'Minnie Mouse': '6/67/Minnie_Mouse.png',
  'Scrooge McDuck': '5/54/Scrooge_McDuck.png',
  Maui: '4/40/Maui.png',
  Moana: 'f/f5/Moana.png',
  'Mike Wazowski': '6/6a/Mike_Wazowski.png',
  Sulley: 'e/ef/Sulley.png',
  Mulan: '5/55/Mulan.png',
  Mushu: '1/10/Mushu.png',
  'Peter Pan': '4/4f/Peter_Pan.png',
  Pocahontas: '2/2f/Pocahontas.png',
  Remy: '7/70/Remy.png',
  'Mother Gothel': '0/02/Mother_Gothel.png',
  Nala: '9/9e/Nala.png',
  Pumbaa: '9/91/Pumbaa.png',
  Scar: 'c/c7/Scar.png',
  Simba: '9/95/Simba.png',
  Timon: 'e/e8/Timon.png',
  Ariel: '0/0a/Ariel.png',
  'Prince Eric': 'c/c5/Prince_Eric.png',
  Ursula: 'a/a4/Ursula.png',
  Tiana: '6/6b/Tiana.png',
  Merlin: 'a/a6/Merlin.png',
  'Jack Skellington': 'e/ee/Jack_Skellington.png',
  'Oogie Boogie': 'b/b3/Oogie_Boogie.png',
  Sally: '2/2e/Sally.png',
  'Buzz Lightyear': 'b/b4/Buzz_Lightyear.png',
  Woody: '2/25/Woody.png',
  'WALL-E': 'f/fa/WALL-E.png',
  Ralph: 'd/dc/Ralph.png',
  Vanellope: '8/85/Vanellope.png',
  Jafar: '5/56/Jafar.png',
  Gaston: 'd/de/Gaston.png',
  Oswald: '6/6f/Oswald.png',
  Rapunzel: 'f/fd/Rapunzel.png',
  EVE: 'a/a7/EVE.png',
  Merida: '6/6d/Merida.png',
  Hades: '6/64/Hades.png',
  Aurora: '8/89/Aurora.png',
  Maleficent: 'e/e8/Maleficent.png',
  Flynn: '4/4e/Flynn.png',
  Cruella: 'd/d4/Cruella.png',
  'Tinker Bell': 'c/c5/Tinker_Bell.png',
  'Snow White': 'e/e6/Snow_White.png',
  Tigger: 'c/c6/Tigger.png',
  Eeyore: '4/49/Eeyore.png',
  Piglet: '5/52/Piglet.png',
  'Winnie the Pooh': '8/83/Winnie_the_Pooh.png',
}

/** URL de la vignette 120 px du wiki, ou undefined si aucun portrait n'est connu. */
export function wikiPortrait(nameEn: string): string | undefined {
  const p = PATHS[nameEn]
  if (!p) return undefined
  const file = p.split('/').pop()!
  return `${WIKI_BASE}/images/thumb/${p}/120px-${file}`
}

export const WIKI_PORTRAIT_NAMES = Object.keys(PATHS)
