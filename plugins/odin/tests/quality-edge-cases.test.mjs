import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contract, responses, runHarness, specification } from './support/quality-fixtures.mjs';
import { parseQualityContract } from '../skills/dev-loop/scripts/quality-contract.mjs';

const inspector = fileURLToPath(new URL('../skills/dev-loop/scripts/inspecionar-git.mjs', import.meta.url));
const specPath = 'docs/plans/spec.md';
const testPath = 'tests/a.test.js';
const literalPath = 'routes/[id].js';
const profiles = ['economico', 'balanceado', 'maximo'];
const emptyObservation = 'src/a.js is intentionally empty; inspect the deletion of its former contents and its remaining consumer instead of inventing source lines.';

function temporaryRoot(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'odin-quality-edge-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t, { brackets = false, empty = false, quality = contract() } = {}) {
  const root = temporaryRoot(t);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(root, '.git', 'fixture-global-config'), GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const write = (path, contents) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), contents);
  };
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q');
  write('src/a.js', empty ? '' : 'export const value = 1;\n');
  write(testPath, 'import test from "node:test";\ntest("public boundary", () => {});\n');
  const spec = specification(quality) + `\n## Empty target inspection\n${emptyObservation}\n`;
  write(specPath, spec);
  if (brackets) {
    write(literalPath, 'export const route = "literal brackets";\n');
    write('routes/i.js', 'export const route = "letter i";\n');
    write('routes/d.js', 'export const route = "letter d";\n');
  }
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(root, '.git', 'fixture-hooks')}`, 'commit', '-qm', 'fixture');
  const inspect = paths => spawnSync(process.execPath, [inspector, 'quality', JSON.stringify(paths)], { cwd: root, env, encoding: 'utf8' });
  const paths = ['src/a.js', testPath, specPath];
  return { root, write, inspect, paths, specLine: spec.split('\n').indexOf(emptyObservation) + 1 };
}

function measured(workspace, paths = workspace.paths) {
  const execution = workspace.inspect(paths);
  assert.equal(execution.error, undefined);
  assert.equal(execution.status, 0, execution.stderr);
  const inventory = JSON.parse(execution.stdout);
  assert.deepEqual(inventory.errors, []);
  assert.deepEqual(inventory.uninspected, []);
  return inventory;
}

function localTextMeasurements(workspace, paths) {
  return { files: paths.map(path => {
    const bytes = readFileSync(join(workspace.root, path));
    const text = bytes.toString('utf8');
    return { path, bytes: bytes.length, lines: (text.match(/\n/g) || []).length + (text.length && !text.endsWith('\n') ? 1 : 0), status: 'text' };
  }), uninspected: [], errors: [] };
}

async function audit(quality, inventory, { perfil = 'economico', target = 'src/a.js', path = target, line = 1, observation = 'Inspected the approved target and its public boundary.' } = {}) {
  const table = responses(quality);
  return runHarness({ quality, options: { perfil }, overrides: {
    'spec:validar': () => {
      const response = table['spec:validar']();
      response.unidades[0].arquivos = target;
      return response;
    },
    'impl:': () => ({ ...table['impl:'](), arquivosTocados: [target] }),
    'validar:': options => ({ ...table['validar:'](options), qualityInventory: structuredClone(inventory) }),
    'ponytail:': () => {
      const response = table['ponytail:']();
      for (const item of response.qualityReview) item.evidence = [{ path, line, observation }];
      return response;
    },
  } });
}

function rejected(result) {
  assert.ok(['erro', 'bloqueado', 'escalado'].includes(result.status), JSON.stringify(result));
  assert.match(JSON.stringify(result), /quality|qualidade|invent|evid/i);
}

for (const existing of [true, false]) {
  test(`E1 concrete bracket filename is valid in canonical parsing when ${existing ? 'existing' : 'planned'}`, t => {
    const workspace = fixture(t, { brackets: existing });
    const quality = contract();
    for (const check of quality.checks) check.paths = [literalPath];
    let parsed;
    assert.doesNotThrow(() => { parsed = parseQualityContract(specification(quality), { root: workspace.root }); });
    assert.deepEqual(parsed, quality);
  });
}

test('E2 an unrelated tracked bracket filename does not abort a selected plain-file inventory', t => {
  const workspace = fixture(t, { brackets: true });
  const inventory = measured(workspace, ['src/a.js']);
  assert.deepEqual(inventory.files.map(file => file.path), ['src/a.js']);
});

test('E2 selecting a bracket filename inspects that exact literal and never expands it as a glob', t => {
  const workspace = fixture(t, { brackets: true });
  const inventory = measured(workspace, [literalPath]);
  assert.deepEqual(inventory.files.map(file => file.path), [literalPath]);
  assert.equal(inventory.files[0].bytes, Buffer.byteLength('export const route = "literal brackets";\n'));
  assert.equal(inventory.files[0].lines, 1);
});

for (const perfil of profiles) {
  test(`E3 exact bracket target reaches green with complete local evidence in ${perfil}`, async t => {
    const quality = contract();
    for (const check of quality.checks) check.paths = [literalPath];
    const workspace = fixture(t, { brackets: true, quality });
    const inventory = localTextMeasurements(workspace, [...workspace.paths, literalPath]);
    const { result } = await audit(quality, inventory, { perfil, target: literalPath });
    assert.equal(result.status, 'verde', JSON.stringify(result));
  });
}

test('E4 allowing literal brackets preserves traversal and external symlink rejection', t => {
  const workspace = fixture(t);
  const outside = temporaryRoot(t);
  writeFileSync(join(outside, 'secret.js'), 'private fixture\n');
  mkdirSync(join(workspace.root, 'routes'));
  symlinkSync(outside, join(workspace.root, 'routes/[id]'));
  symlinkSync(outside, join(workspace.root, 'src/escape'));
  for (const path of ['../secret.js', 'routes/[id]/../secret.js', 'routes/[id]/secret.js', 'src/escape/secret.js']) {
    const quality = contract();
    quality.checks[0].paths = [path];
    assert.throws(() => parseQualityContract(specification(quality), { root: workspace.root }), /path|workspace|inv[aá]lido/i);
    const execution = workspace.inspect([path]);
    assert.equal(execution.error, undefined);
    assert.notEqual(execution.status, 0, path);
  }
});

for (const perfil of profiles) {
  test(`E5 intentionally empty text can cite measured local SPEC evidence in ${perfil}`, async t => {
    const workspace = fixture(t, { empty: true });
    const inventory = measured(workspace);
    assert.deepEqual(inventory.files.find(file => file.path === 'src/a.js'), { path: 'src/a.js', lines: 0, bytes: 0, status: 'text' });
    const { result } = await audit(contract(), inventory, { perfil, path: specPath, line: workspace.specLine, observation: emptyObservation });
    assert.equal(result.status, 'verde', JSON.stringify(result));
  });
}

for (const scenario of ['invented-empty-line', 'missing-spec', 'invalid-spec-line', 'nonempty-fallback', 'zero-lines-with-bytes']) {
  test(`E6 empty-target fallback rejects ${scenario}`, async t => {
    const workspace = fixture(t, { empty: true });
    if (scenario === 'nonempty-fallback' || scenario === 'zero-lines-with-bytes') workspace.write('src/a.js', 'x');
    const inventory = measured(workspace);
    const evidence = { path: specPath, line: workspace.specLine, observation: emptyObservation };
    if (scenario === 'invented-empty-line') evidence.path = 'src/a.js', evidence.line = 1;
    if (scenario === 'missing-spec') inventory.files = inventory.files.filter(file => file.path !== specPath);
    if (scenario === 'invalid-spec-line') evidence.line = inventory.files.find(file => file.path === specPath).lines + 1;
    if (scenario === 'zero-lines-with-bytes') inventory.files.find(file => file.path === 'src/a.js').lines = 0;
    const { result } = await audit(contract(), inventory, evidence);
    rejected(result);
  });
}

test('E6 nonempty text still accepts direct evidence at its measured source line', async t => {
  const workspace = fixture(t);
  const { result } = await audit(contract(), measured(workspace));
  assert.equal(result.status, 'verde', JSON.stringify(result));
});
