import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contract, responses, runHarness, specification } from './support/quality-fixtures.mjs';

const scripts = fileURLToPath(new URL('../skills/dev-loop/scripts/', import.meta.url));
const inspector = join(scripts, 'inspecionar-git.mjs');
const pending = 'notes/local pending.md';
const selected = ['src/a.js', 'tests/a.test.js', 'docs/plans/spec.md'];
function fixture(t) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'odin-review-pending-')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, "repo with ' quote"); mkdirSync(root);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(parent, 'absent-config'), GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...args) => {
    const execution = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(execution.error, undefined); assert.equal(execution.status, 0, execution.stderr);
    return execution.stdout.trim();
  };
  const write = (path, text = 'private local note\n') => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const commit = () => { git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(parent, 'absent-hooks')}`, 'commit', '-qm', 'fixture'); };
  git('init', '-q');
  write(selected[0], 'export const value = 1;\n');
  write(selected[1], 'import test from "node:test";\ntest("fixture", () => {});\n');
  write(selected[2], specification(contract())); commit();
  const base = git('rev-parse', 'HEAD');
  const inspect = (paths = selected, excluded, ref = 'HEAD', extra = []) => spawnSync(process.execPath, [inspector, 'quality', JSON.stringify(paths), ref, ...(excluded === undefined ? [] : [excluded]), ...extra], { cwd: root, env, encoding: 'utf8' });
  return { parent, root, env, git, write, commit, base, inspect };
}
function json(execution) {
  assert.equal(execution.error, undefined);
  return JSON.parse(execution.stdout);
}
function successful(execution) {
  const value = json(execution);
  assert.equal(execution.status, 0, execution.stderr);
  assert.deepEqual(value.errors, []);
  return value;
}
function refuses(execution, description) {
  const value = json(execution);
  assert.notEqual(execution.status, 0, description);
  assert.ok(value.errors.length, description);
}
// Só o inventário é real aqui; respostas controladas exercitam a orquestração do harness
// sem representar revisão com modelo ou execução do TDD da fixture interna.
async function harness(workspace, { excluded = pending, perfil = 'economico', withBase = false, unit = 'src/a.js', touched = ['src/a.js'], support = [] } = {}) {
  const table = responses(); const measurements = [];
  const outcome = await runHarness({ options: {
    workspaceRoot: workspace.root, scriptsDir: scripts, perfil,
    ...(excluded === null ? {} : { pendenciasPath: excluded }),
    ...(withBase ? { baseRef: workspace.base } : {}),
  }, overrides: {
    'spec:validar': () => { const value = table['spec:validar'](); value.unidades[0].arquivos = unit; return value; },
    'tdd:portao': () => ({ ...table['tdd:portao'](), apoio: support }),
    'tdd:vermelho': options => {
      const value = table['tdd:vermelho'](options);
      if (withBase) value.alteracoes = { ...value.alteracoes, comparadoCom: workspace.base, sha: workspace.base };
      return value;
    },
    'impl:': () => ({ ...table['impl:'](), arquivosTocados: touched }),
    'validar:': (options, calls, prompt) => {
      const commands = [...prompt.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1].trim()).filter(command => /inspecionar-git\.mjs.* quality /.test(command));
      assert.equal(commands.length, 1, 'One literal inventory command must be emitted');
      const execution = spawnSync('sh', ['-c', commands[0]], { cwd: workspace.root, env: workspace.env, encoding: 'utf8' });
      const inventory = json(execution);
      measurements.push({ command: commands[0], execution, inventory });
      return { ...table['validar:'](options), qualityInventory: inventory };
    },
  } });
  return { ...outcome, measurements };
}

test('F2R1 singular exclusion removes only an eligible regular note and preserves other omissions', t => {
  const workspace = fixture(t);
  workspace.write(pending); workspace.write('notes/another.md'); workspace.write('src/omitted.js', 'export const omitted = true;\n');
  const index = readFileSync(join(workspace.root, '.git/index'));
  const value = successful(workspace.inspect(selected, pending));
  assert.deepEqual(value.uninspected, ['notes/another.md', 'src/omitted.js']);
  assert.deepEqual(value.files.map(file => file.path).sort(), [...selected].sort());
  assert.doesNotMatch(JSON.stringify(value), /private local note/);
  assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
});
test('F2R2 an absent local note path is eligible without inventing an inspected file', t => {
  const workspace = fixture(t);
  const value = successful(workspace.inspect(selected, pending));
  assert.deepEqual(value.uninspected, []);
  assert.deepEqual(value.files.map(file => file.path).sort(), [...selected].sort());
});
for (const [index, perfil, withBase] of [[3, 'economico', false], [4, 'balanceado', true], [5, 'maximo', false]]) {
  test(`F2R${index} emitted inventory command reaches green with a local note in ${perfil}`, async t => {
    const workspace = fixture(t); workspace.write(pending);
    const outcome = await harness(workspace, { perfil, withBase });
    assert.ok(outcome.measurements.length > 0, JSON.stringify(outcome.result));
    for (const measurement of outcome.measurements) {
      assert.equal(measurement.execution.status, 0, measurement.execution.stderr);
      assert.deepEqual(measurement.inventory.uninspected, [], measurement.command);
      assert.deepEqual(measurement.inventory.errors, []);
      assert.ok(!measurement.inventory.files.some(file => file.path === pending));
    }
    assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
  });
}
test('F2P1 omission reconciliation is unchanged when the optional argument is absent', t => {
  const workspace = fixture(t); workspace.write(pending);
  const value = successful(workspace.inspect());
  assert.deepEqual(value.uninspected, [pending]);
  assert.deepEqual(Object.keys(value).sort(), ['errors', 'files', 'uninspected']);
  assert.deepEqual(value.files.map(file => file.path).sort(), [...selected].sort());
});
test('F2P2 exclusion refuses base-only entries absent from HEAD and index', t => {
  for (const state of ['base-only']) {
    const workspace = fixture(t); workspace.write(pending);
    if (state === 'index-only') workspace.git('add', pending);
    else {
      workspace.commit();
      if (state === 'base-only') {
        workspace.base = workspace.git('rev-parse', 'HEAD');
        workspace.git('rm', '--cached', pending);
        workspace.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(workspace.parent, 'absent-hooks')}`, 'commit', '-qm', 'remove note');
      } else workspace.git('rm', '--cached', pending);
    }
    refuses(workspace.inspect(selected, pending, workspace.base), state);
  }
});
test('F2P3 exclusion refuses explicit targets directories symlinks traversal and generic lists', t => {
  const workspace = fixture(t); workspace.write(pending);
  refuses(workspace.inspect([...selected, pending], pending), 'explicit target');
  refuses(workspace.inspect(selected, 'notes'), 'directory');
  symlinkSync('missing-target', join(workspace.root, 'notes/dangling'));
  symlinkSync('local pending.md', join(workspace.root, 'notes/local-link'));
  const outside = join(workspace.parent, 'outside'); mkdirSync(outside);
  writeFileSync(join(outside, 'secret.md'), 'private outside fixture\n');
  symlinkSync(outside, join(workspace.root, 'notes/escape'));
  for (const path of ['notes/dangling', 'notes/local-link', 'notes/escape/secret.md', '../outside/secret.md', outside, '.git/config', JSON.stringify([pending])]) refuses(workspace.inspect(selected, path), path);
  refuses(workspace.inspect(selected, pending, 'HEAD', ['notes/another.md']), 'multiple exclusions');
});
test('F2P4 emitted inventory keeps unrelated new code visible', async t => {
  const workspace = fixture(t); workspace.write(pending); workspace.write('src/omitted.js', 'export const omitted = true;\n');
  const outcome = await harness(workspace);
  assert.ok(outcome.measurements.length > 0);
  assert.notEqual(outcome.result.status, 'verde');
  for (const measurement of outcome.measurements) assert.ok(measurement.inventory.uninspected.includes('src/omitted.js'));
});
test('F2P5 emitted inventory cannot dispense new code inside the unit area', async t => {
  const workspace = fixture(t); workspace.write('src/new.js', 'export const fresh = true;\n');
  const outcome = await harness(workspace, { excluded: 'src/new.js', unit: 'src/' });
  assert.notEqual(outcome.result.status, 'verde');
  if (outcome.measurements.length) for (const measurement of outcome.measurements) {
    assert.ok(measurement.inventory.uninspected.includes('src/new.js') || measurement.inventory.errors.length || measurement.execution.status !== 0);
  }
});
test('F2P6 pending collisions with unit targets tests support SPEC and touched files remain inspected or blocked', async t => {
  for (const role of ['unit', 'test', 'support', 'spec', 'touched']) {
    const workspace = fixture(t);
    const path = { unit: 'src/a.js', test: selected[1], support: 'tests/helper.js', spec: selected[2], touched: 'notes/touched.js' }[role];
    if (role === 'support' || role === 'touched') workspace.write(path, 'export const fixture = true;\n');
    const outcome = await harness(workspace, { excluded: path, support: role === 'support' ? [path] : [], touched: role === 'touched' ? ['src/a.js', path] : ['src/a.js'] });
    if (outcome.result.status === 'verde') {
      assert.ok(outcome.measurements.length > 0, role);
      for (const measurement of outcome.measurements) assert.ok(measurement.inventory.files.some(file => file.path === path), `${role} must be inspected`);
    } else {
      assert.ok(['erro', 'bloqueado', 'escalado'].includes(outcome.result.status), JSON.stringify(outcome.result));
      if (!outcome.measurements.length) assert.match(JSON.stringify(outcome.result), /pendenciasPath/, `${role}: unrelated failure does not prove collision protection`);
    }
  }
});
test('F2P7 emitted inventory without pending configuration retains the omission gate', async t => {
  const workspace = fixture(t); workspace.write(pending);
  const outcome = await harness(workspace, { excluded: null });
  assert.ok(outcome.measurements.length > 0);
  assert.notEqual(outcome.result.status, 'verde');
  for (const measurement of outcome.measurements) assert.ok(measurement.inventory.uninspected.includes(pending));
});

test('F2P8 emitted inventory has a real green baseline when the configured note is absent', async t => {
  const workspace = fixture(t);
  const outcome = await harness(workspace);
  assert.ok(outcome.measurements.length > 0);
  for (const measurement of outcome.measurements) {
    assert.equal(measurement.execution.status, 0, measurement.execution.stderr);
    assert.deepEqual(measurement.inventory.uninspected, []);
    assert.deepEqual(measurement.inventory.errors, []);
  }
  assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
});
