# Banc hockey

Outil de banc pour coachs de hockey sur gazon : plan de rotation des joueurs, chrono par quart avec alertes de changement, gestion des imprévus (blessure, cartons), feuille de match et suivi de saison.

Projet en cours (V1 en préparation, testée par quelques coachs cette saison).

## Utiliser

Ouvrir `index.html` dans un navigateur. L'app démarre vide : donne un nom à ton équipe et ajoute tes joueurs dans l'onglet Coach, ou charge une sauvegarde.

## Règles de l'app

- Les joueurs ne voient jamais les notes ni les temps visés (onglet Coach protégé par un code).
- Les postes sont affichés par leur nom (« Back gauche », « Milieu off. »), jamais par un numéro.

## Organisation des fichiers

- `index.html` : la page et le style (couleurs en haut, dans `:root`).
- `app.js` : les écrans (Match, Coach), le chrono, la sauvegarde.
- `cloud.js` : le compte coach (email + mot de passe) et la sauvegarde en ligne. Tout reste d'abord sur le téléphone, l'envoi en ligne se fait dès qu'il y a du réseau.
- `config.js` : l'adresse du projet Supabase et sa clé publique (jamais la clé secrète).
- `supabase/` : la table à créer dans Supabase et les réglages à faire une fois (`LISEZMOI.md`).
- `rotation.js` : le moteur qui calcule le plan de changements.
- `vendor/` et `fonts/` : l'outil PDF (jsPDF), la bibliothèque Supabase et les polices Barlow, embarqués pour marcher sans internet.
- `tests/` : vérifications automatiques du moteur. Lancer avec `npm test`.

## Mise en ligne

L'app est publiée par GitHub Pages depuis la branche `main`. `manifest.webmanifest` et `sw.js` la rendent installable sur l'écran d'accueil et utilisable sans réseau. À chaque mise en ligne qui change des fichiers de l'app, augmenter `VERSION` dans `sw.js`.
