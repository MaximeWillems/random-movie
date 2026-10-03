// Langue de la page : /en en anglais, sinon français. Le HTML est écrit en
// français ; en anglais, ses textes marqués data-i18n sont remplacés au
// chargement. Les textes créés par le script passent tous par t().
const LANG = /^\/en\/?$/.test(location.pathname) ? 'en' : 'fr';
document.documentElement.lang = LANG;

const nf = new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'fr-FR');
// Archivo n'a pas l'espace fine du format français : espace insécable classique à la place.
const num = n => nf.format(n).replace(/ /g, ' ');
// Décimales : virgule en français, point en anglais
const fmtDec = (v, digits) => (LANG === 'en' ? v.toFixed(digits) : v.toFixed(digits).replace('.', ','));
const plural = (n, word) => word + (n > 1 ? 's' : '');

const TEXTS = {
  // Textes créés par le script, dans les deux langues
  fr: {
    themeDark: 'Mode sombre',
    themeLight: 'Mode clair',
    posterAlt: name => 'Affiche de ' + name,
    fileUnreadable: 'Fichier illisible.',
    zipUnreadable: 'Ce ZIP est illisible.',
    notExport: 'Ni watched.csv ni watchlist.csv : est-ce bien l’export Letterboxd ?',
    memberNum: 'N° ',
    memberStats: (seen, wl) => `${num(seen)} ${plural(seen, 'film')} ${plural(seen, 'vu')} · ${num(wl)} en watchlist`,
    watchlistOf: 'Watchlist de ',
    filmsCount: n => ` · ${num(n)} ${plural(n, 'film')}`,
    watchlistEmpty: 'Watchlist vide dans cet export.',
    seenSkipped: n => `${n} déjà ${plural(n, 'vu')} ${plural(n, 'écarté')}`,
    exportRequired: 'Export Letterboxd requis',
    bestTab: n => 'record ' + n,
    allSeen: 'Tu as déjà vu tous les films de cette sélection.',
    notReleased: 'Les derniers films tirés ne sont pas encore sortis.',
    noFilm: 'Aucun film avec ces filtres.',
    gemsUnavailable: 'Sélection indisponible.',
    drawFailed: 'Tirage impossible.',
    stubDraw: 'Tirage',
    stubRating: 'Moyenne',
    stubVotes: 'Votes',
    stubGenres: 'Genres',
    runtime: (h, m) => `${h} h ${m}`,
    shortFilm: ', court métrage',
    whereToWatch: 'Où le voir',
    noOffer: 'Aucune offre en Belgique ni en France.',
    offersBy: 'Offres : ',
    streaming: c => 'streaming, ' + c,
    rent: c => 'location, ' + c,
    freeCopy: 'libre de droits',
    search: 'chercher',
    page: 'fiche',
    seeAll: n => `Tout voir (${n})`,
    popularUnavailable: 'Films populaires indisponibles.',
    filmsUnavailable: 'Films indisponibles.',
    loading: 'Chargement…',
    notEnoughMine: (seen, total) => `Pas assez de ${seen ? 'films vus' : 'films de ta watchlist'} parmi les ${num(total)} films du duel.`,
    notEnoughDuel: 'Pas assez de films pour un duel.',
    yourPick: 'Ton choix',
    mostPopular: 'Le plus populaire',
    verdictRecord: 'Record.',
    verdictOk: 'Bien vu.',
    verdictKo: 'Raté.',
    verdict: (a, times, b) => `${a} est ${times} fois plus populaire que ${b}.`,
    onLetterboxd: 'Sur Letterboxd : ',
  },

  // Anglais : textes du script, puis textes du HTML (data-i18n)
  en: {
    themeDark: 'Dark mode',
    themeLight: 'Light mode',
    posterAlt: name => 'Poster for ' + name,
    fileUnreadable: 'Unreadable file.',
    zipUnreadable: 'This ZIP cannot be read.',
    notExport: 'No watched.csv or watchlist.csv: is this really a Letterboxd export?',
    memberNum: 'No. ',
    memberStats: (seen, wl) => `${num(seen)} ${plural(seen, 'film')} watched · ${num(wl)} in watchlist`,
    watchlistOf: 'Watchlist of ',
    filmsCount: n => ` · ${num(n)} ${plural(n, 'film')}`,
    watchlistEmpty: 'The watchlist in this export is empty.',
    seenSkipped: n => `${n} already watched, left out`,
    exportRequired: 'Letterboxd export required',
    bestTab: n => 'best ' + n,
    allSeen: 'You have already watched every film in this selection.',
    notReleased: 'The last films drawn are not out yet.',
    noFilm: 'No film matches these filters.',
    gemsUnavailable: 'Selection unavailable.',
    drawFailed: 'Could not draw a film.',
    stubDraw: 'Draw',
    stubRating: 'Rating',
    stubVotes: 'Votes',
    stubGenres: 'Genres',
    runtime: (h, m) => `${h}h ${m}m`,
    shortFilm: ', short film',
    whereToWatch: 'Where to watch',
    noOffer: 'No streaming or rental offer in the US or the UK.',
    offersBy: 'Offers: ',
    streaming: c => 'streaming, ' + c,
    rent: c => 'rent or buy, ' + c,
    freeCopy: 'free to watch',
    search: 'search',
    page: 'page',
    seeAll: n => `See all (${n})`,
    popularUnavailable: 'Popular films unavailable.',
    filmsUnavailable: 'Films unavailable.',
    loading: 'Loading…',
    notEnoughMine: (seen, total) => `Not enough ${seen ? 'watched films' : 'films from your watchlist'} among the ${num(total)} duel films.`,
    notEnoughDuel: 'Not enough films for a duel.',
    yourPick: 'Your pick',
    mostPopular: 'Most popular',
    verdictRecord: 'New best.',
    verdictOk: 'Spot on.',
    verdictKo: 'Missed.',
    verdict: (a, times, b) => `${a} is ${times} times more popular than ${b}.`,
    onLetterboxd: 'On Letterboxd: ',

    pageTitle: 'Séance 404 — lesser-known films to discover and a popularity duel',
    pageDesc: 'Draw a random lesser-known but highly rated film, or a film from your Letterboxd watchlist, with its synopsis and where to watch it legally. And a duel: which of two films is more popular?',
    lang: 'Français',
    logoHome: 'Séance 404, home',
    homeIntro: 'The show is about to start: grab your ticket and pick your screen.',
    screen: 'Screen',
    room1Title: 'Find a film',
    room1Text: 'A film drawn at random from lesser-known but well-rated films, or from your watchlist. With its rating, synopsis and where to watch it.',
    drawBtn: 'Draw a film',
    room2Title: 'Duel',
    room2Text: 'Guess which film is more popular.',
    play: 'Play',
    importLabel: 'Letterboxd profile',
    importBtn: 'Import my export',
    importHelp: '<a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">Export my data</a> on Letterboxd, then import the ZIP. It stays in your browser.',
    memberCard: 'Member card',
    reimport: 'update',
    forget: 'remove',
    tabFind: 'Find a film',
    tabDuel: 'Duel',
    optIn: 'In',
    optWatchlist: 'my watchlist',
    optGems: 'lesser-known films',
    optRating: 'Rating',
    optAllRatings: 'all',
    opt7: '7/10 and up',
    opt75: '7.5/10 and up',
    optLength: 'Length',
    optAnyLength: 'any',
    optShort: 'shorts',
    optLong: 'features',
    histLabel: 'Already drawn',
    histClear: 'clear',
    duelFilms: 'Films',
    duelPopular: 'popular',
    duelSeen: 'I have watched',
    duelWatchlist: 'from my watchlist',
    streak: 'Streak',
    best: 'Best',
    duelQuestion: 'Which one is more popular?',
    nextDuel: 'Next duel',
    footTmdb: 'This site uses the TMDB API but is not endorsed or certified by TMDB. Watch offers: <a href="https://www.justwatch.com/" target="_blank" rel="noopener">JustWatch</a>.',
    footLetterboxd: 'Séance 404 is not affiliated with Letterboxd.',
    about: 'About',
  },
};

function t(key, ...args) {
  const v = key in TEXTS[LANG] ? TEXTS[LANG][key] : TEXTS.fr[key];
  return typeof v === 'function' ? v(...args) : v;
}

// En anglais : textes du HTML, titre, description, lien de langue et À propos
function translatePage() {
  const toggle = document.getElementById('langToggle');
  toggle.addEventListener('click', () => {
    toggle.href = toggle.getAttribute('href').split('#')[0] + location.hash;
  });
  if (LANG === 'fr') return;

  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-html]')) node.innerHTML = t(node.dataset.i18nHtml);
  document.title = t('pageTitle');
  document.querySelector('meta[name="description"]').content = t('pageDesc');

  toggle.textContent = t('lang');
  toggle.href = '/';
  toggle.hreflang = toggle.lang = 'fr';
  document.getElementById('aboutLink').href = '/en/about';
}
