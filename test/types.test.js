'use strict';

const assert = require('node:assert');
const { test } = require('./harness');
const { checkType, TYPE_NAMES } = require('../lib/types');

const ok = (type, value, spec) => assert.strictEqual(checkType(type, value, spec), null, `${type} ${value}`);
const bad = (type, value, spec) => assert.strictEqual(typeof checkType(type, value, spec), 'string', `${type} ${value}`);

test('types: the available names', () => {
  assert.deepStrictEqual(TYPE_NAMES, ['string', 'number', 'integer', 'boolean', 'port', 'url', 'email', 'enum', 'uuid', 'json']);
});

test('types: string accepts anything', () => {
  ok('string', 'whatever');
});

test('types: number', () => {
  ['0', '42', '-1.5', '1e3', ' 7 '].forEach(v => ok('number', v));
  ['abc', '1,5', 'NaN', 'Infinity', '12px', '0x'].forEach(v => bad('number', v));
});

test('types: integer', () => {
  ['0', '42', '-7', '+3'].forEach(v => ok('integer', v));
  ['1.5', 'abc', '1e3', ' 1'].forEach(v => bad('integer', v));
});

test('types: boolean', () => {
  ['true', 'FALSE', '1', '0', 'yes', 'No', 'on', 'off'].forEach(v => ok('boolean', v));
  ['maybe', '2', 'y', ''].forEach(v => bad('boolean', v));
});

test('types: port', () => {
  ['1', '80', '8080', '65535'].forEach(v => ok('port', v));
  ['0', '65536', '99999', '-1', '80.5', 'http'].forEach(v => bad('port', v));
});

test('types: url', () => {
  ok('url', 'https://example.com/path?x=1');
  ok('url', 'postgres://user:pw@db.example.com:5432/app');
  ['example.com', 'localhost:5432', 'http//x', '://x', 'not a url'].forEach(v => bad('url', v));
});

test('types: url protocol list', () => {
  const spec = { protocols: ['postgres', 'postgresql'] };
  ok('url', 'postgres://db/app', spec);
  ok('url', 'postgresql://db/app', spec);
  assert.strictEqual(checkType('url', 'mysql://db/app', spec), 'must use postgres:// or postgresql://');
});

test('types: email', () => {
  ['a@b.co', 'first.last+tag@example.com'].forEach(v => ok('email', v));
  ['plain', 'a@b', '@b.co', 'a b@c.de'].forEach(v => bad('email', v));
});
