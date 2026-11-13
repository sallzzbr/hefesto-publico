import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, harness, successful, pending, selected } from './support/tracked-pending-fixtures.mjs';

for (const state of ['HEAD-index', 'HEAD-only', 'index-only']) {
  for (const action of ['unchanged', 'modified', 'deleted']) {
    test(`G1 ${state} ${action} preserves normal inventory`, t => {
      const workspace = fixture(t);
      workspace.write(pending, 'original note\n');
      if (state === 'index-only') workspace.git('add', pending);
      else {
        workspace.commit();
        if (state === 'HEAD-only') workspace.git('rm', '--cached', pending);
      }
      if (action === 'modified') workspace.write(pending, 'changed note\nwith two lines\n');
      if (action === 'deleted') rmSync(join(workspace.root, pending));
      const index = readFileSync(join(workspace.root, '.git/index'));
      // HEAD-only presente também é untracked para Git: preservar essa semântica,
      // inclusive uninspected, em vez de impor uma classificação artificial.
      const normal = successful(workspace.inspect(selected, undefined, workspace.base));
      const actual = successful(workspace.inspect(selected, pending, workspace.base));
      assert.deepEqual(actual, normal, `${state}/${action}: pending argument must not remove or reject tracked work`);
      if (normal.files.some(file => file.path === pending)) {
        const file = actual.files.find(file => file.path === pending);
        assert.ok(file, 'tracked change or removal must remain visible');
        assert.equal(file.status, action === 'deleted' ? 'deleted' : 'text');
        assert.equal(file.bytes, action === 'deleted' ? 0 : Buffer.byteLength(action === 'modified' ? 'changed note\nwith two lines\n' : 'original note\n'));
      } else if (normal.uninspected.includes(pending)) assert.ok(actual.uninspected.includes(pending));
      assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
      if (action !== 'deleted') assert.equal(readFileSync(join(workspace.root, pending), 'utf8'), action === 'modified' ? 'changed note\nwith two lines\n' : 'original note\n');
    });
  }
}
for (const perfil of ['economico', 'balanceado', 'maximo']) {
  test(`G1 harness ${perfil} executes real command and reaches green`, async t => {
    const workspace = fixture(t);
    workspace.write(pending, 'tracked note\n'); workspace.commit();
    workspace.write(pending, 'changed tracked note\n');
    const index = readFileSync(join(workspace.root, '.git/index'));
    const outcome = await harness(workspace, { perfil, withBase: true });
    assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
    for (const measurement of outcome.measurements) {
      assert.equal(measurement.execution.status, 0, measurement.execution.stderr);
      assert.deepEqual(measurement.inventory.errors, []);
      assert.deepEqual(measurement.inventory.uninspected, []);
      assert.ok(measurement.inventory.files.some(file => file.path === pending && file.bytes === Buffer.byteLength('changed tracked note\n')));
    }
    assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
    assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
    assert.equal(readFileSync(join(workspace.root, pending), 'utf8'), 'changed tracked note\n');
  });
}
