import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { contract, specification, baseIds, specialtyIds } from './support/quality-fixtures.mjs';
const script = fileURLToPath(new URL('../skills/dev-loop/scripts/spec-ids.mjs', import.meta.url));
function parse(t, text, quality = true, prepare = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'odin-quality-contract-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  prepare(root);
  writeFileSync(join(root, 'spec.md'), text);
  const result = spawnSync(process.execPath, [script, 'spec.md', ...(quality ? ['--quality'] : [])], { cwd: root, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  return { ...result, data: JSON.parse(result.stdout) };
}
test('A1 extracts exact base and selected specialty rules without executing commands', t => {
  const quality = contract(['base', ...Object.keys(specialtyIds)]);
  quality.checks[3].command = 'node -e "process.exit(91)"';
  const result = parse(t, specification(quality));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.data.quality, quality);
  assert.deepEqual(result.data.ids, ['C1']);
  assert.ok(existsSync(new URL('../skills/dev-loop/scripts/quality-contract.mjs', import.meta.url)), 'Shared importable parser is required');
});
test('A1 rejects missing or ambiguous quality sections and JSON blocks', t => {
  const text = specification(contract());
  for (const input of [specification(), text + '\n## Contrato de qualidade\n```json\n{}\n```\n', text + '\n```json\n{}\n```\n', text.replace('"version":1', '"version":')]) {
    const result = parse(t, input);
    assert.notEqual(result.status, 0, input);
    assert.equal(result.data.ok, false);
    assert.ok(result.data.erros.length > 0);
  }
});
test('A1 rejects invalid fields profiles rules commands and applicability', t => {
  const mutations = [
    q => { q.extra = true; }, q => { q.version = '1'; }, q => { q.profiles = ['typescript']; },
    q => { q.profiles = ['base', 'base']; }, q => { q.profiles.push('unknown'); },
    q => { q.checks.pop(); }, q => { q.checks.push({ ...q.checks[0] }); },
    q => { q.checks[0].id = 'UNKNOWN'; }, q => { q.checks[0].reason = ' '; },
    q => { q.checks[0].applicability = 'optional'; }, q => { q.checks[0].applicability = 'not-applicable'; },
    q => { q.checks[3].command = ''; }, q => { q.checks[3].command = 'npm test\nrm -rf data'; },
    q => { q.checks[0].paths = []; }, q => { q.checks[0].paths = 'src/a.js'; },
    q => { q.checks[0].verification = 'guess'; }, q => { q.checks[0].extra = true; },
    q => { q.conventions = []; }, q => { q.conventions[0].source = ''; }, q => { q.conventions[0].decision = ''; },
    q => { q.decomposition = [{ path: 'src/a.js', trigger: 'large', decision: '', verification: 'review' }]; },
  ];
  for (const mutate of mutations) {
    const q = contract(); mutate(q);
    const result = parse(t, specification(q));
    assert.notEqual(result.status, 0, JSON.stringify(q));
    assert.equal(result.data.ok, false);
    assert.ok(result.data.erros.length);
  }
});
test('A1 rejects path escapes aliases control characters and external symlinks', t => {
  for (const path of ['/etc/passwd', '../outside.js', '.git/config', 'src/../a.js', 'src//a.js', './src/a.js', 'src/a\n.js', 'C:\\temp\\a.js', 'src/link/data.js']) {
    const q = contract(); q.checks[0].paths = [path];
    const result = parse(t, specification(q), true, root => { mkdirSync(join(root, 'src')); symlinkSync(tmpdir(), join(root, 'src/link')); });
    assert.notEqual(result.status, 0, path);
    assert.equal(result.data.ok, false);
  }
});
test('A1 accepts future paths and audited contextual dispensations', t => {
  const q = contract();
  q.checks.find(c => c.id === 'Q-ERRORS').applicability = 'not-applicable';
  q.checks.find(c => c.id === 'Q-ERRORS').reason = 'This change only defines constant labels and adds no operation that can fail.';
  q.checks[0].paths = ['future/new-module.js'];
  q.conventions[0] = { source: 'Searched AGENTS.md and workspace defaults: none found', decision: 'Use documented base defaults for this new project.' };
  const result = parse(t, specification(q));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.data.quality, q);
});
test('A1 preserves historical CLI output without quality flag', t => {
  const result = parse(t, specification(), false);
  assert.equal(result.status, 0);
  assert.deepEqual(result.data, { ok: true, ids: ['C1'], erros: [], verificacoesComplementares: {}, tipos: { C1: 'reproducao' } });
  assert.deepEqual(baseIds.length, 7);
});
