# 🎬 Letterboxd · Film du hasard

Deux modes :

- **🎲 Film du hasard** — tire un film au hasard dans la watchlist publique d'un profil
- **⚔️ Duel de popularité** — deux films s'affrontent, devine lequel a le plus de notes sur Letterboxd

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou plus récent (`fetch` natif)

## Installation & lancement

```bash
# 1. Installer les dépendances (une seule fois)
npm install

# 2. Lancer le serveur
npm start
# → Serveur lancé → http://localhost:3000
```

Puis ouvrir http://localhost:3000

## Utilisation

### Mode film du hasard

1. Entre un nom d'utilisateur Letterboxd, clique **Charger** (ou Entrée)
2. Un film est tiré au hasard avec sa fiche (poster, synopsis, genres) via TMDB
3. **🎲 Autre film** pour en tirer un nouveau

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

- **Films populaires** — le pool pré-calculé de `public/films.json`
- **Mes films vus** — une centaine de films vus (voir la limite plus bas)
- **Ma watchlist** — la watchlist complète, donc un pool plus large

Pour les deux sources liées à un profil, les films déjà présents dans le pool
sont jouables immédiatement ; les autres se chargent en tâche de fond pendant
que tu joues.

Au clavier : **←** / **→** pour voter, **Entrée** pour le duel suivant.

## Le pool de films

Le mode duel s'appuie sur `public/films.json` : une liste de films avec leur
nombre de notes, triée du plus populaire au moins populaire. Le fichier est
versionné, il n'y a donc rien à faire pour jouer.

Pour le régénérer ou l'agrandir :

```bash
node scripts/build-pool.js 500
```

Le script est throttlé (~2,5 s entre deux films) — compter une vingtaine de
minutes pour 500 films. Il reprend là où il s'était arrêté : les liens encore à
explorer sont gardés dans `scripts/.crawl-frontier.json` (non versionné), donc
relancer avec un objectif plus haut complète le fichier au lieu de le refaire
de zéro.

## Comment ça marche

- **Backend** (`server.js`) : Express scrape les pages HTML publiques de Letterboxd
- **Frontend** (`public/index.html`) : tout est dans ce fichier — vues, styles, logique
- Pas de clé API Letterboxd nécessaire

La popularité vient du bloc JSON-LD présent sur chaque page `/film/{slug}/`,
qui expose `ratingCount` (le nombre de notes), la note moyenne et le poster.
Le mode duel n'utilise donc pas TMDB du tout.

### Ce que Letterboxd laisse passer

Une partie du site est protégée par Cloudflare et répond **403** au scraping,
ce qui contraint pas mal l'architecture :

| Route | État |
|---|---|
| `/{user}/watchlist/page/N/` | ✅ accessible, paginable |
| `/film/{slug}/` | ✅ accessible (titre, année, poster, `ratingCount`) |
| `/{user}/rss/` | ✅ accessible (50 derniers visionnages) |
| `/{user}/films/` | ✅ accessible — **mais première page seulement** (72 films) |
| `/{user}/films/page/N/` | ❌ 403, y compris `page/1` |
| `/films/popular/` | ❌ 403 |
| `/{user}/films/diary/`, `/{user}/likes/films/` | ❌ 403 |
| `/csi/film/{slug}/stats/` | ❌ 403 |

Le cas de `/films/` est le plus surprenant : l'URL nue passe, la forme paginée
non — y compris `page/1`, qui affiche pourtant la même chose. D'où la limite
sur les films vus.

C'est pour ça que le pool est construit hors ligne par `scripts/build-pool.js` :
faute de pouvoir lire `/films/popular/`, le script part d'une liste de films
connus et suit les « films similaires » de page en page.

## Limites

- Le profil doit être **public** sur Letterboxd
- La watchlist est rechargée à chaque fois (pas de cache côté navigateur)
- ~250 ms entre chaque page pour ne pas surcharger Letterboxd
- Les films en dessous de 3 000 notes sont écartés des duels (deviner entre
  400 et 600 notes tiendrait du pile ou face)
- **Films vus : une centaine au maximum**, pas l'historique complet. La
  pagination de `/{user}/films/` étant bloquée, `/api/seen/:username` combine
  la première page (72 films, triés par date de sortie) et le flux RSS (50
  derniers visionnages, qui ramène des films plus anciens). Pour un pool plus
  large, utiliser la source watchlist.
