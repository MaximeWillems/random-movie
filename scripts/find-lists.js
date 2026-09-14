'use strict';

/**
 * Repère des listes Letterboxd de niche et ajoute les plus prometteuses à
 * scripts/gem-lists.txt.
 *
 * La recherche de listes et la pagination des listes populaires sont bloquées.
 * Deux portes restent ouvertes : les listes qui contiennent un film donné
 * (/film/{slug}/lists/by/popular/) et les listes officielles (/official/lists/).
 * On part donc des bons films déjà trouvés (4/5 et plus) : les listes où ils
 * figurent sont souvent des listes de niche, et plus une liste en contient, plus
 * elle est évaluée tôt.
 *
 * Chaque liste d'au moins 100 films est notée sur 10 films répartis dans ses
 * 100 mieux notés (rangs 1, 11, 21…). Le haut de ces listes est souvent occupé
 * par des classiques connus : ne tester que les premiers sous-estimerait le
 * rendement.
 *
 * Usage :
 *   node scripts/find-lists.js         # évalue jusqu'à 25 listes
 *   node scripts/find-lists.js 60
 *
 * Résultats dans scripts/list-candidates.json : une liste déjà évaluée ne l'est
 * pas une seconde fois.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { parseFilmPage } = require('../lib/film-page');
const { isGem } = require('../lib/gem-rules');

const MAX_LISTS = parseInt(process.argv[2], 10) || 25;
const MIN_FILMS = 100;
const SAMPLE = 10;
// Bons films attendus parmi les 100 mieux notés pour ajouter la liste.
const ADD_THRESHOLD = 8;
const DELAY = 2500;

// Listes personnelles (collections, watchlists) : ce ne sont pas des sélections.
const PERSONAL = /watch-?list|owned|collection|blu-?ray|dvd|4k|uhd|to-watch|watched|diary|sorted-by-movie-posters/;

const GEMS = path.join(__dirname, '..', 'public', 'gems.json');
const POOL = path.join(__dirname, '..', 'public', 'films.json');
const LISTS = path.join(__dirname, 'gem-lists.txt');
const REPORT = path.join(__dirname, 'list-candidates.json');

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

const listPaths = html => [...new Set([...html.matchAll(/href="(\/[^\/"]+\/list\/[^\/"]+\/)"/g)].map(m => m[1]))];

(async () => {
  const gems = JSON.parse(fs.readFileSync(GEMS, 'utf8'));
  const gemSlugs = new Set(gems.map(g => g.slug));
  const popular = new Set(JSON.parse(fs.readFileSync(POOL, 'utf8')).map(f => f.slug));
  const report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : { lists: {} };
  const inFile = fs.existsSync(LISTS) ? fs.readFileSync(LISTS, 'utf8') : '';
  const save = () => fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

  // 1. Candidats : listes officielles et listes contenant nos meilleurs films.
  const hits = new Map();
  const collect = html => {
    for (const p of listPaths(html)) {
      if (!PERSONAL.test(p)) hits.set(p, (hits.get(p) || 0) + 1);
    }
  };

  const official = await fetchPage('https://letterboxd.com/official/lists/');
  if (official) collect(official);

  const seeds = gems.filter(g => g.rating >= 4).sort((a, b) => b.rating - a.rating);
  for (const g of seeds) {
    const html = await fetchPage(`https://letterboxd.com/film/${g.slug}/lists/by/popular/`);
    if (html) collect(html);
  }

  const queue = [...hits.entries()]
    .filter(([p]) => !report.lists[p] && !inFile.includes(p))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LISTS);
  console.log(`${hits.size} listes candidates depuis ${seeds.length} films, ${queue.length} à évaluer\n`);

  // 2. Évaluation sur un échantillon réparti dans les 100 mieux notés.
  for (const [p, seedHits] of queue) {
    const html = await fetchPage('https://letterboxd.com' + p + 'by/rating/');
    if (!html) {
      report.lists[p] = { path: p, error: 'illisible' };
      save();
      continue;
    }

    const rawTitle = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || p;
    const title = cheerio.load('<x>' + rawTitle + '</x>').text().replace(/‎/g, '').trim();
    const slugs = [...new Set([...html.matchAll(/data-item-slug="([^"]+)"/g)].map(m => m[1]))];
    const cm = html.match(/A list of ([\d,]+) films?/);
    const count = cm ? parseInt(cm[1].replace(/,/g, ''), 10) : slugs.length;
    const entry = { path: p, url: 'https://letterboxd.com' + p, title, count, seedHits };

    if (count < MIN_FILMS) {
      entry.skipped = 'moins de ' + MIN_FILMS + ' films';
      report.lists[p] = entry;
      save();
      console.log(`    —  ${title} (${count} films, trop courte)`);
      continue;
    }

    const step = Math.max(1, Math.floor(slugs.length / SAMPLE));
    const sample = [];
    for (let i = 0; i < slugs.length && sample.length < SAMPLE; i += step) sample.push(slugs[i]);

    // Déjà retenu : réussite sans requête. Film du pool de duel : trop connu.
    let passes = 0;
    for (const s of sample) {
      if (gemSlugs.has(s)) {
        passes++;
        continue;
      }
      if (popular.has(s)) continue;
      const fh = await fetchPage('https://letterboxd.com/film/' + s + '/');
      if (fh && isGem(parseFilmPage(fh, s).film)) passes++;
    }

    entry.sampled = sample.length;
    entry.passes = passes;
    entry.estimate = Math.round(passes / sample.length * slugs.length);
    report.lists[p] = entry;
    save();
    console.log(`  ${String(entry.estimate).padStart(3)} bons films estimés  ${title} (${count} films)`);
  }

  // 3. Classement, et ajout des listes prometteuses à gem-lists.txt.
  const ranked = Object.values(report.lists)
    .filter(l => l.estimate !== undefined)
    .sort((a, b) => b.estimate - a.estimate);
  const toAdd = ranked.filter(l => l.estimate >= ADD_THRESHOLD && !inFile.includes(l.path));
  if (toAdd.length) {
    const block = toAdd.map(l => `\n# ${l.title} — ${l.count} films, ~${l.estimate} bons films estimés\n${l.url}`).join('\n');
    fs.appendFileSync(LISTS, block + '\n');
  }

  console.log('\nClassement :');
  for (const l of ranked.slice(0, 20)) {
    console.log(`  ${String(l.estimate).padStart(3)}  ${l.title} (${l.count} films)  ${l.url}`);
  }
  console.log(`\n${toAdd.length} liste(s) ajoutée(s) à scripts/gem-lists.txt`);
})();
