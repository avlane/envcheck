'use strict';

const assert = require('node:assert');
const { test } = require('./harness');
const { parseEnv } = require('../lib/parse');
const { diffEnv } = require('../lib/diff');

const diff = (a, b) => diffEnv(parseEnv(a).entries, parseEnv(b).entries);

test('diffEnv: identical files', () => {
  assert.deepStrictEqual(diff('A=1\nB=2\n', 'B=2\nA=1\n'), { onlyA: [], onlyB: [], changed: [] });
});

test('diffEnv: keys on one side only', () => {
  assert.deepStrictEqual(diff('A=1\nB=2\n', 'B=2\nC=3\n'), { onlyA: ['A'], onlyB: ['C'], changed: [] });
});

test('diffEnv: changed values', () => {
  assert.deepStrictEqual(diff('A=1\nB=2\n', 'A=1\nB=3\n'), { onlyA: [], onlyB: [], changed: ['B'] });
});

test('diffEnv: duplicates use the last value', () => {
  assert.deepStrictEqual(diff('A=1\nA=2\n', 'A=2\n'), { onlyA: [], onlyB: [], changed: [] });
});

test('diffEnv: empty files', () => {
  assert.deepStrictEqual(diff('', ''), { onlyA: [], onlyB: [], changed: [] });
  assert.deepStrictEqual(diff('A=\n', ''), { onlyA: ['A'], onlyB: [], changed: [] });
});
