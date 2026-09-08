import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_SCRIPT = resolve(HERE, '../skills/criar-plugin/scripts/scaffold-plugin.mjs');
const SKILL_SCRIPT = resolve(HERE, '../skills/criar-skill/scripts/scaffold-skill.mjs');
const VALIDATOR = resolve(HERE, '../skills/validar-plugin/scripts/validar.mjs');

const run = (script, args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const workspace = () => mkdtemp(join(tmpdir(), 'hefesto-forja-'));

test('scaffolds a native Codex plugin and skill that pass validation', async () => {
  const root = await workspace();
  const plugin = run(PLUGIN_SCRIPT, [
    '--path', root, '--name', 'meu-plugin', '--description', 'Plugin de exemplo para testes.',
  ]);
  assert.equal(plugin.status, 0, plugin.stderr);

  const pluginRoot = join(root, 'meu-plugin');
  const skill = run(SKILL_SCRIPT, [
    '--plugin', pluginRoot, '--name', 'minha-skill',
    '--description', 'Use when the user asks to exercise the example capability.',
  ]);
  assert.equal(skill.status, 0, skill.stderr);

  const manifest = JSON.parse(await readFile(join(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'));
  assert.deepEqual(manifest, {
    name: 'meu-plugin',
    version: '0.1.0',
    description: 'Plugin de exemplo para testes.',
    author: { name: 'Local developer' },
    skills: './skills/',
    interface: {
      displayName: 'Meu Plugin',
      shortDescription: 'Plugin de exemplo para testes.',
      longDescription: 'Plugin de exemplo para testes.',
      developerName: 'Local developer',
      category: 'Productivity',
      capabilities: [],
      defaultPrompt: 'Ajude-me a usar Meu Plugin.',
    },
  });
  const skillText = await readFile(join(pluginRoot, 'skills/minha-skill/SKILL.md'), 'utf8');
  assert.match(skillText, /^---\nname: minha-skill\ndescription: "Use when/);

  const validation = run(VALIDATOR, [pluginRoot]);
  assert.equal(validation.status, 0, validation.stderr);
  assert.match(validation.stdout, /Plugin Codex v[aá]lido/);
});

test('generated skill does not depend on a Hefesto-specific RUNTIME file', async () => {
  const root = await workspace();
  assert.equal(run(PLUGIN_SCRIPT, [
    '--path', root, '--name', 'generico', '--description', 'Plugin genérico.',
  ]).status, 0);
  const pluginRoot = join(root, 'generico');
  assert.equal(run(SKILL_SCRIPT, [
    '--plugin', pluginRoot, '--name', 'capacidade',
    '--description', 'Use when the generic capability is requested.',
  ]).status, 0);

  const skillText = await readFile(join(pluginRoot, 'skills/capacidade/SKILL.md'), 'utf8');
  assert.doesNotMatch(skillText, /RUNTIME\.md/);
  assert.equal(run(VALIDATOR, [pluginRoot]).status, 0);
});

test('validator rejects malformed, multiline and duplicate frontmatter fields', async () => {
  for (const [label, frontmatter] of [
    ['malformed', ['name: capacidade', 'description: [invalid yaml']],
    ['multiline', ['name: capacidade', 'description: |', '  conteúdo']],
    ['duplicate', ['name: capacidade', 'name: outra', 'description: "Use when requested."']],
  ]) {
    const root = await workspace();
    assert.equal(run(PLUGIN_SCRIPT, [
      '--path', root, '--name', label, '--description', 'Plugin para frontmatter.',
    ]).status, 0);
    const skillRoot = join(root, label, 'skills/capacidade');
    await mkdir(skillRoot);
    await writeFile(join(skillRoot, 'SKILL.md'), ['---', ...frontmatter, '---', '', '# X', ''].join('\n'));
    const validation = run(VALIDATOR, [join(root, label)]);
    assert.equal(validation.status, 1, label);
    assert.match(validation.stderr, /frontmatter/i, label);
  }
});

test('validator confines explicit resources to the plugin and requires real non-symlink files', async () => {
  for (const [label, resource, setup] of [
    ['escape', '../../shared/../../../../outside.txt', async (pluginRoot, root) => {
      await writeFile(join(root, 'outside.txt'), 'outside\n');
      await mkdir(join(pluginRoot, 'shared'), { recursive: true });
    }],
    ['missing', '../../shared/references/missing.md', async (pluginRoot) => {
      await mkdir(join(pluginRoot, 'shared/references'), { recursive: true });
    }],
    ['symlink', '../../shared/references/link.md', async (pluginRoot, root) => {
      await writeFile(join(root, 'outside.txt'), 'outside\n');
      await mkdir(join(pluginRoot, 'shared/references'), { recursive: true });
      await symlink(join(root, 'outside.txt'), join(pluginRoot, 'shared/references/link.md'));
    }],
  ]) {
    const root = await workspace();
    assert.equal(run(PLUGIN_SCRIPT, [
      '--path', root, '--name', label, '--description', 'Plugin para paths.',
    ]).status, 0);
    const pluginRoot = join(root, label);
    await setup(pluginRoot, root);
    const skillRoot = join(pluginRoot, 'skills/capacidade');
    await mkdir(skillRoot);
    await writeFile(join(skillRoot, 'SKILL.md'), [
      '---', 'name: capacidade', 'description: "Use when a resource is required."', '---', '',
      '# X', '', `Leia \`${resource}\`.`, '',
    ].join('\n'));
    const validation = run(VALIDATOR, [pluginRoot]);
    assert.equal(validation.status, 1, label);
    assert.match(validation.stderr, /recurso|path/i, label);
  }
});

test('requires name for plugin and skill scaffolds', async () => {
  const root = await workspace();
  const plugin = run(PLUGIN_SCRIPT, ['--path', root, '--description', 'Sem nome']);
  assert.equal(plugin.status, 1);
  assert.match(plugin.stderr, /--name/);

  const skill = run(SKILL_SCRIPT, ['--plugin', root, '--description', 'Sem nome']);
  assert.equal(skill.status, 1);
  assert.match(skill.stderr, /--name/);
});

test('rejects traversal and absolute names before writing', async () => {
  const root = await workspace();
  for (const name of ['../fora', 'grupo/skill', '/tmp/fora']) {
    const result = run(PLUGIN_SCRIPT, ['--path', root, '--name', name, '--description', 'Inválido']);
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, /nome inv[aá]lido/i, name);
  }
  await assert.rejects(readFile(join(dirname(root), 'fora/.codex-plugin/plugin.json')));

  const pluginRoot = join(root, 'plugin-valido');
  await mkdir(join(pluginRoot, '.codex-plugin'), { recursive: true });
  await writeFile(join(pluginRoot, '.codex-plugin/plugin.json'), '{}\n');
  const skill = run(SKILL_SCRIPT, [
    '--plugin', pluginRoot, '--name', '../fora',
    '--description', 'Use when traversal must be rejected.',
  ]);
  assert.equal(skill.status, 1);
  assert.match(skill.stderr, /nome inv[aá]lido/i);
});

test('does not overwrite existing plugin or skill files', async () => {
  const root = await workspace();
  const pluginRoot = join(root, 'existente');
  const manifestPath = join(pluginRoot, '.codex-plugin/plugin.json');
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, 'preservar\n');

  const plugin = run(PLUGIN_SCRIPT, [
    '--path', root, '--name', 'existente', '--description', 'Não sobrescrever',
  ]);
  assert.equal(plugin.status, 1);
  assert.match(plugin.stderr, /j[aá] existe/i);
  assert.equal(await readFile(manifestPath, 'utf8'), 'preservar\n');

  const skillPath = join(pluginRoot, 'skills/existente/SKILL.md');
  await mkdir(dirname(skillPath), { recursive: true });
  await writeFile(skillPath, 'preservar skill\n');
  const skill = run(SKILL_SCRIPT, [
    '--plugin', pluginRoot, '--name', 'existente',
    '--description', 'Use when the existing file must remain untouched.',
  ]);
  assert.equal(skill.status, 1);
  assert.match(skill.stderr, /j[aá] existe/i);
  assert.equal(await readFile(skillPath, 'utf8'), 'preservar skill\n');
});

test('validator rejects missing names, mismatches, traversal and invalid metadata', async () => {
  const root = await workspace();
  const pluginRoot = join(root, 'quebrado');
  await mkdir(join(pluginRoot, '.codex-plugin'), { recursive: true });
  await mkdir(join(pluginRoot, 'skills/skill-certa'), { recursive: true });
  await writeFile(join(pluginRoot, '.codex-plugin/plugin.json'), JSON.stringify({
    version: 'v1', description: '', skills: '../skills',
  }));
  await writeFile(join(pluginRoot, 'skills/skill-certa/SKILL.md'), [
    '---', 'name: outra-skill', 'description: "Use when testing a mismatch."', '---', '', '# X', '',
  ].join('\n'));

  const validation = run(VALIDATOR, [pluginRoot]);
  assert.equal(validation.status, 1);
  assert.match(validation.stderr, /plugin\.json.*name/i);
  assert.match(validation.stderr, /version.*semver/i);
  assert.match(validation.stderr, /description/i);
  assert.match(validation.stderr, /skills.*\.\.\/skills/i);
  assert.match(validation.stderr, /interface/i);
  assert.match(validation.stderr, /outra-skill.*skill-certa/i);
});
