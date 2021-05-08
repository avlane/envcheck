'use strict';

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

const ESCAPES = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };

// Read a quoted value that starts right after its opening quote on lines[index]
// and may continue on the following lines. Returns { value, rest, endIndex }
// or null when the closing quote is missing.
function readQuoted(quote, text, lines, index) {
  let value = '';
  let current = text;
  let i = index;
  for (;;) {
    for (let p = 0; p < current.length; p++) {
      const c = current[p];
      if (quote === '"' && c === '\\' && p + 1 < current.length) {
        value += ESCAPES[current[p + 1]] ?? c + current[p + 1];
        p++;
      } else if (c === quote) {
        return { value, rest: current.slice(p + 1), endIndex: i };
      } else {
        value += c;
      }
    }
    i++;
    if (i >= lines.length) return null;
    value += '\n';
    current = lines[i];
  }
}

// Returns { entries: [{ key, value, line, quote }], errors: [{ line, message }] }.
// Blank lines and # comments are skipped; anything else that is not an
// assignment is an error. quote is '"', "'" or null.
function parseEnv(text) {
  const entries = [];
  const errors = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const m = LINE.exec(lines[i]);
    if (m === null) {
      errors.push({ line: i + 1, message: 'expected KEY=value' });
      continue;
    }
    const raw = m[2];
    const entry = { key: m[1], value: '', line: i + 1, quote: null };
    if (raw[0] === '"' || raw[0] === "'") {
      const quoted = readQuoted(raw[0], raw.slice(1), lines, i);
      if (quoted === null) {
        errors.push({ line: i + 1, message: `unterminated ${raw[0]} quote` });
        break; // the rest of the file would have been swallowed by the value
      }
      const after = quoted.rest.trim();
      if (after !== '' && !after.startsWith('#')) {
        errors.push({ line: quoted.endIndex + 1, message: 'unexpected text after the closing quote' });
      }
      entry.value = quoted.value;
      entry.quote = raw[0];
      i = quoted.endIndex;
    } else {
      entry.value = raw.startsWith('#') ? '' : raw.replace(/\s+#.*$/, '').trim();
    }
    entries.push(entry);
  }
  return { entries, errors };
}

// { KEY: value } with later assignments replacing earlier ones.
function toObject(entries) {
  return Object.fromEntries(entries.map(e => [e.key, e.value]));
}

module.exports = { parseEnv, toObject };
