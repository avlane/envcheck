'use strict';

const SECRET_NAME = /SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|CREDENTIAL|API_?KEY|(^|_)KEY$/i;

// spec is the schema entry, if there is one. "secret": false opts a name out.
function isSecret(key, spec) {
  if (spec && spec.secret !== undefined) return spec.secret === true;
  return SECRET_NAME.test(key);
}

// scheme://user:password@host -> scheme://user:***@host
function maskUrl(value) {
  return value.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:)[^/\s@]*@/i, '$1***@');
}

// The value as it may be shown to people: secrets become ***.
function display(key, value, spec) {
  if (isSecret(key, spec)) return value === '' ? '' : '***';
  return maskUrl(value);
}

module.exports = { isSecret, maskUrl, display };
