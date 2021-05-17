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

test('check: problems are ordered by line, missing ones last', () => {
  const problems = run('B=\nA=\n');
  assert.deepStrictEqual(problems.map(p => [p.key, p.line]), [['B', 1], ['A', 2]]);
  assert.deepStrictEqual(run('').map(p => [p.key, p.line]), [['A', null], ['B', null]]);
});
