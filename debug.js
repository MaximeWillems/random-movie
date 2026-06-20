'use strict';

const { default: fetch } = require('node-fetch');
const cheerio = require('cheerio');

const username = process.argv[2] || 'dave';

async function debug() {
  const url = `https://letterboxd.com/${username}/watchlist/page/1/`;
  console.log('Fetching:', url);

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }
  });

  console.log('Status:', resp.status);
  const html = await resp.text();
  console.log('HTML length:', html.length, 'chars');

  const $ = cheerio.load(html);

  // Try various selectors
  console.log('\n--- Sélecteurs testés ---');
  console.log('li.poster-container        :', $('li.poster-container').length);
  console.log('[data-film-slug]           :', $('[data-film-slug]').length);
  console.log('.film-poster               :', $('.film-poster').length);
  console.log('ul.poster-list li          :', $('ul.poster-list li').length);
  console.log('[data-target-link]         :', $('[data-target-link]').length);
  console.log('.poster                    :', $('.poster').length);
  console.log('div[data-film-id]          :', $('div[data-film-id]').length);
  console.log('[data-type="film"]         :', $('[data-type="film"]').length);

  // Print first 3000 chars to see structure
  console.log('\n--- Début du HTML ---');
  console.log(html.slice(0, 3000));

  // Find any data- attributes on divs/lis
  console.log('\n--- Premiers éléments avec data-film-* ---');
  let found = 0;
  $('[class]').each((i, el) => {
    const attrs = Object.keys(el.attribs || {}).filter(a => a.startsWith('data-film'));
    if (attrs.length && found < 5) {
      console.log('Tag:', el.tagName, '| Classes:', el.attribs.class, '| Data:', attrs.map(a => `${a}="${el.attribs[a]}"`).join(', '));
      found++;
    }
  });
}

debug().catch(console.error);
