'use strict';

const { TYPE_NAMES } = require('./types');

class SchemaError extends Error {}

function normalizeSchema(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SchemaError('the schema must be a JSON object');
  }
  if (raw.vars === null || typeof raw.vars !== 'object' || Array.isArray(raw.vars)) {
    throw new SchemaError('the schema needs a "vars" object');
  }
  for (const [key, spec] of Object.entries(raw.vars)) {
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new SchemaError(`${key}: the definition must be an object`);
    }
    if (spec.type !== undefined && !TYPE_NAMES.includes(spec.type)) {
      throw new SchemaError(`${key}: unknown type "${spec.type}" (use ${TYPE_NAMES.join(', ')})`);
    }
    if (spec.protocols !== undefined && (spec.type !== 'url' || !Array.isArray(spec.protocols))) {
      throw new SchemaError(`${key}: "protocols" is a list and only applies to type "url"`);
    }
  }
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
