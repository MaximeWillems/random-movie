'use strict';

/**
 * Construit public/gems.json : des films peu connus mais bien notés, pour le
 * tirage « Pépite » du mode hasard.
 *
 * Aucune page Letterboxd lisible ne liste les films peu vus (/films/ et la
 * recherche sont bloqués par Cloudflare). Le script passe donc par les
 * filmographies et les films similaires. Il part des réalisateurs des films les
 * mieux notés du pool de duel, puis explore en priorité l'entourage des films
 * les mieux notés qu'il croise : les voisins d'un film à 4/5 ont bien plus de
 * chances d'être eux aussi très bien notés que ceux d'un documentaire TV à 3/5.
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
// Un film n'ouvre son entourage que s'il est confidentiel et assez bien noté.
const OBSCURE = 20000;
const EXPAND_MIN_RATING = 3.5;
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

// File triée par priorité décroissante. La priorité d'un élément est la note du
// film qui y a mené ; s'il est retrouvé via un film mieux noté, il remonte.
function enqueue(queue, key, p) {
  const i = queue.findIndex(x => x.key === key);
  if (i !== -1) {
    if (queue[i].p >= p) return;
    queue.splice(i, 1);
  }
  const at = queue.findIndex(x => x.p < p);
  queue.splice(at === -1 ? queue.length : at, 0, { key, p });
}

(async () => {
  // Les films du pool de duel sont connus par construction : inutile de les
  // tester. Les mieux notés servent de départ, leurs réalisateurs ayant plus de
  // chances d'avoir des courts ou des premiers films eux aussi très bien notés.
  const popular = JSON.parse(fs.readFileSync(POOL, 'utf8'));
  const known = new Set(popular.map(f => f.slug));
  const seeds = [...popular].sort((a, b) => b.rating - a.rating);

  const gems = new Map();
  if (fs.existsSync(OUT)) {
    for (const g of JSON.parse(fs.readFileSync(OUT, 'utf8'))) gems.set(g.slug, g);
  }

  const state = fs.existsSync(STATE)
    ? JSON.parse(fs.readFileSync(STATE, 'utf8'))
    : { filmQueue: [], personQueue: [], seedIndex: 0, visitedFilms: [], visitedPeople: [] };
  // Ancien format : files de chaînes, sans priorité.
  state.filmQueue = state.filmQueue.map(x => (typeof x === 'string' ? { key: x, p: 0 } : x));
  state.personQueue = state.personQueue.map(x => (typeof x === 'string' ? { key: x, p: 0 } : x));
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

  const queueFilm = (slug, p) => {
    if (!visitedFilms.has(slug) && !known.has(slug)) enqueue(state.filmQueue, slug, p);
  };
  const queuePerson = (person, p) => {
    if (!visitedPeople.has(person)) enqueue(state.personQueue, person, p);
  };

  let fetches = 0;
  let evaluated = 0;
  const rejects = { noAverage: 0, tooKnown: 0, lowRating: 0 };
  const topCount = () => [...gems.values()].filter(g => g.rating >= 4).length;

  while (gems.size < TARGET) {
    try {
      const nextFilm = state.filmQueue[0];
      const nextPerson = state.personQueue[0];

      if (nextFilm && (!nextPerson || nextFilm.p >= nextPerson.p)) {
        state.filmQueue.shift();
        const slug = nextFilm.key;
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

          // Les acteurs ne sont suivis que depuis les pépites, sinon la file
          // déborde de filmographies grand public.
          if (film.ratingCount && film.ratingCount < OBSCURE && film.rating >= EXPAND_MIN_RATING) {
            for (const p of [...people.directors, ...(isGem ? people.actors.slice(0, 5) : [])]) queuePerson(p, film.rating);
            for (const n of neighbours) queueFilm(n, film.rating);
          }
        }
      } else if (nextPerson) {
        state.personQueue.shift();
        const person = nextPerson.key;
        if (visitedPeople.has(person)) continue;
        visitedPeople.add(person);

        const html = await fetchPage('https://letterboxd.com' + person);
        fetches++;
        if (html) {
          const slugs = [...new Set([...html.matchAll(/data-item-slug="([^"]+)"/g)].map(m => m[1]))];
          // Les filmographies sont triées du plus populaire au moins populaire :
          // les pépites sont en fin de liste. Elles passent juste après les
          // voisins directs du film qui a mené à cette personne.
          for (const s of slugs.slice(-FILMS_PER_PERSON)) queueFilm(s, nextPerson.p - 0.1);
        }
      } else if (state.seedIndex < seeds.length) {
        // Film du pool de duel : il ne sert qu'à découvrir son réalisateur.
        const seed = seeds[state.seedIndex++];
        const html = await fetchPage('https://letterboxd.com/film/' + seed.slug + '/');
        fetches++;
        if (html) {
          for (const p of parseFilmPage(html, seed.slug).people.directors) queuePerson(p, 0);
        }
      } else {
        console.log('Plus rien à explorer.');
        break;
      }
    } catch (e) {
      console.log('  ✗', e.message);
    }

    if (fetches && fetches % 25 === 0) {
      console.log(`    … ${fetches} requêtes, ${evaluated} films testés, ${gems.size} pépites dont ${topCount()} à 4/5 ou plus | sans moyenne ${rejects.noAverage}, trop connus ${rejects.tooKnown}, note < ${MIN_RATING} ${rejects.lowRating}`);
      save();
    }
    await sleep(DELAY);
  }

  save();
  console.log(`\n✅  ${gems.size} pépites dans public/gems.json, dont ${topCount()} à 4/5 ou plus (${fetches} requêtes cette session)`);
})();
