'use strict';

// One line per problem: file:line  level  KEY  message
function formatText(problems, file) {
  return problems.map(p => `${file}${p.line ? ':' + p.line : ''}  ${p.level}  ${p.key}  ${p.message}`);
}

module.exports = { formatText };
