'use strict';

const express = require('express');
const { default: fetch } = require('node-fetch');
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
  if (resp.status === 404) return { films: [], hasNext: false, notFound: true };
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
        return res.status(404).json({ error: 'Profil introuvable ou watchlist privée.' });
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

app.get('/api/seen/:username', async (req, res) => {
  const { username } = req.params;
  const allFilms = [];
  let page = 1;

  try {
    while (page <= 100) {
      const url = 'https://letterboxd.com/' + username + '/films/page/' + page + '/';
      const { films, hasNext, notFound } = await scrapePage(url);
      if (notFound && page === 1) return res.status(404).json({ error: 'Profil introuvable.' });
      allFilms.push(...films);
      if (!hasNext) break;
      page++;
      await new Promise(r => setTimeout(r, 250));
    }
    res.json({ username, count: allFilms.length, films: allFilms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\n✅  Serveur lancé → http://localhost:' + PORT + '\n');
});