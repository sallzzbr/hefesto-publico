import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, harness, successful, selected } from './support/tracked-pending-fixtures.mjs';

for (const sparseIndex of [false, true]) {
  for (const outside of ['src', 'docs']) {
    test(`S1 sparse ${sparseIndex ? 'index' : 'normal'} outside ${outside} permits real harness`, async t => {
      const workspace = fixture(t);
      const path = `${outside}/outside/untouched.txt`;
      workspace.write(path, 'outside cone\n'); workspace.commit();
      workspace.base = workspace.git('rev-parse', 'HEAD');
      workspace.write('src/a.js', 'export const value = 2;\n'); workspace.commit();
      workspace.git('sparse-checkout', 'init', '--cone', sparseIndex ? '--sparse-index' : '--no-sparse-index');
      workspace.git('sparse-checkout', 'set', 'tests', 'docs/plans', 'src/included');
      assert.equal(existsSync(join(workspace.root, path)), false);
      assert.match(workspace.git('ls-files', '-v', '--', path), /^S /);
      if (sparseIndex) assert.match(workspace.git('ls-files', '--sparse', '--stage'), /040000/);
      const index = readFileSync(join(workspace.root, '.git/index'));
      const bits = workspace.git('ls-files', '-v');
      const outcome = await harness(workspace, { withBase: true });
      assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
      for (const measurement of outcome.measurements) {
        const value = successful(measurement.execution);
        assert.deepEqual(value.uninspected, []);
        assert.ok(!value.files.some(file => file.path === path), 'unchanged outside-cone file is not a deletion');
      }
      assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
      assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
      assert.equal(workspace.git('ls-files', '-v'), bits);
      assert.equal(existsSync(join(workspace.root, path)), false);
    });
  }
}
for (const flag of ['skip-worktree', 'assume-unchanged']) {
  for (const path of ['other/untouched.txt', 'other/literal [x] *.txt', 'other/quote\' and espaço.txt']) {
    test(`S1 ${flag} unchanged ${path} permits inventory`, async t => {
      const workspace = fixture(t);
      workspace.write(path, 'unchanged\n'); workspace.commit();
      workspace.git('update-index', `--${flag}`, '--', path);
      const index = readFileSync(join(workspace.root, '.git/index'));
      const bits = workspace.git('ls-files', '-v');
      const actual = successful(workspace.inspect(selected));
      assert.deepEqual(actual.uninspected, []);
      assert.ok(!actual.files.some(file => file.path === path));
      const outcome = await harness(workspace);
      assert.ok(outcome.measurements.length);
      for (const measurement of outcome.measurements) successful(measurement.execution);
      assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
      assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
      assert.equal(workspace.git('ls-files', '-v'), bits);
      assert.equal(readFileSync(join(workspace.root, path), 'utf8'), 'unchanged\n');
    });
  }
}
