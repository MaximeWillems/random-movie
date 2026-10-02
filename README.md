# Séance 404

![Séance 404](public/logo.svg)

Deux salles pour cinéphiles :

- **Trouver un film** : tire un film dans ta watchlist, ou parmi des films très
  bien notés que presque personne n'a vus
- **Duel** : deux films s'affrontent, il faut deviner lequel est le plus populaire

Le site suit le thème clair ou sombre du système ; le lien en haut à droite
force l'un ou l'autre (choix gardé dans le `localStorage`, clé `lb-theme`).

## Langues

Le site existe en français (`/`) et en anglais (`/en`). C'est la même page :
`public/_redirects` sert `index.html` à `/en`, et `public/i18n.js` choisit la
langue d'après l'adresse. Le HTML est écrit en français ; en anglais, les textes
marqués `data-i18n` sont remplacés au chargement, et tous les textes créés par
le script passent par `t()`. Le lien en haut de page passe d'une langue à
l'autre en gardant la salle ouverte.

- En anglais, TMDB donne résumés et genres en anglais, et « Where to watch »
  cherche les offres aux États-Unis puis au Royaume-Uni (Belgique puis France
  en français). Les noms des réalisateurs viennent toujours de la fiche anglaise
- `public/_headers` donne à Google l'adresse canonique de chaque langue et les
  versions alternatives (`hreflang`)
- À propos : `/a-propos` et `/en/about` ; la page 404 est bilingue

## Sources des données

Le site n'utilise **aucune donnée Letterboxd** : il renvoie seulement vers les
fiches Letterboxd des films (ticket et verdict du duel).

- **Films, résumés, genres, affiches, notes et popularité** : API TMDB, appelée
  depuis le navigateur. La moyenne est sur 10 ; la popularité est le nombre de
  votes TMDB. `public/films.json` et `public/gems.json` en gardent une copie
  (`vote`, `votes`, `runtime`), mise à jour par `node scripts/tmdb-stats.js`.
  Mention « Ce site utilise l'API TMDB mais n'est ni approuvé ni certifié par
  TMDB » et logo en pied de page, comme TMDB le demande.
- **Où le voir** : offres légales connues de TMDB, fournies par JustWatch (cité
  sous « Où le voir » et en pied de page), Belgique puis France ; copie libre de
  droits sur Internet Archive ; recherche YouTube / Vimeo.
- **Profil** : l'export que le membre fait lui-même sur Letterboxd
  (*Settings → Import & Export → Export your data*). Le ZIP est lu dans le
  navigateur (lecteur de ZIP intégré, sans bibliothèque) et n'est envoyé nulle
  part. Il donne les films vus, la watchlist et les notes.

Séance 404 n'est pas affilié à Letterboxd.

Les polices (Archivo, Jersey 10, licence SIL OFL) sont servies par le site,
depuis `public/fonts/` : aucun visiteur n'est envoyé chez Google Fonts.

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou plus récent, seulement pour le serveur
  local et le script des affiches

## Lancement en local

```bash
npm install
npm start
# → Serveur lancé → http://localhost:3000
```

`server.js` ne fait que servir `public/` : le site est entièrement statique et
peut être hébergé tel quel.

## Mise en ligne

Le site est entièrement statique : il est publié tel quel depuis `public/` sur
**Cloudflare**, en Worker qui sert les fichiers statiques (gratuit, sans mise en
veille), redéployé à chaque push sur `main`.

- Worker `seance404` relié au dépôt GitHub, sans commande de build, dossier `public`
- Domaine `seance404.pikilab.app` ; l'ancien `random-movie.pikilab.app` y redirige (301)
- Les adresses perdent leur `.html` (`/a-propos`), le serveur local fait de même
- `public/_headers` : politique de sécurité (seules les polices Google, l'API et
  les images TMDB et la recherche Internet Archive sont permises) et cache
- `public/404.html` : page des adresses inconnues

## Utilisation

L'export Letterboxd s'importe une fois, en haut de la page (« Importer mon
export »). Il est gardé dans le navigateur (`localStorage`, clé `lb-find`),
débloque les sources liées au profil et écarte les films déjà vus. « mettre à
jour » réimporte un export plus récent, « retirer » l'efface.

### Trouver un film

Deux sources, chacune garde son film et son historique :

- **ma watchlist** : un film tiré dans la watchlist de l'export. Les films sans
  année ou d'une année à venir sont écartés, et pour l'année en cours et la
  précédente TMDB dit si le film est sorti. Les films de l'année sortent moins
  souvent (poids 0,4), au cas où ils ne seraient sortis qu'aux États-Unis
- **les films peu connus** : voir plus bas

Seul le bouton « Tirer un film » (ou Espace) lance un tirage. Les 5 derniers
films tirés sont au-dessus du ticket, « Tout voir » ouvre les autres (jusqu'à
100 par source). Les recherches survivent à un rechargement ; « effacer » les
remet à zéro, et elles repartent de zéro d'elles-mêmes après une semaine sans
visite (profil et filtres gardés).

### Films peu connus

Une sélection de films peu connus mais bien notés, sortis il y a plus de deux
ans, figée dans `public/gems.json`. Le filtre de note (7/10, 7,5/10) ne retient
que les films d'au moins 5 votes TMDB. Le tirage favorise les mieux notés : un
point de plus sur 10 triple les chances, et la note d'un film à peu de votes est
ramenée vers 6,5 pour qu'un 10/10 sur un seul vote ne passe pas devant tout.

Avec un export importé, les films déjà vus sont écartés (titre et année).

### Mode duel

Deux films côte à côte : clique sur celui que tu crois le plus populaire. Les
deux compteurs se révèlent, puis on enchaîne. Mode infini.

**Série et record.** La série compte les bonnes réponses d'affilée et retombe à
zéro à la première erreur. Le record est gardé dans le `localStorage` du
navigateur (clé `lb-duel-record`), tous modes confondus.

**Popularité.** C'est le nombre de votes TMDB du film, gardé dans
`public/films.json`. La question ne cite pas la source : « Lequel est le plus
populaire ? ». Après le vote, le verdict renvoie vers les deux fiches Letterboxd.

**Difficulté.** Chaque duel a un palier, qui n'est pas affiché au joueur. Il ne
dépend pas seulement de l'écart de votes, parce que le nombre de votes est un
mauvais indicateur de notoriété pris isolément. Trois choses entrent en compte :

- **L'écart**, en échelle logarithmique — un rapport de 2 est deux fois plus
  lisible qu'un rapport de 1,4, pas 40 % de plus.
- **L'âge des films.** Les sites de notes sous-estiment les vieux titres : peu
  de membres les ont notés, donc leur compteur ne reflète pas leur notoriété réelle. La
  pondération descend de 1 (film récent) à 0,5 (60 ans et plus).
- **Le volume absolu.** Entre 100 et 500 votes, l'écart a beau être de 5×,
  personne n'a d'intuition sur des films aussi confidentiels. La pondération
  monte de 0,45 (~100 votes) à 1 (au-delà de ~30 000).

Le score obtenu est `log2(écart) × pondération d'âge × pondération de volume`,
et ce sont les seuils **1,30** et **0,42** qui séparent les trois paliers. Pour
deux films récents et très vus, les pondérations valent 1 et on retrouve des
seuils d'écart de 2,5× et 1,35×.

Ce que ça change concrètement :

| Duel | Écart | Score | Palier |
|---|---|---|---|
| 100 vs 500 votes, films récents | 5× | 1,18 | Moyen |
| Même écart, mais 10 000 vs 50 000 votes | 5× | 2,17 | Facile |
| 100 vs 500 votes, films de 1960 | 5× | 0,61 | Moyen |
| Deux classiques des années 50 à 1,25× d'écart | 1,25× | 0,13 | Difficile |

Deux garde-fous s'ajoutent, indépendants du palier : l'écart est **plafonné à
12×** et au moins un des deux films doit dépasser **1 200 votes**. Sans ça on
finit par opposer deux films que personne ne connaît, ce qui n'est pas
difficile mais arbitraire.

Les paliers s'enchaînent par séries de 5 selon un motif retiré au hasard à
chaque cycle (le même peut ressortir). Plus la série monte, plus les motifs
penchent vers les duels serrés :

```
        série 0-49     série 50-99    série 100+
        A B B A C      B B A C C      C C C C A      A = Facile
        B A B C A      B A B C B      B B C B B      B = Moyen
        A A B C C      C B B B C      C B C B C      C = Difficile
```

Ce que ça donne en pratique, sur une partie de 120 duels sans faute :

| Série | Facile | Moyen | Difficile |
|---|---|---|---|
| 0-49 | 40 % | 32 % | 28 % |
| 50-99 | 12 % | 54 % | 34 % |
| 100+ | 10 % | 40 % | 50 % |

Le jeu de motifs est choisi au début de chaque cycle de 5, en fonction de la
série **en cours** : casser sa série ramène donc aux motifs les plus faciles.

Quand le pool est trop petit pour servir le palier demandé, le duel se rabat
sur le palier le plus proche plutôt que de ne rien proposer — c'est le cas
quelques fois sur soixante avec une centaine de films.

Trois sources au choix :

- **populaires** : le pool figé de `public/films.json`
- **que j'ai vus** : les films vus de l'export qui sont dans ce pool
- **de ma watchlist** : les films de la watchlist qui sont dans ce pool

Seuls les films du pool ont leur nombre de votes dans `films.json` : c'est donc
lui qui borne les deux sources liées au profil.

Après chaque vote, un décompte de 10 secondes dans le bouton « Duel suivant »
enchaîne seul. Le duel en cours et la série survivent à un rechargement.

Au clavier : **Espace** tire un film, **←** / **→** votent pendant un duel, **Entrée** passe au suivant.

## Relevé à la main des notes Letterboxd (plus utilisé)

Le site n'affiche plus de chiffres Letterboxd. Cet outil reste pour le jour où
on voudrait en remettre, relevés par une personne :

```bash
node scripts/liste-a-relever.js   # tools/a-relever.json : 150 films de duel, 150 peu connus
npm start                          # puis http://localhost:3000/outils/saisie.html
```

La liste ne contient aucun chiffre Letterboxd : titre, année, affiche et durée
viennent de TMDB. Pour chaque film, la page ouvre la fiche Letterboxd ; on lit
la moyenne et le nombre de notes (au survol de la moyenne) et on les tape. La
progression est gardée dans le navigateur. À la fin, la page exporte
`films.json` et `gems.json` au format du site, avec les critères des films peu
connus réappliqués. `tools/` n'est servi qu'en local, jamais mis en ligne.

## Affiches

`scripts/tmdb-posters.js` ajoute à `films.json` et `gems.json` l'identifiant et
le chemin d'affiche TMDB de chaque film (titre identique, année à un an près) :

```bash
node scripts/tmdb-posters.js
```

## Comment ça marche

- **Tout est dans `public/index.html`** : vues, styles, logique
- Appels réseau : `films.json`, `gems.json` et l'API TMDB, rien d'autre

## Limites

- Les votes TMDB de `films.json` et `gems.json` ne bougent qu'en relançant
  `node scripts/tmdb-stats.js` ; sur le ticket, ils sont relus en direct
- Le profil n'est connu qu'au moment de l'export : refaire l'export de temps en
  temps pour que les films vus récemment soient écartés
- Les films en dessous de 30 votes sont écartés des duels (deviner entre 4 et 6
  votes tiendrait du pile ou face)
