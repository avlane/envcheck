'use strict';

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

const ESCAPES = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };

// Read a quoted value from the text after its opening quote. Returns
// { value, rest } or null when the closing quote is missing.
function readQuoted(quote, text) {
  let value = '';
  for (let p = 0; p < text.length; p++) {
    const c = text[p];
    if (quote === '"' && c === '\\' && p + 1 < text.length) {
      value += ESCAPES[text[p + 1]] ?? c + text[p + 1];
      p++;
    } else if (c === quote) {
      return { value, rest: text.slice(p + 1) };
    } else {
      value += c;
    }
  }
  return null;
}

// Returns { entries: [{ key, value, line, quote }], errors: [{ line, message }] }.
// Blank lines and # comments are skipped; anything else that is not an
// assignment is an error. quote is '"', "'" or null.
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
    const raw = m[2];
    const entry = { key: m[1], value: '', line: i + 1, quote: null };
    if (raw[0] === '"' || raw[0] === "'") {
      const quoted = readQuoted(raw[0], raw.slice(1));
      if (quoted === null) {
        errors.push({ line: i + 1, message: `unterminated ${raw[0]} quote` });
        return;
      }
      const after = quoted.rest.trim();
      if (after !== '' && !after.startsWith('#')) {
        errors.push({ line: i + 1, message: 'unexpected text after the closing quote' });
      }
      entry.value = quoted.value;
      entry.quote = raw[0];
    } else {
      entry.value = raw.startsWith('#') ? '' : raw.replace(/\s+#.*$/, '').trim();
    }
    entries.push(entry);
  });
  return { entries, errors };
}

// { KEY: value } with later assignments replacing earlier ones.
function toObject(entries) {
  return Object.fromEntries(entries.map(e => [e.key, e.value]));
}

module.exports = { parseEnv, toObject };
