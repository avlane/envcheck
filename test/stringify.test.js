'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { parseEnv, toObject } = require('../lib/parse');
const { stringifyEnv } = require('../lib/stringify');

test('stringifyEnv: simple values are written bare', () => {
  assert.strictEqual(stringifyEnv({ A: '1', URL: 'https://example.com/a?b=c', EMPTY: '' }),
    'A=1\nURL=https://example.com/a?b=c\nEMPTY=\n');
});

test('stringifyEnv: awkward values are double quoted with escapes', () => {
  assert.strictEqual(stringifyEnv({ A: 'two words', B: 'say "hi"', C: 'line1\nline2', D: '#not a comment', E: "it's" }),
    'A="two words"\nB="say \\"hi\\""\nC="line1\\nline2"\nD="#not a comment"\nE="it\'s"\n');
});

test('stringifyEnv: nothing in, nothing out', () => {
  assert.strictEqual(stringifyEnv({}), '');
});

test('stringifyEnv: parseEnv reads the output back to the same values', () => {
  const values = {
    PLAIN: 'abc',
    SPACES: '  padded  ',
    QUOTES: 'a "b" \'c\'',
    BACKSLASH: 'C:\\temp\\x',
    MULTI: 'one\ntwo\r\nthree\tfour',
    HASH: 'a # b',
    DOLLAR: '$HOME',
    EMPTY: ''
  };
  const parsed = parseEnv(stringifyEnv(values));
  assert.deepStrictEqual(parsed.errors, []);
  assert.deepStrictEqual(toObject(parsed.entries), values);
});
