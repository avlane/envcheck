'use strict';

const { parseEnv } = require('./parse');
const { isSecret } = require('./redact');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function guessType(key, value) {
  if (/(^|_)PORT$/i.test(key) && /^\d+$/.test(value)) return 'port';
  if (/^(true|false)$/i.test(value) || /(^|_)(DEBUG|VERBOSE|ENABLED?|DISABLED?)$/i.test(key)) return 'boolean';
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(value)) return 'url';
  if (/EMAIL$/i.test(key) && /@/.test(value)) return 'email';
  if (UUID.test(value)) return 'uuid';
  if (/^[+-]?\d+$/.test(value)) return 'integer';
  if (value.trim() !== '' && Number.isFinite(Number(value))) return 'number';
  if (/^[[{]/.test(value)) {
    try {
      JSON.parse(value);
      return 'json';
    } catch (err) {
      return 'string';
    }
  }
  return 'string';
}

// The comment lines directly above each variable become its description.
function commentsAbove(text, entries) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const found = new Map();
  for (const entry of entries) {
    const parts = [];
    for (let i = entry.line - 2; i >= 0 && /^\s*#/.test(lines[i]); i--) {
      parts.unshift(lines[i].replace(/^\s*#\s?/, '').trim());
    }
    if (parts.length > 0) found.set(entry.key, parts.join(' '));
  }
  return found;
}

// Build a schema object from the text of an example env file.
function inferSchema(text) {
  const { entries } = parseEnv(text);
  const comments = commentsAbove(text, entries);
  const vars = {};
  for (const entry of entries) {
    const type = guessType(entry.key, entry.value);
    const spec = {};
    if (type !== 'string') spec.type = type;
    if (type === 'url') {
      const protocol = /^([a-z][a-z0-9+.-]*):\/\//i.exec(entry.value);
      if (protocol) spec.protocols = [protocol[1].toLowerCase()];
    }
    if (['boolean', 'number', 'integer', 'port'].includes(type) && !isSecret(entry.key)) {
      spec.default = entry.value;
    } else {
      spec.required = true;
    }
    if (isSecret(entry.key) || (type === 'url' && /\/\/[^/\s:@]+:[^/\s@]+@/.test(entry.value))) spec.secret = true;
    if (comments.has(entry.key)) spec.description = comments.get(entry.key);
    vars[entry.key] = spec;
  }
  return { vars };
}

module.exports = { inferSchema, guessType };
