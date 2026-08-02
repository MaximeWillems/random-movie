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
deux compteurs se révèlent, puis on enchaîne. Mode infini, pas de score.

Deux sources au choix :

- **Films populaires** — le pool pré-calculé de `public/films.json`
- **Ma watchlist** — les films de ta watchlist, jouables dès que quelques-uns
  sont prêts ; le reste se charge en tâche de fond pendant que tu joues

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
| `/{user}/watchlist/page/N/` | ✅ accessible |
| `/film/{slug}/` | ✅ accessible (titre, année, poster, `ratingCount`) |
| `/{user}/rss/` | ✅ accessible (50 derniers films vus) |
| `/films/popular/` | ❌ 403 |
| `/{user}/films/` et `/{user}/films/diary/` | ❌ 403 |
| `/csi/film/{slug}/stats/` | ❌ 403 |

C'est pour ça que le pool est construit hors ligne par `scripts/build-pool.js` :
faute de pouvoir lire `/films/popular/`, le script part d'une liste de films
connus et suit les « films similaires » de page en page.

## Limites

- Le profil doit être **public** sur Letterboxd
- La watchlist est rechargée à chaque fois (pas de cache côté navigateur)
- ~250 ms entre chaque page pour ne pas surcharger Letterboxd
- Les films en dessous de 3 000 notes sont écartés des duels (deviner entre
  400 et 600 notes tiendrait du pile ou face)
- `/api/seen/:username` ne fonctionne plus : la route Letterboxd qu'il scrape
  renvoie 403 (voir le tableau ci-dessus)
