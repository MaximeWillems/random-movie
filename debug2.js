'use strict';
const { default: fetch } = require('node-fetch');
const cheerio = require('cheerio');

async function debug() {
  const url = 'https://letterboxd.com/cyrilwillems/watchlist/page/1/';
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    }
  });
  const html = await resp.text();
  const $ = cheerio.load(html);

  // Show first 3 elements with data-target-link
  $('[data-target-link]').slice(0, 3).each((i, el) => {
    console.log('\n--- Element', i, '---');
    console.log('Tag:', el.tagName);
    console.log('Attrs:', JSON.stringify(el.attribs, null, 2));
    console.log('Inner HTML (first 300):', $(el).html()?.slice(0, 300));
  });
}
debug().catch(console.error);