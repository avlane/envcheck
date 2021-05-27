'use strict';

const BOOLEAN_WORDS = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'];

function checkUrl(value, spec) {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return 'must be a URL like scheme://host';
  let url;
  try {
    url = new URL(value);
  } catch (err) {
    return 'must be a valid URL';
  }
  const protocol = url.protocol.replace(/:$/, '');
  if (spec.protocols && !spec.protocols.includes(protocol)) {
    return `must use ${spec.protocols.map(p => p + '://').join(' or ')}`;
  }
  return null;
}

const TYPES = {
  string: () => null,
  number: value => (value.trim() !== '' && Number.isFinite(Number(value)) ? null : 'must be a number'),
  integer: value => (/^[+-]?\d+$/.test(value) ? null : 'must be a whole number'),
  boolean: value => (BOOLEAN_WORDS.includes(value.toLowerCase()) ? null : `must be a boolean (${BOOLEAN_WORDS.join(', ')})`),
  port: value => (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535
    ? null
    : 'must be a port number between 1 and 65535'),
  url: checkUrl,
  email: value => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'must be an email address'),
  enum: (value, spec) => (spec.values.includes(value) ? null : `must be one of ${spec.values.join(', ')}`),
  uuid: value => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? null : 'must be a UUID'),
  json: value => {
    try {
      JSON.parse(value);
      return null;
    } catch (err) {
      return 'must be valid JSON';
    }
  }
};

const TYPE_NAMES = Object.keys(TYPES);

// Returns null when value is acceptable for the type, otherwise a message.
function checkType(type, value, spec = {}) {
  return TYPES[type](value, spec);
}

module.exports = { TYPE_NAMES, checkType };
