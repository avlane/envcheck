'use strict';

class UsageError extends Error {}

const COMMANDS = ['check', 'parse', 'resolve', 'lint', 'diff'];

const COMMAND_HELP = [
  ['check [FILE]', 'validate an env file against the schema'],
  ['parse [FILE]', 'print the parsed variables as JSON'],
  ['resolve [FILE]', 'print the final values with schema defaults applied'],
  ['lint [FILE]', 'style problems: duplicates, lowercase keys, spaces around ='],
  ['diff A B', 'compare the variables of two env files']
];

const OPTION_HELP = [
  ['-s, --schema FILE', 'schema to use (default: .env.schema.json if present)'],
  ['--show-secrets', 'parse: print secret values instead of ***'],
  ['--values', 'diff: also report variables whose values differ'],
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
  const opts = { command: null, files: [], schema: null, strict: false, values: false, showSecrets: false, help: false, version: false };
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
      case '--show-secrets': opts.showSecrets = true; break;
      case '--values': opts.values = true; break;
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
