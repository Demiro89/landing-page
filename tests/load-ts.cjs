const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Run the repository's TypeScript with explicit dependency mocks, without a DB.
function createLoader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(__dirname, '..', file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(filename, mod);
    const nativeRequire = mod.require.bind(mod);
    mod.require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'server-only') return {}; // Next's build-time boundary is not a Node runtime module.
      const target = name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (target === path.resolve(__dirname, '..', 'lib/prisma')) return { prisma: new Proxy({}, { get() { throw new Error('A unit test attempted an unmocked database operation'); } }) };
      if (target && fs.existsSync(`${target}.ts`)) return load(path.relative(path.resolve(__dirname, '..'), `${target}.ts`));
      return nativeRequire(name);
    };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    mod._compile(output, filename);
    return mod.exports;
  }
  return load;
}

module.exports = { createLoader };
