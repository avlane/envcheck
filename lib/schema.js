'use strict';

const { TYPE_NAMES } = require('./types');
const { validateValue } = require('./rules');

class SchemaError extends Error {}

const SPEC_KEYS = [
  'type', 'required', 'description', 'values', 'protocols',
  'pattern', 'min', 'max', 'minLength', 'maxLength', 'default', 'secret', 'requiredIf', 'deprecated'
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
  if (spec.secret !== undefined) expect(key, 'secret', typeof spec.secret === 'boolean', 'true or false');
  if (spec.deprecated !== undefined) {
    expect(key, 'deprecated', typeof spec.deprecated === 'string' && spec.deprecated.trim() !== '', 'a non-empty message');
  }
  if (spec.requiredIf !== undefined) {
    const condition = spec.requiredIf;
    if (condition === null || typeof condition !== 'object' || Array.isArray(condition) || Object.keys(condition).length === 0) {
      throw new SchemaError(`${key}: "requiredIf" must be an object like {"OTHER": "value"}`);
    }
    for (const [other, expected] of Object.entries(condition)) {
      if (other === key) throw new SchemaError(`${key}: "requiredIf" cannot refer to the variable itself`);
      if (expected !== true && typeof expected !== 'string' && !isStringList(expected)) {
        throw new SchemaError(`${key}: "requiredIf" for ${other} must be true, a string or a list of strings`);
      }
    }
    if (spec.default !== undefined) throw new SchemaError(`${key}: a variable with a default cannot have "requiredIf"`);
  }
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
  for (const name of Object.keys(raw)) {
    if (!['vars', 'allowUnknown', 'description'].includes(name)) {
      throw new SchemaError(`unknown top-level property "${name}"`);
    }
  }
  if (raw.allowUnknown !== undefined && typeof raw.allowUnknown !== 'boolean') {
    throw new SchemaError('"allowUnknown" must be true or false');
  }
  for (const [key, spec] of Object.entries(raw.vars)) checkSpec(key, spec);
  for (const [key, spec] of Object.entries(raw.vars)) {
    for (const other of Object.keys(spec.requiredIf ?? {})) {
      if (!Object.hasOwn(raw.vars, other)) {
        throw new SchemaError(`${key}: "requiredIf" refers to ${other}, which is not in the schema`);
      }
    }
  }
  return { vars: raw.vars, allowUnknown: raw.allowUnknown === true };
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
