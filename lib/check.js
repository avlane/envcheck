'use strict';

function issue(level, code, key, line, message) {
  return { level, code, key, line, message };
}

// Order by line (problems without a line, such as missing variables, last), then key.
function byLocation(a, b) {
  const la = a.line ?? Infinity;
  const lb = b.line ?? Infinity;
  if (la !== lb) return la < lb ? -1 : 1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

// entries come from parseEnv(); returns a list of { level, code, key, line, message }.
function check(entries, schema) {
  const problems = [];
  const byKey = new Map(entries.map(e => [e.key, e]));
  for (const [key, spec] of Object.entries(schema.vars)) {
    const entry = byKey.get(key);
    if (entry === undefined) {
      if (spec.required) problems.push(issue('error', 'missing', key, null, 'is required but missing'));
    } else if (entry.value === '' && spec.required) {
      problems.push(issue('error', 'empty', key, entry.line, 'is required but empty'));
    }
  }
  return problems.sort(byLocation);
}

module.exports = { check, issue, byLocation };
