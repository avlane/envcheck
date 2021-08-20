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

test('cli: parse hides secrets unless asked', () => {
  const hidden = JSON.parse(runCli(['parse', example('app.env')]).out);
  assert.strictEqual(hidden.API_KEY, '***');
  assert.strictEqual(hidden.DATABASE_URL, 'postgres://shop:***@db.example.com:5432/shop');
  assert.strictEqual(hidden.PORT, '8080');
  const shown = JSON.parse(runCli(['parse', example('app.env'), '--show-secrets']).out);
  assert.strictEqual(shown.API_KEY, 'abc123def456ghi789');
  assert.ok(shown.DATABASE_URL.includes('s3cret'));
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

test('cli: --expand resolves references before checking and resolving', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const schema = path.join(dir, 'schema.json');
  const env = path.join(dir, 'x.env');
  fs.writeFileSync(schema, '{"vars": {"HOST": {"required": true}, "URL": {"type": "url", "required": true}}}');
  fs.writeFileSync(env, 'HOST=db.example.com\nURL=postgres://${HOST}/app\n');
  try {
    const without = runCli(['check', env, '--schema', schema]);
    assert.strictEqual(without.code, 0);
    const resolved = runCli(['resolve', env, '--schema', schema, '--expand']);
    assert.strictEqual(resolved.out, 'HOST=db.example.com\nURL=postgres://db.example.com/app\n');
    fs.writeFileSync(env, 'HOST=db\nURL=postgres://${HOSTNAME}/app\n');
    const broken = runCli(['check', env, '--schema', schema, '--expand']);
    assert.strictEqual(broken.code, 1);
    assert.ok(broken.out.includes(':2  error  URL  refers to HOSTNAME'), broken.out);
  } finally {
    fs.unlinkSync(schema);
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

test('cli: init writes a schema that check accepts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const schema = path.join(dir, 'schema.json');
  try {
    const init = runCli(['init', example('app.env')]);
    assert.strictEqual(init.code, 0);
    fs.writeFileSync(schema, init.out);
    const checked = runCli(['check', example('app.env'), '--schema', schema]);
    assert.strictEqual(checked.code, 0);
    assert.strictEqual(checked.out, 'ok\n');
    const broken = runCli(['check', example('broken.env'), '--schema', schema]);
    assert.strictEqual(broken.code, 1);
  } finally {
    fs.unlinkSync(schema);
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
  assert.ok(help.out.includes('resolve [FILE...]'), help.out);
  const version = runCli(['--version']);
  assert.strictEqual(version.out, require('../package.json').version + '\n');
});

test('cli: --format json', () => {
  const { code, out, err } = runCli(['check', example('broken.env'), '--schema', SCHEMA, '--format', 'json']);
  assert.strictEqual(code, 1);
  assert.strictEqual(err, '');
  const report = JSON.parse(out);
  assert.strictEqual(report.ok, false);
  assert.strictEqual(report.errors, 7);
  assert.strictEqual(report.warnings, 1);
  assert.strictEqual(report.problems[0].key, 'APP_NAME');
  assert.strictEqual(report.problems[0].line, 1);
  const good = JSON.parse(runCli(['check', example('app.env'), '-s', SCHEMA, '--format=json']).out);
  assert.deepStrictEqual([good.ok, good.errors, good.warnings, good.problems], [true, 0, 0, []]);
  const lintReport = JSON.parse(runCli(['lint', example('app.env'), '--format', 'json']).out);
  assert.strictEqual(lintReport.ok, true);
  assert.strictEqual(runCli(['check', example('app.env'), '-s', SCHEMA, '--format', 'xml']).code, 2);
});

test('cli: --format github prints annotations and no summary', () => {
  const { code, out } = runCli(['check', example('broken.env'), '--schema', SCHEMA, '--format', 'github']);
  assert.strictEqual(code, 1);
  const lines = out.trimEnd().split('\n');
  assert.strictEqual(lines.length, 8);
  assert.ok(lines[0].startsWith('::error file='), lines[0]);
  assert.ok(lines[0].endsWith(',line=1,title=APP_NAME::is required but empty'), lines[0]);
  assert.ok(lines[7].startsWith('::warning file='), lines[7]);
  assert.strictEqual(runCli(['check', example('app.env'), '-s', SCHEMA, '--format', 'github']).out, '');
});

test('cli: syntax errors are listed with the other problems', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const env = path.join(dir, 'x.env');
  const schema = path.join(dir, 'schema.json');
  fs.writeFileSync(env, 'NAME=ok\nthis is wrong\n');
  fs.writeFileSync(schema, '{"vars": {"NAME": {"required": true}}}');
  try {
    const { code, out, err } = runCli(['check', env, '--schema', schema]);
    assert.strictEqual(code, 1);
    assert.strictEqual(err, '');
    assert.ok(out.includes(':2  error  expected KEY=value'), out);
    assert.ok(out.trimEnd().endsWith('1 error, 0 warnings'), out);
    const json = JSON.parse(runCli(['check', env, '--schema', schema, '--format', 'json']).out);
    assert.deepStrictEqual(json.problems.map(p => p.code), ['syntax']);
  } finally {
    fs.unlinkSync(env);
    fs.unlinkSync(schema);
    fs.rmdirSync(dir);
  }
});

function withFiles(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envcheck-test-'));
  const paths = {};
  for (const [name, content] of Object.entries(files)) {
    paths[name] = path.join(dir, name);
    fs.writeFileSync(paths[name], content);
  }
  try {
    return fn(paths);
  } finally {
    for (const file of Object.values(paths)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
}

const LAYER_SCHEMA = '{"vars": {"NAME": {"required": true}, "PORT": {"type": "port"}, "API_URL": {"type": "url", "required": true}}}';

test('cli: later files override earlier ones', () => {
  withFiles({ 'base.env': 'NAME=base\nPORT=3000\nAPI_KEY=abc\n', 'local.env': 'PORT=4000\n' }, f => {
    const values = JSON.parse(runCli(['parse', f['base.env'], f['local.env']]).out);
    assert.deepStrictEqual(values, { NAME: 'base', PORT: '4000', API_KEY: '***' });
  });
});

test('cli: a layer can supply what an earlier file lacks', () => {
  withFiles({ 'schema.json': LAYER_SCHEMA, 'base.env': 'NAME=x\n', 'local.env': 'API_URL=https://api.example.com\n' }, f => {
    assert.strictEqual(runCli(['check', f['base.env'], '--schema', f['schema.json']]).code, 1);
    const both = runCli(['check', f['base.env'], f['local.env'], '--schema', f['schema.json']]);
    assert.strictEqual(both.code, 0);
    assert.strictEqual(both.out, 'ok\n');
  });
});

test('cli: problems name the file whose value is in force', () => {
  withFiles({ 'schema.json': LAYER_SCHEMA, 'base.env': 'NAME=x\nPORT=3000\nAPI_URL=https://a.example.com\n', 'local.env': 'PORT=oops\n' }, f => {
    const { code, out } = runCli(['check', f['base.env'], f['local.env'], '--schema', f['schema.json']]);
    assert.strictEqual(code, 1);
    assert.ok(out.includes(`${f['local.env']}:1  error  PORT  must be a port number`), out);
    assert.ok(!out.includes(`${f['base.env']}:2`), out);
  });
});

test('cli: variables missing from every layer are attributed to all of them', () => {
  withFiles({ 'schema.json': LAYER_SCHEMA, 'a.env': 'NAME=x\n', 'b.env': 'PORT=80\n' }, f => {
    const { out } = runCli(['check', f['a.env'], f['b.env'], '--schema', f['schema.json']]);
    assert.ok(out.includes(`${f['a.env']} + ${f['b.env']}  error  API_URL  is required but missing`), out);
  });
});

test('cli: --process-env lets the environment win', () => {
  withFiles({ 'schema.json': LAYER_SCHEMA, 'a.env': 'NAME=x\nPORT=80\nAPI_URL=https://a.example.com\n' }, f => {
    const args = ['check', f['a.env'], '--schema', f['schema.json']];
    assert.strictEqual(runCli(args, { PORT: 'nope' }).code, 0);
    const { code, out } = runCli(args.concat('--process-env'), { PORT: 'nope', UNRELATED: '1' });
    assert.strictEqual(code, 1);
    assert.ok(out.includes('(environment)  error  PORT  must be a port number'), out);
    assert.ok(!out.includes('UNRELATED'), out);
    const filled = runCli(['resolve', f['a.env'], '--schema', f['schema.json'], '--process-env'], { NAME: 'from-env' });
    assert.ok(filled.out.startsWith('NAME=from-env\n'), filled.out);
  });
});

test('cli: lint checks each file on its own', () => {
  withFiles({ 'one.env': 'A=1\n', 'two.env': 'b=2\nB=3\n' }, f => {
    const { code, out } = runCli(['lint', f['one.env'], f['two.env']]);
    assert.strictEqual(code, 1);
    const lines = out.trimEnd().split('\n');
    assert.strictEqual(lines.length, 1);
    assert.ok(lines[0].startsWith(`${f['two.env']}:1  warning  b  should be UPPER_CASE`), lines[0]);
  });
});

test('cli: init takes a single file', () => {
  assert.strictEqual(runCli(['init', example('app.env'), example('app.env')]).code, 2);
});
