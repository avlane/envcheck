'use strict';

class UsageError extends Error {}

const COMMANDS = ['check', 'parse', 'resolve', 'lint', 'diff', 'init'];

const COMMAND_HELP = [
  ['check [FILE...]', 'validate env files (later ones override) against the schema'],
  ['parse [FILE...]', 'print the parsed variables as JSON'],
  ['resolve [FILE...]', 'print the final values with schema defaults applied'],
  ['lint [FILE...]', 'style problems: duplicates, lowercase keys, spaces around ='],
  ['diff A B', 'compare the variables of two env files'],
  ['init [FILE]', 'print a starter schema from an example env file (default .env.example)']
];

const OPTION_HELP = [
  ['-s, --schema FILE', 'schema to use (default: .env.schema.json if present)'],
  ['--format FMT', 'check, lint: text (default), json or github'],
  ['--process-env', 'check, resolve: variables from the environment override the files'],
  ['--expand', 'expand ${VAR} references before checking'],
  ['--show-secrets', 'parse: print secret values instead of ***'],
  ['--values', 'diff: also report variables whose values differ'],
  ['--strict', 'treat variables missing from the schema as errors'],
  ['-V, --version', 'print the version'],
  ['-h, --help', 'show this help']
];

const table = rows => rows.map(([left, right]) => `  ${left.padEnd(20)}${right}`);

const USAGE = [
  'usage: envcheck <command> [options] [FILE...]',
  '',
  'FILE defaults to .env. When several files are given, later ones override earlier ones.',
  '',
  'Commands:',
  ...table(COMMAND_HELP),
  '',
  'Options:',
  ...table(OPTION_HELP)
].join('\n');

function readArgs(argv) {
  const opts = { command: null, files: [], schema: null, strict: false, values: false, showSecrets: false, expand: false, processEnv: false, format: 'text', help: false, version: false };
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
      case '--format': {
        opts.format = value();
        if (!['text', 'json', 'github'].includes(opts.format)) throw new UsageError('--format must be text, json or github');
        break;
      }
      case '--process-env': opts.processEnv = true; break;
      case '--expand': opts.expand = true; break;
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
