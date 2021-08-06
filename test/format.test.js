'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { formatText, formatJson, formatGithub } = require('../lib/format');

const problems = [
  { level: 'error', code: 'invalid', key: 'PORT', line: 3, message: 'must be a port number' },
  { level: 'warning', code: 'unknown', key: 'EXTRA', line: 8, message: 'is not in the schema' },
  { level: 'error', code: 'missing', key: 'API_KEY', line: null, message: 'is required but missing' },
  { level: 'error', code: 'syntax', key: '', line: 10, message: 'expected KEY=value' }
];

test('formatText: one line per problem', () => {
  assert.deepStrictEqual(formatText(problems, '.env'), [
    '.env:3  error  PORT  must be a port number',
    '.env:8  warning  EXTRA  is not in the schema',
    '.env  error  API_KEY  is required but missing',
    '.env:10  error  expected KEY=value'
  ]);
  assert.deepStrictEqual(formatText([], '.env'), []);
});

test('formatJson: counts and the problem list', () => {
  const parsed = JSON.parse(formatJson('.env', problems));
  assert.strictEqual(parsed.file, '.env');
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.errors, 3);
  assert.strictEqual(parsed.warnings, 1);
  assert.deepStrictEqual(parsed.problems, problems);
});

test('formatJson: no problems means ok', () => {
  assert.deepStrictEqual(JSON.parse(formatJson('x.env', [])), { file: 'x.env', ok: true, errors: 0, warnings: 0, problems: [] });
  assert.strictEqual(JSON.parse(formatJson('x.env', [problems[1]])).ok, true);
});

test('formatGithub: workflow commands', () => {
  assert.deepStrictEqual(formatGithub('config/.env', problems), [
    '::error file=config/.env,line=3,title=PORT::must be a port number',
    '::warning file=config/.env,line=8,title=EXTRA::is not in the schema',
    '::error file=config/.env,title=API_KEY::is required but missing',
    '::error file=config/.env,line=10::expected KEY=value'
  ]);
});

test('formatGithub: characters that need escaping', () => {
  const [line] = formatGithub('a,b:c.env', [
    { level: 'error', code: 'x', key: 'K', line: 1, message: '100% wrong\nreally\r' }
  ]);
  assert.strictEqual(line, '::error file=a%2Cb%3Ac.env,line=1,title=K::100%25 wrong%0Areally%0D');
});
