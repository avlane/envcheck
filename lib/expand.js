'use strict';

const REFERENCE = /\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

// Replace references in the entries' values. Entries come from parseEnv().
// Returns { entries, problems } where entries have the expanded values.
function expandEntries(entries, env = {}) {
  const defined = new Map();
  const problems = [];
  const expanded = entries.map(entry => {
    if (entry.quote === "'") {
      defined.set(entry.key, entry.value);
      return entry;
    }
    const value = entry.value.replace(REFERENCE, (match, braced, fallback, bare) => {
      if (match === '\\$') return '$';
      const name = braced ?? bare;
      if (defined.has(name)) return defined.get(name);
      if (Object.prototype.hasOwnProperty.call(env, name)) return env[name];
      if (fallback !== undefined) return fallback;
      problems.push({
        level: 'error',
        code: 'undefined-reference',
        key: entry.key,
        line: entry.line,
        message: `refers to ${name}, which is not set before this line`
      });
      return '';
    });
    defined.set(entry.key, value);
    return Object.assign({}, entry, { value });
  });
  return { entries: expanded, problems };
}

module.exports = { expandEntries };
