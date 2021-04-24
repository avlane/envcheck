#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseEnv, toObject } = require('../lib/parse');

const file = process.argv[2] || '.env';
const { entries, errors } = parseEnv(fs.readFileSync(file, 'utf8'));
for (const e of errors) console.error(`${file}:${e.line}: ${e.message}`);
console.log(JSON.stringify(toObject(entries), null, 2));
process.exitCode = errors.length > 0 ? 1 : 0;
