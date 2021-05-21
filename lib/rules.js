'use strict';

const { checkType } = require('./types');

// Returns null if value satisfies the schema entry, otherwise a message.
function validateValue(value, spec) {
  return checkType(spec.type ?? 'string', value, spec);
}

module.exports = { validateValue };
