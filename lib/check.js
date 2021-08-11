'use strict';

const { validateValue } = require('./rules');
const { suggest } = require('./suggest');
const { isSecret, maskUrl } = require('./redact');

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

  // What another variable will be: its value in the file, else its default.
  const valueOf = name => {
    const entry = byKey.get(name);
    if (entry !== undefined) return entry.value;
    return Object.prototype.hasOwnProperty.call(schema.vars, name) ? schema.vars[name].default : undefined;
  };

  // null when the variable is optional, otherwise the reason as text:
  // '' for required, ' when X is "y"' for requiredIf.
  const requirement = spec => {
    if (spec.required) return '';
    if (spec.requiredIf === undefined) return null;
    const reasons = [];
    for (const [other, expected] of Object.entries(spec.requiredIf)) {
      const actual = valueOf(other);
      const met = expected === true ? actual !== undefined && actual !== '' : [].concat(expected).includes(actual);
      if (!met) return null;
      reasons.push(expected === true ? `${other} is set` : `${other} is "${actual}"`);
    }
    return ` when ${reasons.join(' and ')}`;
  };

  for (const [key, spec] of Object.entries(schema.vars)) {
    const entry = byKey.get(key);
    const need = requirement(spec);
    if (entry === undefined) {
      if (spec.default !== undefined) continue;
      if (need !== null) {
        const typo = suggest(key, unknown);
        const hint = typo === null ? '' : ` (${typo} is set, is that a typo?)`;
        problems.push(issue('error', 'missing', key, null, `is required${need} but missing${hint}`));
      }
      continue;
    }
    if (entry.value === '') {
      if (need !== null) problems.push(issue('error', 'empty', key, entry.line, `is required${need} but empty`));
      continue;
    }
    const message = validateValue(entry.value, spec);
    if (message !== null) {
      const got = isSecret(key, spec) ? '' : ` (got "${maskUrl(entry.value)}")`;
      problems.push(issue('error', 'invalid', key, entry.line, message + got));
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

// Turn parseEnv() errors into problems so they can be listed with the rest.
function syntaxProblems(errors) {
  return errors.map(e => issue('error', 'syntax', '', e.line, e.message));
}

module.exports = { check, issue, byLocation, syntaxProblems };
