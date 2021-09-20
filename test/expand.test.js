'use strict';

const assert = require('node:assert');
const { test } = require('./harness');
const { parseEnv, toObject } = require('../lib/parse');
const { expandEntries } = require('../lib/expand');

const run = (text, env) => {
  const { entries, problems } = expandEntries(parseEnv(text).entries, env);
  return { values: toObject(entries), problems };
};

test('expand: references to earlier variables', () => {
  const { values, problems } = run('HOST=db.example.com\nPORT=5432\nURL=postgres://${HOST}:$PORT/app\n');
  assert.strictEqual(values.URL, 'postgres://db.example.com:5432/app');
  assert.deepStrictEqual(problems, []);
});

test('expand: the process environment is the fallback', () => {
  const { values } = run('A=${HOME_DIR}/bin\n', { HOME_DIR: '/home/ava' });
  assert.strictEqual(values.A, '/home/ava/bin');
});

test('expand: the file wins over the process environment', () => {
  const { values } = run('X=file\nY=$X\n', { X: 'env' });
  assert.strictEqual(values.Y, 'file');
});

test('expand: fallbacks with :-', () => {
  const { values, problems } = run('A=${MISSING:-default}\nB=${MISSING:-}\nC=x${MISSING:-a b}y\n');
  assert.deepStrictEqual(values, { A: 'default', B: '', C: 'xa by' });
  assert.deepStrictEqual(problems, []);
});

test('expand: single quotes are literal, double quotes expand, \\$ escapes', () => {
  const { values } = run("A=1\nB='$A'\nC=\"v=$A\"\nD=cost\\$5\n");
  assert.deepStrictEqual(values, { A: '1', B: '$A', C: 'v=1', D: 'cost$5' });
});

test('expand: unresolved references are errors with a line number', () => {
  const { values, problems } = run('A=1\nB=$NOPE\nC=${LATER}\nLATER=2\n');
  assert.strictEqual(values.B, '');
  assert.deepStrictEqual(problems.map(p => [p.key, p.line, p.code]), [['B', 2, 'undefined-reference'], ['C', 3, 'undefined-reference']]);
  assert.ok(problems[0].message.includes('NOPE'));
});

test('expand: a variable cannot refer to itself', () => {
  const { problems } = run('A=${A}x\n');
  assert.strictEqual(problems.length, 1);
});

test('expand: chains resolve in order', () => {
  const { values } = run('A=x\nB=${A}y\nC=${B}z\n');
  assert.strictEqual(values.C, 'xyz');
});

test('expand: the input entries are not modified', () => {
  const entries = parseEnv('A=1\nB=$A\n').entries;
  expandEntries(entries);
  assert.strictEqual(entries[1].value, '$A');
});
