# Dreamlight Compagnons

Petite PWA pour retrouver quel habitant de Disney Dreamlight Valley a quel métier dans sa partie.

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

## Architecture

- `src/data/characters.ts` : la base des personnages (sources en tête de fichier). Pour ajouter un habitant, ajouter une ligne avec un `id` unique qui ne change plus jamais. `releaseDate` rend un personnage « Bientôt » jusqu’à cette date. `nameToVerify` marque un nom français non confirmé par les sources.
- `src/data/professions.ts` : les sept métiers.
- `src/lib/storage.ts` : IndexedDB (idb-keyval) : affectations, photos, export/import JSON.
- `src/lib/useCompanions.ts` : état de l’app, sauvegarde automatique à chaque changement.
- `src/screens/` : Accueil, Métier, Habitants, Infos. `src/components/` : fiche d’attribution, sélecteur, avatar.
- PWA : `vite-plugin-pwa` (service worker Workbox, tout est mis en cache pour le hors ligne).

## Portraits

Les portraits officiels (Disney / Gameloft) ne sont pas sous licence libre et ne sont pas inclus.
Chaque habitant a un médaillon à ses initiales ; on peut lui associer une image depuis le téléphone (« Ajouter une photo »), stockée localement.

## Installation et hors ligne

Le service worker n’est actif qu’en HTTPS (ou sur `localhost`). Servie en `http://192.168.x.x`, l’app fonctionne
et garde ses données, mais ne s’installe pas comme une vraie app et ne marche pas hors ligne. Pour cela, héberger
le dossier `dist/` sur un hébergement HTTPS (GitHub Pages, Netlify, Cloudflare Pages…).
