'use strict';

const SAFE = /^[A-Za-z0-9_.,:/@%+=?&~-]*$/;

function quote(value) {
  return '"' + value
    .replace(/[\\"]/g, '\\$&')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"';
}

// { KEY: value } -> .env text that parseEnv() reads back to the same values.
function stringifyEnv(values) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${SAFE.test(value) ? value : quote(value)}`);
  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}

module.exports = { stringifyEnv };
