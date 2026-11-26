import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { listarWorktrees, status } from './residuos.mjs';

const dia = 86_400_000;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exigir = (ok, motivo) => { if (!ok) throw new Error(motivo); };
const dentro = (path, root) => path === root || path.startsWith(root + sep);
const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1',
  GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'file:https:ssh:git' };

function executar(cwd, args, falha, aceitos = [0]) {
  const p = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd, env, encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  exigir(aceitos.includes(p.status) && !p.error, falha);
  return p;
}
function git(cwd, args, falha = 'Falhou a leitura dos metadados Git.') {
  return executar(cwd, args, falha).stdout.trimEnd();
}
function destino(repo, remoto, push) {
  const url = git(repo, ['remote', 'get-url', ...(push ? ['--push'] : []), '--all', remoto]);
  exigir(url && !/[\r\n]/.test(url) && !url.startsWith('-'), 'Destino remoto ausente ou ambíguo.');
  return url;
}
function ponta(repo, url, ref) {
  const linha = git(repo, ['ls-remote', '--refs', '--', url, ref], 'Falhou a consulta ao remoto.');
  if (!linha) return null;
  const [oid, nome] = linha.split('\t');
  exigir(nome === ref && /^(?:[\da-f]{40}|[\da-f]{64})$/.test(oid), 'Resposta remota ambígua.');
  return oid;
}
function local(repo, path) {
  const lista = listarWorktrees(git(repo, ['worktree', 'list', '--porcelain', '-z']));
  const w = lista.find(item => resolve(item.worktree) === path);
  exigir(w && w !== lista[0] && !w.bare && !w.detached && !('prunable' in w) && !('locked' in w)
    && w.branch?.startsWith('refs/heads/'), 'Exige worktree secundária registrada, presente, destravada e com branch.');
  exigir(realpathSync(path) === path && !dentro(realpathSync(process.cwd()), path)
    && !dentro(repo, path), 'Caminho redirecionado ou em uso por esta execução.');
  const gerenciada = [process.env.CODEX_HOME, process.env.CLAUDE_CONFIG_DIR].filter(Boolean)
    .some(root => dentro(path, resolve(root, 'worktrees')));
  exigir(!gerenciada && !/[\\/][.](?:codex|claude)[\\/]worktrees(?:[\\/]|$)/i.test(path)
    && ![path, dirname(path)].some(dir => existsSync(join(dir, '.codex-worktree-name'))),
  'Worktree gerenciada pelo aplicativo. Confira o chat proprietário.');
  const admin = git(path, ['rev-parse', '--absolute-git-dir']);
  exigir(resolve(git(path, ['rev-parse', '--show-toplevel'])) === path
    && git(path, ['rev-parse', '--path-format=absolute', '--git-common-dir']) === git(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    && git(path, ['symbolic-ref', 'HEAD']) === w.branch && git(path, ['rev-parse', 'HEAD']) === w.HEAD,
  'Checkout, branch e registro Git divergentes.');
  const sinais = ['index.lock', 'HEAD.lock', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD',
    'BISECT_START', 'rebase-merge', 'rebase-apply', 'sequencer', 'AUTO_MERGE'];
  exigir(!sinais.some(s => existsSync(join(admin, s))), 'Operação Git em andamento.');
  const estado = status(path, true);
  exigir(!estado.erro, estado.erro);
  exigir(!estado.submodulosPossiveis, 'Worktree com configuração de submódulos.');
  exigir(!estado.modificados && !estado.novos && !estado.ignorados,
    `Pendências locais: ${estado.modificados} modificadas, ${estado.novos} novas e ${estado.ignorados} ignoradas.`);
  const indice = git(path, ['ls-files', '-v', '--stage', '-z']).split('\0');
  exigir(!indice.some(s => /^(?:[a-zS] |. 160000 )/.test(s)), 'Índice com entradas ocultas ou submódulo.');
  const reflog = git(path, ['rev-parse', '--path-format=absolute', '--git-path', 'logs/' + w.branch]);
  const datas = ['HEAD', 'index'].map(f => statSync(join(admin, f)).mtimeMs);
  for (const f of [join(admin, 'logs', 'HEAD'), reflog]) if (existsSync(f)) datas.push(statSync(f).mtimeMs);
  const atividade = Math.max(...datas, Number(git(path, ['show', '-s', '--format=%ct', w.HEAD])) * 1000);
  const st = statSync(admin);
  return { ref: w.branch, head: w.HEAD, atividade, registro: [st.dev, st.ino, st.birthtimeMs] };
}
function mergeDoPr(repo, url, numero, ref, head, base, baseOid) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?$/i.exec(url);
  exigir(match, 'A verificação de PR exige origem identificável no github.com.');
  const slug = match[1];
  const res = spawnSync('gh', ['api', '--hostname', 'github.com', 'repos/' + slug + '/pulls/' + numero], {
    cwd: repo, encoding: 'utf8', timeout: 15000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  exigir(res.status === 0, 'Falhou a leitura do PR informado.');
  const pr = JSON.parse(res.stdout);
  exigir(pr.number === Number(numero) && pr.merged === true && pr.merged_at
    && [pr.head?.repo?.full_name, pr.base?.repo?.full_name].every(nome => nome?.toLowerCase() === slug.toLowerCase())
    && ref === 'refs/heads/' + pr.head.ref && head === pr.head.sha && base === 'refs/heads/' + pr.base.ref
    && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(pr.merge_commit_sha), 'PR sem merge comprovado para esta ponta e base.');
  git(repo, ['merge-base', '--is-ancestor', pr.merge_commit_sha, baseOid], 'O merge do PR não foi confirmado na base remota atual.');
  return { numero, merge: pr.merge_commit_sha };
}
function plano(opts) {
  const { repo, path, remoto, base } = opts;
  const checkout = local(repo, path);
  const { head, ref, atividade } = checkout;
  exigir(ref !== base, 'A branch alvo é a própria base.');
  const leitura = destino(repo, remoto, false);
  const envio = destino(repo, remoto, true);
  exigir(!existsSync(git(repo, ['rev-parse', '--path-format=absolute', '--git-path', 'info/grafts'])),
    'Ancestralidade alterada por grafts locais.');
  const baseOid = ponta(repo, leitura, base);
  exigir(baseOid, 'A base não existe no remoto escolhido.');
  const ancestral = executar(repo, ['merge-base', '--is-ancestor', head, baseOid],
    'Base remota indisponível localmente. Atualize a base com git fetch e gere outra prévia.', [0, 1]).status === 0;
  const pr = !ancestral && opts.pr ? mergeDoPr(repo, leitura, opts.pr, ref, head, base, baseOid) : null;
  const integrado = ancestral || Boolean(pr);
  const dias = Math.floor((Date.now() - atividade) / dia);
  const branch = ref.slice('refs/heads/'.length);
  let remotoOid = null;
  if (!integrado) {
    exigir(dias >= 14, `Merge sem comprovação. Atividade mais recente há ${dias} dia(s), mínimo de 14 dias.`);
    const rastreio = git(repo, ['for-each-ref', '--format=%(upstream:remotename)%09%(upstream:remoteref)', ref]).split('\n')[0];
    exigir(!rastreio.trim() || rastreio === remoto + '\t' + ref, 'Upstream diferente do destino de arquivamento.');
    remotoOid = ponta(repo, envio, ref);
  }
  const identidade = hash([repo, path, remoto, base, leitura, envio, baseOid, checkout, integrado, pr]);
  const id = hash([identidade, remotoOid]);
  const resumo = { id, repo, worktree: path, remoto, base, baseOid, branch, head, dias, integrado, pr, remotoOid,
    acao: integrado ? 'remover-integrada' : remotoOid === head ? 'remover-com-copia' : 'enviar-conferir-remover' };
  return { resumo, identidade, checkout, envio };
}
function executarPedido() {
  // A inspeção de status compartilhada e cada processo Git devem ver o mesmo repositório.
  exigir(!Object.keys(process.env).some(k => /^(?:GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|REPLACE_REF_BASE|SHALLOW_FILE|GRAFT_FILE))$/.test(k)),
    'Execute fora de um ambiente com redirecionamento Git.');
  const { values: v, positionals: [modo, ...extra] } = parseArgs({ allowPositionals: true, options: {
    repo: { type: 'string' }, worktree: { type: 'string' }, remoto: { type: 'string' }, base: { type: 'string' },
    pr: { type: 'string' }, plano: { type: 'string' }, inativa: { type: 'boolean' },
  } });
  exigir(['prever', 'aplicar'].includes(modo) && !extra.length && v.repo && v.worktree && v.base && v.remoto,
    'Use prever|aplicar --repo PASTA --worktree PASTA --remoto NOME --base BRANCH.');
  const repo = realpathSync(v.repo);
  exigir(/^[\w][\w.-]*$/.test(v.remoto) && !v.base.startsWith('-'), 'Nome de remoto ou base inválido.');
  const base = 'refs/heads/' + v.base;
  git(repo, ['check-ref-format', base], 'Base inválida.');
  exigir(!v.pr || /^[1-9][0-9]*$/.test(v.pr), 'Número de PR inválido.');
  const opts = { repo, path: resolve(v.worktree), remoto: v.remoto, base, pr: v.pr };
  const inicial = plano(opts);
  const p = inicial.resumo;
  if (modo === 'prever') return p;
  exigir(v.plano === p.id && v.inativa, 'Aplicação exige o plano atual e confirmação de sessão inativa.');
  const ref = 'refs/heads/' + p.branch;
  if (p.acao === 'enviar-conferir-remover') {
    executar(repo, ['push', '--porcelain', '--no-follow-tags', '--recurse-submodules=no', '--', inicial.envio, p.head + ':' + ref],
      'Push recusado ou inconclusivo. Worktree preservada.');
  }
  // A atualização esperada é somente a ponta da branch de backup. Refazer inclusive o status.
  const depois = plano(opts);
  exigir(depois.identidade === inicial.identidade, 'O plano mudou. Gere outra prévia.');
  if (!p.integrado) exigir(depois.resumo.remotoOid === p.head, 'A ponta consultada após o push diverge. Worktree preservada.');
  exigir(hash(local(repo, opts.path)) === hash(inicial.checkout), 'Checkout alterado durante a verificação.');
  executar(repo, ['worktree', 'remove', '--', opts.path], 'Git recusou remover a worktree.');
  return { ...p, remotoOid: depois.resumo.remotoOid, resultado: 'worktree removida', recuperacao: { branchLocal: p.branch, commit: p.head } };
}
try { console.log(JSON.stringify(executarPedido(), null, 2)); }
catch (err) { console.log(JSON.stringify({ resultado: 'preservar', motivo: err.message })); process.exitCode = 1; }
