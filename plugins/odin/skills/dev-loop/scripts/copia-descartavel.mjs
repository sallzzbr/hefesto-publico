// Utilitários comuns das cópias descartáveis do workspace (`copia-base.mjs` e `mutantes.mjs`): git sem
// fsmonitor nem locks opcionais, validação de path relativo, escolha do diretório pai e o gitfile que
// impede o git de subir da cópia ao repositório que a contém.
import { execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync, lstatSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const gitEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
export const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false', ...args], {
  env: gitEnv, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
});
export const dentro = (base, alvo) => { const r = relative(base, alvo); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('../') && !r.startsWith('..\\')); };
export const lstatExiste = p => { try { lstatSync(p); return true; } catch { return false; } };
// Um parâmetro só: serve de callback de `every` e é comparado por identidade em `mutantes.mjs`.
export const relativoSeguro = p => typeof p === 'string' && p.trim() && p === p.trim() && !isAbsolute(p) && !/[:\\\x00-\x1f]/.test(p) && !p.split('/').some(x => x === '..' || x.toLowerCase() === '.git');

// Pares `--nome valor`; nome fora de `aceitas` ou sem valor é erro. O parsing de cada valor é do script.
export function parseOptionPairs(resto, aceitas) {
  const o = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!aceitas.includes(resto[i]) || resto[i + 1] === undefined) throw new Error(`opção inválida: ${resto[i]}`);
    o[resto[i].slice(2)] = resto[i + 1];
  }
  return o;
}

// Diretório pai da cópia: `--pai` ou o temporário do sistema, existente e gravável; dentro do workspace só
// se ignorado pelo Git, senão a cópia vira arquivo novo da entrega.
export function resolveCopyParent(root, paiInformado) {
  const origem = paiInformado ? '--pai' : 'TMPDIR/tmpdir do sistema';
  const pai = resolve(paiInformado ?? tmpdir());
  if (!existsSync(pai)) throw new Error(`diretório pai da cópia não existe: ${pai} (${origem}). Crie-o ou passe --pai <dir gravável>.`);
  try { accessSync(pai, constants.W_OK); }
  catch (e) { throw new Error(`diretório pai da cópia não é gravável: ${pai} (${e.code}; ${origem}). Passe --pai <dir gravável fora do workspace> ou ajuste TMPDIR; isto é ambiente, não falha do teste.`); }
  if (dentro(root, realpathSync(pai))) {
    try { git(['check-ignore', '-q', relative(root, realpathSync(pai)) || '.']); }
    catch { throw new Error(`diretório pai da cópia (${origem}) dentro do workspace precisa ser ignorado pelo Git: ${pai}. Passe --pai <dir ignorado ou fora do workspace>.`); }
  }
  return pai;
}

// Sem .git própria, `git` rodado na cópia subiria ao repositório que a contém e operaria no índice e nas
// refs do projeto. Um gitfile inválido por sintaxe faz o git falhar ali; nenhum path copiado o torna válido.
export const writeGitBlocker = dir => writeFileSync(join(dir, '.git'), 'odin: copia descartavel sem repositorio\n');
