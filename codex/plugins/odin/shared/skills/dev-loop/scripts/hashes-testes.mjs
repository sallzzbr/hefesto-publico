#!/usr/bin/env node
// O Workflow não tem filesystem. O operário executa este CLI no cwd do projeto
// e transporta o JSON sem reformatar chaves; crypto calcula os hashes, não o modelo.
// Cada valor sai como `<sha256>-<conferência>`: quem leva o JSON ao controlador é um modelo
// copiando 64 caracteres, e sem a conferência uma troca de dois deles é indistinguível de
// "teste alterado". O controlador recalcula a conferência e recusa a transcrição errada.
//
// Modo `--impressao ['<excluídos do diff>' ['<excluídos só dos não rastreados>']]`: impressão da
// worktree, a evidência que deixa
// o harness reaproveitar uma validação longa quando nada mudou desde ela. Mesmo formato e mesma
// conferência (CRC-32 de `worktree\n<sha>`). Cobre o repositório INTEIRO, mesmo com o cwd num
// subdiretório (monorepo): HEAD, bytes reais dos rastreados (com ou sem staging) e arquivos não
// rastreados não ignorados, cada um com o tipo (arquivo, executável ou symlink) e o conteúdo (ou
// o alvo do link). Ignorados (venv, caches) ficam fora.
//
// Excluídos (2.6.0): arquivos que o fluxo grava DEPOIS da validação sem mudar o que foi validado.
// Sem isso a impressão mudava só por gravar o relatório e o reuso nunca conferia no fluxo
// documentado. São duas listas, porque os dois arquivos são de natureza diferente:
// - a primeira sai do `git diff HEAD` e dos não rastreados: o arquivo da SPEC, rastreado, que
//   recebe o Log de execução e o relatório;
// - a segunda sai SÓ dos não rastreados, por igualdade exata: o arquivo de pendências, que nunca
//   é commitado. Rastreado (HEAD ou índice), symlink ou diretório nela faz a impressão ser
//   recusada: com pathspec no diff, um path de pendências que apontasse para código rastreado
//   escondia o código, e a validação longa era reaproveitada sobre código alterado.
// Paths relativos ao cwd, um arquivo cada (diretório é recusado nas duas: esconderia código). As
// listas entram no hash, cada uma no seu campo: o recálculo só confere com as mesmas listas.
// Sem lista, ou com listas vazias, nada muda no que é hasheado.
//
// `hashesDeTestes` é exportado para `copia-base.mjs`, que prova que a cópia descartável da base
// usou os mesmos bytes de teste da worktree: um único algoritmo de hash e conferência.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
// CRC-32 (IEEE) de `path\nsha`. Mesmo algoritmo, byte a byte, do `crc32` de `harness/loop.mjs`
// (o harness não importa nada): unidade UTF-16 abaixo de 256 entra como um byte, as demais
// como byte baixo e byte alto. `tests/harness-dev-loop.test.mjs` roda os dois juntos.
function crc32(texto) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < texto.length; i++) {
    const u = texto.charCodeAt(i);
    for (const b of u < 256 ? [u] : [u & 0xFF, u >>> 8]) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
export function hashesDeTestes(paths, root = realpathSync(process.cwd())) {
  if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string')) throw new Error('esperado array JSON de paths');
  const entries = paths.map(p => {
    if (!p.trim() || p !== p.trim() || isAbsolute(p) || /[:\\]/.test(p) || p.split('/').includes('..')) throw new Error(`path de teste inválido: ${p}`);
    const canonical = posix.normalize(p);
    const real = realpathSync(resolve(root, canonical));
    const rel = relative(root, real);
    if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel) || !statSync(real).isFile()) throw new Error(`teste fora do projeto ou não regular: ${p}`);
    const sha = createHash('sha256').update(readFileSync(real)).digest('hex');
    return [canonical, `${sha}-${crc32(`${canonical}\n${sha}`)}`];
  });
  return Object.fromEntries(entries);
}
// Excluído é path relativo de ARQUIVO: '.', barra no fim, '..', '.git', ':' e '\' são recusados
// aqui; diretório no HEAD, no índice ou na worktree é recusado em `impressaoWorktree`.
function excluidosValidos(lista) {
  if (!Array.isArray(lista)) throw new Error('excluídos: esperado array JSON de paths relativos');
  return [...new Set(lista.map(p => {
    if (typeof p !== 'string' || !p.trim() || p !== p.trim() || isAbsolute(p) || /[:\\\x00-\x1f]/.test(p) || p.endsWith('/') || p.split('/').some(x => x === '..' || x === '.git')) throw new Error(`excluído inválido: ${JSON.stringify(p)}`);
    const canonical = posix.normalize(p);
    if (canonical === '.') throw new Error(`excluído inválido: ${JSON.stringify(p)}`);
    return canonical;
  }))].sort();
}
// Variáveis que mudam a leitura de pathspec: com GIT_LITERAL_PATHSPECS=1 a magia
// `:(exclude,literal)` vira path literal e a exclusão some (falha fechada, mas o reuso morre).
const PATHSPEC_ENV = ['GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS'];
function impressaoWorktree(cwd, excluidosDoCwd = [], naoRastreadosDoCwd = []) {
  const env = { ...process.env };
  for (const k of PATHSPEC_ENV) delete env[k];
  // fsmonitor do repositório não decide o que mudou (daemon que perde evento esconde arquivo).
  const gitEm = dir => (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.quotepath=off', '-c', 'diff.noprefix=false', '-c', 'diff.mnemonicPrefix=false', '-c', 'diff.renames=false', ...args], { cwd: dir, env, maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  let head;
  try { head = gitEm(cwd)('rev-parse', '--verify', '--quiet', 'HEAD').toString('utf8').trim(); } catch { head = ''; }
  if (!head) throw new Error('repositório sem HEAD: não há impressão da worktree');
  // Tudo roda da raiz do repositório: com o cwd num subdiretório, `ls-files` só via o
  // subdiretório e um não rastreado ou skip-worktree fora dele (lib comum do monorepo) não
  // mudava a impressão. O diff já cobria o repositório inteiro; os excluídos, relativos ao cwd,
  // ganham o prefixo do subdiretório.
  const prefixo = gitEm(cwd)('rev-parse', '--show-prefix').toString('utf8').trim();
  const root = realpathSync(gitEm(cwd)('rev-parse', '--show-toplevel').toString('utf8').trim());
  const git = gitEm(root);
  const fora = excluidosDoCwd.map(p => posix.join(prefixo, p)).sort();
  const foraNovos = naoRastreadosDoCwd.map(p => posix.join(prefixo, p)).sort();
  const nasDuas = foraNovos.filter(p => fora.includes(p));
  if (nasDuas.length) throw new Error(`o mesmo path nas duas listas de excluídos: ${nasDuas.join(', ')}`);
  for (const p of foraNovos) {
    // Mede o que o path é, não o formato dele: qualquer entrada no HEAD ou no índice (arquivo ou
    // diretório) é rastreada e não pode sair da impressão por esta lista.
    const doGit = git('ls-files', '-z', '--with-tree=HEAD', '--', `:(literal)${p}`).toString('utf8').split('\0').filter(Boolean);
    if (doGit.length) throw new Error(`excluído só dos não rastreados está rastreado (HEAD ou índice): ${p}`);
    let st = null;
    try { st = lstatSync(resolve(root, p)); } catch {}
    if (st && !st.isFile()) throw new Error(`excluído só dos não rastreados não é arquivo regular (symlink, diretório ou especial): ${p}`);
  }
  for (const p of fora) {
    // `--with-tree=HEAD` inclui o que o índice já removeu: diretório apagado da worktree e do
    // índice continua recusado. Excluir diretório esconderia código da impressão.
    const doGit = git('ls-files', '-z', '--with-tree=HEAD', '--', `:(literal)${p}`).toString('utf8').split('\0').filter(Boolean);
    let st = null;
    try { st = lstatSync(resolve(root, p)); } catch {}
    if (doGit.some(x => x !== p) || (st && st.isDirectory())) throw new Error(`excluído é diretório, não arquivo: ${p}`);
  }
  // Submódulos e worktrees parciais seguem sem impressão: o inventário não prova todos os
  // bytes nesses casos. Sem impressão não há reuso, e a validação longa roda de novo.
  const indice = git('ls-files', '-s', '-v', '-z').toString('utf8').split('\0').filter(Boolean);
  // Linha de `ls-files -s -v`: `<tag> <modo> <sha> <estágio>\t<path>`; modo 160000 = submódulo.
  if (indice.some(l => l.split(' ')[1] === '160000')) throw new Error('submódulo no índice: a impressão não enxerga o conteúdo dele');
  const marcados = indice.filter(l => /^[a-zS] /.test(l)).map(l => l.split('\t')[1]);
  if (marcados.length) throw new Error(`arquivo com assume-unchanged ou skip-worktree: ${marcados.join(', ')}`);
  const h = createHash('sha256');
  h.update(`head ${head}\n`);
  if (fora.length) h.update(`excluidos ${JSON.stringify(fora)}\n`);
  if (foraNovos.length) h.update(`excluidos-nao-rastreados ${JSON.stringify(foraNovos)}\n`);
  // Assinar os bytes reais, sem diff: clean/process podem executar código e normalizar
  // conteúdos distintos. A união HEAD/índice inclui também deleções staged; staging sem
  // mudança de bytes não altera a impressão.
  const excluidos = new Set([...fora, ...foraNovos]);
  const rastreados = git('ls-files', '--cached', '--with-tree=HEAD', '-z').toString('utf8').split('\0').filter(Boolean);
  const novos = git('ls-files', '--others', '--exclude-standard', '-z').toString('utf8').split('\0').filter(Boolean);
  for (const p of [...new Set([...rastreados, ...novos])].filter(p => !excluidos.has(p)).sort()) {
    if (p.endsWith('/')) throw new Error(`repositório git aninhado não rastreado: ${p}`);
    const abs = resolve(root, p);
    // Nenhum ancestral pode redirecionar a leitura para fora da árvore.
    const partes = p.split('/');
    for (let i = 1; i < partes.length; i++) {
      try { if (lstatSync(resolve(root, ...partes.slice(0, i))).isSymbolicLink()) throw new Error(`symlink ancestral: ${p}`); }
      catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e; }
    }
    let st;
    try { st = lstatSync(abs); }
    catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
      // Ausência não ganha registro: arquivo novo apagado antes/depois de git add -A
      // representa a mesma worktree. A remoção do registro de bytes já muda o hash.
      continue;
    }
    let tipo, conteudo;
    if (st.isSymbolicLink()) { tipo = 'link'; conteudo = Buffer.from(readlinkSync(abs)); }
    else if (st.isFile()) { tipo = st.mode & 0o111 ? 'exec' : 'arquivo'; conteudo = readFileSync(abs); }
    else throw new Error(`arquivo sem conteúdo assinável (diretório ou tipo especial): ${p}`);
    h.update(`\0arquivo ${p}\0${tipo}\0${createHash('sha256').update(conteudo).digest('hex')}\n`);
  }
  const sha = h.digest('hex');
  return `${sha}-${crc32(`worktree\n${sha}`)}`;
}
// CLI só quando executado diretamente. Importado pela `copia-base.mjs`, o argv é o dela e rodar o
// CLI aqui imprimia erro e setava exitCode 1. realpath dos DOIS lados: com
// `--preserve-symlinks-main`, import.meta.url fica com o path do symlink.
const principal = (() => {
  try { return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (principal) {
  try {
    if (process.argv[2] === '--impressao') {
      if (process.argv.length > 5) throw new Error('--impressao aceita só as listas JSON de excluídos do diff e de excluídos só dos não rastreados');
      const lista = i => process.argv[i] === undefined ? [] : excluidosValidos(JSON.parse(process.argv[i]));
      console.log(JSON.stringify({ impressao: impressaoWorktree(realpathSync(process.cwd()), lista(3), lista(4)) }));
    } else {
      console.log(JSON.stringify(hashesDeTestes(JSON.parse(process.argv[2]))));
    }
  } catch (e) {
    console.error(`ERRO: ${e.message}`);
    process.exitCode = 1;
  }
}
