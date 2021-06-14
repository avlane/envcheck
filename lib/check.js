'use strict';

const { validateValue } = require('./rules');
const { suggest } = require('./suggest');

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
// Variables the schema does not mention are warnings, or errors with opts.strict,
// unless the schema says allowUnknown.
function check(entries, schema, opts = {}) {
  const problems = [];
  const byKey = new Map(entries.map(e => [e.key, e]));
  const known = new Set(Object.keys(schema.vars));
  const unknown = [...byKey.keys()].filter(key => !known.has(key));
  for (const [key, spec] of Object.entries(schema.vars)) {
    const entry = byKey.get(key);
    if (entry === undefined) {
      if (spec.default !== undefined) continue;
      if (spec.required) {
        const typo = suggest(key, unknown);
        const hint = typo === null ? '' : ` (${typo} is set, is that a typo?)`;
        problems.push(issue('error', 'missing', key, null, `is required but missing${hint}`));
      }
      continue;
    }
    if (entry.value === '') {
      if (spec.required) problems.push(issue('error', 'empty', key, entry.line, 'is required but empty'));
      continue;
    }
    const message = validateValue(entry.value, spec);
    if (message !== null) {
      problems.push(issue('error', 'invalid', key, entry.line, `${message} (got "${entry.value}")`));
    }
  }
  if (schema.allowUnknown !== true) {
    for (const key of unknown) {
      const typo = suggest(key, [...known].filter(k => !byKey.has(k)));
      const hint = typo === null ? '' : ` (did you mean ${typo}?)`;
      problems.push(issue(opts.strict ? 'error' : 'warning', 'unknown', key, byKey.get(key).line, `is not in the schema${hint}`));
    }
  }
  return problems.sort(byLocation);
}

module.exports = { check, issue, byLocation };
