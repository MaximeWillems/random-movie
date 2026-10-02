'use strict';

// Serveur local de développement : sert le site statique de public/.
// Le site ne lit aucune page Letterboxd : les données de films viennent de
// l'API TMDB, appelée depuis le navigateur, et le profil de l'export que le
// membre importe lui-même.
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Version anglaise : même page, servie à /en comme en ligne (public/_redirects)
app.get(['/en', '/en/'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Adresses sans .html, comme en ligne (/a-propos)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Outils locaux, jamais mis en ligne : page de relevé à la main
app.use('/outils', express.static(path.join(__dirname, 'tools')));

// Page introuvable : même page 404 qu'en ligne
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

app.listen(PORT, () => {
  console.log('\n✅  Serveur lancé → http://localhost:' + PORT + '\n');
});
