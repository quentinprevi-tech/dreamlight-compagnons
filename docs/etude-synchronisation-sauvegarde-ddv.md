# Étude de faisabilité : récupérer la progression depuis la sauvegarde de Disney Dreamlight Valley

Date : 11/11/2026. **Analyse et recommandations uniquement : aucune synchronisation n’a été développée, aucun compte
créé, aucune requête vers Gameloft.** Une testeuse demande si l’application pourrait « récupérer automatiquement » la
progression depuis la sauvegarde cloud du jeu.

**Réponse courte : une synchronisation automatique n’est pas réalisable de façon honnête et durable. Un import manuel
depuis une sauvegarde locale PC est une piste possible mais non démontrée, et ne couvrirait qu’une partie des joueuses.**
Les recherches ci-dessous sont des recherches web ; **aucun fichier de sauvegarde n’a été ouvert** (il n’y en a pas dans
le projet).

Niveaux de certitude utilisés : **Établi** (source primaire ou reproductible ici), **Rapporté** (forums et guides
communautaires, à recouper), **À confirmer** (non trouvé ou non vérifié).

## 1. Deux sources de données différentes

| | Progression **du jeu** | Données **cochées dans Dreamlight Compagnons** |
|---|---|---|
| Où | Chez le jeu (sauvegarde locale ou compte Gameloft) | IndexedDB du navigateur, sur l’appareil de la joueuse |
| Qui l’écrit | Le jeu | La joueuse, à la main (recettes connues, animaux obtenus, puzzles, tâches, métiers) |
| Contrôlée par | Gameloft / Disney | Nous |
| Format | Propriétaire, non documenté | JSON documenté (`docs/comprendre-l-application.md`) |

Elles **ne se recouvrent pas automatiquement** : l’application ne sait rien de l’état du jeu, et le jeu ne sait rien de
l’application. Un import ne serait qu’une aide pour **pré-cocher** ce que la joueuse a déjà fait en jeu, jamais une
vérité. Il faudrait la laisser corriger, ne jamais écraser ses cases sans confirmation, et passer par la restauration
existante (aperçu, plan, confirmation, copie de secours) plutôt que d’écrire directement en base.

## 2. API officielle ou documentée

- **Constat des recherches faites ici** (absence de résultat, pas une preuve d’inexistence) : **aucune API publique ou
  documentée** de Gameloft pour la progression de Dreamlight Valley. Les pages juridiques de Gameloft décrivent que Gameloft
  *collecte et traite* les sauvegardes (progression, profil) ; cela n’ouvre aucun accès à des tiers.
- **Rapporté** : le service de « Cloud Save » est lié à un **compte Gameloft** (création depuis le menu du jeu, avec une
  adresse e-mail) et sert à reprendre sa partie entre plateformes (PC, Xbox, Switch 2 ; les pages 2026 consultées
  parlent aussi de PlayStation : **à confirmer**, certains messages de 2022 indiquaient le contraire).
- **À confirmer** : l’existence d’une interface non documentée utilisée par le jeu lui-même. Même si elle existe, elle
  est **privée** : l’utiliser, c’est contourner l’intention de Gameloft, au risque de blocage de compte pour la
  testeuse, et sans aucun contrat de stabilité.

## 3. Pourquoi la synchronisation automatique est écartée

1. **Authentification** : accéder au compte Gameloft d’une joueuse exigerait ses identifiants. **Exclu par principe.**
   Un navigateur ne peut de toute façon pas se faire passer pour le jeu sans contourner l’authentification, ce que ce
   projet ne fait pas.
2. **Pas de serveur** : l’application fonctionne 100 % dans le navigateur, sans compte ni backend. Un intermédiaire
   serait nécessaire (CORS, secrets) : c’est exactement ce que le projet s’interdit, et il ferait transiter des
   données personnelles et des identifiants par un tiers.
3. **Fragilité** : un format ou un protocole privé change à chaque mise à jour du jeu. La maintenance serait
   permanente, pour un résultat non garanti.
4. **Confidentialité** : la progression est une donnée de compte. La charger dans une page web publiée sur GitHub Pages
   engage la responsabilité du projet.
5. **Aucune garantie de conformité** aux conditions d’utilisation de Gameloft (**non vérifié** : je n’ai pas lu les
   conditions d’utilisation complètes).

## 4. Sauvegarde locale : par plateforme

| Plateforme | Ce qu’on sait | Import manuel possible ? |
|---|---|---|
| **PC (Steam)** | **Rapporté** : sauvegarde locale sous `AppData\LocalLow\Gameloft\…` (dossier de nom variable avec des chiffres) ; une page de documentation communautaire (PCGamingWiki) la signale mais prévient qu’elle peut être périmée | **Peut-être** : si le format est lisible (voir § 5) |
| **PC (Microsoft Store / Xbox sur PC)** | **Rapporté** (message de forum) : même dossier que Steam quand la sauvegarde est locale ; **non recoupé** | Idem |
| **PC (Epic)** | Rien trouvé | **À confirmer** |
| **Steam Deck** | **Rapporté** : dans le préfixe Proton (`compatdata`), même sous-dossier | Idem PC, accès plus délicat pour une joueuse |
| **Xbox (console)** | **Rapporté** : sauvegarde stockée dans le cloud lié au compte, pas de fichier accessible | **Non** |
| **PlayStation** | **Rapporté** : pas d’accès au fichier ; options de cloud variables selon la source | **Non** |
| **Switch / Switch 2** | Sauvegarde dans le système de la console ; pas d’accès sans outils tiers | **Non** (et ces outils sortent du cadre : pas recommandés) |

Conséquence : **même dans le meilleur cas, seules les joueuses sur PC pourraient importer un fichier**. La plupart des
retours des testeuses viennent probablement d’un téléphone (usage de l’application) ; la plateforme de jeu de chacune
est **inconnue** : à demander avant de décider.

## 5. Format de la sauvegarde : ce qu’on ne sait pas

- **Rapporté** (deux messages GBAtemp d’utilisateurs sur la modification d’objets) : la sauvegarde PC est un **dossier
  de plusieurs fichiers**, avec des entrées de type JSON (identifiant d’objet, quantité, marqueur). Cela suggère un
  contenu **au moins partiellement lisible** ; la source est une publication individuelle, **non vérifiée**.
- **À confirmer** : chiffrement, compression, signature ou somme de contrôle des fichiers. **Aucune source fiable
  trouvée.** Les éditeurs de sauvegardes d’autres jeux ne prouvent rien ici.
- **À confirmer** : où se trouve l’état « recette connue », « animal obtenu », « puzzle terminé » dans ces fichiers, et
  comment leurs identifiants internes correspondent aux nôtres (identifiants anglais du wiki). Sans cette table de
  correspondance, importer serait deviner.
- **Risque de maintenance** : à chaque mise à jour du jeu (DLC, nouvelles recettes), le format ou les identifiants
  peuvent bouger.

## 6. Risques d’un import manuel

| Risque | Gravité | Atténuation |
|---|---|---|
| La joueuse téléverse un fichier contenant des données personnelles | Moyenne | Traitement **100 % local** (fichier lu dans le navigateur, rien d’envoyé) ; l’annoncer clairement |
| Fichier corrompu ou d’un autre jeu | Faible | Mêmes garde-fous que l’import existant : limite 25 Mo, validation stricte, aucun écrasement avant confirmation |
| Mauvaise correspondance d’identifiants, cases cochées à tort | Moyenne | Aperçu « ce qui sera coché » avant toute écriture, pré-cochage seulement (jamais décochage), annulation par la copie de secours déjà prévue |
| Casse à la prochaine mise à jour du jeu | Élevée (certaine à terme) | Message « format non reconnu », ne rien modifier, documentation de la version du jeu testée |
| Promesse faite aux joueuses puis non tenue (consoles) | Élevée si mal communiqué | Ne rien annoncer avant la démonstration (§ 7) |
| Conditions d’utilisation de Gameloft | **À confirmer** | Lire les CGU avant tout ; ne jamais importer depuis le compte, seulement un fichier **que la joueuse possède localement** |

## 7. Ce qui serait nécessaire pour démontrer la faisabilité (non fait)

Une démonstration « petite et jetable », **avant toute fonctionnalité** :

1. Demander à une testeuse sur PC un **dossier de sauvegarde de test** (copie, jamais l’original), de préférence d’une
   partie presque vide et d’une partie avec une seule recette apprise, pour comparer.
2. Ouvrir les fichiers **hors du projet**, voir s’ils sont lisibles, repérer les recettes connues.
3. Si c’est illisible (chiffré/signé) : **conclure « non réalisable » et s’arrêter**.
4. Si c’est lisible : établir la table identifiants du jeu ↔ identifiants du projet, mesurer la couverture (combien des
   480 recettes, 90 animaux, puzzles), noter la version du jeu.
5. Seulement alors : décider d’un import **optionnel et manuel** (un fichier choisi à la main, aperçu, confirmation).

## 8. Recommandations

1. **Ne rien promettre** aux testeuses pour l’instant. Réponse suggérée : « Pas de synchronisation automatique : le jeu
   ne propose pas d’accès officiel à sa sauvegarde et nous ne demanderons jamais vos identifiants Gameloft. On étudie un
   import manuel pour la version PC ; ce n’est pas garanti. »
2. **Demander la plateforme** de chaque testeuse (PC / Xbox / PlayStation / Switch). Si presque personne n’est sur PC,
   l’import manuel n’a pas de public : s’arrêter là.
3. **Améliorer d’abord ce qui existe** : rendre le cochage plus rapide (par exemple « marquer connues » toutes les
   recettes d’un filtre, avec confirmation) profiterait à toutes les joueuses, quelle que soit leur plateforme, alors que
   l’import d’un fichier ne concernerait au mieux que le PC. Idée à valider avec les testeuses, pas un besoin exprimé.
4. Si la démonstration du § 7 réussit : import **manuel, local, en pré-cochage, avec aperçu**, branché sur le
   mécanisme de restauration existant ; jamais de connexion au compte.
5. **Ne jamais** : demander un identifiant Gameloft, automatiser un navigateur sur le compte, utiliser une API privée,
   ajouter un serveur.

## Sources

- [Disney Dreamlight Valley, PCGamingWiki](https://www.pcgamingwiki.com/wiki/Disney_Dreamlight_Valley) : emplacement des sauvegardes PC (page indiquée en cours de rédaction).
- [Cross-play et cross-save expliqués, GameSpot](https://Gamespot.com/articles/disney-dreamlight-valley-cross-play-and-cross-save-explained/1100-6507117/) et [guide Cloud Save, God is a Geek](https://godisageek.com/2022/09/disney-dream-valley-cloud-save-how-to-use-it-and-how-it-works/) : compte Gameloft, sauvegarde cloud (2022).
- [Fil Steam « Is there a file that the game is saved on? »](https://steamcommunity.com/app/1401590/discussions/0/3391798007031624246/) : emplacement local, Steam et Microsoft (messages d’utilisateurs).
- [Messages GBAtemp sur Dreamlight Valley](https://gbatemp.net/posts/10857292/) : structure de la sauvegarde PC (messages d’utilisateurs, non vérifiés).
- [Problèmes de cloud save, GameGrin](https://www.gamegrin.com/news/disney-dreamlight-valley-is-having-cloud-save-issues-that-result-in-loss-of-progress) : fiabilité de la sauvegarde cloud.
- [Politique de confidentialité Gameloft (Apple Arcade)](https://gameloft.com/en/legal/apple-arcade-privacy-policy-disney-dreamlight-valley) : collecte de la progression.
- [Guide cross-save Switch 2, 2026](https://www.dtgre.com/2026/03/disney-dreamlight-valley-switch-2-cross-save-guide.html?m=1) : plateformes prises en charge (source secondaire, à recouper).

Les pages de support officielles de Gameloft n’ont pas été consultées directement : **à faire** avant toute décision.
