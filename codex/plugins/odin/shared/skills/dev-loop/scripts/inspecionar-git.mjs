#!/usr/bin/env node
// Inspeção do workspace sem staging. diff inclui trabalho rastreado e novos explicitados;
// staged confere TODOS os paths do índice antes do commit, sem retirar trabalho alheio.
// diff com base compara a worktree com a base da entrega: implementação já commitada na branch
// (checkpoint do Solo, run anterior) aparece para a auditoria e as lentes, que contra HEAD não a
// viam. alteracoes lista os nomes alterados (contra HEAD ou contra a base) para o portão TDD
// medir implementação anterior ao portão e saber quais arquivos a entrega CRIA. Nenhum modo
// escreve no workspace, no índice ou nas refs. Argumento a mais é recusado: ignorá-lo deixava
// uma base passada na posição errada sem efeito e sem aviso.
// Não prova autorização humana nem isola um shell malicioso. A sessão confere o escopo.
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve } from 'node:path';
import { validateQualityPath } from './quality-contract.mjs';
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
  env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'],
});
const list = text => text.split('\0').filter(Boolean);
const USO = 'uso: inspecionar-git.mjs diff <array JSON de paths relativos> [base] | quality <array JSON de paths relativos> [base [pendenciasPath]] | staged <array JSON de paths relativos> | alteracoes [base]';
// Base opcional = commit anterior à implementação. Sem ela, compara com HEAD. A ref é validada
// antes de chegar ao git: opção ('-x'), intervalo ('a..b') e texto com espaço não são commit.
function resolverBase(ref) {
  if (ref === undefined) return { ref: 'HEAD', sha: git('rev-parse', '--verify', 'HEAD^{commit}').trim() };
  if (!/^[A-Za-z0-9._/~^@{}-]+$/.test(ref) || ref.startsWith('-') || ref.includes('..')) throw new Error(`base inválida: ${ref}`);
  const sha = git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`).trim();
  if (!/^[0-9a-f]{40,64}$/.test(sha)) throw new Error(`base não resolve para commit: ${ref}`);
  return { ref, sha };
}
// diff da worktree pode invocar clean/process, mesmo com --no-textconv. Falhar antes
// de qualquer diff quando um filtro ativo cobre um arquivo rastreado; check-attr apenas lê
// atributos. Inclui paths da base que já saíram do índice.
function recusarFiltros(base) {
  const paths = [...new Set([...list(git('ls-files', '--cached', '-z')), ...list(git('ls-tree', '-r', '--name-only', '-z', base))])];
  if (!paths.length) return;
  const atributos = execFileSync('git', ['-c', 'core.fsmonitor=false', 'check-attr', '-z', '--stdin', 'filter'], {
    env, input: paths.join('\0') + '\0', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15000,
  }).split('\0');
  const drivers = new Map();
  for (let i = 0; i + 2 < atributos.length; i += 3) {
    const filtro = atributos[i + 2];
    // As strings set/unset/unspecified também podem ser NOMES explícitos de driver.
    // Não presumir ausência só pelo valor: consultar a configuração uma vez por nome.
    if (!drivers.has(filtro)) {
      let ativo = null;
      for (const campo of ['clean', 'process']) {
        let comando;
        try { comando = git('config', '--get', `filter.${filtro}.${campo}`).trim(); }
        catch (e) { if (e.status === 1) continue; throw e; }
        if (comando) { ativo = campo; break; }
      }
      drivers.set(filtro, ativo);
    }
    if (drivers.get(filtro)) throw new Error(`filtro Git ${drivers.get(filtro)} ativo em ${atributos[i]}: inspeção recusada sem executar conversores`);
  }
}
function escopo(texto) {
  const input = JSON.parse(texto);
  if (!Array.isArray(input)) throw new Error(USO);
  return new Set(input.map(p => {
    if (typeof p !== 'string' || !p.trim() || p !== p.trim() || isAbsolute(p) || /[:\\\x00-\x1f]/.test(p) || p.split('/').some(x => x === '..' || x === '.git')) throw new Error('path inválido no escopo');
    const canonical = posix.normalize(p);
    if (canonical === '.' || canonical.endsWith('/')) throw new Error('escopo exige arquivos, não diretórios');
    return canonical;
  }));
}
// Git compara o próprio symlink terminal; só os ancestrais podem redirecionar
// a travessia do diff. Nomes vindos do Git não são alvos de qualidade declarados.
function validateGitAncestors(path, root) {
  const parts = path.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = resolve(current, part);
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    const physical = realpathSync(current);
    const location = relative(root, physical);
    if (location === '..' || location.startsWith('../') || location.startsWith('..\\') || isAbsolute(location) ||
        location.split(/[\\/]/).some(component => component.toLowerCase() === '.git')) {
      throw new Error(`ancestral fora do workspace ou metadados Git: ${path}`);
    }
    if (!stat.isDirectory() && !stat.isSymbolicLink()) throw new Error(`ancestral não é diretório: ${path}`);
  }
}
function sparseExcludedPaths(paths) {
  if (!paths.length) return new Set();
  const options = { env: { ...env, LC_ALL: 'C' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15000 };
  const checked = spawnSync('git', ['sparse-checkout', 'check-rules', '-z'], { ...options, input: paths.join('\0') + '\0' });
  if (checked.error || checked.signal) throw checked.error ?? new Error(`sparse check-rules interrompido: ${checked.signal}`);
  if (checked.status === 0) {
    const included = checked.stdout === '' ? [] : checked.stdout.slice(0, -1).split('\0');
    const candidates = new Set(paths);
    if (checked.stderr || (checked.stdout !== '' && !checked.stdout.endsWith('\0')) ||
        included.some(path => !path || !candidates.has(path)) || new Set(included).size !== included.length) {
      throw new Error(`sparse check-rules sem prova válida: ${checked.stderr || checked.stdout}`);
    }
    for (const path of included) candidates.delete(path);
    return candidates;
  }
  const unavailable = checked.status === 129 && checked.stdout === '' &&
    /^error: unknown subcommand: `check-rules'\nusage: git sparse-checkout [^\n]+\n\n?$/.test(checked.stderr);
  if (!unavailable) throw new Error(`sparse check-rules falhou: ${checked.stderr || checked.status}`);
  let cone = false, ignoreCase = false;
  try { cone = git('config', '--bool', '--get', 'core.sparseCheckoutCone').trim() === 'true'; }
  catch (error) { if (error.status !== 1) throw error; }
  if (!cone) throw new Error('sparse não-cone exige Git com check-rules; subcomando indisponível');
  try { ignoreCase = git('config', '--bool', '--get', 'core.ignoreCase').trim() === 'true'; }
  catch (error) { if (error.status !== 1) throw error; }
  const listed = spawnSync('git', ['sparse-checkout', 'list'], options);
  if (listed.error || listed.signal || listed.status !== 0 || listed.stderr) {
    throw listed.error ?? new Error(`sparse list sem prova válida: ${listed.stderr || listed.signal || listed.status}`);
  }
  if (listed.stdout && !listed.stdout.endsWith('\n')) throw new Error('sparse list sem terminador');
  const directories = listed.stdout === '' ? [] : listed.stdout.slice(0, -1).split('\n');
  for (const directory of directories) {
    if (directory.startsWith('"') || /[\\\x00-\x1f]/.test(directory) ||
        directory.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('sparse cone com nome C-quoted ou representação não suportada');
    }
  }
  // ponytail: só reconstruímos a serialização cone canônica; padrões gerais exigem check-rules.
  const parents = new Set();
  for (const directory of directories) {
    const parts = directory.split('/');
    for (let length = 1; length < parts.length; length++) parents.add(parts.slice(0, length).join('/'));
  }
  const byteOrder = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
  const escapePattern = value => value.replace(/[\\*?\[]/g, '\\$&');
  const canonical = ['/*', '!/*/'];
  for (const parent of [...parents].sort(byteOrder)) canonical.push(`/${escapePattern(parent)}/`, `!/${escapePattern(parent)}/*/`);
  for (const directory of [...directories].sort(byteOrder)) canonical.push(`/${escapePattern(directory)}/`);
  const rules = readFileSync(git('rev-parse', '--git-path', 'info/sparse-checkout').trim());
  if (!directories.length && rules.equals(Buffer.from('/*\n'))) return new Set();
  if (!rules.equals(Buffer.from(canonical.join('\n') + '\n'))) throw new Error('sparse cone com regras não canônicas');
  const fold = value => ignoreCase ? value.replace(/[A-Z]/g, letter => letter.toLowerCase()) : value;
  const selections = directories.map(directory => fold(directory).split('/'));
  return new Set(paths.filter(path => {
    const components = fold(path).split('/');
    if (components.length === 1) return false;
    for (const selected of selections) {
      const shared = Math.min(components.length - 1, selected.length);
      if (components.slice(0, shared).every((part, index) => part === selected[index])) return false;
    }
    return true;
  }));
}
function qualityInventory(paths, root, base, pendingPath) {
  const indexed = new Set(list(git('ls-files', '--cached', '-z')));
  const tracked = new Set([...indexed, ...list(git('ls-tree', '-r', '--name-only', '-z', base.sha))]);
  let excludedPending;
  // Até o diff de nomes pode ler arquivos para detectar alterações. Verificar os
  // ancestrais primeiro impede que um diretório trocado por symlink escape da raiz.
  for (const path of new Set([...tracked, ...paths])) validateGitAncestors(path, root);
  if (pendingPath !== undefined) {
    validateQualityPath(pendingPath, { root });
    const head = new Set(list(git('ls-tree', '-r', '--name-only', '-z', 'HEAD')));
    let pendingList = false;
    try { pendingList = Array.isArray(JSON.parse(pendingPath)); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    const currentPending = indexed.has(pendingPath) || head.has(pendingPath);
    const pendingDirectory = [...tracked, ...head].some(path => path.startsWith(pendingPath + '/'));
    if (pendingList || paths.has(pendingPath) || pendingDirectory || (tracked.has(pendingPath) && !currentPending)) {
      throw new Error(`pendenciasPath inválido: lista, alvo, diretório ou arquivo rastreado somente na base: ${pendingPath}`);
    }
    let stat;
    try { stat = lstatSync(resolve(root, pendingPath)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat && !stat.isFile()) throw new Error(`pendenciasPath não é arquivo regular: ${pendingPath}`);
    if (!currentPending) excludedPending = pendingPath;
  }
  recusarFiltros(base.sha);
  const indexEntries = new Map();
  for (const entry of list(git('ls-files', '--stage', '-z'))) {
    const separator = entry.indexOf('\t');
    const [mode, object, stage] = entry.slice(0, separator).split(' ');
    const path = entry.slice(separator + 1);
    if (stage !== '0') throw new Error(`índice unmerged: ${path}`);
    indexEntries.set(path, { mode, object });
  }
  const indexChanges = new Set(list(git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--name-only', '--no-renames', '-z', base.sha, '--')));
  let sparseCheckout = false;
  try { sparseCheckout = git('config', '--bool', '--get', 'core.sparseCheckout').trim() === 'true'; }
  catch (error) { if (error.status !== 1) throw error; }
  const sparseCandidates = [];
  // Bits ocultam o diff: conferir bytes literais preserva o índice e não executa filtros.
  for (const entry of list(git('ls-files', '-v', '-z'))) {
    if (entry[0] !== 'S' && !/^[a-z]$/.test(entry[0])) continue;
    const path = entry.slice(2);
    const diagnostic = `flag Git skip-worktree ou assume-unchanged no índice: ${path}`;
    if (paths.has(path) || path === pendingPath) throw new Error(diagnostic);
    const indexedEntry = indexEntries.get(path);
    if (!indexedEntry) throw new Error(`${diagnostic}: entrada sem estágio zero`);
    let stat;
    try { stat = lstatSync(resolve(root, path)); }
    catch (error) {
      // Ausência sparse representa o blob do índice, nunca uma deleção da worktree.
      if (error.code === 'ENOENT' && entry[0].toUpperCase() === 'S' && sparseCheckout && !indexChanges.has(path)) {
        sparseCandidates.push(path);
        continue;
      }
      throw new Error(`${diagnostic}: ${error.message}`);
    }
    if (!stat.isFile() || !['100644', '100755'].includes(indexedEntry.mode)) throw new Error(`${diagnostic}: arquivo não regular`);
    const executable = (stat.mode & 0o111) !== 0;
    if (executable !== (indexedEntry.mode === '100755')) throw new Error(`${diagnostic}: modo alterado`);
    const bytes = readFileSync(resolve(root, path));
    const indexedBytes = execFileSync('git', ['cat-file', 'blob', indexedEntry.object], {
      env, maxBuffer: 64 * 1024 * 1024, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!bytes.equals(indexedBytes)) throw new Error(`${diagnostic}: bytes alterados`);
  }
  const sparseExcluded = sparseExcludedPaths([...new Set(sparseCandidates)]);
  for (const path of sparseCandidates) {
    if (!sparseExcluded.has(path)) throw new Error(`flag Git skip-worktree ou assume-unchanged no índice: ${path}: ausência dentro das regras sparse`);
  }
  const changed = list(git('diff', '--no-ext-diff', '--no-textconv', '--name-only', '--no-renames', '-z', base.sha, '--'));
  const untracked = new Set(list(git('ls-files', '--others', '--exclude-standard', '-z')));
  const result = { files: [], uninspected: [...untracked].filter(path => !paths.has(path) && path !== excludedPending).sort(), errors: [] };
  const candidates = new Set([...changed.filter(path => !untracked.has(path) || paths.has(path)), ...paths]);
  for (const path of [...candidates].sort()) {
    try {
      validateQualityPath(path, { root });
      if (!tracked.has(path) && !untracked.has(path)) throw new Error(`arquivo ausente ou ignorado: ${path}`);
      const file = resolve(root, path);
      let stat;
      try { stat = lstatSync(file); }
      catch (error) {
        if (error.code !== 'ENOENT' || !tracked.has(path)) throw error;
        result.files.push({ path, lines: 0, bytes: 0, status: 'deleted' });
        continue;
      }
      if (stat.isSymbolicLink()) {
        validateQualityPath(path, { root, requireFile: true });
        // O objeto revisado é o link; nunca ler o conteúdo do destino validado.
        const bytes = readlinkSync(file, { encoding: 'buffer' });
        result.files.push({ path, status: 'symlink', lines: 0, bytes: bytes.length });
        continue;
      }
      if (!stat.isFile()) throw new Error(`arquivo não regular: ${path}`);
      const bytes = readFileSync(file);
      let text = null;
      if (!bytes.includes(0)) {
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch (error) { if (error.code !== 'ERR_ENCODING_INVALID_ENCODED_DATA') throw error; }
      }
      const lines = text === null || !text.length ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
      result.files.push({ path, lines, bytes: bytes.length, status: text === null ? 'binary' : 'text' });
    } catch (error) {
      result.errors.push(`${path}: ${error.message}`);
      if (!result.uninspected.includes(path)) result.uninspected.push(path);
    }
  }
  result.uninspected.sort();
  return result;
}
try {
  const [mode, ...resto] = process.argv.slice(2);
  const aridade = { diff: [1, 2], quality: [1, 3], staged: [1, 1], alteracoes: [0, 1] }[mode];
  if (!aridade || resto.length < aridade[0] || resto.length > aridade[1]) throw new Error(USO);
  const root = realpathSync(git('rev-parse', '--show-toplevel').trim());
  if (root !== realpathSync(process.cwd())) throw new Error('execute da raiz física do workspace');
  let paths;
  if (mode === 'quality') {
    const input = JSON.parse(resto[0]);
    if (!Array.isArray(input)) throw new Error(USO);
    paths = new Set(input.map(path => validateQualityPath(path, { root })));
  } else paths = mode === 'alteracoes' ? null : escopo(resto[0]);
  if (mode === 'quality') {
    const inventory = qualityInventory(paths, root, resolverBase(resto[1]), resto[2]);
    console.log(JSON.stringify(inventory));
    if (inventory.errors.length) {
      console.error(`ERRO: ${inventory.errors.join('; ')}`);
      process.exitCode = 1;
    }
  } else if (mode === 'alteracoes') {
    // alterados = worktree contra a base (rastreados, inclusive o já commitado) e não rastreados
    // não ignorados. adicionados = os que a base não tem: diff `A` e não rastreado que não
    // aparece no diff (não rastreado presente na base sai como `D`, porque o índice não o tem).
    const base = resolverBase(resto[0]);
    recusarFiltros(base.sha);
    const doDiff = list(git('diff', '--name-only', '--no-renames', '-z', base.sha, '--'));
    const novosNoDiff = list(git('diff', '--name-only', '--no-renames', '--diff-filter=A', '-z', base.sha, '--'));
    const naoRastreados = list(git('ls-files', '--others', '--exclude-standard', '-z'));
    const noDiff = new Set(doDiff);
    const alterados = [...new Set([...doDiff, ...naoRastreados])].sort();
    const adicionados = [...new Set([...novosNoDiff, ...naoRastreados.filter(p => !noDiff.has(p))])].sort();
    console.log(JSON.stringify({ comparadoCom: base.ref, sha: base.sha, alterados, adicionados }));
  } else if (mode === 'staged') {
    // Sem detecção de rename: tanto a remoção da origem quanto a adição exigem escopo.
    const staged = list(git('diff', '--cached', '--name-only', '--no-renames', '-z', '--'));
    const foraDoEscopo = staged.filter(p => !paths.has(p));
    const ok = staged.length > 0 && foraDoEscopo.length === 0;
    console.log(JSON.stringify({ ok, paths: staged, foraDoEscopo }));
    if (!ok) process.exitCode = 1;
  } else {
    // Com base: rastreados = worktree contra a base, inclusive trabalho já commitado na branch.
    // staged continua contra HEAD: é o que o próximo commit levaria.
    const base = resolverBase(resto[1]);
    recusarFiltros(base.sha);
    const untracked = list(git('ls-files', '--others', '--exclude-standard', '-z'));
    const rastreados = new Set([...list(git('ls-files', '--cached', '-z')), ...list(git('diff', '--name-only', '--no-renames', '-z', base.sha, '--'))]);
    const declaradosNaoInspecionados = [...paths].filter(p => !rastreados.has(p) && !untracked.includes(p));
    const novos = untracked.filter(p => paths.has(p)).map(p => {
      const file = resolve(root, p), real = realpathSync(file), rel = relative(root, real);
      if (lstatSync(file).isSymbolicLink()) {
        validateQualityPath(p, { root, requireFile: true });
        return { path: p, type: 'symlink', targetBase64: readlinkSync(file, { encoding: 'buffer' }).toString('base64') };
      }
      if (!lstatSync(file).isFile() || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error(`arquivo novo não regular ou fora do workspace: ${p}`);
      const bytes = readFileSync(file);
      return { path: p, binario: bytes.includes(0), conteudo: bytes.includes(0) ? null : bytes.toString('utf8') };
    });
    console.log(JSON.stringify({
      comparadoCom: base.ref,
      rastreados: git('diff', '--no-ext-diff', '--no-textconv', base.sha, '--'),
      staged: git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--'),
      novos, declaradosNaoInspecionados, novosNaoIncluidos: untracked.filter(p => !paths.has(p)),
    }));
  }
} catch (e) {
  if (process.argv[2] === 'quality') console.log(JSON.stringify({ files: [], uninspected: [], errors: [e.message] }));
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
