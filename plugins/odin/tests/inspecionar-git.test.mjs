// Repositórios reais descartáveis. Nenhuma conta, remoto ou hook pessoal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
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
