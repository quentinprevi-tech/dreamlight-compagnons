# Améliorations UX de novembre 2026 : fiches et images d’ingrédients

Document écrit pour quelqu’un qui apprend React et TypeScript. Il explique **ce qui a changé, pourquoi, comment c’est
fait, comment c’est testé et ce qui reste limité**. Date : 11/11/2026. Rien n’a été commité ni publié au moment de
l’écriture.

## 1. Les retours des testeuses

| Retour | Réponse |
|---|---|
| « Je ne trouve pas comment sortir de la fiche » | Une **croix ✕ toujours visible**, une poignée qui sert vraiment, le glissement vers le bas, le clic à côté, Échap |
| « On voudrait voir les images des ingrédients » | Miniature + quantité + nom pour chaque ingrédient de la recette, emoji de repli si l’image manque |

Constat de départ : toutes les fiches de détail passent déjà par **un seul composant**, `BottomSheet`
(`src/components/BottomSheet.tsx`). Elles montaient déjà du bas de l’écran, avec un « trait » décoratif en haut… qui ne
faisait rien, et un fond cliquable invisible. Corriger `BottomSheet` corrige donc **les 10 fiches** d’un coup : recette,
animal, puzzle, tâche, renommage, confirmation, restauration, attribution d’un métier, etc.

## 2. Fermer une fiche

### Les façons de fermer

1. **La croix ✕** en haut à droite (36 px, fond lilas, bien visible). Elle est dans un bloc « collant » (`position: sticky`)
   de hauteur nulle : elle **reste en haut même quand on fait défiler** une longue fiche, sans prendre de place.
2. **Le glissement vers le bas** :
   - depuis la **poignée** (zone de 28 px de haut, sur toute la largeur) ;
   - depuis **n’importe où dans la fiche**, mais seulement si le contenu est **tout en haut** (sinon le geste sert au
     défilement, comme dans toutes les applications).
3. **Un appui à côté** de la fiche (le fond sombre).
4. **Échap** au clavier (ordinateur).

**La croix est indépendante du glissement** : le glissement n’est jamais le seul moyen. Si le geste échoue ou n’est pas
trouvé, la croix, le fond et Échap fonctionnent toujours.

### Comment fonctionne le glissement

On écoute les événements tactiles (`touchstart`, `touchmove`, `touchend`, `touchcancel`). Ces écouteurs sont posés **à la
main** (`addEventListener` dans un `useEffect`) et non avec `onTouchMove` de React, parce qu’il faut pouvoir appeler
`preventDefault()` pendant le geste (pour que la page ne défile pas en même temps) ; React les enregistre en mode
« passif », où c’est interdit.

Règles du geste (toutes testées) :
- moins de 6 px de mouvement : rien ne se passe (un simple appui reste un appui) ;
- geste plutôt **horizontal**, ou **vers le haut** depuis le contenu : ignoré, le navigateur fait son travail ;
- geste commencé dans un **champ de saisie**, une liste déroulante ou un curseur : ignoré ;
- contenu **déjà défilé** (`scrollTop > 0`) : ignoré (sauf depuis la poignée) ;
- au relâchement : si la fiche est descendue de **plus de 100 px**, ou de plus de 40 px **vite** (> 0,5 px/ms), elle se
  ferme ; sinon elle **revient à sa place** avec une petite animation.

Détail technique important : on déplace une **enveloppe extérieure** (`dragRef`), pas le panneau. Le panneau porte déjà
l’animation d’ouverture (`animate-sheet-up`) ; or une animation CSS l’emporte sur un `transform` posé à la main, et
la fiche n’aurait pas suivi le doigt.

Si la personne a activé « réduire les animations » (`prefers-reduced-motion`), la fiche se ferme tout de suite, sans
glisser hors de l’écran.

### Si le parent refuse de fermer

`ConfirmSheet` ne se ferme pas pendant une opération en cours (`!busy && onClose()`). Après un glissement, la fiche
sortait de l’écran puis… restait invisible. Maintenant, si le parent n’a pas démonté la fiche 50 ms après l’animation,
elle **revient à sa place**. La croix peut aussi être rappuyée (elle n’est pas « verrouillée » après un premier appui).

### Plusieurs fiches ouvertes

- **Échap** : un petit registre (`openSheets`) retient les fiches ouvertes ; seule **la dernière** réagit. Avant, Échap
  aurait fermé toutes les fiches empilées d’un coup.
- **Blocage du défilement de la page** : avant, chaque fiche mémorisait la valeur précédente de `overflow`. Si deux
  fiches se fermaient dans le « mauvais » ordre, la page pouvait **rester bloquée**. Maintenant la première fiche
  mémorise la valeur, et c’est **la dernière fermée** qui la remet (test : `deux fiches superposées fermées dans le
  désordre`).

### Le bouton « Retour »

**Depuis la seconde passe (11/11/2026)** : « Retour » (bouton Android, geste iOS, touche Précédent) **ferme la fiche et reste
sur l’écran**. Voir le § 8 pour le fonctionnement et les cas limites. (Avant : « Retour » quittait l’écran avec la fiche.)

### Autres changements dans les fiches

- Les 10 « traits » décoratifs dupliqués dans chaque fiche sont **supprimés** : `BottomSheet` dessine la poignée.
- `PickerSheet` (ajouter un habitant à un métier) a déjà un bouton « Terminé » en haut : on lui passe
  `closeButton={false}` pour ne pas avoir deux boutons de fermeture. Il garde le fond, Échap et la poignée.
- Le fond sombre n’est plus annoncé par les lecteurs d’écran (`aria-hidden`, `tabIndex={-1}`) : il y avait deux boutons
  « Fermer ». Il y en a un seul, la croix.
- Dans la fiche d’une recette, **les ingrédients passent avant** les statistiques (type, étoiles, énergie, prix) : sur un
  écran de 640 px de haut, ils étaient sous la ligne de flottaison.

## 3. Images des ingrédients

### Ce qu’on a trouvé

Le projet ne contenait **aucune image d’ingrédient** (198 ingrédients, aucun fichier). Le wiki, déjà utilisé pour les
portraits, en publie une par fiche d’ingrédient. Choix validé : **images hébergées par le wiki, non copiées dans le dépôt**
(comme les portraits).

### Comment les adresses ont été établies et vérifiées

Script : `scripts/resolve-ingredient-images.mjs` (à lancer à la main, jamais par l’application ni par la CI).

1. Interroge l’API MediaWiki du wiki : **20 titres par requête, une requête à la fois** (10 requêtes) → image principale
   de chaque fiche, en vignette de 120 px.
2. Vérifie **chaque URL** avec une requête `HEAD` (3 en parallèle au plus, 250 ms de pause, arrêt immédiat sur « 429 »).
3. Contrôles avant d’écrire quoi que ce soit : fiche trouvée, **nom du fichier = nom de l’ingrédient** (pas seulement
   « HTTP 200 »), pas de redirection, réponse `image/png`, **aucune image partagée** par deux ingrédients.

Résultat du 11/11/2026 : **198 / 198** ingrédients : fiche trouvée, nom du fichier identique au nom anglais, HTTP 200
`image/png`, 198 adresses distinctes, aucune redirection. Poids total des vignettes : **≈ 1 Mo** (de 1,6 Ko à 26 Ko,
moyenne ≈ 5 Ko). 191 sont des vignettes de 120 px ; **7** (`bamboo`, `broccoli`, `cabbage`, `paprika`, `pineapple`,
`cosmic-figs`, `dreamango`) sont des images d’origine plus petites que 120 px, servies telles quelles par le wiki.

Le résultat est enregistré dans une **table stable** : `src/features/recipes/ingredientImages.ts`
(`INGREDIENT_IMAGE_PATHS`, identifiant → chemin sous `https://dreamlightvalleywiki.com/images/`). L’application ne
reconstruit jamais une adresse à l’affichage ; elle lit la table. Le script peut la régénérer
(`node scripts/resolve-ingredient-images.mjs`), ou la réécrire sans réseau à partir d’un résultat déjà obtenu
(`--from fichier.json`).

**Correspondances incertaines : aucune** au sens de ces contrôles. **Limite** : on vérifie que le fichier porte le bon
nom et que la fiche est la bonne, pas que le *dessin* est le bon (un coup d’œil sur quatre ingrédients en vrai
affichage : blé, fromage, œuf, lait, corrects). Une image fausse côté wiki serait fausse ici aussi.

Aucun ingrédient n’est sans image, donc le repli emoji sert aux pannes (réseau, wiki), pas à des trous de données.

### Comment la fiche les affiche

- `IngredientThumb` (`src/features/recipes/IngredientThumb.tsx`) : un carré de taille fixe (40 px ; 24 px dans les listes
  de choix) pour que **rien ne bouge** quand l’image arrive.
- **Tant que l’image n’est pas chargée**, ou si elle échoue (hors ligne, wiki en panne), l’**emoji** est affiché. Une
  fois chargée, l’emoji disparaît (les PNG sont transparents : sinon l’emoji se verrait derrière).
- L’image est **décorative** (`alt=""`) : le nom est écrit juste à côté, un lecteur d’écran ne le lit pas deux fois.
  L’emoji est caché aux lecteurs d’écran.
- Emoji : celui de l’ingrédient s’il en a un (🌾 blé, 🧀 fromage…), sinon celui de son groupe (🍎 fruit, 🐟 poisson…),
  sinon 🍽️ (`ingredientEmoji` dans `display.ts`).
- **Ingrédient obligatoire** : miniature + quantité (« 2 × ») + nom + les deux boutons existants (🔍 voir les recettes,
  ✎ renommer).
- **« Au choix » (Fruit, Poisson…)** : la liste repliable des possibilités montre une miniature par membre, mais **les
  images ne sont demandées qu’à l’ouverture de la liste** (un groupe compte jusqu’à 36 membres).

### Chargement différé

- La **liste** des recettes ne demande **jamais** d’image (test E2E : 0 requête avant l’ouverture d’une fiche).
- À l’ouverture d’une fiche, seules les images de **cette** recette sont demandées (4 pour Buñuelos), en
  `loading="lazy"` et `decoding="async"` : la fiche s’ouvre sans attendre le réseau.
- Le catalogue des recettes n’est pas modifié (même fichier, même empreinte : `catalog.data-_94C6Zdg.js`). La table
  d’images est un module séparé du catalogue ; elle pèse ≈ 13 Ko avant compression dans le paquet principal.

### Cache : ce qui a été évalué avant de toucher quoi que ce soit

Le cache des portraits (`vite.config.ts`) utilisait ce motif : **toute adresse** `…/images/…` du wiki. Les vignettes
d’ingrédients sont dans le même dossier : elles y seraient donc **entrées automatiquement**. Or (mesuré le 11/11/2026
sur Edge, voir le README) une réponse « opaque » compte **≈ 9,2 Mo de quota** quelle que soit sa taille réelle :
198 images ≈ **1,8 Go de quota comptabilisé**, contre ≈ 1 Mo réellement. De plus ce cache est limité à 200 entrées :
74 portraits + 198 ingrédients dépassent 200, les portraits auraient été **expulsés**.

Solutions examinées :

| Option | Verdict |
|---|---|
| Laisser le motif tel quel | Rejetée : quota × 3 et portraits expulsés |
| Charger les images en CORS (réponses normales, ≈ 5 Ko) | **Impossible** : test fait (une requête `HEAD` avec `Origin`), le wiki n’envoie aucun `Access-Control-Allow-Origin` |
| Ajouter un second cache avec les ingrédients | Mêmes réponses opaques, même surcoût |
| **Restreindre le cache des portraits à leurs 74 adresses exactes ; laisser les ingrédients au cache HTTP du navigateur** | **Retenue** |

Effet sur les portraits : **aucun** (mêmes adresses, même stratégie `CacheFirst`, mêmes réglages). `portraitCachePattern()`
(`src/data/portraits.ts`) construit le motif à partir de la liste des portraits ; un test vérifie qu’il couvre les 74
portraits et **aucune** des 198 vignettes.

Le cache HTTP n’entre pas dans le quota de stockage du site. Mesure en vrai navigateur (Edge, vrai wiki, une recette de
4 ingrédients ouverte deux fois, avec rechargement) : 1ʳᵉ ouverture = 4 requêtes réseau ; 2ᵉ ouverture = 4 requêtes
**servies depuis le cache**, 0 octet téléchargé ; cache d’exécution du service worker : **vide**.

### Hors ligne : ce qui est vrai et ce qui ne l’est pas

- Une image déjà vue **récemment** est généralement réutilisable sans réseau (cache HTTP du navigateur, durée décidée par
  le navigateur à partir de la date de modification du fichier : plusieurs semaines pour ces images, **non garanti**).
- Une image **jamais vue** n’est **pas** disponible hors ligne : l’emoji s’affiche. **On ne prétend pas que les 198
  images fonctionnent hors ligne.** Les noms, quantités, étoiles, prix et la fiche entière, eux, fonctionnent hors
  ligne (le catalogue est dans le service worker).

## 4. Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/BottomSheet.tsx` | Croix, poignée active, glissement, Échap de la fiche du dessus, verrou de défilement fiable |
| 9 fiches (`AssignSheet`, `PickerSheet`, `RenameSheet`, `RestoreSheet`, `CritterSheet`, `RecipeSheet`, `ConfirmSheet`, `PuzzleSheet`, `CustomTaskSheet`, `TaskSheet`) | Suppression du trait décoratif dupliqué ; `PickerSheet` : `closeButton={false}` |
| `src/lib/sheetHistory.ts` (nouveau, seconde passe) | Historique du navigateur : une entrée par fiche ouverte, « Retour » ferme la fiche, aucune entrée orpheline (§ 8.1) |
| `src/components/BottomSheet.tsx` (seconde passe) | Rôle `dialog` sur le panneau, focus à l’ouverture/fermeture, piège de Tab, `inert` sur le fond et les fiches du dessous (§ 8.2) |
| `src/test/setup.ts` | Après chaque test, attend que l’historique simulé soit revenu en phase (évite qu’un retrait d’entrée tardif change l’adresse du test suivant) |
| `src/features/recipes/RecipeSheet.tsx` | Miniatures, ingrédients en premier, liste « au choix » à images différées |
| `src/features/recipes/IngredientThumb.tsx` (nouveau) | Miniature avec emoji de repli |
| `src/features/recipes/ingredientImages.ts` (nouveau, **généré**) | Table identifiant → image du wiki, 198 entrées vérifiées |
| `src/features/recipes/display.ts` | `ingredientImageUrl`, `ingredientEmoji` |
| `scripts/resolve-ingredient-images.mjs` (nouveau) | Établit et contrôle la table (manuel, aucune image enregistrée) |
| `src/data/portraits.ts` + `vite.config.ts` | Motif du cache des portraits restreint aux 74 portraits |
| `tsconfig.json` | `allowImportingTsExtensions` : `vite.config.ts` importe `./src/data/portraits.ts` avec son extension (sinon Vite avertit à chaque lancement) |

Tests ajoutés : `BottomSheet.test.tsx` (16), `RecipeSheet.test.tsx` (10), un test dans `portraits.test.ts`,
`e2e/sheets.spec.ts` (17). Aucune donnée utilisateur, aucun IndexedDB, aucune migration, aucune sauvegarde, aucun
catalogue touché.

## 5. Tests réalisés (11/11/2026)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx vitest run` | **27 fichiers, 353 tests réussis** (27 nouveaux tests, donc 326 avant ; deux échecs lors d’une exécution intermédiaire venaient de mes propres tests : l’un a révélé le défaut du verrou de défilement avec des fiches empilées, corrigé, l’autre était une erreur d’attente dans le test) |
| `npm run build` | réussi ; catalogue inchangé (`catalog.data-_94C6Zdg.js`) ; `sw.js` : route des portraits restreinte, aucune adresse d’ingrédient |
| `npx playwright test` (Edge, 360 px, tactile) | **55 tests réussis** ; `sheets.spec.ts` rejoué 3 fois de suite : 51/51 |
| Contrôle ponctuel avec le **vrai** wiki | 4 images de 120 px chargées, 2ᵉ ouverture servie par le cache, cache du service worker vide |

Scénarios de fermeture couverts en vrai navigateur : croix (taille ≥ 36 px, dans l’écran), appui à côté, Échap,
glissement tactile réel (événements de toucher, via le protocole de débogage) depuis la poignée et depuis le contenu,
**petit glissement qui ne ferme pas**, **contenu défilé qui ne ferme pas** (croix toujours visible), boutons de la fiche
toujours cliquables, bouton « retour », fiche d’animal, renommage au-dessus d’une fiche, ordinateur (1280 px : Échap,
croix, clic à côté, fiche étroite et centrée), tablette (768 px). Recettes : plusieurs ingrédients, un « au choix »,
images simulées chargées, images **en échec**, images **différées**.

## 6. Limites connues

- **Aucun test sur un vrai téléphone** : ni iPhone/Safari, ni Android réel. Les glissements sont simulés au niveau du
  navigateur (Edge). Le comportement sous iOS (barre d’adresse qui se replie, rebond du défilement) n’est pas vérifié.
- Le glissement est **tactile uniquement** (pas à la souris) : sur ordinateur, on utilise la croix, Échap ou le fond.
- **Images** : dépendance au wiki (communautaire, non officiel). Si le wiki renomme des fichiers, certaines images
  tomberont en repli emoji ; relancer le script régénère la table. Le wiki indique ralentir puis suspendre les usages
  intensifs de son API sans accord préalable : le script ne fait que ~10 requêtes d’API + ~200 requêtes `HEAD`, à lancer
  rarement. Les droits des visuels appartiennent à Disney et Gameloft.
- Le motif de cache des portraits est maintenant **exact** : ajouter un portrait dans `PATHS` suffit (le motif suit),
  mais une image du wiki ajoutée *ailleurs* dans l’application ne sera jamais en cache hors ligne.
- **Non mesuré** : le comportement du cache HTTP sur téléphone (limites de taille plus basses).

## 7. Pistes non réalisées, classées

1. ~~Bouton « Retour » qui ferme la fiche~~ et ~~piège du focus~~ : faits (§ 8), à confirmer sur un vrai téléphone.
2. **Test sur un vrai Android et un vrai iPhone** avant publication (voir § 8, « Ce qu’il faut vérifier à la main »).
3. **Rappel de sauvegarde** : afficher « dernière copie exportée il y a X jours » (nécessite de mémoriser une date :
   touche à la zone sauvegarde, donc à décider).
4. Recherche : « recettes que je peux faire avec ces ingrédients » (saisie de l’inventaire).
5. Test sur un vrai iPhone et un vrai Android avant publication.

## 8. Seconde passe : bouton « Retour » et accessibilité des fiches

### 8.1 Bouton « Retour »

**Le problème.** Une fiche n’est pas une adresse : c’est un état local de l’écran. « Retour » quittait donc l’écran. Pour que
« Retour » ferme la fiche il faut que l’historique du navigateur contienne **une entrée par fiche ouverte**. Le danger
connu de cette technique : des entrées **orphelines** (une entrée « fiche » qui reste dans l’historique alors que la fiche est
fermée), qui obligent à appuyer deux fois sur « Retour ».

**Solutions étudiées.**

| Solution | Verdict |
|---|---|
| Mettre la fiche dans l’adresse (`#/collection/recettes?fiche=…`) | Exact et sans orphelin, mais il faudrait représenter dans l’adresse les 10 sortes de fiches (renommage, confirmation, formulaires…) : refonte du routeur, hors périmètre |
| `pushState` à l’ouverture, `history.back()` à la fermeture | Fragile : `back()` est asynchrone ; une fiche qui en remplace une autre dans le même rendu (recette → renommage) ou un « Retour » arrivant pendant l’opération laisse une entrée en trop ou en moins |
| Navigation API | Pas disponible partout (Safari, Firefox) |
| **Une règle unique de cohérence : « l’historique contient exactement autant d’entrées *fiche* que de fiches ouvertes »** | **Retenue** : un seul code (`src/lib/sheetHistory.ts`) corrige toutes les dérives, quelle que soit leur origine |

**Fonctionnement** (`sheetHistory.ts`, utilisé par `BottomSheet`).
- Une entrée « fiche » a **la même adresse** que l’écran (pas de `hashchange`, le routeur ne bouge pas) et un `state`
  `{ ddvSheets: n }` = « n fiches ouvertes ».
- À chaque changement, `reconcile()` compare le nombre de fiches ouvertes (`want`) au compteur de l’entrée courante (`have`) :
  - `want > have` → `history.pushState` ; `want < have` → `history.go(-(have - want))`.
- **« Retour »** : le navigateur retire l’entrée, `popstate` arrive, on ferme les fiches en trop (celle du dessus d’abord).
- **Croix, glissement, clic à côté, Échap, boutons de la fiche** : la fiche se démonte, il y a une entrée en trop, on la
  retire. Aucun cas particulier par mode de fermeture.
- **Fiche qui en remplace une autre** (recette → renommage) : `reconcile` est différé d’une micro-tâche, il voit « une fiche
  avant, une fiche après » et ne touche à rien (testé : ni `pushState` ni `go`).
- **`history.go` est asynchrone** : tant qu’un retrait demandé par nous n’est pas terminé (`pending`), on n’ajoute rien.
  Une minuterie de sécurité (1 s) évite de rester bloqué si `popstate` n’arrive jamais.
- **Le parent refuse de fermer** (opération en cours) : après « Retour », la fiche est toujours là, l’entrée est remise.
- **Changement d’écran avec une fiche ouverte, rechargement, « Suivant »** : on retombe sur une entrée « fiche » sans fiche
  ouverte (orpheline) ; elle est **sautée aussitôt** (`history.go(-n)`). Conséquence connue : « Suivant » ne peut pas
  rouvrir une fiche (de toute façon sans intérêt).
- **Si le navigateur refuse** `pushState` (SecurityError, Safari au-delà de 100 appels en 30 s) : le mécanisme se désactive
  et les fiches marchent comme avant (croix, glissement, Échap, clic à côté).

**Aucune donnée n’est touchée** : ni IndexedDB, ni sauvegardes. L’entrée d’historique n’a qu’un compteur entier.

**Tests.**
- `src/lib/sheetHistory.test.tsx` : 10 tests sur le vrai historique de jsdom (ouvrir/Retour, croix, fond, Échap,
  ouvrir-fermer-rouvrir sans accumulation, fiches empilées, remplacement dans un même rendu, refus du parent, changement
  d’écran, `pushState` refusé). **Contrôle négatif** : avec `reconcile` neutralisé, 9 tests sur 10 échouent.
- `e2e/sheets.spec.ts` (Edge, tactile, vrai historique) : Retour ferme et reste ; **chaque** mode de fermeture
  (croix, appui à côté, Échap, glissement) suivi d’**un seul** Retour qui quitte l’écran ; ouvrir/fermer trois fois sans
  accumulation (`history.length`) ; renommage au-dessus d’une fiche ; changement d’écran avec fiche ouverte ; rechargement ;
  Retour puis Suivant ; fiche d’animal. **Contrôle négatif** : avec la gestion désactivée, 8 des 11 scénarios échouent
  (les 3 autres décrivent des cas où rien ne se passe).

### 8.2 Accessibilité des fiches

Tout est dans `BottomSheet` : les 10 fiches en profitent.

| Besoin | Fait |
|---|---|
| **Rôle et nom** | `role="dialog"`, `aria-modal="true"` et le nom (`aria-labelledby` ou `aria-label`) sont maintenant sur le **panneau** (avant : sur l’enveloppe plein écran). C’est l’élément qui reçoit le focus ; un lecteur d’écran annonce « Titre, boîte de dialogue » |
| **Focus à l’ouverture** | Le focus entre dans la fiche (le panneau, `tabIndex=-1`). Si un champ de la fiche a `autoFocus` (renommage), il le garde |
| **Piège du focus** | **Tab** et **Maj+Tab** tournent à l’intérieur de la fiche. Sont ignorés : éléments désactivés, `tabindex="-1"`, contenu d’un `<details>` replié (son `<summary>` reste atteignable) |
| **Fond inerte** | Le fond de l’application (`#root`) reçoit l’attribut `inert` tant qu’une fiche est ouverte : plus de focus, plus de lecteur d’écran, plus de clic dans la page derrière |
| **Retour du focus** | À la fermeture, le focus revient à **l’élément qui a ouvert la fiche** (lu pendant le rendu, avant que `autoFocus` ne le déplace). Si une fiche en remplace une autre (renommage), le focus revient au bouton d’origine de la **première** (`baseOpener`) |
| **Fiches empilées** | Seule celle du dessus réagit à Échap et Tab ; celle du dessous est **inerte** ; à la fermeture du dessus, le focus retourne dans celle du dessous |
| **Navigation au clavier** | Entrée sur une ligne ouvre la fiche ; Échap ferme ; toutes les actions sont des `<button>` natifs ; l’anneau de focus du navigateur est visible (capture vérifiée) |
| **Fond et poignée** | `aria-hidden` : un seul bouton « Fermer » annoncé |

**Limites.**
- Le piège du focus et `inert` supposent un navigateur récent (`inert` : Chrome 102, Safari 15.5, Firefox 112). Sur un
  navigateur plus ancien, `inert` est ignoré, mais le piège à la touche Tab fonctionne toujours.
- **Lecteurs d’écran non testés** (ni TalkBack, ni VoiceOver, ni NVDA) : les rôles et noms sont vérifiés par les
  tests, pas leur annonce réelle.
- Le focus n’est rendu que s’il n’a pas été déplacé ailleurs par la personne entre-temps.

### 8.3 Contrôle visuel (Edge, captures à 320, 360 et 1280 px)

Vérifié sur capture : croix bien visible et non recouverte, **poignée** centrée, croix **toujours visible quand la fiche
défile**, anneau de focus visible sur la croix au clavier, miniatures de 40 px alignées avec quantité et nom, emoji de repli
nets, miniatures de 24 px dans la liste « au choix » ouverte, fiche de renommage et fiche d’animal sans chevauchement du titre,
fiche étroite et centrée sur ordinateur. **Mesure de débordement** (largeur de la page et de la fiche) : 0 px à 320 et à
360 px. **Non vérifié** : Safari, tout vrai téléphone (voir ci-dessous).

### 8.4 Tests de la seconde passe (11/11/2026)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npx vitest run` | **28 fichiers, 370 tests réussis** (353 avant : +10 historique, +7 accessibilité) |
| `npm run build` | réussi ; catalogue inchangé |
| `npx playwright test` (Edge, 360 px, tactile) | **68 tests réussis** ; `sheets.spec.ts` rejoué 3 fois : **90/90** |

### 8.5 Ce qu’il faut vérifier à la main sur un vrai téléphone

1. **Android (application installée)** : ouvrir une fiche, appuyer sur « Retour » → la fiche se ferme, l’écran reste ; second
   « Retour » → écran précédent. Fermer par la croix, puis « Retour » → **un seul** appui doit quitter l’écran.
2. **Android, plusieurs fois de suite** : ouvrir/fermer 5 fois puis « Retour » : aucune entrée à vide.
3. **iPhone/Safari** : geste de retour depuis le bord gauche avec une fiche ouverte ; vérifier qu’il ferme la fiche
   (le mécanisme repose sur `popstate`, **non testé sur Safari**). Si Safari refuse trop d’appels à `pushState`, les fiches
   fonctionnent sans le bouton « Retour » (repli prévu, non observé).
4. **Chrome Android** : certaines versions ignorent les entrées d’historique créées sans geste de la personne. Les fiches
   s’ouvrent après un appui, donc c’est normalement couvert, mais **non vérifié sur téléphone**.
5. **Lecteur d’écran** (TalkBack, VoiceOver) : annonce du titre à l’ouverture, impossibilité d’atteindre la page derrière.
6. **Clavier physique** sur tablette ou ordinateur : Tab, Maj+Tab, Échap, retour du focus.
7. Barre d’adresse qui se replie (iOS) et rebond du défilement : la fiche ne doit pas se déplacer.
