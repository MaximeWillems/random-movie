'use strict';

// Critères d'un « bon film peu connu », partagés entre build-gems et find-lists.
// Letterboxd tire la moyenne des films peu notés vers la moyenne générale : les
// films à 4/5 et plus ont donc droit à un plafond de notes plus haut. Au-delà de
// 4 h, c'est presque toujours une minisérie rangée parmi les films.
const RULES = {
  maxRatings: 5000,
  minRating: 3.0,
  topRating: 4.0,
  topMaxRatings: 20000,
  maxRuntime: 240,
  recentYears: 2,
};

// Un film sorti ces deux dernières années a peu de notes parce qu'il est
// récent, pas parce qu'il est méconnu. Calculé à chaque appel : la limite
// avance d'elle-même chaque année.
function isRecent(film) {
  return Boolean(film.year) && film.year > new Date().getFullYear() - RULES.recentYears;
}

function isGem(film) {
  return film.type === 'movie'
    && !isRecent(film)
    && !(film.runtime > RULES.maxRuntime)
    && Boolean(film.ratingCount)
    && ((film.ratingCount < RULES.maxRatings && film.rating >= RULES.minRating)
      || (film.ratingCount < RULES.topMaxRatings && film.rating >= RULES.topRating));
}

module.exports = { RULES, isGem, isRecent };
