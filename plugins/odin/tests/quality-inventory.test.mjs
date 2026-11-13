import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const script = fileURLToPath(new URL('../skills/dev-loop/scripts/inspecionar-git.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'odin-quality-inventory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  git('init', '-q'); mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/a.js'), 'old\n'); writeFileSync(join(root, 'src/deleted.js'), 'old\n');
  git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
  const base = git('rev-parse', 'HEAD').trim();
  const inspect = (paths, ref = base) => spawnSync(process.execPath, [script, 'quality', JSON.stringify(paths), ref], { cwd: root, env, encoding: 'utf8' });
  return { root, git, inspect };
}
function supported(inspect) {
  const result = inspect(['src/a.js']);
  assert.equal(result.status, 0, `quality inventory must be executable: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  assert.ok(Array.isArray(data.files)); assert.ok(Array.isArray(data.uninspected)); assert.ok(Array.isArray(data.errors));
  return data;
}
test('A2 measures real text bytes lines binary deletion and new-file reconciliation', t => {
  const { root, inspect } = fixture(t);
  const text = 'é\n'.repeat(401);
  writeFileSync(join(root, 'src/a.js'), text); rmSync(join(root, 'src/deleted.js'));
  writeFileSync(join(root, 'src/new.js'), 'export const answer = 42;\n');
  writeFileSync(join(root, 'src/image.bin'), Buffer.from([1, 0, 2]));
  writeFileSync(join(root, 'src/unapproved.js'), 'private new file\n');
  supported(inspect);
  const before = readFileSync(join(root, '.git/index'));
  const result = inspect(['src/a.js', 'src/deleted.js', 'src/new.js', 'src/image.bin']);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  const file = path => data.files.find(f => f.path === path);
  assert.equal(file('src/a.js').lines, 401); assert.equal(file('src/a.js').bytes, Buffer.byteLength(text));
  assert.equal(file('src/a.js').status, 'text');
  assert.equal(file('src/new.js').lines, 1);
  assert.equal(file('src/image.bin').status, 'binary');
  assert.deepEqual(file('src/deleted.js'), { path: 'src/deleted.js', lines: 0, bytes: 0, status: 'deleted' });
  assert.ok(JSON.stringify(data.uninspected).includes('src/unapproved.js'), 'Unapproved new file must remain visible');
  assert.ok(!data.files.some(f => f.path === 'src/unapproved.js'));
  assert.ok(!result.stdout.includes('export const answer'), 'Inventory must not dump file contents');
  assert.deepEqual(readFileSync(join(root, '.git/index')), before);
});
test('A2 refuses escapes and missing targets instead of inventing inspection', t => {
  const { root, inspect } = fixture(t); supported(inspect);
  symlinkSync(tmpdir(), join(root, 'src/external'));
  for (const path of ['../outside.js', '/etc/passwd', '.git/config', 'src/external/nope.js', 'src//a.js', 'src/a.js\n']) {
    const result = inspect([path]); assert.notEqual(result.status, 0, path);
  }
  const missing = inspect(['src/missing.js']);
  if (missing.status === 0) {
    const data = JSON.parse(missing.stdout);
    assert.ok(data.errors.length || JSON.stringify(data.uninspected).includes('src/missing.js'));
    assert.ok(!data.files.some(f => f.path === 'src/missing.js'));
  } else assert.match(missing.stderr, /missing|inspec|exist|arquivo|path/i);
});
test('A2 refuses active Git filters before they execute', t => {
  const { root, git, inspect } = fixture(t); supported(inspect);
  writeFileSync(join(root, '.gitattributes'), 'src/a.js filter=trap\n');
  git('config', 'filter.trap.clean', 'touch FILTER_RAN; cat');
  writeFileSync(join(root, 'src/a.js'), 'changed\n');
  const result = inspect(['src/a.js']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /filtro|filter/i);
  assert.equal(existsSync(join(root, 'FILTER_RAN')), false);
});
