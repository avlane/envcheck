'use strict';

const { readArgs, UsageError, USAGE } = require('./args');
const { commands, CliError } = require('./commands');

// io is { stdout, stderr }. Returns the exit status.
function main(argv, io) {
  let opts;
  try {
    opts = readArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    io.stderr.write(`envcheck: ${err.message}\n(run envcheck --help for usage)\n`);
    return 2;
  }
  if (opts.help) {
    io.stdout.write(USAGE + '\n');
    return 0;
  }
  if (opts.version) {
    io.stdout.write(require('../package.json').version + '\n');
    return 0;
  }
  if (opts.command === null) {
    io.stderr.write('envcheck: no command given\n(run envcheck --help for usage)\n');
    return 2;
  }
  try {
    return commands[opts.command](opts, io);
  } catch (err) {
    if (!(err instanceof CliError)) throw err;
    io.stderr.write(`envcheck: ${err.message}\n`);
    return 2;
  }
}

module.exports = { main };
