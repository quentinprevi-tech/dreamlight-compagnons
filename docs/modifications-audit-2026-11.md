# Journal de l'audit des phases 0 à 5 (novembre 2026)

Ce document explique **ce qui a été vérifié, ce qui a été modifié, pourquoi, et ce qui n'a pas été fait**. Pour le
fonctionnement général de l'application, voir [`comprendre-l-application.md`](comprendre-l-application.md).

- Période : 11/11/2026. Base : état non commité des phases 0 à 5 (45 entrées Git au départ).
- Méthode : audit en lecture seule d'abord (rien modifié, empreinte du dépôt comparée après chaque commande), puis
  corrections validées une par une.
- Aucun commit ni push n'a été fait pendant ce travail.

## 1. Résultat de l'audit (avant corrections)

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit` | Aucune erreur |
| Tests unitaires (Vitest) | 25 fichiers, 322/322 |
| Build + pré-cache | OK, 19 entrées ; le catalogue des recettes (169 Ko) est dans le pré-cache |
| Tests de bout en bout (Playwright, Edge, 360 px) | 36/36 |
| Génération des recettes rejouée dans un dossier temporaire | Fichiers générés identiques octet pour octet |
| Recherche de secrets (arbre + historique Git) | Aucun résultat ; commits sous l'adresse « noreply » GitHub |
| `npm audit --omit=dev` | 0 vulnérabilité (8 paquets de production). Les 520 paquets de développement n'ont **pas** été audités |

Aucun problème bloquant. Les points ci-dessous sont les corrections et examens décidés ensuite.

## 2. Récapitulatif des changements

| # | Sujet | Statut | Fichiers |
|---|---|---|---|
| 1 | Limite de taille de l'import (25 Mo) | **Corrigé** | `src/lib/backup.ts`, `src/screens/AboutScreen.tsx`, tests |
| 2 | Test hors ligne « recettes jamais ouvertes » + contrôle négatif | **Ajouté** | `e2e/recipes.spec.ts` |
| 3 | Cache des portraits | **Mesuré, aucun changement** | (documentation seulement) |
| 4 | Droits du workflow GitHub Pages | **Réduits** | `.github/workflows/pages.yml` |
| 5 | Documentation : périmètre des contrôles, guide, journal | **Ajoutée** | `README.md`, `scripts/build-recipes.py`, `scripts/data/recipes-report.md`, `docs/` |

## 3. Détail

### 1. Limite de taille de l'import (25 Mo)

**Problème.** Le fichier choisi était lu entièrement en mémoire (`file.text()`) puis analysé, sans limite de taille.

**Pourquoi c'est un problème.** Seule la personne qui choisit le fichier est exposée (pas d'attaque à distance), mais un
fichier énorme peut figer ou faire planter l'application, et un message clair vaut mieux qu'un blocage.

**Choix.** 25 Mo : un export réaliste pèse ≈ 4 Mo (photos de 256 px, 20 à 55 Ko chacune, quelques dizaines d'habitants),
donc la marge est ≈ 5. Le contrôle est **double** :
- dans l'interface (`AboutScreen.tsx`) : `file.size` est comparé **avant** `file.text()` : le fichier n'est jamais lu ;
- dans `parseBackupText` (`backup.ts`) : taille réelle **en octets UTF-8**, avant tout `JSON.parse`. Une unité de texte
  occupe au moins 1 octet : plus de 25 M d'unités suffit à refuser sans rien allouer ; sinon, on mesure avec `TextEncoder`
  (jusqu'à 3 octets par unité). On ne suppose donc pas que le contenu est de l'ASCII.

Message : « Ce fichier dépasse la limite de 25 Mo : ce n'est pas une sauvegarde de Dreamlight Compagnons. » Le refus a lieu
avant toute écriture.

**Alternatives écartées.**
- Contrôler seulement `text.length` : faux pour les caractères multi-octets (8,4 M de « € » = 25 Mo mais « 8,4 M de caractères »).
- Contrôler seulement dans l'interface : `parseBackupText` est aussi appelé ailleurs (tests, autres chemins).
- Limite plus basse (10 Mo) : marge trop faible pour de nombreuses photos futures.
- Lecture en flux (*streaming*) : disproportionné pour un fichier de quelques Mo.

**Tests ajoutés (4).** `backup.test.ts` : refus d'un texte trop gros sans rien écrire ; mesure des **octets réels**
(multi-octets refusés au-dessus de 25 Mo, accepté à la limite exacte) ; export réaliste (80 photos de 50 Ko) accepté.
`App.test.tsx` : fichier > 25 Mo refusé avec le message, `text()` jamais appelé, aucune fiche de restauration ouverte.

**Limite.** Comportement avec un très gros fichier sur iPhone / Safari : non testé.

### 2. Test hors ligne « recettes jamais ouvertes » + contrôle négatif

**Problème.** Le test existant ouvrait les recettes **en ligne** avant de couper le réseau : il ne prouvait pas que le
catalogue (chargé à la demande) fonctionne hors ligne s'il n'a jamais été demandé.

**Changement.** Deux tests ajoutés à `e2e/recipes.spec.ts` :
1. **Première ouverture** : installation en ligne, navigation dans d'autres écrans, jamais dans les recettes. Le test
   vérifie que la page n'a **jamais demandé** `catalog.data`, qu'il est **déjà dans le cache** du service worker, puis coupe
   le réseau, recharge, ouvre les recettes : « 480 recettes » s'affiche et la recherche fonctionne.
2. **Sans service worker** (`serviceWorkers: 'block'`), hors ligne : l'écran d'erreur avec « Réessayer » apparaît ; le réseau
   revenu, « Réessayer » charge le catalogue.

**Contrôle négatif (fait une fois, dans un dossier temporaire hors du dépôt).** Pour prouver que le test peut échouer :
1. copier `dist/` ailleurs ;
2. retirer de la copie de `sw.js` l'entrée `{url:"assets/catalog.data-….js",revision:null}` du pré-cache ;
3. servir la copie : `npx vite preview --outDir <copie> --port 4176 --strictPort` ;
4. lancer le test du dépôt contre ce serveur (configuration Playwright temporaire pointant `testDir` sur `e2e/`).

Résultat : le test **échoue** avec « catalog.data absent du cache du service worker » (valeur reçue 0). Le test détecte donc
bien la régression visée.

**Stabilité.** Lancés 3 fois en parallèle (3 travailleurs) puis 3 fois en série (1 travailleur) : 6/6 puis 6/6.

### 3. Cache des portraits : mesure, sans changement

**Constat avant mesure.** La règle de cache des portraits (`vite.config.ts`) est `CacheFirst`, 200 entrées, 180 jours,
statuts `0` et `200`. Le statut `0` est indispensable (réponse « opaque » d'une balise `<img>` cross-domaine), mais soulevait
deux questions : le coût en quota, et la persistance d'une éventuelle erreur mise en cache.

**Mesure (11/11/2026, Edge 157 sans interface, une seule requête externe vers un seul portrait).** Portrait : la vignette
120 px d'Aladdin sur `dreamlightvalleywiki.com` (celle que demande l'application). La réponse a été récupérée en mode
`no-cors` (réponse opaque : type `opaque`, statut `0`), puis **clonée 20 fois sous des clés différentes** dans un cache
temporaire (sans service worker), en mesurant `navigator.storage.estimate()` :

| Mesure | Résultat |
|---|---|
| Coût par entrée opaque dans le quota | **≈ 9 218 159 octets (≈ 9,2 Mo)** |
| Coût par entrée normale de 5 000 octets (témoin) | ≈ 5 094 octets |
| Quota de ce poste | ≈ 10,9 Go |
| Extrapolation 74 portraits | ≈ 680 Mo (≈ 6 % du quota) |
| Extrapolation 200 entrées (plafond actuel) | ≈ 1,8 Go |

Le cache de test a été supprimé ensuite. **Une seule requête réseau** a été faite vers le wiki.

**Interprétation.**
- Le coût est surtout du **remplissage de sécurité** appliqué par le navigateur aux réponses opaques (pour ne pas révéler leur
  taille) : de la comptabilité de quota, pas de l'espace disque réellement occupé.
- Le quota est **partagé avec IndexedDB**, c'est-à-dire avec les données de la joueuse. Sur téléphone le quota est plus
  petit : l'effet réel est **à confirmer (non mesuré sur iPhone / Safari)**.
- Persistance d'une erreur : Workbox rafraîchit la date d'une entrée à **chaque usage** (vérifié dans le code de
  `workbox-expiration` 7.4.1, `cachedResponseWillBeUsed` → `updateTimestamp`) et ne peut pas lire le statut d'une réponse
  opaque. Une erreur transitoire mise en cache reste donc tant que l'entrée est utilisée ; **réduire la durée de 180 jours ne
  change rien**. Effet visible : médaillon à initiales à la place du portrait (et la joueuse peut mettre sa propre photo).

**Options étudiées.**

| Option | Effet sur le coût mesuré | Risque | Décision |
|---|---|---|---|
| A. Ne rien changer, documenter | Aucun | Nul | **Retenue** |
| B. Réduire durée (180 → 30 j) et/ou entrées (200 → 100) | Aucun en usage normal (74 portraits < 100) ; borne seulement le pire cas | Faible, mais sans bénéfice démontré | Écartée |
| C. `crossOrigin="anonymous"` + statut `200` seul (réponses normales, quelques Ko) | **Supprime** le surcoût et le cas « erreur en cache » | **Élevé** : si le wiki n'envoie pas d'en-têtes CORS, tous les portraits disparaissent. **CORS non testé** (une seule requête autorisée) | Écartée pour l'instant |
| D. Copier les portraits dans le dépôt | Supprime tout | Droits d'auteur (Disney/Gameloft) | Déjà écartée par le propriétaire |
| E. `StaleWhileRevalidate` | Aucun | Peut remplacer une bonne image par une erreur opaque | Écartée |

**Décision.** Aucun changement de stratégie : aucune des options sûres n'agit sur le coût mesuré, et la seule qui le
supprimerait (C) dépend d'un test CORS non fait. **Prochaine étape possible, si le coût devient gênant** : une requête pour
tester les en-têtes CORS du wiki ; si présents, passer à C et ajouter un test de non-régression des portraits.

### 4. Droits du workflow GitHub Pages

**Avant** : `contents: read`, `pages: write`, `id-token: write` pour **tout** le workflow (donc aussi pour le job `build`,
qui exécute `npm ci` et les dépendances).

**Après** : droit global `contents: read` ; `pages: write` et `id-token: write` **uniquement** sur le job `deploy`
(requis par `actions/deploy-pages`). Le job `build` n'a plus aucun droit d'écriture ni de jeton OIDC.

**Inchangé volontairement** : versions des actions (`@v4`, `@v3`), pas d'épinglage par SHA (décision reportée), mêmes
étapes et mêmes déclencheurs.

**Risque et limite.** Un workflow ne peut pas être exécuté en local : une permission manquante ferait échouer le
déploiement au prochain push sur `main`. Aucun analyseur YAML n'est installé ici ; la modification (2 blocs, indentation
cohérente avec le reste du fichier) a été relue. **Non vérifié avant le premier déploiement.** Retour arrière : restaurer
le fichier.

### 5. Documentation

- `README.md` : sections « Documentation », « Tests » (tests hors ligne), recettes (**limites des contrôles**),
  « Portraits » (cache mesuré), « Installation et hors ligne » (pré-cache du catalogue, droits du workflow), « Données et
  sauvegardes » (taille maximale).
- `scripts/build-recipes.py` : le rapport généré contient désormais une section « Périmètre des contrôles ».
  `scripts/data/recipes-report.md` a été **régénéré par ce script** dans un dossier temporaire puis copié ; les deux fichiers
  de données générés (`catalog.data.ts`, `ids.ts`) sont restés **identiques octet pour octet**.
- `docs/comprendre-l-application.md` (nouveau) et ce journal (nouveau).

## 4. Limites des contrôles de recettes (à ne pas surestimer)

- **Contrôlé sur les 480 fiches individuelles** : type, collection, prix de vente, énergie, statut minimum / exact (0 écart
  entre `wiki-pages.txt` et le tableau maître). La fidélité de ces deux transcriptions au wiki en ligne n'est pas rejouée.
- **Contrôlé sur un échantillon de 30 recettes seulement** (6 par extension, 3 avec choix, 3 sans) : les **ingrédients**
  (29 identiques, 1 écart traité : Plain Snow Cones), les noms français et les valeurs des guides. **Cet échantillon n'est pas
  une validation des ingrédients des 480 recettes.**
- **Non contrôlés individuellement** : les ingrédients des ~450 autres recettes. L'appariement avec les guides utilise les
  ingrédients comme critère, donc ne les valide pas.
- La liste des 30 recettes n'est pas conservée : contrôle non rejouable à l'identique.
- **Rien n'a été vérifié en jeu.**
- **Les 8 valeurs « exactes »** (Lobster Roll, Garlic Chocolate Tart, Butter Chicken, Grecian Baked Fish, Underworld Cake,
  Pixie Pizza, Beauty and the Beets Napoleon, Fairy Boot Cake) : toutes à 5 étoiles et sans ingrédient au choix, et leur
  fiche ne dit pas « or more ». C'est un **indice selon le wiki**, pas une preuve : Garlic Chocolate Tart (exacte) et Red
  Velvet (minimum) ont les mêmes valeurs. L'écran dit « Valeur exacte selon le wiki ».

## 5. Résultats de la batterie finale (après toutes les modifications)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | Aucune erreur |
| `npx vitest run` | 25 fichiers, **326/326** (322 d'origine + 4 nouveaux) |
| `npm run build` | OK, 19 entrées pré-cachées (829,67 Kio) |
| `npx playwright test` (Edge, 360 px) | **38/38** (36 d'origine + 2 nouveaux) |
| Tests hors ligne des recettes, 3 fois en parallèle puis 3 fois en série | 6/6 puis 6/6 |
| Contrôle négatif (pré-cache sans le catalogue) | Le test **échoue** comme attendu |

## 6. Risques résiduels et points non traités

| Sujet | État |
|---|---|
| Portraits : surcoût de quota des réponses opaques ; erreur en cache persistante | Mesuré, **non corrigé** (voir §3). Effet sur téléphone à confirmer |
| Test CORS du wiki | Non fait (limité à une requête) |
| Workflow GitHub Pages | Modifié, **jamais exécuté** ; premier déploiement = vrai test |
| Épinglage des actions par SHA, Dependabot | **Reportés** (décision du propriétaire) |
| Tests de bout en bout en CI | Absents (le workflow lance `npm test` et le build seulement) |
| iPhone / Safari ; mise à jour du service worker | Non testés |
| Import : `__proto__` / `constructor` dans les sections tâches, puzzles, recettes, noms | Les nettoyeurs utilisent `Object.hasOwn`, mais la couverture de tests explicite est partielle (habitants, animaux, attributions, photos, opérations de recettes). Aucune charge malveillante exécutée sur ces sections |
| Dépendances de développement | Non auditées (`npm audit --omit=dev` seulement) |
| Fidélité des transcriptions du wiki, ingrédients des ~450 recettes, noms et valeurs en jeu | **Non vérifiés** (voir §4) |
