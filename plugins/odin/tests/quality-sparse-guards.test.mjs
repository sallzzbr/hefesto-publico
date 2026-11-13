import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, readFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, harness, json, pending, selected } from './support/tracked-pending-fixtures.mjs';

function refused(execution) {
  const value = json(execution);
  assert.notEqual(execution.status, 0, 'unsafe inventory must refuse');
  assert.ok(value.errors.length, 'refusal must include a diagnostic');
  return value;
}
function unchangedIndex(workspace, run) {
  const index = readFileSync(join(workspace.root, '.git/index'));
  const bits = workspace.git('ls-files', '-v');
  run();
  assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
  assert.equal(workspace.git('ls-files', '-v'), bits);
}
for (const flag of ['skip-worktree', 'assume-unchanged']) {
  for (const target of ['explicit', 'pending']) {
    test(`S2 ${flag} ${target} refuses unchanged marked target`, t => {
      const workspace = fixture(t);
      const path = target === 'explicit' ? selected[0] : pending;
      if (target === 'pending') { workspace.write(path); workspace.commit(); }
      workspace.git('update-index', `--${flag}`, '--', path);
      const bytes = readFileSync(join(workspace.root, path));
      unchangedIndex(workspace, () => refused(workspace.inspect(selected, target === 'pending' ? pending : undefined)));
      assert.deepEqual(readFileSync(join(workspace.root, path)), bytes);
    });
  }
  for (const action of ['bytes', 'mode', 'symlink', 'io', 'deleted']) {
    test(`S2 ${flag} hidden ${action} cannot disappear`, t => {
      const workspace = fixture(t);
      const path = 'other/hidden [x] *.txt';
      const file = join(workspace.root, path);
      workspace.write(path, 'original\n'); workspace.commit();
      workspace.git('config', 'core.fileMode', 'true');
      workspace.git('update-index', `--${flag}`, '--', path);
      if (action === 'bytes') workspace.write(path, 'changed\nwith two lines\n');
      if (action === 'mode') chmodSync(file, 0o755);
      if (action === 'symlink') { rmSync(file); symlinkSync('../src/a.js', file); }
      if (action === 'deleted') rmSync(file);
      if (action === 'io') {
        chmodSync(file, 0);
        t.after(() => { if (existsSync(file)) chmodSync(file, 0o644); });
        assert.throws(() => readFileSync(file), /EACCES|EPERM/, 'fixture must exercise an actual unreadable file');
      }
      const state = action === 'deleted' ? null : lstatSync(file);
      unchangedIndex(workspace, () => {
        const execution = workspace.inspect(selected);
        const value = json(execution);
        if (execution.status !== 0) assert.ok(value.errors.length, 'refusal must be diagnosed');
        else {
          assert.deepEqual(value.errors, []);
          assert.ok(!['symlink', 'io'].includes(action), 'unreadable or nonregular file cannot be approved');
          const entry = value.files.find(entry => entry.path === path);
          assert.ok(entry, 'hidden change must be explicitly inventoried');
          assert.equal(entry.status, action === 'deleted' ? 'deleted' : 'text');
          assert.equal(entry.bytes, action === 'deleted' ? 0 : Buffer.byteLength(action === 'bytes' ? 'changed\nwith two lines\n' : 'original\n'));
        }
      });
      if (action === 'deleted') assert.equal(existsSync(file), false);
      else assert.equal(lstatSync(file).mode, state.mode);
      if (action === 'symlink') assert.equal(readlinkSync(file), '../src/a.js');
      if (action === 'bytes' || action === 'mode') assert.equal(readFileSync(file, 'utf8'), action === 'bytes' ? 'changed\nwith two lines\n' : 'original\n');
    });
  }
}
for (const sparseIndex of [false, true]) {
  test(`S2 sparse ${sparseIndex ? 'index' : 'normal'} base change outside cone is not deletion`, t => {
    const workspace = fixture(t);
    const path = 'other/hidden.txt';
    workspace.write(path, 'base\n'); workspace.commit();
    const base = workspace.git('rev-parse', 'HEAD');
    workspace.write(path, 'head\n'); workspace.commit();
    workspace.git('sparse-checkout', 'init', '--cone', sparseIndex ? '--sparse-index' : '--no-sparse-index');
    workspace.git('sparse-checkout', 'set', 'src', 'tests', 'docs');
    assert.equal(existsSync(join(workspace.root, path)), false);
    unchangedIndex(workspace, () => {
      const execution = workspace.inspect(selected, undefined, base);
      const value = json(execution);
      if (execution.status !== 0) assert.ok(value.errors.length);
      else {
        const entry = value.files.find(entry => entry.path === path);
        assert.ok(entry, 'base-to-index change cannot be omitted');
        assert.equal(entry.status, 'text');
        assert.equal(entry.bytes, Buffer.byteLength('head\n'));
      }
    });
    assert.equal(existsSync(join(workspace.root, path)), false);
  });
}
test('S2 unmerged index with unrelated marked file refuses', t => {
  const workspace = fixture(t);
  workspace.write('other/untouched.txt'); workspace.commit();
  workspace.git('update-index', '--assume-unchanged', 'other/untouched.txt');
  const blob = workspace.git('rev-parse', 'HEAD:src/a.js');
  workspace.git('update-index', '--force-remove', 'src/a.js');
  // update-index --index-info accepts stages directly without creating a merge process.
  const execution = spawnSync('git', ['update-index', '--index-info'], { cwd: workspace.root, env: workspace.env, encoding: 'utf8', input: `100644 ${blob} 1\tsrc/a.js\n100644 ${blob} 2\tsrc/a.js\n100644 ${blob} 3\tsrc/a.js\n` });
  assert.equal(execution.status, 0, execution.stderr);
  assert.ok(workspace.git('ls-files', '--unmerged'));
  unchangedIndex(workspace, () => refused(workspace.inspect(selected)));
});
test('S2 converters never execute with a marked unrelated file', t => {
  const workspace = fixture(t);
  workspace.write('other/untouched.txt');
  workspace.write('.gitattributes', 'src/a.js filter=probe diff=probe\n'); workspace.commit();
  workspace.git('update-index', '--assume-unchanged', 'other/untouched.txt');
  workspace.git('config', 'filter.probe.clean', 'touch converter-ran; cat');
  workspace.git('config', 'diff.probe.textconv', 'touch converter-ran; cat');
  workspace.write('src/a.js', 'export const value = 2;\n');
  unchangedIndex(workspace, () => refused(workspace.inspect(selected)));
  assert.equal(existsSync(join(workspace.root, 'converter-ran')), false);
  assert.equal(readFileSync(join(workspace.root, 'src/a.js'), 'utf8'), 'export const value = 2;\n');
});

test('S2 marked file below escaping symlink ancestor refuses', t => {
  const workspace = fixture(t);
  workspace.write('other/hidden.txt', 'inside\n'); workspace.commit();
  workspace.git('update-index', '--assume-unchanged', 'other/hidden.txt');
  rmSync(join(workspace.root, 'other'), { recursive: true });
  symlinkSync(workspace.parent, join(workspace.root, 'other'));
  unchangedIndex(workspace, () => refused(workspace.inspect(selected)));
  assert.equal(readlinkSync(join(workspace.root, 'other')), workspace.parent);
});

for (const target of ['explicit', 'pending', 'hidden-bytes']) {
  test(`S2 harness ${target} measures real marked-file safety`, async t => {
    const workspace = fixture(t);
    const path = target === 'explicit' ? selected[0] : target === 'pending' ? pending : 'other/hidden.txt';
    if (target !== 'explicit') { workspace.write(path, 'original\n'); workspace.commit(); }
    workspace.git('update-index', '--assume-unchanged', '--', path);
    if (target === 'hidden-bytes') workspace.write(path, 'hidden changed bytes\n');
    const index = readFileSync(join(workspace.root, '.git/index'));
    const bits = workspace.git('ls-files', '-v');
    const bytes = readFileSync(join(workspace.root, path));
    const outcome = await harness(workspace);
    assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
    for (const measurement of outcome.measurements) {
      if (target !== 'hidden-bytes') {
        refused(measurement.execution);
        assert.notEqual(outcome.result.status, 'verde');
      } else if (measurement.execution.status !== 0) {
        assert.ok(measurement.inventory.errors.length);
        assert.notEqual(outcome.result.status, 'verde');
      } else {
        assert.deepEqual(measurement.inventory.errors, []);
        const entry = measurement.inventory.files.find(entry => entry.path === path);
        assert.ok(entry, 'green requires explicit inspection of hidden bytes');
        assert.equal(entry.status, 'text');
        assert.equal(entry.bytes, bytes.length);
        assert.equal(entry.lines, 1);
      }
    }
    assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
    assert.equal(workspace.git('ls-files', '-v'), bits);
    assert.deepEqual(readFileSync(join(workspace.root, path)), bytes);
  });
}
