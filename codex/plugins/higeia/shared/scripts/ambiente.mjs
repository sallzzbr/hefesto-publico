import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function ambiente(root, env = process.env, home = homedir()) {
  const codex = resolve(env.CODEX_HOME || join(home, '.codex'));
  const claude = resolve(env.CLAUDE_CONFIG_DIR || join(home, '.claude'));
  const pastas = [], skills = [], limites = [], plugins = [];
  function listar(dir) {
    try { return readdirSync(dir, { withFileTypes: true }); }
    catch (e) { if (e.code !== 'ENOENT') limites.push({ caminho: dir, erro: e.code }); return []; }
  }
  function texto(path) {
    try {
      const info = statSync(path);
      if (!info.isFile() || info.size > 2_000_000) throw Error('tipo ou tamanho fora do limite');
      return readFileSync(path, 'utf8');
    } catch (e) { if (e.code !== 'ENOENT') limites.push({ caminho: path, erro: e.code || e.message }); return null; }
  }
  function json(path) {
    const raw = texto(path);
    if (raw === null) return {};
    try { return JSON.parse(raw) || {}; }
    catch { limites.push({ caminho: path, erro: 'JSON inválido' }); return {}; }
  }
  function catalogar(dir, runtime, origem, plugin = null, versao = null, estado = 'fonte local') {
    if (!existsSync(dir)) return;
    pastas.push({ caminho: dir, runtime, origem, estado });
    function visitar(folder, nivel, ancestrais) {
      let real;
      try { real = realpathSync(folder); }
      catch (e) { limites.push({ caminho: folder, erro: e.code }); return; }
      if (ancestrais.includes(real)) return;
      const path = join(folder, 'SKILL.md');
      const raw = nivel ? texto(path) : null;
      if (!raw) {
        if (nivel >= 5) { limites.push({ caminho: folder, erro: 'limite de profundidade' }); return; }
        for (const entry of listar(folder)) {
          if (entry.name.startsWith('.') || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
          const child = join(folder, entry.name);
          if (entry.isSymbolicLink()) {
            try { if (!statSync(child).isDirectory()) continue; }
            catch (e) { limites.push({ caminho: child, erro: e.code }); continue; }
          }
          visitar(child, nivel + 1, [...ancestrais, real]);
        }
        return;
      }
      const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
      const campo = key => fm?.match(new RegExp('^' + key + ':[ \\t]*(.+)$', 'm'))?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2');
      const nome = campo('name') || basename(folder);
      skills.push({ runtime, origem, plugin, versao, estado, nome, caminho: path, real: realpathSync(path),
        hash: createHash('sha256').update(raw).digest('hex'), descricao: campo('description') || null });
    }
    visitar(dir, 0, []);
  }
  let dir = root;
  const projeto = [];
  while (true) {
    projeto.unshift(dir);
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) break;
    dir = dirname(dir);
  }
  // Fora de Git, mantenha o diagnóstico de projeto na raiz solicitada.
  if (!existsSync(join(projeto[0], '.git'))) projeto.splice(0, projeto.length, root);
  catalogar(join(home, '.agents/skills'), 'Codex', 'usuário');
  catalogar(join(codex, 'skills'), 'Codex', 'usuário (perfil)');
  catalogar(join(codex, 'skills/.system'), 'Codex', 'sistema');
  catalogar(join(claude, 'skills'), 'Claude', 'usuário');
  const enabledClaude = { ...json(join(claude, 'settings.json')).enabledPlugins };
  for (const p of projeto) {
    catalogar(join(p, '.agents/skills'), 'Codex', 'projeto');
    catalogar(join(p, '.claude/skills'), 'Claude', 'projeto');
    for (const name of ['settings.json', 'settings.local.json']) {
      Object.assign(enabledClaude, json(join(p, '.claude', name)).enabledPlugins);
    }
  }
  const registry = json(join(claude, 'plugins/installed_plugins.json')).plugins || {};
  for (const [id, items] of Object.entries(registry)) {
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if (!it?.installPath || typeof it.installPath !== 'string') continue;
      const applies = !it.projectPath || projeto.includes(resolve(it.projectPath));
      const estado = !applies ? 'outro projeto' : enabledClaude[id] === true ? 'habilitado na configuração lida'
        : enabledClaude[id] === false ? 'desabilitado na configuração lida' : 'ativação desconhecida';
      const presente = existsSync(it.installPath);
      plugins.push({ runtime: 'Claude', id, versao: it.version, escopo: it.scope, caminho: it.installPath, presente, estado });
      if (applies && presente) catalogar(join(it.installPath, 'skills'), 'Claude', 'plugin registrado', id, it.version, estado);
    }
  }
  // Reconhece as tabelas simples que o CLI grava; valores ausentes ficam desconhecidos.
  const flags = new Map();
  for (const file of [join(codex, 'config.toml'), ...projeto.map(p => join(p, '.codex/config.toml'))]) {
    let plugin;
    for (const line of (texto(file) || '').split(/\r?\n/)) {
      if (/^\s*\[/.test(line)) plugin = line.match(/^\s*\[plugins\.(["'])([^"']+)\1\]\s*(?:#.*)?$/)?.[2];
      const flag = line.match(/^\s*enabled\s*=\s*(true|false)\s*(?:#.*)?$/);
      if (plugin && flag) flags.set(plugin, flag[1] === 'true');
    }
  }
  const cache = join(codex, 'plugins/cache');
  for (const market of listar(cache).filter(x => x.isDirectory())) {
    const m = join(cache, market.name);
    for (const pkg of listar(m).filter(x => x.isDirectory())) {
      const base = join(m, pkg.name);
      const id = pkg.name + '@' + market.name;
      for (const v of listar(base).filter(x => x.isDirectory())) {
        const path = join(base, v.name);
        const estado = flags.has(id) ? (flags.get(id) ? 'plugin habilitado; versão em cache' : 'plugin desabilitado; versão em cache') : 'cache; ativação desconhecida';
        plugins.push({ runtime: 'Codex', id, caminho: path, versao: v.name, estado, presente: true });
        catalogar(join(path, 'skills'), 'Codex', 'cache de plugin', id, v.name, estado);
      }
    }
  }
  const grupos = new Map();
  for (const skill of skills) {
    const chave = skill.runtime + '/' + skill.nome;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(skill);
  }
  const sobreposicoes = [];
  for (const [chave, rows] of grupos) {
    if (rows.length < 2) continue;
    const origens = new Set(rows.map(r => r.plugin || r.origem));
    const tipo = new Set(rows.map(r => r.real)).size === 1 ? 'mesmo arquivo por mais de um caminho'
      : origens.size === 1 && rows.every(r => r.origem === 'cache de plugin') ? 'versões em cache'
      : new Set(rows.map(r => r.hash)).size === 1 ? 'conteúdo idêntico' : 'conteúdo diferente';
    sobreposicoes.push({ chave, tipo, caminhos: rows.map(r => r.caminho) });
  }
  const papeis = [
    [claude, 'perfil Claude'], [join(claude, 'projects'), 'históricos por projeto'], [join(claude, 'plugins/marketplaces'), 'fontes de marketplace Claude'],
    [codex, 'perfil Codex'], [cache, 'cópias de plugins Codex'], [join(codex, 'worktrees'), 'worktrees do aplicativo (local padrão)'],
    [join(codex, 'sessions'), 'históricos de sessão Codex'],
  ].filter(([path]) => existsSync(path)).map(([caminho, funcao]) => ({ caminho, funcao }));
  return { raiz: root, papeis, pastas, plugins, skills, sobreposicoes, limites, uso: 'desconhecido; arquivos no disco não medem invocações' };
}
