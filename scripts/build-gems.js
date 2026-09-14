'use strict';

/**
 * Construit public/gems.json : les films peu connus mais bien notés du mode
 * hasard, à partir des listes Letterboxd de scripts/gem-lists.txt.
 *
 * Pour chaque liste pas encore lue, le script prend ses 100 films les mieux
 * notés et garde ceux qui passent les critères de lib/gem-rules.js. Seule la
 * première page du tri par note est lisible, et c'est là que se trouvent les
 * films à 4/5 : inutile d'aller plus loin dans la liste.
 *
 * Usage :
 *   node scripts/find-lists.js     # optionnel : ajoute des listes de niche
 *   node scripts/build-gems.js
 *
 * Les listes lues et les films déjà testés sont gardés dans
 * scripts/.gems-state.json : relancer ne traite que les nouvelles listes.
 */

const fs = require('fs');
const path = require('path');
const { parseFilmPage } = require('../lib/film-page');
const { isGem } = require('../lib/gem-rules');

const DELAY = 2500;

const OUT = path.join(__dirname, '..', 'public', 'gems.json');
const POOL = path.join(__dirname, '..', 'public', 'films.json');
const STATE = path.join(__dirname, '.gems-state.json');
const LISTS = path.join(__dirname, 'gem-lists.txt');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await sleep(DELAY);
    let resp;
    try {
      resp = await fetch(url, { headers: HEADERS });
    } catch (e) {
      // Coupure réseau (ECONNRESET) : on retente plutôt que de perdre le film.
      console.log(`    réseau (${e.cause ? e.cause.code : e.message}) sur ${url} — nouvel essai`);
      await sleep(10000 * attempt);
      continue;
    }
    if (resp.status === 404) return null;
    if (resp.status === 403 || resp.status === 429) {
      console.log(`    ${resp.status} sur ${url} — pause ${30 * attempt}s`);
      await sleep(30000 * attempt);
      continue;
    }
    return resp.ok ? resp.text() : null;
  }
  return null;
}

(async () => {
  // Les films du pool de duel sont connus par construction : inutile de les tester.
  const known = new Set(JSON.parse(fs.readFileSync(POOL, 'utf8')).map(f => f.slug));

  const gems = new Map();
  if (fs.existsSync(OUT)) {
    for (const g of JSON.parse(fs.readFileSync(OUT, 'utf8'))) gems.set(g.slug, g);
  }

  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const visited = new Set(state.visitedFilms || []);
  const listsDone = state.listsDone || [];

  const save = () => {
    fs.writeFileSync(OUT, JSON.stringify([...gems.values()].sort((a, b) => b.rating - a.rating)));
    fs.writeFileSync(STATE, JSON.stringify({ visitedFilms: [...visited], listsDone }));
  };

  const lists = fs.existsSync(LISTS)
    ? fs.readFileSync(LISTS, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    : [];

  const before = gems.size;
  let tested = 0;

  for (const raw of lists) {
    const m = (raw + '/').match(/letterboxd\.com(\/[^\/\s]+\/list\/[^\/\s]+)\//);
    if (!m) {
      console.log('Adresse de liste non reconnue :', raw);
      continue;
    }
    const listPath = m[1] + '/';
    if (listsDone.includes(listPath)) continue;

    const html = await fetchPage('https://letterboxd.com' + listPath + 'by/rating/');
    if (!html) {
      console.log('Liste illisible pour l\'instant :', listPath);
      continue;
    }
    const slugs = [...new Set([...html.matchAll(/data-item-slug="([^"]+)"/g)].map(x => x[1]))];
    console.log(`\n${listPath} : ${slugs.length} films les mieux notés`);

    let kept = 0;
    for (const slug of slugs) {
      if (visited.has(slug) || known.has(slug)) continue;
      const page = await fetchPage('https://letterboxd.com/film/' + slug + '/');
      visited.add(slug);
      tested++;
      if (!page) continue;

      const { film } = parseFilmPage(page, slug);
      if (isGem(film)) {
        gems.set(slug, film);
        kept++;
        console.log(`  ✔ ${film.name} (${film.year}) — ${film.ratingCount} notes, ${film.rating}/5`);
      }
    }

    listsDone.push(listPath);
    save();
    console.log(`  → ${kept} film(s) retenu(s)`);
  }

  save();
  const top = [...gems.values()].filter(g => g.rating >= 4).length;
  console.log(`\n✅  ${gems.size} films dans public/gems.json (+${gems.size - before}), dont ${top} à 4/5 ou plus — ${tested} films testés`);
})();
