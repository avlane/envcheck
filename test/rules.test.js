'use strict';

const assert = require('node:assert');
const { test } = require('./harness');
const { validateValue } = require('../lib/rules');

test('rules: enum', () => {
  const spec = { type: 'enum', values: ['development', 'production'] };
  assert.strictEqual(validateValue('production', spec), null);
  assert.strictEqual(validateValue('staging', spec), 'must be one of development, production');
  assert.strictEqual(validateValue('Production', spec), 'must be one of development, production');
});

test('rules: pattern is unanchored', () => {
  assert.strictEqual(validateValue('abc123', { pattern: '\\d' }), null);
  assert.strictEqual(validateValue('abc', { pattern: '\\d' }), 'must match \\d');
  assert.strictEqual(validateValue('abc123', { pattern: '^[a-z]+$' }), 'must match ^[a-z]+$');
});

test('rules: min and max on numbers', () => {
  const spec = { type: 'integer', min: 1, max: 10 };
  assert.strictEqual(validateValue('5', spec), null);
  assert.strictEqual(validateValue('1', spec), null);
  assert.strictEqual(validateValue('10', spec), null);
  assert.strictEqual(validateValue('0', spec), 'must be at least 1');
  assert.strictEqual(validateValue('11', spec), 'must be at most 10');
  assert.strictEqual(validateValue('x', spec), 'must be a whole number');
});

test('rules: ports can be limited too', () => {
  assert.strictEqual(validateValue('80', { type: 'port', min: 1024 }), 'must be at least 1024');
  assert.strictEqual(validateValue('8080', { type: 'port', min: 1024 }), null);
});

test('rules: lengths', () => {
  const spec = { minLength: 3, maxLength: 5 };
  assert.strictEqual(validateValue('abc', spec), null);
  assert.strictEqual(validateValue('abcde', spec), null);
  assert.strictEqual(validateValue('ab', spec), 'must be at least 3 characters');
  assert.strictEqual(validateValue('abcdef', spec), 'must be at most 5 characters');
});

test('rules: uuid and json types', () => {
  assert.strictEqual(validateValue('3f2504e0-4f89-11d3-9a0c-0305e82c3301', { type: 'uuid' }), null);
  assert.strictEqual(validateValue('3f2504e0-4f89', { type: 'uuid' }), 'must be a UUID');
  assert.strictEqual(validateValue('{"a": [1, 2]}', { type: 'json' }), null);
  assert.strictEqual(validateValue('{a: 1}', { type: 'json' }), 'must be valid JSON');
});

test('rules: the type is checked before the constraints', () => {
  assert.strictEqual(validateValue('abc', { type: 'integer', min: 1 }), 'must be a whole number');
});
