import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, harness, json, selected, successful } from './support/tracked-pending-fixtures.mjs';

test('membership included manually skipped deletion remains visible', async t => {
  const workspace = fixture(t);
  const path = 'src/manual.txt';
  workspace.write(path, 'original\n'); workspace.commit();
  workspace.git('sparse-checkout', 'init', '--cone', '--no-sparse-index');
  workspace.git('sparse-checkout', 'set', 'src', 'docs', 'tests');
  assert.equal(existsSync(join(workspace.root, path)), true);
  workspace.git('update-index', '--skip-worktree', '--', path);
  rmSync(join(workspace.root, path));
  assert.match(workspace.git('ls-files', '-v', '--', path), /^S /);
  assert.equal(workspace.git('diff', '--name-only', 'HEAD', '--', path), '');
  const index = readFileSync(join(workspace.root, '.git/index'));
  const bits = workspace.git('ls-files', '-v');
  const check = execution => {
    const value = json(execution);
    if (execution.status !== 0) assert.ok(value.errors.length, 'refusal must be diagnosed');
    else {
      assert.deepEqual(value.errors, []);
      const entry = value.files.find(entry => entry.path === path);
      assert.ok(entry, 'included file manually hidden and removed cannot disappear from successful inventory');
      assert.equal(entry.status, 'deleted');
      assert.equal(entry.bytes, 0);
      assert.equal(entry.lines, 0);
    }
  };
  check(workspace.inspect(selected));
  const outcome = await harness(workspace);
  assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
  for (const measurement of outcome.measurements) {
    check(measurement.execution);
    if (measurement.execution.status !== 0) assert.notEqual(outcome.result.status, 'verde');
  }
  assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
  assert.equal(workspace.git('ls-files', '-v'), bits);
  assert.equal(existsSync(join(workspace.root, path)), false);
});

test('membership legitimate non-cone absence permits real harness', async t => {
  const workspace = fixture(t);
  const path = 'other/excluded.txt';
  workspace.write(path, 'outside patterns\n'); workspace.commit();
  workspace.git('sparse-checkout', 'init', '--no-cone', '--no-sparse-index');
  workspace.git('sparse-checkout', 'set', '--no-cone', '/src/', '/tests/', '/docs/');
  assert.equal(existsSync(join(workspace.root, path)), false);
  assert.match(workspace.git('ls-files', '-v', '--', path), /^S /);
  const index = readFileSync(join(workspace.root, '.git/index'));
  const bits = workspace.git('ls-files', '-v');
  const source = readFileSync(join(workspace.root, selected[0]));
  const outcome = await harness(workspace);
  assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
  for (const measurement of outcome.measurements) {
    const value = successful(measurement.execution);
    assert.deepEqual(value.uninspected, []);
    assert.ok(!value.files.some(entry => entry.path === path), 'excluded absence is not a worktree deletion');
  }
  assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
  assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
  assert.equal(workspace.git('ls-files', '-v'), bits);
  assert.deepEqual(readFileSync(join(workspace.root, selected[0])), source);
  assert.equal(existsSync(join(workspace.root, path)), false);
});
