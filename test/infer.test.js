'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('./harness');
const { inferSchema, guessType } = require('../lib/infer');
const { parseSchema } = require('../lib/schema');
const { parseEnv } = require('../lib/parse');
const { check } = require('../lib/check');

test('guessType: by name and by value', () => {
  assert.strictEqual(guessType('PORT', '8080'), 'port');
  assert.strictEqual(guessType('DB_PORT', '5432'), 'port');
  assert.strictEqual(guessType('PORTAL', '12'), 'integer');
  assert.strictEqual(guessType('DEBUG', ''), 'boolean');
  assert.strictEqual(guessType('X', 'true'), 'boolean');
  assert.strictEqual(guessType('SITE', 'https://example.com'), 'url');
  assert.strictEqual(guessType('ADMIN_EMAIL', 'ops@example.com'), 'email');
  assert.strictEqual(guessType('ID', '3f2504e0-4f89-11d3-9a0c-0305e82c3301'), 'uuid');
  assert.strictEqual(guessType('RETRIES', '3'), 'integer');
  assert.strictEqual(guessType('RATIO', '0.75'), 'number');
  assert.strictEqual(guessType('OPTS', '{"a": 1}'), 'json');
  assert.strictEqual(guessType('OPTS', '{broken'), 'string');
  assert.strictEqual(guessType('NAME', 'Shop'), 'string');
  assert.strictEqual(guessType('EMPTY', ''), 'string');
});

test('inferSchema: defaults for simple types, required for the rest', () => {
  const schema = inferSchema('PORT=8080\nDEBUG=false\nNAME=shop\nSITE=https://example.com\n');
  assert.deepStrictEqual(schema.vars, {
    PORT: { type: 'port', default: '8080' },
    DEBUG: { type: 'boolean', default: 'false' },
    NAME: { required: true },
    SITE: { type: 'url', protocols: ['https'], required: true }
  });
});

test('inferSchema: secrets are required and marked', () => {
  const schema = inferSchema('API_KEY=abc\nDB=postgres://u:pw@h/d\nTOKEN_TTL=60\n');
  assert.deepStrictEqual(schema.vars.API_KEY, { required: true, secret: true });
  assert.deepStrictEqual(schema.vars.DB, { type: 'url', protocols: ['postgres'], required: true, secret: true });
  assert.deepStrictEqual(schema.vars.TOKEN_TTL, { type: 'integer', required: true, secret: true });
});

test('inferSchema: comments above a variable describe it', () => {
  const schema = inferSchema('# Not for A\n\n# first line\n# second line\nA=1\nB=2\n');
  assert.strictEqual(schema.vars.A.description, 'first line second line');
  assert.strictEqual('description' in schema.vars.B, false);
});

test('inferSchema: the result is a valid schema that accepts its own example', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'examples', 'app.env'), 'utf8');
  const inferred = inferSchema(text);
  const schema = parseSchema(JSON.stringify(inferred));
  assert.deepStrictEqual(check(parseEnv(text).entries, schema), []);
  assert.strictEqual(inferred.vars.PORT.default, '8080');
  assert.strictEqual(inferred.vars.APP_NAME.description, 'Display name of the service');
  assert.strictEqual(inferred.vars.DATABASE_URL.secret, true);
});

test('inferSchema: no variables, empty vars', () => {
  assert.deepStrictEqual(inferSchema('# nothing here\n'), { vars: {} });
});
