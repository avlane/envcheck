#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseEnv } = require('../lib/parse');

const file = process.argv[2] || '.env';
console.log(JSON.stringify(parseEnv(fs.readFileSync(file, 'utf8')), null, 2));
