import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, resolve, sep } from 'node:path';
import { inspecionarExecucao } from './execucoes.mjs';

const ignorar = new Set(['node_modules', 'vendor', 'dist', 'build', 'target', 'Library', 'Applications']);
const split0 = text => text.split('\0').filter(Boolean);

function git(cwd, args) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '', GIT_PAGER: 'cat' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
  const p = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
    cwd, env, encoding: 'utf8', timeout: 12000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { ok: p.status === 0, text: p.stdout || '', aviso: Boolean(p.stderr?.trim()), erro: p.error?.code || p.status };
}
function pastas(path, limites) {
  try { return readdirSync(path, { withFileTypes: true }); }
  catch (e) { if (e.code !== 'ENOENT') limites.push({ caminho: path, erro: e.code }); return []; }
}
function descobrir(root, limites) {
  const encontrados = [];
  function visitar(path, nivel) {
    if (existsSync(join(path, '.git')) || (existsSync(join(path, 'HEAD')) && existsSync(join(path, 'objects')))) {
      encontrados.push(path); return;
    }
    if (nivel === 3) return;
    for (const entry of pastas(path, limites)) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !ignorar.has(entry.name)) visitar(join(path, entry.name), nivel + 1);
    }
  }
  visitar(root, 0);
  return encontrados;
}
export function listarWorktrees(raw) {
  return raw.split('\0\0').filter(Boolean).map(block => {
    const fields = {};
    for (const linha of split0(block)) {
      const i = linha.indexOf(' ');
      if (i < 0) fields[linha] = true;
      else fields[linha.slice(0, i)] = linha.slice(i + 1);
    }
    return fields;
  });
}
export function status(path, exigirCompleto = false) {
  // Um filtro clean/process configurado pode executar um programa ao coletar git status.
  const filtros = git(path, ['config', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|process|smudge)$']);
  if (!filtros.ok && filtros.erro !== 1) return { erro: 'configuração Git ilegível' };
  const limparFiltros = [];
  for (const chave of new Set(filtros.text.trim().split('\n').filter(Boolean).map(s => s.slice(0, s.lastIndexOf('.'))))) {
    for (const sufixo of ['clean=', 'smudge=', 'process=', 'required=false']) limparFiltros.push('-c', chave + '.' + sufixo);
  }
  const resp = git(path, [...limparFiltros, 'status', '--porcelain=v1', '-z', '--no-renames', '--ignored=matching', '--untracked-files=normal', '--ignore-submodules=all']);
  if (!resp.ok) return { erro: 'status incompleto (' + resp.erro + ')' };
  if (exigirCompleto && resp.aviso) return { erro: 'Git emitiu aviso ao inspecionar os arquivos' };
  const contagem = { modificados: 0, novos: 0, ignorados: 0 };
  for (const s of split0(resp.text)) {
    if (s.startsWith('?? ')) contagem.novos++;
    else if (s.startsWith('!! ')) contagem.ignorados++;
    else contagem.modificados++;
  }
  return { ...contagem, submodulosPossiveis: existsSync(join(path, '.gitmodules')), filtrosExternosNeutralizados: Boolean(limparFiltros.length) };
}
function repo(cwd, basePedida) {
  const lista = git(cwd, ['worktree', 'list', '--porcelain', '-z']);
  if (!lista.ok) return { caminho: cwd, erro: 'worktrees ilegíveis (' + lista.erro + ')' };
  const raw = git(cwd, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(committerdate:unix)%00%(upstream)%00%(upstream:track)', 'refs/heads']);
  if (!raw.ok) return { caminho: cwd, erro: 'refs ilegíveis' };
  const linhas = raw.text.trimEnd().split('\n').filter(Boolean).map(l => l.split('\0'));
  const heads = new Set(linhas.map(l => l[0]));
  let base = basePedida || git(cwd, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).text.trim();
  if (!base && !basePedida) {
    const candidatas = ['refs/heads/main', 'refs/heads/master'].filter(x => heads.has(x));
    if (candidatas.length === 1) base = candidatas[0];
  }
  const tip = base && git(cwd, ['rev-parse', '--verify', '--end-of-options', base + '^{commit}']);
  const merged = tip?.ok && git(cwd, ['for-each-ref', '--merged=' + tip.text.trim(), '--format=%(refname)', 'refs/heads']);
  const integradas = new Set(merged?.text?.trim().split('\n'));
  const branches = linhas.map(([ref, commit, ts, upstream, track]) => ({
    nome: ref.slice('refs/heads/'.length), commit, diasDesdeCommit: ts ? Math.floor((Date.now() / 1000 - Number(ts)) / 86400) : null,
    upstream: upstream || null, comparacaoUpstreamLocal: upstream ? track || 'igual' : null,
    integradaNaBaseLocal: merged?.ok ? integradas.has(ref) : null,
  }));
  const worktrees = listarWorktrees(lista.text).map((w, i) => {
    const item = { caminho: w.worktree, principal: i === 0, bare: !!w.bare, branch: w.branch?.replace(/^refs\/heads\//, '') || null,
      commit: w.HEAD || null, travada: 'locked' in w, registroSemPasta: 'prunable' in w, atividadeDaSessao: 'desconhecida' };
    if (item.bare || !existsSync(w.worktree) || realpathSync(w.worktree) !== resolve(w.worktree)) return { ...item, inspecao: 'sem checkout físico verificável' };
    const gitDir = git(w.worktree, ['rev-parse', '--absolute-git-dir']);
    const operacoes = gitDir.ok ? ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_START', 'rebase-merge', 'rebase-apply', 'sequencer']
      .filter(m => existsSync(join(gitDir.text.trimEnd(), m))) : null;
    return { ...item, operacoes, estado: status(w.worktree) };
  });
  return { caminho: cwd, base: base || null, commitBase: tip?.ok ? tip.text.trim() : null, branches, worktrees };
}

function artefatos(dir, limites, selecionada) {
  const result = [];
  for (const nome of ['.worktrees', '.claude/worktrees', '.higeia/tmp', '.claude/workflows', 'runs', 'outputs']) {
    const base = join(dir, nome);
    if (!existsSync(base) || realpathSync(base) !== base || !lstatSync(base).isDirectory()) continue;
    for (const e of pastas(base, limites)) {
      const path = join(base, e.name);
      const item = { caminho: path, origem: nome, situacao: 'origem e uso a conferir' };
      if ((e.isDirectory() || ['.claude/workflows', 'runs', 'outputs'].includes(nome))
          && path !== selecionada && join(path, 'state.json') !== selecionada) {
        descreverExecucao(item, limites, dir);
      }
      result.push(item);
    }
  }
  return result;
}
function descreverExecucao(item, limites, raiz, pacote) {
  item.execucao = inspecionarExecucao(item.caminho, raiz, pacote);
  if (item.execucao.limite) limites.push({ caminho: item.caminho, erro: item.execucao.limite });
  if (item.execucao.executor) item.situacao = 'preservar execução e arquivos associados';
}
export function residuos(root, basePedida, { execucao, pacoteCodex } = {}) {
  const selecionada = execucao && resolve(root, execucao);
  const limites = [], repositorios = [], artefatosLocais = [], comuns = new Set(), checkouts = new Set();
  for (const cwd of descobrir(root, limites)) {
    const comum = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (!comum.ok) { limites.push({ caminho: cwd, erro: 'metadados Git inacessíveis' }); continue; }
    const key = comum.text.trimEnd();
    if (comuns.has(key)) continue;
    comuns.add(key);
    const dados = repo(cwd, basePedida);
    repositorios.push(dados);
    const pastas = new Set([cwd]);
    for (const w of dados.worktrees || []) {
      if (!w.bare && !w.inspecao && (w.caminho === root || w.caminho.startsWith(join(root, sep)))) pastas.add(w.caminho);
    }
    for (const pasta of pastas) {
      checkouts.add(pasta);
      for (const a of artefatos(pasta, limites, selecionada)) {
        a.worktreeRegistrada = dados.worktrees?.some(w => w.caminho === a.caminho) ?? null;
        artefatosLocais.push(a);
      }
    }
  }
  if (selecionada) {
    let item = artefatosLocais.find(a => a.caminho === selecionada || join(a.caminho, 'state.json') === selecionada);
    if (!item) {
      item = { caminho: selecionada, origem: 'execução indicada', situacao: 'origem e uso a conferir' };
      artefatosLocais.push(item);
    }
    const projeto = [...checkouts].sort((a, b) => b.length - a.length)
      .find(pasta => selecionada === pasta || selecionada.startsWith(join(pasta, sep)));
    descreverExecucao(item, limites, projeto || root, pacoteCodex);
  }
  // Uma raiz gerenciada pode reter o marcador do aplicativo após o checkout sumir.
  if (basename(root) === 'worktrees') {
    const registrados = repositorios.flatMap(r => r.worktrees || []);
    for (const entry of pastas(root, limites)) {
      if (!entry.isDirectory()) continue;
      const path = join(root, entry.name);
      if (!existsSync(join(path, '.codex-worktree-name'))) continue;
      const filhos = pastas(path, limites);
      artefatosLocais.push({ caminho: path, origem: 'marcador de worktree Codex',
        worktreeRegistrada: registrados.some(w => w.caminho === path || w.caminho.startsWith(path + sep)),
        situacao: filhos.every(f => f.name === '.codex-worktree-name') ? 'somente marcador; conferir vínculo com o chat' : 'diretório do aplicativo; conferir vínculo com o chat' });
    }
  }
  return { raiz: root, profundidadeDescoberta: 3, repositorios, artefatos: artefatosLocais, limites,
    cobertura: 'Refs locais, sem atualização remota. Idade do commit não mede abandono. Sessões ativas, PRs por squash, temporários fora das raízes conhecidas e conteúdo dos ignorados precisam de outras evidências.' };
}
