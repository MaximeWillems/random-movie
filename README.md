# 🎬 Letterboxd · Film du hasard

Tire un film aléatoire depuis la watchlist publique d'un profil Letterboxd.

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou plus récent

## Installation & lancement

```bash
# 1. Installer les dépendances (une seule fois)
npm install

# 2. Lancer le serveur
npm start
# → Serveur lancé → http://localhost:3000

# 3. Ouvrir dans le navigateur
http://localhost:3000
```

## Utilisation

1. Entre ton nom d'utilisateur Letterboxd
2. Clique **Charger** (ou appuie sur Entrée)
3. L'app récupère toute ta watchlist
4. Un film est tiré au hasard avec sa fiche (poster, synopsis, genres) via TMDB
5. Clique **🎲 Autre film** pour en tirer un nouveau

## Comment ça marche

- **Backend** (`server.js`) : Express scrape les pages HTML publiques de Letterboxd, page par page
- **Frontend** (`public/index.html`) : affiche les films, récupère les fiches via l'API TMDB
- Pas de clé API Letterboxd nécessaire — les profils publics sont accessibles librement

## Limites

- Le profil doit être **public** sur Letterboxd
- La watchlist est chargée à chaque fois (pas de cache pour l'instant)
- ~250ms entre chaque page pour ne pas surcharger Letterboxd
