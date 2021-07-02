'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('./harness');
const { runCli, example } = require('./helpers');

const SCHEMA = example('schema.json');

test('cli: parse prints JSON', () => {
  const { code, out } = runCli(['parse', example('app.env')]);
  assert.strictEqual(code, 0);
  const values = JSON.parse(out);
  assert.strictEqual(values.PORT, '8080');
  assert.strictEqual(values.APP_NAME, 'Shop Backend');
});

test('cli: check passes on the good example', () => {
  const { code, out, err } = runCli(['check', example('app.env'), '--schema', SCHEMA]);
  assert.strictEqual(code, 0);
  assert.strictEqual(out, 'ok\n');
  assert.strictEqual(err, '');
});

test('cli: check reports problems on the broken example', () => {
  const { code, out } = runCli(['check', example('broken.env'), '-s', SCHEMA]);
  assert.strictEqual(code, 1);
  const lines = out.trimEnd().split('\n');
  assert.ok(lines[0].endsWith('broken.env:1  error  APP_NAME  is required but empty'), lines[0]);
  assert.ok(lines[2].includes(':3  error  PORT  must be a port number'), lines[2]);
  assert.ok(lines[7].includes(':8  warning  UNUSED_FLAG  is not in the schema'), lines[7]);
  assert.strictEqual(lines[8], '7 errors, 1 warning');
});

test('cli: --strict makes unknown variables errors', () => {
  const { out } = runCli(['check', example('broken.env'), '--schema', SCHEMA, '--strict']);
  assert.ok(out.trimEnd().endsWith('8 errors, 0 warnings'), out);
});

test('cli: warnings alone do not fail check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const env = path.join(dir, 'x.env');
  fs.writeFileSync(env, 'APP_NAME=x\nNODE_ENV=test\nDATABASE_URL=postgres://u@h/d\nAPI_KEY=abcdefghijkl\nEXTRA=1\n');
  try {
    const { code, out } = runCli(['check', env, '--schema', SCHEMA]);
    assert.strictEqual(code, 0);
    assert.ok(out.includes('warning  EXTRA'), out);
    assert.ok(out.trimEnd().endsWith('0 errors, 1 warning'), out);
  } finally {
    fs.unlinkSync(env);
    fs.rmdirSync(dir);
  }
});

test('cli: lint', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const env = path.join(dir, 'messy.env');
  fs.writeFileSync(env, 'a=1\nB = 2\n');
  try {
    const messy = runCli(['lint', env]);
    assert.strictEqual(messy.code, 1);
    assert.ok(messy.out.includes('lowercase-key') || messy.out.includes('UPPER_CASE'), messy.out);
    assert.strictEqual(runCli(['lint', example('app.env')]).code, 0);
  } finally {
    fs.unlinkSync(env);
    fs.rmdirSync(dir);
  }
});

test('cli: resolve prints the environment with defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const schema = path.join(dir, 'schema.json');
  const env = path.join(dir, 'x.env');
  fs.writeFileSync(schema, '{"vars": {"NAME": {"required": true}, "PORT": {"type": "port", "default": "3000"}}}');
  fs.writeFileSync(env, 'NAME="two words"\n');
  try {
    const { code, out } = runCli(['resolve', env, '--schema', schema]);
    assert.strictEqual(code, 0);
    assert.strictEqual(out, 'NAME="two words"\nPORT=3000\n');
    fs.writeFileSync(env, 'PORT=1\n');
    const bad = runCli(['resolve', env, '--schema', schema]);
    assert.strictEqual(bad.code, 1);
    assert.strictEqual(bad.out, '');
    assert.ok(bad.err.includes('NAME  is required but missing'), bad.err);
  } finally {
    fs.unlinkSync(schema);
    fs.unlinkSync(env);
    fs.rmdirSync(dir);
  }
});

test('cli: syntax errors in the env file fail the run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const env = path.join(dir, 'bad.env');
  fs.writeFileSync(env, 'A=1\nthis is wrong\n');
  try {
    const { code, err } = runCli(['parse', env]);
    assert.strictEqual(code, 1);
    assert.ok(err.includes('bad.env:2: expected KEY=value'), err);
  } finally {
    fs.unlinkSync(env);
    fs.rmdirSync(dir);
  }
});

test('cli: diff', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const a = path.join(dir, 'a.env');
  const b = path.join(dir, 'b.env');
  fs.writeFileSync(a, 'ONE=1\nTWO=2\nSHARED=x\n');
  fs.writeFileSync(b, 'THREE=3\nSHARED=y\nTWO=2\n');
  try {
    const plain = runCli(['diff', a, b]);
    assert.strictEqual(plain.code, 1);
    assert.strictEqual(plain.out, `- ONE  only in ${a}\n+ THREE  only in ${b}\n`);
    const values = runCli(['diff', a, b, '--values']);
    assert.ok(values.out.endsWith('~ SHARED  values differ\n'), values.out);
    assert.ok(!values.out.includes('=x') && !values.out.includes('=y'));
    fs.writeFileSync(b, 'TWO=2\nONE=1\nSHARED=y\n');
    const same = runCli(['diff', a, b]);
    assert.strictEqual(same.code, 0);
    assert.strictEqual(same.out, 'same variables\n');
    assert.strictEqual(runCli(['diff', a, b, '--values']).code, 1);
  } finally {
    fs.unlinkSync(a);
    fs.unlinkSync(b);
    fs.rmdirSync(dir);
  }
});

test('cli: diff needs exactly two files', () => {
  assert.strictEqual(runCli(['diff', example('app.env')]).code, 2);
  assert.ok(runCli(['diff']).err.includes('diff needs two files'));
});

test('cli: usage problems exit with status 2', () => {
  assert.strictEqual(runCli([]).code, 2);
  assert.ok(runCli([]).err.includes('no command given'));
  assert.strictEqual(runCli(['frobnicate']).code, 2);
  assert.ok(runCli(['frobnicate']).err.includes('unknown command: frobnicate'));
  assert.strictEqual(runCli(['parse', '--bogus']).code, 2);
  assert.strictEqual(runCli(['parse', '--schema']).code, 2);
  assert.strictEqual(runCli(['parse', 'a', 'b']).code, 2);
});

test('cli: missing files and schemas', () => {
  const missing = runCli(['parse', '/definitely/not/here.env']);
  assert.strictEqual(missing.code, 2);
  assert.strictEqual(missing.err, 'envcheck: cannot read /definitely/not/here.env: no such file\n');
  const noSchema = runCli(['check', example('app.env')]);
  assert.strictEqual(noSchema.code, 2);
  assert.ok(noSchema.err.includes('no schema: pass --schema FILE'), noSchema.err);
  const badSchema = runCli(['check', example('app.env'), '--schema', example('broken.env')]);
  assert.strictEqual(badSchema.code, 2);
  assert.ok(badSchema.err.includes('is not valid JSON'), badSchema.err);
});

test('cli: --help and --version', () => {
  const help = runCli(['--help']);
  assert.strictEqual(help.code, 0);
  assert.ok(help.out.startsWith('usage: envcheck <command>'), help.out);
  assert.ok(help.out.includes('resolve [FILE]'), help.out);
  const version = runCli(['--version']);
  assert.strictEqual(version.out, require('../package.json').version + '\n');
});
