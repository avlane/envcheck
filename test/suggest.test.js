'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { distance, suggest } = require('../lib/suggest');

test('distance: classic examples', () => {
  assert.strictEqual(distance('kitten', 'sitting'), 3);
  assert.strictEqual(distance('', 'abc'), 3);
  assert.strictEqual(distance('abc', ''), 3);
  assert.strictEqual(distance('same', 'same'), 0);
  assert.strictEqual(distance('flaw', 'lawn'), 2);
});

test('suggest: finds a typo', () => {
  const keys = ['DATABASE_URL', 'REDIS_URL', 'API_KEY'];
  assert.strictEqual(suggest('DATABSE_URL', keys), 'DATABASE_URL');
  assert.strictEqual(suggest('database_url', keys), 'DATABASE_URL');
  assert.strictEqual(suggest('REDIS_UR', keys), 'REDIS_URL');
});

test('suggest: nothing close means null', () => {
  assert.strictEqual(suggest('SOMETHING_ELSE', ['DATABASE_URL', 'API_KEY']), null);
  assert.strictEqual(suggest('X', ['Y', 'Z']), null);
  assert.strictEqual(suggest('ANYTHING', []), null);
});

test('suggest: short names tolerate one slip, longer ones more', () => {
  assert.strictEqual(suggest('PORT', ['PORX']), 'PORX');
  assert.strictEqual(suggest('PORT', ['PXRX']), null);
  assert.strictEqual(suggest('DATABASE_URL', ['DATBASE_URLS']), 'DATBASE_URLS');
});

test('suggest: the closest candidate wins', () => {
  assert.strictEqual(suggest('API_KEYS', ['API_KEY', 'API_KEYS_']), 'API_KEY');
});
