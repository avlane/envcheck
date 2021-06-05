'use strict';

const { TYPE_NAMES } = require('./types');
const { validateValue } = require('./rules');

class SchemaError extends Error {}

const SPEC_KEYS = [
  'type', 'required', 'description', 'values', 'protocols',
  'pattern', 'min', 'max', 'minLength', 'maxLength', 'default'
];
const NUMERIC_TYPES = ['number', 'integer', 'port'];

function expect(key, name, ok, what) {
  if (!ok) throw new SchemaError(`${key}: "${name}" must be ${what}`);
}

const isStringList = v => Array.isArray(v) && v.length > 0 && v.every(item => typeof item === 'string');

// Throws a SchemaError describing the first thing wrong with one entry.
function checkSpec(key, spec) {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new SchemaError(`${key}: the definition must be an object`);
  }
  for (const name of Object.keys(spec)) {
    if (!SPEC_KEYS.includes(name)) throw new SchemaError(`${key}: unknown property "${name}"`);
  }
  const type = spec.type ?? 'string';
  if (!TYPE_NAMES.includes(type)) {
    throw new SchemaError(`${key}: unknown type "${type}" (use ${TYPE_NAMES.join(', ')})`);
  }
  if (spec.required !== undefined) expect(key, 'required', typeof spec.required === 'boolean', 'true or false');
  if (spec.description !== undefined) expect(key, 'description', typeof spec.description === 'string', 'text');
  if (type === 'enum') {
    expect(key, 'values', isStringList(spec.values), 'a non-empty list of strings');
  } else if (spec.values !== undefined) {
    throw new SchemaError(`${key}: "values" only applies to type "enum"`);
  }
  if (spec.protocols !== undefined) {
    if (type !== 'url') throw new SchemaError(`${key}: "protocols" only applies to type "url"`);
    expect(key, 'protocols', isStringList(spec.protocols), 'a non-empty list of strings');
  }
  if (spec.pattern !== undefined) {
    expect(key, 'pattern', typeof spec.pattern === 'string', 'a regular expression string');
    try {
      new RegExp(spec.pattern);
    } catch (err) {
      throw new SchemaError(`${key}: "pattern" is not a valid regular expression: ${err.message}`);
    }
  }
  for (const name of ['min', 'max']) {
    if (spec[name] === undefined) continue;
    if (!NUMERIC_TYPES.includes(type)) {
      throw new SchemaError(`${key}: "${name}" only applies to number, integer and port`);
    }
    expect(key, name, typeof spec[name] === 'number' && Number.isFinite(spec[name]), 'a number');
  }
  for (const name of ['minLength', 'maxLength']) {
    if (spec[name] !== undefined) expect(key, name, Number.isInteger(spec[name]) && spec[name] >= 0, 'a whole number');
  }
  if (spec.min > spec.max) throw new SchemaError(`${key}: "min" is greater than "max"`);
  if (spec.minLength > spec.maxLength) throw new SchemaError(`${key}: "minLength" is greater than "maxLength"`);
  if (spec.default !== undefined) {
    expect(key, 'default', typeof spec.default === 'string', 'text (environment values are strings)');
    if (spec.required) throw new SchemaError(`${key}: a variable with a default cannot also be required`);
    const message = validateValue(spec.default, spec);
    if (message !== null) throw new SchemaError(`${key}: the default "${spec.default}" ${message}`);
  }
}

function normalizeSchema(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SchemaError('the schema must be a JSON object');
  }
  if (raw.vars === null || typeof raw.vars !== 'object' || Array.isArray(raw.vars)) {
    throw new SchemaError('the schema needs a "vars" object');
  }
  for (const [key, spec] of Object.entries(raw.vars)) checkSpec(key, spec);
  return { vars: raw.vars };
}

function parseSchema(text, name = 'schema') {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new SchemaError(`${name} is not valid JSON: ${err.message}`);
  }
  return normalizeSchema(raw);
}

module.exports = { SchemaError, normalizeSchema, parseSchema };
