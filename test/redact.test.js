'use strict';

const assert = require('assert');
const { test } = require('./harness');
const { isSecret, maskUrl, display } = require('../lib/redact');

test('isSecret: names that look secret', () => {
  for (const key of ['API_KEY', 'APIKEY', 'STRIPE_SECRET', 'DB_PASSWORD', 'GITHUB_TOKEN', 'PRIVATE_KEY', 'SIGNING_KEY', 'password']) {
    assert.strictEqual(isSecret(key), true, key);
  }
  for (const key of ['PORT', 'APP_NAME', 'KEYBOARD_LAYOUT', 'MONKEY_COUNT']) {
    assert.strictEqual(isSecret(key), false, key);
  }
});

test('isSecret: the schema has the last word', () => {
  assert.strictEqual(isSecret('PORT', { secret: true }), true);
  assert.strictEqual(isSecret('API_KEY', { secret: false }), false);
  assert.strictEqual(isSecret('API_KEY', {}), true);
});

test('maskUrl: hides the password only', () => {
  assert.strictEqual(maskUrl('postgres://shop:s3cret@db.example.com:5432/shop'), 'postgres://shop:***@db.example.com:5432/shop');
  assert.strictEqual(maskUrl('https://example.com/a:b@c'), 'https://example.com/a:b@c');
  assert.strictEqual(maskUrl('redis://cache:6379/0'), 'redis://cache:6379/0');
  assert.strictEqual(maskUrl('postgres://user@host/db'), 'postgres://user@host/db');
  assert.strictEqual(maskUrl('plain text'), 'plain text');
});

test('display: secrets and URL passwords', () => {
  assert.strictEqual(display('API_KEY', 'abc', undefined), '***');
  assert.strictEqual(display('API_KEY', '', undefined), '');
  assert.strictEqual(display('PORT', '8080', undefined), '8080');
  assert.strictEqual(display('DATABASE_URL', 'postgres://u:pw@h/d', undefined), 'postgres://u:***@h/d');
});
