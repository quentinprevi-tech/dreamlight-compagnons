# Suivi des habitants et des animaux : tri, filtres et niveau des compagnons

Date : 13/11/2026. Évolution demandée par une utilisatrice : repérer vite les habitants dont l'amitié doit progresser,
retrouver les animaux par nom ou par capacité de collecte, et suivre le niveau de ses compagnons.

## 1. Ce qui a été ajouté

### Habitants (écran « Habitants »)
- **Tri par amitié**, du plus faible au plus élevé, et **bouton d'inversion** (« ↕ Faible → élevée » / « Élevée → faible »).
  Les habitants sans niveau affiché restent **toujours à la fin**, quel que soit le sens : d'abord les débloqués dont le
  niveau n'est pas renseigné, puis les non débloqués. À niveau égal : ordre alphabétique.
- **Filtre « ❤️ Amitié < 10 »** (bouton qui s'active et se désactive) : habitants **débloqués** au niveau 1 à 9 **ou dont le
  niveau n'est pas renseigné** (on ne sait pas s'il est au maximum). Les habitants au niveau 10 et les non débloqués sont
  exclus. Le texte sous la liste le rappelle.
- La recherche par nom et les filtres existants (débloqués, métier…) **sont conservés** et se combinent avec le tri et ce filtre.
- Avec le tri par amitié, la liste est **à plat** (un tri par extension n'aurait pas de sens) ; par défaut, elle reste
  groupée par extension comme avant.

### Animaux (écran « Animaux », catalogue des 90 variantes)
- **Tri par nom** A → Z ou Z → A (sur le nom affiché : nom personnalisé, sinon français du wiki, sinon anglais). Par défaut :
  groupé par biome comme avant. Le tri n'est pas proposé dans la vue « À nourrir aujourd'hui ».
- **Filtre par capacité de collecte** (Fruits, Légumes, Fruits de mer, Fleurs, Poissons, Gemmes, Terre, Courbage temporel,
  Fragments, « Non renseignée ») : voir le § 3, **données de seconde main**.
- **Niveau du compagnon de 1 à 5**, **propre à chaque variante**, modifiable dans la fiche (− / +, comme l'amitié des
  habitants). Pastille **❤️ 3/5** dans la liste (comme ❤️ 7 pour les habitants). Stocké dans une **clé à part**, `critterLevels` (§ 2). Conditions :
  - réglable seulement quand l'animal est « Obtenu » : la commande est désactivée dans la fiche **et** le modèle refuse
    l'opération (« Coche « Obtenu » pour suivre le niveau de ce compagnon »), même depuis un autre onglet ;
  - **non renseigné par défaut** : jamais supposé égal à 1 ;
  - « Baisser » sous 1 efface la valeur ;
  - décocher « Obtenu » masque la pastille **sans effacer** le niveau (il revient si on recoche).

### Commandes communes (`src/components/ListControls.tsx`)
Liste « Trier » + bouton d'inversion, bouton de filtre, **rappel des filtres actifs** (chacun retirable par ✕) et
**« Tout réinitialiser »**. L'état n'est pas enregistré : à la réouverture, l'affichage est complet. Aucune donnée n'est
écrite par un tri ou un filtre.

## 2. Données, stockage et protection contre les anciennes versions

| Question | Réponse |
|---|---|
| Où est le niveau d'un animal ? | Dans **sa propre clé IndexedDB `critterLevels`** : `{ [idVariante]: 1 à 5 }`. **Jamais** dans `critters` |
| Migration IndexedDB nécessaire ? | **Non.** Nouvelle clé facultative (l'architecture ajoute des clés, jamais des magasins) ; les données existantes ne sont ni lues ni transformées |
| Numéro de version des données | **Inchangé** (`CURRENT_SCHEMA` = 3) : voir § 2.1, il n'aurait rien protégé |
| Sauvegardes (export/import) | Section **`critterLevels`** à part, présente dans tout export complet (§ 2.3) |
| Concurrence (deux onglets) | Une seule transaction lit `critters` et `critterLevels`, n'écrit que `critterLevels` ; synchronisation entre onglets incluse (§ 2.2) |
| Habitants | **Aucun changement de données** : seul l'affichage change |

### 2.1 Pourquoi les niveaux sont dans une clé séparée (audit du 13/11/2026)
- La **version 3 publiée** (commit `8f9a85e`) réécrit toute la clé `critters` à chaque modification d'un animal, en ne
  gardant que les champs qu'elle connaît (`obtained`, `feedings`, `lastFed`, `prevFed`). Un niveau rangé dans `critters` serait
  donc effacé pour **tous** les animaux dès qu'une page restée en version 3 en modifie un seul (test de non-régression :
  `levels.test.ts`, « POURQUOI une clé séparée »).
- **Un numéro de version 4 n'aurait rien protégé** : `meta:schema` n'est lu qu'au démarrage (`migrate()`), jamais avant une
  écriture ; et la version 3, au démarrage, ignore le résultat `{ status: 'newer' }` (`prepareDatabase().then(() => loadAll())`).
  Établi par lecture du code et par un test jetable, supprimé depuis.
- Une clé que la version 3 **ne lit ni n'écrit jamais** ne peut pas être modifiée par elle. C'est la seule protection
  qui s'applique à du JavaScript déjà déployé.

### 2.2 Fonctionnement des écritures
- `updateCritterLevel(id, niveau | null)` (`storage.ts`) : **une** transaction IndexedDB lit `critters` (l'animal est-il
  obtenu ?) et `critterLevels`, valide (animal connu, **obtenu**, niveau entier de 1 à 5, sinon l'opération est refusée
  et **rien n'est écrit**), puis n'écrit **que** `critterLevels`. Les entrées inconnues de cette version (animaux d'une
  version plus récente) sont recopiées telles quelles.
- `updateCritters` (nourrissage, « Obtenu », extensions…) est **inchangé** : il ne lit ni n'écrit `critterLevels`. Décocher
  « Obtenu » garde le niveau (masqué) ; recocher le fait réapparaître ; tant que l'animal n'est pas obtenu, le niveau ne
  peut plus être modifié (la règle est dans le modèle et le stockage, pas seulement dans l'interface).
- Le hook `useCritters` charge et relit **les deux clés** : après toute modification ou restauration faite dans un autre
  onglet (BroadcastChannel), niveaux compris.

### 2.3 Sauvegardes et restauration
- **Export** : section `critterLevels` (`{ v: 1, data: { idVariante: niveau } }`), présente même vide.
- **Restauration d'un fichier avec niveaux** : la section **remplace** `critterLevels` (comme toutes les sections ; le
  plan l'annonce « Remplacés » et « Annuler la dernière restauration » remet l'état exact d'avant, entrées inconnues comprises).
- **Ancienne sauvegarde sans cette section** : la section est **conservée** (« absente du fichier ») : les niveaux du
  téléphone sont gardés, aucun n'est inventé ni supprimé.
- **Fichier invalide** : section abîmée ou version de section plus récente → refus avant toute écriture ; niveaux
  invalides dans une section lisible → écartés et comptés, les valides sont restaurés.
- **Aucune restauration ne supprime de clé inconnue ni non concernée** : seules les clés des sections présentes dans le
  fichier sont écrites (vérifié dans `applyRestore` et par test).
- Une **version 3** qui reçoit un fichier de cette version : restauration **complète** refusée (section inconnue pour elle) ;
  import partiel : la section est ignorée et signalée. Dans tous les cas elle n'écrit jamais `critterLevels`.

### 2.4 Garde-fou pour les futures versions (`db.ts`)
`transact` relit `meta:schema` **dans la transaction** et, s'il est plus récent que `MAX_WRITABLE_SCHEMA` (= `CURRENT_SCHEMA`, égalité
vérifiée par un test), annule la transaction avec `NewerDataError` : rien n'est écrit, les lectures restent possibles, et
l'écran affiche « recharge l'app » au lieu d'un faux problème d'espace. **Ce contrôle ne protège que le code qui le
contient**, c'est-à-dire cette version et les suivantes : il ne change rien au comportement de la version 3 déjà déployée.
Les écritures de photos (`savePortrait`, `deletePortrait`) ne passent pas par `transact` et ne sont pas gardées.

### 2.5 Ce que les tests démontrent, et ce qu'ils ne démontrent pas
- Démontré (`src/features/critters/levels.test.ts`, 34 tests) : règles du modèle, stockage séparé, `critters` jamais réécrit
  par un réglage de niveau, `critterLevels` strictement identique (comparaison JSON de la valeur stockée) après des
  écritures **réelles** du code de suivi des animaux, une réécriture complète de `critters`, une attribution de métier et
  une restauration sans la section ; sauvegarde, restauration, annulation, fichiers invalides ; deux onglets ; garde-fou.
- « Code de la version 3 » : `model.ts` et `updateCritters` sont **identiques octet pour octet** à `8f9a85e` (`git diff` vide), donc
  les appeler **est** ce que fait une page en version 3 pour ces écritures. Pour la restauration, un fichier sans la section
  est le seul cas que la version 3 sait lire.
- **Non vérifié** : l'exécution d'un vrai bundle JavaScript de la version 3 dans un navigateur à côté de la version actuelle
  (deux onglets de versions différentes) ; Safari ; un appareil réel.
- **Limites** : une page en version 3 n'affiche pas les niveaux et peut décocher « Obtenu » (le niveau reste, masqué) ;
  d'éventuels champs `level` écrits dans `critters` par une version de développement locale non publiée ne sont plus lus
  (aucune donnée publiée n'est concernée) ; la restauration d'une sauvegarde **remplace** `critterLevels` (annulable).

## 3. Capacités de collecte : ce que le catalogue ne contenait pas

Le catalogue des animaux (`src/features/critters/data.ts`, issu du wiki) **ne contenait aucune capacité** : seulement
espèce, biome, extension, horaires et seuil de nourrissages. Les « métiers » du dépôt (`professions.ts`) concernent les
**habitants** (pêche, jardinage…), pas les animaux.

**Ce qui a été fait** : une table à part, `src/features/critters/gathering.ts`, **espèce → type d'objet**, avec ses sources.
- **Sources** (liens affichés dans la fiche et sous le filtre) : trois guides de jeu qui concordent (Destructoid,
  31/10/2025 ; GameGrin, 22/06/2025 ; guide Steam, août 2025), relevés le 12/11/2026 et relus le 13/11/2026. Ils ont
  probablement la même origine (la liste affichée en jeu) : leur accord **ne vaut pas trois vérifications indépendantes**. **Le wiki (source de référence du projet) était inaccessible** (vérification anti-robot, non contournée).
- **Couvert (14 espèces)** : écureuil → fruits ; lapin → légumes ; tortue de mer → fruits de mer ; passereau → fleurs ;
  renard et crocodile → poissons ; raton laveur → gemmes ; corbeau → terre ; capybara, cobra, singe → courbage
  temporel ; hibou, bébé dragon, pégase → fragments.
- **Volontairement « non renseigné »** :
  - l'oie, la mouffette, l'abeille douce et le hérisson (non couverts par ces guides) ;
  - le **bébé dragon bleu sarcelle** (un seul guide, Destructoid, dit qu'il ramasse des minerais ; les autres des fragments) ;
  - les trois variantes **« Toon »** (capybara, cobra, singe), obtenues par une quête : le guide Steam prévient que les
    compagnons de quête, d'événement, notables ou de boutique peuvent avoir d'autres ressources (il cite un renard
    arc-en-ciel et un écureuil effrayant qui ramassent des gemmes) et aucun guide ne donne celles des Toon.
  - **« Whimsical Creatures »** (« créatures fantaisistes », gemmes selon deux guides) : aucune correspondance avec nos
    espèces n'est donnée ; l'une des espèces non renseignées en fait peut-être partie, **rien n'est supposé**.
- « Serpents » des guides = cobra dans notre catalogue (seule espèce de serpent) : seule interprétation faite.
- Vérifié espèce par espèce le 13/11/2026 : les trois guides donnent la même capacité pour les 14 espèces couvertes
  (seul le guide Steam précise « Raton laveur : gemmes » sans « créatures fantaisistes »).
- Les guides ont plus d'un an ; les libellés français sont **indicatifs, non vérifiés en jeu** ; les compagnons « notables »
  (Disney, boutique) ont des capacités propres et ne sont pas dans le catalogue.
- Partout où la capacité est affichée (fiche, filtre), elle est accompagnée de sa source et de « à confirmer avec le wiki ».

**À faire dès que le wiki est accessible** : comparer `SPECIES_GATHER` aux catégories « … Gathering Companions » du wiki et
mettre à jour `GATHERING_VERIFIED_AT`. Un test garantit que la table ne cite que des espèces et variantes du catalogue.

## 4. Fichiers

Nouveaux : `src/components/ListControls.tsx`, `src/lib/listSort.ts`, `src/features/villagers/list.ts`,
`src/features/critters/{list,gathering,GatheringSources,levels}.*`, `e2e/lists.spec.ts`, et les tests
`src/features/villagers/list.test.ts`, `src/features/critters/{list.test.ts,levels.test.ts,CrittersLists.test.tsx}`,
`src/screens/CharactersScreen.test.tsx`.
Modifiés :
- affichage : `src/screens/CharactersScreen.tsx`, `src/features/critters/{CrittersScreen,CritterSheet,CritterRow}.tsx` ;
- niveaux : `src/features/critters/{storage,useCritters}.ts` (`model.ts` est **identique à la version publiée**) ;
- sauvegarde : `src/lib/backup.ts` (section `critterLevels`) et `src/lib/backup.test.ts` (liste des sections) ;
- garde-fou : `src/lib/db.ts` (`transact`, `NewerDataError`, `MAX_WRITABLE_SCHEMA`) et le message d'erreur des hooks
  `useCompanions`, `useTasks`, `useRecipes`, `useTales` ;
- `src/features/critters/storage.test.ts`, `README.md`.
**Non touchés** : `migrations.ts`, `storage.ts` (habitants), `sync.ts`, les catalogues (`catalog.data.ts`, `data.ts`, `characters.ts`), `public/`.

## 5. Tests

Voir le compte rendu de la session. Principe : fonctions de tri et de filtre **pures** testées une à une
(`list.test.ts`), écrans testés avec le vrai stockage simulé (`*.test.tsx`), persistance et affichage à 360 px dans Edge
avec le vrai IndexedDB (`e2e/lists.spec.ts`), protection des niveaux (`levels.test.ts`, § 2.5). Contrôles négatifs : tri et
filtre sabotés → 5 tests échouent ; stockage, garde-fou et section de sauvegarde sabotés → 19 tests de `levels.test.ts` échouent.

## 6. Limites et points à valider

- Capacités de collecte : **à confirmer avec le wiki** (§ 3), jamais présentées comme certaines dans l'interface.
- **Anciennes versions** : les niveaux sont à l'abri d'une page en version 3 (clé séparée, § 2), mais cette protection
  n'a été vérifiée que par des tests qui exécutent le code identique à la version 3 ; pas par un vrai bundle ancien
  dans un navigateur. Une page en version 3 n'affiche pas les niveaux.
- Niveau maximum de 5 pour les compagnons : tiré des mêmes guides, à recouper avec le wiki.
- Affichage vérifié sur **captures à 360 px (Edge)** ; non testé sur un vrai téléphone ni sur Safari.
- Le tri et les filtres ne sont pas mémorisés d'une visite à l'autre (choix de simplicité).
- Le filtre « Amitié < 10 » inclut les niveaux non renseignés : à confirmer que c'est bien ce qu'attend l'utilisatrice.
