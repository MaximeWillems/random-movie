'use strict';

/**
 * Construit public/gems.json : des films peu connus mais bien notés, pour le
 * tirage « Pépite » du mode hasard.
 *
 * Aucune page Letterboxd lisible ne liste les films peu vus (/films/ et la
 * recherche sont bloqués par Cloudflare). Le script passe donc par les
 * filmographies et les films similaires : il part des réalisateurs des films
 * les moins populaires du pool de duel, puis chaque film confidentiel croisé
 * ouvre à son tour son équipe et ses voisins, qui ont de bonnes chances d'être
 * aussi peu vus.
 *
 * Usage :
 *   node scripts/build-gems.js          # 200 pépites
 *   node scripts/build-gems.js 400
 *
 * Reprise automatique : l'état du crawl est gardé dans scripts/.gems-state.json.
 */

const fs = require('fs');
const path = require('path');
const { parseFilmPage } = require('../lib/film-page');

const TARGET = parseInt(process.argv[2], 10) || 200;
const MAX_RATINGS = 5000;
const MIN_RATING = 3.0;
const MAX_RUNTIME = 240;
// En dessous, un film est assez confidentiel pour que son entourage vaille
// d'être exploré, même s'il n'est pas lui-même une pépite.
const OBSCURE = 20000;
const DELAY = 2500;
const FILMS_PER_PERSON = 30;

const OUT = path.join(__dirname, '..', 'public', 'gems.json');
const POOL = path.join(__dirname, '..', 'public', 'films.json');
const STATE = path.join(__dirname, '.gems-state.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(url, { headers: HEADERS });
    if (resp.status === 404) return null;
    if (resp.status === 403 || resp.status === 429) {
      const wait = 30000 * attempt;
      console.log(`    ${resp.status} sur ${url} — pause ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.text();
  }
  return null;
}

(async () => {
  // Les films du pool de duel sont connus par construction : inutile de les
  // tester. Les moins populaires servent de départ, leurs réalisateurs étant
  // les plus confidentiels.
  const popular = JSON.parse(fs.readFileSync(POOL, 'utf8'));
  const known = new Set(popular.map(f => f.slug));
  const seeds = [...popular].sort((a, b) => a.ratingCount - b.ratingCount);

  const gems = new Map();
  if (fs.existsSync(OUT)) {
    for (const g of JSON.parse(fs.readFileSync(OUT, 'utf8'))) gems.set(g.slug, g);
  }

  const state = fs.existsSync(STATE)
    ? JSON.parse(fs.readFileSync(STATE, 'utf8'))
    : { filmQueue: [], personQueue: [], seedIndex: 0, visitedFilms: [], visitedPeople: [] };
  const visitedFilms = new Set(state.visitedFilms);
  const visitedPeople = new Set(state.visitedPeople);
  if (visitedFilms.size) console.log(`Reprise : ${gems.size} pépites, ${state.filmQueue.length} films et ${state.personQueue.length} personnes en attente`);

  const save = () => {
    const list = [...gems.values()].sort((a, b) => b.rating - a.rating);
    fs.writeFileSync(OUT, JSON.stringify(list));
    fs.writeFileSync(STATE, JSON.stringify({
      filmQueue: state.filmQueue.slice(0, 20000),
      personQueue: state.personQueue.slice(0, 5000),
      seedIndex: state.seedIndex,
      visitedFilms: [...visitedFilms],
      visitedPeople: [...visitedPeople],
    }));
  };

  const queueFilm = slug => {
    if (!visitedFilms.has(slug) && !known.has(slug) && !state.filmQueue.includes(slug)) state.filmQueue.push(slug);
  };
  const queuePerson = (p, first) => {
    if (visitedPeople.has(p) || state.personQueue.includes(p)) return;
    if (first) state.personQueue.unshift(p);
    else state.personQueue.push(p);
  };

  let fetches = 0;
  let evaluated = 0;
  const rejects = { noAverage: 0, tooKnown: 0, lowRating: 0 };

  while (gems.size < TARGET) {
    try {
      if (state.filmQueue.length) {
        const slug = state.filmQueue.shift();
        if (visitedFilms.has(slug)) continue;
        visitedFilms.add(slug);

        const html = await fetchPage('https://letterboxd.com/film/' + slug + '/');
        fetches++;
        evaluated++;
        if (html) {
          const { film, people, neighbours } = parseFilmPage(html, slug);
          // Au-delà de 4 h, c'est presque toujours une minisérie que TMDB range
          // parmi les films (The Bible, 480 min).
          const isGem = film.type === 'movie' && !(film.runtime > MAX_RUNTIME)
            && film.ratingCount && film.ratingCount < MAX_RATINGS && film.rating >= MIN_RATING;

          if (!film.ratingCount) rejects.noAverage++;
          else if (film.ratingCount >= MAX_RATINGS) rejects.tooKnown++;
          else if (!isGem) rejects.lowRating++;

          if (isGem) {
            gems.set(slug, film);
            console.log(`  💎 ${String(gems.size).padStart(4)}/${TARGET}  ${film.name} (${film.year}) — ${film.ratingCount} notes, ${film.rating}/5${film.runtime ? ', ' + film.runtime + ' min' : ''}`);
            save();
          }

          // Un film confidentiel, pépite ou non, mène vers d'autres films
          // confidentiels : son entourage passe devant les réalisateurs de films
          // connus. Les acteurs ne sont suivis que depuis les pépites, sinon la
          // file déborde de filmographies grand public.
          if (!film.ratingCount || film.ratingCount < OBSCURE) {
            for (const p of [...people.directors, ...(isGem ? people.actors.slice(0, 5) : [])]) queuePerson(p, true);
            for (const n of neighbours) queueFilm(n);
          }
        }
      } else if (state.personQueue.length) {
        const person = state.personQueue.shift();
        if (visitedPeople.has(person)) continue;
        visitedPeople.add(person);

        const html = await fetchPage('https://letterboxd.com' + person);
        fetches++;
        if (html) {
          const slugs = [...new Set([...html.matchAll(/data-item-slug="([^"]+)"/g)].map(m => m[1]))];
          // Les filmographies sont triées du plus populaire au moins populaire :
          // les pépites sont en fin de liste.
          for (const s of slugs.slice(-FILMS_PER_PERSON)) queueFilm(s);
        }
      } else if (state.seedIndex < seeds.length) {
        // Film du pool de duel : il ne sert qu'à découvrir son réalisateur.
        const seed = seeds[state.seedIndex++];
        const html = await fetchPage('https://letterboxd.com/film/' + seed.slug + '/');
        fetches++;
        if (html) {
          for (const p of parseFilmPage(html, seed.slug).people.directors) queuePerson(p, false);
        }
      } else {
        console.log('Plus rien à explorer.');
        break;
      }
    } catch (e) {
      console.log('  ✗', e.message);
    }

    if (fetches && fetches % 25 === 0) {
      console.log(`    … ${fetches} requêtes, ${evaluated} films testés, ${gems.size} pépites | sans moyenne ${rejects.noAverage}, trop connus ${rejects.tooKnown}, note < ${MIN_RATING} ${rejects.lowRating}`);
      save();
    }
    await sleep(DELAY);
  }

  save();
  console.log(`\n✅  ${gems.size} pépites dans public/gems.json (${fetches} requêtes cette session)`);
})();
