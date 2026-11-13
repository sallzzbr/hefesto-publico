import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, harness, json, selected, successful } from './support/tracked-pending-fixtures.mjs';

for (const sparseIndex of [false, true]) {
  for (const behavior of ['safety', 'legitimate']) {
    test(`fsmonitor ${sparseIndex ? 'sparse-index' : 'normal'} ${behavior} never executes configured hook`, async t => {
      const workspace = fixture(t);
      const outside = 'other/outside.txt';
      workspace.write(outside, 'outside cone\n'); workspace.commit();
      workspace.git('sparse-checkout', 'init', '--cone', sparseIndex ? '--sparse-index' : '--no-sparse-index');
      workspace.git('sparse-checkout', 'set', 'src', 'docs', 'tests');
      assert.equal(existsSync(join(workspace.root, outside)), false);
      assert.match(workspace.git('ls-files', '-v', '--', outside), /^S /);
      if (sparseIndex) assert.match(workspace.git('ls-files', '--sparse', '--stage'), /040000/);
      const marker = join(workspace.parent, 'fsmonitor-ran');
      const hook = join(workspace.parent, 'fsmonitor-hook');
      writeFileSync(hook, `#!${process.execPath}\n` +
        `require('node:fs').appendFileSync(${JSON.stringify(marker)}, 'executed\\n');\n` +
        `process.stdout.write(Buffer.from('fixture-token\\0'));\n`);
      chmodSync(hook, 0o755);
      const index = readFileSync(join(workspace.root, '.git/index'));
      const bits = workspace.git('-c', 'core.fsmonitor=false', 'ls-files', '-v');
      const bytes = selected.map(path => readFileSync(join(workspace.root, path)));
      const shellHook = "'" + hook.replaceAll("'", "'\\''") + "'";
      workspace.git('config', 'core.fsmonitor', shellHook);
      workspace.git('config', 'core.fsmonitorHookVersion', '2');
      assert.equal(existsSync(marker), false, 'configuration alone must not invoke the hook');
      if (behavior === 'safety') {
        const execution = workspace.inspect(selected);
        const value = json(execution);
        if (execution.status !== 0) assert.ok(value.errors.length, 'historical refusal must be diagnosed');
      } else {
        const outcome = await harness(workspace);
        assert.ok(outcome.measurements.length, JSON.stringify(outcome.result));
        for (const measurement of outcome.measurements) {
          const value = successful(measurement.execution);
          assert.deepEqual(value.uninspected, []);
          assert.ok(!value.files.some(file => file.path === outside));
        }
        assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
      }
      assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
      assert.equal(workspace.git('-c', 'core.fsmonitor=false', 'ls-files', '-v'), bits);
      selected.forEach((path, i) => assert.deepEqual(readFileSync(join(workspace.root, path)), bytes[i]));
      assert.equal(existsSync(join(workspace.root, outside)), false);
      assert.equal(existsSync(marker), false, 'quality inventory must never execute a configured fsmonitor hook');
    });
  }
}
