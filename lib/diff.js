'use strict';

// Compare two parsed env files by key. Later assignments win in each file.
function diffEnv(entriesA, entriesB) {
  const a = new Map(entriesA.map(e => [e.key, e.value]));
  const b = new Map(entriesB.map(e => [e.key, e.value]));
  return {
    onlyA: [...a.keys()].filter(key => !b.has(key)),
    onlyB: [...b.keys()].filter(key => !a.has(key)),
    changed: [...a.keys()].filter(key => b.has(key) && a.get(key) !== b.get(key))
  };
}

module.exports = { diffEnv };
