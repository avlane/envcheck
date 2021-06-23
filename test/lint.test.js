'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { lint } = require('../lib/lint');

const codes = text => lint(text).map(p => [p.code, p.line]);

test('lint: a tidy file has no problems', () => {
  assert.deepStrictEqual(lint('# settings\nA=1\nB="x y"\nexport C=3\n'), []);
  assert.deepStrictEqual(lint(''), []);
});

test('lint: the usual suspects, in line order', () => {
  const text = 'a=1\nB = 2\nB=3\nC=4 \nexport D=5';
  assert.deepStrictEqual(codes(text), [
    ['lowercase-key', 1],
    ['space-around-equals', 2],
    ['duplicate-key', 3],
    ['trailing-space', 4],
    ['no-final-newline', 5]
  ]);
});

test('lint: duplicate keys point at the first occurrence', () => {
  const [problem] = lint('A=1\nB=2\nA=3\n');
  assert.strictEqual(problem.key, 'A');
  assert.strictEqual(problem.message, 'is already set on line 1; the last assignment wins');
});

test('lint: byte order mark', () => {
  assert.deepStrictEqual(codes('\uFEFFA=1\n'), [['bom', 1]]);
});

test('lint: spaces inside values are fine', () => {
  assert.deepStrictEqual(lint('A=hello world\nB= x\n').map(p => p.key), ['B']);
});

test('lint: CRLF files are not reported for their line endings', () => {
  assert.deepStrictEqual(lint('A=1\r\nB=2\r\n'), []);
});

test('lint: warnings only', () => {
  assert.ok(lint('a=1').every(p => p.level === 'warning'));
});
