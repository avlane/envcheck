'use strict';

const LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function unquote(value) {
  const q = value[0];
  if (value.length >= 2 && (q === '"' || q === "'") && value.endsWith(q)) return value.slice(1, -1);
  return value;
}

// Parse KEY=value lines into an object. Blank lines, # comments and lines
// that are not assignments are skipped.
function parseEnv(text) {
  const result = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const m = LINE.exec(trimmed);
    if (m === null) continue;
    result[m[1]] = unquote(m[2].trim());
  }
  return result;
}

module.exports = { parseEnv };
