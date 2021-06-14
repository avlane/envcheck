'use strict';

// Levenshtein distance between two strings.
function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

// The candidate closest to word (ignoring case), or null if nothing is close
// enough to be a plausible typo. Ties go to the earlier candidate.
function suggest(word, candidates) {
  const limit = Math.min(3, Math.floor(word.length / 4));
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(word.toLowerCase(), candidate.toLowerCase());
    if (d <= limit && d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}

module.exports = { distance, suggest };
