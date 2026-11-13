#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from './frontmatter.mjs';

const errors = [];
const error = (path, message) => errors.push(`ERRO  ${path}: ${message}`);
const SEMVER = /^\d+\.\d+\.\d+$/;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (cause) { error(path, `JSON inválido: ${cause.message}`); return null; }
}

function hasSymlinkBetween(target, root) {
  let current = target;
  while (current.startsWith(`${root}${sep}`)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) return true;
    current = dirname(current);
  }
  return false;
}

function validatePortablePaths(path, text, baseDir = null, packageRoot = null) {
  if (/(^|[^A-Za-z0-9+.-])[A-Za-z]:[\\/]|(^|[\s"'(=`:])\/(?:Users|home|root)\//m.test(text)) error(path, 'path absoluto de SO não é portátil');
  const resources = new Set((text.match(/(?:\.\.\/)+[A-Za-z0-9_.\/-]+/g) ?? [])
    .map(token => token.replace(/[.,;:]+$/, '')));
  // Markdown links are resources even without a ../ prefix. URLs and page anchors
  // do not resolve on disk; local targets (including reference-style links) do.
  const links = [
    ...text.matchAll(/\[[^\]\n]*\]\(\s*/g),
    ...text.matchAll(/^\s*\[[^\]\n]+\]:\s*/gm),
  ];
  for (const match of links) {
    const tail = text.slice(match.index + match[0].length);
    let raw = '', depth = 0;
    if (tail.startsWith('<')) {
      const end = tail.indexOf('>');
      if (end < 0) continue;
      raw = tail.slice(1, end);
    } else {
      for (let i = 0; i < tail.length; i++) {
        const char = tail[i];
        if (char === '\\' && i + 1 < tail.length) { raw += tail[++i]; continue; }
        if (/\s/.test(char)) break;
        if (char === '(') depth++;
        if (char === ')') { if (depth === 0) break; depth--; }
        raw += char;
      }
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(raw)) continue;
    try {
      const target = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
      if (target) resources.add(target);
    } catch { error(path, `recurso com escape inválido: ${raw}`); }
  }
  for (const token of resources) {
    if (!baseDir || !packageRoot) { error(path, `path com travessia não permitido: ${token}`); continue; }
    const target = resolve(baseDir, token);
    const confined = target === packageRoot || target.startsWith(`${packageRoot}${sep}`);
    if (!confined) { error(path, `path escapa do plugin: ${token}`); continue; }
    if (!existsSync(target)) { error(path, `recurso não existe: ${token}`); continue; }
    if (hasSymlinkBetween(target, packageRoot)) error(path, `recurso usa symlink: ${token}`);
  }
}

const pluginRoot = resolve(process.argv[2] ?? process.cwd());
const manifestPath = join(pluginRoot, '.codex-plugin', 'plugin.json');
if (!existsSync(manifestPath)) error(manifestPath, 'arquivo não existe');
const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;

if (manifest) {
  if (!manifest.name) error('plugin.json', 'campo name é obrigatório');
  else {
    if (!NAME.test(manifest.name) || manifest.name.length > 64) error('plugin.json', 'campo name inválido');
    if (manifest.name !== basename(pluginRoot)) error('plugin.json', `name ${manifest.name} difere do diretório ${basename(pluginRoot)}`);
  }
  if (!SEMVER.test(manifest.version ?? '')) error('plugin.json', 'version deve ser semver estrito');
  if (typeof manifest.description !== 'string' || !manifest.description.trim()) error('plugin.json', 'description é obrigatória');
  if (manifest.skills !== './skills/') error('plugin.json', `skills deve ser ./skills/, recebido ${String(manifest.skills)}`);
  if (!manifest.author || typeof manifest.author !== 'object' || typeof manifest.author.name !== 'string' || !manifest.author.name.trim()) {
    error('plugin.json', 'author.name é obrigatório');
  }
  const ui = manifest.interface;
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) error('plugin.json', 'interface é obrigatória');
  else {
    for (const field of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']) {
      if (typeof ui[field] !== 'string' || !ui[field].trim()) error('plugin.json', `interface.${field} é obrigatório`);
    }
    if (!Array.isArray(ui.capabilities) || !ui.capabilities.every((item) => typeof item === 'string' && item.trim())) {
      error('plugin.json', 'interface.capabilities deve ser um array de strings');
    }
    const prompt = ui.defaultPrompt;
    const validPrompt = (typeof prompt === 'string' && prompt.trim())
      || (Array.isArray(prompt) && prompt.length > 0 && prompt.every((item) => typeof item === 'string' && item.trim()));
    if (!validPrompt) error('plugin.json', 'interface.defaultPrompt é obrigatório');
  }
  for (const [key, value] of Object.entries(manifest)) {
    if (typeof value === 'string') validatePortablePaths(`plugin.json#${key}`, value);
  }
}

function validateResources(dir, skillPath) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) { error(path, 'recurso usa symlink'); continue; }
    if (entry.isDirectory()) { validateResources(path, skillPath); continue; }
    if (path === skillPath || path === fileURLToPath(import.meta.url)) continue;
    if (entry.isFile() && /\.(?:md|mjs|js|json|py|sh|txt|ya?ml)$/.test(entry.name)) {
      validatePortablePaths(path, readFileSync(path, 'utf8'), dirname(path), pluginRoot);
    }
  }
}

const skillsRoot = join(pluginRoot, 'skills');
if (!existsSync(skillsRoot)) error(skillsRoot, 'diretório não existe');
else {
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) { error(join(skillsRoot, entry.name), 'skills/ aceita somente diretórios'); continue; }
    const skillPath = join(skillsRoot, entry.name, 'SKILL.md');
    if (!existsSync(skillPath)) { error(skillPath, 'arquivo não existe'); continue; }
    const { text, values, problem } = parseFrontmatter(readFileSync(skillPath, 'utf8'));
    if (!values) error(skillPath, `frontmatter inválido: ${problem}`);
    else {
      if (!values.name) error(skillPath, 'campo name é obrigatório');
      else if (values.name !== entry.name) error(skillPath, `name ${values.name} difere do diretório ${entry.name}`);
      else if (!NAME.test(values.name) || values.name.length > 64) error(skillPath, 'campo name inválido');
      if (!values.description) error(skillPath, 'description é obrigatória');
      else if (values.description.length > 1024) error(skillPath, 'description excede 1024 caracteres');
    }
    validatePortablePaths(skillPath, text, dirname(skillPath), pluginRoot);
    validateResources(dirname(skillPath), skillPath);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Plugin Codex válido: ${pluginRoot}`);
