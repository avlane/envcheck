'use strict';

class SchemaError extends Error {}

function normalizeSchema(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SchemaError('the schema must be a JSON object');
  }
  if (raw.vars === null || typeof raw.vars !== 'object' || Array.isArray(raw.vars)) {
    throw new SchemaError('the schema needs a "vars" object');
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
