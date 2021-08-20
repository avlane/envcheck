'use strict';

const path = require('path');
const { Writable } = require('stream');
const { main } = require('../lib/cli');

class Sink extends Writable {
  constructor() {
    super();
    this.text = '';
  }

  _write(chunk, encoding, callback) {
    this.text += chunk;
    callback();
  }
}

const EXAMPLES = path.join(__dirname, '..', 'examples');
const example = name => path.join(EXAMPLES, name);

// Run the CLI in-process: { code, out, err }.
function runCli(args, env = {}) {
  const stdout = new Sink();
  const stderr = new Sink();
  const code = main(args, { stdout, stderr, env });
  return { code, out: stdout.text, err: stderr.text };
}

module.exports = { runCli, example, EXAMPLES };
