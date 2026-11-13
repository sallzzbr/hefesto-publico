import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contract, responses, runHarness, specification } from './support/quality-fixtures.mjs';

const scripts = fileURLToPath(new URL('../skills/dev-loop/scripts/', import.meta.url));
async function scenario(t, unit, pending) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'odin-review-root-area-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(root, '.git/absent-global-config'), GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const git = (...args) => {
    const execution = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(execution.error, undefined);
    assert.equal(execution.status, 0, execution.stderr);
  };
  git('init', '-q');
  write('src/a.js', 'export const value = 1;\n');
  write('tests/a.test.js', 'fixture\n');
  write('docs/plans/spec.md', specification(contract()));
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(root, '.git/absent-hooks')}`, 'commit', '-qm', 'fixture');
  write(pending, 'export const omitted = true;\n');
  const table = responses();
  const measurements = [];
  // Só Git e inventário são executados de verdade; os demais papéis usam respostas
  // controladas para exercitar o harness, sem representar execução de modelos.
  const outcome = await runHarness({ options: { workspaceRoot: root, scriptsDir: scripts, pendenciasPath: pending }, overrides: {
    'spec:validar': () => {
      const value = table['spec:validar']();
      value.unidades[0].arquivos = unit;
      return value;
    },
    'validar:': (options, calls, prompt) => {
      const commands = [...prompt.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1].trim()).filter(command => /inspecionar-git\.mjs.* quality /.test(command));
      assert.equal(commands.length, 1, 'One literal inventory command must be emitted');
      const execution = spawnSync('sh', ['-c', commands[0]], { cwd: root, env, encoding: 'utf8' });
      assert.equal(execution.error, undefined);
      assert.equal(execution.status, 0, execution.stderr);
      const inventory = JSON.parse(execution.stdout);
      measurements.push({ command: commands[0], inventory });
      return { ...table['validar:'](options), qualityInventory: inventory };
    },
  } });
  assert.ok(measurements.length > 0, JSON.stringify(outcome.result));
  for (const measurement of measurements) assert.deepEqual(measurement.inventory.errors, []);
  return { ...outcome, measurements };
}
function omissionRemains(outcome, pending) {
  for (const measurement of outcome.measurements) {
    assert.deepEqual(measurement.inventory.uninspected, [pending], measurement.command);
    assert.ok(!measurement.inventory.files.some(file => file.path === pending), 'An omitted target must not be claimed as inspected');
  }
  assert.notEqual(outcome.result.status, 'verde', JSON.stringify(outcome.result));
}
for (const [id, unit] of [['F2SR1', './'], ['F2SR2', '././']]) {
  test(`${id} root unit area retains new code disguised as pending`, async t => {
    const pending = 'src/omitted.js';
    omissionRemains(await scenario(t, unit, pending), pending);
  });
}
test('F2SP1 a source directory area retains omitted new code', async t => {
  const pending = 'src/omitted.js';
  omissionRemains(await scenario(t, 'src/', pending), pending);
});
test('F2SP2 pending outside the normalized unit area still permits green', async t => {
  const pending = 'src-notes/local.md';
  const outcome = await scenario(t, './src/', pending);
  for (const measurement of outcome.measurements) {
    assert.deepEqual(measurement.inventory.uninspected, [], measurement.command);
    assert.ok(!measurement.inventory.files.some(file => file.path === pending));
  }
  assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
});
