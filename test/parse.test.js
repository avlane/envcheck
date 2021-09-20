'use strict';

const assert = require('node:assert');
const { test } = require('./harness');
const { parseEnv, toObject } = require('../lib/parse');

const values = text => toObject(parseEnv(text).entries);

test('parseEnv: plain assignments with line numbers', () => {
  assert.deepStrictEqual(parseEnv('A=1\n\n# note\nB=two\n').entries, [
    { key: 'A', value: '1', line: 1, quote: null },
    { key: 'B', value: 'two', line: 4, quote: null }
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

test('parseEnv: quotes are removed and remembered', () => {
  const { entries } = parseEnv('A="hello world"\nB=\'single quoted\'\nC=plain');
  assert.deepStrictEqual(entries.map(e => [e.value, e.quote]), [
    ['hello world', '"'],
    ['single quoted', "'"],
    ['plain', null]
  ]);
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

test('parseEnv: escapes in double quotes', () => {
  assert.deepStrictEqual(values('A="line1\\nline2"\nB="tab\\there"\nC="say \\"hi\\""\nD="back\\\\slash"'), {
    A: 'line1\nline2',
    B: 'tab\there',
    C: 'say "hi"',
    D: 'back\\slash'
  });
});

test('parseEnv: unknown escapes are kept as written', () => {
  assert.deepStrictEqual(values('A="C:\\path\\x"'), { A: 'C:\\path\\x' });
});

test('parseEnv: single quotes are literal', () => {
  assert.deepStrictEqual(values("A='no\\nescape $HOME'"), { A: 'no\\nescape $HOME' });
});

test('parseEnv: inline comments end unquoted values', () => {
  assert.deepStrictEqual(values('A=value # note\nB=a#b\nC=   # only a comment\nD="in # quotes" # after'), {
    A: 'value',
    B: 'a#b',
    C: '',
    D: 'in # quotes'
  });
});

test('parseEnv: unterminated quote and trailing junk are errors', () => {
  const unterminated = parseEnv('A="oops\nB=2');
  assert.deepStrictEqual(unterminated.errors, [{ line: 1, message: 'unterminated " quote' }]);
  assert.deepStrictEqual(unterminated.entries, []);
  const junk = parseEnv('A="x" y\nB=2');
  assert.deepStrictEqual(junk.errors, [{ line: 1, message: 'unexpected text after the closing quote' }]);
  assert.strictEqual(junk.entries.length, 2);
});

test('parseEnv: multi-line quoted values', () => {
  const { entries, errors } = parseEnv('KEY="-----BEGIN-----\nabc\ndef\n-----END-----"\nNEXT=1\n');
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(entries[0].value, '-----BEGIN-----\nabc\ndef\n-----END-----');
  assert.strictEqual(entries[0].line, 1);
  assert.deepStrictEqual([entries[1].key, entries[1].line], ['NEXT', 5]);
});

test('parseEnv: single-quoted values can span lines too, without escapes', () => {
  assert.deepStrictEqual(values("A='one\\n\ntwo'"), { A: 'one\\n\ntwo' });
});

test('parseEnv: junk after a multi-line value is reported on its last line', () => {
  const { errors } = parseEnv('A="x\ny" z\n');
  assert.deepStrictEqual(errors, [{ line: 2, message: 'unexpected text after the closing quote' }]);
});

test('parseEnv: an unterminated multi-line value reports where it started', () => {
  const { entries, errors } = parseEnv('A=1\nB="never closed\nC=3\n');
  assert.deepStrictEqual(entries.map(e => e.key), ['A']);
  assert.deepStrictEqual(errors, [{ line: 2, message: 'unterminated " quote' }]);
});

test('parseEnv: CRLF inside a multi-line value becomes LF', () => {
  assert.deepStrictEqual(values('A="x\r\ny"\r\n'), { A: 'x\ny' });
});
