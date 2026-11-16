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
  return { root, env, write, paths, inspect, git };
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

  // 3.0.4: o ramo sem decisão sai `bloqueado` na fase Validar (teste protegido intacto acima de 400 linhas); o ramo com omissão passa pela recoleta sem resposta e sai `erro` nomeado.
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

// ── odin 3.0.3: os scripts reais num repositório git temporário (A25, A26) ───────────────────────
// O harness roda com `workspaceRoot` e `scriptsDir` reais e o agente falso EXECUTA os comandos que o
// pedido emite (`inspecionar-git.mjs quality` e `hashes-testes.mjs`): a saída real volta ao harness.
// Sem inventário nem hash escritos à mão, o par script e controlador é medido junto, e o acordo
// sobre o formato do hash (conferência CRC-32) deixa de depender de dois vetores que concordam.
const emitidos = (prompt, nome, fora = null) => [...prompt.matchAll(/```bash\s*\n([\s\S]*?)```/g)]
  .map(match => match[1].trim()).filter(command => command.includes(nome) && (fora === null || !command.includes(fora)));
function executar(workspace, command) {
  const execution = spawnSync(command, { cwd: workspace.root, env: workspace.env, shell: true, encoding: 'utf8' });
  assert.equal(execution.error, undefined);
  return execution;
}
// Resposta de validação com o inventário e os hashes que os scripts reais produziram.
function validacaoReal(table, workspace, registro) {
  return (options, calls, prompt) => {
    const [inventario] = emitidos(prompt, 'inspecionar-git.mjs');
    const [hashes] = emitidos(prompt, 'hashes-testes.mjs', '--impressao');
    assert.ok(inventario && hashes, 'a validação emite o comando do inventário e o dos hashes');
    const quality = executar(workspace, inventario);
    const medidos = executar(workspace, hashes);
    registro.push({ comando: inventario, status: quality.status, inventario: JSON.parse(quality.stdout), hashesStatus: medidos.status });
    return { ...table['validar:'](options), qualityInventory: JSON.parse(quality.stdout), hashesDosTestes: JSON.parse(medidos.stdout) };
  };
}
const hashesReais = (table, workspace) => (options, calls, prompt) => {
  const [hashes] = emitidos(prompt, 'hashes-testes.mjs', '--impressao');
  assert.ok(hashes, 'o pedido do portão emite o comando dos hashes');
  const medidos = executar(workspace, hashes);
  assert.equal(medidos.status, 0, medidos.stderr);
  return { ...table['tdd:vermelho'](options), hashesDosTestes: JSON.parse(medidos.stdout) };
};

test('A25: relato que difere do nome do git só na caixa fecha verde com core.ignoreCase=true, medido pelo nome do git', async t => {
  const quality = contract();
  const workspace = fixture(t, quality);
  workspace.git('config', 'core.ignoreCase', 'true');
  const table = responses(quality);
  const registro = [];
  const { result, calls } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: {
    'tdd:vermelho': hashesReais(table, workspace),
    'impl:': () => { workspace.write('src/modulo.js', 'export const modulo = 1;\n'); return { ...table['impl:'](), arquivosTocados: ['src/Modulo.js'] }; },
    'validar:': validacaoReal(table, workspace, registro),
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result.detalhe ?? result));
  assert.equal(result.iteracoes, 1, 'sem correção ao operário');
  assert.equal(registro[0].status, 0, 'o script real sai 0');
  assert.deepEqual(registro[0].inventario.aliases, [{ requested: 'src/Modulo.js', path: 'src/modulo.js' }]);
  assert.ok(registro[0].inventario.files.some(file => file.path === 'src/modulo.js' && file.status === 'text' && file.lines > 0));
  assert.deepEqual(registro[0].inventario.errors, []);
  const diff = calls.find(call => call.label === 'ponytail:i1').prompt.split('\n').find(line => line.includes('inspecionar-git.mjs') && line.includes(' diff '));
  assert.ok(diff.includes('src/modulo.js') && !diff.includes('src/Modulo.js'), `o diff da auditoria usa o nome do git: ${diff}`);
});

test('A25: alvo required ausente do contrato vira correção e fecha verde depois de criado, com o inventário real', async t => {
  const quality = contract();
  for (const check of quality.checks) check.paths = ['src/a.js', 'src/novo-modulo.js'];
  const workspace = fixture(t, quality);
  const table = responses(quality);
  const registro = [];
  let vez = 0;
  const { result, calls } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: {
    'tdd:vermelho': hashesReais(table, workspace),
    'impl:': () => { if (vez++ === 1) workspace.write('src/novo-modulo.js', 'export const novo = 1;\n'); return table['impl:'](); },
    'validar:': validacaoReal(table, workspace, registro),
    'ponytail:': () => ({ ...table['ponytail:'](), qualityReview: quality.checks.map(check => ({ id: check.id, status: 'satisfied', finding: {},
      evidence: check.paths.map(path => ({ path, line: 1, observation: 'Inspected the module boundary and its explicit error handling.' })) })) }),
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result.detalhe ?? result));
  assert.equal(result.iteracoes, 2);
  assert.equal(registro[0].status, 1, 'o script real recusa o alvo ausente');
  assert.ok(registro[0].inventario.errors.some(error => error.includes('src/novo-modulo.js') && error.includes('arquivo ausente ou ignorado')));
  assert.equal(registro[1].status, 0);
  assert.deepEqual(registro[1].inventario.errors, []);
  assert.ok(!calls.some(call => call.label === 'ponytail:i1'), 'sem auditoria enquanto o alvo do contrato falta');
  assert.ok(calls.filter(call => call.label.startsWith('impl:'))[1].prompt.includes('inventario-quality'), 'o operário recebe a correção');
});

test('A25: apoio editado entre o portão e a validação vira bloqueante apoio-intacto com os hashes reais', async t => {
  const quality = contract();
  const workspace = fixture(t, quality, { support: true });
  const table = responses(quality);
  const registro = [];
  let vez = 0;
  const { result, calls } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: {
    'tdd:portao': () => ({ ...table['tdd:portao'](), apoio: [supportPath] }),
    'tdd:vermelho': hashesReais(table, workspace),
    'impl:': () => { workspace.write(supportPath, vez++ === 0 ? 'export const invalidInput = "editado";\n' : 'export const invalidInput = null;\n'); return table['impl:'](); },
    'validar:': validacaoReal(table, workspace, registro),
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result.detalhe ?? result));
  assert.equal(result.iteracoes, 2, 'a edição do apoio não fecha a primeira iteração');
  const correcao = calls.filter(call => call.label.startsWith('impl:'))[1].prompt;
  assert.match(correcao, /"origem":"apoio-intacto"/);
  assert.match(correcao, /"natureza":"integridade-do-apoio"/);
  assert.ok(correcao.includes(supportPath));
  assert.ok(registro.every(item => item.hashesStatus === 0), 'o script real de hashes sai 0');
  assert.ok(!calls.some(call => call.label.startsWith('confirmar:') || call.label.startsWith('hashes:')));
});

test('A26: arquivosTocados com caminho absoluto sob a raiz leva o relativo ao comando real, o script sai 0 e o run fecha verde', async t => {
  const quality = contract();
  const workspace = fixture(t, quality);
  const table = responses(quality);
  const registro = [];
  const { result } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: {
    'tdd:vermelho': hashesReais(table, workspace),
    'impl:': () => ({ ...table['impl:'](), arquivosTocados: [join(workspace.root, 'src/a.js')] }),
    'validar:': validacaoReal(table, workspace, registro),
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result.detalhe ?? result));
  assert.equal(registro.length, 1);
  assert.equal(registro[0].status, 0, 'o script real sai 0');
  assert.ok(registro[0].comando.includes(JSON.stringify(['src/a.js', testPath, specPath])), registro[0].comando);
  assert.ok(!registro[0].comando.includes(`${workspace.root}/src`), 'o comando emitido não leva o absoluto');
  assert.deepEqual(registro[0].inventario.errors, []);
  assert.equal(Object.hasOwn(registro[0].inventario, 'aliases'), false, 'sem troca de nome, o JSON não ganha o campo aliases');
});

// ── odin 3.0.4: a medição cedo com os scripts reais (A24, A25) ───────────────────────────────────
// O agente falso de `DEFAULTS` deriva o inventário do prompt e não prova o formato do script. Aqui o
// agente EXECUTA o comando que `spec:inventario`, `tdd:inventario` e a validação emitem, num repositório
// git temporário, e a saída real volta ao harness: filtro e flag do git, e arquivo de 401 linhas, são
// medidos pelo script, não escritos à mão.
function inventarioReal(workspace, registro) {
  return (options, calls, prompt) => {
    const [comando] = emitidos(prompt, 'inspecionar-git.mjs');
    assert.ok(comando, 'o pedido emite o comando do inventário');
    const execucao = executar(workspace, comando);
    const inventario = JSON.parse(execucao.stdout);
    registro.push({ comando, status: execucao.status, inventario });
    return { qualityInventory: inventario };
  };
}
const medicoesReais = (table, workspace, registro) => ({
  'spec:inventario': inventarioReal(workspace, registro),
  'tdd:inventario': inventarioReal(workspace, registro),
  'tdd:vermelho': hashesReais(table, workspace),
  'validar:': validacaoReal(table, workspace, registro),
});

test('304-A24: com os scripts reais, filtro clean e flag skip-worktree bloqueiam a fase Spec e teste de 401 linhas bloqueia a fase TDD', async t => {
  const quality = contract();
  const table = responses(quality);
  const preparos = [
    ['filtro clean sobre arquivo rastreado', 'src/a.js', workspace => {
      workspace.write('.gitattributes', 'src/a.js filter=odin304\n');
      workspace.git('config', 'filter.odin304.clean', 'cat');
    }],
    ['flag skip-worktree num alvo', 'src/a.js', workspace => workspace.git('update-index', '--skip-worktree', 'src/a.js')],
  ];
  for (const [nome, arquivo, preparar] of preparos) {
    const workspace = fixture(t, quality);
    preparar(workspace);
    const registro = [];
    const { result, calls } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: medicoesReais(table, workspace, registro) });
    assert.equal(result.status, 'bloqueado', `${nome}: ${JSON.stringify(result.detalhe ?? result)}`);
    assert.equal(result.fase, 'Spec', nome);
    assert.ok(String(result.detalhe).includes(arquivo), `${nome}: o detalhe nomeia ${arquivo}: ${result.detalhe}`);
    assert.equal(registro[0]?.status, 1, `${nome}: o script real recusa`);
    assert.ok(!calls.some(call => call.label === 'tdd:portao'), `${nome}: bloqueia antes do portão`);
  }
  const workspace = fixture(t, quality);
  workspace.write(testPath, 'import test from "node:test";\n' + Array.from({ length: 400 }, (_, index) => `test("boundary case ${index}", () => {});\n`).join(''));
  const registro = [];
  const { result, calls } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: medicoesReais(table, workspace, registro) });
  assert.equal(result.status, 'bloqueado', JSON.stringify(result.detalhe ?? result));
  assert.equal(result.fase, 'TDD');
  assert.ok(String(result.detalhe).includes(testPath) && String(result.detalhe).includes('401'), `o detalhe nomeia o teste e a contagem: ${result.detalhe}`);
  assert.ok(!calls.some(call => call.label.startsWith('impl:')), 'bloqueia antes da implementação');
});

test('304-A25: com os scripts reais e sem filtro, flag nem arquivo grande, todo comando de inventário emitido sai 0 e o run fecha verde', async t => {
  const quality = contract();
  const workspace = fixture(t, quality, { support: true });
  const table = responses(quality);
  const registro = [];
  const { result } = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir, specPath }, overrides: {
    ...medicoesReais(table, workspace, registro),
    'tdd:portao': () => ({ ...table['tdd:portao'](), apoio: [supportPath] }),
  } });
  assert.equal(result.status, 'verde', JSON.stringify(result.detalhe ?? result));
  assert.ok(registro.length >= 1, 'ao menos o inventário da validação rodou');
  for (const medicao of registro) {
    assert.equal(medicao.status, 0, `o script real sai 0: ${medicao.comando}`);
    assert.deepEqual(medicao.inventario.errors, [], medicao.comando);
  }
});
