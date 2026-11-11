# Rapport de génération du catalogue des recettes

Données figées le 2026-11-09. Généré par `scripts/build-recipes.py` (ne pas éditer à la main).

## Périmètre des contrôles (à lire avant de se fier aux données)
- **Contrôlé sur les 480 fiches individuelles du wiki** (`wiki-pages.txt`, comparée au tableau maître par ce script, 0 écart exigé) : type, collection, prix de vente, énergie et statut minimum / exact. Ces deux transcriptions sont conservées dans le dépôt ; leur fidélité au wiki en ligne n'est pas rejouée par le script.
- **Contrôlé sur un échantillon de 30 recettes seulement** (6 par extension, dont 3 avec choix et 3 sans, comparées à leur fiche) : les ingrédients (29 identiques sur 30 ; écart connu : Plain Snow Cones, traité par une note), ainsi que les noms français et les valeurs des guides pour cet échantillon. Cet échantillon n'est PAS une validation des ingrédients des 480 recettes.
- **Ingrédients des autres recettes : non contrôlés individuellement.** L'appariement avec les guides utilise les ingrédients comme critère : il ne constitue donc pas une validation indépendante.
- La liste exacte des 30 recettes de l'échantillon n'est pas conservée dans le dépôt : ce contrôle n'est pas rejouable à l'identique.
- Rien n'a été vérifié en jeu : noms français, valeurs et compositions restent ceux des sources consultées (wiki, guides).

## Catalogue maître (wiki)
- Recettes : 480 (base 219, A Rift in Time 117, Storybook Vale 96, Wishblossom Ranch 36, Honeyglow Woods 12).
- Ingrédients : 198 ; groupes « au choix » : 11 ; recettes avec au moins un choix : 155.

## Gamosaurus : 453 entrées classées sans perte
- Rapprochées par valeurs numériques uniques : 290
- Rapprochées par ingrédients (candidat unique des deux côtés) : 158
- Ambiguës (laissées sans correspondance) : 0
- Sans candidat : 5
- Total : 453 / 453

## Gameblog : 215 entrées classées sans perte
- Rapprochées : 198 ; ambiguës : 0 ; sans candidat : 17 ; total 215 / 215

## Noms français des 480 recettes
- Présent dans deux guides (même nom, sans prétendre à deux vérifications indépendantes) : 178
- Présent dans un seul guide : 279 (Gamosaurus seul 259, Gameblog seul 9, deux guides aux noms différents 11)
- Anglais « À confirmer » : 23
- Total : 480 / 480

| Collection | Deux guides | Un guide | Anglais |
|---|---|---|---|
| base | 178 | 34 | 7 |
| eternity | 0 | 116 | 1 |
| storybook | 0 | 95 | 1 |
| wishblossom | 0 | 34 | 2 |
| honeyglow | 0 | 0 | 12 |

## Ingrédients : noms français
- Deux guides : 66 ; un guide : 108 ; anglais : 24 ; total 198 / 198

## Valeurs (énergie / prix de vente, statuts indépendants)
- énergie agree / prix agree : 301
- énergie agree / prix differs : 96
- énergie differs / prix agree : 14
- énergie differs / prix differs : 37
- énergie wiki-only / prix agree : 9
- énergie wiki-only / prix wiki-only : 23

## Minima publiés (fiche de chaque recette du wiki : « or more »)
- énergie exact / prix exact : 8
- énergie min / prix min : 472

## Entrées Gamosaurus non rapprochées (pour contrôle)

- Sélection de poisson fumés (appetizer, 3★, 1701/288) : sans candidat
- Poisson blanc cuisiné et betteraves rôties (entree, 2★, 900/81) : sans candidat
- Latkes (entree, 4★, 1280/937) : sans candidat
- Lalkes (entree, 4★, 1280/937) : sans candidat
- Granité nature (dessert, 1★, 202/180) : sans candidat

## Entrées Gameblog non rapprochées

- Crackers (appetizer, 1★, prix 2) : sans candidat
- Plateau de fruits de mer (appetizer, 2★, prix 116) : sans candidat
- Soupe aux légumes (appetizer, 2★, prix 20) : sans candidat
- Plat de légumes grillés (appetizer, 3★, prix 33) : sans candidat
- Grand plateau de fruits de mer (appetizer, 5★, prix 340) : sans candidat
- Bar et légumes poêlés (entree, 3★, prix 57) : sans candidat
- Salade copieuse (entree, 3★, prix 33) : sans candidat
- Soupe aux fruits de mer (entree, 3★, prix 85) : sans candidat
- Tilapia et légumes poêlés (entree, 3★, prix 862) : sans candidat
- Casserole de légumes (entree, 4★, prix 340) : sans candidat
- Soupe wonton (entree, 4★, prix 1000) : sans candidat
- Bouillabaisse (entree, 5★, prix 671) : sans candidat
- Pizza végétarienne (entree, 5★, prix 350) : sans candidat
- Granité nature (dessert, 1★, prix 180) : sans candidat
- Gâteaux au pain d'épices d'Halloween (dessert, 3★, prix 1000) : sans candidat
- Cake aux fruits (dessert, 4★, prix 96) : sans candidat
- Crème pâtissière et fruits (dessert, 5★, prix 497) : sans candidat
