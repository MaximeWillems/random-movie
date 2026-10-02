# Séance 404

![Séance 404](public/logo.svg)

Deux salles, autour des films de Letterboxd :

- **Trouver un film** : tire un film dans ta watchlist, ou parmi des films très
  bien notés que presque personne n'a vus
- **Duel** : deux films s'affrontent, il faut deviner lequel a le plus de notes

Le site suit le thème clair ou sombre du système ; le lien en haut à droite
force l'un ou l'autre (choix gardé dans le `localStorage`, clé `lb-theme`).

## Sources des données

Le site ne lit **aucune page Letterboxd**.

- **Films, résumés, genres, affiches** : API TMDB, appelée depuis le navigateur.
  Mention « Ce site utilise l'API TMDB mais n'est ni approuvé ni certifié par
  TMDB » et logo en pied de page, comme TMDB le demande.
- **Où le voir** : offres légales connues de TMDB, fournies par JustWatch (cité
  sous « Où le voir » et en pied de page), Belgique puis France ; copie libre de
  droits sur Internet Archive ; recherche YouTube / Vimeo.
- **Moyennes et nombres de notes Letterboxd** : relevés figés dans
  `public/films.json` (août 2026) et `public/gems.json` (septembre 2026). Le mois
  du relevé est affiché en petit sous les chiffres. Un film absent de ces deux
  fichiers montre la moyenne et le nombre de votes TMDB, marqués « TMDB ».
- **Profil** : l'export que le membre fait lui-même sur Letterboxd
  (*Settings → Import & Export → Export your data*). Le ZIP est lu dans le
  navigateur (lecteur de ZIP intégré, sans bibliothèque) et n'est envoyé nulle
  part. Il donne les films vus, la watchlist et les notes.

Séance 404 n'est pas affilié à Letterboxd.

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
**Cloudflare Pages** (gratuit, sans mise en veille), redéployé à chaque push sur
`main`.

- Projet Pages relié au dépôt GitHub, sans commande de build, dossier de sortie `public`
- Domaine personnalisé `random-movie.pikilab.app`, ajouté depuis le projet Pages
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

Des films peu connus mais bien notés : **moins de 5 000 notes sur Letterboxd et
au moins 3/5, ou moins de 20 000 notes pour les films à 4/5 et plus**, sortis il
y a plus de deux ans. La liste, figée dans `public/gems.json`, vient de listes
Letterboxd de niche (réalisatrices, un pays, un genre…). Le tirage favorise les
mieux notés : un film à 4/5 sort 9 fois plus souvent qu'un film à 3/5.

Avec un export importé, les films déjà vus sont écartés (titre et année).

### Mode duel

Deux films côte à côte : clique sur celui que tu crois le plus populaire. Les
deux compteurs se révèlent, puis on enchaîne. Mode infini.

**Série et record.** La série compte les bonnes réponses d'affilée et retombe à
zéro à la première erreur. Le record est gardé dans le `localStorage` du
navigateur (clé `lb-duel-record`), tous modes confondus.

**Difficulté.** Chaque duel a un palier, affiché sous la question. Il ne
dépend pas seulement de l'écart de notes, parce que le nombre de notes est un
mauvais indicateur de notoriété pris isolément. Trois choses entrent en compte :

- **L'écart**, en échelle logarithmique — un rapport de 2 est deux fois plus
  lisible qu'un rapport de 1,4, pas 40 % de plus.
- **L'âge des films.** Letterboxd sous-estime les vieux titres : peu de membres
  les ont encodés, donc leur compteur ne reflète pas leur notoriété réelle. La
  pondération descend de 1 (film récent) à 0,5 (60 ans et plus).
- **Le volume absolu.** Entre 10 000 et 50 000 notes, l'écart a beau être de
  5×, personne n'a d'intuition sur des chiffres pareils. La pondération monte
  de 0,45 (~10 000 notes) à 1 (au-delà de ~3 millions).

Le score obtenu est `log2(écart) × pondération d'âge × pondération de volume`,
et ce sont les seuils **1,30** et **0,42** qui séparent les trois paliers. Pour
deux films récents et très vus, les pondérations valent 1 et on retrouve des
seuils d'écart de 2,5× et 1,35×.

Ce que ça change concrètement :

| Duel | Écart | Score | Palier |
|---|---|---|---|
| 10 000 vs 50 000 notes, films récents | 5× | 1,18 | Moyen |
| Même écart, mais 1 M vs 5 M de notes | 5× | 2,17 | Facile |
| 10 000 vs 50 000 notes, films de 1960 | 5× | 0,61 | Moyen |
| Parasite vs Pulp Fiction | 1,28× | 0,34 | Difficile |
| Deux classiques des années 50 au même écart | 1,25× | 0,13 | Difficile |

Deux garde-fous s'ajoutent, indépendants du palier : l'écart est **plafonné à
12×** et au moins un des deux films doit dépasser **120 000 notes**. Sans ça on
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

Seuls les films du pool ont un nombre de notes relevé : c'est donc lui qui
borne les deux sources liées au profil.

Après chaque vote, un décompte de 10 secondes dans le bouton « Duel suivant »
enchaîne seul. Le duel en cours et la série survivent à un rechargement.

Au clavier : **Espace** tire un film, **←** / **→** votent pendant un duel, **Entrée** passe au suivant.

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

- Les chiffres Letterboxd sont figés au mois du relevé
- Le profil n'est connu qu'au moment de l'export : refaire l'export de temps en
  temps pour que les films vus récemment soient écartés
- Les films en dessous de 3 000 notes sont écartés des duels (deviner entre
  400 et 600 notes tiendrait du pile ou face)
