'use strict';

/**
 * Remplace dans public/films.json et public/gems.json les chiffres Letterboxd
 * par ceux de TMDB : moyenne sur 10 (vote), nombre de votes (votes), durée.
 * Le slug Letterboxd reste : il ne sert qu'au lien vers la fiche.
 *
 * Usage : node scripts/tmdb-stats.js
 */

const fs = require('fs');
const path = require('path');

const KEY = '8265bd1679663a7ea12ac168da84d2e8';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Coupures réseau fréquentes vers TMDB depuis Node : plusieurs essais
async function tmdb(p) {
  for (let i = 0; i < 8; i++) {
    try {
      const resp = await fetch(`https://api.themoviedb.org/3${p}?api_key=${KEY}`);
      if (resp.status === 404) return null;
      if (resp.ok) return resp.json();
    } catch (e) {
      // nouvel essai
    }
    await sleep(1000 + i * 500);
  }
  return null;
}

async function run(file, withRuntime) {
  const full = path.join(__dirname, '..', 'public', file);
  const films = JSON.parse(fs.readFileSync(full, 'utf8'));
  const out = [];
  const ratios = [];

  // Cinq requêtes à la fois
  for (let i = 0; i < films.length; i += 5) {
    await Promise.all(films.slice(i, i + 5).map(async f => {
      const d = await tmdb(`/movie/${f.tmdbId}`);
      if (!d) return;

      // Écart d'échelle entre les deux sites, pour régler le duel (non gardé)
      if (f.ratingCount && d.vote_count) ratios.push(f.ratingCount / d.vote_count);

      const film = { slug: f.slug, name: f.name, year: f.year, tmdbId: f.tmdbId, posterPath: f.posterPath, vote: d.vote_average, votes: d.vote_count };
      if (withRuntime) film.runtime = d.runtime || null;
      out.push(film);
    }));
    process.stdout.write(`\r${file} : ${Math.min(i + 5, films.length)}/${films.length}`);
  }

  // Même ordre qu'avant
  const order = new Map(films.map((f, i) => [f.slug, i]));
  out.sort((a, b) => order.get(a.slug) - order.get(b.slug));
  fs.writeFileSync(full, JSON.stringify(out));

  ratios.sort((a, b) => a - b);
  const q = p => ratios[Math.floor(p * (ratios.length - 1))];
  console.log(` — ${out.length} films, rapport Letterboxd / TMDB : médiane ${q(0.5).toFixed(0)}, quartiles ${q(0.25).toFixed(0)} à ${q(0.75).toFixed(0)}`);
}

(async () => {
  await run('films.json', false);
  await run('gems.json', true);
})();
