import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/arquivar-worktree.mjs', import.meta.url));
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'higeia-archive-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'), remote = join(root, 'remote.git'), wt = join(root, 'trabalho');
  const old = '2020-01-01T00:00:00Z';
  const env = { ...process.env, GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old,
    HOME: root, GIT_CONFIG_NOSYSTEM: '1', XDG_CONFIG_HOME: join(root, 'config') };
  const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture',
    '-C', cwd, ...args], { env, encoding: 'utf8', stdio: 'pipe' }).trim();
  mkdirSync(repo);
  git(repo, 'init', '-b', 'main'); git(repo, 'init', '--bare', remote);
  writeFileSync(join(repo, '.gitignore'), 'privado\n');
  git(repo, 'add', '.gitignore'); git(repo, 'commit', '-m', 'base');
  git(repo, 'remote', 'add', 'origin', remote); git(repo, 'push', 'origin', 'main');
  git(repo, 'worktree', 'add', '-b', 'topico', wt);
  function chamada(mode, args = [], alvo = wt) {
    const p = spawnSync(process.execPath, [script, mode, '--repo', repo, '--worktree', alvo,
      '--remoto', 'origin', '--base', 'main', ...args], { cwd: repo, env, encoding: 'utf8' });
    const out = JSON.parse(p.stdout);
    assert.equal(p.status, out.resultado === 'preservar' ? 1 : 0);
    return out;
  }
  function exclusivo() {
    writeFileSync(join(wt, 'entrega'), 'conteudo recuperavel');
    git(wt, 'add', 'entrega'); git(wt, 'commit', '-m', 'entrega');
  }
  function envelhecer() {
    for (const key of ['HEAD', 'index', 'logs/HEAD', 'logs/refs/heads/topico']) {
      const file = git(wt, 'rev-parse', '--path-format=absolute', '--git-path', key);
      if (existsSync(file)) utimesSync(file, new Date(old), new Date(old));
    }
  }
  const prever = (...args) => chamada('prever', args);
  const aplicar = (p, ...args) => chamada('aplicar', ['--plano', p.id, '--inativa', ...args]);
  return { repo, remote, wt, git, exclusivo, envelhecer, chamada, prever, aplicar, env, root };
}

test('merge confirmado na base remota permite retirar só o checkout', t => {
  const f = fixture(t);
  f.exclusivo(); f.git(f.repo, 'merge', '--no-ff', 'topico', '-m', 'merge');
  f.git(f.repo, 'push', 'origin', 'main');
  const p = f.prever(); assert.equal(p.acao, 'remover-integrada');
  assert.ok(existsSync(f.wt));
  assert.equal(f.chamada('aplicar', ['--plano', p.id]).resultado, 'preservar');
  assert.equal(f.aplicar(p).resultado, 'worktree removida');
  assert.equal(existsSync(f.wt), false);
  assert.equal(f.git(f.repo, 'rev-parse', 'topico'), p.head);
  assert.equal(f.git(f.repo, 'ls-remote', 'origin', 'refs/heads/topico'), '');
});

test('atividade recente no checkout de commit antigo impede arquivamento sem merge', t => {
  const f = fixture(t); f.exclusivo();
  f.git(f.repo, 'merge', '--ff-only', 'topico'); // base local à frente do servidor
  assert.match(f.prever().motivo, /14 dias/);
  assert.ok(existsSync(f.wt));
});

test('branch abandonada é recuperável a partir do remoto depois da remoção', t => {
  const f = fixture(t); f.exclusivo(); f.envelhecer();
  const p = f.prever(); assert.equal(p.acao, 'enviar-conferir-remover');
  assert.equal(f.git(f.remote, 'branch', '--list', 'topico'), '');
  const out = f.aplicar(p); assert.equal(out.resultado, 'worktree removida', out.motivo);
  assert.equal(out.remotoOid, p.head);
  assert.equal(f.git(f.remote, 'show', 'topico:entrega'), 'conteudo recuperavel');
  assert.equal(existsSync(f.wt), false);
});

test('uma cópia remota exata permite arquivar sem repetir o push', t => {
  const f = fixture(t); f.exclusivo(); f.git(f.wt, 'push', 'origin', 'topico'); f.envelhecer();
  const p = f.prever(); assert.equal(p.acao, 'remover-com-copia');
  assert.equal(f.aplicar(p).resultado, 'worktree removida');
});

test('push recusado preserva os arquivos e a branch', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); f.exclusivo(); f.envelhecer();
  writeFileSync(join(f.remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  const out = f.aplicar(f.prever()); assert.match(out.motivo, /Push recusado/);
  assert.equal(readFileSync(join(f.wt, 'entrega'), 'utf8'), 'conteudo recuperavel');
});

test('push com sucesso e ref removida pelo servidor mantém checkout', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); f.exclusivo(); f.envelhecer();
  writeFileSync(join(f.remote, 'hooks', 'post-receive'), '#!/bin/sh\ngit update-ref -d refs/heads/topico\n', { mode: 0o700 });
  assert.match(f.aplicar(f.prever()).motivo, /diverge/);
  assert.ok(existsSync(f.wt));
  f.env.HIGEIA_FIXTURE_CHECKOUT = f.wt;
  writeFileSync(join(f.remote, 'hooks', 'post-receive'), '#!/bin/sh\nprintf "%s" novo > "$HIGEIA_FIXTURE_CHECKOUT/privado"\n');
  assert.match(f.aplicar(f.prever()).motivo, /ignoradas/);
  assert.equal(readFileSync(join(f.wt, 'privado'), 'utf8'), 'novo');
});

test('ponta de leitura pode diferir do destino de push e não comprova backup', t => {
  const f = fixture(t); f.exclusivo(); f.git(f.wt, 'push', 'origin', 'topico');
  const backup = join(f.root, 'outro.git'); f.git(f.repo, 'init', '--bare', backup);
  f.git(f.repo, 'remote', 'set-url', '--push', 'origin', backup); f.envelhecer();
  const p = f.prever(); assert.equal(p.acao, 'enviar-conferir-remover');
  assert.equal(f.aplicar(p).resultado, 'worktree removida');
  assert.equal(f.git(backup, 'rev-parse', 'topico'), p.head);
});

test('arquivos ignorados, novos, alterados e ocultos do índice impedem remoção', t => {
  const f = fixture(t); const p = f.prever();
  for (const nome of ['privado', 'novo']) {
    writeFileSync(join(f.wt, nome), 'local');
    assert.equal(f.aplicar(p).resultado, 'preservar');
    assert.equal(readFileSync(join(f.wt, nome), 'utf8'), 'local');
    rmSync(join(f.wt, nome));
  }
  writeFileSync(join(f.wt, '.gitignore'), 'mudou');
  assert.equal(f.aplicar(p).resultado, 'preservar');
  f.git(f.wt, 'update-index', '--assume-unchanged', '.gitignore');
  assert.equal(f.aplicar(p).resultado, 'preservar');
});

test('worktree principal, travada ou com operação pendente é protegida', t => {
  const f = fixture(t);
  assert.equal(f.chamada('prever', [], f.repo).resultado, 'preservar');
  f.git(f.repo, 'worktree', 'lock', f.wt); assert.equal(f.prever().resultado, 'preservar');
  f.git(f.repo, 'worktree', 'unlock', f.wt);
  writeFileSync(f.git(f.wt, 'rev-parse', '--path-format=absolute', '--git-path', 'MERGE_HEAD'), 'pendente');
  assert.equal(f.prever().resultado, 'preservar');
});

test('mudança do plano ou de upstream interrompe antes de enviar', t => {
  const f = fixture(t); f.exclusivo(); f.envelhecer(); const p = f.prever();
  f.git(f.repo, 'remote', 'add', 'alternativo', f.remote);
  f.git(f.repo, 'config', 'branch.topico.remote', 'alternativo');
  f.git(f.repo, 'config', 'branch.topico.merge', 'refs/heads/topico');
  assert.match(f.aplicar(p).motivo, /Upstream/);
  f.git(f.repo, 'config', '--remove-section', 'branch.topico');
  f.git(f.repo, 'push', 'origin', 'topico');
  assert.match(f.aplicar(p).motivo, /plano atual/);
  assert.ok(existsSync(f.wt));
});

test('squash exige PR da mesma ponta e merge ainda presente na base', t => {
  const f = fixture(t); f.exclusivo();
  f.git(f.repo, 'merge', '--squash', 'topico'); f.git(f.repo, 'commit', '-m', 'squash');
  f.git(f.repo, 'push', 'origin', 'main');
  const baseOid = f.git(f.repo, 'rev-parse', 'main'), head = f.git(f.wt, 'rev-parse', 'HEAD');
  // Git fala com o repositório local pelo substituto de SSH e gh lê a resposta de teste.
  const bin = join(f.root, 'bin'); mkdirSync(bin);
  const ssh = join(bin, 'ssh'), gh = join(bin, 'gh'), resposta = join(f.root, 'pr.json');
  writeFileSync(ssh, '#!/bin/sh\nexec git-upload-pack "$HIGEIA_FIXTURE_BARE"\n', { mode: 0o700 });
  writeFileSync(gh, '#!/bin/sh\ncat "$HIGEIA_FIXTURE_PR"\n', { mode: 0o700 });
  Object.assign(f.env, { GIT_SSH_COMMAND: '"' + ssh + '"', GIT_SSH_VARIANT: 'ssh',
    HIGEIA_FIXTURE_BARE: f.remote, HIGEIA_FIXTURE_PR: resposta, PATH: bin + ':' + f.env.PATH });
  f.git(f.repo, 'remote', 'set-url', 'origin', 'ssh://git@github.com/fixture/projeto.git');
  const pr = { number: 12, merged: true, merged_at: '2020-01-01', merge_commit_sha: baseOid,
    head: { repo: { full_name: 'fixture/projeto' }, sha: head, ref: 'topico' },
    base: { repo: { full_name: 'fixture/projeto' }, ref: 'main' } };
  writeFileSync(resposta, JSON.stringify({ ...pr, head: { ...pr.head, sha: baseOid } }));
  assert.match(f.prever('--pr', '12').motivo, /sem merge comprovado/);
  writeFileSync(resposta, JSON.stringify({ ...pr, merge_commit_sha: head }));
  assert.match(f.prever('--pr', '12').motivo, /base remota atual/);
  writeFileSync(resposta, JSON.stringify(pr));
  const p = f.prever('--pr', '12'); assert.equal(p.acao, 'remover-integrada', p.motivo);
  assert.equal(f.aplicar(p, '--pr', '12').resultado, 'worktree removida');
  assert.equal(f.git(f.remote, 'branch', '--list', 'topico'), '');
});

test('base ausente localmente e histórico remoto divergente preservam o trabalho', t => {
  const f = fixture(t); f.exclusivo(); f.envelhecer();
  const main = f.git(f.repo, 'rev-parse', 'main');
  const outro = f.git(f.remote, 'commit-tree', main + '^{tree}', '-p', main, '-m', 'trabalho remoto');
  f.git(f.remote, 'update-ref', 'refs/heads/main', outro);
  assert.match(f.prever().motivo, /git fetch/);
  f.git(f.remote, 'update-ref', 'refs/heads/main', main);
  f.git(f.remote, 'update-ref', 'refs/heads/topico', outro);
  assert.match(f.aplicar(f.prever()).motivo, /Push recusado/);
  assert.equal(f.git(f.remote, 'rev-parse', 'topico'), outro);
  assert.ok(existsSync(f.wt));
});
