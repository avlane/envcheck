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
const { formatText, formatJson } = require('./format');

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

// Read and parse the (single) env file. Syntax errors stay in parsed.errors
// for the caller to report.
function loadEnv(opts, io) {
  if (opts.files.length > 1) throw new CliError(`${opts.command} takes one file, got ${opts.files.length}`);
  const file = opts.files[0] ?? '.env';
  const text = readText(file);
  const parsed = parseEnv(text);
  let expansionProblems = [];
  if (opts.expand) {
    const expanded = expandEntries(parsed.entries, io.env ?? {});
    parsed.entries = expanded.entries;
    expansionProblems = expanded.problems;
  }
  return { file, text, parsed, expansionProblems };
}

function summarize(errorCount, warningCount) {
  if (errorCount === 0 && warningCount === 0) return 'ok';
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(errorCount, 'error')}, ${plural(warningCount, 'warning')}`;
}

function printSyntax(file, parsed, io) {
  for (const e of parsed.errors) io.stderr.write(`${file}:${e.line}: ${e.message}\n`);
}

// Print the problems as text or JSON; returns the number of errors.
function emit(opts, io, file, problems, withSummary) {
  const errorCount = problems.filter(p => p.level === 'error').length;
  if (opts.format === 'json') {
    io.stdout.write(formatJson(file, problems) + '\n');
  } else {
    for (const line of formatText(problems, file)) io.stdout.write(line + '\n');
    if (withSummary) io.stdout.write(summarize(errorCount, problems.length - errorCount) + '\n');
  }
  return errorCount;
}

function parseCommand(opts, io) {
  const { file, parsed } = loadEnv(opts, io);
  printSyntax(file, parsed, io);
  const values = toObject(parsed.entries);
  const shown = opts.showSecrets
    ? values
    : Object.fromEntries(Object.entries(values).map(([key, value]) => [key, display(key, value)]));
  io.stdout.write(JSON.stringify(shown, null, 2) + '\n');
  return parsed.errors.length > 0 ? 1 : 0;
}

function lintCommand(opts, io) {
  const { file, text, parsed } = loadEnv(opts, io);
  const problems = lint(text, parsed).concat(syntaxProblems(parsed.errors)).sort(byLocation);
  emit(opts, io, file, problems, false);
  return problems.length > 0 ? 1 : 0;
}

function checkCommand(opts, io) {
  const schema = loadSchema(opts);
  const { file, parsed, expansionProblems } = loadEnv(opts, io);
  const problems = check(parsed.entries, schema, { strict: opts.strict })
    .concat(expansionProblems, syntaxProblems(parsed.errors))
    .sort(byLocation);
  return emit(opts, io, file, problems, true) > 0 ? 1 : 0;
}

function resolveCommand(opts, io) {
  const schema = loadSchema(opts);
  const { file, parsed, expansionProblems } = loadEnv(opts, io);
  const problems = check(parsed.entries, schema, { strict: opts.strict })
    .concat(expansionProblems, syntaxProblems(parsed.errors))
    .sort(byLocation);
  for (const line of formatText(problems, file)) io.stderr.write(line + '\n');
  if (problems.some(p => p.level === 'error')) return 1;
  io.stdout.write(stringifyEnv(resolve(parsed.entries, schema).values));
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
  const source = opts.files.length > 0 ? opts : Object.assign({}, opts, { files: ['.env.example'] });
  const { file, text, parsed } = loadEnv(source, io);
  printSyntax(file, parsed, io);
  io.stdout.write(JSON.stringify(inferSchema(text), null, 2) + '\n');
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
