#!/usr/bin/env node
// Cópia descartável da base para medir o vermelho do portão TDD quando a implementação já
// existe na worktree (retomada tardia, rebaseline aprovada). A worktree, o índice e as refs do
// projeto não são tocados: blobs crus via `cat-file` (sem filtros Git) vão
// para um diretório fora do workspace (ou num diretório que o Git dele ignora), e os testes
// atuais da SPEC e o apoio do portão são sobrepostos.
//
//   criar <ref> <array JSON de testes> [--pai <dir>] [--vincular <array JSON de dirs>] [--apoio <array JSON>]
//   remover <dir>
//
// `--vincular` cria symlinks na cópia para diretórios de dependência do workspace (ex.:
// node_modules, .venv); o script não instala nada. Cuidado registrado no relatório da cópia:
// dependência que aponta para o código do workspace (install editável, pacote de workspace)
// faz a cópia importar a implementação; isso aparece como teste verde na base e bloqueia
// (direção segura), nunca como vermelho falso.
import { execFileSync } from 'node:child_process';
import { accessSync, chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { hashesDeTestes } from './hashes-testes.mjs';

const MARCA = '.odin-copia-base';
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
const git = (args, extraEnv = {}) => execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
  env: { ...env, ...extraEnv }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
});
const dentro = (base, alvo) => { const r = relative(base, alvo); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('../') && !r.startsWith('..\\')); };
const lstatExiste = p => { try { lstatSync(p); return true; } catch { return false; } };
const relativoSeguro = p => typeof p === 'string' && p.trim() && p === p.trim() && !isAbsolute(p) && !/[:\\\x00-\x1f]/.test(p) && !p.split('/').some(x => x === '..' || x.toLowerCase() === '.git' || x === MARCA);

function opcoes(resto) {
  const o = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!['--pai', '--vincular', '--apoio'].includes(resto[i]) || resto[i + 1] === undefined) throw new Error(`opção inválida: ${resto[i]}`);
    o[resto[i].slice(2)] = resto[i + 1];
  }
  return o;
}

function gravavel(dir, origem) {
  if (!existsSync(dir)) throw new Error(`diretório pai da cópia não existe: ${dir} (${origem}). Crie-o ou passe --pai <dir gravável>.`);
  try { accessSync(dir, constants.W_OK); }
  catch (e) { throw new Error(`diretório pai da cópia não é gravável: ${dir} (${e.code}; ${origem}). Passe --pai <dir gravável fora do workspace> ou ajuste TMPDIR; isto é ambiente, não falha do teste.`); }
}

function criar(ref, testesJson, resto) {
  const root = realpathSync(git(['rev-parse', '--show-toplevel']).trim());
  if (root !== realpathSync(process.cwd())) throw new Error('execute da raiz física do workspace');
  if (typeof ref !== 'string' || !/^[A-Za-z0-9._/~^@{}-]+$/.test(ref) || ref.startsWith('-') || ref.includes('..')) throw new Error(`ref inválida: ${ref}`);
  const sha = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
  if (!/^[0-9a-f]{40,64}$/.test(sha)) throw new Error(`ref não resolve para commit: ${ref}`);
  const testes = JSON.parse(testesJson);
  if (!Array.isArray(testes) || !testes.length || !testes.every(relativoSeguro)) throw new Error('testes: array JSON não vazio de paths relativos');
  const o = opcoes(resto);
  const vincular = o.vincular === undefined ? [] : JSON.parse(o.vincular);
  if (!Array.isArray(vincular) || !vincular.every(relativoSeguro)) throw new Error('--vincular: array JSON de paths relativos');
  // Apoio do portão TDD (helpers, fixtures): sobreposto como os testes, sem hash de proteção.
  const apoio = o.apoio === undefined ? [] : JSON.parse(o.apoio);
  if (!Array.isArray(apoio) || !apoio.every(relativoSeguro)) throw new Error('--apoio: array JSON de paths relativos');

  // Origens validadas ANTES de criar a cópia: falha depois do mkdtemp deixava a base inteira
  // para trás sem devolver o path para `remover`.
  const copiados = testes.map(p => posix.normalize(p));
  const apoioCopiado = apoio.map(p => posix.normalize(p)).filter(p => !copiados.includes(p));
  const origens = [...copiados, ...apoioCopiado].map(p => {
    const origem = realpathSync(resolve(root, p));
    if (!dentro(root, origem) || !lstatSync(origem).isFile()) throw new Error(`teste ou apoio fora do workspace ou não regular: ${p}`);
    return [p, origem];
  });

  const pai = resolve(o.pai ?? tmpdir());
  gravavel(pai, o.pai ? '--pai' : 'TMPDIR/tmpdir do sistema');
  // Dentro do workspace só em diretório ignorado pelo Git: senão a cópia vira arquivo novo na entrega.
  if (dentro(root, realpathSync(pai))) {
    try { git(['check-ignore', '-q', relative(root, realpathSync(pai)) || '.']); }
    catch { throw new Error(`diretório pai da cópia (${o.pai ? '--pai' : 'TMPDIR/tmpdir do sistema'}) dentro do workspace precisa ser ignorado pelo Git: ${pai}. Passe --pai <dir ignorado ou fora do workspace>.`); }
  }
  const dir = realpathSync(mkdtempSync(join(pai, 'odin-base-')));
  try {
    writeFileSync(join(dir, MARCA), JSON.stringify({ ref, sha, workspace: root }) + '\n');
    // Ler blobs não executa smudge/process nem conversores do checkout. Validar todos os
    // caminhos antes de escrever; a marca e o bloqueador Git pertencem ao helper.
    const entradas = git(['ls-tree', '-r', '-z', sha]).split('\0').filter(Boolean).map(l => {
      const m = /^(\d+) (blob|commit) ([0-9a-f]+)\t([\s\S]+)$/.exec(l);
      if (!m || !relativoSeguro(m[4]) || posix.normalize(m[4]) !== m[4]) throw new Error('path ou entrada inválida na base');
      return { modo: m[1], tipo: m[2], oid: m[3], p: m[4] };
    });
    for (const { modo, tipo, oid, p } of entradas) {
      if (tipo === 'commit' && modo === '160000') continue;
      if (!['100644', '100755', '120000'].includes(modo)) throw new Error(`modo não materializável: ${modo}`);
      let atual = dir;
      for (const parte of dirname(p).split('/').filter(x => x !== '.')) {
        atual = join(atual, parte);
        if (lstatExiste(atual)) {
          if (!lstatSync(atual).isDirectory() || lstatSync(atual).isSymbolicLink()) throw new Error(`symlink ou arquivo no caminho da base: ${p}`);
        } else mkdirSync(atual);
      }
      const destino = join(dir, p);
      if (lstatExiste(destino)) throw new Error(`colisão de caminhos na base: ${p}`);
      const bytes = execFileSync('git', ['cat-file', 'blob', oid], { env, maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
      if (modo === '120000') symlinkSync(bytes.toString('utf8'), destino);
      else { writeFileSync(destino, bytes, { flag: 'wx' }); chmodSync(destino, modo === '100755' ? 0o755 : 0o644); }
    }
    // A base pode ter symlink (inclusive absoluto, para dentro do workspace) no caminho de um
    // teste: escrever através dele alterava arquivo rastreado do projeto. Cada componente até o
    // destino precisa ser diretório real da cópia, e um destino symlink é removido, não seguido.
    const destinoSeguro = p => {
      let atual = dir;
      for (const parte of dirname(p).split('/').filter(x => x && x !== '.')) {
        atual = join(atual, parte);
        if (existsSync(atual) || lstatExiste(atual)) {
          if (lstatSync(atual).isSymbolicLink() || !lstatSync(atual).isDirectory()) throw new Error(`a base tem symlink ou arquivo no caminho de ${p} (${relative(dir, atual)}); a cópia não escreve através dele`);
        } else mkdirSync(atual);
      }
      const destino = join(dir, p);
      if (lstatExiste(destino)) { if (lstatSync(destino).isDirectory() && !lstatSync(destino).isSymbolicLink()) throw new Error(`destino é diretório na base: ${p}`); unlinkSync(destino); }
      return destino;
    };
    for (const [p, origem] of origens) copyFileSync(origem, destinoSeguro(p));
    const vinculados = [];
    for (const p of vincular.map(x => posix.normalize(x))) {
      const origem = resolve(root, p);
      if (!existsSync(origem) || !lstatSync(origem).isDirectory() || lstatExiste(join(dir, p))) continue;
      // Windows sem Modo de Desenvolvedor recusa symlink comum de diretório; junction não.
      symlinkSync(origem, destinoSeguro(p), process.platform === 'win32' ? 'junction' : undefined);
      vinculados.push(p);
    }
    // Sem .git própria, `git` rodado na cópia subia até o repositório que a contém (ex.: --pai
    // ignorado dentro do workspace) e operava no índice e nas refs do projeto. Um gitfile
    // inválido por sintaxe faz o git falhar aqui em vez de subir; nenhum path da base pode
    // transformá-lo em um repositório válido.
    writeFileSync(join(dir, '.git'), 'odin: copia descartavel sem repositorio\n');
    return {
      dir, ref, sha, testes: copiados, apoio: apoioCopiado, vinculados,
      hashesDosTestes: hashesDeTestes(copiados, dir),
      limites: 'sem repositório Git (git falha dentro da cópia), submódulos e arquivos LFS não materializados; dependências só via --vincular; nada instalado',
    };
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

function remover(alvo) {
  if (typeof alvo !== 'string' || !isAbsolute(alvo)) throw new Error('remover exige o caminho absoluto devolvido por criar');
  const dir = realpathSync(alvo);
  const marca = JSON.parse(readFileSync(join(dir, MARCA), 'utf8'));
  if (!marca || typeof marca.sha !== 'string') throw new Error('diretório sem marca de cópia da base; nada removido');
  rmSync(dir, { recursive: true, force: false });
  return { removido: dir, sha: marca.sha };
}

try {
  const [modo, a, b, ...resto] = process.argv.slice(2);
  let out;
  if (modo === 'criar' && a && b) out = criar(a, b, resto);
  else if (modo === 'remover' && a && b === undefined) out = remover(a);
  else throw new Error('uso: copia-base.mjs criar <ref> <array JSON de testes> [--pai <dir>] [--vincular <array JSON>] [--apoio <array JSON>] | remover <dir>');
  console.log(JSON.stringify(out));
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
