import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';

const CLI = resolve(import.meta.dirname, '../../../scripts/verificar-bump.mjs');
const CLAUDE = { raiz: 'plugins/exemplo', manifesto: '.claude-plugin/plugin.json' };
const CODEX = { raiz: 'codex/plugins/exemplo', manifesto: '.codex-plugin/plugin.json' };

function repo(t, pacotes = [CODEX], changelog = '1.0.0') {
  const raiz = mkdtempSync(join(tmpdir(), 'hefesto-bump-'));
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const env = Object.fromEntries(Object.entries(process.env).filter(([nome]) => !nome.startsWith('GIT_')));
  Object.assign(env, {
    GIT_AUTHOR_NAME: 'Fixture', GIT_COMMITTER_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1',
  });
  const git = (...args) => execFileSync('git', [
    '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${devNull}`, ...args,
  ], { cwd: raiz, encoding: 'utf8', env }).trim();
  const escrever = (arquivo, corpo) => {
    mkdirSync(dirname(join(raiz, arquivo)), { recursive: true });
    writeFileSync(join(raiz, arquivo), corpo);
  };
  const pacote = (layout, versao = '1.0.0', changelog = '1.0.0') => {
    escrever(`${layout.raiz}/${layout.manifesto}`, JSON.stringify({ name: 'exemplo', version: versao }));
    escrever(`${layout.raiz}/skills/exemplo/SKILL.md`, 'Conteúdo sintético do plugin.');
    if (changelog !== null) escrever(`${layout.raiz}/CHANGELOG.md`, `# Changelog\n\n## ${changelog}\n\nAlteração sintética.\n`);
  };
  const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); };
  escrever('scripts/.keep', '');
  copyFileSync(CLI, join(raiz, 'scripts/verificar-bump.mjs'));
  for (const layout of pacotes) pacote(layout, '1.0.0', changelog);
  git('init', '-q');
  commit();
  const base = git('rev-parse', 'HEAD');
  const executar = () => {
    commit();
    const r = spawnSync(process.execPath, ['scripts/verificar-bump.mjs', base], {
      cwd: raiz, encoding: 'utf8', env,
    });
    assert.ifError(r.error);
    return { status: r.status, out: r.stdout + r.stderr };
  };
  return { escrever, pacote, executar };
}

test('Codex: alteração publicada sem bump reprova', t => {
  const r = repo(t);
  r.escrever('codex/plugins/exemplo/skills/exemplo/SKILL.md', 'Conteúdo alterado.');
  const resultado = r.executar();
  assert.equal(resultado.status, 1, resultado.out);
  assert.match(resultado.out, /codex\/plugins\/exemplo.*sem bump/);
});

test('Codex: bump sem entrada correspondente no CHANGELOG reprova', t => {
  const r = repo(t);
  r.pacote(CODEX, '1.0.1');
  const resultado = r.executar();
  assert.equal(resultado.status, 1, resultado.out);
  assert.match(resultado.out, /codex\/plugins\/exemplo.*sem entrada.*1\.0\.1/);
});

test('Codex: bump com entrada correspondente no CHANGELOG passa', t => {
  const r = repo(t);
  r.pacote(CODEX, '1.0.1', '1.0.1');
  const resultado = r.executar();
  assert.equal(resultado.status, 0, resultado.out);
  assert.match(resultado.out, /codex\/plugins\/exemplo.*todos com bump/);
});

test('alterações somente em tests/ continuam isentas nas duas distribuições', t => {
  const r = repo(t, [CLAUDE, CODEX]);
  r.escrever('plugins/exemplo/tests/integracao/exemplo.test.mjs', 'fixture Claude');
  r.escrever('codex/plugins/exemplo/tests/integracao/exemplo.test.mjs', 'fixture Codex');
  const resultado = r.executar();
  assert.equal(resultado.status, 0, resultado.out);
  assert.match(resultado.out, /nenhum plugin tocado/);
});

test('bump de pacote homônimo em uma distribuição não dispensa bump na outra', t => {
  for (const [comBump, semBump] of [[CLAUDE, CODEX], [CODEX, CLAUDE]]) {
    const r = repo(t, [CLAUDE, CODEX]);
    r.pacote(comBump, '1.0.1', '1.0.1');
    r.escrever(`${semBump.raiz}/skills/exemplo/SKILL.md`, 'Conteúdo alterado sem bump.');
    const resultado = r.executar();
    assert.equal(resultado.status, 1, resultado.out);
    const falhas = resultado.out.split('\n').filter(linha => linha.includes('alterado sem bump'));
    assert.equal(falhas.length, 1, resultado.out);
    assert.ok(falhas[0].trimStart().startsWith(`${semBump.raiz} —`), resultado.out);
  }
});

test('Claude: alteração publicada sem bump continua reprovando', t => {
  const r = repo(t, [CLAUDE]);
  r.escrever('plugins/exemplo/skills/exemplo/SKILL.md', 'Conteúdo alterado.');
  const resultado = r.executar();
  assert.equal(resultado.status, 1, resultado.out);
  assert.match(resultado.out, /alterado sem bump/);
});

test('Claude: bump sem entrada correspondente no CHANGELOG continua reprovando', t => {
  const r = repo(t, [CLAUDE]);
  r.pacote(CLAUDE, '1.0.1');
  const resultado = r.executar();
  assert.equal(resultado.status, 1, resultado.out);
  assert.match(resultado.out, /sem entrada.*1\.0\.1/);
});

test('Claude: bump com entrada correspondente no CHANGELOG continua passando', t => {
  const r = repo(t, [CLAUDE]);
  r.pacote(CLAUDE, '1.0.1', '1.0.1');
  const resultado = r.executar();
  assert.equal(resultado.status, 0, resultado.out);
  assert.match(resultado.out, /todos com bump/);
});

test('plugin novo não exige versão anterior mesmo com homônimo na outra distribuição', t => {
  for (const [existente, novo] of [[CLAUDE, CODEX], [CODEX, CLAUDE]]) {
    const r = repo(t, [existente]);
    r.pacote(novo);
    const resultado = r.executar();
    assert.equal(resultado.status, 0, resultado.out);
    assert.match(resultado.out, /todos com bump/);
  }
});

test('CHANGELOG continua opt-in para plugins existentes nas duas distribuições', t => {
  for (const layout of [CLAUDE, CODEX]) {
    const r = repo(t, [layout], null);
    r.pacote(layout, '1.0.1', null);
    const resultado = r.executar();
    assert.equal(resultado.status, 0, resultado.out);
    assert.match(resultado.out, /todos com bump/);
  }
});
