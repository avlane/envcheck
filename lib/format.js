'use strict';

// One line per problem: file:line  level  KEY  message
function formatText(problems, file) {
  return problems.map(p => `${p.file ?? file}${p.line ? ':' + p.line : ''}  ${p.level}  ${p.key ? p.key + '  ' : ''}${p.message}`);
}

// { file, ok, errors, warnings, problems } as indented JSON.
function formatJson(file, problems) {
  const errors = problems.filter(p => p.level === 'error').length;
  return JSON.stringify({ file, ok: errors === 0, errors, warnings: problems.length - errors, problems }, null, 2);
}

function escapeData(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(text) {
  return escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

// GitHub Actions workflow commands: ::error file=.env,line=3,title=PORT::message
function formatGithub(file, problems) {
  return problems.map(p => {
    const properties = [`file=${escapeProperty(p.file ?? file)}`];
    if (p.line) properties.push(`line=${p.line}`);
    if (p.key) properties.push(`title=${escapeProperty(p.key)}`);
    return `::${p.level} ${properties.join(',')}::${escapeData(p.message)}`;
  });
}

module.exports = { formatText, formatJson, formatGithub };
