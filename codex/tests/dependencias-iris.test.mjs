import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

for (const [plugin, skills] of Object.entries({ hefesto: ['criar-skill', 'criar-plugin'], odin: ['entregar', 'dev-loop'] })) {
  test(`${plugin}: autoria declara dependência Iris verificada na sessão, sem instalação implícita`, () => {
    const contract = read(`plugins/${plugin}/DEPENDENCIAS.md`);
    assert.match(contract, /skills efetivamente disponibilizadas pela sessão/);
    assert.match(contract, /não prova que a skill está habilitada/);
    assert.match(contract, /pare antes de gerar o conteúdo dependente/);
    assert.match(contract, /Não instale, habilite, modifique configuração/);
    for (const skill of skills) {
      const text = read(`plugins/${plugin}/skills/${skill}/SKILL.md`);
      assert.match(text, /\.\.\/\.\.\/DEPENDENCIAS\.md/);
      assert.doesNotMatch(text, /sem ela, monte o brief|iris quando ela estiver disponível/);
    }
  });
}

test('Iris exigida pela autoria integra o inventário de recursos, com seus contratos disponíveis', () => {
  const inventory = JSON.parse(read('resources.json')).arquivos;
  for (const plugin of ['hefesto', 'odin']) {
    assert.ok(inventory.some(x => x.source === 'codex/runtime/DEPENDENCIAS-IRIS.md' && x.target === `plugins/${plugin}/DEPENDENCIAS.md`));
  }
  for (const skill of ['escrever-prompt', 'delegar-agente']) {
    assert.match(read(`plugins/iris/skills/${skill}/SKILL.md`), /RUNTIME\.md/);
    assert.ok(read(`plugins/iris/shared/skills/${skill}/CONTRATO.md`).length > 100);
  }
});

test('runtime comum resolve defaults na mesma raiz de consulta e escrita de Odin', () => {
  const runtime = read('runtime/RUNTIME.md');
  assert.match(runtime, /CODEX_HOME.*definido e não vazio/);
  assert.match(runtime, /tanto para leitura quanto para escrita/);
  assert.match(runtime, /arquivo ausente não autoriza fallback/);
  assert.match(read('plugins/titbits/RUNTIME.md'), /CODEX_HOME.*definido e não vazio/);
  assert.match(read('plugins/titbits/RUNTIME.md'), /arquivo ausente não autoriza fallback/);
  const defaults = read('plugins/odin/skills/defaults/SKILL.md');
  assert.match(defaults, /CODEX_HOME/);
  assert.match(defaults, /não procure outra raiz/);
});
