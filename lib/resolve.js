'use strict';

const { toObject } = require('./parse');

// The values an application will see: what the file sets plus the schema's
// defaults for anything it leaves out. `defaulted` lists the keys that came
// from defaults.
function resolve(entries, schema) {
  const values = toObject(entries);
  const defaulted = [];
  for (const [key, spec] of Object.entries(schema.vars)) {
    if (!Object.prototype.hasOwnProperty.call(values, key) && spec.default !== undefined) {
      values[key] = spec.default;
      defaulted.push(key);
    }
  }
  return { values, defaulted };
}

module.exports = { resolve };
