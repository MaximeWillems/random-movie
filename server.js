'use strict';

const express = require('express');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function extractYear(fullName) {
  const match = fullName && fullName.match(/\((\d{4})\)$/);
  return match ? match[1] : '';
}

async function scrapePage(url) {
  const resp = await fetch(url, { headers: HEADERS });
  // Un profil inexistant ne renvoie plus 404 : Cloudflare intercepte et
  // répond 403. Même traitement dans les deux cas.
  if (resp.status === 404 || resp.status === 403) return { films: [], hasNext: false, notFound: true };
  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  const html = await resp.text();
  const $ = cheerio.load(html);
  const films = [];

  // New Letterboxd structure: div.react-component[data-item-slug]
  $('[data-item-slug]').each((_, el) => {
    const slug = $(el).attr('data-item-slug');
    const name = $(el).attr('data-item-name') || slug;
    const fullName = $(el).attr('data-item-full-display-name') || name;
    const year = extractYear(fullName);
    if (slug && !films.find(f => f.slug === slug)) {
      films.push({ slug, name: name.replace(/\s*\(\d{4}\)$/, ''), year });
    }
  });

  console.log('  URL:', url, '| Films:', films.length);
  const hasNext = $('a.next').length > 0;
  return { films, hasNext };
}

app.get('/api/watchlist/:username', async (req, res) => {
  const { username } = req.params;
  const allFilms = [];
  let page = 1;

  try {
    while (page <= 50) {
      const url = 'https://letterboxd.com/' + username + '/watchlist/page/' + page + '/';
      const { films, hasNext, notFound } = await scrapePage(url);

      if (notFound && page === 1) {
        return res.status(404).json({ error: 'Profil introuvable, watchlist privée, ou accès temporairement bloqué par Letterboxd.' });
      }

      allFilms.push(...films);
      if (!hasNext) break;
      page++;
      await new Promise(r => setTimeout(r, 250));
    }

    res.json({ username, count: allFilms.length, films: allFilms });
  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: 'Erreur : ' + err.message });
  }
});

function decodeEntities(text) {
  return cheerio.load('<x>' + text + '</x>').text();
}

// Le flux RSS liste les 50 derniers visionnages. Il complète /films/, qui est
// trié par date de sortie : le RSS y ajoute les films plus anciens revus
// récemment.
async function scrapeRss(username) {
  const resp = await fetch('https://letterboxd.com/' + username + '/rss/', { headers: HEADERS });
  if (!resp.ok) return [];

  const films = [];
  for (const match of (await resp.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = item.match(/<letterboxd:filmTitle>([\s\S]*?)<\/letterboxd:filmTitle>/);
    const link = item.match(/letterboxd\.com\/[^\/]+\/film\/([a-z0-9-]+)\//);
    if (!title || !link) continue;

    const year = item.match(/<letterboxd:filmYear>(\d{4})<\/letterboxd:filmYear>/);
    films.push({ slug: link[1], name: decodeEntities(title[1]), year: year ? year[1] : '' });
  }
  return films;
}

// Films vus. Letterboxd bloque /{user}/films/page/N/ (403), mais laisse passer
// /{user}/films/ : on récupère donc la première page seulement, complétée par
// le RSS. Une centaine de films au total, pas l'historique complet.
app.get('/api/seen/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const { films, notFound } = await scrapePage('https://letterboxd.com/' + username + '/films/');
    if (notFound) {
      return res.status(404).json({ error: 'Profil introuvable, films masqués, ou accès temporairement bloqué par Letterboxd.' });
    }

    const bySlug = new Map();
    for (const f of films) bySlug.set(f.slug, f);
    for (const f of await scrapeRss(username)) {
      if (!bySlug.has(f.slug)) bySlug.set(f.slug, f);
    }

    const all = [...bySlug.values()];
    res.json({ username, count: all.length, films: all, partial: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Mode duel : popularité d'un film ---
// La page /film/{slug}/ expose un bloc JSON-LD contenant le nombre de notes
// (ratingCount), la note moyenne et le poster. Contrairement à /films/popular/
// ou /{user}/films/, cette page n'est pas bloquée par Cloudflare.

const filmCache = new Map();
const FILM_TTL = 24 * 60 * 60 * 1000;

function parseFilmPage(html, slug) {
  const $ = cheerio.load(html);

  const display = $('meta[property="og:title"]').attr('content') || '';
  const ym = display.match(/\((\d{4})\)\s*$/);

  const film = {
    slug,
    name: display.replace(/\s*\(\d{4}\)\s*$/, '').trim(),
    year: ym ? parseInt(ym[1], 10) : null,
    rating: null,
    ratingCount: null,
    poster: null,
  };

  const raw = $('script[type="application/ld+json"]').first().html() || '';
  const json = raw.replace(/\/\*\s*<!\[CDATA\[\s*\*\//, '').replace(/\/\*\s*\]\]>\s*\*\//, '').trim();
  if (json) {
    try {
      const ld = JSON.parse(json);
      film.poster = ld.image || null;
      if (ld.aggregateRating) {
        film.ratingCount = ld.aggregateRating.ratingCount ?? null;
        film.rating = ld.aggregateRating.ratingValue ?? null;
      }
    } catch (e) {
      // JSON-LD absent ou malformé : on renvoie ce qu'on a
    }
  }

  return film;
}

async function fetchFilmMeta(slug) {
  const hit = filmCache.get(slug);
  if (hit && Date.now() - hit.ts < FILM_TTL) return hit.film;

  const resp = await fetch('https://letterboxd.com/film/' + slug + '/', { headers: HEADERS });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);

  const film = parseFilmPage(await resp.text(), slug);
  filmCache.set(slug, { film, ts: Date.now() });
  return film;
}

app.get('/api/film/:slug', async (req, res) => {
  try {
    res.json(await fetchFilmMeta(req.params.slug));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Résout un lot de slugs. Le front l'appelle pour compléter le pool d'une
// watchlist avec les films absents de public/films.json.
app.get('/api/films', async (req, res) => {
  const slugs = String(req.query.slugs || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!slugs.length) return res.json({ films: [] });

  const films = [];
  const queue = [...slugs];

  async function worker() {
    while (queue.length) {
      const slug = queue.shift();
      try {
        const film = await fetchFilmMeta(slug);
        if (film.ratingCount) films.push(film);
      } catch (e) {
        // film indisponible : on l'ignore, le pool se remplira avec les autres
      }
    }
  }

  await Promise.all([worker(), worker(), worker()]);
  res.json({ films });
});

app.listen(PORT, () => {
  console.log('\n✅  Serveur lancé → http://localhost:' + PORT + '\n');
});