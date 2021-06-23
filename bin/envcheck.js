#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseEnv, toObject } = require('../lib/parse');
const { parseSchema, SchemaError } = require('../lib/schema');
const { check } = require('../lib/check');
const { lint } = require('../lib/lint');
const { resolve } = require('../lib/resolve');
const { stringifyEnv } = require('../lib/stringify');
const { formatText } = require('../lib/format');

function fail(message) {
  console.error('envcheck: ' + message);
  process.exit(2);
}

function summarize(errorCount, warningCount) {
  if (errorCount === 0 && warningCount === 0) return 'ok';
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(errorCount, 'error')}, ${plural(warningCount, 'warning')}`;
}

const args = process.argv.slice(2);
const command = ['check', 'parse', 'resolve', 'lint'].includes(args[0]) ? args.shift() : 'parse';
let schemaFile = null;
let strict = false;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--schema') schemaFile = args[++i];
  else if (args[i] === '--strict') strict = true;
  else files.push(args[i]);
}
const file = files[0] || '.env';
const text = fs.readFileSync(file, 'utf8');
const { entries, errors } = parseEnv(text);
for (const e of errors) console.error(`${file}:${e.line}: ${e.message}`);

if (command === 'lint') {
  const problems = lint(text, { entries, errors });
  for (const line of formatText(problems, file)) console.log(line);
  process.exitCode = problems.length > 0 || errors.length > 0 ? 1 : 0;
} else if (command === 'parse') {
  console.log(JSON.stringify(toObject(entries), null, 2));
  process.exitCode = errors.length > 0 ? 1 : 0;
} else {
  if (!schemaFile) fail(`${command} needs --schema FILE`);
  let schema;
  try {
    schema = parseSchema(fs.readFileSync(schemaFile, 'utf8'), schemaFile);
  } catch (err) {
    if (!(err instanceof SchemaError)) throw err;
    fail(err.message);
  }
  const problems = check(entries, schema, { strict });
  const errorCount = problems.filter(p => p.level === 'error').length;
  const warningCount = problems.length - errorCount;
  const failed = errorCount > 0 || errors.length > 0;
  if (command === 'resolve') {
    for (const line of formatText(problems, file)) console.error(line);
    if (failed) process.exitCode = 1;
    else process.stdout.write(stringifyEnv(resolve(entries, schema).values));
  } else {
    for (const line of formatText(problems, file)) console.log(line);
    console.log(summarize(errorCount, warningCount));
    process.exitCode = failed ? 1 : 0;
  }
}
