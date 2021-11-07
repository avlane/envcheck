# envcheck

Validate `.env` files against a schema before an app starts with a missing or
malformed setting. No dependencies; needs Node 16.9 or newer.

    node bin/envcheck.js check .env --schema .env.schema.json

    .env:3  error  PORT  must be a port number between 1 and 65535 (got "99999")
    .env:8  warning  UNUSED_FLAG  is not in the schema
    .env  error  SENTRY_ENV  is required when SENTRY_DSN is set but missing
    2 errors, 1 warning

The exit status is 0 when nothing is wrong, 1 when problems were found and 2
for usage or schema trouble. Warnings alone do not fail a run.

## Commands

    envcheck check [FILE...]    validate env files (later ones override earlier ones)
    envcheck parse [FILE...]    print the parsed variables as JSON (secrets masked)
    envcheck resolve [FILE...]  print the final values with schema defaults applied
    envcheck lint [FILE...]     style problems in the files themselves
    envcheck diff A B           compare the variables of two files
    envcheck init [FILE]        write a starter schema from an example file

FILE defaults to `.env` (`.env.example` for `init`). The schema comes from
`--schema FILE`, or `.env.schema.json` in the current directory.

Options: `--strict` (variables missing from the schema become errors),
`--expand` (resolve `${VAR}` references first), `--process-env` (the process
environment wins over the files), `--show-secrets`, `--values` (for `diff`),
`--format text|json|github` (for `check` and `lint`), `--version`, `--help`.

`--format github` prints `::error file=...,line=...::` lines, so a CI step
shows problems as annotations on the pull request.

## The schema

A JSON file with a `vars` object. Each variable can have:

| property | meaning |
| --- | --- |
| `type` | `string` (default), `number`, `integer`, `boolean`, `port`, `url`, `email`, `uuid`, `json` or `enum` |
| `required` | must be set and non-empty |
| `requiredIf` | required only when other variables match, e.g. `{"DB_SSL": "true"}`, a list of values, or `true` for "is set" |
| `default` | used when the variable is missing (a string); not allowed together with `required` |
| `values` | the allowed values for `enum` |
| `protocols` | allowed schemes for `url`, e.g. `["postgres", "postgresql"]` |
| `pattern` | a regular expression the value must match (unanchored) |
| `min`, `max` | limits for `number`, `integer` and `port` |
| `minLength`, `maxLength` | limits on the length of the value |
| `secret` | never print the value (names like `*_KEY`, `*_SECRET` and `*_TOKEN` are secret by default) |
| `deprecated` | a message; the variable is flagged whenever it is set |
| `description` | documentation for people |

Top level: `allowUnknown: true` stops variables that are not in the schema from
being reported. Typos in the schema itself (an unknown property, a bad regular
expression, `min` above `max`) are errors when it loads. See
`examples/schema.json`.

## The .env syntax

`KEY=value`, optionally with `export` in front. Double quotes understand `\n`,
`\t`, `\"` and `\\`; single quotes are literal; quoted values may span lines.
An unquoted value ends at ` #`. Later assignments of the same key win.

## Secrets

Values of secret variables never appear in messages, and passwords inside URLs
are shown as `***`. `parse` masks them too unless you pass `--show-secrets`.
`resolve` prints real values on purpose, since its output is meant to be used.

## Development

    npm test

Tests use plain `assert`. `examples/` holds a good and a bad env file and the
schema they are checked against.
