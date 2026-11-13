#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exit(1);
}

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail(`argumento inválido: ${key ?? ''}`);
    result[key.slice(2)] = value;
  }
  return result;
}

const options = args(process.argv.slice(2));
if (!options.name) fail('--name é obrigatório');
if (!options.path) fail('--path é obrigatório');
if (!options.description?.trim()) fail('--description é obrigatório');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.name) || options.name.length > 64) {
  fail('nome inválido: use kebab-case com até 64 caracteres');
}

const parent = resolve(options.path);

const dualRepo = resolve(parent, '../..');
if (basename(parent) === 'plugins' && basename(resolve(parent, '..')) === 'codex' && existsSync(join(dualRepo, 'codex/resources.json'))) {
  try {
    if (options.version && options.version !== '0.1.0') throw Error('scaffold dual inicia em 0.1.0');
    const { scaffold } = await import('../../../shared/skills/criar-plugin/scripts/scaffold-marketplace.mjs');
    scaffold({ repo: dualRepo, kind: 'plugin', plugin: options.name, name: options.name, description: options.description });
    console.log('Plugin Claude + Codex criado; adicione a primeira skill e conclua sync e validação.');
    process.exit(0);
  } catch (error) { fail(error.message); }
}

const pluginRoot = join(parent, options.name);
const displayName = options.name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
try {
  mkdirSync(parent, { recursive: true });
  mkdirSync(pluginRoot);
  mkdirSync(join(pluginRoot, '.codex-plugin'));
  mkdirSync(join(pluginRoot, 'skills'));
  const manifest = {
    name: options.name,
    version: options.version ?? '0.1.0',
    description: options.description.trim(),
    author: { name: 'Local developer' },
    skills: './skills/',
    interface: {
      displayName,
      shortDescription: options.description.trim(),
      longDescription: options.description.trim(),
      developerName: 'Local developer',
      category: 'Productivity',
      capabilities: [],
      defaultPrompt: `Ajude-me a usar ${displayName}.`,
    },
  };
  writeFileSync(
    join(pluginRoot, '.codex-plugin', 'plugin.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  );
} catch (error) {
  fail(error?.code === 'EEXIST' ? `plugin já existe: ${pluginRoot}` : error.message);
}

console.log(`Plugin Codex criado: ${pluginRoot}`);
