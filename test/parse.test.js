'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseEnv } = require('../lib/parse');

test('parseEnv: plain assignments', () => {
  assert.deepStrictEqual(parseEnv('A=1\nB=two\n'), { A: '1', B: 'two' });
});

test('parseEnv: comments and blank lines are skipped', () => {
  assert.deepStrictEqual(parseEnv('# heading\n\nA=1\n   # indented comment\n'), { A: '1' });
});

test('parseEnv: export prefix', () => {
  assert.deepStrictEqual(parseEnv('export A=1\nexport   B=2'), { A: '1', B: '2' });
});

test('parseEnv: spaces around the equals sign', () => {
  assert.deepStrictEqual(parseEnv('A = 1\nB= 2\nC =3'), { A: '1', B: '2', C: '3' });
});

test('parseEnv: quotes are removed', () => {
  assert.deepStrictEqual(parseEnv('A="hello world"\nB=\'single quoted\'\nC="mismatched\''), {
    A: 'hello world',
    B: 'single quoted',
    C: '"mismatched\''
  });
});

test('parseEnv: only the first equals sign splits', () => {
  assert.deepStrictEqual(parseEnv('URL=https://example.com/?a=b&c=d'), { URL: 'https://example.com/?a=b&c=d' });
});

test('parseEnv: empty values', () => {
  assert.deepStrictEqual(parseEnv('A=\nB=""\n'), { A: '', B: '' });
});

test('parseEnv: CRLF line endings', () => {
  assert.deepStrictEqual(parseEnv('A=1\r\nB=2\r\n'), { A: '1', B: '2' });
});

test('parseEnv: lines that are not assignments are ignored', () => {
  assert.deepStrictEqual(parseEnv('just some text\n1BAD=x\nA=1'), { A: '1' });
});
