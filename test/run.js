'use strict';

const fs = require('fs');
const path = require('path');
const { run } = require('./harness');

fs.readdirSync(__dirname)
  .filter(f => /\.test\.js$/.test(f))
  .sort()
  .forEach(f => require(path.join(__dirname, f)));

run().then(failed => {
  process.exitCode = failed ? 1 : 0;
});
