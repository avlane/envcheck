'use strict';

const { parseEnv } = require('./parse');
const { byLocation } = require('./check');

function warn(code, key, line, message) {
  return { level: 'warning', code, key, line, message };
}

const SPACED_EQUALS = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*(?:\s+=|=\s)/;

// Style problems in the text of a .env file. Pass the parse result if you
// already have it.
function lint(text, parsed = parseEnv(text)) {
  const problems = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  if (text.charCodeAt(0) === 0xFEFF) {
    problems.push(warn('bom', '', 1, 'the file starts with a byte order mark'));
  }
  const firstSeen = new Map();
  for (const entry of parsed.entries) {
    const raw = lines[entry.line - 1];
    if (firstSeen.has(entry.key)) {
      problems.push(warn('duplicate-key', entry.key, entry.line,
        `is already set on line ${firstSeen.get(entry.key)}; the last assignment wins`));
    } else {
      firstSeen.set(entry.key, entry.line);
    }
    if (entry.key !== entry.key.toUpperCase()) {
      problems.push(warn('lowercase-key', entry.key, entry.line, 'should be UPPER_CASE'));
    }
    if (SPACED_EQUALS.test(raw)) {
      problems.push(warn('space-around-equals', entry.key, entry.line, 'has spaces around the equals sign'));
    }
    if (/\s$/.test(raw)) {
      problems.push(warn('trailing-space', entry.key, entry.line, 'the line ends with whitespace'));
    }
  }
  if (text.length > 0 && text.at(-1) !== '\n') {
    problems.push(warn('no-final-newline', '', lines.length, 'the file does not end with a newline'));
  }
  return problems.sort(byLocation);
}

module.exports = { lint };
