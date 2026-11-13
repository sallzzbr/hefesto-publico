import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffold } from '../skills/criar-plugin/scripts/scaffold-marketplace.mjs';
const repoRoot = resolve(import.meta.dirname, '../../..');
function fixture(t, dual = true) {
  const root = mkdtempSync(join(tmpdir(), 'forja-dual-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, data) => { mkdirSync(resolve(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), typeof data === 'string' ? data : JSON.stringify(data)); };
  put('.claude-plugin/marketplace.json', { owner: { name: 'Fixture owner' }, metadata: { version: '1.2.3' }, plugins: [] });
  if (dual) {
    put('codex/resources.json', { arquivos: [] });
    put('codex/.agents/plugins/marketplace.json', { plugins: [] });
    put('codex/runtime/RUNTIME.md', readFileSync(join(repoRoot, 'codex/runtime/RUNTIME.md'), 'utf8'));
    put('codex/runtime/MODELOS.md', readFileSync(join(repoRoot, 'codex/runtime/MODELOS.md'), 'utf8')); put('LICENSE', 'MIT\n');
  }
  const create = (kind = 'plugin', name = 'exemplo') => scaffold({ repo: root, kind, plugin: 'exemplo', name, description: 'Write useful content. Use when criar conteúdo.' });
  return { root, put, create };
}
function snapshot(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => {
    const path = join(e.parentPath, e.name); return [path.slice(root.length), readFileSync(path, 'utf8')];
  }).sort(([a], [b]) => a.localeCompare(b));
}
test('scaffold dual cria manifestos, registros, skill nativa e cópias inventariadas', t => {
  const { root, create } = fixture(t); create(); create('skill', 'escrever');
  const inventory = JSON.parse(readFileSync(join(root, 'codex/resources.json'))).arquivos;
  assert.equal(inventory.length, 5);
  for (const e of inventory) assert.equal(readFileSync(join(root, e.source), 'utf8'), readFileSync(join(root, 'codex', e.target), 'utf8'));
  assert.match(readFileSync(join(root, 'codex/plugins/exemplo/skills/escrever/SKILL.md'), 'utf8'), /\.\.\/\.\.\/RUNTIME.md/);
  assert.equal(JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'))).metadata.version, '1.3.0');
  const native = join(root, 'codex/plugins/exemplo');
  assert.equal(JSON.parse(readFileSync(join(native, '.codex-plugin/plugin.json'))).author.name, 'Fixture owner');
  const validation = spawnSync(process.execPath, [join(repoRoot, 'codex/plugins/hefesto/skills/validar-plugin/scripts/validar.mjs'), native], { encoding: 'utf8' });
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(readFileSync(join(root, 'codex/.agents/plugins/marketplace.json'))).plugins[0].source.path, './plugins/exemplo');
});
test('marketplace externo sem inventário continua somente Claude', t => {
  const { root, create } = fixture(t, false); create(); create('skill', 'escrever');
  assert.ok(existsSync(join(root, 'plugins/exemplo/skills/escrever/SKILL.md')));
  assert.equal(existsSync(join(root, 'codex')), false);
});
test('colisão de plugin Codex preserva todo marketplace e não cria fonte Claude', t => {
  const { root, put, create } = fixture(t); put('codex/plugins/exemplo/existente', 'não tocar');
  const before = snapshot(root); assert.throws(() => create(), /colisão/); assert.deepEqual(snapshot(root), before);
});
test('colisão de skill Codex ou destino inventariado não deixa efeitos parciais', t => {
  const { root, put, create } = fixture(t); create();
  put('codex/plugins/exemplo/skills/escrever/SKILL.md', 'existente');
  const before = snapshot(root); assert.throws(() => create('skill', 'escrever'), /colisão/); assert.deepEqual(snapshot(root), before);
  put('codex/resources.json', { arquivos: [{ source: 'outra', target: 'plugins/exemplo/shared/skills/outra/CONTRATO.md' }] });
  const prior = snapshot(root); assert.throws(() => create('skill', 'outra'), /colisão/); assert.deepEqual(snapshot(root), prior);
});
test('colisão no registro Codex é descoberta antes de alterar manifesto Claude', t => {
  const { root, put, create } = fixture(t); put('codex/.agents/plugins/marketplace.json', { plugins: [{ name: 'exemplo' }] });
  const before = snapshot(root); assert.throws(() => create(), /colisão/); assert.deepEqual(snapshot(root), before);
});
test('entrypoints nativos roteiam dual e preservam scaffold standalone', t => {
  const { root } = fixture(t);
  const installed = join(root, 'installed');
  for (const kind of ['plugin', 'skill']) {
    const target = join(installed, `skills/criar-${kind}/scripts`); mkdirSync(target, { recursive: true });
    cpSync(join(repoRoot, `codex/plugins/hefesto/skills/criar-${kind}/scripts/scaffold-${kind}.mjs`), join(target, `scaffold-${kind}.mjs`));
  }
  const shared = join(installed, 'shared/skills/criar-plugin/scripts'); mkdirSync(shared, { recursive: true });
  cpSync(join(repoRoot, 'plugins/hefesto/skills/criar-plugin/scripts/scaffold-marketplace.mjs'), join(shared, 'scaffold-marketplace.mjs'));
  const run = (kind, args) => {
    const r = spawnSync(process.execPath, [join(installed, `skills/criar-${kind}/scripts/scaffold-${kind}.mjs`), ...args, '--description', 'Write content. Use when escrever.'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  run('plugin', ['--path', join(root, 'codex/plugins'), '--name', 'exemplo']);
  run('skill', ['--plugin', join(root, 'codex/plugins/exemplo'), '--name', 'escrever']);
  assert.ok(existsSync(join(root, 'plugins/exemplo/skills/escrever/SKILL.md')));
  run('plugin', ['--path', join(root, 'standalone'), '--name', 'nativo']);
  run('skill', ['--plugin', join(root, 'standalone/nativo'), '--name', 'escrever']);
  assert.ok(existsSync(join(root, 'standalone/nativo/skills/escrever/SKILL.md')));
  assert.equal(existsSync(join(root, 'standalone/nativo/.claude-plugin')), false);
});

for (const flags of [[], ['--preserve-symlinks-main']]) {
  test(`CLI via symlink executa scaffold com flags ${flags.join(' ') || 'padrão'}`, t => {
    const { root } = fixture(t);
    const link = join(root, 'helper-link.mjs');
    symlinkSync(join(repoRoot, 'plugins/hefesto/skills/criar-plugin/scripts/scaffold-marketplace.mjs'), link);
    const result = spawnSync(process.execPath, [...flags, link, '--repo', root, '--kind', 'plugin', '--plugin', 'exemplo', '--name', 'exemplo', '--description', 'Create content. Use when criar.'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Scaffold Claude \+ Codex criado/);
    assert.ok(existsSync(join(root, 'plugins/exemplo/.claude-plugin/plugin.json')));
    assert.ok(existsSync(join(root, 'codex/plugins/exemplo/.codex-plugin/plugin.json')));
  });
}
function failWrite(root, nth, rollbackFailure = false) {
  // Patch limitado ao subprocesso; mantém o I/O real e injeta erro após gravar bytes.
  const helper = join(repoRoot, 'plugins/hefesto/skills/criar-plugin/scripts/scaffold-marketplace.mjs');
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const original = fs.writeFileSync;
    let writes = 0;
    fs.writeFileSync = function(target, content, options) {
      if (typeof target === 'number' && ++writes === ${nth}) {
        original(target, 'PARTIAL');
        throw new Error('EIO: falha parcial injetada');
      }
      if (${rollbackFailure} && typeof target === 'string') throw new Error('ENOSPC: rollback injetado');
      return original(target, content, options);
    };
    syncBuiltinESMExports();
    const { scaffold } = await import(pathToFileURL(${JSON.stringify(helper)}));
    try {
      scaffold({ repo: ${JSON.stringify(root)}, kind: 'plugin', plugin: 'exemplo', name: 'exemplo', description: 'Create content. Use when criar.' });
      process.exitCode = 2;
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  `], { encoding: 'utf8' });
}
for (const [nth, target] of [[1, 'arquivo novo'], [4, 'manifesto existente']]) {
  test(`falha parcial em ${target} restaura conteúdo e diretórios`, t => {
    const { root } = fixture(t);
    const before = snapshot(root);
    const result = failWrite(root, nth);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /EIO: falha parcial injetada/);
    assert.doesNotMatch(result.stderr, /rollback incompleto/);
    assert.deepEqual(snapshot(root), before);
    assert.equal(existsSync(join(root, 'plugins')), false);
    assert.equal(existsSync(join(root, 'codex/plugins')), false);
  });
}
test('falha no rollback mantém erro primário e informa restauração incompleta', t => {
  const { root } = fixture(t);
  const result = failWrite(root, 4, true);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /EIO: falha parcial injetada; rollback incompleto:.*ENOSPC: rollback injetado/);
  assert.equal(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'), 'PARTIAL');
  assert.equal(existsSync(join(root, 'plugins')), false);
});

test('forja decide atalhos pela convenção do plugin nas duas distribuições', () => {
  for (const arquivo of ['plugins/hefesto/skills/criar-skill/SKILL.md', 'codex/plugins/hefesto/skills/criar-skill/SKILL.md', 'plugins/hefesto/skills/criar-skill/references/convencoes-skill.md']) {
    const texto=readFileSync(join(repoRoot,arquivo),'utf8');
    assert.match(texto,/convenção.*plugin/i);
    assert.match(texto,/pergunt.*somente.*padrão.*claro/i);
    assert.match(texto,/pasta vazia.*não prova/i);
    assert.match(texto,/somente Codex.*não.*commands\//i);
    assert.doesNotMatch(texto,/padrão da casa é ter/);
  }
});
