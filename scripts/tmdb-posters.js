'use strict';

/**
 * Ajoute à public/films.json et public/gems.json l'identifiant TMDB et le
 * chemin de l'affiche TMDB, et retire les adresses d'affiches Letterboxd :
 * les images viennent de l'API TMDB, autorisée avec mention de la source.
 *
 * Usage : node scripts/tmdb-posters.js
 */

const fs = require('fs');
const path = require('path');

const KEY = '8265bd1679663a7ea12ac168da84d2e8';
const TMDB = 'https://api.themoviedb.org/3';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Coupures réseau fréquentes vers TMDB depuis Node : plusieurs essais
async function tmdb(p) {
  for (let i = 0; i < 8; i++) {
    try {
      const resp = await fetch(TMDB + p + (p.includes('?') ? '&' : '?') + 'api_key=' + KEY);
      if (resp.status === 404) return null;
      if (resp.ok) return resp.json();
    } catch (e) {
      // nouvel essai
    }
    await sleep(1000 + i * 500);
  }
  return null;
}

// Même règle que sur le site : titre identique et année à un an près
async function search(film) {
  const q = encodeURIComponent(film.name);
  const data = await tmdb(`/search/movie?query=${q}` + (film.year ? `&year=${film.year}` : ''))
    || await tmdb(`/search/movie?query=${q}`);
  const hit = ((data && data.results) || []).find(r =>
    (norm(r.title) === norm(film.name) || norm(r.original_title) === norm(film.name))
    && (!film.year || Math.abs(parseInt((r.release_date || '0').slice(0, 4), 10) - film.year) <= 1));
  return hit ? { tmdbId: hit.id, posterPath: hit.poster_path || null } : null;
}

async function enrich(film) {
  if (film.tmdbId) {
    const d = await tmdb(`/movie/${film.tmdbId}`);
    if (d) return { tmdbId: film.tmdbId, posterPath: d.poster_path || null };
  }
  return search(film);
}

async function run(file) {
  const full = path.join(__dirname, '..', 'public', file);
  const films = JSON.parse(fs.readFileSync(full, 'utf8'));
  let missing = 0;

  // Cinq requêtes à la fois
  for (let i = 0; i < films.length; i += 5) {
    await Promise.all(films.slice(i, i + 5).map(async f => {
      const t = await enrich(f);
      if (t) Object.assign(f, t);
      else missing++;
      delete f.poster;
    }));
    process.stdout.write(`\r${file} : ${Math.min(i + 5, films.length)}/${films.length}`);
  }

  fs.writeFileSync(full, JSON.stringify(films));
  console.log(` — sans correspondance TMDB : ${missing}, sans affiche : ${films.filter(f => !f.posterPath).length}`);
}

(async () => {
  await run('films.json');
  await run('gems.json');
})();
