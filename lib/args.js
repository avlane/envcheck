'use strict';

class UsageError extends Error {}

const COMMANDS = ['check', 'parse', 'resolve', 'lint'];

const COMMAND_HELP = [
  ['check [FILE]', 'validate an env file against the schema'],
  ['parse [FILE]', 'print the parsed variables as JSON'],
  ['resolve [FILE]', 'print the final values with schema defaults applied'],
  ['lint [FILE]', 'style problems: duplicates, lowercase keys, spaces around =']
];

const OPTION_HELP = [
  ['-s, --schema FILE', 'schema to use (default: .env.schema.json if present)'],
  ['--strict', 'treat variables missing from the schema as errors'],
  ['-V, --version', 'print the version'],
  ['-h, --help', 'show this help']
];

const table = rows => rows.map(([left, right]) => `  ${left.padEnd(20)}${right}`);

const USAGE = [
  'usage: envcheck <command> [options] [FILE]',
  '',
  'FILE defaults to .env.',
  '',
  'Commands:',
  ...table(COMMAND_HELP),
  '',
  'Options:',
  ...table(OPTION_HELP)
].join('\n');

function readArgs(argv) {
  const opts = { command: null, files: [], schema: null, strict: false, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const value = () => {
      const v = inline !== undefined ? inline : argv[++i];
      if (v === undefined) throw new UsageError(`${name} needs a value`);
      return v;
    };
    switch (name) {
      case '-s': case '--schema': opts.schema = value(); break;
      case '--strict': opts.strict = true; break;
      case '-V': case '--version': opts.version = true; break;
      case '-h': case '--help': opts.help = true; break;
      default:
        if (arg.startsWith('-') && arg !== '-') throw new UsageError(`unknown option: ${arg}`);
        if (opts.command === null) {
          if (!COMMANDS.includes(arg)) throw new UsageError(`unknown command: ${arg}`);
          opts.command = arg;
        } else {
          opts.files.push(arg);
        }
    }
  }
  return opts;
}

module.exports = { readArgs, UsageError, USAGE, COMMANDS };
