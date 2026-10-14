const { globSync, isDynamicPattern } = require('tinyglobby');
const { statSync } = require('node:fs');

// Only the API used by Next 16.3.8's getRootDirs is supported. Never expand a
// matched root into all its descendants: fast-glob does not do that implicitly.
exports.globSync = (pattern, options) => {
  if (typeof pattern !== 'string' || !pattern || !options || options.onlyDirectories !== true || Object.keys(options).length !== 1) {
    throw new TypeError('Unsupported Next lint glob call; review the dependency override before upgrading');
  }
  // tinyglobby treats an exact cwd as an empty pattern when expansion is off.
  if (!isDynamicPattern(pattern)) return statSync(pattern, { throwIfNoEntry: false })?.isDirectory() ? [pattern] : [];
  return globSync(pattern, { onlyDirectories: true, expandDirectories: false });
};
