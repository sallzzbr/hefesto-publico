#!/usr/bin/env node
// Inspeção do workspace sem staging. diff inclui trabalho rastreado e novos explicitados;
// staged confere TODOS os paths do índice antes do commit, sem retirar trabalho alheio.
// Não prova autorização humana nem isola um shell malicioso. A sessão confere o escopo.
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve } from 'node:path';
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
const git = (...args) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
  env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'],
});
const list = text => text.split('\0').filter(Boolean);
try {
  const mode = process.argv[2], input = JSON.parse(process.argv[3]);
  if (!['diff', 'staged'].includes(mode) || !Array.isArray(input)) throw new Error('uso: inspecionar-git.mjs diff|staged <array JSON de paths relativos>');
  const paths = new Set(input.map(p => {
    if (typeof p !== 'string' || !p.trim() || p !== p.trim() || isAbsolute(p) || /[:\\\x00-\x1f]/.test(p) || p.split('/').some(x => x === '..' || x === '.git')) throw new Error('path inválido no escopo');
    const canonical = posix.normalize(p);
    if (canonical === '.' || canonical.endsWith('/')) throw new Error('escopo exige arquivos, não diretórios');
    return canonical;
  }));
  const root = realpathSync(git('rev-parse', '--show-toplevel').trim());
  if (root !== realpathSync(process.cwd())) throw new Error('execute da raiz física do workspace');
  if (mode === 'staged') {
    // Sem detecção de rename: tanto a remoção da origem quanto a adição exigem escopo.
    const staged = list(git('diff', '--cached', '--name-only', '--no-renames', '-z', '--'));
    const foraDoEscopo = staged.filter(p => !paths.has(p));
    const ok = staged.length > 0 && foraDoEscopo.length === 0;
    console.log(JSON.stringify({ ok, paths: staged, foraDoEscopo }));
    if (!ok) process.exitCode = 1;
  } else {
    const untracked = list(git('ls-files', '--others', '--exclude-standard', '-z'));
    const rastreados = new Set([...list(git('ls-files', '--cached', '-z')), ...list(git('diff', '--name-only', '--no-renames', '-z', 'HEAD', '--'))]);
    const declaradosNaoInspecionados = [...paths].filter(p => !rastreados.has(p) && !untracked.includes(p));
    const novos = untracked.filter(p => paths.has(p)).map(p => {
      const file = resolve(root, p), real = realpathSync(file), rel = relative(root, real);
      if (!lstatSync(file).isFile() || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error(`arquivo novo não regular ou fora do workspace: ${p}`);
      const bytes = readFileSync(file);
      return { path: p, binario: bytes.includes(0), conteudo: bytes.includes(0) ? null : bytes.toString('utf8') };
    });
    console.log(JSON.stringify({
      rastreados: git('diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--'),
      staged: git('diff', '--cached', '--no-ext-diff', '--no-textconv', '--'),
      novos, declaradosNaoInspecionados, novosNaoIncluidos: untracked.filter(p => !paths.has(p)),
    }));
  }
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
