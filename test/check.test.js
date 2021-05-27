'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseEnv } = require('../lib/parse');
const { check } = require('../lib/check');

const schema = {
  vars: {
    A: { required: true },
    B: { required: true },
    C: {}
  }
};

const run = text => check(parseEnv(text).entries, schema);

test('check: everything required is present', () => {
  assert.deepStrictEqual(run('A=1\nB=2\n'), []);
});

test('check: missing required variables have no line', () => {
  assert.deepStrictEqual(run('A=1\n'), [
    { level: 'error', code: 'missing', key: 'B', line: null, message: 'is required but missing' }
  ]);
});

test('check: empty required variables point at their line', () => {
  assert.deepStrictEqual(run('A=\nB=2\n'), [
    { level: 'error', code: 'empty', key: 'A', line: 1, message: 'is required but empty' }
  ]);
});

test('check: optional variables may be absent or empty', () => {
  assert.deepStrictEqual(run('A=1\nB=2\nC=\n'), []);
});

test('check: values are validated against the type', () => {
  const typed = { vars: { PORT: { type: 'port' }, MODE: { type: 'boolean', required: true } } };
  const problems = check(parseEnv('PORT=99999\nMODE=maybe\n').entries, typed);
  assert.strictEqual(problems.length, 2);
  assert.deepStrictEqual(problems[0], {
    level: 'error',
    code: 'invalid',
    key: 'PORT',
    line: 1,
    message: 'must be a port number between 1 and 65535 (got "99999")'
  });
  assert.strictEqual(problems[1].key, 'MODE');
  assert.deepStrictEqual(check(parseEnv('PORT=8080\nMODE=yes\n').entries, typed), []);
});

test('check: empty optional values are not type checked', () => {
  const typed = { vars: { PORT: { type: 'port' } } };
  assert.deepStrictEqual(check(parseEnv('PORT=\n').entries, typed), []);
});

test('check: problems are ordered by line, missing ones last', () => {
  const problems = run('B=\nA=\n');
  assert.deepStrictEqual(problems.map(p => [p.key, p.line]), [['B', 1], ['A', 2]]);
  assert.deepStrictEqual(run('').map(p => [p.key, p.line]), [['A', null], ['B', null]]);
});

const fs = require('fs');
const path = require('path');
const { parseSchema } = require('../lib/schema');

const EXAMPLES = path.join(__dirname, '..', 'examples');
const exampleSchema = () => parseSchema(fs.readFileSync(path.join(EXAMPLES, 'schema.json'), 'utf8'));
const exampleEntries = name => parseEnv(fs.readFileSync(path.join(EXAMPLES, name), 'utf8')).entries;

test('check: the example env file satisfies the example schema', () => {
  assert.deepStrictEqual(check(exampleEntries('app.env'), exampleSchema()), []);
});

test('check: the broken example env file is caught', () => {
  const problems = check(exampleEntries('broken.env'), exampleSchema());
  assert.deepStrictEqual(problems.map(p => [p.key, p.line, p.code]), [
    ['APP_NAME', 1, 'empty'],
    ['NODE_ENV', 2, 'invalid'],
    ['PORT', 3, 'invalid'],
    ['DATABASE_URL', 4, 'invalid'],
    ['API_KEY', 5, 'invalid'],
    ['DEBUG', 6, 'invalid'],
    ['ADMIN_EMAIL', 7, 'invalid']
  ]);
  assert.ok(problems[1].message.startsWith('must be one of development, production, test'), problems[1].message);
  assert.ok(problems[3].message.startsWith('must use postgres:// or postgresql://'), problems[3].message);
  assert.ok(problems[4].message.startsWith('must be at least 12 characters'), problems[4].message);
});
