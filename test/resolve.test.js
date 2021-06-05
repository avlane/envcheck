'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseEnv } = require('../lib/parse');
const { resolve } = require('../lib/resolve');
const { check } = require('../lib/check');
const { parseSchema } = require('../lib/schema');

const schema = parseSchema(JSON.stringify({
  vars: {
    PORT: { type: 'port', default: '3000' },
    DEBUG: { type: 'boolean', default: 'false' },
    NAME: { required: true }
  }
}));

test('resolve: defaults fill the gaps', () => {
  const { values, defaulted } = resolve(parseEnv('NAME=shop\nPORT=8080\n').entries, schema);
  assert.deepStrictEqual(values, { NAME: 'shop', PORT: '8080', DEBUG: 'false' });
  assert.deepStrictEqual(defaulted, ['DEBUG']);
});

test('resolve: unknown variables are kept', () => {
  const { values } = resolve(parseEnv('NAME=shop\nEXTRA=1\n').entries, schema);
  assert.strictEqual(values.EXTRA, '1');
});

test('check: a variable with a default is not missing', () => {
  assert.deepStrictEqual(check(parseEnv('NAME=shop\n').entries, schema), []);
});

test('check: an explicit bad value is still an error even if a default exists', () => {
  const problems = check(parseEnv('NAME=shop\nPORT=abc\n').entries, schema);
  assert.deepStrictEqual(problems.map(p => [p.key, p.code]), [['PORT', 'invalid']]);
});

test('schema: defaults must be valid and cannot be combined with required', () => {
  assert.throws(() => parseSchema('{"vars": {"P": {"type": "port", "default": "99999"}}}'),
    /P: the default "99999" must be a port number/);
  assert.throws(() => parseSchema('{"vars": {"P": {"default": 5}}}'), /"default" must be text/);
  assert.throws(() => parseSchema('{"vars": {"P": {"required": true, "default": "x"}}}'),
    /cannot also be required/);
  assert.doesNotThrow(() => parseSchema('{"vars": {"P": {"type": "port", "default": "8080", "min": 1024}}}'));
});
