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
  assert.throws(() => parseSchema('{"vars": {"A": {"protocols": ["http"]}}}'), /"protocols" only applies to type "url"/);
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "url", "protocols": "http"}}}'), /"protocols" must be a non-empty list/);
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

test('parseSchema: top-level properties', () => {
  assert.strictEqual(parseSchema('{"vars": {}}').allowUnknown, false);
  assert.strictEqual(parseSchema('{"vars": {}, "allowUnknown": true}').allowUnknown, true);
  assert.throws(() => parseSchema('{"vars": {}, "allowUnknown": "yes"}'), /"allowUnknown" must be true or false/);
  assert.throws(() => parseSchema('{"vars": {}, "varz": {}}'), /unknown top-level property "varz"/);
});

test('parseSchema: typos in property names are caught', () => {
  assert.throws(() => parseSchema('{"vars": {"A": {"requird": true}}}'), /A: unknown property "requird"/);
  assert.throws(() => parseSchema('{"vars": {"A": {"required": "yes"}}}'), /A: "required" must be true or false/);
});

test('parseSchema: enum needs values, other types must not have them', () => {
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "enum"}}}'), /A: "values" must be a non-empty list of strings/);
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "enum", "values": []}}}'), /"values" must be/);
  assert.throws(() => parseSchema('{"vars": {"A": {"values": ["x"]}}}'), /"values" only applies to type "enum"/);
  assert.doesNotThrow(() => parseSchema('{"vars": {"A": {"type": "enum", "values": ["x", "y"]}}}'));
});

test('parseSchema: patterns must compile', () => {
  assert.throws(() => parseSchema('{"vars": {"A": {"pattern": "("}}}'), /A: "pattern" is not a valid regular expression/);
  assert.throws(() => parseSchema('{"vars": {"A": {"pattern": 5}}}'), /"pattern" must be a regular expression string/);
});

test('parseSchema: numeric and length limits', () => {
  assert.throws(() => parseSchema('{"vars": {"A": {"min": 1}}}'), /"min" only applies to number, integer and port/);
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "port", "min": "1"}}}'), /"min" must be a number/);
  assert.throws(() => parseSchema('{"vars": {"A": {"type": "integer", "min": 5, "max": 1}}}'), /"min" is greater than "max"/);
  assert.throws(() => parseSchema('{"vars": {"A": {"minLength": -1}}}'), /"minLength" must be a whole number/);
  assert.throws(() => parseSchema('{"vars": {"A": {"minLength": 5, "maxLength": 2}}}'), /"minLength" is greater than "maxLength"/);
  assert.doesNotThrow(() => parseSchema('{"vars": {"A": {"type": "port", "min": 1024, "max": 49151, "minLength": 1}}}'));
});
