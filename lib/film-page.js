'use strict';

const cheerio = require('cheerio');

// Page /film/{slug}/ : og:title donne le titre et l'année, le bloc JSON-LD le
// reste (notes, moyenne, poster, durée, équipe). Cette page n'est pas bloquée
// par Cloudflare, contrairement à /films/ ou aux endpoints /csi/.
function parseFilmPage(html, slug) {
  const $ = cheerio.load(html);

  const display = $('meta[property="og:title"]').attr('content') || '';
  const ym = display.match(/\((\d{4})\)\s*$/);
  const tmdb = $('[data-tmdb-id]').first().attr('data-tmdb-id');

  const film = {
    slug,
    name: display.replace(/\s*\(\d{4}\)\s*$/, '').trim(),
    year: ym ? parseInt(ym[1], 10) : null,
    rating: null,
    ratingCount: null,
    poster: null,
    runtime: null,
    tmdbId: tmdb ? parseInt(tmdb, 10) : null,
    // Letterboxd référence aussi quelques séries : data-tmdb-id est alors vide
    // et le lien TMDB pointe vers /tv/.
    type: /themoviedb\.org\/tv\/\d+/.test(html) ? 'tv' : 'movie',
    directors: [],
  };
  const people = { directors: [], actors: [] };

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

      const d = String(ld.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (d && (d[1] || d[2])) film.runtime = parseInt(d[1] || 0, 10) * 60 + parseInt(d[2] || 0, 10);

      const directors = [].concat(ld.director || []);
      film.directors = directors.map(p => p.name).filter(Boolean);
      people.directors = directors.map(p => personPath(p.sameAs)).filter(Boolean);
      people.actors = [].concat(ld.actor || []).map(p => personPath(p.sameAs)).filter(Boolean);
    } catch (e) {
      // JSON-LD absent ou malformé : on renvoie ce qu'on a
    }
  }

  const neighbours = [];
  $('[data-item-slug]').each((_, el) => {
    const s = $(el).attr('data-item-slug');
    if (s && s !== slug && !neighbours.includes(s)) neighbours.push(s);
  });

  return { film, people, neighbours };
}

function personPath(url) {
  const m = String(url || '').match(/letterboxd\.com(\/(?:director|actor)\/[^\/]+\/)/);
  return m ? m[1] : null;
}

module.exports = { parseFilmPage };
