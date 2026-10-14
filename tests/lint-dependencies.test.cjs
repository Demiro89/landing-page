const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { ESLint } = require('eslint');

const root = path.resolve(__dirname, '..');
const pluginRequire = createRequire(require.resolve('@next/eslint-plugin-next'));
const { getRootDirs } = pluginRequire('./utils/get-root-dirs');
const normalize = values => values.map(value => path.resolve(value)).sort();

test('Next lint glob replacement removes the vulnerable chain and preserves directory discovery', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(pluginRequire('fast-glob/package.json').name, '@streammalin/next-lint-glob');
  for (const name of ['braces', 'micromatch']) {
    assert.ok(!Object.keys(lock.packages).some(location => location.endsWith(`/node_modules/${name}`) || location === `node_modules/${name}`), `${name} must not return through a different dependency`);
  }
  assert.ok(!Object.values(lock.packages).some(pkg => /fast-glob-\d/.test(pkg.resolved || '')), 'The original fast-glob tarball must not be installed');
  assert.throws(() => pluginRequire('fast-glob').globSync(root, { onlyFiles: true }), /Unsupported/);
  const discover = rootDir => normalize(getRootDirs({ cwd: root, settings: { next: { rootDir } } }));
  assert.deepEqual(discover(undefined), [root]);
  assert.deepEqual(discover(root), [root]);
  assert.deepEqual(discover(`${root}/components/{admin,does-not-exist}`), [path.join(root, 'components/admin')]);
  assert.deepEqual(discover([`${root}/components/admin`, `${root}/app/api`]), normalize([`${root}/components/admin`, `${root}/app/api`]));
  assert.deepEqual(discover(`${root}/package.json`), [], 'Only directories can become application roots');
  assert.deepEqual(discover(`${root}/does-not-exist-*`), []);
});

test('Real Next ESLint configuration still rejects invalid navigation and images after the replacement', async () => {
  const eslint = new ESLint({ cwd: root, overrideConfig: { settings: { next: { rootDir: root } } } });
  const options = { filePath: 'app/lint-dependency-probe.tsx' };
  const [bad] = await eslint.lintText('export default function Page() { return <a href="/">Home</a>; }', options);
  assert.ok(bad.messages.some(message => message.ruleId === '@next/next/no-html-link-for-pages' && message.severity === 2), JSON.stringify(bad.messages));
  const [image] = await eslint.lintText('export default function Page() { return <img src="/test.png" alt="Test" />; }', options);
  assert.ok(image.messages.some(message => message.ruleId === '@next/next/no-img-element'));
  const [good] = await eslint.lintText('import Link from "next/link"; export default function Page() { return <Link href="/espace-client/">Account</Link>; }', options);
  assert.equal(good.errorCount, 0);
  assert.equal(good.warningCount, 0);
});
