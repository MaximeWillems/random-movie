'use strict';

/**
 * Prépare tools/a-relever.json : les films dont la moyenne et le nombre de
 * notes Letterboxd sont à relever à la main, dans la page tools/saisie.html.
 *
 * - Duel : 150 films répartis du plus noté au moins noté
 * - Films peu connus : les 120 mieux notés et 30 courts métrages
 *
 * Aucun chiffre Letterboxd n'est recopié dans la liste : la saisie part de
 * zéro. Titre, année, affiche et durée viennent de TMDB.
 *
 * Usage : node scripts/liste-a-relever.js
 */

const fs = require('fs');
const path = require('path');

const KEY = '8265bd1679663a7ea12ac168da84d2e8';
const ROOT = path.join(__dirname, '..');
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

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'public', f), 'utf8'));
const pick = f => ({ slug: f.slug, name: f.name, year: f.year, tmdbId: f.tmdbId, posterPath: f.posterPath || null });

(async () => {
  // Duel : 150 films pris à intervalles réguliers dans le classement actuel
  const pool = read('films.json').sort((a, b) => b.ratingCount - a.ratingCount);
  const duel = [];
  for (let j = 0; j < 150; j++) duel.push(pick(pool[Math.round(j * (pool.length - 1) / 149)]));

  // Films peu connus : durée TMDB, pour le choix « courts / longs » du site
  const gems = read('gems.json').sort((a, b) => b.rating - a.rating);
  for (let i = 0; i < gems.length; i += 5) {
    await Promise.all(gems.slice(i, i + 5).map(async g => {
      const d = await tmdb(`/movie/${g.tmdbId}`);
      g.tmdbRuntime = d ? d.runtime || null : null;
    }));
    process.stdout.write(`\rDurées TMDB : ${Math.min(i + 5, gems.length)}/${gems.length}`);
  }
  const shorts = gems.filter(g => g.tmdbRuntime && g.tmdbRuntime <= 40).slice(0, 30);
  const longs = gems.filter(g => !shorts.includes(g)).slice(0, 150 - shorts.length);
  const gemList = [...longs, ...shorts].map(g => ({ ...pick(g), runtime: g.tmdbRuntime }));

  const out = { duel, gems: gemList };
  fs.mkdirSync(path.join(ROOT, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'tools', 'a-relever.json'), JSON.stringify(out));
  console.log(`\nDuel : ${duel.length} films, films peu connus : ${gemList.length} (dont ${shorts.length} courts)`);
})();
