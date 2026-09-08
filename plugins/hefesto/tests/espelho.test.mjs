import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import test from 'node:test';

const CLI = resolve(import.meta.dirname, '../../../scripts/espelho.mjs');
const POLICY = 'scripts/espelho-publico.json';
const policy = { arquivos: ['README.md'], internos: [POLICY, 'docs/interno/'], proibidos: ['segredo-fixture'], excecoes: { marca: ['README.md'] } };
function run(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}
function repo(t, extra = {}) {
  const base = mkdtempSync(join(tmpdir(), 'hefesto-espelho-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const src = join(base, 'src'); mkdirSync(src);
  for (const [name, body] of Object.entries({ 'README.md': 'conteúdo público', [POLICY]: JSON.stringify(policy), ...extra })) {
    mkdirSync(join(src, name, '..'), { recursive: true }); writeFileSync(join(src, name), body);
  }
  const git = (...args) => execFileSync('git', ['-C', src, ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_COMMITTER_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_EMAIL: 'test@example.invalid' } });
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'fixture');
  return { src, git, stage: join(base, 'stage'), config: join(src, POLICY) };
}
test('exporta somente inventário aprovado do commit, sem ler edição local nem docs internos', t => {
  const { src, git, stage } = repo(t, { 'docs/interno/nota.md': 'segredo-fixture' });
  writeFileSync(join(src, 'README.md'), 'edição local');
  const r = run('exportar', src, git('rev-parse', 'HEAD').trim(), stage);
  assert.equal(r.status, 0, r.out);
  assert.equal(readFileSync(join(stage, 'README.md'), 'utf8'), 'conteúdo público');
  assert.equal(existsSync(join(stage, 'docs')), false);
  assert.equal(existsSync(join(stage, POLICY)), false);
});
test('arquivo novo não classificado aborta antes de criar stage', t => {
  const { src, git, stage } = repo(t, { 'anotacao.md': 'pessoal' });
  const r = run('exportar', src, git('rev-parse', 'HEAD').trim(), stage);
  assert.equal(r.status, 1, r.out); assert.match(r.out, /não classificado/);
  assert.equal(existsSync(stage), false);
});
test('inventário com arquivo ausente ou traversal é recusado', t => {
  for (const arquivos of [['sumiu.md'], ['../escape.md']]) {
    const { src, git, stage } = repo(t, { [POLICY]: JSON.stringify({ ...policy, arquivos }) });
    const r = run('exportar', src, git('rev-parse', 'HEAD').trim(), stage);
    assert.equal(r.status, 1, r.out); assert.match(r.out, /inventário|caminho/);
    assert.equal(existsSync(stage), false);
  }
});
test('symlink versionado é recusado antes de exportar', t => {
  const { src, git, stage } = repo(t);
  rmSync(join(src, 'README.md')); symlinkSync('../fora.md', join(src, 'README.md'));
  git('add', '.'); git('commit', '-qm', 'link');
  const r = run('exportar', src, git('rev-parse', 'HEAD').trim(), stage);
  assert.equal(r.status, 1, r.out); assert.match(r.out, /regular/);
});
test('guard aceita stage limpo e exceção somente no caminho aprovado', t => {
  const { stage, config } = repo(t); mkdirSync(stage);
  writeFileSync(join(stage, 'README.md'), 'marca');
  assert.equal(run('verificar', stage, config).status, 0);
  writeFileSync(join(stage, 'README.md'), 'segredo-fixture');
  const r = run('verificar', stage, config);
  assert.equal(r.status, 1); assert.match(r.out, /conteúdo proibido/);
  assert.ok(!r.out.includes('segredo-fixture'), 'diagnóstico não imprime o conteúdo sensível');
});
test('guard falha em stage ausente, vazio, arquivo extra e symlink', t => {
  const { stage, config } = repo(t);
  assert.equal(run('verificar', stage, config).status, 1);
  mkdirSync(stage);
  assert.equal(run('verificar', stage, config).status, 1);
  writeFileSync(join(stage, 'README.md'), 'ok');
  writeFileSync(join(stage, 'extra.md'), 'marca');
  assert.equal(run('verificar', stage, config).status, 1);
  rmSync(join(stage, 'extra.md')); rmSync(join(stage, 'README.md'));
  symlinkSync('ausente', join(stage, 'README.md'));
  assert.equal(run('verificar', stage, config).status, 1);
});
test('erro de leitura durante varredura reprova em vez de equivaler a conteúdo limpo', t => {
  const { stage, config } = repo(t); mkdirSync(stage);
  mkdirSync(join(stage, 'README.md'));
  const r = run('verificar', stage, config);
  assert.equal(r.status, 1); assert.match(r.out, /regular|inventário/);
});

test('erro operacional EACCES ao ler arquivo fecha o guard', { skip: process.getuid?.() === 0 }, t => {
  const { stage, config } = repo(t); mkdirSync(stage);
  const arquivo = join(stage, 'README.md');
  writeFileSync(arquivo, 'ok'); chmodSync(arquivo, 0);
  try {
    const r = run('verificar', stage, config);
    assert.equal(r.status, 1); assert.match(r.out, /EACCES/);
  } finally { chmodSync(arquivo, 0o600); }
});

test('arquivo gerado pelo scrub é aprovado somente depois de existir no stage', t => {
  const { src, git, stage, config } = repo(t, { [POLICY]: JSON.stringify({ ...policy, gerados: ['nota-publica.md'] }) });
  assert.equal(run('exportar', src, git('rev-parse', 'HEAD').trim(), stage).status, 0);
  assert.equal(run('verificar', stage, config).status, 1, 'scrub ainda não criou arquivo obrigatório');
  writeFileSync(join(stage, 'nota-publica.md'), 'espelho público');
  const r = run('verificar', stage, config);
  assert.equal(r.status, 0, r.out);
});
