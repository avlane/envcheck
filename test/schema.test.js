'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseSchema, SchemaError } = require('../lib/schema');

test('parseSchema: reads a vars object', () => {
  const schema = parseSchema('{"vars": {"A": {"required": true}}}');
  assert.deepStrictEqual(schema.vars, { A: { required: true } });
});

test('parseSchema: unknown types and misplaced protocols are rejected', () => {
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "colour"}}}'), /A: unknown type "colour" \(use string, number/);
  assert.throws(() => parseSchema('{"vars": {"A": {"protocols": ["http"]}}}'), /"protocols" is a list and only applies to type "url"/);
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "url", "protocols": "http"}}}'), /"protocols"/);
  assert.throws(() => parseSchema('{"vars": {"A": 5}}'), /A: the definition must be an object/);
  assert.doesNotThrow(() => parseSchema('{"vars": {"A": {"type": "url", "protocols": ["http"]}}}'));
});

test('parseSchema: rejects bad JSON and bad shapes', () => {
  assert.throws(() => parseSchema('{oops', 'schema.json'), /schema\.json is not valid JSON/);
  assert.throws(() => parseSchema('[]'), SchemaError);
  assert.throws(() => parseSchema('{}'), /needs a "vars" object/);
  assert.throws(() => parseSchema('{"vars": []}'), /needs a "vars" object/);
  assert.throws(() => parseSchema('null'), /must be a JSON object/);
});
