# Comprendre Dreamlight Compagnons

Guide pour comprendre **comment l'application fonctionne** et **pourquoi elle est construite ainsi**. Il complète le
[README](../README.md) (référence rapide) et le [journal de l'audit](modifications-audit-2026-11.md) (ce qui a été corrigé
et pourquoi). Il part de zéro : aucune connaissance de React ou d'IndexedDB n'est supposée.

> Convention de ce guide : ce qui est **vérifié dans le code ou par une mesure** est affirmé ; ce qui ne l'est pas est
> marqué « à confirmer » ou « non vérifié ».

## Sommaire

1. [À quoi sert l'application](#1-à-quoi-sert-lapplication)
2. [Les outils utilisés](#2-les-outils-utilisés)
3. [Carte du dépôt](#3-carte-du-dépôt)
4. [Ce qui se passe au démarrage](#4-ce-qui-se-passe-au-démarrage)
5. [React et les hooks](#5-react-et-les-hooks)
6. [TypeScript, en pratique](#6-typescript-en-pratique)
7. [IndexedDB : où vivent les données](#7-indexeddb--où-vivent-les-données)
8. [Données du jeu et données de la joueuse](#8-données-du-jeu-et-données-de-la-joueuse)
9. [Sauvegarde et restauration](#9-sauvegarde-et-restauration)
10. [Migrations](#10-migrations)
11. [Synchronisation entre onglets](#11-synchronisation-entre-onglets)
12. [Service worker, PWA et hors ligne](#12-service-worker-pwa-et-hors-ligne)
13. [Le catalogue des recettes](#13-le-catalogue-des-recettes)
14. [Les tests](#14-les-tests)
15. [Ajouter une fonctionnalité : la liste de contrôle](#15-ajouter-une-fonctionnalité--la-liste-de-contrôle)
16. [Limites connues](#16-limites-connues)
17. [Glossaire](#17-glossaire)

---

## 1. À quoi sert l'application

Une application web installable (PWA) pour une joueuse de *Disney Dreamlight Valley* : quel habitant a quel métier,
suivi des habitants, tâches du jour, animaux à nourrir, puzzles et anigamis, encyclopédie de 480 recettes.

Trois principes structurent presque toutes les décisions techniques :

1. **Les données de la joueuse ne quittent jamais son téléphone.** Elles sont dans le navigateur (IndexedDB). Il n'y a
   pas de serveur, pas de compte. La seule « vraie » sauvegarde est le fichier qu'elle exporte.
2. **Ne jamais perdre ni abîmer ces données.** D'où les écritures atomiques, les copies de sécurité, les migrations
   reprenables et les contrôles très stricts à l'import.
3. **Ne jamais présenter une donnée incertaine comme certaine.** Un nom français non confirmé est « à confirmer », une
   valeur minimale s'affiche « à partir de », une composition déduite est signalée.

## 2. Les outils utilisés

| Outil | Rôle ici | Pour le comprendre |
|---|---|---|
| **React 19** | Construit l'interface à partir de *composants* (fonctions qui renvoient de l'affichage). | Voir §5. |
| **TypeScript** | JavaScript avec des *types* vérifiés avant l'exécution. | Voir §6. |
| **Vite 8** | Outil de développement et de construction (`npm run dev`, `npm run build`). | Il assemble le code en fichiers prêts à publier dans `dist/`. |
| **Tailwind CSS 4** | Style par petites classes (`rounded-3xl`, `text-gold-200`…) directement dans le code des composants. | Pas de gros fichiers CSS à maintenir. |
| **idb-keyval** | Petite bibliothèque au-dessus d'IndexedDB (la base de données du navigateur). | Voir §7. |
| **vite-plugin-pwa / Workbox** | Génère le *service worker* qui permet l'installation et le hors ligne. | Voir §12. |
| **Vitest** | Tests unitaires et de composants (rapides, sans vrai navigateur). | Voir §14. |
| **Playwright** (avec Edge) | Tests de bout en bout dans un vrai navigateur, écran de 360 px. | Voir §14. |

Il n'y a **pas de routeur externe** : la navigation repose sur l'adresse (`#/collection/recettes`) lue par
`src/lib/router.ts`.

## 3. Carte du dépôt

```
src/
  main.tsx            point d'entrée : enregistre le service worker, démarre React
  App.tsx             assemble les 5 « hooks de données », choisit l'écran selon l'adresse
  data/               les catalogues du jeu (habitants, métiers, Numismagie, portraits)
  lib/                les briques techniques partagées
    db.ts             accès IndexedDB + transactions atomiques (transact / commit)
    storage.ts        métiers (assignments) et photos
    migrations.ts     version des données + migrations reprenables
    backup.ts         export / import / restauration
    sync.ts           synchronisation entre onglets
    names.ts          noms personnalisés
    router.ts         lecture de l'adresse (#/…)
    useCompanions.ts  hook des habitants et métiers
  features/           une fonctionnalité = un dossier (même structure à chaque fois)
    villagers/ tasks/ critters/ tales/ recipes/ collection/
  components/         éléments d'interface partagés (fiche du bas, filtres, avatar…)
  screens/            écrans « historiques » (Métiers, Habitants, Numismagie, Infos)
scripts/
  build-recipes.py    génère le catalogue des recettes depuis scripts/data/
  data/               données sources figées + rapport de génération
e2e/                  tests de bout en bout (Playwright)
docs/                 cette documentation
.github/workflows/    publication automatique sur GitHub Pages
```

**Le motif par fonctionnalité** (le plus utile à retenir). Chaque dossier de `src/features/` suit la même recette :

| Fichier | Contenu |
|---|---|
| `data.ts` / `catalog.ts` | Le catalogue statique (ce qui vient du jeu). Jamais écrit dans la base. |
| `model.ts` | Les règles : types, `sanitizeX` (nettoyage), opérations pures (`applyXOp`). Aucun accès à la base. |
| `storage.ts` | Lecture / écriture dans IndexedDB, via `transact()`. |
| `useX.ts` | Le *hook* qui relie tout cela à React. |
| `XScreen.tsx` + fiches | L'affichage. |

Séparer « règles » (pures, faciles à tester) et « stockage » (asynchrone, délicat) est le choix central de l'architecture.

## 4. Ce qui se passe au démarrage

```
navigateur ouvre la page
   │
   ▼
main.tsx ── registerSW() ─────────────► le service worker s'installe en arrière-plan (§12)
   │
   ▼
App.tsx  appelle 5 hooks : useCompanions, useTasks, useCritters, useTales, useRecipes
   │            chacun fait :  prepareDatabase()  ──► migrations si nécessaire (§10, une seule fois)
   │                           puis lit SA clé dans IndexedDB, nettoie (sanitize), met en état React
   ▼
tant que les 5 ne sont pas « ready »  → écran « Ouverture de la vallée… »
si l'un d'eux a une erreur             → LoadErrorScreen : l'app est BLOQUÉE (jamais d'écran modifiable)
sinon                                  → l'écran correspondant à l'adresse (#/…)
```

Pourquoi bloquer l'app en cas d'erreur de chargement ? Si on affichait un écran vide et modifiable, la moindre action
écraserait des données qu'on n'a simplement pas réussi à lire. Mieux vaut ne rien permettre et proposer une copie de
secours quand les données sont encore lisibles.

## 5. React et les hooks

**Composant** : une fonction qui reçoit des données (*props*) et renvoie de l'affichage. Quand les données changent,
React redessine ce qui a changé.

**État** (`useState`) : une valeur que le composant retient entre deux affichages. Changer l'état redessine.

**Effet** (`useEffect`) : du code qui s'exécute *en dehors* de l'affichage (lire la base, écouter un événement) et qui
peut nettoyer derrière lui.

**Hook personnalisé** : une fonction `useQuelqueChose` qui regroupe état + effets pour les réutiliser. Ici, chaque
fonctionnalité a le sien. Voici `useRecipes` (`src/features/recipes/useRecipes.ts`) expliqué :

```ts
const [ready, setReady]     = useState(false)        // le chargement est-il terminé ?
const [failure, setFailure] = useState(null)         // erreur de chargement (bloque l'app)
const [data, setData]       = useState(emptyRecipes) // le suivi (recettes connues, favorites)
const [error, setError]     = useState(null)         // échec inattendu à afficher en bandeau
const loadedRef = useRef(false)                      // « les données sont-elles chargées ? » sans redessiner
const syncRef   = useRef(null)                       // la synchronisation entre onglets (§11)
```

Les deux moments importants :

1. **Au chargement** (`useEffect`) : crée la synchronisation, attend `prepareDatabase()` (migrations), lit la clé
   `recipes`, la nettoie, remplit `data`. En cas d'échec : `failure` est rempli et, si les données restent lisibles, on le
   note (`readable`) pour proposer une copie de secours. Un drapeau `cancelled` évite de modifier l'état d'un composant déjà
   disparu (par exemple en développement, où React exécute volontairement l'effet deux fois).
2. **À chaque action** (`apply(op)`) : 
   - *affichage immédiat* : on applique l'opération à l'état affiché (si elle est valable) pour que l'écran réagisse sans
     attendre ;
   - *enregistrement* : `updateRecipes(op)` lit **l'état réellement enregistré**, applique l'opération et réécrit, dans
     une seule transaction (§7) ; le résultat enregistré **fait foi** et remplace l'affichage ;
   - *prévenir les autres onglets* : `sync.notify('changed')` ;
   - *en cas d'échec* : message d'erreur, et `refresh()` relit la base pour revenir à la vérité.

C'est la même ossature pour les cinq hooks. `App.tsx` en tire `ready` (tous prêts) et `loadError` (la première erreur).

## 6. TypeScript, en pratique

TypeScript ne change rien à l'exécution : c'est une vérification *avant*. Exemples concrets du projet :

- `type RecipeOp = { type: 'set-known'; id: string; known: boolean } | { type: 'set-favorite'; … }` : une *union*. Le
  compilateur oblige à traiter chaque cas et refuse une opération mal formée.
- Les données lues dans la base ou dans un fichier importé sont de type `unknown` : **on ne leur fait pas confiance**.
  Elles passent par des fonctions `sanitizeX` / des gardes de type (`isRecipeId`, `isPlainObject`) avant d'être utilisées.
  C'est la frontière entre « données extérieures » et « données sûres ».
- `npx tsc --noEmit` vérifie tous les types sans rien écrire. **N'utilisez pas `tsc -b`** dans ce projet : il écrit des
  fichiers `.js` dans `src/`.

**Sécurité des identifiants.** Un objet JavaScript hérite de propriétés (`constructor`, `toString`, `__proto__`). Tester
`'constructor' in catalogue` répondrait « oui ». Le projet utilise donc toujours `Object.hasOwn(objet, id)` (voir
`isCharacterId`, `isRecipeId`…) et `isPlainObject` (qui refuse les objets au prototype modifié). C'est ce qui empêche un
fichier d'import malveillant de glisser un identifiant piégé.

## 7. IndexedDB : où vivent les données

**IndexedDB** est la base de données intégrée au navigateur : persistante, asynchrone, par site. Le projet l'utilise de
façon volontairement minimale (`src/lib/db.ts`) :

- **une base** (`dreamlight-compagnons`), **un seul magasin** (`kv`, « clé → valeur »). On n'ajoute jamais de magasin
  (cela imposerait une migration de structure risquée), seulement de **nouvelles clés**.
- Les valeurs sont du JSON ordinaire (sauf les photos, des `Blob`).

| Famille de clés | Exemples | Contenu |
|---|---|---|
| Données de la joueuse | `assignments`, `villagers`, `tasks`, `critters`, `tales`, `recipes`, `names` | Une clé par fonctionnalité. |
| `portrait:<id>` | `portrait:ariel` | Photos personnelles (Blob). |
| `snapshot:<nom>` | `snapshot:pre-import`, `snapshot:pre-v3` | Copies de sécurité locales. |
| `meta:<nom>` | `meta:schema`, `meta:migration` | Version des données, migration en cours. |

### Les transactions atomiques

Problème : deux onglets ouverts, ou un plantage au milieu d'une écriture, ne doivent jamais laisser des données
à moitié écrites ni écraser le travail d'un autre.

`transact(reads, plan)` résout cela : **lire → décider → écrire dans une seule transaction `readwrite`**. Pendant cette
transaction, aucun autre onglet ne peut écrire. Si `plan` lève une erreur, ou si l'écriture échoue, **rien n'est écrit**.

Deux règles qui en découlent :

- `plan` est **synchrone** : attendre autre chose qu'IndexedDB fermerait la transaction avant l'écriture.
- On ne réenregistre **jamais** un état complet gardé en mémoire : on relit, on applique *une* opération, on réécrit. Deux
  onglets qui cochent deux recettes différentes en même temps conservent donc **les deux**.

Exemple réel (`updateRecipes`) : lit la clé `recipes`, applique l'opération sur la version *nettoyée*, puis écrit
`{ ...brut, ...nouveau }` : les **champs inconnus** (écrits par une version plus récente de l'app) sont conservés.

`commit()` est la même chose sans lecture : « écrire et supprimer plusieurs clés, tout ou rien ».

**Garde-fou de version** : `transact` relit aussi `meta:schema` dans la transaction ; si les données ont été migrées par une version
plus récente que le code (`MAX_WRITABLE_SCHEMA`), la transaction est annulée avec `NewerDataError` et l'écran demande de recharger
l'app. Ce contrôle ne protège que le code qui le contient (pas une ancienne version déjà déployée) : pour protéger une donnée
contre une ancienne version, on la range dans **sa propre clé** (exemple : `critterLevels`, niveaux des compagnons).

## 8. Données du jeu et données de la joueuse

- Le **catalogue** (habitants, animaux, recettes…) est dans le code. Il ne change pas à l'exécution.
- Les **données de la joueuse** ne contiennent que des **identifiants stables** et des valeurs (dates, compteurs). Par
  exemple `recipes = { known: { "pasta": "2026-11-09T…" }, favorites: {…} }` : jamais le nom ni la fiche de la recette.
- Un identifiant n'est **jamais modifié** une fois publié (sinon les données enregistrées ne retrouveraient plus leur
  cible). Les noms, eux, peuvent changer librement.
- Les **noms personnalisés** (`names`) sont une section à part, clé `<catalogue>:<id>` (`recipe:…`, `critter:…`). Un nom
  personnalisé n'est jamais écrit dans un catalogue : le nom officiel reste intact et réapparaît si on l'efface.

## 9. Sauvegarde et restauration

Code : `src/lib/backup.ts`. **La vraie sauvegarde est le fichier exporté** (Infos › Exporter une copie), à garder hors du
téléphone. Les copies `snapshot:*` ne protègent que d'une erreur de migration ou de restauration, pas de la perte du
téléphone ni de l'effacement des données du navigateur.

**Export** (`createBackup`) : un fichier JSON `{ app, format: 2, type, exportedAt, schema, sections }`. Chaque donnée est
une *section* déclarée dans `DATA_SECTIONS` : `assignments`, `villagers`, `tasks`, `critters`, `critterLevels`,
`tales`, `recipes`, `names` ; plus `photos` (facultative). Les photos sont converties en `data:image/jpeg;base64,…`.

**Import** en trois temps, du plus prudent au plus engageant :

```
fichier choisi
  │  taille > 25 Mo ?  ──────────────► refusé AVANT d'être lu en mémoire (AboutScreen)
  ▼
parseBackupText(texte)
  │  taille réelle en octets > 25 Mo ? ► refusé avant tout JSON.parse
  │  JSON invalide / pas de cette app / format plus récent / section abîmée ► refusé, rien n'est modifié
  │  chaque section passe par son sanitizeX : habitants, métiers, noms inconnus écartés et SIGNALÉS
  ▼
planRestore(...)  ──► la fiche « Restaurer » montre ce qui sera remplacé (rien n'est encore écrit)
  ▼
applyRestore(...) ──► UNE transaction : lit l'état actuel, écrit la copie « snapshot:pre-import », remplace, relit.
                      Échec ⇒ rien n'est écrit, pas même la copie. « Annuler » restaure la copie.
```

Règles à connaître :
- Une section **absente** du fichier est **conservée** (sauvegarde plus ancienne). Une section **abîmée** fait refuser le
  fichier (jamais lue comme vide, ce qui effacerait les données).
- Une version de données **plus récente** que l'app : restauration complète refusée (« mets l'app à jour »).
- Photos : `null` = non incluses → celles du téléphone sont conservées ; `{ data: {} }` = aucune → supprimées ;
  `{ data: { id: dataURL } }` = exactement celles-là. Une photo doit être `image/jpeg|png|webp` en base64, ≤ 1,5 M de
  caractères, pour un habitant connu.
- **Limite 25 Mo** : un export réaliste fait ≈ 4 Mo (photos de 256 px, 20 à 55 Ko). Le contrôle est double (taille du
  fichier puis taille en octets UTF-8 du texte). Voir le [journal](modifications-audit-2026-11.md#1-limite-de-taille-de-limport-25-mo).

## 10. Migrations

Quand la *forme* des données change, une **migration** transforme les anciennes données (`src/lib/migrations.ts`). La
version courante est stockée dans `meta:schema` (aujourd'hui **3** : v2 = numérotation + copie de sécurité ; v3 = habitants
ayant un métier marqués « débloqués »). Les phases 2 à 5 n'ont **pas** relevé la version : elles ajoutent des clés
nouvelles, lues comme vides quand elles sont absentes.

Une migration est une **fonction pure** `données → nouvelles données`. Le moteur l'exécute en cinq étapes protégées :

1. copie de toutes les données dans `snapshot:pre-v<n>` (écrite seulement si absente, relue, jamais écrasée) ;
2. calcul de la nouvelle version **depuis cette copie** ;
3. écriture atomique des seules clés modifiées + un marqueur `meta:migration` ;
4. relecture et comparaison de ce qui a été écrit ;
5. pose de `meta:schema = n` et retrait du marqueur.

Si l'app est fermée au milieu, **le lancement suivant reprend** depuis la copie (le marqueur signale qu'une migration
n'est pas allée au bout). Un verrou (`navigator.locks`) garantit qu'un seul onglet migre à la fois. Règle absolue : une
migration ne doit jamais modifier `assignments` (les métiers, le cœur de la v1) ; le moteur le vérifie.

## 11. Synchronisation entre onglets

Les écritures sont déjà sûres entre onglets (§7). Reste un problème d'**affichage** : si l'onglet A coche une recette,
l'onglet B doit le montrer. `src/lib/sync.ts` s'en charge :

```
onglet A : updateRecipes(...) réussit ──► sync.notify('changed')
                                              │   BroadcastChannel (sinon : petite clé localStorage + événement « storage »)
                                              ▼
onglet B : reçoit le message ──► refresh() : relit sa clé dans IndexedDB ──► l'écran se met à jour
```

- Un onglet **ignore ses propres messages** (identifiant unique par onglet).
- Après une **restauration**, le message est `restored` et chacun relit tout.
- Filet de sécurité : relecture quand l'onglet **redevient visible**, même si aucun message n'est arrivé.
- Les messages ne contiennent aucune donnée : seulement « quelque chose a changé ». C'est la base qui fait foi.

## 12. Service worker, PWA et hors ligne

**PWA** : une application web qu'on peut *installer* sur l'écran d'accueil et qui peut fonctionner sans réseau. Elle
repose sur :

- un **manifeste** (`manifest.webmanifest` : nom, icônes, couleurs) généré par `vite-plugin-pwa` ;
- un **service worker** (`sw.js`) : un programme que le navigateur garde en arrière-plan et qui **intercepte les
  requêtes réseau** de la page pour répondre depuis un cache. Il n'est actif qu'en **HTTPS** (ou sur `localhost`) : servie
  en `http://192.168.x.x`, l'app fonctionne mais ne s'installe pas et n'est pas disponible hors ligne.

Deux stratégies de cache coexistent (`vite.config.ts`) :

| | **Pré-cache** | **Cache d'exécution** (portraits) |
|---|---|---|
| Quoi | Tous les fichiers de l'app (`js, css, html, svg, png, woff2`) : 19 entrées, ≈ 829 Kio | Les vignettes de portraits hébergées sur le wiki |
| Quand | Téléchargés **à l'installation** du service worker | Mis en cache **à la première vue** |
| Stratégie | Versionné par le build | `CacheFirst`, 200 entrées, 180 jours |

- `registerType: 'autoUpdate'` : une nouvelle version de l'app se met à jour toute seule.
- `navigateFallback: 'index.html'` : toute adresse retombe sur l'application (c'est une application « une page »).
- **Le catalogue des recettes** (`catalog.data-….js`, 169 Ko) est un module **chargé à la demande**, mais il fait partie du
  pré-cache : il est donc disponible hors ligne **même si les recettes n'ont jamais été ouvertes**. Un test de bout en bout
  le prouve (§14), et un contrôle négatif prouve que ce test détecte la disparition de ce pré-cache.
- **Portraits** : ils viennent d'un autre domaine ; une balise `<img>` reçoit alors une réponse **opaque** (le code ne peut ni
  lire son statut ni sa taille), d'où le statut `0` accepté dans le cache. Coût **mesuré** : ≈ 9,2 Mo comptés dans le quota
  par portrait opaque (≈ 680 Mo pour 74), surtout du remplissage de sécurité. Détails et pistes : README, section
  « Portraits », et [journal](modifications-audit-2026-11.md#3-cache-des-portraits-mesure-sans-changement).
  Hors ligne, un portrait absent du cache est remplacé par un médaillon à initiales.

## 13. Le catalogue des recettes

### 13.1 D'où viennent les données

```
scripts/data/                       (sources FIGÉES, versionnées)
  wiki-cooking.txt   480 recettes du wiki (catalogue MAÎTRE)
  wiki-pages.txt     1 ligne par recette, relevée sur la FICHE du wiki (type, collection, prix, énergie, « or more »)
  gamosaurus.json    453 entrées (noms français, ingrédients, énergie, prix)
  gameblog.json      215 entrées (noms français, ingrédients, prix minimal)
        │
        ▼   python scripts/build-recipes.py   (échoue si un contrôle casse)
        │
        ├─► src/features/recipes/catalog.data.ts   catalogue complet (≈ 220 Ko, chargé à la demande)
        ├─► src/features/recipes/ids.ts            identifiants seuls (léger, dans le paquet principal)
        └─► scripts/data/recipes-report.md         statistiques et « Périmètre des contrôles »
```

**Ne modifiez jamais les fichiers générés à la main** : relancez le script. Il est reproductible (régénéré dans un dossier
temporaire lors de l'audit : sorties identiques octet pour octet).

### 13.2 Chargement à la demande

`catalog.ts` expose `loadRecipeCatalog()` :

```ts
cache ??= import('./catalog.data').then(buildCatalog, (err) => { cache = null; throw err })
```

- `import(...)` est un *import dynamique* : Vite met `catalog.data` dans un fichier séparé, téléchargé seulement quand
  l'écran des recettes s'ouvre.
- Le résultat est **mémorisé** (`cache`) : un seul chargement. En cas d'échec, le cache est vidé pour qu'un nouvel essai
  soit possible : l'écran affiche « Le livre de recettes n'a pas pu être chargé » avec **Réessayer**. Les recettes déjà
  marquées « connues » ne sont pas touchées (elles sont dans IndexedDB, pas dans le catalogue).
- `ids.ts` (léger) reste dans le paquet principal : il sert à **valider** les identifiants (`isRecipeId`) à l'import et
  dans les opérations, sans charger le gros fichier.

### 13.3 Le modèle de données d'une recette

- **Places d'ingrédients** : soit un ingrédient fixe (quantité exacte), soit un **choix** (« 1 parmi un groupe », par
  exemple Fruit) pouvant être restreint. Les groupes (11) sont la seule source des membres des choix.
- **Nom français** (`frStatus`) : `two-guides`, `one-guide` ou `en-only`. **Jamais « officiel »**. Deux guides ne valent pas
  deux vérifications indépendantes (l'un a pu copier l'autre).
- **Énergie et prix** (`{ v, k, s }`) : `v` = valeur ; `k` = `min` (la fiche du wiki dit « or more » : valeur la plus basse
  possible) ou `exact` ; `s` = concordance avec les guides (`wiki-only`, `agree`, `differs`). Les deux informations sont
  **indépendantes**. Un minimum s'affiche « à partir de X » (« dès X » en liste), même quand les guides concordent.
- **Groupe `Any Meat`** : composition **déduite**, `confirmed: false`, signalée à l'écran.
- **Suivi** (`recipes` dans IndexedDB) : `known[id]` et `favorites[id]` = dates ISO, indépendantes.

### 13.4 Ce que les contrôles prouvent… et ne prouvent pas

| Élément | Contrôle réalisé | Portée |
|---|---|---|
| Type, collection, prix, énergie, minimum/exact | Comparaison de `wiki-pages.txt` (480 fiches) au tableau maître, **0 écart** | Les **480** recettes. Fidélité de ces deux transcriptions au wiki en ligne : **non rejouée** |
| **Ingrédients** | Relus sur les fiches du wiki | **Échantillon de 30 recettes** (6 par extension, 3 avec choix, 3 sans) : 29 identiques, 1 écart traité (Plain Snow Cones). **Ce n'est pas une validation des 480 recettes** |
| Ingrédients des ~450 autres | Aucun contrôle individuel. L'appariement avec les guides utilise les ingrédients **comme critère** : il ne valide donc rien | **Non vérifié** |
| Noms français | Relevés dans des guides ; contrôlés dans le HTML de Gamosaurus sur l'échantillon seulement | Jamais vérifiés en jeu |
| Les 8 valeurs « exactes » | La fiche ne dit pas « or more » | **Selon le wiki**, indice et non preuve (Garlic Chocolate Tart, exacte, et Red Velvet, minimum, ont les mêmes valeurs) |

La liste des 30 recettes de l'échantillon n'est pas conservée : ce contrôle n'est pas rejouable à l'identique.

## 14. Les tests

| Niveau | Outil | Ce qu'il vérifie | Commande |
|---|---|---|---|
| Types | TypeScript | Cohérence de tout le code | `npx tsc --noEmit` |
| Unitaires et composants | Vitest + jsdom + `fake-indexeddb` | Règles (`model.ts`), stockage, sauvegarde, migrations (y compris interruption simulée), hooks, écrans. Fuseau forcé sur Bruxelles | `npm test` |
| Bout en bout | Playwright + Edge (écran 360 px) | Vrai IndexedDB, deux onglets, restauration, hors ligne, rendu mobile, absence de défilement horizontal | `npm run test:e2e` |

Points à connaître :
- Playwright **construit** l'app puis la sert sur le port 4174 (`playwright.config.ts`) : il teste la version de
  **production**, service worker compris.
- **Hors ligne, deux scénarios** (`e2e/recipes.spec.ts`) : (1) ouvrir les recettes en ligne puis couper le réseau ;
  (2) **première ouverture** hors ligne d'un catalogue jamais demandé auparavant (le test vérifie que la page n'a pas
  demandé `catalog.data` avant la coupure, que le service worker l'a déjà en cache, puis que l'ouverture hors ligne affiche
  « 480 recettes »). Un troisième cas coupe le réseau **sans service worker** : l'erreur est gérée et « Réessayer » fonctionne.
- **Contrôle négatif** (fait une fois, hors du dépôt) : copie de `dist/` dont `sw.js` ne pré-cache plus le catalogue, servie
  avec `npx vite preview --outDir <copie>`, puis le test « première ouverture » lancé contre elle : il **échoue**, avec le
  message attendu. Cela prouve que le test détecte la régression visée. Détail dans le journal.
- Les tests de bout en bout tournent sur **Edge** : **iPhone / Safari n'est pas testé** (la fiche du bas est rendue dans
  `document.body` à cause d'un défaut connu d'iOS Safari, mais cela n'est pas vérifié sur appareil).

## 15. Ajouter une fonctionnalité : la liste de contrôle

1. **Catalogue** : `data.ts` avec des identifiants stables, `isXId` basé sur `Object.hasOwn`.
2. **Modèle** : `model.ts` avec une clé `X_KEY`, un type, `sanitizeX` (tout est `unknown` à l'entrée), les opérations pures.
3. **Stockage** : `storage.ts` avec `transact()` (une opération par transaction, champs inconnus conservés).
4. **Hook** : `useX.ts` sur le modèle de `useRecipes` (chargement, `apply`, synchronisation).
5. **Branchement** : l'appeler dans `App.tsx` (`ready`, `loadError`) et ajouter la route dans `router.ts`.
6. **Sauvegarde** : une entrée dans `DATA_SECTIONS` (`src/lib/backup.ts`), avec `sanitize`, `count`, et `size` si la forme
   est imbriquée.
7. **Noms personnalisables** : une ligne dans `NAME_CATALOGS` (`src/lib/names.ts`).
8. **Migration** : seulement si la **forme** d'une clé existante change (sinon une nouvelle clé suffit).
9. **Tests** : règles, stockage, import malveillant (`__proto__`, `constructor`), hook, écran, et un test de bout en bout si
   le comportement dépend du navigateur (deux onglets, hors ligne).

## 16. Limites connues

- Recettes : voir §13.4 (échantillon de 30, ingrédients non contrôlés pour les autres, rien vérifié en jeu).
- Portraits : coût de quota des réponses opaques mesuré sur Edge (≈ 9,2 Mo par entrée) ; **non mesuré sur téléphone**.
  Une erreur du wiki mise en cache reste tant que l'entrée est utilisée. Piste (CORS + statut `200` seul) non testée.
- Safari / iPhone : non testé. Mise à jour du service worker : non testée.
- Workflow GitHub Pages : modifié (droits minimaux) mais **non exécuté** ; le premier déploiement est le vrai test. Actions
  non épinglées par SHA (reporté).
- Les tests de bout en bout ne tournent pas dans le workflow de publication (seulement `npm test` et le build).
- `npm audit --omit=dev` : 0 vulnérabilité sur les dépendances de production (11/11/2026) ; les dépendances de
  développement n'ont pas été auditées.

## 17. Glossaire

- **PWA** : application web installable et utilisable hors ligne.
- **Service worker** : programme d'arrière-plan qui répond aux requêtes depuis un cache.
- **Pré-cache** : fichiers téléchargés à l'installation, versionnés par le build.
- **Réponse opaque** : réponse d'un autre domaine dont le navigateur cache le contenu au code (statut 0, taille inconnue).
- **IndexedDB** : base de données du navigateur ; **magasin** (*object store*) : sa « table » ; ici une seule, `kv`.
- **Transaction atomique** : suite d'opérations qui réussissent toutes ou aucune.
- **Hook** : fonction React `useX` qui regroupe état et effets.
- **Sanitize** : nettoyer des données extérieures pour ne garder que ce qui est valide.
- **Snapshot** : copie de sécurité locale (`snapshot:*`).
- **Migration** : transformation des anciennes données vers une nouvelle forme.
- **Import dynamique** : `import()` qui charge un fichier seulement quand on en a besoin.
