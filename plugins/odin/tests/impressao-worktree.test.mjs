// Impressão da worktree (`hashes-testes.mjs --impressao`): a evidência que permite ao harness
// reaproveitar uma validação longa sem mudança que torne a nova execução informativa.
//
// Mede o EFEITO contra Git real: a mesma árvore dá a mesma impressão; mudar arquivo rastreado ou
// criar arquivo não rastreado muda; arquivo ignorado e staging sem mudança de conteúdo não
// mudam. A conferência é verificada com o zlib do Node, oráculo independente do CRC do script.

import assert from 'node:assert/strict';
import { appendFileSync, existsSync, renameSync, chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import test from 'node:test';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dev-loop', 'scripts', 'hashes-testes.mjs');
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };

function repo(t) {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-impressao-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  return { dir, git };
}

function commitar(git) {
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
}

function impressao(dir) {
  const r = spawnSync(process.execPath, [SCRIPT, '--impressao'], { cwd: dir, env: ENV, encoding: 'utf8', timeout: 20000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function valor(dir) {
  const r = impressao(dir);
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(json), ['impressao']);
  return json.impressao;
}

function base(t) {
  const { dir, git } = repo(t);
  git('init', '-q');
  writeFileSync(resolve(dir, '.gitignore'), 'ignorado.log\n');
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 1;\n');
  git('add', '--', '.gitignore', 'a.js');
  commitar(git);
  return { dir, git };
}

test('impressão tem o formato <sha256>-<conferência> e a conferência é CRC-32 de "worktree\\n<sha>"', (t) => {
  const { dir } = base(t);
  const v = valor(dir);
  const m = /^([a-f0-9]{64})-([a-f0-9]{8})$/.exec(v);
  assert.ok(m, v);
  assert.equal(m[2], (crc32(`worktree\n${m[1]}`) >>> 0).toString(16).padStart(8, '0'));
});

test('a mesma árvore dá a mesma impressão em execuções seguidas', (t) => {
  const { dir } = base(t);
  assert.equal(valor(dir), valor(dir));
});

test('mudança em arquivo rastreado muda a impressão, e desfazê-la restaura o valor', (t) => {
  const { dir } = base(t);
  const limpa = valor(dir);
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 2;\n');
  const suja = valor(dir);
  assert.notEqual(suja, limpa);
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 1;\n');
  assert.equal(valor(dir), limpa);
});

test('arquivo novo não rastreado muda a impressão; removê-lo restaura', (t) => {
  const { dir } = base(t);
  const limpa = valor(dir);
  writeFileSync(resolve(dir, 'novo.js'), 'export const n = 1;\n');
  const comNovo = valor(dir);
  assert.notEqual(comNovo, limpa);
  writeFileSync(resolve(dir, 'novo.js'), 'export const n = 2;\n');
  assert.notEqual(valor(dir), comNovo, 'o conteúdo do não rastreado entra, não só o nome');
  unlinkSync(resolve(dir, 'novo.js'));
  assert.equal(valor(dir), limpa);
});

test('arquivo ignorado não muda a impressão', (t) => {
  const { dir } = base(t);
  const limpa = valor(dir);
  writeFileSync(resolve(dir, 'ignorado.log'), 'ruído local\n');
  assert.equal(valor(dir), limpa);
});

test('staging sem mudança de conteúdo não muda a impressão', (t) => {
  const { dir, git } = base(t);
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 3;\n');
  const naoEncenada = valor(dir);
  git('add', '--', 'a.js');
  assert.equal(valor(dir), naoEncenada);
});

test('commit novo muda a impressão mesmo com a worktree limpa', (t) => {
  const { dir, git } = base(t);
  const antes = valor(dir);
  writeFileSync(resolve(dir, 'b.js'), 'export const b = 1;\n');
  git('add', '--', 'b.js');
  commitar(git);
  assert.notEqual(valor(dir), antes);
});

test('repositório sem HEAD não tem impressão: sai 1 sem stdout', (t) => {
  const { dir, git } = repo(t);
  git('init', '-q');
  writeFileSync(resolve(dir, 'a.js'), 'x\n');
  const r = impressao(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /HEAD/);
});

test('o modo padrão do script (hashes de testes por path) continua igual', (t) => {
  const { dir } = base(t);
  const r = spawnSync(process.execPath, [SCRIPT, JSON.stringify(['a.js'])], { cwd: dir, env: ENV, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(json), ['a.js']);
  assert.match(json['a.js'], /^[a-f0-9]{64}-[a-f0-9]{8}$/);
});

// Iteração 2 (revisão adversarial): mudança que `git diff HEAD` não mostra não pode deixar a
// impressão igual. Onde a árvore tem algo que o diff não enxerga, o script falha fechado (exit 1,
// sem stdout): sem impressão não há reuso, e a validação longa roda.

test('repositório git aninhado e não rastreado não tem impressão: falha fechada, sem EISDIR', (t) => {
  const { dir, git } = base(t);
  const sub = resolve(dir, 'vendor');
  spawnSync('git', ['init', '-q', sub], { env: ENV });
  writeFileSync(resolve(sub, 'x.js'), 'x\n');
  const r = impressao(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /aninhad/);
  assert.doesNotMatch(r.stderr, /EISDIR/);
});

test('submódulo no índice não tem impressão: o diff só mostraria o marcador -dirty', (t) => {
  const { dir, git } = base(t);
  git('update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},lib`);
  const r = impressao(dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /subm[oó]dulo/);
});

test('arquivo com assume-unchanged ou skip-worktree não tem impressão', (t) => {
  for (const bit of ['--assume-unchanged', '--skip-worktree']) {
    const { dir, git } = base(t);
    git('update-index', bit, 'a.js');
    writeFileSync(resolve(dir, 'a.js'), 'export const a = 99;\n');
    const r = impressao(dir);
    assert.equal(r.status, 1, bit);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /assume-unchanged|skip-worktree/);
  }
});

// fsmonitor que perde evento (daemon em FS de rede, evento descartado) marca a entrada como válida
// e o `git diff HEAD` deixa de olhar o arquivo. O hook aqui mente de propósito: devolve o token e
// nenhum path. Com a config do repositório valendo, a impressão não muda e a suíte longa seria
// reaproveitada sobre código alterado; o script fixa core.fsmonitor=false, como os outros dois.
test('fsmonitor que perde evento não esconde arquivo rastreado alterado da impressão', (t) => {
  const { dir, git } = base(t);
  const fora = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-fsmonitor-')));
  t.after(() => rmSync(fora, { recursive: true, force: true }));
  const hook = resolve(fora, 'hook.sh');
  writeFileSync(hook, '#!/bin/sh\nprintf \'%s\\0\' "$2"\n');
  chmodSync(hook, 0o755);
  git('config', 'core.fsmonitor', hook);
  git('config', 'core.fsmonitorHookVersion', '2');
  git('update-index', '--fsmonitor');
  const { GIT_OPTIONAL_LOCKS: _semLock, ...comEscrita } = ENV;
  assert.equal(spawnSync('git', ['status', '--porcelain'], { cwd: dir, env: comEscrita, encoding: 'utf8', timeout: 10000 }).status, 0);
  const limpa = valor(dir);
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 2;\n');
  assert.equal(git('status', '--porcelain'), '', 'pré-condição: o git com o fsmonitor mentiroso não vê a mudança');
  assert.notEqual(valor(dir), limpa);
});

// 2.6.0: lista de excluídos. O fluxo grava o relatório no Log da SPEC e as pendências DEPOIS da
// validação; sem exclusão a impressão mudava só por isso e o reuso nunca conferia. A lista entra
// no hash, diretório é recusado e o cwd num subdiretório não encolhe o que a impressão cobre.

function impressaoCom(dir, excluidos, env = ENV) {
  const r = spawnSync(process.execPath, [SCRIPT, '--impressao', JSON.stringify(excluidos)], { cwd: dir, env, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout).impressao;
}

function comSpec(t) {
  const { dir, git } = base(t);
  mkdirSync(resolve(dir, 'docs/plans'), { recursive: true });
  writeFileSync(resolve(dir, 'docs/plans/spec.md'), '## SPEC\n\n## Log de execução\n');
  git('add', '--', 'docs/plans/spec.md');
  commitar(git);
  return { dir, git };
}

const EXCL = ['docs/pendencias.md', 'docs/plans/spec.md'];

test('excluídos: Log gravado na SPEC e pendências criadas não mudam a impressão; sem a lista, mudam', (t) => {
  const { dir } = comSpec(t);
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 2;\n');
  const comLista = impressaoCom(dir, EXCL);
  const semLista = valor(dir);
  appendFileSync(resolve(dir, 'docs/plans/spec.md'), '- [Step 7] relatório do dev-loop: verde\n');
  writeFileSync(resolve(dir, 'docs/pendencias.md'), '- pendência registrada depois do verde\n');
  assert.equal(impressaoCom(dir, EXCL), comLista, 'gravar Log e pendências não invalida a validação');
  assert.notEqual(valor(dir), semLista, 'sem a lista, as mesmas gravações mudam a impressão');
});

test('excluídos: mudança fora da lista continua mudando a impressão', (t) => {
  const { dir } = comSpec(t);
  const antes = impressaoCom(dir, EXCL);
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 3;\n');
  const rastreado = impressaoCom(dir, EXCL);
  assert.notEqual(rastreado, antes, 'edição rastreada');
  writeFileSync(resolve(dir, 'docs/outro.md'), 'novo\n');
  assert.notEqual(impressaoCom(dir, EXCL), rastreado, 'arquivo novo fora da lista');
});

test('a lista entra no hash: com e sem lista diferem, listas diferentes diferem, lista vazia é igual a sem lista', (t) => {
  const { dir } = comSpec(t);
  const sem = valor(dir);
  const com = impressaoCom(dir, EXCL);
  assert.notEqual(com, sem);
  assert.notEqual(impressaoCom(dir, ['docs/plans/spec.md']), com);
  assert.equal(impressaoCom(dir, [...EXCL].reverse()), com, 'ordem da lista não importa');
  assert.equal(impressaoCom(dir, []), sem);
});

test('excluído inválido ou que é diretório sai 1 sem stdout', (t) => {
  const { dir, git } = comSpec(t);
  mkdirSync(resolve(dir, 'src'));
  writeFileSync(resolve(dir, 'src/b.js'), 'export const b = 1;\n');
  git('add', '--', 'src/b.js');
  commitar(git);
  const rodar = (...extra) => spawnSync(process.execPath, [SCRIPT, '--impressao', ...extra], { cwd: dir, env: ENV, encoding: 'utf8', timeout: 20000 });
  for (const lista of [['../fora.md'], ['/abs/spec.md'], ['.'], ['src/'], ['src'], ['docs'], ['a:b.md'], ['.git/config'], [''], [' docs/plans/spec.md'], [1], 'docs/plans/spec.md']) {
    const r = rodar(JSON.stringify(lista));
    assert.equal(r.status, 1, JSON.stringify(lista));
    assert.equal(r.stdout, '', JSON.stringify(lista));
  }
  assert.equal(rodar(JSON.stringify(EXCL), 'extra').status, 1, 'argumento depois da lista');
  // Diretório que só existe no HEAD (apagado da worktree e do índice) continua diretório.
  git('rm', '-rq', '--', 'src');
  const r = rodar(JSON.stringify(['src']));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /diretório/);
});

test('cwd num subdiretório (monorepo): mudança fora dele muda a impressão, e o excluído é relativo ao cwd', (t) => {
  const { dir, git } = base(t);
  mkdirSync(resolve(dir, 'apps/web/docs'), { recursive: true });
  mkdirSync(resolve(dir, 'libs'));
  writeFileSync(resolve(dir, 'apps/web/docs/spec.md'), '## SPEC\n');
  writeFileSync(resolve(dir, 'libs/comum.js'), 'export const c = 1;\n');
  git('add', '--', 'apps', 'libs');
  commitar(git);
  const web = resolve(dir, 'apps/web');
  const excl = ['docs/spec.md'];
  const inicial = impressaoCom(web, excl);
  appendFileSync(resolve(web, 'docs/spec.md'), '## Log de execução\n- [Step 7] verde\n');
  assert.equal(impressaoCom(web, excl), inicial, 'Log da SPEC excluída, path relativo ao cwd');
  writeFileSync(resolve(dir, 'libs/comum.js'), 'export const c = 2;\n');
  const lib = impressaoCom(web, excl);
  assert.notEqual(lib, inicial, 'rastreado fora do cwd');
  writeFileSync(resolve(dir, 'libs/nova.js'), 'export const n = 1;\n');
  assert.notEqual(impressaoCom(web, excl), lib, 'não rastreado fora do cwd');
});

test('GIT_LITERAL_PATHSPECS no ambiente não desliga a exclusão nem esconde mudança', (t) => {
  const { dir } = comSpec(t);
  const literal = { ...ENV, GIT_LITERAL_PATHSPECS: '1' };
  const antes = impressaoCom(dir, EXCL);
  assert.equal(impressaoCom(dir, EXCL, literal), antes);
  appendFileSync(resolve(dir, 'docs/plans/spec.md'), '- [Step 7] verde\n');
  assert.equal(impressaoCom(dir, EXCL, literal), antes, 'a exclusão continua valendo');
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 4;\n');
  assert.notEqual(impressaoCom(dir, EXCL, literal), antes, 'a mudança de código continua visível');
});

// Segunda lista (revisão adversarial do porte): o arquivo de pendências sai SÓ da lista de não
// rastreados, por igualdade exata, nunca por pathspec no diff. Antes, um `pendenciasPath` que
// apontava para código rastreado saía do `git diff HEAD` e a validação longa era reaproveitada
// sobre código alterado. Pendência rastreada, symlink ou diretório: a impressão é recusada.

function impressaoDuas(dir, diff, naoRastreados) {
  const r = spawnSync(process.execPath, [SCRIPT, '--impressao', JSON.stringify(diff), JSON.stringify(naoRastreados)], { cwd: dir, env: ENV, encoding: 'utf8', timeout: 20000 });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function valorDuas(dir, diff, naoRastreados) {
  const r = impressaoDuas(dir, diff, naoRastreados);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout).impressao;
}
const SO_SPEC = ['docs/plans/spec.md'];
const SO_PEND = ['docs/pendencias.md'];

test('pendências na segunda lista: gravá-las depois do verde não muda a impressão; mudar código muda', (t) => {
  const { dir } = comSpec(t);
  const antes = valorDuas(dir, SO_SPEC, SO_PEND);
  appendFileSync(resolve(dir, 'docs/plans/spec.md'), '- [Step 7] relatório do dev-loop: verde\n');
  writeFileSync(resolve(dir, 'docs/pendencias.md'), '- pendência registrada depois do verde\n');
  assert.equal(valorDuas(dir, SO_SPEC, SO_PEND), antes, 'Log e pendências não invalidam a validação');
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 5;\n');
  assert.notEqual(valorDuas(dir, SO_SPEC, SO_PEND), antes, 'código rastreado continua visível');
});

test('pendências rastreadas (HEAD ou índice), symlink ou diretório: a impressão é recusada em vez de esconder código', (t) => {
  const { dir, git } = comSpec(t);
  mkdirSync(resolve(dir, 'src'));
  writeFileSync(resolve(dir, 'src/b.js'), 'export const b = 1;\n');
  git('add', '--', 'src/b.js');
  commitar(git);
  // O cenário da revisão: pendenciasPath = arquivo de código rastreado, alterado depois do verde.
  writeFileSync(resolve(dir, 'a.js'), 'export const a = 6;\n');
  const rastreado = impressaoDuas(dir, SO_SPEC, ['a.js']);
  assert.equal(rastreado.status, 1, rastreado.stdout);
  assert.equal(rastreado.stdout, '');
  assert.match(rastreado.stderr, /rastreado/);
  // Só no índice (git add de arquivo novo) também é rastreado.
  writeFileSync(resolve(dir, 'novo.md'), 'x\n');
  git('add', '--', 'novo.md');
  assert.match(impressaoDuas(dir, SO_SPEC, ['novo.md']).stderr, /rastreado/);
  // Diretório rastreado, diretório só na worktree e symlink não rastreado.
  mkdirSync(resolve(dir, 'notas'));
  writeFileSync(resolve(dir, 'notas/p.md'), 'x\n');
  symlinkSync('a.js', resolve(dir, 'link.md'));
  for (const p of ['src', 'notas', 'link.md']) {
    const r = impressaoDuas(dir, SO_SPEC, [p]);
    assert.equal(r.status, 1, p);
    assert.equal(r.stdout, '', p);
  }
  // O mesmo path nas duas listas é ambíguo: recusa.
  assert.equal(impressaoDuas(dir, SO_SPEC, SO_SPEC).status, 1);
});

test('a segunda lista entra no hash separada da primeira; vazia é igual a ausente', (t) => {
  const { dir } = comSpec(t);
  const duas = valorDuas(dir, SO_SPEC, SO_PEND);
  assert.notEqual(duas, impressaoCom(dir, [...SO_SPEC, ...SO_PEND]), 'mesmos paths numa lista só é outra impressão');
  assert.notEqual(duas, impressaoCom(dir, SO_SPEC));
  assert.equal(valorDuas(dir, SO_SPEC, []), impressaoCom(dir, SO_SPEC));
  assert.equal(valorDuas(dir, [], []), valor(dir));
  const r = spawnSync(process.execPath, [SCRIPT, '--impressao', JSON.stringify(SO_SPEC), JSON.stringify(SO_PEND), 'extra'], { cwd: dir, env: ENV, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 1, 'argumento depois das duas listas');
});

// Tipo do não rastreado: o diff de `HEAD` mostra o modo só de arquivo rastreado. Executável novo
// e symlink novo entram com o tipo em campo próprio.

test('bit de execução de arquivo novo muda a impressão, e voltar o modo restaura', (t) => {
  const { dir } = base(t);
  writeFileSync(resolve(dir, 'run.sh'), 'echo ok\n');
  chmodSync(resolve(dir, 'run.sh'), 0o644);
  const comum = valor(dir);
  chmodSync(resolve(dir, 'run.sh'), 0o755);
  assert.notEqual(valor(dir), comum);
  chmodSync(resolve(dir, 'run.sh'), 0o644);
  assert.equal(valor(dir), comum);
});

test('symlink novo: troca de alvo muda, link quebrado tem impressão, e link não colide com arquivo de mesmos bytes', (t) => {
  const { dir } = base(t);
  writeFileSync(resolve(dir, 'um.json'), 'igual\n');
  writeFileSync(resolve(dir, 'dois.json'), 'igual\n');
  symlinkSync('um.json', resolve(dir, 'atual.json'));
  const um = valor(dir);
  unlinkSync(resolve(dir, 'atual.json'));
  symlinkSync('dois.json', resolve(dir, 'atual.json'));
  const dois = valor(dir);
  assert.notEqual(dois, um, 'alvo trocado, conteúdo igual');
  unlinkSync(resolve(dir, 'atual.json'));
  symlinkSync('sumiu.json', resolve(dir, 'atual.json'));
  const quebrado = valor(dir);
  assert.notEqual(quebrado, dois, 'link quebrado tem impressão própria, sem ENOENT');
  unlinkSync(resolve(dir, 'atual.json'));
  writeFileSync(resolve(dir, 'atual.json'), 'link:sumiu.json');
  assert.notEqual(valor(dir), quebrado, 'arquivo com os bytes do alvo não é o mesmo estado que o link');
  unlinkSync(resolve(dir, 'atual.json'));
  writeFileSync(resolve(dir, 'atual.json'), 'sumiu.json');
  assert.notEqual(valor(dir), quebrado, 'nem com os bytes crus do alvo');
});

test('impressão lê bytes reais sem executar clean/process nem colidir após normalização', t => {
  const { dir, git } = base(t);
  writeFileSync(resolve(dir, '.gitattributes'), 'a.js filter=probe\n');
  git('add', '.gitattributes'); commitar(git);
  git('config', 'filter.probe.clean', 'echo executado > efeito-filtro; printf normalizado');
  writeFileSync(resolve(dir, 'a.js'), 'conteúdo A\n');
  const a = valor(dir);
  writeFileSync(resolve(dir, 'a.js'), 'conteúdo B\n');
  const b = valor(dir);
  assert.notEqual(a, b, 'clean igual não esconde conteúdos distintos');
  assert.equal(existsSync(resolve(dir, 'efeito-filtro')), false);
  git('config', 'filter.probe.process', 'echo executado > efeito-filtro; exit 1');
  assert.equal(valor(dir), b, 'process também não roda nem altera impressão');
  assert.equal(existsSync(resolve(dir, 'efeito-filtro')), false);
});

test('rename e deleção entram pelos bytes e caminhos; staging não muda sua impressão', t => {
  const { dir, git } = base(t);
  const original = valor(dir);
  renameSync(resolve(dir, 'a.js'), resolve(dir, 'b.js'));
  const rename = valor(dir);
  assert.notEqual(rename, original);
  git('add', '-A'); assert.equal(valor(dir), rename);
  unlinkSync(resolve(dir, 'b.js'));
  const apagado = valor(dir); assert.notEqual(apagado, rename);
  git('add', '-A'); assert.equal(valor(dir), apagado);
});
