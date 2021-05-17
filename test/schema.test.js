'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseSchema, SchemaError } = require('../lib/schema');

test('parseSchema: reads a vars object', () => {
  const schema = parseSchema('{"vars": {"A": {"required": true}}}');
  assert.deepStrictEqual(schema.vars, { A: { required: true } });
});

test('parseSchema: rejects bad JSON and bad shapes', () => {
  assert.throws(() => parseSchema('{oops', 'schema.json'), /schema\.json is not valid JSON/);
  assert.throws(() => parseSchema('[]'), SchemaError);
  assert.throws(() => parseSchema('{}'), /needs a "vars" object/);
  assert.throws(() => parseSchema('{"vars": []}'), /needs a "vars" object/);
  assert.throws(() => parseSchema('null'), /must be a JSON object/);
});
