import assert from 'node:assert/strict';
import test from 'node:test';
import { contract, executions, inventory, review, responses, runHarness, assertQualityReport } from './support/quality-fixtures.mjs';
const profiles = ['economico', 'balanceado', 'maximo'];
function blocked(result, context) {
  assert.notEqual(result.status, 'verde', context);
  assert.ok(['erro', 'bloqueado', 'escalado'].includes(result.status), JSON.stringify(result));
  assert.match(JSON.stringify(result), /quality|qualidade|Q-|invent|evid|cobertura|decompos/i);
}
test('A3 complete independent evidence reaches green in every cost profile and survives reporting', async () => {
  const quality = contract(['base', 'typescript', 'frontend', 'backend']);
  for (const perfil of profiles) {
    const { result, calls } = await runHarness({ quality, options: { perfil } });
    assertQualityReport(result, quality);
    assert.match(calls.find(c => c.label === 'spec:ids').prompt, /--quality/);
    for (const call of calls.filter(c => c.label.startsWith('impl:') || c.label.startsWith('rev:') || c.label.startsWith('ponytail:'))) {
      assert.ok(call.prompt.includes('Q-NAMES'), `${call.label}: contract must travel to independent worker/review`);
    }
  }
});
test('A3 malformed or missing preflight quality blocks before TDD', async () => {
  for (const mutate of [q => undefined, q => ({ ...q, checks: q.checks.slice(1) }), q => ({ ...q, profiles: ['unknown'] })]) {
    const table = responses(); const quality = mutate(contract());
    const { result, calls } = await runHarness({ overrides: { 'spec:ids': () => { const value = table['spec:ids'](); if (quality === undefined) delete value.quality; else value.quality = quality; return value; } } });
    blocked(result, JSON.stringify(quality));
    assert.ok(!calls.some(c => c.label === 'tdd:portao'));
  }
});
test('A3 missing duplicate swapped failed and fabricated command evidence never closes green', async () => {
  const quality = contract(); const table = responses(quality);
  const mutations = [
    value => { delete value.qualityExecutions; }, value => { value.qualityExecutions = []; },
    value => { value.qualityExecutions.push({ ...value.qualityExecutions[0] }); },
    value => { value.qualityExecutions[0].id = 'Q-NAMES'; },
    value => { value.qualityExecutions[0].command = 'echo green'; },
    value => { value.qualityExecutions[0].paths = ['src/other.js']; },
    value => { value.qualityExecutions[0].exitCode = 1; }, value => { value.qualityExecutions[0].exitCode = '0'; },
    value => { value.qualityExecutions[0].output = ' '; },
  ];
  for (const perfil of profiles) for (const mutate of mutations) {
    const { result } = await runHarness({ quality, options: { perfil }, overrides: { 'validar:': opts => { const value = table['validar:'](opts); mutate(value); return value; } } });
    blocked(result, `${perfil}: ${mutate}`);
  }
});
test('A3 missing duplicate fabricated or unauthorized review evidence never closes green', async () => {
  const table = responses();
  const mutations = [
    value => { delete value.qualityReview; }, value => { value.qualityReview.pop(); },
    value => { value.qualityReview.push({ ...value.qualityReview[0] }); },
    value => { value.qualityReview[0].status = 'not-applicable'; },
    value => { value.qualityReview[0].evidence = []; },
    value => { value.qualityReview[0].evidence[0].path = 'src/not-inspected.js'; },
    value => { value.qualityReview[0].evidence[0].line = 0; },
    value => { value.qualityReview[0].evidence[0].line = 999; },
    value => { value.qualityReview[0].evidence[0].observation = ''; },
    value => { value.qualityReview[0].status = 'issue'; value.qualityReview[0].finding = {}; },
  ];
  for (const perfil of profiles) for (const mutate of mutations) {
    const { result } = await runHarness({ options: { perfil }, overrides: { 'ponytail:': () => { const value = table['ponytail:'](); mutate(value); return value; } } });
    blocked(result, `${perfil}: ${mutate}`);
  }
});
test('A3 incomplete inventory and invented textual evidence cannot approve quality', async () => {
  const table = responses();
  const mutations = [
    value => { delete value.qualityInventory; }, value => { value.qualityInventory.files = []; },
    value => { value.qualityInventory.uninspected = ['src/new.js']; },
    value => { value.qualityInventory.errors = ['permission denied']; },
    value => { value.qualityInventory.files[0].status = 'binary'; value.qualityInventory.files[0].lines = 0; },
    value => { value.qualityInventory.files[0].status = 'deleted'; value.qualityInventory.files[0].lines = 0; value.qualityInventory.files[0].bytes = 0; },
    value => { value.qualityInventory.files[0].path = '../secret.js'; },
  ];
  for (const mutate of mutations) {
    const { result } = await runHarness({ overrides: { 'validar:': opts => { const value = table['validar:'](opts); mutate(value); return value; } } });
    blocked(result, String(mutate));
  }
});
test('A3 large cohesive files need an explicit decomposition decision rather than automatic rejection', async () => {
  const quality = contract(); const table = responses(quality);
  const large = opts => { const value = table['validar:'](opts); value.qualityInventory.files[0].lines = 401; value.qualityInventory.files[0].bytes = 9000; return value; };
  const missing = await runHarness({ quality, overrides: { 'validar:': large } });
  blocked(missing.result, '401 lines without a decision');
  quality.decomposition = [{ path: 'src/a.js', trigger: '401 lines of one cohesive protocol state machine.', decision: 'Keep the state machine together; extracting its transitions would obscure the single invariant. Parsing is already outside this file.', verification: 'Independent review traces transitions and checks separate parsing boundary.' }];
  const justified = await runHarness({ quality, overrides: { 'validar:': large } });
  assertQualityReport(justified.result, quality);
});
test('A3 semantic quality issues use confirmation and confirmed defects cause rework', async () => {
  for (const confirmed of [false, true]) {
    let audits = 0;
    const table = responses();
    const { result, calls } = await runHarness({ overrides: {
      'ponytail:': () => { const value = table['ponytail:'](); if (audits++ === 0) { value.qualityReview[0].status = 'issue'; value.qualityReview[0].finding = { summary: 'Public parser silently accepts an empty account identifier.', scenario: 'Submitting an empty account identifier stores a record that cannot be retrieved.' }; } return value; },
      'confirmar:': () => ({ real: confirmed, bloqueante: confirmed, porque: confirmed ? 'Reproduced empty account identifier through public parsing boundary.' : 'Independent run proves the public parser rejects empty identifiers before storage.' }),
    } });
    assert.ok(calls.some(c => c.label.startsWith('confirmar:')), 'Quality issue must reach independent confirmation');
    assertQualityReport(result, contract());
    assert.equal(result.iteracoes, confirmed ? 2 : 1);
  }
});
test('A3 legitimate single-consumer boundary is retained after architectural confirmation', async () => {
  const table = responses();
  const { result, calls } = await runHarness({ overrides: {
    'ponytail:': () => ({ ...table['ponytail:'](), abstracoesUsoUnico: [{ oQue: 'PaymentGateway', unicoChamador: 'Checkout', arquivo: 'src/a.js', linha: 2, buscaChamadores: 'git grep -n PaymentGateway: one consumer; isolates remote payment I/O' }] }),
    'confirmar:': () => ({ real: true, bloqueante: false, porque: 'One caller is confirmed; the interface isolates external I/O and enables deterministic tests of checkout failures.' }),
  } });
  assertQualityReport(result, contract());
  assert.equal(result.iteracoes, 1);
  const prompt = calls.find(c => c.label.startsWith('confirmar:')).prompt;
  assert.match(prompt, /fronteira|boundary|testabil/i);
});
test('A3 P10 accepts accessible written decisions but never an unlocated boolean', async () => {
  const table = responses();
  const unlocated = await runHarness({ overrides: { 'ponytail:': () => ({ ...table['ponytail:'](), dependenciasNovas: [{ nome: 'parser-package', onde: 'package.json', justificativaEncontrada: true }] }) } });
  assert.notEqual(unlocated.result.status, 'verde', 'A boolean is not a verifiable location');
  // The existing location field can point to a plan/ADR instead of requiring process comments in code.
  const located = await runHarness({ overrides: { 'ponytail:': () => ({ ...table['ponytail:'](), dependenciasNovas: [{ nome: 'parser-package', onde: 'docs/plans/spec.md:42 — P1-P5 examined: installed parsers cannot read this approved binary protocol.', justificativaEncontrada: true }] }) } });
  assertQualityReport(located.result, contract());
});
test('A3 approved dispensations and nontext limitations use explicit SPEC evidence', async () => {
  const quality = contract();
  quality.checks.find(c => c.id === 'Q-ERRORS').applicability = 'not-applicable';
  quality.checks.find(c => c.id === 'Q-ERRORS').reason = 'Only static labels change; no new failing operation exists in this scope.';
  assertQualityReport((await runHarness({ quality })).result, quality);
  for (const status of ['binary', 'deleted']) {
    const table = responses(quality);
    const { result } = await runHarness({ quality, overrides: {
      'validar:': opts => { const value = table['validar:'](opts); value.qualityInventory.files[0] = { path: 'src/a.js', lines: 0, bytes: status === 'deleted' ? 0 : 240, status }; return value; },
      'ponytail:': () => { const value = table['ponytail:'](); for (const item of value.qualityReview) item.evidence = [{ path: 'docs/plans/spec.md', line: 1, observation: status === 'deleted' ? 'The SPEC records deletion; inspected base behavior and remaining callers, with no textual worktree file to cite.' : 'The SPEC records binary classification; inspected format metadata and its consumer, without inventing source lines.' }]; return value; },
    } });
    assertQualityReport(result, quality);
  }
});
