import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { iniciar, responder, proximo } from '../runtime/bridge.mjs';
import { validarDefinicao } from '../runtime/schema.mjs';
import { args, contract, responses, assertQualityReport } from '../../plugins/odin/tests/support/quality-fixtures.mjs';
const packagePath = fileURLToPath(new URL('../plugins/odin', import.meta.url));
async function replay(t, mutate) {
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
    const key = Object.keys(table).find(k => k === request.label || (k.endsWith(':') && request.label.startsWith(k)));
    assert.ok(key, request.label);
    const value = table[key](request);
    if (mutate) mutate(value, request);
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
