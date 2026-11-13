import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, harness, json, pending, selected } from './support/tracked-pending-fixtures.mjs';

for (const flag of ['skip-worktree', 'assume-unchanged']) {
  for (const action of ['modified', 'deleted']) {
    test(`G2 ${flag} ${action} cannot hide tracked pending work`, async t => {
      const workspace = fixture(t);
      workspace.write(pending, 'original note\n'); workspace.commit();
      workspace.git('update-index', `--${flag}`, pending);
      if (action === 'modified') workspace.write(pending, 'hidden changed note\nsecond line\n');
      else rmSync(join(workspace.root, pending));
      // Establish that Git really hides this change before testing the inspector.
      assert.equal(workspace.git('diff', '--name-only', 'HEAD', '--', pending), '');
      const index = readFileSync(join(workspace.root, '.git/index'));
      const bits = workspace.git('ls-files', '-v', '--', pending);
      const execution = workspace.inspect(selected, pending);
      const inventory = json(execution);
      const check = (measurement, value) => {
        if (measurement.status !== 0) {
          assert.ok(value.errors.length, 'refusal must be diagnosed');
          assert.match(value.errors.join('\n'), /pendenciasPath|skip-worktree|assume-unchanged|flag|índice|index/i);
        } else {
          assert.deepEqual(value.errors, []);
          const file = value.files.find(file => file.path === pending);
          assert.ok(file, 'successful inventory must inspect hidden work explicitly');
          assert.equal(file.status, action === 'deleted' ? 'deleted' : 'text');
          assert.equal(file.bytes, action === 'deleted' ? 0 : Buffer.byteLength('hidden changed note\nsecond line\n'));
          assert.equal(file.lines, action === 'deleted' ? 0 : 2);
        }
      };
      check(execution, inventory);
      const outcome = await harness(workspace);
      assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
      for (const measurement of outcome.measurements) check(measurement.execution, measurement.inventory);
      if (outcome.result.status === 'verde') {
        for (const measurement of outcome.measurements) {
          assert.equal(measurement.execution.status, 0);
          assert.ok(measurement.inventory.files.some(file => file.path === pending));
        }
      } else assert.ok(outcome.measurements.some(measurement => measurement.inventory.errors.length), 'non-green must come from diagnosed inventory refusal');
      assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
      assert.equal(workspace.git('ls-files', '-v', '--', pending), bits);
      assert.equal(existsSync(join(workspace.root, pending)), action !== 'deleted');
      if (action === 'modified') assert.equal(readFileSync(join(workspace.root, pending), 'utf8'), 'hidden changed note\nsecond line\n');
    });
  }
}
