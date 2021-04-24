'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseEnv, toObject } = require('../lib/parse');

const values = text => toObject(parseEnv(text).entries);

test('parseEnv: plain assignments with line numbers', () => {
  assert.deepStrictEqual(parseEnv('A=1\n\n# note\nB=two\n').entries, [
    { key: 'A', value: '1', line: 1 },
    { key: 'B', value: 'two', line: 4 }
  ]);
});

test('parseEnv: comments and blank lines are skipped', () => {
  assert.deepStrictEqual(values('# heading\n\nA=1\n   # indented comment\n'), { A: '1' });
});

test('parseEnv: export prefix', () => {
  assert.deepStrictEqual(values('export A=1\nexport   B=2'), { A: '1', B: '2' });
});

test('parseEnv: spaces around the equals sign', () => {
  assert.deepStrictEqual(values('A = 1\nB= 2\nC =3'), { A: '1', B: '2', C: '3' });
});

test('parseEnv: quotes are removed', () => {
  assert.deepStrictEqual(values('A="hello world"\nB=\'single quoted\'\nC="mismatched\''), {
    A: 'hello world',
    B: 'single quoted',
    C: '"mismatched\''
  });
});

test('parseEnv: only the first equals sign splits', () => {
  assert.deepStrictEqual(values('URL=https://example.com/?a=b&c=d'), { URL: 'https://example.com/?a=b&c=d' });
});

test('parseEnv: empty values', () => {
  assert.deepStrictEqual(values('A=\nB=""\n'), { A: '', B: '' });
});

test('parseEnv: CRLF line endings and a byte order mark', () => {
  const { entries } = parseEnv('\uFEFFA=1\r\nB=2\r\n');
  assert.deepStrictEqual(entries.map(e => [e.key, e.value, e.line]), [['A', '1', 1], ['B', '2', 2]]);
});

test('parseEnv: lines that are not assignments are errors', () => {
  const { entries, errors } = parseEnv('just some text\n1BAD=x\nA=1\n');
  assert.deepStrictEqual(entries.map(e => e.key), ['A']);
  assert.deepStrictEqual(errors, [
    { line: 1, message: 'expected KEY=value' },
    { line: 2, message: 'expected KEY=value' }
  ]);
});

test('toObject: the last assignment wins', () => {
  assert.deepStrictEqual(values('A=1\nB=2\nA=3'), { A: '3', B: '2' });
});

test('toObject: a key called __proto__ is an ordinary key', () => {
  const o = values('__proto__=x');
  assert.strictEqual(Object.keys(o)[0], '__proto__');
});
