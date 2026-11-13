import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { contract, responses, runHarness, specification } from './support/quality-fixtures.mjs';
import { parseQualityContract } from '../skills/dev-loop/scripts/quality-contract.mjs';

const scriptsDir = fileURLToPath(new URL('../skills/dev-loop/scripts/', import.meta.url));
const specPath = 'docs/plans/spec.md';
const testPath = 'tests/a.test.js';
const supportPath = 'tests/helpers/input.js';
const profiles = ['economico', 'balanceado', 'maximo'];

function temporaryWorkspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'odin-quality-regression-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function fixture(t, quality = contract(), { support = false } = {}) {
  const root = temporaryWorkspace(t);
  const env = {
    ...process.env,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}`,
    GIT_CONFIG_GLOBAL: join(root, '.git', 'fixture-global-config'), GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0',
  };
  const write = (path, content) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git('init', '-q');
  write('src/a.js', 'export const accepts = input => typeof input === "string";\n');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(root, '.git', 'fixture-hooks')}`, 'commit', '-qm', 'fixture');
  write(specPath, specification(quality));
  write(testPath, 'import test from "node:test";\ntest("input boundary", () => {});\n');
  if (support) write(supportPath, 'export const invalidInput = null;\n');
  const paths = ['src/a.js', specPath, testPath, ...(support ? [supportPath] : [])];
  const inspect = (targets = paths) => {
    const result = spawnSync(process.execPath,
      [join(scriptsDir, 'inspecionar-git.mjs'), 'quality', JSON.stringify(targets)],
      { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  return { root, env, write, paths, inspect };
}

function blocked(result, context) {
  assert.ok(['erro', 'bloqueado', 'escalado'].includes(result.status), `${context}: ${JSON.stringify(result)}`);
  assert.match(JSON.stringify(result), /quality|qualidade|Q-|invent|evid/i);
}

function measuredValidation(table, inventory) {
  return options => ({ ...table['validar:'](options), qualityInventory: structuredClone(inventory) });
}

function waivedContract() {
  const quality = contract();
  const check = quality.checks.find(item => item.id === 'Q-ERRORS');
  check.applicability = 'not-applicable';
  check.reason = 'Only static labels change; this scope adds no operation that can fail.';
  return quality;
}

function reviewAtSpec(table, line, allChecks = false, observation = 'The approved SPEC records why this check does not apply to the changed scope.') {
  const response = table['ponytail:']();
  for (const item of response.qualityReview) {
    if (allChecks || item.status === 'not-applicable') {
      item.evidence = [{ path: specPath, line, observation }];
    }
  }
  return response;
}

for (const perfil of profiles) test(`R1 inventoried unrelated evidence cannot replace an approved target in ${perfil}`, async t => {
  const quality = contract();
  const workspace = fixture(t, quality);
  workspace.write('src/unrelated.js', 'export const unrelated = true;\n');
  const measured = workspace.inspect([...workspace.paths, 'src/unrelated.js']);
  const table = responses(quality);
  const { result } = await runHarness({ quality, options: { perfil }, overrides: {
      'validar:': measuredValidation(table, measured),
      'ponytail:': () => {
        const response = table['ponytail:']();
        for (const item of response.qualityReview) item.evidence = [{ path: 'src/unrelated.js', line: 1,
          observation: 'Inspected only the unrelated constant; src/a.js was not reviewed.' }];
        return response;
      },
  } });
  blocked(result, perfil);
});

test('R2 the emitted inventory command reconciles new protected tests SPEC and declared TDD support', async t => {
  const quality = contract();
  const workspace = fixture(t, quality, { support: true });
  const table = responses(quality);
  let measured;
  const { result } = await runHarness({ quality,
    options: { workspaceRoot: workspace.root, scriptsDir, specPath },
    overrides: {
      'tdd:portao': () => ({ ...table['tdd:portao'](), apoio: [supportPath] }),
      'tdd:vermelho': options => ({ ...table['tdd:vermelho'](options),
        alteracoes: { comparadoCom: 'HEAD', alterados: [specPath, testPath, supportPath], adicionados: [specPath, testPath, supportPath] } }),
      'validar:': (options, calls, prompt) => {
        const commands = [...prompt.matchAll(/```bash\s*\n([\s\S]*?)```/g)]
          .map(match => match[1].trim())
          .filter(command => command.includes('inspecionar-git.mjs') && /\squality\s/.test(command));
        assert.equal(commands.length, 1, 'The validator needs one executable quality inventory command');
        const execution = spawnSync(commands[0], { cwd: workspace.root, env: workspace.env, shell: true, encoding: 'utf8' });
        assert.equal(execution.error, undefined);
        assert.equal(execution.status, 0, execution.stderr);
        measured = JSON.parse(execution.stdout);
        return { ...table['validar:'](options), qualityInventory: measured };
      },
    },
  });
  assert.ok(measured, 'The real helper must run during validation');
  assert.deepEqual(measured.errors, []);
  assert.deepEqual(measured.uninspected, [], 'Authorized new files must not remain unreconciled');
  for (const path of workspace.paths) {
    assert.ok(measured.files.some(file => file.path === path && file.status === 'text' && file.lines > 0), path);
  }
  assert.equal(result.status, 'verde', JSON.stringify(result));
});

test('R3 existing directories fail canonical preflight before TDD', async t => {
  const root = temporaryWorkspace(t);
  mkdirSync(join(root, 'src'));
  const quality = contract();
  quality.checks[0].paths = ['src'];
  assert.throws(() => parseQualityContract(specification(quality), { root }), /path|arquivo|diret[oó]rio|file|directory/i);
  writeFileSync(join(root, 'spec.md'), specification(quality));
  const preflight = spawnSync(process.execPath, [join(scriptsDir, 'spec-ids.mjs'), 'spec.md', '--quality'], { cwd: root, encoding: 'utf8' });
  assert.equal(preflight.error, undefined);
  assert.notEqual(preflight.status, 0);
  const { result, calls } = await runHarness({ overrides: { 'spec:ids': () => JSON.parse(preflight.stdout) } });
  assert.notEqual(result.status, 'verde');
  assert.ok(!calls.some(call => call.label === 'tdd:portao' || call.label.startsWith('impl:')));
});

test('R3 concrete future file paths remain valid before their directories exist', t => {
  const root = temporaryWorkspace(t);
  const quality = contract();
  quality.checks[0].paths = ['future/nested/new-module.js'];
  assert.deepEqual(parseQualityContract(specification(quality), { root }), quality);
});

for (const missing of [true, false]) test(`R4 a dispensation cannot cite ${missing ? 'an unmeasured SPEC' : 'a line beyond measured SPEC text'}`, async t => {
  const quality = waivedContract();
  const workspace = fixture(t, quality);
  const measured = workspace.inspect();
  const spec = measured.files.find(file => file.path === specPath);
  const table = responses(quality);
  const inventory = structuredClone(measured);
  if (missing) inventory.files = inventory.files.filter(file => file.path !== specPath);
  const { result } = await runHarness({ quality, overrides: {
    'validar:': measuredValidation(table, inventory),
    'ponytail:': () => reviewAtSpec(table, missing ? 999999 : spec.lines + 1),
  } });
  blocked(result, missing ? 'SPEC absent from inventory' : 'SPEC line out of bounds');
});

test('R4 an approved dispensation can cite a measured existing SPEC line', async t => {
  const quality = waivedContract();
  const workspace = fixture(t, quality);
  const measured = workspace.inspect();
  const table = responses(quality);
  const reasonLine = specification(quality).split('\n').findIndex(line => line.includes(quality.checks.find(check => check.id === 'Q-ERRORS').reason)) + 1;
  assert.ok(reasonLine > 0);
  const { result } = await runHarness({ quality, overrides: {
    'validar:': measuredValidation(table, measured),
    'ponytail:': () => reviewAtSpec(table, reasonLine),
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result));
});

for (const status of ['binary', 'deleted']) {
  test(`R4 ${status} limitations can cite measured SPEC text without inventing source lines`, async t => {
    const quality = contract();
    const workspace = fixture(t, quality);
    if (status === 'binary') workspace.write('src/a.js', Buffer.from([1, 0, 2]));
    else rmSync(join(workspace.root, 'src/a.js'));
    const observation = status === 'binary'
      ? 'src/a.js is binary; inspect its format metadata and consumer because no textual source line exists.'
      : 'src/a.js is deleted; inspect its base behavior and remaining callers because no worktree source line exists.';
    const specText = `${specification(quality)}\n## Nontext inspection\n${observation}\n`;
    workspace.write(specPath, specText);
    const evidenceLine = specText.split('\n').indexOf(observation) + 1;
    const measured = workspace.inspect();
    assert.equal(measured.files.find(file => file.path === 'src/a.js').status, status);
    const table = responses(quality);
    const { result } = await runHarness({ quality, overrides: {
      'validar:': measuredValidation(table, measured),
      'ponytail:': () => reviewAtSpec(table, evidenceLine, true, observation),
    } });
    assert.equal(result.status, 'verde', JSON.stringify(result));
  });
}

test('R5 the independent auditor receives literal command output and must confront its target and report', async t => {
  const quality = contract();
  const workspace = fixture(t, quality);
  const table = responses(quality);
  const output = 'TAP version 13\n1..0\n# tests 0\n# pass 0\n# fail 0\n# diagnostic: "literal transport"';
  const { calls } = await runHarness({ quality, overrides: {
    'validar:': options => {
      const response = measuredValidation(table, workspace.inspect())(options);
      response.qualityExecutions[0].output = output;
      return response;
    },
  } });
  const auditor = calls.find(call => call.label.startsWith('ponytail:'));
  assert.ok(auditor, 'Complete execution evidence must reach independent semantic review');
  assert.ok(auditor.prompt.includes(output) || auditor.prompt.includes(JSON.stringify(output).slice(1, -1)),
    'The auditor must receive the literal output, including the zero-test report');
  assert.match(auditor.prompt, /(?:confront|compar|verifi|audit)[^\n]*(?:sa[ií]da|output|execu[cç][oõ]es)/i);
  assert.match(auditor.prompt, /(?:alvo|target)[^\n]*(?:relat[oó]rio|resultado)|(?:relat[oó]rio|resultado)[^\n]*(?:alvo|target)/i);
});

test('R6 a measured functional quality failure enters correction and revalidation', async t => {
  const quality = contract();
  const workspace = fixture(t, quality);
  const measured = workspace.inspect();
  const table = responses(quality);
  let validations = 0;
  const failure = 'Quality command found a public input boundary accepting malformed data.';
  const { result, calls } = await runHarness({ quality, overrides: {
    'validar:': options => {
      const response = measuredValidation(table, measured)(options);
      if (validations++ === 0) {
        response.verde = false;
        response.qualityExecutions[0].exitCode = 1;
        response.qualityExecutions[0].output = failure;
        response.falhas = [{ comando: response.qualityExecutions[0].command, resumo: failure, natureza: 'funcional', evidencia: 'src/a.js:1' }];
      }
      return response;
    },
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result));
  assert.equal(result.iteracoes, 2);
  assert.equal(validations, 2);
  const workers = calls.filter(call => call.label.startsWith('impl:'));
  assert.equal(workers.length, 2);
  assert.ok(workers[1].prompt.includes(failure), 'The next worker must receive the concrete failure');
});

test('R6 an environmental quality failure remains operational error without implementation retries', async t => {
  const quality = contract();
  const workspace = fixture(t, quality);
  const table = responses(quality);
  const { result, calls } = await runHarness({ quality, overrides: {
    'validar:': options => {
      const response = measuredValidation(table, workspace.inspect())(options);
      response.verde = false;
      response.qualityExecutions[0].exitCode = 1;
      response.qualityExecutions[0].output = 'EACCES: permission denied while opening TMPDIR/cache';
      response.falhas = [{ comando: response.qualityExecutions[0].command,
        resumo: response.qualityExecutions[0].output, natureza: 'ambiente', evidencia: 'TMPDIR/cache: EACCES' }];
      return response;
    },
  } });
  assert.equal(result.status, 'erro', JSON.stringify(result));
  assert.equal(result.motivo, 'ambiente');
  assert.equal(calls.filter(call => call.label.startsWith('impl:')).length, 1);
  assert.equal(calls.filter(call => call.label.startsWith('validar:')).length, 1);
});

async function runCompleteInventoryScenario(quality, measured, perfil) {
  const table = responses(quality);
  return runHarness({ quality, options: { perfil }, overrides: {
    'tdd:portao': () => ({ ...table['tdd:portao'](), apoio: [supportPath] }),
    'tdd:vermelho': options => ({ ...table['tdd:vermelho'](options),
      alteracoes: { comparadoCom: 'HEAD', alterados: [specPath, testPath, supportPath], adicionados: [specPath, testPath, supportPath] } }),
    'validar:': measuredValidation(table, measured),
  } });
}

for (const perfil of profiles) {
  for (const omitted of [testPath, supportPath, specPath]) {
    test(`R7 requested inventory cannot omit ${omitted} in ${perfil}`, async t => {
      const quality = contract();
      const workspace = fixture(t, quality, { support: true });
      const measured = workspace.inspect();
      assert.ok(measured.files.some(file => file.path === omitted));
      const incomplete = { ...measured, files: measured.files.filter(file => file.path !== omitted) };
      const { result } = await runCompleteInventoryScenario(quality, incomplete, perfil);
      blocked(result, `Requested file omitted: ${omitted}`);
    });
  }

  test(`R7 complete measured inventory of source SPEC test and support passes in ${perfil}`, async t => {
    const quality = contract();
    const workspace = fixture(t, quality, { support: true });
    const measured = workspace.inspect();
    assert.deepEqual(measured.errors, []);
    assert.deepEqual(measured.uninspected, []);
    assert.deepEqual(new Set(measured.files.map(file => file.path)), new Set(workspace.paths));
    const { result } = await runCompleteInventoryScenario(quality, measured, perfil);
    assert.equal(result.status, 'verde', JSON.stringify(result));
  });

  test(`R8 omitting a measured 401-line test cannot bypass decomposition in ${perfil}`, async t => {
    const quality = contract();
    const workspace = fixture(t, quality, { support: true });
    workspace.write(testPath, 'import test from "node:test";\n' +
      Array.from({ length: 400 }, (_, index) => `test("boundary case ${index}", () => {});\n`).join(''));
    const measured = workspace.inspect();
    assert.equal(measured.files.find(file => file.path === testPath).lines, 401);
    const withoutDecision = await runCompleteInventoryScenario(quality, measured, perfil);
    blocked(withoutDecision.result, 'Measured large test without decomposition decision');
    assert.match(JSON.stringify(withoutDecision.result), /decompos/i);

    const justified = structuredClone(quality);
    justified.decomposition = [{ path: testPath, trigger: 'The measured independent test corpus has 401 lines.',
      decision: 'Keep the cohesive boundary corpus together; production responsibilities remain separate.',
      verification: 'Independent review checks each case against the public input contract.' }];
    const accepted = await runCompleteInventoryScenario(justified, measured, perfil);
    assert.equal(accepted.result.status, 'verde', JSON.stringify(accepted.result));

    const incomplete = { ...measured, files: measured.files.filter(file => file.path !== testPath) };
    const omitted = await runCompleteInventoryScenario(quality, incomplete, perfil);
    blocked(omitted.result, 'Omission must not hide the large protected test');
  });
}

function externalSpecPreflight(t, workspace, quality) {
  const externalSpec = join(temporaryWorkspace(t), 'spec.md');
  writeFileSync(externalSpec, specification(quality));
  const execution = spawnSync(process.execPath,
    [join(scriptsDir, 'spec-ids.mjs'), externalSpec, '--quality'],
    { cwd: workspace.root, env: workspace.env, encoding: 'utf8' });
  assert.equal(execution.error, undefined);
  assert.equal(execution.status, 0, execution.stderr);
  const preflight = JSON.parse(execution.stdout);
  assert.deepEqual(preflight.quality, quality);
  return { externalSpec, preflight };
}

for (const perfil of profiles) {
  test(`R9 external SPEC supports local quality inventory without null targets in ${perfil}`, async t => {
    const quality = contract();
    const workspace = fixture(t, quality);
    const { externalSpec, preflight } = externalSpecPreflight(t, workspace, quality);
    rmSync(join(workspace.root, specPath));
    const table = responses(quality);
    let command;
    let inventoryExecution;
    const { result } = await runHarness({ quality,
      options: { perfil, workspaceRoot: workspace.root, scriptsDir, specPath: externalSpec },
      overrides: {
        'spec:ids': () => preflight,
        'validar:': (options, calls, prompt) => {
          command = [...prompt.matchAll(/```bash\s*\n([\s\S]*?)```/g)]
            .map(match => match[1].trim())
            .find(value => value.includes('inspecionar-git.mjs') && /\squality\s/.test(value));
          assert.ok(command, 'Validation must emit the local inventory command');
          inventoryExecution = spawnSync(command, { cwd: workspace.root, env: workspace.env, shell: true, encoding: 'utf8' });
          assert.equal(inventoryExecution.error, undefined);
          return { ...table['validar:'](options), qualityInventory: JSON.parse(inventoryExecution.stdout) };
        },
      },
    });
    assert.ok(inventoryExecution, 'The emitted command must actually run');
    assert.equal(inventoryExecution.status, 0, inventoryExecution.stderr);
    assert.ok(!command.includes('null'), command);
    const measured = JSON.parse(inventoryExecution.stdout);
    assert.deepEqual(new Set(measured.files.map(file => file.path)), new Set(['src/a.js', testPath]));
    assert.deepEqual(measured.uninspected, []);
    assert.deepEqual(measured.errors, []);
    assert.equal(result.status, 'verde', JSON.stringify(result));
  });

  test(`R10 external SPEC cannot supply inventoried dispensation evidence in ${perfil}`, async t => {
    const quality = waivedContract();
    const workspace = fixture(t, quality);
    const { externalSpec, preflight } = externalSpecPreflight(t, workspace, quality);
    rmSync(join(workspace.root, specPath));
    const measured = workspace.inspect(['src/a.js', testPath]);
    const table = responses(quality);
    let attemptedExternalEvidence = false;
    const { result } = await runHarness({ quality,
      options: { perfil, workspaceRoot: workspace.root, scriptsDir, specPath: externalSpec },
      overrides: {
        'spec:ids': () => preflight,
        'validar:': measuredValidation(table, measured),
        'ponytail:': () => {
          attemptedExternalEvidence = true;
          const response = table['ponytail:']();
          response.qualityReview.find(item => item.id === 'Q-ERRORS').evidence = [{
            path: externalSpec, line: 1, observation: 'Attempted to cite the external SPEC as the source of this dispensation.',
          }];
          return response;
        },
      },
    });
    assert.ok(attemptedExternalEvidence, 'A valid local inventory must reach the auditor before testing evidence rejection');
    blocked(result, 'External SPEC is outside the inspected workspace inventory');
  });
}
