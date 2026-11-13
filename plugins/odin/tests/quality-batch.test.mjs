import assert from 'node:assert/strict';
import test from 'node:test';
import { selected, successful } from './support/tracked-pending-fixtures.mjs';
import { sparse, intercept, unchanged } from './support/batch-link-fixtures.mjs';
for (const mode of ['native', 'fallback']) {
  test(`B1 ${mode} membership subprocess count is constant for 32 and 128 absences`, t => {
    const totals = [], batches = [];
    for (const count of [32, 128]) {
      const workspace = sparse(t, count), verify = unchanged(workspace), trace = intercept(workspace, mode);
      const value = successful(workspace.inspect(selected));
      assert.deepEqual(value.uninspected, []);
      assert.ok(workspace.paths.every(path => !value.files.some(file => file.path === path)));
      const records = trace.records(); totals.push(records.length);
      const membership = records.filter(record => record.args.includes('check-rules'));
      batches.push({ count, membership, paths: workspace.paths, records });
      verify();
    }
    t.diagnostic(JSON.stringify(batches.map(({ count, membership, records }) => ({ count, membershipProcesses: membership.length, totalProcesses: records.length }))));
    for (const { count, membership, paths, records } of batches) {
      assert.equal(membership.length, 1, `${count} absences must use one membership process`);
      const input = Buffer.from(membership[0].input, 'base64').toString();
      assert.ok(input.endsWith('\0')); assert.deepEqual(input.slice(0,-1).split('\0').sort(), [...paths].sort());
      if (mode === 'fallback') assert.equal(records.filter(record => record.args.includes('sparse-checkout') && record.args.includes('list')).length, 1);
    }
    assert.equal(totals[0], totals[1], 'Total subprocesses must not grow with absent candidate count');
  });
}
