#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { parseFrontmatter } from '../plugins/hefesto/skills/validar-plugin/scripts/frontmatter.mjs';

import { sincronizar } from './sync-resources.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CODEX_ROOT = resolve(HERE, '..');
const DEFAULT_REPO_ROOT = resolve(DEFAULT_CODEX_ROOT, '..');
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
// Comandos Claude expostos como skills nativas, com contrato próprio sincronizado.
const NATIVE_COMMANDS = { odin: ['defaults', 'desafio'] };
// Contagem fixa do conjunto: plugins (fonte, pacote e marketplace) e skills nativas. O publicador reescreve
// estas duas linhas no stage quando a árvore de desenvolvimento carrega plugins que o espelho não leva.
const PLUGINS_ESPERADOS = 8;
const SKILLS_ESPERADAS = 66;

function json(path, errors) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (cause) { errors.push(`${path}: JSON inválido: ${cause.message}`); return null; }
}

function directories(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function frontmatterName(path, errors) {
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch (cause) { errors.push(`${path}: não foi possível ler: ${cause.message}`); return null; }
  const { values: fields, problem } = parseFrontmatter(text);
  if (!fields) { errors.push(`${path}: frontmatter inválido: ${problem}`); return null; }
  if (!fields.name) errors.push(`${path}: frontmatter.name obrigatório`);
  if (!fields.description) errors.push(`${path}: frontmatter.description obrigatório`);
  else if (fields.description.length > 1024) errors.push(`${path}: description excede 1024 caracteres`);
  return { name: fields.name, text };
}

function walk(path, visit) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const current = join(path, entry.name);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) { visit(current, 'symlink'); continue; }
    if (stat.isDirectory()) { visit(current, 'directory'); walk(current, visit); }
    else visit(current, 'file');
  }
}

function inside(base, target) {
  const rel = relative(base, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function nativeMarkdownFiles(pluginRoot) {
  const result = [];
  const skillsRoot = join(pluginRoot, 'skills');
  if (!existsSync(skillsRoot)) return result;
  walk(skillsRoot, (path, kind) => {
    if (kind !== 'file' || !path.endsWith('.md')) return;
    const rel = relative(skillsRoot, path).split(/[\\/]/);
    if (rel.length === 2 && rel[1] === 'SKILL.md') result.push(path);
    else if (rel.length >= 3 && rel[1] === 'references') result.push(path);
  });
  return result;
}

function validateLinks(pluginRoot, path, errors) {
  const text = readFileSync(path, 'utf8');
  const links = text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);
  for (const match of links) {
    let target = match[1].trim().replace(/^<|>$/g, '');
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    target = target.split('#', 1)[0].split('?', 1)[0];
    try { target = decodeURIComponent(target); }
    catch { errors.push(`${path}: link com escape inválido: ${match[1]}`); continue; }
    if (isAbsolute(target) || target.includes('\\')) {
      errors.push(`${path}: link local deve ser relativo: ${match[1]}`);
      continue;
    }
    const resolved = resolve(dirname(path), target);
    if (!inside(pluginRoot, resolved)) {
      errors.push(`${path}: link escapa do pacote: ${match[1]}`);
      continue;
    }
    if (!existsSync(resolved)) errors.push(`${path}: link relativo ausente: ${match[1]}`);
  }
}

// Referência a recurso da raiz do plugin Claude (`${CLAUDE_PLUGIN_ROOT}/caminho`): no pacote Codex a raiz é
// shared/, então o arquivo citado precisa existir lá. Caminho com placeholder, glob ou variável fica fora.
function validatePluginRootRefs(sharedRoot, errors) {
  walk(sharedRoot, (path, kind) => {
    if (kind !== 'file' || !path.endsWith('.md')) return;
    const text = readFileSync(path, 'utf8');
    for (const match of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_][A-Za-z0-9_./-]*)/g)) {
      const rel = match[1].replace(/[.,;:)]+$/, '');
      if (!/\.[A-Za-z0-9]+$/.test(rel)) continue;
      const resolved = resolve(sharedRoot, rel);
      if (!inside(sharedRoot, resolved) || !existsSync(resolved)) errors.push(`${path}: \${CLAUDE_PLUGIN_ROOT}/${rel} não existe em shared/`);
    }
  });
}

function validateManifest(pluginRoot, expectedName, errors) {
  const path = join(pluginRoot, '.codex-plugin', 'plugin.json');
  if (!existsSync(path)) { errors.push(`${path}: manifesto ausente`); return; }
  const manifest = json(path, errors);
  if (!manifest) return;
  if (manifest.name !== expectedName || !NAME.test(manifest.name ?? '')) errors.push(`${path}: name nativo inválido`);
  if (!SEMVER.test(manifest.version ?? '')) errors.push(`${path}: version semver obrigatória`);
  if (typeof manifest.description !== 'string' || !manifest.description.trim()) errors.push(`${path}: description obrigatória`);
  if (manifest.skills !== './skills/') errors.push(`${path}: skills deve ser ./skills/`);
  if (!manifest.author || typeof manifest.author.name !== 'string' || !manifest.author.name.trim()) errors.push(`${path}: author.name obrigatório`);
  const ui = manifest.interface;
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) { errors.push(`${path}: interface obrigatória`); return; }
  for (const field of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'defaultPrompt']) {
    const value = ui[field];
    const valid = field === 'defaultPrompt'
      ? (typeof value === 'string' && value.trim()) || (Array.isArray(value) && value.length && value.every((item) => typeof item === 'string' && item.trim()))
      : typeof value === 'string' && value.trim();
    if (!valid) errors.push(`${path}: interface.${field} obrigatório`);
  }
  if (!Array.isArray(ui.capabilities) || !ui.capabilities.every((item) => typeof item === 'string' && item.trim())) {
    errors.push(`${path}: interface.capabilities deve ser array de strings`);
  }
}

export async function checkDistribution({
  repoRoot = DEFAULT_REPO_ROOT,
  codexRoot = DEFAULT_CODEX_ROOT,
  synchronize = () => sincronizar({ escrever: false }),
} = {}) {
  repoRoot = resolve(repoRoot);
  codexRoot = resolve(codexRoot);
  const errors = [];
  const sourcePluginsRoot = join(repoRoot, 'plugins');
  const nativePluginsRoot = join(codexRoot, 'plugins');
  const sourceNames = directories(sourcePluginsRoot).filter((name) => existsSync(join(sourcePluginsRoot, name, '.claude-plugin', 'plugin.json')));
  const nativeNames = directories(nativePluginsRoot).filter((name) => existsSync(join(nativePluginsRoot, name, '.codex-plugin', 'plugin.json')));

  if (sourceNames.length !== PLUGINS_ESPERADOS) errors.push(`plugins fonte: esperado ${PLUGINS_ESPERADOS}, encontrado ${sourceNames.length}`);
  if (nativeNames.length !== PLUGINS_ESPERADOS) errors.push(`manifestos Codex: esperado ${PLUGINS_ESPERADOS}, encontrado ${nativeNames.length}`);
  if (sourceNames.join('\n') !== nativeNames.join('\n')) errors.push('nomes dos plugins Codex diferem das fontes em plugins/');

  let skillCount = 0;
  const validatorPath = join(nativePluginsRoot, 'hefesto', 'skills', 'validar-plugin', 'scripts', 'validar.mjs');
  if (!existsSync(validatorPath)) errors.push(`${validatorPath}: validador Codex da Forja ausente`);
  for (const name of sourceNames) {
    const sourceSkills = directories(join(sourcePluginsRoot, name, 'skills')).filter((skill) => existsSync(join(sourcePluginsRoot, name, 'skills', skill, 'SKILL.md')));
    const pluginRoot = join(nativePluginsRoot, name);
    const nativeSkills = directories(join(pluginRoot, 'skills')).filter((skill) => existsSync(join(pluginRoot, 'skills', skill, 'SKILL.md')));
    skillCount += nativeSkills.length;
    const expectedSkills = [...sourceSkills, ...(NATIVE_COMMANDS[name] ?? [])].sort();
    if (expectedSkills.join('\n') !== nativeSkills.join('\n')) errors.push(`${name}: skills diferem da fonte; esperado [${expectedSkills.join(', ')}], encontrado [${nativeSkills.join(', ')}]`);
    validateManifest(pluginRoot, name, errors);
    if (existsSync(validatorPath) && existsSync(pluginRoot)) {
      const validation = spawnSync(process.execPath, [validatorPath, pluginRoot], {
        cwd: codexRoot,
        encoding: 'utf8',
      });
      if (validation.error || validation.status !== 0) {
        const detail = [validation.stderr, validation.stdout, validation.error?.message]
          .filter(Boolean).join('\n').trim();
        errors.push(`validador Codex da Forja rejeitou ${name}${detail ? `:\n${detail}` : ''}`);
      }
    }
    for (const skill of nativeSkills) {
      const path = join(pluginRoot, 'skills', skill, 'SKILL.md');
      const parsed = frontmatterName(path, errors);
      if (parsed?.name !== skill) errors.push(`${path}: name deve ser ${skill}`);
      if (parsed && !parsed.text.includes('../../RUNTIME.md')) errors.push(`${path}: deve referenciar ../../RUNTIME.md`);
      const contract = (NATIVE_COMMANDS[name] ?? []).includes(skill)
        ? `../../shared/commands/${skill}.md` : `../../shared/skills/${skill}/CONTRATO.md`;
      if (parsed && !parsed.text.includes(contract)) errors.push(`${path}: deve referenciar o contrato de domínio em shared/`);
    }
    for (const path of nativeMarkdownFiles(pluginRoot)) validateLinks(pluginRoot, path, errors);
    // RUNTIME.md é lido por toda skill nativa: link quebrado nele (ex.: MODELOS.md não empacotado)
    // passava porque só skills/ era conferido.
    const runtimeDoc = join(pluginRoot, 'RUNTIME.md');
    if (existsSync(runtimeDoc)) validateLinks(pluginRoot, runtimeDoc, errors);
    const sharedRoot = join(pluginRoot, 'shared');
    if (existsSync(sharedRoot)) validatePluginRootRefs(sharedRoot, errors);
    if (existsSync(sharedRoot)) walk(sharedRoot, (path, kind) => {
      if (kind === 'file' && basename(path) === 'SKILL.md') errors.push(`${path}: shared não pode conter SKILL.md descobrível`);
    });
  }
  if (skillCount !== SKILLS_ESPERADAS) errors.push(`skills Codex: esperado ${SKILLS_ESPERADAS}, encontrado ${skillCount}`);

  const marketplacePath = join(codexRoot, '.agents', 'plugins', 'marketplace.json');
  const marketplace = existsSync(marketplacePath) ? json(marketplacePath, errors) : null;
  if (!marketplace) errors.push(`${marketplacePath}: marketplace ausente ou inválido`);
  else {
    if (marketplace.name !== 'hefesto') errors.push(`${marketplacePath}: marketplace.name deve ser hefesto`);
    const entries = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
    if (entries.length !== PLUGINS_ESPERADOS) errors.push(`${marketplacePath}: esperado ${PLUGINS_ESPERADOS} plugins`);
    const seen = new Set();
    for (const entry of entries) {
      if (!sourceNames.includes(entry.name) || seen.has(entry.name)) errors.push(`${marketplacePath}: plugin inválido ou duplicado: ${String(entry.name)}`);
      seen.add(entry.name);
      if (entry.source?.source !== 'local' || typeof entry.source?.path !== 'string') {
        errors.push(`${marketplacePath}: ${String(entry.name)} deve ter source local com path`);
        continue;
      }
      if (isAbsolute(entry.source.path)) {
        errors.push(`${marketplacePath}: path deve ser relativo para ${String(entry.name)}: ${entry.source.path}`);
        continue;
      }
      const target = resolve(codexRoot, entry.source.path);
      if (!inside(codexRoot, target) || !existsSync(join(target, '.codex-plugin', 'plugin.json'))) errors.push(`${marketplacePath}: path inválido para ${String(entry.name)}: ${entry.source.path}`);
      else if (basename(target) !== entry.name) errors.push(`${marketplacePath}: path de ${entry.name} aponta para ${basename(target)}`);
    }
    for (const name of sourceNames) if (!seen.has(name)) errors.push(`${marketplacePath}: plugin ausente: ${name}`);
  }

  if (existsSync(nativePluginsRoot)) walk(nativePluginsRoot, (path, kind) => {
    if (kind === 'symlink') errors.push(`${path}: symlink não permitido na distribuição`);
  });

  if (!errors.length) {
    try { await synchronize(); }
    catch (cause) { errors.push(`sincronização: ${cause.message}`); }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { plugins: nativeNames.length, skills: skillCount };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkDistribution();
    console.log(`Distribuição Codex válida: ${result.plugins} plugins, ${result.skills} skills.`);
  } catch (cause) {
    console.error(cause.message);
    process.exitCode = 1;
  }
}
