// Cópia descartável da base (`copia-base.mjs`, retomada tardia com vermelhoNaBase) contra
// repositórios Git reais e descartáveis. Nenhuma conta, remoto ou hook pessoal. Mede o EFEITO:
// a cópia tem o código da base e os testes atuais, a worktree, o índice e as refs do projeto
// ficam intactos, e nenhuma falha deixa cópia órfã ou escreve fora dela. `alteracoes` e `diff`
// com base ficam em `inspecionar-git.test.mjs`; a impressão, em `impressao-worktree.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPTS = resolve(import.meta.dirname, '../skills/dev-loop/scripts');
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
const node = (cwd, script, ...args) => spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { cwd, env, encoding: 'utf8', timeout: 30000 });

function repo(t) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-repo-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => { const p = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' }); assert.equal(p.status, 0, p.stderr); return p.stdout.trim(); };
  const commit = msg => git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', msg);
  git('init', '-q'); mkdirSync(join(root, 'src')); mkdirSync(join(root, 'tests'));
  writeFileSync(join(root, 'src/soma.js'), 'export const soma = (a, b) => a - b;\n');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.cache/\n');
  git('add', '.'); commit('base com defeito');
  const base = git('rev-parse', 'HEAD');
  // Implementação JÁ commitada antes do portão (retomada tardia) + teste novo não rastreado.
  writeFileSync(join(root, 'src/soma.js'), 'export const soma = (a, b) => a + b;\n');
  git('add', '.'); commit('implementação anterior ao portão');
  writeFileSync(join(root, 'tests/soma.test.js'), 'teste atual da SPEC\n');
  return { root, git, base };
}

test('copia-base materializa a base com os testes atuais, devolve hashes e não toca worktree, índice nem refs', t => {
  const { root, git, base } = repo(t);
  const antes = { index: readFileSync(join(root, '.git/index')), head: git('rev-parse', 'HEAD'), status: git('status', '--porcelain') };
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-pai-')));
  t.after(() => rmSync(pai, { recursive: true, force: true }));
  mkdirSync(join(root, 'node_modules'));
  const p = node(root, 'copia-base.mjs', 'criar', base, JSON.stringify(['tests/soma.test.js']), '--pai', pai, '--vincular', JSON.stringify(['node_modules', 'inexistente']));
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.equal(out.sha, base);
  assert.ok(out.dir.startsWith(pai));
  assert.equal(readFileSync(join(out.dir, 'src/soma.js'), 'utf8'), 'export const soma = (a, b) => a - b;\n', 'a cópia tem o código da BASE, não a implementação');
  assert.equal(readFileSync(join(out.dir, 'tests/soma.test.js'), 'utf8'), 'teste atual da SPEC\n');
  assert.deepEqual(out.vinculados, ['node_modules']);
  const hashWorktree = JSON.parse(node(root, 'hashes-testes.mjs', JSON.stringify(['tests/soma.test.js'])).stdout);
  assert.deepEqual(out.hashesDosTestes, hashWorktree, 'mesmo formato e mesmos bytes da worktree');
  assert.ok(antes.index.equals(readFileSync(join(root, '.git/index'))), 'índice do projeto intacto');
  assert.equal(git('rev-parse', 'HEAD'), antes.head);
  assert.equal(git('status', '--porcelain'), antes.status, 'worktree intacta');
  assert.equal(git('worktree', 'list').split('\n').length, 1, 'nenhuma worktree registrada no repositório');

  const r = node(root, 'copia-base.mjs', 'remover', out.dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(out.dir));
  assert.ok(existsSync(join(root, 'node_modules')), 'remover a cópia não apaga o alvo do symlink');
});

test('copia-base recusa ref inválida, opção desconhecida e diretório pai dentro do workspace não ignorado', t => {
  const { root, base } = repo(t);
  for (const args of [
    ['criar', '--upload-pack=x', '["tests/soma.test.js"]'],
    ['criar', 'naoexiste', '["tests/soma.test.js"]'],
    ['criar', base, '["../fora.js"]'],
    ['criar', base, '["tests/soma.test.js"]', '--pai'],
    ['criar', base, '["tests/soma.test.js"]', '--outra', 'x'],
    ['criar', base, '["tests/soma.test.js"]', '--pai', join(root, 'src')],
  ]) {
    const p = node(root, 'copia-base.mjs', ...args);
    assert.equal(p.status, 1, `${args.join(' ')} deveria falhar`);
    assert.match(p.stderr, /ERRO:/);
  }
  mkdirSync(join(root, '.cache'));
  const ok = node(root, 'copia-base.mjs', 'criar', base, '["tests/soma.test.js"]', '--pai', join(root, '.cache'));
  assert.equal(ok.status, 0, `diretório ignorado dentro do workspace é aceito: ${ok.stderr}`);
});

test('copia-base com diretório pai sem escrita diz qual path e que é ambiente', t => {
  if (process.getuid?.() === 0) {
    // root ignora permissão de diretório: medir o EFEITO com um pai inexistente, que falha igual
    // para qualquer usuário e exercita a mesma mensagem de diagnóstico.
    const { root, base } = repo(t);
    const p = node(root, 'copia-base.mjs', 'criar', base, '["tests/soma.test.js"]', '--pai', join(root, 'nao-existe'));
    assert.equal(p.status, 1);
    assert.match(p.stderr, /não existe: .*nao-existe/);
    return;
  }
  const { root, base } = repo(t);
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-ro-')));
  t.after(() => { chmodSync(pai, 0o700); rmSync(pai, { recursive: true, force: true }); });
  chmodSync(pai, 0o500);
  const p = node(root, 'copia-base.mjs', 'criar', base, '["tests/soma.test.js"]', '--pai', pai);
  assert.equal(p.status, 1);
  assert.match(p.stderr, /não é gravável: .*EACCES.*ambiente/);
});

test('remover só apaga diretório criado pelo helper', t => {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-nao-copia-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'importante.txt'), 'x');
  const p = node(dir, 'copia-base.mjs', 'remover', dir);
  assert.equal(p.status, 1);
  assert.ok(existsSync(join(dir, 'importante.txt')));
});

test('copia-base sobrepõe arquivos de apoio do portão sem incluí-los nos hashes protegidos', t => {
  const { root, base } = repo(t);
  mkdirSync(join(root, 'tests/helpers'));
  writeFileSync(join(root, 'tests/helpers/fabrica.js'), 'export const fabrica = () => 1;\n');
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-apoio-')));
  t.after(() => rmSync(pai, { recursive: true, force: true }));
  const p = node(root, 'copia-base.mjs', 'criar', base, '["tests/soma.test.js"]', '--pai', pai, '--apoio', '["tests/helpers/fabrica.js"]');
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  assert.equal(readFileSync(join(out.dir, 'tests/helpers/fabrica.js'), 'utf8'), 'export const fabrica = () => 1;\n');
  assert.deepEqual(out.apoio, ['tests/helpers/fabrica.js']);
  assert.deepEqual(Object.keys(out.hashesDosTestes), ['tests/soma.test.js']);
  assert.equal(node(root, 'copia-base.mjs', 'criar', base, '["tests/soma.test.js"]', '--apoio', '["../fora.js"]').status, 1);
});

// Achados da lente de segurança (revisão adversarial do diff).
test('copia-base não escreve através de symlink commitado na base (nem absoluto para dentro do workspace)', t => {
  const { root, git } = repo(t);
  const commit = msg => git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', msg);
  // Base nova onde tests/ é symlink absoluto para spec/ (rastreado); depois a worktree volta a ter tests/ real.
  mkdirSync(join(root, 'spec')); writeFileSync(join(root, 'spec/soma.test.js'), 'rastreado original\n');
  rmSync(join(root, 'tests'), { recursive: true, force: true });
  symlinkSync(join(root, 'spec'), join(root, 'tests'));
  git('add', '-A'); commit('base com symlink');
  const baseLink = git('rev-parse', 'HEAD');
  rmSync(join(root, 'tests')); mkdirSync(join(root, 'tests')); writeFileSync(join(root, 'tests/soma.test.js'), 'teste novo\n');
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-link-')));
  t.after(() => rmSync(pai, { recursive: true, force: true }));
  const p = node(root, 'copia-base.mjs', 'criar', baseLink, '["tests/soma.test.js"]', '--pai', pai);
  assert.equal(p.status, 1, p.stdout);
  assert.match(p.stderr, /symlink/);
  assert.equal(readFileSync(join(root, 'spec/soma.test.js'), 'utf8'), 'rastreado original\n', 'arquivo rastreado do workspace intacto');
  assert.deepEqual(readdirSync(pai), [], 'falha depois de criar a cópia não deixa a base para trás');
});

test('copia-base com teste inexistente falha antes de criar a cópia', t => {
  const { root, base } = repo(t);
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-orfa-')));
  t.after(() => rmSync(pai, { recursive: true, force: true }));
  assert.equal(node(root, 'copia-base.mjs', 'criar', base, '["tests/nao-existe.test.js"]', '--pai', pai).status, 1);
  assert.deepEqual(readdirSync(pai), []);
});

test('git dentro da cópia não alcança o repositório do workspace, mesmo com --pai ignorado dentro dele', t => {
  const { root, base } = repo(t);
  mkdirSync(join(root, '.cache'));
  const out = JSON.parse(node(root, 'copia-base.mjs', 'criar', base, '["tests/soma.test.js"]', '--pai', join(root, '.cache')).stdout);
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: out.dir, env, encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'git falha dentro da cópia em vez de subir ao workspace');
});


test('TMPDIR dentro do workspace e não ignorado é recusado, e a mensagem nomeia o TMPDIR', t => {
  const { root, base } = repo(t);
  mkdirSync(join(root, 'tmp-local'));
  const p = spawnSync(process.execPath, [join(SCRIPTS, 'copia-base.mjs'), 'criar', base, '["tests/soma.test.js"]'], { cwd: root, env: { ...env, TMPDIR: join(root, 'tmp-local') }, encoding: 'utf8', timeout: 30000 });
  assert.equal(p.status, 1, p.stdout);
  assert.match(p.stderr, /TMPDIR.*ignorado pelo Git/);
  assert.doesNotMatch(p.stderr, /^ERRO: --pai/);
  assert.deepEqual(readdirSync(join(root, 'tmp-local')), [], 'nenhuma cópia criada dentro do workspace');
});

test('bloqueador Git permanece inválido mesmo com metadata de repositório na base', t => {
  const { root, git } = repo(t);
  mkdirSync(join(root, '.odin-copia-base-sem-repositorio'));
  writeFileSync(join(root, '.odin-copia-base-sem-repositorio/HEAD'), git('rev-parse', 'HEAD') + '\n');
  writeFileSync(join(root, '.odin-copia-base-sem-repositorio/commondir'), join(root, '.git') + '\n');
  git('add', '.odin-copia-base-sem-repositorio');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'metadata na base');
  const p = node(root, 'copia-base.mjs', 'criar', 'HEAD', '["tests/soma.test.js"]');
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  t.after(() => rmSync(out.dir, { recursive: true, force: true }));
  const r = spawnSync('git', ['update-ref', 'refs/heads/escape', git('rev-parse', 'HEAD')], { cwd: out.dir, env, encoding: 'utf8' });
  assert.notEqual(r.status, 0, r.stdout);
  assert.equal(git('for-each-ref', '--format=%(refname)', 'refs/heads/escape'), '');
});

test('materializar blobs não executa smudge/process e preserva bytes binários e modo executável', t => {
  const { root, git } = repo(t);
  writeFileSync(join(root, '.gitattributes'), '*.bin filter=probe\n');
  const bytes = Buffer.from([0, 255, 128, 13, 10]);
  writeFileSync(join(root, 'programa.bin'), bytes); chmodSync(join(root, 'programa.bin'), 0o755);
  git('add', '.gitattributes', 'programa.bin');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'blob binário');
  for (const tipo of ['smudge', 'process']) {
    git('config', `filter.probe.${tipo}`, 'echo executado > efeito-filtro; cat');
    const p = node(root, 'copia-base.mjs', 'criar', 'HEAD', '["tests/soma.test.js"]');
    assert.equal(p.status, 0, p.stderr);
    const out = JSON.parse(p.stdout); t.after(() => rmSync(out.dir, { recursive: true, force: true }));
    assert.equal(existsSync(join(root, 'efeito-filtro')), false, tipo);
    assert.deepEqual(readFileSync(join(out.dir, 'programa.bin')), bytes);
    // O teste real de modo usa o filesystem, não saída de diff.
    assert.ok((statSync(join(out.dir, 'programa.bin')).mode & 0o111) !== 0);
  }
});

test('marca reservada na base é recusada sem sobrescrever metadata nem deixar cópia órfã', t => {
  const { root, git } = repo(t);
  writeFileSync(join(root, '.odin-copia-base'), '{}'); git('add', '.odin-copia-base');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'colisão');
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-reserva-')));
  t.after(() => rmSync(pai, { recursive: true, force: true }));
  const p = node(root, 'copia-base.mjs', 'criar', 'HEAD', '["tests/soma.test.js"]', '--pai', pai);
  assert.equal(p.status, 1); assert.deepEqual(readdirSync(pai), []);
});
