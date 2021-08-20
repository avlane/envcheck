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
    ['ADMIN_EMAIL', 7, 'invalid'],
    ['UNUSED_FLAG', 8, 'unknown']
  ]);
  assert.strictEqual(problems[7].level, 'warning');
  assert.ok(problems[1].message.startsWith('must be one of development, production, test'), problems[1].message);
  assert.strictEqual(problems[3].message, 'must use postgres:// or postgresql://');
  assert.strictEqual(problems[4].message, 'must be at least 12 characters');
  assert.strictEqual(check(exampleEntries('broken.env'), exampleSchema(), { strict: true })[7].level, 'error');
});

test('check: unknown variables are warnings with a spelling hint', () => {
  const typed = { vars: { DATABASE_URL: {}, PORT: {} } };
  const problems = check(parseEnv('DATABSE_URL=x\nPORT=1\nOTHER=2\n').entries, typed);
  assert.deepStrictEqual(problems, [
    { level: 'warning', code: 'unknown', key: 'DATABSE_URL', line: 1, message: 'is not in the schema (did you mean DATABASE_URL?)' },
    { level: 'warning', code: 'unknown', key: 'OTHER', line: 3, message: 'is not in the schema' }
  ]);
});

test('check: --strict turns unknown variables into errors', () => {
  const problems = check(parseEnv('OTHER=2\n').entries, { vars: {} }, { strict: true });
  assert.deepStrictEqual(problems.map(p => p.level), ['error']);
});

test('check: allowUnknown silences them', () => {
  const problems = check(parseEnv('OTHER=2\n').entries, { vars: {}, allowUnknown: true }, { strict: true });
  assert.deepStrictEqual(problems, []);
});

test('check: a missing required variable mentions a near-miss in the file', () => {
  const problems = check(parseEnv('DATABSE_URL=x\n').entries, { vars: { DATABASE_URL: { required: true } } });
  const missing = problems.find(p => p.code === 'missing');
  assert.strictEqual(missing.message, 'is required but missing (DATABSE_URL is set, is that a typo?)');
});

test('check: a variable set twice is reported once as unknown', () => {
  const problems = check(parseEnv('X=1\nX=2\n').entries, { vars: {} });
  assert.strictEqual(problems.length, 1);
  assert.strictEqual(problems[0].line, 2);
});

test('check: secret values are never echoed, other values are', () => {
  const typed = {
    vars: {
      TOKEN_X: { minLength: 10 },
      PORT: { type: 'port' },
      SITE: { type: 'url', protocols: ['https'], secret: true },
      HOOK: { type: 'url', protocols: ['https'] }
    }
  };
  const problems = check(parseEnv('TOKEN_X=short\nPORT=bad\nSITE=http://u:pw@a.example\nHOOK=http://u:pw@b.example\n').entries, typed);
  const messages = Object.fromEntries(problems.map(p => [p.key, p.message]));
  assert.strictEqual(messages.TOKEN_X, 'must be at least 10 characters');
  assert.strictEqual(messages.PORT, 'must be a port number between 1 and 65535 (got "bad")');
  assert.strictEqual(messages.SITE, 'must use https://');
  assert.strictEqual(messages.HOOK, 'must use https:// (got "http://u:***@b.example")');
  assert.ok(!JSON.stringify(problems).includes('pw'));
});

const conditional = parseSchema(JSON.stringify({
  vars: {
    DB_SSL: { type: 'boolean', default: 'false' },
    DB_CA: { requiredIf: { DB_SSL: ['true', 'yes'] } },
    SENTRY_DSN: { type: 'url' },
    SENTRY_ENV: { requiredIf: { SENTRY_DSN: true } },
    BOTH: { requiredIf: { DB_SSL: 'true', SENTRY_DSN: true } }
  }
}));

test('check: requiredIf with a value', () => {
  assert.deepStrictEqual(check(parseEnv('DB_SSL=false\n').entries, conditional), []);
  assert.deepStrictEqual(check(parseEnv('').entries, conditional), []);
  const problems = check(parseEnv('DB_SSL=true\n').entries, conditional);
  assert.deepStrictEqual(problems.map(p => [p.key, p.message]), [
    ['DB_CA', 'is required when DB_SSL is "true" but missing']
  ]);
  assert.deepStrictEqual(check(parseEnv('DB_SSL=yes\nDB_CA=/etc/ca.pem\n').entries, conditional), []);
});

test('check: requiredIf true means "when it is set"', () => {
  assert.deepStrictEqual(check(parseEnv('SENTRY_DSN=\n').entries, conditional), []);
  const problems = check(parseEnv('SENTRY_DSN=https://k@sentry.example.com/1\n').entries, conditional);
  assert.deepStrictEqual(problems.map(p => [p.key, p.message]), [
    ['SENTRY_ENV', 'is required when SENTRY_DSN is set but missing']
  ]);
  assert.deepStrictEqual(check(parseEnv('SENTRY_DSN=https://k@sentry.example.com/1\nSENTRY_ENV=prod\n').entries, conditional), []);
});

test('check: requiredIf with several conditions needs all of them', () => {
  const dsn = 'SENTRY_DSN=https://k@sentry.example.com/1\nSENTRY_ENV=x\n';
  assert.deepStrictEqual(check(parseEnv(dsn).entries, conditional), []);
  const both = check(parseEnv(dsn + 'DB_SSL=true\nDB_CA=x\n').entries, conditional);
  assert.deepStrictEqual(both.map(p => [p.key, p.message]), [
    ['BOTH', 'is required when DB_SSL is "true" and SENTRY_DSN is set but missing']
  ]);
});

test('check: a conditionally required variable that is empty is an error', () => {
  const problems = check(parseEnv('DB_SSL=true\nDB_CA=\n').entries, conditional);
  assert.deepStrictEqual(problems.map(p => [p.key, p.code, p.line]), [['DB_CA', 'empty', 2]]);
});

test('check: another variable\'s default counts for requiredIf', () => {
  const schema = parseSchema('{"vars": {"MODE": {"default": "on"}, "X": {"requiredIf": {"MODE": "on"}}}}');
  assert.deepStrictEqual(check([], schema).map(p => p.key), ['X']);
});

test('check: problems carry the file of the entry they are about', () => {
  const entries = [
    { key: 'A', value: 'oops', line: 2, file: 'one.env' },
    { key: 'B', value: 'x', line: 1, file: 'two.env' }
  ];
  const problems = check(entries, { vars: { A: { type: 'port' }, C: { required: true } } });
  assert.deepStrictEqual(problems.map(p => [p.file, p.key, p.line]), [
    ['one.env', 'A', 2],
    ['two.env', 'B', 1],
    [undefined, 'C', null]
  ]);
  assert.strictEqual('file' in problems[2], false);
});
