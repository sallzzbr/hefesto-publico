// `mutantes.mjs medir` rodando de verdade contra repositórios git descartáveis (odin 3.1.0).
// Mede o EFEITO: o mutante chega ao comando (um verificador que conhece o original o mata), nunca
// toca a worktree (um sentinela que lê a worktree real sobrevive e o `git status` não muda), a cópia
// some, o resultado é o mesmo para a mesma entrada e a conferência (CRC-32 canônico, definido em
// `support/mutar-fixtures.mjs`) bate com a que o harness recalcula. Nenhuma conta, remoto ou hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { conferenciaDe } from './support/mutar-fixtures.mjs';

const SCRIPT = resolve(import.meta.dirname, '../skills/dev-loop/scripts/mutantes.mjs');
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
// O comando precisa existir no plugin antes de qualquer medição: a ausência é o comportamento que falta (asserção), não erro de import.
const medir = (cwd, base, excluidos, comandos, ...extra) => (assert.ok(existsSync(SCRIPT), 'A3: o plugin ainda não oferece o comando medir de mutação (mutantes.mjs medir não implementado)'), spawnSync(process.execPath, [SCRIPT, 'medir', base, JSON.stringify(excluidos), JSON.stringify(comandos), ...extra], { cwd, env, encoding: 'utf8', timeout: 120000 }));
const saida = p => { assert.equal(p.status, 0, `status ${p.status}: ${p.stderr}`); return JSON.parse(p.stdout); };

const VELHO = 'export function velho(a, b) {\n  return a > b;\n}\n';
const NOVO_JS = [
  'export function classe(n) {',
  '  // se n > 0 e n < 5 isto é comentário',
  '  const texto = "n >= 10 && true";',
  '  if (n >= 10 && n !== 99) {',
  '    return true;',
  '  }',
  '  return false;',
  '}',
  '',
].join('\n');
const NOVO_PY = ['def maior(a, b):', '    # return a > b  (comentário)', '    texto = "a > b"', '    if a >= b:', '        return True', '    return False', ''].join('\n');
const SEQUENCIA = prefixo => Array.from({ length: 30 }, (_, i) => `const ${prefixo}${i} = n >= ${i};`).join('\n') + '\n';

// Repositório com uma base commitada; devolve a raiz, o git e o SHA da base. A entrega (arquivos novos
// e linhas acrescentadas) fica na worktree, sem commit, salvo quando o caso commita.
function repo(t) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-repo-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => { const p = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' }); assert.equal(p.status, 0, p.stderr); return p.stdout.trim(); };
  const commit = msg => git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', msg);
  git('init', '-q');
  for (const d of ['src', 'tests', 'check']) mkdirSync(join(root, d));
  writeFileSync(join(root, 'src/velho.js'), VELHO);
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  git('add', '.'); commit('base');
  const base = git('rev-parse', 'HEAD');
  const escrever = (path, texto) => writeFileSync(join(root, path), texto);
  return { root, git, commit, base, escrever };
}

// Verificadores (excluídos da mutação): `mata-tudo` conhece o texto original dos arquivos e sai 1 se
// algum mudou NA CÓPIA; `sentinela` sai 1 se rodar dentro da worktree real ou se ela mudar.
function verificadores({ root, escrever }, originais) {
  escrever('check/snap.json', JSON.stringify(originais));
  escrever('check/mata-tudo.mjs', "import { readFileSync } from 'node:fs';\nconst o = JSON.parse(readFileSync('check/snap.json', 'utf8'));\nprocess.exit(Object.entries(o).every(([p, t]) => readFileSync(p, 'utf8') === t) ? 0 : 1);\n");
  escrever('check/parcial.mjs', "import { readFileSync } from 'node:fs';\nconst o = JSON.parse(readFileSync('check/snap.json', 'utf8'));\nconst linha = (t) => t.split('\\n')[3];\nprocess.exit(linha(readFileSync('src/novo.js', 'utf8')) === linha(o['src/novo.js']) ? 0 : 1);\n");
  escrever('check/sentinela.mjs', `import { readFileSync, realpathSync } from 'node:fs';\nconst o = JSON.parse(readFileSync('check/snap.json', 'utf8'));\nconst raiz = ${JSON.stringify(root)};\nif (realpathSync('.') === raiz) process.exit(1);\nprocess.exit(Object.entries(o).every(([p, t]) => readFileSync(raiz + '/' + p, 'utf8') === t) ? 0 : 1);\n`);
}
const VERIFICADORES = ['check/snap.json', 'check/mata-tudo.mjs', 'check/parcial.mjs', 'check/sentinela.mjs'];

function entrega(r) {
  r.escrever('src/novo.js', NOVO_JS);
  r.escrever('src/regra.py', NOVO_PY);
  r.escrever('src/velho.js', VELHO + 'export function novo(a) {\n  return a === 3;\n}\n');
  r.escrever('tests/novo.test.js', 'export const igual = (a, b) => a > b;\n');
  r.escrever('README.md', 'a > b e a >= b são só texto\n');
  verificadores(r, { 'src/novo.js': NOVO_JS, 'src/regra.py': NOVO_PY, 'src/velho.js': VELHO + 'export function novo(a) {\n  return a === 3;\n}\n' });
}
const EXCLUIDOS = ['tests/novo.test.js', ...VERIFICADORES];
const MATA_TUDO = 'node check/mata-tudo.mjs';

test('A3: gera mutantes só nas linhas acrescentadas dos arquivos elegíveis, fora de comentário e de texto entre aspas', t => {
  const r = repo(t); entrega(r);
  const out = saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO]));
  const porArquivo = a => out.mutantes.filter(m => m.path === a);
  const linhas = a => new Set(porArquivo(a).map(m => m.linha));
  assert.ok(out.candidatos >= 1 && out.amostrados === Math.min(out.candidatos, 20), JSON.stringify(out));
  for (const l of [4, 5, 7]) assert.ok(linhas('src/novo.js').has(l), `src/novo.js sem mutante na linha ${l}`);
  for (const l of [1, 2, 3, 6, 8]) assert.ok(!linhas('src/novo.js').has(l), `src/novo.js: linha ${l} é comentário, texto, chave ou declaração`);
  for (const l of [4, 5, 6]) assert.ok(linhas('src/regra.py').has(l), `src/regra.py sem mutante na linha ${l}`);
  for (const l of [1, 2, 3]) assert.ok(!linhas('src/regra.py').has(l), `src/regra.py: linha ${l} é comentário, texto ou declaração`);
  assert.deepEqual([...linhas('src/velho.js')], [5], 'arquivo existente: só a linha acrescentada, não o return da base');
  assert.ok(!out.mutantes.some(m => m.path === 'tests/novo.test.js' || m.path === 'README.md' || m.path.startsWith('check/')), 'excluídos e extensões fora da lista não geram mutante');
  for (const m of out.mutantes) assert.ok(m.id && m.operador && typeof m.de === 'string' && typeof m.para === 'string' && m.de !== m.para, JSON.stringify(m));
  assert.equal(new Set(out.mutantes.map(m => m.id)).size, out.mutantes.length, 'id único por mutante');
  const acrescentadas = Object.fromEntries(Object.entries(out.linhasAcrescentadas).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]));
  assert.equal(acrescentadas['src/novo.js'], 9, 'arquivo novo conta todas as linhas');
  assert.equal(acrescentadas['src/velho.js'], 3);
  assert.ok(!('tests/novo.test.js' in acrescentadas) && !('README.md' in acrescentadas));
});

test('A3: o mutante chega ao comando, nunca toca a worktree e a cópia some; a conferência é o CRC-32 canônico', t => {
  const r = repo(t); entrega(r);
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-pai-')));
  t.after(() => rmSync(pai, { recursive: true, force: true }));
  const antes = { status: r.git('status', '--porcelain'), novo: readFileSync(join(r.root, 'src/novo.js'), 'utf8'), index: readFileSync(join(r.root, '.git/index')) };
  const mata = saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO], '--pai', pai));
  assert.ok(mata.mutantes.length > 0);
  assert.ok(mata.mutantes.every(m => m.resultado === 'morto'), 'o verificador que conhece o original mata todos: o byte mudou na cópia');
  const sentinela = saida(medir(r.root, 'HEAD', EXCLUIDOS, ['node check/sentinela.mjs'], '--pai', pai));
  assert.ok(sentinela.controle.ok, 'o controle roda na cópia e a worktree real está como o original');
  assert.ok(sentinela.mutantes.length > 0 && sentinela.mutantes.every(m => m.resultado === 'sobrevivente'), 'a worktree real nunca é mutada');
  for (const out of [mata, sentinela]) {
    assert.equal(out.removida, true);
    assert.equal(out.worktreeIntacta, true);
    assert.equal(out.conferencia, conferenciaDe(out));
    assert.deepEqual(out.controle.execucoes.map(e => e.exitCode), [0]);
    assert.equal(out.controle.ok, true);
  }
  assert.deepEqual(readdirSync(pai), [], 'a cópia descartável foi removida do diretório pai');
  assert.equal(r.git('status', '--porcelain'), antes.status);
  assert.equal(readFileSync(join(r.root, 'src/novo.js'), 'utf8'), antes.novo);
  assert.ok(antes.index.equals(readFileSync(join(r.root, '.git/index'))), 'índice intacto');
});

test('A3: comando parcial separa morto de sobrevivente pela linha mutada', t => {
  const r = repo(t); entrega(r);
  const out = saida(medir(r.root, 'HEAD', EXCLUIDOS, ['node check/parcial.mjs']));
  const doNovo = out.mutantes.filter(m => m.path === 'src/novo.js');
  assert.ok(doNovo.filter(m => m.linha === 4).every(m => m.resultado === 'morto'), 'o verificador olha a linha 4');
  assert.ok(doNovo.filter(m => m.linha !== 4).length > 0 && doNovo.filter(m => m.linha !== 4).every(m => m.resultado === 'sobrevivente'));
});

test('A3: mesma entrada, mesma saída (mutantes, ordem, ids e conferência)', t => {
  const r = repo(t); entrega(r);
  const a = saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO]));
  const b = saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO]));
  assert.deepEqual(a, b);
});

test('A3: no máximo 20 por run, cota em rodízio por arquivo, um por linha espalhado do começo ao fim, sem fingir cobertura total', t => {
  const r = repo(t);
  r.escrever('src/b1.js', SEQUENCIA('x')); r.escrever('src/b2.js', SEQUENCIA('y'));
  const out = saida(medir(r.root, 'HEAD', [], ['node -e "0"']));
  assert.ok(out.candidatos >= 60, `candidatos ${out.candidatos}`);
  assert.equal(out.amostrados, 20);
  assert.equal(out.mutantes.length, 20);
  for (const arquivo of ['src/b1.js', 'src/b2.js']) {
    const deste = out.mutantes.filter(m => m.path === arquivo);
    assert.equal(deste.length, 10, `${arquivo}: rodízio por arquivo`);
    const linhas = deste.map(m => m.linha);
    assert.equal(new Set(linhas).size, linhas.length, `${arquivo}: no máximo um mutante por linha`);
    // Decisão do dono (2026-11-16): a amostra cobre o arquivo inteiro, não só as primeiras linhas.
    assert.equal(Math.min(...linhas), 1, `${arquivo}: começa na primeira linha acrescentada`);
    assert.ok(Math.max(...linhas) >= 25, `${arquivo}: chega ao fim das linhas acrescentadas (${linhas})`);
  }
  assert.ok(out.mutantes.every(m => m.resultado === 'sobrevivente'), 'comando que não testa nada: todos sobrevivem');
});

test('A3: --max reduz o teto', t => {
  const r = repo(t); r.escrever('src/b1.js', SEQUENCIA('x'));
  const out = saida(medir(r.root, 'HEAD', [], ['node -e "0"'], '--max', '5'));
  assert.equal(out.amostrados, 5);
  assert.ok(out.candidatos >= 30);
});

test('A3: com baseRef mede o que a entrega acrescentou desde a base, inclusive commitado; HEAD só enxerga a worktree', t => {
  const r = repo(t);
  r.escrever('src/novo.js', NOVO_JS); r.git('add', '.'); r.commit('entrega commitada');
  const comBase = saida(medir(r.root, r.base, [], ['node -e "0"']));
  assert.ok(comBase.candidatos > 0 && comBase.mutantes.every(m => m.path === 'src/novo.js'), JSON.stringify(comBase));
  const comHead = saida(medir(r.root, 'HEAD', [], ['node -e "0"']));
  assert.equal(comHead.candidatos, 0, 'nada acrescentado depois do HEAD');
});

test('A3: sem candidato devolve zero, nunca mutante inventado', t => {
  const r = repo(t); r.escrever('README.md', 'só texto a > b\n');
  const out = saida(medir(r.root, 'HEAD', [], ['node -e "0"']));
  assert.equal(out.candidatos, 0);
  assert.equal(out.amostrados, 0);
  assert.deepEqual(out.mutantes, []);
});

test('A3: controle que falha não roda mutante e fica registrado', t => {
  const r = repo(t); entrega(r);
  const out = saida(medir(r.root, 'HEAD', EXCLUIDOS, ['node -e "process.exit(3)"']));
  assert.equal(out.controle.ok, false);
  assert.deepEqual(out.controle.execucoes.map(e => e.exitCode), [3]);
  assert.deepEqual(out.mutantes.filter(m => m.resultado === 'morto'), [], 'falha de ambiente nunca vira mutante morto');
  assert.equal(out.removida, true);
  assert.equal(out.conferencia, conferenciaDe(out));
});

test('A3: --vincular dá à cópia as dependências do workspace por symlink', t => {
  const r = repo(t); entrega(r);
  mkdirSync(join(r.root, 'node_modules/pkg'), { recursive: true });
  writeFileSync(join(r.root, 'node_modules/pkg/ok.txt'), 'ok');
  const com = saida(medir(r.root, 'HEAD', EXCLUIDOS, ['node -e "require(\'fs\').readFileSync(\'node_modules/pkg/ok.txt\')"'], '--vincular', JSON.stringify(['node_modules'])));
  assert.equal(com.controle.ok, true);
  const sem = saida(medir(r.root, 'HEAD', EXCLUIDOS, ['node -e "require(\'fs\').readFileSync(\'node_modules/pkg/ok.txt\')"']));
  assert.equal(sem.controle.ok, false, 'sem --vincular a dependência não existe na cópia');
});

test('A3: argumento inválido sai com erro e mensagem, sem JSON parcial', t => {
  const r = repo(t); entrega(r);
  assert.equal(saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO])).controle.ok, true, 'o mesmo comando com argumentos válidos funciona');
  for (const [args, nome] of [[['medir', 'HEAD', 'não é json', '["node -e 0"]'], 'excluídos inválidos'], [['medir', '--inexistente', '[]', '["node -e 0"]'], 'base inválida'], [['sorteio'], 'subcomando desconhecido']]) {
    const p = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: r.root, env, encoding: 'utf8', timeout: 60000 });
    assert.notEqual(p.status, 0, nome);
    assert.equal(p.stdout.trim(), '', `${nome}: nada em stdout`);
    assert.ok(p.stderr.trim().length > 0, `${nome}: mensagem em stderr`);
  }
  const fora = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-fora-')));
  t.after(() => rmSync(fora, { recursive: true, force: true }));
  const p = spawnSync(process.execPath, [SCRIPT, 'medir', 'HEAD', '[]', '["node -e 0"]'], { cwd: fora, env, encoding: 'utf8', timeout: 60000 });
  assert.notEqual(p.status, 0, 'fora de um repositório git');
  assert.equal(p.stdout.trim(), '');
});

const pausa = ms => new Promise(ok => setTimeout(ok, ms));
const vivo = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('A3: interrompido por sinal, remove a cópia e encerra o comando em andamento, sem JSON parcial', async t => {
  const r = repo(t); entrega(r);
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-pai-')));
  const pidf = join(realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-pid-'))), 'pid');
  t.after(() => { rmSync(pai, { recursive: true, force: true }); rmSync(dirname(pidf), { recursive: true, force: true }); });
  const lento = `node -e "require('fs').writeFileSync(${JSON.stringify(pidf).replace(/"/g, "'")}, String(process.pid)); setTimeout(() => {}, 60000)"`;
  assert.ok(existsSync(SCRIPT), 'A3: o plugin ainda não oferece o comando medir de mutação');
  const p = spawn(process.execPath, [SCRIPT, 'medir', 'HEAD', JSON.stringify(EXCLUIDOS), JSON.stringify([lento]), '--pai', pai], { cwd: r.root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  p.stdout.on('data', d => { stdout += d; });
  const saiu = new Promise(ok => p.on('close', (code, sinal) => ok({ code, sinal })));
  for (let i = 0; i < 300 && !existsSync(pidf); i++) await pausa(100);
  assert.ok(existsSync(pidf), 'o comando de controle começou');
  const filho = Number(readFileSync(pidf, 'utf8'));
  p.kill('SIGTERM');
  const fim = await saiu;
  for (let i = 0; i < 50 && vivo(filho); i++) await pausa(100);
  assert.notEqual(fim.code, 0, `sai diferente de 0 (${JSON.stringify(fim)})`);
  assert.equal(stdout.trim(), '', 'nada em stdout');
  assert.deepEqual(readdirSync(pai), [], 'a cópia descartável foi removida');
  assert.equal(vivo(filho), false, 'o comando em andamento não fica órfão');
});

test('A3: link simbólico e arquivo binário não contam como linhas acrescentadas', t => {
  const r = repo(t); entrega(r);
  const fora = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-alvo-')));
  t.after(() => rmSync(fora, { recursive: true, force: true }));
  writeFileSync(join(fora, 'alvo.js'), 'const a = 1 >= 2;\nconst b = true;\n');
  symlinkSync(join(fora, 'alvo.js'), join(r.root, 'src/link.js'));
  writeFileSync(join(r.root, 'src/binario.js'), Buffer.from([0x63, 0x00, 0x3e, 0x3d, 0x0a, 0xff, 0xfe]));
  const out = saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO]));
  assert.ok(!Object.hasOwn(out.linhasAcrescentadas, 'src/link.js'), JSON.stringify(out.linhasAcrescentadas));
  assert.ok(!Object.hasOwn(out.linhasAcrescentadas, 'src/binario.js'), JSON.stringify(out.linhasAcrescentadas));
  assert.ok(Object.hasOwn(out.linhasAcrescentadas, 'src/novo.js'), 'o arquivo de texto continua contado');
});

test('A3: --vincular nunca escreve através de link simbólico da cópia (fora dela)', t => {
  const r = repo(t); entrega(r);
  // `lib` aponta para ../<nome> relativo: na worktree é um irmão dela; na cópia, um irmão da cópia dentro de --pai.
  const nome = `odin-mut-lib-${process.pid}-${Date.now()}`;
  const irmao = resolve(r.root, '..', nome);
  mkdirSync(join(irmao, 'node_modules'), { recursive: true });
  const pai = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-mut-pai-')));
  mkdirSync(join(pai, nome));
  t.after(() => { rmSync(irmao, { recursive: true, force: true }); rmSync(pai, { recursive: true, force: true }); });
  symlinkSync(`../${nome}`, join(r.root, 'lib'));
  r.git('add', 'lib'); r.commit('lib');
  medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO], '--vincular', JSON.stringify(['lib/node_modules']), '--pai', pai);
  assert.ok(!existsSync(join(pai, nome, 'node_modules')), 'o vínculo não pode nascer fora da cópia');
});

test('A3: cada mutante traz o trecho original da linha (sem espaços nas pontas), que o identifica entre medições', t => {
  const r = repo(t); entrega(r);
  const out = saida(medir(r.root, 'HEAD', EXCLUIDOS, [MATA_TUDO]));
  const original = { 'src/novo.js': NOVO_JS, 'src/regra.py': NOVO_PY };
  for (const m of out.mutantes.filter(x => original[x.path])) assert.equal(m.trecho, original[m.path].split('\n')[m.linha - 1].trim(), m.id);
  assert.equal(out.conferencia, conferenciaDe(out));
});

test('A3: --prioridade põe o mutante pendente (mesmo path, trecho e troca) na amostra antes do resto, dentro do teto', t => {
  const r = repo(t);
  r.escrever('src/b1.js', SEQUENCIA('x')); r.escrever('src/b2.js', SEQUENCIA('y'));
  const pendente = { path: 'src/b1.js', trecho: 'const x29 = n >= 29;', operador: 'comparacao', de: '>=', para: '<' };
  const fantasma = { path: 'src/b1.js', trecho: 'const x99 = n >= 99;', operador: 'comparacao', de: '>=', para: '<' };
  const sem = saida(medir(r.root, 'HEAD', [], ['node -e "0"'], '--max', '6'));
  assert.ok(!sem.mutantes.some(m => m.path === pendente.path && m.linha === 30), 'sem prioridade a linha 30 fica fora desta amostra');
  const com = saida(medir(r.root, 'HEAD', [], ['node -e "0"'], '--max', '6', '--prioridade', JSON.stringify([pendente, fantasma])));
  assert.equal(com.amostrados, 6, 'a prioridade conta no teto');
  const [primeiro] = com.mutantes;
  assert.deepEqual([primeiro.path, primeiro.linha, primeiro.trecho, primeiro.de, primeiro.para], ['src/b1.js', 30, pendente.trecho, '>=', '<']);
  assert.ok(!com.mutantes.some(m => m.trecho === fantasma.trecho), 'pendente sem candidato não é inventado');
  const invalida = medir(r.root, 'HEAD', [], ['node -e "0"'], '--prioridade', '[{"path":"src/b1.js"}]');
  assert.notEqual(invalida.status, 0, '--prioridade sem trecho e troca é argumento inválido');
  assert.equal(invalida.stdout.trim(), '');
});

test('312-R4: --pai inexistente sai com a mensagem de copia-base, com a origem, sem JSON', t => {
  const r = repo(t);
  r.escrever('src/novo.js', NOVO_JS);
  const p = medir(r.root, 'HEAD', [], ['node -e "0"'], '--pai', join(r.root, 'nao-existe'));
  assert.notEqual(p.status, 0);
  assert.equal(p.stdout.trim(), '');
  assert.match(p.stderr, /diretório pai da cópia não existe: .*nao-existe \(--pai\)\. Crie-o ou passe --pai <dir gravável>\./);
});
