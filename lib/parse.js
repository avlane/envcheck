'use strict';

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function unquote(value) {
  const q = value[0];
  if (value.length >= 2 && (q === '"' || q === "'") && value.endsWith(q)) return value.slice(1, -1);
  return value;
}

// Returns { entries: [{ key, value, line }], errors: [{ line, message }] }.
// Blank lines and # comments are skipped; anything else that is not an
// assignment is an error.
function parseEnv(text) {
  const entries = [];
  const errors = [];
  text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    const m = LINE.exec(line);
    if (m === null) {
      errors.push({ line: i + 1, message: 'expected KEY=value' });
      return;
    }
    entries.push({ key: m[1], value: unquote(m[2].trim()), line: i + 1 });
  });
  return { entries, errors };
}

// { KEY: value } with later assignments replacing earlier ones.
function toObject(entries) {
  return Object.fromEntries(entries.map(e => [e.key, e.value]));
}

module.exports = { parseEnv, toObject };
