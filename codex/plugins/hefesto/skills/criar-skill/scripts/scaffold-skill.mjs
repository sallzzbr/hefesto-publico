#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
if (!options.plugin) fail('--plugin é obrigatório');
if (!options.description?.trim()) fail('--description é obrigatório');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.name) || options.name.length > 64) {
  fail('nome inválido: use kebab-case com até 64 caracteres');
}

const pluginRoot = resolve(options.plugin);
if (!existsSync(join(pluginRoot, '.codex-plugin', 'plugin.json'))) {
  fail(`plugin Codex inválido: falta .codex-plugin/plugin.json em ${pluginRoot}`);
}

const skillRoot = join(pluginRoot, 'skills', options.name);
const quotedDescription = JSON.stringify(options.description.trim());
const body = [
  '---',
  `name: ${options.name}`,
  `description: ${quotedDescription}`,
  '---',
  '',
  `# ${options.name}`,
  '',
  'Leia os recursos locais que esta skill declarar antes de executar o fluxo.',
  '',
  '## Fluxo',
  '',
  '1. Confirme entradas, saídas e limites do pedido.',
  '2. Execute a capacidade solicitada com os recursos disponíveis.',
  '3. Valide o resultado antes de concluir.',
  '',
  '## Limites',
  '',
  '- Não invente conectores, credenciais ou ferramentas ausentes.',
  '',
].join('\n');

try {
  mkdirSync(join(pluginRoot, 'skills'), { recursive: true });
  mkdirSync(skillRoot);
  writeFileSync(join(skillRoot, 'SKILL.md'), body, { flag: 'wx' });
} catch (error) {
  fail(error?.code === 'EEXIST' ? `skill já existe: ${skillRoot}` : error.message);
}

console.log(`Skill Codex criada: ${skillRoot}`);
