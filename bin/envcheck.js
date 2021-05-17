#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseEnv, toObject } = require('../lib/parse');
const { parseSchema, SchemaError } = require('../lib/schema');
const { check } = require('../lib/check');
const { formatText } = require('../lib/format');

function fail(message) {
  console.error('envcheck: ' + message);
  process.exit(2);
}

const args = process.argv.slice(2);
const command = ['check', 'parse'].includes(args[0]) ? args.shift() : 'parse';
let schemaFile = null;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--schema') schemaFile = args[++i];
  else files.push(args[i]);
}
const file = files[0] || '.env';
const { entries, errors } = parseEnv(fs.readFileSync(file, 'utf8'));
for (const e of errors) console.error(`${file}:${e.line}: ${e.message}`);

if (command === 'parse') {
  console.log(JSON.stringify(toObject(entries), null, 2));
  process.exitCode = errors.length > 0 ? 1 : 0;
} else {
  if (!schemaFile) fail('check needs --schema FILE');
  let schema;
  try {
    schema = parseSchema(fs.readFileSync(schemaFile, 'utf8'), schemaFile);
  } catch (err) {
    if (!(err instanceof SchemaError)) throw err;
    fail(err.message);
  }
  const problems = check(entries, schema);
  for (const line of formatText(problems, file)) console.log(line);
  console.log(problems.length === 0 && errors.length === 0 ? 'ok' : `${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  process.exitCode = problems.length > 0 || errors.length > 0 ? 1 : 0;
}
