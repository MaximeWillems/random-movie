'use strict';

/**
 * Construit public/films.json : le pool de films utilisé par le mode duel.
 *
 * Letterboxd bloque /films/popular/ derrière Cloudflare, mais les pages
 * /film/{slug}/ restent accessibles et listent chacune ~7 films similaires.
 * Le script part donc de quelques films connus et suit ces liens de proche
 * en proche. Chaque page visitée donne d'un coup le titre, l'année, le
 * poster et le nombre de notes (= la popularité).
 *
 * Usage :
 *   node scripts/build-pool.js            # 500 films
 *   node scripts/build-pool.js 800        # 800 films
 *
 * Le fichier existant est rechargé au démarrage : le crawl reprend où il
 * s'était arrêté, et l'écriture se fait au fil de l'eau.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const TARGET = parseInt(process.argv[2], 10) || 500;
const DELAY = 2500;
const OUT = path.join(__dirname, '..', 'public', 'films.json');

// films.json ne garde que les données des films, pas les liens restant à
// explorer. Sans cette frontière, une reprise redémarrerait des seules graines
// — toutes déjà connues — et s'arrêterait sans rien ajouter.
const FRONTIER = path.join(__dirname, '.crawl-frontier.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SEEDS = [
  'parasite-2019', 'fight-club', 'pulp-fiction', 'the-godfather', 'spirited-away',
  'la-la-land', 'get-out-2017', 'mad-max-fury-road', 'interstellar-2014', 'whiplash-2014',
  'the-dark-knight', 'inception', 'everything-everywhere-all-at-once', 'barbie', 'oppenheimer-2023',
  'dune-2021', 'the-shining', 'alien', 'jaws', 'titanic',
  'jurassic-park', 'the-matrix', 'forrest-gump', 'goodfellas', 'seven-samurai',
  '2001-a-space-odyssey', 'in-the-mood-for-love', 'amelie', 'city-of-god', 'spider-man-into-the-spider-verse',
  'toy-story', 'the-lion-king-1994', 'shrek', 'up', 'coco-2017',
  'past-lives', 'anatomy-of-a-fall', 'poor-things-2023', 'the-substance', 'challengers',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseFilm(html, slug) {
  const $ = cheerio.load(html);

  const display = $('meta[property="og:title"]').attr('content') || '';
  const ym = display.match(/\((\d{4})\)\s*$/);
  const name = display.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const year = ym ? parseInt(ym[1], 10) : null;

  let rating = null, ratingCount = null, poster = null;
  const raw = $('script[type="application/ld+json"]').first().html() || '';
  const json = raw.replace(/\/\*\s*<!\[CDATA\[\s*\*\//, '').replace(/\/\*\s*\]\]>\s*\*\//, '').trim();
  if (json) {
    try {
      const ld = JSON.parse(json);
      poster = ld.image || null;
      if (ld.aggregateRating) {
        ratingCount = ld.aggregateRating.ratingCount ?? null;
        rating = ld.aggregateRating.ratingValue ?? null;
      }
    } catch (e) {
      console.log('    JSON-LD illisible pour', slug);
    }
  }

  const neighbours = [];
  $('[data-item-slug]').each((_, el) => {
    const s = $(el).attr('data-item-slug');
    if (s && s !== slug) neighbours.push(s);
  });

  return { film: { slug, name, year, rating, ratingCount, poster }, neighbours };
}

async function fetchFilm(slug) {
  const url = 'https://letterboxd.com/film/' + slug + '/';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(url, { headers: HEADERS });
    if (resp.status === 404) return null;
    if (resp.status === 403 || resp.status === 429) {
      const wait = 30000 * attempt;
      console.log(`    ${resp.status} sur ${slug} — pause ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return parseFilm(await resp.text(), slug);
  }
  return null;
}

(async () => {
  const bySlug = new Map();
  if (fs.existsSync(OUT)) {
    for (const f of JSON.parse(fs.readFileSync(OUT, 'utf8'))) bySlug.set(f.slug, f);
    console.log('Reprise :', bySlug.size, 'films déjà en base');
  }

  let queue;
  if (fs.existsSync(FRONTIER)) {
    queue = JSON.parse(fs.readFileSync(FRONTIER, 'utf8')).concat(SEEDS);
    console.log('Frontière reprise :', queue.length, 'liens à explorer');
  } else if (bySlug.size) {
    // Pas de frontière (fichier supprimé, ou pool d'une version antérieure) :
    // un échantillon de films connus suffit à reconstituer une frontière, sans
    // avoir à refetcher tout le pool avant d'explorer du nouveau.
    const sample = [...bySlug.keys()].sort(() => Math.random() - 0.5).slice(0, 30);
    queue = [...sample, ...SEEDS];
    console.log('Pas de frontière : reconstitution depuis', sample.length, 'films connus');
  } else {
    queue = [...SEEDS];
  }

  const queued = new Set(queue);
  const visited = new Set();

  const save = () => {
    const list = [...bySlug.values()]
      .filter(f => f.ratingCount && f.name && f.poster)
      .sort((a, b) => b.ratingCount - a.ratingCount);
    fs.writeFileSync(OUT, JSON.stringify(list, null, 0));
    fs.writeFileSync(FRONTIER, JSON.stringify(queue.slice(0, 5000)));
    return list.length;
  };

  while (queue.length && bySlug.size < TARGET) {
    const slug = queue.shift();
    if (visited.has(slug)) continue;
    visited.add(slug);

    try {
      const res = await fetchFilm(slug);
      if (!res) {
        console.log(`  ✗ ${slug} (introuvable)`);
      } else {
        bySlug.set(slug, res.film);
        const n = res.film.ratingCount;
        console.log(`  ${String(bySlug.size).padStart(4)}/${TARGET}  ${res.film.name} (${res.film.year}) — ${n ? n.toLocaleString('fr-FR') : '?'} notes`);
        for (const nb of res.neighbours) {
          if (!queued.has(nb)) { queued.add(nb); queue.push(nb); }
        }
      }
    } catch (e) {
      console.log(`  ✗ ${slug} : ${e.message}`);
    }

    if (bySlug.size % 10 === 0) save();
    await sleep(DELAY);
  }

  const kept = save();
  console.log(`\n✅  ${kept} films écrits dans public/films.json (file d'attente restante : ${queue.length})`);
})();
