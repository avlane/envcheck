'use strict';

const fs = require('fs');
const { parseEnv, toObject } = require('./parse');
const { parseSchema, SchemaError } = require('./schema');
const { check, byLocation, syntaxProblems } = require('./check');
const { lint } = require('./lint');
const { diffEnv } = require('./diff');
const { display } = require('./redact');
const { expandEntries } = require('./expand');
const { inferSchema } = require('./infer');
const { resolve } = require('./resolve');
const { stringifyEnv } = require('./stringify');
const { formatText, formatJson, formatGithub } = require('./format');

// Trouble that should end the run with exit status 2.
class CliError extends Error {}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    const why = err.code === 'ENOENT' ? 'no such file' : err.message;
    throw new CliError(`cannot read ${file}: ${why}`);
  }
}

function loadSchema(opts) {
  const file = opts.schema ?? (fs.existsSync('.env.schema.json') ? '.env.schema.json' : null);
  if (file === null) throw new CliError('no schema: pass --schema FILE or create .env.schema.json');
  try {
    return parseSchema(readText(file), file);
  } catch (err) {
    if (err instanceof SchemaError) throw new CliError(err.message);
    throw err;
  }
}

// Read the env files in the order given (.env if none); later files override
// earlier ones. Every entry remembers the file it came from.
function loadEnv(opts, io, defaultFile = '.env') {
  const names = opts.files.length > 0 ? opts.files : [defaultFile];
  const files = [];
  const syntax = [];
  let entries = [];
  for (const file of names) {
    const text = readText(file);
    const parsed = parseEnv(text);
    files.push({ file, text, parsed });
    entries = entries.concat(parsed.entries.map(entry => Object.assign({ file }, entry)));
    for (const problem of syntaxProblems(parsed.errors)) syntax.push(Object.assign({ file }, problem));
  }
  let expansionProblems = [];
  if (opts.expand) {
    const expanded = expandEntries(entries, io.env ?? {});
    entries = expanded.entries;
    expansionProblems = expanded.problems;
  }
  return { names, label: names.join(' + '), files, entries, syntax, expansionProblems };
}

// Variables the schema defines that the process environment sets are added
// last, so they take precedence over every file.
function withProcessEnv(entries, schema, env) {
  const fromEnv = Object.keys(schema.vars)
    .filter(key => Object.hasOwn(env, key))
    .map(key => ({ key, value: env[key], line: null, quote: null, file: '(environment)' }));
  return entries.concat(fromEnv);
}

function summarize(errorCount, warningCount) {
  if (errorCount === 0 && warningCount === 0) return 'ok';
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(errorCount, 'error')}, ${plural(warningCount, 'warning')}`;
}

function printSyntax(problems, io) {
  for (const p of problems) io.stderr.write(`${p.file}:${p.line}: ${p.message}\n`);
}

// Print the problems as text, JSON or annotations; returns the number of errors.
function emit(opts, io, label, problems, withSummary) {
  const errorCount = problems.filter(p => p.level === 'error').length;
  if (opts.format === 'json') {
    io.stdout.write(formatJson(label, problems) + '\n');
  } else if (opts.format === 'github') {
    for (const line of formatGithub(label, problems)) io.stdout.write(line + '\n');
  } else {
    for (const line of formatText(problems, label)) io.stdout.write(line + '\n');
    if (withSummary) io.stdout.write(summarize(errorCount, problems.length - errorCount) + '\n');
  }
  return errorCount;
}

function problemsFor(opts, io, schema, env) {
  const entries = opts.processEnv ? withProcessEnv(env.entries, schema, io.env ?? {}) : env.entries;
  return check(entries, schema, { strict: opts.strict })
    .concat(env.expansionProblems, env.syntax)
    .sort(byLocation);
}

function parseCommand(opts, io) {
  const env = loadEnv(opts, io);
  printSyntax(env.syntax, io);
  const values = toObject(env.entries);
  const shown = opts.showSecrets
    ? values
    : Object.fromEntries(Object.entries(values).map(([key, value]) => [key, display(key, value)]));
  io.stdout.write(JSON.stringify(shown, null, 2) + '\n');
  return env.syntax.length > 0 ? 1 : 0;
}

function lintCommand(opts, io) {
  const names = opts.files.length > 0 ? opts.files : ['.env'];
  let problems = [];
  for (const file of names) {
    const text = readText(file);
    const parsed = parseEnv(text);
    const found = lint(text, parsed).concat(syntaxProblems(parsed.errors)).sort(byLocation);
    problems = problems.concat(found.map(p => Object.assign({ file }, p)));
  }
  emit(opts, io, names.join(' + '), problems, false);
  return problems.length > 0 ? 1 : 0;
}

function checkCommand(opts, io) {
  const schema = loadSchema(opts);
  const env = loadEnv(opts, io);
  return emit(opts, io, env.label, problemsFor(opts, io, schema, env), true) > 0 ? 1 : 0;
}

function resolveCommand(opts, io) {
  const schema = loadSchema(opts);
  const env = loadEnv(opts, io);
  const problems = problemsFor(opts, io, schema, env);
  for (const line of formatText(problems, env.label)) io.stderr.write(line + '\n');
  if (problems.some(p => p.level === 'error')) return 1;
  const entries = opts.processEnv ? withProcessEnv(env.entries, schema, io.env ?? {}) : env.entries;
  io.stdout.write(stringifyEnv(resolve(entries, schema).values));
  return 0;
}

function diffCommand(opts, io) {
  if (opts.files.length !== 2) throw new CliError('diff needs two files');
  const [fileA, fileB] = opts.files;
  const a = parseEnv(readText(fileA));
  const b = parseEnv(readText(fileB));
  for (const e of a.errors) io.stderr.write(`${fileA}:${e.line}: ${e.message}\n`);
  for (const e of b.errors) io.stderr.write(`${fileB}:${e.line}: ${e.message}\n`);
  const diff = diffEnv(a.entries, b.entries);
  const lines = [
    ...diff.onlyA.map(key => `- ${key}  only in ${fileA}`),
    ...diff.onlyB.map(key => `+ ${key}  only in ${fileB}`)
  ];
  if (opts.values) lines.push(...diff.changed.map(key => `~ ${key}  values differ`));
  for (const line of lines) io.stdout.write(line + '\n');
  if (lines.length === 0) io.stdout.write('same variables\n');
  return lines.length > 0 || a.errors.length > 0 || b.errors.length > 0 ? 1 : 0;
}

function initCommand(opts, io) {
  if (opts.files.length > 1) throw new CliError('init takes one file');
  const env = loadEnv(opts, io, '.env.example');
  printSyntax(env.syntax, io);
  io.stdout.write(JSON.stringify(inferSchema(env.files[0].text), null, 2) + '\n');
  return 0;
}

module.exports = {
  CliError,
  commands: {
    init: initCommand,
    parse: parseCommand,
    lint: lintCommand,
    check: checkCommand,
    resolve: resolveCommand,
    diff: diffCommand
  }
};
