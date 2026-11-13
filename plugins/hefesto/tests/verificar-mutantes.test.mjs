// Guard real em cópia descartável; relatórios sintéticos, não mutation de produto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const GUARD = resolve(import.meta.dirname, '../../../scripts/verificar-mutantes.mjs');
const report = groups => ({ files: { 'target.js': { mutants: groups.flatMap(([status, count]) => Array.from({ length: count }, (_, id) => ({ id: String(id), status }))) } } });
function run(t, data) {
  const root = mkdtempSync(join(tmpdir(), 'hefesto-mutant-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'reports/mutation'), { recursive: true });
  copyFileSync(GUARD, join(root, 'scripts/verificar-mutantes.mjs'));
  if (data !== undefined) writeFileSync(join(root, 'reports/mutation/mutation.json'), typeof data === 'string' ? data : JSON.stringify(data));
  return spawnSync(process.execPath, [join(root, 'scripts/verificar-mutantes.mjs')], { encoding: 'utf8', timeout: 10000 });
}
// Cada caso retira ou inclui estados no denominador. Contar erro operacional faria
// passar os casos insuficientes; rejeitar sobreviventes confundiria volume e score.
for (const [name, groups, expected] of [
  ['900 Killed medem volume suficiente', [['Killed', 900]], 0],
  ['Timeout conta como mutante válido', [['Timeout', 900]], 0],
  ['Survived e NoCoverage são válidos mesmo com score zero', [['Survived', 450], ['NoCoverage', 450]], 0],
  ['RuntimeError isolado não prova volume', [['RuntimeError', 900]], 1],
  ['erro operacional não completa 899 válidos até o piso', [['Killed', 899], ['RuntimeError', 221]], 1],
  ['ignorados e falhas de compilação não provam volume', [['Ignored', 450], ['CompileError', 450]], 1],
  ['Ignored não completa 899 válidos até o piso', [['Killed', 899], ['Ignored', 1]], 1],
  ['CompileError não completa 899 válidos até o piso', [['Killed', 899], ['CompileError', 1]], 1],
  ['erros excluídos não invalidam 900 resultados válidos', [['Killed', 900], ['RuntimeError', 30], ['CompileError', 20], ['Ignored', 10]], 0],
  ['status desconhecido não conta como válido', [['Unexpected', 900]], 1],
  ['status desconhecido reprova também junto de volume suficiente', [['Killed', 900], ['Unexpected', 1]], 1],
  ['status ausente não conta como válido', [[undefined, 900]], 1],
  ['mutantes pendentes não são medição concluída', [['Pending', 900]], 1],
  ['pendente junto de volume válido ainda indica relatório incompleto', [['Killed', 900], ['Pending', 1]], 1],
  ['zero mutantes reprova', [], 1],
  ['899 válidos ainda são insuficientes', [['Killed', 899]], 1],
]) {
  test(name, t => {
    const r = run(t, report(groups));
    assert.equal(r.status, expected, r.stdout + r.stderr);
    if (expected !== 0) assert.equal(r.stdout, '', 'não anunciar medição válida ao reprovar');
  });
}
test('relatório ausente, JSON inválido ou estrutura malformada não equivale a sucesso', t => {
  for (const data of [undefined, '{', null, { files: [] }, { files: { 'a.js': { mutants: {} } } }]) {
    const r = run(t, data); assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.equal(r.stdout, '');
  }
});
test('files como array não vira mapa válido mesmo quando contém 900 resultados', t => {
  const r = run(t, { files: [report([['Killed', 900]]).files['target.js']] });
  assert.equal(r.status, 1, r.stdout + r.stderr);
});
test('arquivo sem lista mutants não pode sumir da medição quando outro já fornece o piso', t => {
  const data = report([['Killed', 900]]); data.files['missing.js'] = {};
  const r = run(t, data); assert.equal(r.status, 1, r.stdout + r.stderr);
});
