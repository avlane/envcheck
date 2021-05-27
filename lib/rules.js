'use strict';

const { checkType } = require('./types');

// Returns null if value satisfies the schema entry, otherwise a message.
// `pattern` is an ordinary regular expression, tested unanchored.
function validateValue(value, spec) {
  const typeMessage = checkType(spec.type ?? 'string', value, spec);
  if (typeMessage !== null) return typeMessage;
  if (spec.pattern !== undefined && !new RegExp(spec.pattern).test(value)) {
    return `must match ${spec.pattern}`;
  }
  if (spec.min !== undefined || spec.max !== undefined) {
    const n = Number(value);
    if (spec.min !== undefined && n < spec.min) return `must be at least ${spec.min}`;
    if (spec.max !== undefined && n > spec.max) return `must be at most ${spec.max}`;
  }
  if (spec.minLength !== undefined && value.length < spec.minLength) {
    return `must be at least ${spec.minLength} characters`;
  }
  if (spec.maxLength !== undefined && value.length > spec.maxLength) {
    return `must be at most ${spec.maxLength} characters`;
  }
  return null;
}

module.exports = { validateValue };
