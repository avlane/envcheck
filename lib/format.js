'use strict';

// One line per problem: file:line  level  KEY  message
function formatText(problems, file) {
  return problems.map(p => `${file}${p.line ? ':' + p.line : ''}  ${p.level}  ${p.key ? p.key + '  ' : ''}${p.message}`);
}

// { file, ok, errors, warnings, problems } as indented JSON.
function formatJson(file, problems) {
  const errors = problems.filter(p => p.level === 'error').length;
  return JSON.stringify({ file, ok: errors === 0, errors, warnings: problems.length - errors, problems }, null, 2);
}

module.exports = { formatText, formatJson };
