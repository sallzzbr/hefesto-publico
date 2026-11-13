import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const inspector = fileURLToPath(new URL('../skills/dev-loop/scripts/inspecionar-git.mjs', import.meta.url));
function fixture(t) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'odin-review-paths-')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'repo');
  mkdirSync(root);
  const trace = join(parent, 'git.trace');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(parent, 'absent-config'), GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const commit = () => { git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(parent, 'absent-hooks')}`, 'commit', '-qm', 'fixture'); };
  const inspect = (paths = ['src/a.js'], base = 'HEAD') => spawnSync(process.execPath, [inspector, 'quality', JSON.stringify(paths), base], { cwd: root, env: { ...env, GIT_TRACE: trace }, encoding: 'utf8' });
  git('init', '-q'); write('src/a.js', 'export const value = 1;\n');
  return { parent, root, trace, git, write, commit, inspect };
}
function inventory(execution) {
  assert.equal(execution.error, undefined);
  assert.equal(execution.status, 0, execution.stderr);
  return JSON.parse(execution.stdout);
}
for (const [id, path] of [['F1R1', 'archive/{draft}.txt'], ['F1R2', 'archive/name:variant.txt'], ['F1R3', 'archive/dangling-link']]) {
  test(`${id} unrelated tracked literal or dangling terminal link permits selected inventory`, t => {
    const workspace = fixture(t);
    if (id === 'F1R3') { mkdirSync(join(workspace.root, 'archive')); symlinkSync('never-created', join(workspace.root, path)); }
    else workspace.write(path, 'unrelated fixture\n');
    workspace.commit();
    workspace.write('src/a.js', 'export const value = 2;\n');
    const index = readFileSync(join(workspace.root, '.git/index'));
    assert.deepEqual(inventory(workspace.inspect()), { files: [{ path: 'src/a.js', lines: 1, bytes: 24, status: 'text' }], uninspected: [], errors: [] });
    assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
  });
}
test('F1P1 ordinary inventory retains exact measurements and target path restrictions', t => {
  const workspace = fixture(t); workspace.commit();
  assert.deepEqual(inventory(workspace.inspect()), { files: [{ path: 'src/a.js', lines: 1, bytes: 24, status: 'text' }], uninspected: [], errors: [] });
  for (const path of ['../outside.js', 'src/{draft}.js', 'src/a:b.js', '.git/config']) {
    const execution = workspace.inspect([path]);
    assert.notEqual(execution.status, 0, path);
    assert.ok(JSON.parse(execution.stdout).errors.length, path);
  }
});
test('F1P2 tracked ancestor escape is rejected before Git diff can traverse it', t => {
  const workspace = fixture(t);
  workspace.write('archive/data.txt', 'tracked\n'); workspace.commit();
  const outside = join(workspace.parent, 'outside'); mkdirSync(outside);
  writeFileSync(join(outside, 'data.txt'), 'private outside fixture\n');
  rmSync(join(workspace.root, 'archive'), { recursive: true }); symlinkSync(outside, join(workspace.root, 'archive'));
  const execution = workspace.inspect();
  assert.notEqual(execution.status, 0);
  assert.ok(JSON.parse(execution.stdout).errors.length);
  assert.doesNotMatch(execution.stdout, /private outside fixture/);
  assert.doesNotMatch(readFileSync(workspace.trace, 'utf8'), /built-in: git .*\bdiff\b/, 'Containment must fail before diff');
});
test('F1P3 filters on unrelated tracked paths remain rejected before execution', t => {
  const workspace = fixture(t);
  workspace.write('archive/plain.txt', 'tracked\n'); workspace.commit();
  workspace.write('.gitattributes', 'archive/plain.txt filter=trap\n');
  workspace.git('config', 'filter.trap.clean', 'touch FILTER_RAN; cat');
  workspace.write('archive/plain.txt', 'changed\n');
  const execution = workspace.inspect();
  assert.notEqual(execution.status, 0);
  assert.match(execution.stderr, /filter|filtro/i);
  assert.equal(existsSync(join(workspace.root, 'FILTER_RAN')), false);
  assert.doesNotMatch(readFileSync(workspace.trace, 'utf8'), /built-in: git .*\bdiff\b/);
});

test('F1P4 changed tracked unusual paths stay visible as errors rather than disappearing', t => {
  const workspace = fixture(t);
  workspace.write('archive/{draft}.txt', 'old\n'); workspace.commit();
  workspace.write('archive/{draft}.txt', 'changed\n');
  const execution = workspace.inspect();
  assert.notEqual(execution.status, 0);
  assert.ok(JSON.parse(execution.stdout).errors.some(error => error.includes('archive/{draft}.txt')));
});
test('F1P5 an ancestor symlink loop remains an explicit filesystem error', t => {
  const workspace = fixture(t);
  workspace.write('archive/data.txt', 'tracked\n'); workspace.commit();
  rmSync(join(workspace.root, 'archive'), { recursive: true });
  symlinkSync('archive', join(workspace.root, 'archive'));
  const execution = workspace.inspect();
  assert.notEqual(execution.status, 0);
  assert.match(JSON.stringify(JSON.parse(execution.stdout).errors), /ELOOP|symbolic|symlink|loop/i);
  assert.doesNotMatch(readFileSync(workspace.trace, 'utf8'), /built-in: git .*\bdiff\b/);
});
