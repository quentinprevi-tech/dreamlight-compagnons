# Dreamlight Compagnons

Petite PWA pour retrouver quel habitant de Disney Dreamlight Valley a quel métier dans sa partie.

## Documentation

- [`docs/comprendre-l-application.md`](docs/comprendre-l-application.md) : guide pédagogique du fonctionnement (React, TypeScript, IndexedDB, hooks, sauvegarde, migrations, synchronisation, service worker, recettes).
- [`docs/modifications-audit-2026-11.md`](docs/modifications-audit-2026-11.md) : journal de l’audit des phases 0 à 5 : constats, corrections, alternatives écartées, limites des contrôles.

- [`docs/ameliorations-ux-2026-11.md`](docs/ameliorations-ux-2026-11.md) : fermeture des fiches (croix, glissement, Échap) et images des ingrédients : fonctionnement, choix, tests, limites.
- [`docs/etude-synchronisation-sauvegarde-ddv.md`](docs/etude-synchronisation-sauvegarde-ddv.md) : étude de faisabilité d’un import de la sauvegarde du jeu (aucune synchronisation cloud développée).

## Lancer

```bash
npm install
npm run build
npm run preview     # http://<IP du PC>:4173 sur le réseau local
npm run dev         # mode développement, http://<IP du PC>:5173
```

## Tests

```bash
npm test            # tests unitaires et composants (Vitest)
npm run test:e2e    # tests navigateur (Playwright + Edge, écran 360 px, hors ligne, sauvegarde)
```

Les tests hors ligne des recettes sont dans `e2e/recipes.spec.ts` : l’un ouvre les recettes en ligne puis coupe le réseau,
l’autre (« première ouverture ») prouve que le catalogue, chargé à la demande, fonctionne hors ligne **même s’il n’a
jamais été ouvert** avant la coupure (il est pré-caché à l’installation du service worker).

## Architecture

- `src/data/characters.ts` : la base des personnages (sources en tête de fichier). Pour ajouter un habitant, ajouter une ligne avec un `id` unique qui ne change plus jamais. `releaseDate` rend un personnage « Bientôt » jusqu’à cette date. `nameToVerify` marque un nom français non confirmé par les sources.
- `src/data/professions.ts` : les sept métiers.
- `src/data/scramblecoin.ts` : Numismagie (Scramblecoin). Niveau fixe (1 à 3, ce n’est pas l’amitié) et les 5 figurines de chaque habitant, relevés sur la page Scramblecoin du wiki. Pour ajouter un habitant : une ligne `id: { level, lineup }`.
- `src/lib/db.ts` : accès à IndexedDB (idb-keyval) : une base, un magasin `kv`, jamais de nouveau magasin, seulement de nouvelles clés. `transact()` lit, décide et écrit dans une seule transaction (tout ou rien, aucune attente externe pendant la transaction) ; `commit()` en est la version sans lecture.
- `src/lib/storage.ts` : métiers (`assignments`, format inchangé depuis la v1) et photos (`portrait:<id>`). Une attribution modifie un seul habitant par lecture-modification-écriture atomique : on ne réenregistre jamais un état complet gardé en mémoire.
- `src/lib/sync.ts` : plusieurs onglets ouverts. Après une modification ou une restauration, les autres onglets relisent leurs données (BroadcastChannel, sinon événement `storage`, et toujours au retour sur l’onglet).
- `src/lib/migrations.ts` : version des données (`meta:schema`) et migrations protégées contre les interruptions (voir plus bas).
- `src/lib/backup.ts` : export et import JSON (format 2, relit les sauvegardes de la v1), copie avant restauration et annulation.
- `src/lib/names.ts` : noms personnalisés par la joueuse (jamais écrits dans les catalogues). Clé `<catalogue>:<id>`, vérifiée contre `NAME_CATALOGS` (une ligne par nouvelle collection).
- Identifiants : toujours vérifiés avec `isCharacterId` / `isProfessionId` (`Object.hasOwn`), jamais avec `in` ou une simple lecture d’objet (« constructor » n’est pas un habitant).
- `src/lib/useCompanions.ts` : état de l’app, sauvegarde automatique à chaque changement.
- `src/features/villagers/` : suivi des habitants (débloqué, amitié 1 à 10, objet déjà demandé), clé `villagers`. Modèle et vérifications dans `model.ts`, écritures atomiques champ par champ dans `storage.ts`. Un habitant qui a un métier est affiché débloqué (et marqué comme tel à l’attribution) ; la demande d’objet ne se remet jamais à zéro toute seule.
- `src/features/tasks/` : écran « Aujourd’hui » (accueil) et gestion des tâches, clé `tasks`.
  - `catalog.ts` : tâches proposées. Pour chacune, le **rappel choisi par l’app** (`recurrence`) est distinct de la
    **remise à zéro du jeu** (`gameReset` : « source officielle », « d’après le wiki », « à confirmer » ou
    « non vérifié », avec les sources). Quand les sources se contredisent, le rappel est placé à l’heure la plus
    tardive : il ne revient jamais avant la vraie remise à zéro.
  - `recurrence.ts` : récurrences ponctuelle, quotidienne, hebdomadaire, en heure locale ou en UTC (changement
    d’heure compris). Pour un nouveau type : une variante de `Recurrence` et un cas dans `periodStartDay`.
  - `model.ts` : rien n’est « généré » chaque jour ; l’occurrence en cours est calculée depuis l’heure
    (`<id>@<période>`), donc rien ne se perd au changement de date. Reportées : une entrée par tâche au plus.
- `src/features/critters/` : Pets Tracker (créatures sauvages apprivoisables), clé `critters`.
  - `data.ts` : **90 variantes** relevées sur le wiki (page Critters + fiche de chaque variante, recoupées le
    09/11/2026), avec espèce, biome, zone, extension, horaires par jour (heure locale), minimum de nourrissages
    (`3` exact, `3+` « au moins », vide = non indiqué) et conditions (météo, quête). Rien n'est déduit : nom français
    absent du wiki = nom anglais « À confirmer ». Une seule contradiction entre sources (Abeille douce blanche) :
    horaire « à confirmer », jamais compté. Keepsake Sea : rien d'ajouté avant sa sortie effective.
  - `availability.ts` : état du jour (présent / plus tard / passé / absent / inconnu) d'après l'horaire du wiki.
    « Présent selon l'horaire » ne garantit pas que l'animal apparaîtra.
  - `model.ts` : progression **indépendante par variante** ; un seul nourrissage par jour calendaire local augmente
    le compteur (opération atomique : deux appuis ou deux onglets = un seul comptage). `summarizeToday` calcule le
    compteur X/Y : variantes non obtenues, d'une extension possédée, à horaire connu, sans condition externe, et
    seulement celles encore réalisables (les créneaux passés sans nourrissage sortent : « Occasion manquée »).
  - `today.ts` : la tâche « Nourrir les animaux » devient la ligne « 🐾 Animaux à nourrir : X/Y » (calculée, non
    cochable, ouvre `#/collection/animaux/aujourdhui`) ; elle disparaît quand il n'y a rien à nourrir.
  - Noms : officiel du wiki, « à confirmer » ou **personnalisé** par la joueuse (clés `critter:<id>` et
    `biome:<id>` de la section `names`, jamais écrites dans le catalogue). Aucun biome n'a de nom français sur le wiki.
  - **Extensions** : choisies par la joueuse, jamais supposées. Tant que la configuration initiale n'est pas faite,
    seul le jeu de base est affiché et compté. Une extension non cochée n'influence jamais le compteur du jour.
  - **Seuils de nourrissage** (`thresholds.ts`) : « exact » (`2/3`), « au moins » (`3+`, seuil réel inconnu) ou
    « inconnu ». Jamais de fraction ni de message « atteint » pour un seuil inconnu : seule la case « Obtenu » fait foi.
- `src/features/tales/` : Puzzles et anigamis (clé `tales`, écran `#/collection/puzzles`).
  - `data.ts` : **39 puzzles** et **21 types d'anigamis**. Les « puzzles » correspondent très probablement aux
    « Lorekeeper Tales » du wiki (wiki + notes de mise à jour officielles ; à confirmer en jeu). « Anigami » =
    « Snippet ». Coûts comparés automatiquement à une seconde source : 25 confirmés, 2 contradictoires
    (aucune déduction automatique), 12 d'une seule source. 5 types sont des objets de quête. Noms français : aucun sur
    le wiki ; 13 types viennent d'un guide français (non vérifié) ; tout reste « À confirmer » et personnalisable.
  - `model.ts` : compteurs indépendants par type, jamais négatifs. **Valider** déduit les quantités dans une
    transaction qui vérifie les compteurs RÉELS (deux onglets qui se disputent les mêmes anigamis : une seule validation
    passe). **Annuler** rend exactement ce qui avait été déduit aux compteurs ACTUELS (delta inverse, jamais une ancienne
    valeur) : les modifications manuelles faites entre-temps sont conservées. « Marquer terminé sans déduire » et
    « Remettre en cours » ne rendent jamais d'anigamis.
- `src/features/recipes/` : encyclopédie des **480 recettes** (clé `recipes`, écran `#/collection/recettes`).
  - **Données générées** : `python scripts/build-recipes.py` lit `scripts/data/` (catalogue maître du wiki, extrait le
    09/11/2026 ; Gamosaurus 453 entrées ; Gameblog 215 entrées) et produit `catalog.data.ts` (complet, chargé **à la
    demande** dans un fichier séparé, mis en cache hors ligne), `ids.ts` (identifiants seuls, dans le paquet principal)
    et `scripts/data/recipes-report.md`. Le script échoue si un contrôle casse (480 recettes, identifiants uniques,
    références valides, 1 à 5 places, répartition 219 / 117 / 96 / 36 / 12) et classe chaque entrée de chaque guide
    sans perte : les totaux du rapport retombent exactement sur 453, 215 et 480 (vérifié par `report.test.ts`).
    Ne pas modifier les fichiers générés à la main.
  - **Identifiants** issus des noms anglais, stables ; les noms français en double (ex. « Frites ») n'importent donc pas.
  - **Noms français** : trois statuts, jamais « officiel » : « relevé dans 2 guides », « relevé dans 1 guide »
    (deux guides ne valent pas deux vérifications indépendantes : l'un a pu copier l'autre) ou anglais « À confirmer ».
    Aucune recette n'est retirée faute de nom français. Noms personnalisables (`recipe:<id>`, `ingredient:<id>`).
  - **Ingrédients** : catalogue séparé ; `GROUPS` est la seule source des groupes « au choix » et de leurs membres.
    Une place est soit un ingrédient obligatoire en quantité exacte, soit un **choix** (`q` ingrédient(s) à prendre
    dans un groupe, éventuellement restreint par la recette) : jamais tous les membres à la fois. La recherche par
    ingrédient trouve les recettes où il est exigé ou seulement possible. Aucune source consultée n'indique
    d'ingrédient polyvalent ou superflu : rien n'est inventé. Le groupe « Any Meat » n'est pas détaillé par le wiki :
    composition déduite (porc, volaille, gibier), marquée « À confirmer » dans les données (`confirmed: false`) et à l'écran.
  - **Énergie et prix de vente** : valeur du catalogue maître, avec deux informations indépendantes.
    `k` : **minimum** (`min`) quand la fiche de la recette sur le wiki dit « or more » (472 recettes), **exact** seulement
    quand elle ne le dit pas (8 recettes) ; un minimum s'affiche toujours « à partir de X » (« dès X » en liste), même quand
    les guides concordent (Gameblog écrit aussi « ou plus » / « min. »). `s` : concordance avec les guides (`wiki-only`,
    `agree`, `differs`) ; un guide qui relève une autre valeur est signalé et la valeur du catalogue est conservée.
    Les 480 fiches individuelles du wiki (`scripts/data/wiki-pages.txt`) sont comparées au tableau par le script de
    génération (type, collection, prix, énergie : 0 écart au 10/11/2026).
  - **Limites des contrôles (à ne pas surestimer)** : les **ingrédients** n’ont été comparés aux fiches du wiki que sur
    **un échantillon de 30 recettes** (6 par extension, dont 3 avec choix et 3 sans ; 29 identiques, écart connu : Plain
    Snow Cones, traité par une note). **Ce n’est pas une validation des ingrédients des 480 recettes** : les ~450 autres
    ne sont pas contrôlées individuellement, et l’appariement avec les guides utilise les ingrédients comme critère (il
    ne prouve donc rien sur eux). La liste des 30 recettes n’est pas conservée : ce contrôle n’est pas rejouable à
    l’identique. Les 480 fiches ne couvrent que type, collection, prix, énergie et statut minimum / exact, et la fidélité
    de `wiki-pages.txt` au wiki en ligne n’est pas rejouée. Rien n’a été vérifié en jeu. Les 8 valeurs « exactes »
    (Lobster Roll, Garlic Chocolate Tart, Butter Chicken, Grecian Baked Fish, Underworld Cake, Pixie Pizza, Beauty and the
    Beets Napoleon, Fairy Boot Cake) le sont **selon le wiki** : leur fiche ne dit pas « or more », ce qui est un indice
    et non une preuve (Garlic Chocolate Tart, « exacte », et Red Velvet, « minimum », ont les mêmes valeurs). Voir aussi
    `scripts/data/recipes-report.md`, section « Périmètre des contrôles ».
  - Suivi : « connue » (date, redécouverte = nouvelle date) et favorites, indépendantes ; écriture atomique, synchronisée
    entre onglets, section `recipes` des sauvegardes. « Recettes réalisables avec mes ingrédients » : version future.
- `src/features/collection/` : accueil de l'onglet Collection (`sections.ts` : une entrée par section).
- Navigation : Aujourd’hui (`#/`) · Habitants (sélecteur Habitants `#/personnages` / Métiers `#/metiers` /
  Numismagie `#/numismagie`) · Collection (`#/collection`, `#/collection/animaux`, `#/collection/puzzles`, `#/collection/recettes`) · Infos (`#/infos`). Les anciennes
  adresses restent valides.
- `src/screens/` : Métiers, Métier, Habitants, Numismagie, Infos. `src/components/` : fiche du bas partagée (`BottomSheet`, rendue dans `document.body` pour iOS Safari), filtres (`FilterChips`), fiche d’attribution, sélecteur, avatar, confirmation de restauration.
- PWA : `vite-plugin-pwa` (service worker Workbox, tout est mis en cache pour le hors ligne).

## Portraits

Les portraits sont affichés depuis le Dreamlight Valley Wiki (`src/data/portraits.ts`, 74 vignettes), sans être copiés dans le dépôt, et gardés en cache pour le hors ligne.

Cache (`vite.config.ts`, `runtimeCaching`) : `CacheFirst`, 200 entrées, 180 jours, statuts `0` et `200`. Le statut `0` est
nécessaire car une balise `<img>` vers un autre domaine reçoit une réponse « opaque » (illisible par le code).
Conséquences **mesurées le 11/11/2026** (Edge 157, un seul portrait, 20 copies sous des clés différentes) :
- une réponse opaque est comptée **≈ 9,2 Mo** dans le quota de stockage du navigateur (contre ≈ 5 Ko pour une réponse
  normale de 5 Ko), soit ≈ 680 Mo pour 74 portraits, ≈ 6 % du quota de ce poste (≈ 10,9 Go). Il s’agit surtout d’une
  comptabilité (remplissage de sécurité), pas d’espace disque réellement occupé ;
- le quota est partagé avec IndexedDB (les données de la joueuse). Sur un téléphone, le quota est plus petit :
  **à confirmer** (non mesuré sur iPhone / Safari) ;
- une erreur transitoire du wiki mise en cache sous forme opaque ne peut pas être distinguée d’une image valide (le
  repli sur les initiales s’affiche) ; elle reste tant que l’entrée est utilisée (Workbox rafraîchit la date à chaque
  usage), donc réduire la durée de 180 jours n’y change rien.
Aucun réglage discuté (nombre d’entrées, durée) n’agit sur ce coût, la stratégie n’a donc pas été modifiée.
**CORS testé le 11/11/2026** (une requête `HEAD` avec un en-tête `Origin`, sur une vignette) : le wiki n’envoie **aucun** en-tête
`Access-Control-Allow-Origin`. La piste `crossOrigin="anonymous"` + statut `200` seul est donc **impraticable** (les images
ne se chargeraient plus) tant que le wiki ne change pas.

**Motif du cache (modifié le 11/11/2026)** : il ne couvre plus tout `/images/` du wiki mais exactement les 74 adresses de
portraits (`portraitCachePattern()` dans `src/data/portraits.ts`). Sinon les 198 vignettes d’ingrédients, hébergées dans le
même dossier, seraient entrées dans ce cache (≈ 1,8 Go de quota comptabilisé). Elles passent par le cache HTTP normal du
navigateur (voir [`docs/ameliorations-ux-2026-11.md`](docs/ameliorations-ux-2026-11.md)).

## Installation et hors ligne

Le service worker n’est actif qu’en HTTPS (ou sur `localhost`). Servie en `http://192.168.x.x`, l’app fonctionne
et garde ses données, mais ne s’installe pas comme une vraie app et ne marche pas hors ligne. Pour cela, héberger
le dossier `dist/` sur un hébergement HTTPS (GitHub Pages, Netlify, Cloudflare Pages…).

Le catalogue des recettes (gros fichier chargé à la demande) est **pré-caché** avec le reste de l’app dès l’installation du
service worker : les recettes s’ouvrent hors ligne même si elles n’ont jamais été consultées en ligne (test de bout en bout
dédié, avec contrôle négatif : sans ce pré-cache, le test échoue).

Publication : `.github/workflows/pages.yml` (à chaque push sur `main` : tests, build, déploiement). Droits minimaux : le
job `build` n’a que `contents: read` ; seul le job `deploy` a `pages: write` et `id-token: write` (requis par
`actions/deploy-pages`). Les actions sont référencées par tag (`@v4`, `@v3`), non épinglées par SHA (décision reportée).
Le workflow n’a pas pu être exécuté en local : le premier déploiement après modification en est le vrai test.

## Données et sauvegardes

- **La vraie sauvegarde est le fichier exporté** (Infos › Exporter une copie), à garder hors du téléphone. Les copies
  `snapshot:*` restent sur le téléphone : elles protègent d’une erreur de migration ou de restauration, pas de la perte
  du téléphone ni de l’effacement des données du navigateur.
- **Format 2** : `{ app, format: 2, type: 'complete' | 'partial', exportedAt, schema, sections }`. Une sauvegarde complète
  contient toutes les sections, même vides. Section `photos` :
  - `null` : photos non incluses (ou aucune sur le téléphone) → celles du téléphone sont **conservées** ;
  - `{ v, data: {} }` : aucune photo → celles du téléphone sont **supprimées** ;
  - `{ v, data: { id: dataURL } }` : le téléphone aura **exactement** ces photos.
- **Compatibilité** : un export v2 contient aussi `assignments` au premier niveau (identique à la section), pour que la
  première version de l’app sache encore en lire les métiers. Deux copies différentes font refuser le fichier.
- **Taille maximale** : 25 Mo (`MAX_BACKUP_BYTES`, `src/lib/backup.ts`). Un export réaliste pèse environ 4 Mo (photos de
  256 px, 20 à 55 Ko chacune). Le fichier est refusé **avant d’être lu** (taille du fichier) et, dans `parseBackupText`, avant
  tout `JSON.parse` (taille réelle en octets UTF-8, sans supposer de l’ASCII), sans rien écrire.
- **Import** : une section absente du fichier est conservée. Un fichier de la v1 (`version: 1`) ne restaure que les métiers.
  Une section abîmée fait refuser le fichier (jamais lue comme vide). Une section inconnue ou une version de données plus
  récente : restauration complète refusée, import partiel signalé. Habitants, métiers et noms inconnus sont écartés et
  signalés. Une photo illisible d’un habitant connu ne supprime jamais celle du téléphone.
- **Restauration** : lecture de l’état actuel, copie (`snapshot:pre-import`) et remplacement dans une seule transaction,
  puis relecture. En cas d’échec, rien n’est écrit, pas même la copie. « Annuler la dernière restauration » prévient que les
  modifications faites depuis seront perdues.
- **Chargement** : toute erreur au démarrage bloque l’app (aucun écran modifiable). « Télécharger une copie de secours »
  n’est proposé que si les données restent lisibles ; il part des données d’origine si une migration n’est pas allée au bout.
- **Ajouter une section** (nouvelle fonctionnalité) : une entrée dans `DATA_SECTIONS` (`src/lib/backup.ts`).

## Migrations

Versions : v1 (première version, sans numéro), v2 (phase 0 : numéro et copie de sécurité), v3 (phase 1 : habitants
ayant un métier marqués débloqués, sans attribuer de métier à personne).

Pour faire évoluer les données enregistrées : ajouter une étape à `MIGRATIONS` (`src/lib/migrations.ts`), sous forme de
fonction pure. Au démarrage, l’app :

1. copie toutes les données dans `snapshot:pre-v<n>` (écrite seulement si absente, relue, jamais écrasée) ;
2. calcule la nouvelle version depuis cette copie ;
3. écrit les seules clés modifiées et le marqueur `meta:migration` en une transaction, sauf si un autre onglet a déjà validé ;
4. relit et compare ;
5. pose `meta:schema = n` et retire le marqueur.

Une migration interrompue (app fermée, erreur) est reprise au lancement suivant depuis la copie. Une migration ne doit
jamais modifier `assignments`. En cas d’échec, l’app n’affiche aucun écran qui écrit et propose une copie de secours.
