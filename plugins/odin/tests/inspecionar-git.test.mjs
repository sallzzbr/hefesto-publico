// Repositórios reais descartáveis. Nenhuma conta, remoto ou hook pessoal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
const CLI = resolve(import.meta.dirname, '../skills/dev-loop/scripts/inspecionar-git.mjs');
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
function fixture(fn) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-git-read-')));
  const git = (...args) => { const p = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' }); assert.equal(p.status, 0, p.stderr); return p.stdout; };
  const cli = (mode, paths, cwd = root) => spawnSync(process.execPath, [CLI, mode, JSON.stringify(paths)], { cwd, env, encoding: 'utf8', timeout: 10000 });
  try {
    git('init', '-q'); mkdirSync(resolve(root, 'src'));
    writeFileSync(resolve(root, 'src/a.js'), 'original\n'); writeFileSync(resolve(root, 'outside.md'), 'old\n');
    git('add', '--', 'src/a.js', 'outside.md');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
    return fn({ root, git, cli });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('diff inclui staged, unstaged e novo autorizado sem ler nota fora do escopo nem alterar índice', () => fixture(({ root, git, cli }) => {
  writeFileSync(resolve(root, 'src/a.js'), 'staged_version\n'); git('add', '--', 'src/a.js');
  writeFileSync(resolve(root, 'src/a.js'), 'working_version\n');
  writeFileSync(resolve(root, "src/new ' [x].js"), 'new_authorized\n');
  writeFileSync(resolve(root, 'local-note.md'), 'PRIVATE_FIXTURE_NOT_TO_READ\n');
  const before = readFileSync(resolve(root, '.git/index'));
  const p = cli('diff', ["src/new ' [x].js"]); assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.match(out.rastreados, /working_version/); assert.match(out.staged, /staged_version/);
  assert.deepEqual(out.novos.map(x => x.path), ["src/new ' [x].js"]); assert.equal(out.novos[0].conteudo, 'new_authorized\n');
  assert.deepEqual(out.novosNaoIncluidos, ['local-note.md']); assert.ok(!p.stdout.includes('PRIVATE_FIXTURE_NOT_TO_READ'));
  assert.deepEqual(readFileSync(resolve(root, '.git/index')), before);
}));
test('stage alheio preexistente bloqueia e permanece intacto após adicionar apenas path autorizado', () => fixture(({ root, git, cli }) => {
  writeFileSync(resolve(root, 'outside.md'), 'unrelated\n'); git('add', '--', 'outside.md');
  writeFileSync(resolve(root, 'src/a.js'), 'authorized\n'); git('add', '--', 'src/a.js');
  const before = readFileSync(resolve(root, '.git/index'));
  const p = cli('staged', ['src/a.js']); assert.equal(p.status, 1); const out = JSON.parse(p.stdout);
  assert.equal(out.ok, false); assert.deepEqual(out.foraDoEscopo, ['outside.md']);
  assert.deepEqual(readFileSync(resolve(root, '.git/index')), before);
}));
test('stage usa paths literais: curinga não autoriza arquivo vizinho; exclusão autorizada passa', () => fixture(({ root, git, cli }) => {
  git('rm', '--', 'src/a.js');
  assert.equal(cli('staged', ['src/*.js']).status, 1);
  const p = cli('staged', ['src/a.js']); assert.equal(p.status, 0, p.stderr);
  assert.deepEqual(JSON.parse(p.stdout).paths, ['src/a.js']);
}));
test('stage vazio não autoriza commit e rename exige origem e destino no escopo', () => fixture(({ git, cli }) => {
  assert.equal(cli('staged', ['src/a.js']).status, 1);
  git('mv', '--', 'src/a.js', 'src/b.js');
  assert.equal(cli('staged', ['src/b.js']).status, 1);
  assert.equal(cli('staged', ['src/a.js', 'src/b.js']).status, 0);
}));
test('diff recusa symlink para arquivo externo sem ler conteúdo', () => fixture(({ root, cli }) => {
  const external = resolve(root, '../external-' + root.split('/').at(-1)); writeFileSync(external, 'EXTERNAL_FIXTURE\n');
  try { symlinkSync(external, resolve(root, 'link.txt')); const p = cli('diff', ['link.txt']); assert.equal(p.status, 1); assert.ok(!p.stdout.includes('EXTERNAL_FIXTURE')); }
  finally { rmSync(external); }
}));
test('diff recusa path inválido e cwd sem repo sem produzir diagnóstico de sucesso', () => fixture(({ root, cli }) => {
  for (const paths of [['../outside'], ['/absolute'], ['.git/config'], [''], 'src/a.js']) {
    const p = cli('diff', paths); assert.equal(p.status, 1); assert.equal(p.stdout, '');
  }
  const p = cli('diff', [], tmpdir()); assert.equal(p.status, 1); assert.equal(p.stdout, '');
}));
test('diff diagnostica declarado ignorado ou ausente, mas não confunde deleção já visível no diff', () => fixture(({ root, git, cli }) => {
  writeFileSync(resolve(root, '.gitignore'), 'build/\n'); mkdirSync(resolve(root, 'build'));
  writeFileSync(resolve(root, 'build/output.js'), 'IGNORED_CONTENT_NOT_TO_READ\n');
  git('rm', '--', 'src/a.js');
  const p = cli('diff', ['build/output.js', 'missing.js', 'src/a.js']); assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.deepEqual(out.declaradosNaoInspecionados, ['build/output.js', 'missing.js']);
  assert.ok(!p.stdout.includes('IGNORED_CONTENT_NOT_TO_READ')); assert.match(out.rastreados, /deleted file/);
}));

// 2.6.0: base da entrega. Implementação commitada antes do loop (checkpoint do Solo, run
// anterior) não aparece no diff contra HEAD: auditoria e lentes revisavam só o não commitado.
// `alteracoes` mede o que mudou desde a base para o portão TDD e separa o que a entrega CRIA.
function comImplementacaoCommitada(fn) {
  return fixture(({ root, git, cli }) => {
    const base = git('rev-parse', 'HEAD').trim();
    writeFileSync(resolve(root, 'src/a.js'), 'IMPLEMENTADO_COMMITADO\n');
    writeFileSync(resolve(root, 'src/criado.js'), 'export const criado = 1;\n');
    git('add', '--', 'src/a.js', 'src/criado.js');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'checkpoint');
    mkdirSync(resolve(root, 'tests'));
    writeFileSync(resolve(root, 'tests/a.test.js'), 'teste atual da SPEC\n');
    const raw = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: root, env, encoding: 'utf8', timeout: 10000 });
    return fn({ root, git, cli, raw, base });
  });
}
test('diff com base mostra implementação já commitada que o diff contra HEAD esconde', () => comImplementacaoCommitada(({ raw, base }) => {
  const head = raw('diff', '[]'); assert.equal(head.status, 0, head.stderr);
  const contraHead = JSON.parse(head.stdout);
  assert.doesNotMatch(contraHead.rastreados, /IMPLEMENTADO_COMMITADO/); assert.equal(contraHead.comparadoCom, 'HEAD');
  const p = raw('diff', '[]', base); assert.equal(p.status, 0, p.stderr);
  const contraBase = JSON.parse(p.stdout);
  assert.match(contraBase.rastreados, /\+IMPLEMENTADO_COMMITADO/); assert.match(contraBase.rastreados, /src\/criado\.js/);
  assert.equal(contraBase.comparadoCom, base); assert.equal(contraBase.staged, '', 'staged continua contra HEAD');
}));
test('alteracoes com base lista o commitado desde a base e o não rastreado; sem base, só o não commitado', () => comImplementacaoCommitada(({ root, raw, base }) => {
  const antes = readFileSync(resolve(root, '.git/index'));
  const p = raw('alteracoes', base); assert.equal(p.status, 0, p.stderr);
  const comBase = JSON.parse(p.stdout);
  assert.deepEqual(comBase.alterados, ['src/a.js', 'src/criado.js', 'tests/a.test.js']);
  assert.equal(comBase.comparadoCom, base); assert.equal(comBase.sha, base);
  const s = raw('alteracoes'); assert.equal(s.status, 0, s.stderr);
  const semBase = JSON.parse(s.stdout);
  assert.deepEqual(semBase.alterados, ['tests/a.test.js']); assert.equal(semBase.comparadoCom, 'HEAD');
  assert.deepEqual(readFileSync(resolve(root, '.git/index')), antes, 'índice intacto');
}));
test('alteracoes separa em adicionados o que a base não tem, sem contar modificado nem recriado', () => comImplementacaoCommitada(({ root, git, raw, base }) => {
  // outside.md existe na base: apagado e commitado, depois recriado sem rastrear. Não é criação.
  git('rm', '-q', '--', 'outside.md');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'remove');
  writeFileSync(resolve(root, 'outside.md'), 'recriado\n');
  writeFileSync(resolve(root, 'src/novo-nao-rastreado.js'), 'export const n = 1;\n');
  const out = JSON.parse(raw('alteracoes', base).stdout);
  assert.deepEqual(out.adicionados, ['src/criado.js', 'src/novo-nao-rastreado.js', 'tests/a.test.js']);
  assert.ok(out.alterados.includes('outside.md') && out.alterados.includes('src/a.js'));
}));
test('argumento extra e base malformada, inexistente ou de intervalo saem 1 sem stdout', () => comImplementacaoCommitada(({ raw, base }) => {
  for (const args of [
    ['diff', '[]', base, 'extra'], ['diff', '[]', '-x'], ['diff', '[]', '--output=/tmp/x'], ['diff', '[]', 'HEAD~1..HEAD'], ['diff', '[]', 'HEAD~1 HEAD'], ['diff', '[]', 'naoexiste'],
    ['staged', '["src/a.js"]', 'HEAD'], ['alteracoes', base, 'extra'], ['alteracoes', '-x'], ['alteracoes', 'main...HEAD'], ['alteracoes', '[]'],
    ['outro', '[]'], ['diff'],
  ]) {
    const p = raw(...args);
    assert.equal(p.status, 1, args.join(' ')); assert.equal(p.stdout, '', args.join(' ')); assert.match(p.stderr, /ERRO:/);
  }
}));

test('diff e alteracoes recusam filtros ativos antes de qualquer execução clean/process', () => fixture(({ root, git, cli }) => {
  writeFileSync(resolve(root, '.gitattributes'), 'src/a.js filter=probe\n');
  writeFileSync(resolve(root, 'src/a.js'), 'mudança real\n');
  for (const tipo of ['clean', 'process']) {
    git('config', `filter.probe.${tipo}`, 'echo executado > efeito-filtro; cat');
    for (const modo of ['diff', 'alteracoes']) {
      const p = modo === 'diff' ? cli(modo, ['src/a.js']) : spawnSync(process.execPath, [CLI, modo], { cwd: root, env, encoding: 'utf8' });
      assert.equal(p.status, 1, `${modo}: ${p.stderr}`);
      assert.equal(p.stdout, ''); assert.match(p.stderr, /filtro Git .* ativo/);
      assert.equal(existsSync(resolve(root, 'efeito-filtro')), false);
    }
    git('config', '--unset', `filter.probe.${tipo}`);
  }
}));

test('configuração de filtro sem atributo aplicável não bloqueia inspeção', () => fixture(({ root, git, cli }) => {
  git('config', 'filter.probe.clean', 'echo executado > efeito-filtro; cat');
  writeFileSync(resolve(root, 'src/a.js'), 'mudança real\n');
  const p = cli('diff', ['src/a.js']); assert.equal(p.status, 0, p.stderr);
  assert.match(JSON.parse(p.stdout).rastreados, /mudança real/);
  assert.equal(existsSync(resolve(root, 'efeito-filtro')), false);
}));

test('nomes de driver iguais às sentinelas de check-attr não burlam a guarda', () => fixture(({ root, git, cli }) => {
  writeFileSync(resolve(root, 'src/a.js'), 'mudança real\n');
  for (const nome of ['set', 'unset', 'unspecified']) {
    writeFileSync(resolve(root, '.gitattributes'), `src/a.js filter=${nome}\n`);
    git('config', `filter.${nome}.clean`, 'echo executado > efeito-filtro; cat');
    const p = cli('diff', ['src/a.js']);
    assert.equal(p.status, 1, nome); assert.match(p.stderr, /filtro Git clean ativo/);
    assert.equal(existsSync(resolve(root, 'efeito-filtro')), false, nome);
  }
}));
