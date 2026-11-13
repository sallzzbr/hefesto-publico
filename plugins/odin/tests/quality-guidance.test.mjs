import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { baseIds, specialtyIds, contract, runHarness } from './support/quality-fixtures.mjs';
const read = path => { const url = new URL('../' + path, import.meta.url); assert.ok(existsSync(url), `Missing quality guidance: ${path}`); return readFileSync(url, 'utf8'); };
test('A4 concrete single-source guidance reaches planning Solo workers and reviewers', async () => {
  const source = read('skills/dev-loop/references/quality-contract.md');
  for (const id of baseIds) assert.ok(source.includes(id), id);
  for (const term of [/JSDoc/i, /400/, /decompos/i, /conven|projeto/i]) assert.match(source, term);
  for (const path of ['skills/dev-loop/SKILL.md', 'skills/entregar/SKILL.md', 'agents/operario.md', 'agents/revisor.md']) {
    assert.match(read(path), /quality-contract\.md/, `${path} must resolve the same quality source`);
  }
  const ponytail = read('skills/dev-loop/references/escada-ponytail.md');
  for (const forbidden of [/Cabe em uma linha\? Escreva uma linha/, /Não crie abstração para uso único/, /Menos arquivos possível/, /Diff pequeno é qualidade/, /no próprio código/, /deixa \*\*UM\*\* check/, /Simplificação deliberada vira comentário/]) assert.doesNotMatch(ponytail, forbidden);
  assert.match(ponytail, /coes|responsabil|decompos/i);
  assert.match(ponytail, /ADR|plano|SPEC/);
  const quality = contract(['base', ...Object.keys(specialtyIds)]);
  const { calls } = await runHarness({ quality, options: { perfil: 'maximo' } });
  for (const call of calls.filter(c => /^(impl:|rev:|ponytail:)/.test(c.label))) {
    for (const id of quality.checks.map(c => c.id)) assert.ok(call.prompt.includes(id), `${call.label} missing ${id}`);
    assert.match(call.prompt, /decomposition|decompos/i);
  }
});
