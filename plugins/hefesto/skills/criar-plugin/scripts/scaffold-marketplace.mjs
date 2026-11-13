#!/usr/bin/env node
// Scaffold de desenvolvimento: não instala nem publica pacotes.
// A skill resolve paths de dados do workspace por CLAUDE.md, defaults local_*,
// convenção descoberta no cwd e default documentado; exemplos são ilustrativos.
// Este helper recebe a raiz explícita e só opera o layout canônico de distribuição.
import { realpathSync, lstatSync, readFileSync, writeFileSync, openSync, closeSync, mkdirSync, rmSync, rmdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const json = value => `${JSON.stringify(value, null, 2)}\n`;
function stat(path) { try { return lstatSync(path); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
export function scaffold({ repo, kind, plugin, name, description }) {
  repo = realpathSync(resolve(repo));
  for (const value of [plugin, name]) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? '') || value.length > 64) throw Error('nome inválido');
  if (!['plugin', 'skill'].includes(kind) || typeof description !== 'string' || !description.trim() || description.trim().length > 1024) throw Error('kind ou description inválido');
  const writes = new Map(), originals = new Map(), createdDirs = [];
  function safe(path) {
    for (let p = path; ; p = dirname(p)) {
      const s = stat(p);
      if (s?.isSymbolicLink()) throw Error(`symlink não permitido: ${p}`);
      if (p === dirname(p)) break;
    }
  }
  function read(path) { safe(path); if (!stat(path)?.isFile()) throw Error(`arquivo obrigatório ausente: ${path}`); return readFileSync(path, 'utf8'); }
  function put(path, content, replace = false) {
    safe(path);
    if (writes.has(path)) throw Error(`destino duplicado: ${path}`);
    if (stat(path) && !replace) throw Error(`colisão: ${path}`);
    if (replace) originals.set(path, read(path));
    writes.set(path, content);
  }
  function absent(path) { safe(path); if (stat(path)) throw Error(`colisão: ${path}`); }
  const claude = join(repo, 'plugins', plugin), codex = join(repo, 'codex/plugins', plugin);
  const resourcePath = join(repo, 'codex/resources.json');
  safe(resourcePath);
  const dual = !!stat(resourcePath);
  const resources = dual ? JSON.parse(read(resourcePath)) : null;
  if (dual && !Array.isArray(resources.arquivos)) throw Error('inventário de recursos inválido');
  function resource(source, target) {
    if (resources.arquivos.some(e => e.target === target)) throw Error(`colisão no inventário: ${source}`);
    const content = writes.get(join(repo, source)) ?? read(join(repo, source));
    put(join(repo, 'codex', target), content);
    resources.arquivos.push({ source, target });
  }
  if (kind === 'plugin') {
    absent(claude);
    if (dual) absent(codex);
    const marketPath = join(repo, '.claude-plugin/marketplace.json');
    const market = JSON.parse(read(marketPath));
    if (!Array.isArray(market.plugins) || market.plugins.some(e => e.name === plugin)) throw Error('colisão ou marketplace Claude inválido');
    const version = market.metadata?.version?.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!version) throw Error('versão do marketplace inválida');
    if (!market.owner?.name?.trim()) throw Error('owner.name obrigatório no marketplace');
    const manifest = { author: market.owner, name: plugin, version: '0.1.0', description: description.trim() };
    put(join(claude, '.claude-plugin/plugin.json'), json(manifest));
    put(join(claude, 'README.md'), `# ${plugin}\n\n${description.trim()}\n\n## Skills\n\n| Skill | Descrição |\n| --- | --- |\n`);
    put(join(claude, 'CHANGELOG.md'), '# Changelog\n\n## 0.1.0\n\n- Scaffold inicial.\n');
    market.plugins.push({ ...manifest, source: `./plugins/${plugin}` });
    market.metadata.version = `${version[1]}.${Number(version[2]) + 1}.0`;
    put(marketPath, json(market), true);
    if (dual) {
      const path = join(repo, 'codex/.agents/plugins/marketplace.json');
      const marketCodex = JSON.parse(read(path));
      if (!Array.isArray(marketCodex.plugins) || marketCodex.plugins.some(e => e.name === plugin)) throw Error('colisão ou marketplace Codex inválido');
      marketCodex.plugins.push({ name: plugin, source: { source: 'local', path: `./plugins/${plugin}` }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' });
      put(path, json(marketCodex), true);
      put(join(codex, '.codex-plugin/plugin.json'), json({ ...manifest, skills: './skills/', interface: { displayName: plugin, shortDescription: description.trim(), longDescription: description.trim(), developerName: market.owner.name, category: 'Productivity', capabilities: [], defaultPrompt: [`Ajude-me a usar ${plugin}.`] } }));
      put(join(codex, 'CHANGELOG.md'), '# Changelog\n\n## 0.1.0\n\n- Scaffold inicial.\n');
      resource('codex/runtime/RUNTIME.md', `plugins/${plugin}/RUNTIME.md`);
      resource('codex/runtime/MODELOS.md', `plugins/${plugin}/MODELOS.md`);
      resource('LICENSE', `plugins/${plugin}/LICENSE`);
      resource(`plugins/${plugin}/README.md`, `plugins/${plugin}/shared/README.md`);
    }
  } else {
    const sourceManifest = JSON.parse(read(join(claude, '.claude-plugin/plugin.json')));
    if (sourceManifest.name !== plugin) throw Error('nome divergente no manifesto Claude');
    absent(join(claude, 'skills', name));
    if (dual) {
      const nativeManifest = JSON.parse(read(join(codex, '.codex-plugin/plugin.json')));
      if (nativeManifest.name !== plugin) throw Error('nome divergente no manifesto Codex');
      absent(join(codex, 'skills', name));
    }
    const header = `---\nname: ${name}\ndescription: ${JSON.stringify(description.trim())}\n---\n\n# ${name}\n\n`;
    put(join(claude, 'skills', name, 'SKILL.md'), header + '## Input\n\nConfirme entradas e saídas do pedido.\n\n## Before writing\n\nLeia os recursos declarados e verifique os pré-requisitos.\n\n## Output\n\nExecute a capacidade solicitada e valide o resultado.\n\n## Important\n\nNão invente ferramentas, conectores ou credenciais ausentes.\n');
    if (dual) {
      put(join(codex, 'skills', name, 'SKILL.md'), header + `Leia [o runtime](../../RUNTIME.md) e [o contrato](../../shared/skills/${name}/CONTRATO.md) antes de executar.\n\nAplique o contrato com as ferramentas disponíveis nesta sessão e resolva recursos por links relativos.\n`);
      resource(`plugins/${plugin}/skills/${name}/SKILL.md`, `plugins/${plugin}/shared/skills/${name}/CONTRATO.md`);
    }
  }
  if (dual) put(resourcePath, json(resources), true);
  // Todas as colisões e leituras obrigatórias precedem a primeira escrita.
  function mkdir(path) {
    if (stat(path)) return;
    mkdir(dirname(path)); mkdirSync(path); createdDirs.push(path);
  }
  const written = [];
  try {
    for (const [path, content] of writes) {
      mkdir(dirname(path));
      const fd = openSync(path, originals.has(path) ? 'w' : 'wx');
      // open pode truncar o alvo: registre antes da escrita, inclusive se ela falhar parcialmente.
      written.push(path);
      try { writeFileSync(fd, content); } finally { closeSync(fd); }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const path of written.reverse()) {
      try {
        if (originals.has(path)) writeFileSync(path, originals.get(path)); else rmSync(path);
      } catch (cleanupError) { rollbackErrors.push(`${path}: ${cleanupError.message}`); }
    }
    for (const path of createdDirs.reverse()) {
      try { rmdirSync(path); } catch (cleanupError) { rollbackErrors.push(`${path}: ${cleanupError.message}`); }
    }
    if (rollbackErrors.length) throw new Error(`${error.message}; rollback incompleto: ${rollbackErrors.join('; ')}`, { cause: error });
    throw error;
  }
  return { dual, files: [...writes.keys()] };
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const options = {};
    for (let i = 2; i < process.argv.length; i += 2) {
      if (!['--repo', '--kind', '--plugin', '--name', '--description'].includes(process.argv[i]) || process.argv[i + 1] === undefined) throw Error('argumento inválido');
      options[process.argv[i].slice(2)] = process.argv[i + 1];
    }
    const result = scaffold(options);
    console.log(`Scaffold ${result.dual ? 'Claude + Codex' : 'Claude'} criado. Complete conteúdo, README, bumps e inventário; rode sync e validação antes de concluir.`);
  } catch (error) { console.error(`ERRO: ${error.message}`); process.exitCode = 1; }
}
