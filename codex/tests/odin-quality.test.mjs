import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { iniciar, responder, proximo } from '../runtime/bridge.mjs';
import { validarDefinicao } from '../runtime/schema.mjs';
import { args, contract, executions, responses, assertQualityReport } from '../../plugins/odin/tests/support/quality-fixtures.mjs';
const packagePath = fileURLToPath(new URL('../plugins/odin', import.meta.url));
// 3.0.4: o pedido `recoleta:<campo>:<escopo>` devolve só o campo pedido. Com `recoleta: 'repete'` o replay
// responde com a MESMA evidência incompleta da primeira resposta (a mutação vale de novo); com `'valida'`,
// com a evidência boa do contrato.
const CAMPOS_DA_RECOLETA = { 'quality-executions': ['qualityExecutions', 'validar:'], 'quality-review': ['qualityReview', 'ponytail:'] };
async function replay(t, mutate, { recoleta = 'repete' } = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'odin-quality-bridge-'));
  const directory = join(temporary, 'run');
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const quality = contract(); const table = responses(quality); const calls = [];
  let state = await iniciar(packagePath, directory, { ...args, perfil: 'maximo' });
  while (state.status === 'aguardando') {
    assert.ok(calls.length < 100, 'Replay must converge');
    const request = state.solicitacoes.at(-1); calls.push(request);
    validarDefinicao(request.schema);
    if (request.label === 'spec:ids') {
      assert.ok(request.schema.properties.quality, 'Codex preflight schema must carry the canonical contract');
      assert.match(request.prompt, /--quality/);
    }
    if (request.label.startsWith('validar:')) {
      for (const field of ['qualityExecutions', 'qualityInventory']) assert.ok(request.schema.properties[field], `Schema missing ${field}`);
    }
    if (request.label.startsWith('ponytail:')) assert.ok(request.schema.properties.qualityReview);
    let value;
    if (request.label.startsWith('recoleta:')) {
      const [, campo, escopo] = request.label.split(':');
      const [nome, origem] = CAMPOS_DA_RECOLETA[campo] ?? [];
      assert.ok(nome, `recoleta sem campo conhecido: ${request.label}`);
      const original = { ...request, label: `${origem}${escopo}` };
      const completo = table[origem](original);
      if (mutate && recoleta === 'repete') mutate(completo, original);
      value = { [nome]: completo[nome] };
    } else {
      const key = Object.keys(table).find(k => k === request.label || (k.endsWith(':') && request.label.startsWith(k)));
      assert.ok(key, request.label);
      value = table[key](request);
      if (mutate) mutate(value, request);
    }
    try { state = await responder(packagePath, directory, request.id, { resultado: value, modeloEfetivo: 'fixture-independent-review' }); }
    catch (error) {
      if (mutate && /schema/.test(error.message)) return { result: { status: 'erro', evidence: error.message }, calls };
      throw error;
    }
  }
  assert.equal(state.status, 'concluido');
  assert.deepEqual(await proximo(packagePath, directory), state);
  return { result: state.resultado, calls };
}
test('A5 full quality contract traverses real Codex bridge with validated schemas', async t => {
  const { result, calls } = await replay(t);
  assertQualityReport(result, contract());
  assert.equal(result.modelos.runtime, 'codex');
  assert.equal(result.modelos.execucoes.length, calls.length);
});
test('A5 Codex bridge refuses incomplete command and review coverage', async t => {
  for (const mutate of [
    (v, r) => { if (r.label.startsWith('validar:')) v.qualityExecutions = []; },
    (v, r) => { if (r.label.startsWith('ponytail:')) v.qualityReview.pop(); },
    (v, r) => { if (r.label.startsWith('ponytail:')) v.qualityReview.push({ ...v.qualityReview[0] }); },
    (v, r) => { if (r.label.startsWith('ponytail:')) v.qualityReview[0].evidence = []; },
  ]) {
    const { result } = await replay(t, mutate);
    assert.notEqual(result.status, 'verde', JSON.stringify(result));
  }
});
test('304-A28: qualityExecutions incompleto em validar:i1 vira o pedido recoleta:quality-executions:i1, no operário, e a evidência válida fecha verde', async t => {
  const incompleto = (v, r) => { if (r.label === 'validar:i1') v.qualityExecutions = []; };
  const { result, calls } = await replay(t, incompleto, { recoleta: 'valida' });
  assert.deepEqual(calls.slice(0, 6).map(c => c.label), ['spec:ids', 'spec:validar', 'spec:inventario', 'tdd:portao', 'tdd:vermelho', 'tdd:inventario'], 'a sequência inicial de pedidos leva as duas medições cedo');
  const recoletas = calls.filter(c => c.label.startsWith('recoleta:'));
  assert.deepEqual(recoletas.map(c => c.label), ['recoleta:quality-executions:i1'], 'uma só recoleta, do campo que falhou');
  assert.equal(recoletas[0].papel, 'odin:operario');
  assert.deepEqual(Object.keys(recoletas[0].schema.properties), ['qualityExecutions']);
  assertQualityReport(result, contract());
  assert.deepEqual(result.quality.iterations[0].executions, executions(contract()), 'o relatório guarda a execução recolhida');
});
test('A5 both distributions contain byte-identical canonical quality resources', () => {
  const source = new URL('../../plugins/odin/skills/dev-loop/', import.meta.url);
  const target = new URL('../plugins/odin/shared/skills/dev-loop/', import.meta.url);
  const resources = ['references/quality-contract.md', 'scripts/quality-contract.mjs', 'scripts/quality-rules.json'];
  for (const path of resources) {
    assert.ok(existsSync(new URL(path, source)), `Missing source ${path}`);
    assert.ok(existsSync(new URL(path, target)), `Missing Codex resource ${path}`);
    assert.equal(readFileSync(new URL(path, target), 'utf8'), readFileSync(new URL(path, source), 'utf8'));
  }
  const references = readdirSync(new URL('references/', source)).filter(name => /^quality-/.test(name));
  assert.ok(references.length >= 4, 'Base and three specialty references must be distributed');
  for (const name of references) assert.equal(readFileSync(new URL('references/' + name, source), 'utf8'), readFileSync(new URL('references/' + name, target), 'utf8'));
});
test('A11 the mutation script, the harness and the Mutar phase reach both distributions and the sync inventory', () => {
  const source = new URL('../../plugins/odin/skills/dev-loop/', import.meta.url);
  const target = new URL('../plugins/odin/shared/skills/dev-loop/', import.meta.url);
  const copies = [['scripts/mutantes.mjs', 'scripts/mutantes.mjs'], ['harness/loop.mjs', 'harness/loop.mjs'], ['SKILL.md', 'CONTRATO.md']];
  for (const [from, to] of copies) {
    assert.ok(existsSync(new URL(from, source)), `the odin plugin does not ship ${from} yet (Mutar phase not implemented)`);
    assert.ok(existsSync(new URL(to, target)), `the Codex distribution does not ship ${to} yet (Mutar phase not distributed)`);
    assert.equal(readFileSync(new URL(to, target), 'utf8'), readFileSync(new URL(from, source), 'utf8'), `${to} diverges from its source`);
  }
  const inventory = JSON.parse(readFileSync(new URL('../resources.json', import.meta.url), 'utf8'));
  const entries = JSON.stringify(inventory);
  for (const [from, to] of copies.slice(0, 2)) {
    assert.ok(entries.includes(`plugins/odin/skills/dev-loop/${from}`) && entries.includes(`plugins/odin/shared/skills/dev-loop/${to}`), `resources.json without ${from}`);
  }
  assert.ok(/mutar:medir/.test(readFileSync(new URL('harness/loop.mjs', target), 'utf8')), 'the Codex harness copy carries the Mutar phase');
});
test('A11 the Codex execution reference describes the Mutar phase and its report fields', () => {
  const execution = readFileSync(new URL('../plugins/odin/skills/dev-loop/references/execucao.md', import.meta.url), 'utf8');
  for (const term of ['Mutar', 'mutantes.mjs', 'mutar:medir', 'confirmar:mutante', 'reforcos', 'nao-medida', 'paraConferir', 'numeros']) assert.ok(execution.includes(term), `execucao.md without "${term}"`);
  assert.match(execution, /econ[oô]mico[^\n]*n[aã]o[^\n]*(roda|mede|chama)|(roda|mede|chama)[^\n]*balanceado[^\n]*m[aá]ximo/i, 'execucao.md does not say which profiles run the phase');
});
